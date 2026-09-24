"""
ShopGoodwill bid sniper daemon.
Original author: Scott Conway — https://github.com/scottmconway/shopgoodwill-scripts

Usage:
    python bid_sniper.py --config config.json
    python bid_sniper.py --config config.json --dry-run

Durable snipe jobs live in SQLite (snipe_jobs). Watchlist max_bid / end_time
are the schedule source of truth; SGW favorites sync is best-effort only.
"""

import argparse
import asyncio
import datetime
import json
import logging
import logging.config
import os
import socket
import time
from json.decoder import JSONDecodeError
from typing import Any, Callable, Dict, Iterable, Optional
from zoneinfo import ZoneInfo

import parsedatetime
from requests.exceptions import HTTPError, RequestException, Timeout
from requests.models import Response

import db
import shopgoodwill


def get_timedelta_to_time(
    end_time: datetime.datetime, truncate_microseconds: Optional[bool] = True
) -> datetime.timedelta:
    if truncate_microseconds:
        end_time = end_time.replace(microsecond=0)
        now = datetime.datetime.now().replace(microsecond=0)
    else:
        now = datetime.datetime.now()

    if end_time.tzinfo is None:
        return end_time - now
    else:
        return end_time - now.astimezone()


class BidSniper:
    def outage_check_hook(self, http_response: Response, *args, **kwargs):
        if http_response.status_code in range(500, 600):
            if self.outage_start_time is None:
                self.outage_start_time = datetime.datetime.now(datetime.timezone.utc)
                self.logger.error(
                    f"Outage detected - SGW returned HTTP {http_response.status_code} for URL {http_response.url}"
                )
        else:
            if self.outage_start_time is not None:
                elapsed_outage_time = (
                    datetime.datetime.now(datetime.timezone.utc) - self.outage_start_time
                )
                self.outage_start_time = None
                self.logger.info(f"Outage ended - time elapsed: {elapsed_outage_time}")
        http_response.raise_for_status()

    def __init__(self, config: Dict, dry_run: bool = False) -> None:
        self.config = config
        self.dry_run = dry_run
        self.dry_run_msg = "DRY-RUN: " if dry_run else ""
        self.event_loop = asyncio.new_event_loop()
        self.outage_start_time = None
        self.default_note = self.config["bid_sniper"].get("favorite_default_note", None)
        self.date_format = "%Y-%m-%dT%H:%M:%S"

        logging_conf = config.get("logging", dict())
        self.logger = logging.getLogger("shopgoodwill_bid_sniper")
        if logging_conf.get("version", 0) >= 1:
            logging.config.dictConfig(logging_conf)
        else:
            logging.basicConfig()
            self.logger.setLevel(logging_conf.get("log_level", logging.INFO))

        if config["auth_info"].get("auth_type", "universal") == "command_bid":
            self.shopgoodwill_client = shopgoodwill.Shopgoodwill(config["auth_info"]["command_account"])
            self.bid_shopgoodwill_client = shopgoodwill.Shopgoodwill(config["auth_info"]["bid_account"])
        else:
            self.shopgoodwill_client = shopgoodwill.Shopgoodwill(config["auth_info"])
            self.bid_shopgoodwill_client = self.shopgoodwill_client

        self.shopgoodwill_client.shopgoodwill_session.hooks["response"] = self.outage_check_hook
        self.bid_shopgoodwill_client.shopgoodwill_session.hooks["response"] = self.outage_check_hook

        self.alert_time_deltas = list()
        cal = parsedatetime.Calendar()
        for time_delta_str in config["bid_sniper"].get("alert_time_deltas", list()):
            time_delta = (
                cal.parseDT(time_delta_str, sourceTime=datetime.datetime.min)[0] - datetime.datetime.min
            )
            if time_delta != datetime.timedelta(0):
                self.alert_time_deltas.append(time_delta)

        bid_time_delta_str = self.config["bid_sniper"].get("bid_snipe_time_delta", "30 seconds")
        self.bid_time_delta = (
            cal.parseDT(bid_time_delta_str, sourceTime=datetime.datetime.min)[0] - datetime.datetime.min
        )

        self.favorites_cache = {
            "last_updated": datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc),
            "favorites": dict(),
        }
        self.scheduled_tasks = set()
        # Once we've attempted a real bid for an item, never bid again this session
        self.bids_placed: set[int] = set()
        self.in_flight_jobs: set[int] = set()
        self.worker_id = os.getenv("WORKER_ID") or f"{socket.gethostname()}:{os.getpid()}"
        # Per-account SGW client cache: account_id -> (client, expires_at)
        self._account_clients: Dict[int, tuple] = {}
        self._account_client_ttl = int(
            self.config.get("bid_sniper", {}).get("account_session_ttl_seconds", 900)
        )
        self._last_reverify_sweep = 0.0
        self._reverify_interval = int(
            self.config.get("bid_sniper", {}).get("sgw_reverify_interval_seconds", 3600)
        )
        self._reverify_stale_hours = int(
            self.config.get("bid_sniper", {}).get("sgw_reverify_stale_hours", 24)
        )

    def _user_log(self, job: Optional[Dict], line: str, item_id: Optional[int] = None) -> None:
        """Mirror a sniper event into the owning user's activity feed."""
        db.log_snipe_activity((job or {}).get("user_id"), line, item_id)

    @staticmethod
    def _outcome_message(outcome: Optional[str], title: str) -> str:
        return {
            "accepted": f"Bid placed on '{title}'",
            "outbid": f"Outbid on '{title}' — someone had a higher max",
            "rejected": f"Bid rejected by ShopGoodwill for '{title}'",
            "skipped": f"Skipped '{title}' — current price is above your max",
            "unclear": f"Bid submitted for '{title}', outcome unconfirmed",
        }.get(outcome or "", f"No bid placed for '{title}'")

    async def _reverify_stale_sgw_accounts(self) -> None:
        """Re-login accounts whose last_verified_at is stale; mark invalid on failure."""
        now = time.time()
        if now - self._last_reverify_sweep < self._reverify_interval:
            return
        self._last_reverify_sweep = now
        due = db.list_sgw_accounts_due_reverify(stale_hours=self._reverify_stale_hours, limit=5)
        for acct in due:
            account_id = int(acct["id"])
            try:
                client = self._client_for_job({"sgw_account_id": account_id})
                client.get_favorites()
                db.mark_sgw_account_verified(account_id, True)
                self.logger.info(f"Re-verified SGW account {account_id}")
            except Exception as e:
                db.mark_sgw_account_verified(account_id, False, str(e)[:300])
                self.logger.error(f"SGW account {account_id} re-verify failed: {e}")
                self._account_clients.pop(account_id, None)

    def update_favorites_cache(self, max_cache_time: int) -> None:
        age = (
            datetime.datetime.now(datetime.timezone.utc) - self.favorites_cache["last_updated"]
        ).total_seconds()
        if age > max_cache_time:
            try:
                self.favorites_cache = {
                    "favorites": self.shopgoodwill_client.get_favorites(),
                    "last_updated": datetime.datetime.now(datetime.timezone.utc),
                }
            except BaseException as be:
                self.logger.error(f"{type(be).__name__} updating favorites cache - {be}")

    def _favorite_max_bid(self, favorite_info: Dict) -> Optional[float]:
        """Return the favorite's max_bid if a real snipe is configured, else None."""
        notes = favorite_info.get("notes")
        if not notes:
            return None
        try:
            notes_js = json.loads(notes)
        except (JSONDecodeError, TypeError):
            return None
        raw = notes_js.get("max_bid") if isinstance(notes_js, dict) else None
        if raw is None or raw == "":
            return None
        try:
            max_bid = float(raw)
        except (TypeError, ValueError):
            return None
        if max_bid <= 0:
            return None
        return max_bid

    def _parse_end_time(self, end_time_str: str) -> datetime.datetime:
        raw = (end_time_str or "").strip()
        if not raw:
            raise ValueError("empty end time")
        # Watchlist / API rows are UTC ISO (…Z). Favorites use naive Pacific.
        if raw.endswith("Z") or "+" in raw[10:] or raw.endswith("-00:00"):
            return datetime.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        date_format = self.date_format
        if "." in raw:
            date_format += ".%f"
        return (
            datetime.datetime.strptime(raw, date_format)
            .replace(tzinfo=ZoneInfo("America/Los_Angeles"))
            .astimezone(datetime.timezone.utc)
        )

    def _watchlist_snipe_rows(self) -> Dict[int, Dict]:
        """Local watchlist rows that still need a snipe (source of truth for max_bid)."""
        out: Dict[int, Dict] = {}
        try:
            for w in db.get_watchlist():
                if (w.get("sniper_status") or "").lower() != "scheduled":
                    continue
                try:
                    max_bid = float(w.get("max_bid") or 0)
                except (TypeError, ValueError):
                    continue
                if max_bid <= 0:
                    continue
                out[int(w["item_id"])] = dict(w)
        except Exception as e:
            self.logger.error(f"Could not load watchlist snipes: {e}")
        return out

    def _resolve_max_bid(self, item_id: int, favorite: Optional[Dict] = None) -> Optional[float]:
        if favorite:
            mb = self._favorite_max_bid(favorite)
            if mb is not None:
                return mb
        try:
            for w in db.get_watchlist():
                if int(w["item_id"]) == int(item_id):
                    return float(w.get("max_bid") or 0) or None
        except Exception:
            pass
        return None

    def _ensure_favorite_note(self, item_id: int, max_bid: float, title: str = "") -> None:
        """Make sure SGW favorites carry the max_bid note the sniper historically expected."""
        note = json.dumps({"max_bid": max_bid})
        try:
            fav = self.favorites_cache["favorites"].get(item_id)
            if fav and self._favorite_max_bid(fav) == max_bid:
                return
            if fav:
                self.shopgoodwill_client.add_favorite_note(item_id, note)
            else:
                self.shopgoodwill_client.add_favorite(item_id, note=note)
                self.logger.warning(
                    f"Re-added SGW favorite for sniping '{title or item_id}' "
                    f"(max ${max_bid:.2f})"
                )
            # Refresh just this entry in cache if possible
            self.update_favorites_cache(0)
        except Exception as e:
            self.logger.error(
                f"Could not sync SGW favorite note for {item_id}: {e}"
            )

    def _soonest_seconds_remaining(self, now: datetime.datetime) -> Optional[float]:
        soonest: Optional[float] = None
        for favorite_info in self.favorites_cache["favorites"].values():
            end_raw = favorite_info.get("endTime")
            if not end_raw:
                continue
            try:
                end_time = self._parse_end_time(end_raw)
            except Exception:
                continue
            delta = (end_time - now).total_seconds()
            if delta <= 0:
                continue
            if soonest is None or delta < soonest:
                soonest = delta
        return soonest

    def task_err_handler(self, finished_task: asyncio.Task) -> None:
        coro_exception = finished_task.exception()
        if coro_exception:
            self.logger.error(
                f'Exception in coroutine "{getattr(finished_task.get_coro(), "__name__", "null")}" - {type(coro_exception).__name__} - {coro_exception}'
            )

    async def schedule_task(
        self,
        coroutine_factory: Callable[[], Any],
        execution_datetime: datetime.datetime,
        callbacks: Optional[Iterable[Callable[[asyncio.Task], Any]]] = None,
    ) -> None:
        """Sleep until execution_datetime, then run coroutine_factory().

        Pass a zero-arg factory (e.g. lambda: self.place_bid(id)) so the
        coroutine is created at fire time, not at schedule time.
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        delay = (execution_datetime - now).total_seconds()
        if delay > 0:
            await asyncio.sleep(delay)
        coro = coroutine_factory() if callable(coroutine_factory) else coroutine_factory
        task = self.event_loop.create_task(coro)
        if callbacks:
            for callback in callbacks:
                task.add_done_callback(callback)

    async def alert_upcoming(self, item_id: int, when_label: str) -> None:
        """Log-only reminder before auction end — never places a bid."""
        favorite = self.favorites_cache["favorites"].get(item_id)
        title = favorite["title"] if favorite else str(item_id)
        self.logger.info(f"Upcoming snipe for '{title}' in {when_label}")

    async def place_bid(self, item_id: int, job: Optional[Dict] = None) -> Optional[str]:
        """
        Place a snipe bid using watchlist/job max_bid (favorites optional).
        Returns outcome: accepted|outbid|rejected|skipped|aborted|None
        """
        # Hard idempotency: at most one in-flight / completed bid attempt per item
        if item_id in self.bids_placed:
            self.logger.info(f"Skipping duplicate bid attempt for item {item_id}")
            return "aborted"
        self.bids_placed.add(item_id)

        watch = None
        try:
            watch = next(
                (dict(w) for w in db.get_watchlist() if int(w["item_id"]) == int(item_id)),
                None,
            )
        except Exception:
            watch = None

        max_bid = None
        if job and job.get("max_bid") is not None:
            try:
                max_bid = float(job["max_bid"])
            except (TypeError, ValueError):
                max_bid = None
        if max_bid is None and watch:
            try:
                max_bid = float(watch.get("max_bid") or 0) or None
            except (TypeError, ValueError):
                max_bid = None

        title = (watch or {}).get("title") or str(item_id)
        if max_bid is None:
            self.logger.error(f"Snipe aborted for '{title}': no max_bid on job/watchlist")
            self.bids_placed.discard(item_id)
            return "aborted"

        seller_id = None
        current_price = None
        minimum_bid = None
        try:
            bid_info = self.shopgoodwill_client.get_item_bid_info(item_id)
            current_price = float(bid_info.get("currentPrice") or 0)
            minimum_bid = float(bid_info.get("minimumBid") or current_price or 0)
            seller_id = bid_info.get("sellerId")
        except Exception as e:
            self.logger.warning(
                f"Could not fetch live bid info for '{title}' before snipe: {e}"
            )
            try:
                current_price = float((watch or {}).get("current_bid") or 0) or None
            except (TypeError, ValueError):
                current_price = None

        if seller_id is None:
            try:
                info = self.shopgoodwill_client.get_item_info(item_id)
                seller_id = info.get("sellerId")
            except Exception as e:
                self.logger.warning(f"Could not fetch sellerId for '{title}': {e}")

        if current_price is not None or minimum_bid is not None:
            cur_s = f"${current_price:.2f}" if current_price is not None else "?"
            min_s = f"${minimum_bid:.2f}" if minimum_bid is not None else "?"
            self.logger.warning(
                f"Snipe check '{title}': current {cur_s}, min bid {min_s}, "
                f"our max ${max_bid:.2f}"
            )

        floor = minimum_bid if minimum_bid is not None else current_price
        if floor is not None and max_bid + 1e-9 < floor:
            self.logger.error(
                f"Bid skipped for '{title}' — already above max "
                f"(need ≥ ${floor:.2f}, our max ${max_bid:.2f})"
            )
            try:
                db.update_watchlist_status(item_id, "skipped")
            except Exception:
                pass
            return "skipped"

        if self.config.get("friend_list", list()):
            try:
                item_info = self.shopgoodwill_client.get_item_info(item_id)
                bid_summary = item_info["bidHistory"].get("bidSummary", list())
                if bid_summary:
                    bidder_name = bid_summary[0]["bidderName"]
                    if bidder_name in self.config.get("friend_list", list()):
                        self.logger.info(
                            f"Canceling bid due to friendship for item '{title}'"
                        )
                        self.bids_placed.discard(item_id)
                        return "aborted"
            except BaseException as be:
                self.logger.error(
                    f"{type(be).__name__} getting info for item ID '{item_id}' - continuing"
                )

        self.logger.warning(
            f"{self.dry_run_msg}Placing bid on '{title}' for ${max_bid:.2f}"
        )

        if self.dry_run:
            return "accepted"

        if seller_id is None:
            self.logger.error(f"Bid aborted for '{title}': missing sellerId")
            self.bids_placed.discard(item_id)
            return "aborted"

        try:
            bid_res = self.bid_shopgoodwill_client.place_bid(
                item_id, max_bid, seller_id, quantity=1
            )
        except (Timeout, RequestException, HTTPError) as he:
            self.bids_placed.discard(item_id)
            self.logger.error(f"Bid failed on '{title}' - {type(he).__name__}: {he}")
            return "aborted"

        outcome, detail = shopgoodwill.Shopgoodwill.interpret_place_bid_response(bid_res)
        short = (detail[:160] + "…") if len(detail) > 160 else detail

        if outcome == "accepted":
            self.logger.warning(
                f"Bid accepted for '{title}' at max ${max_bid:.2f} — currently high bidder"
            )
        elif outcome == "outbid":
            self.logger.warning(
                f"Bid placed for '{title}' at max ${max_bid:.2f} but immediately outbid"
                + (f" — {short}" if short else "")
            )
        elif outcome == "rejected":
            self.logger.error(
                f"Bid rejected for '{title}' at max ${max_bid:.2f}"
                + (f" — {short}" if short else "")
            )
            try:
                db.update_watchlist_status(item_id, "rejected")
            except Exception as e:
                self.logger.error(f"Failed to update watchlist status for {item_id}: {e}")
            return "rejected"
        else:
            self.logger.warning(
                f"Bid response unclear for '{title}' at max ${max_bid:.2f}"
                + (f" — {short}" if short else "")
            )

        try:
            db.update_watchlist_status(item_id, "bid_placed")
        except Exception as e:
            self.logger.error(f"Failed to update watchlist status for {item_id}: {e}")

        end_time_str = (job or {}).get("end_time") or (watch or {}).get("end_time") or ""
        if end_time_str:
            try:
                end_dt = self._parse_end_time(end_time_str)
                check_dt = end_dt + datetime.timedelta(minutes=2)
                owner = (job or {}).get("user_id")
                self.event_loop.create_task(
                    self.schedule_task(
                        lambda i=item_id, u=owner: self.check_win(i, user_id=u),
                        check_dt,
                        [self.task_err_handler],
                    )
                ).add_done_callback(self.task_err_handler)
            except Exception as e:
                self.logger.error(f"Could not schedule win check for {item_id}: {e}")

        return outcome

    def _client_for_job(self, job: Optional[Dict] = None):
        """Resolve bid client for a job's sgw_account_id with session caching."""
        account_id = None
        if job:
            try:
                account_id = int(job["sgw_account_id"]) if job.get("sgw_account_id") is not None else None
            except (TypeError, ValueError):
                account_id = None
        if account_id is None:
            return self.bid_shopgoodwill_client

        now = datetime.datetime.now(datetime.timezone.utc).timestamp()
        cached = self._account_clients.get(account_id)
        if cached and cached[1] > now:
            return cached[0]

        try:
            import crypto_creds
            acct = db.get_sgw_account_secrets(account_id)
            if not acct or acct.get("auth_source") == "env" or not acct.get("encrypted_username"):
                client = self.bid_shopgoodwill_client
            else:
                raw = crypto_creds.decrypt_secret(
                    acct["encrypted_username"],
                    acct["nonce"],
                    int(acct.get("key_version") or 1),
                )
                if raw.strip().startswith("{"):
                    data = json.loads(raw)
                    auth = {"username": data["username"], "password": data["password"]}
                else:
                    auth = {
                        "username": raw,
                        "password": crypto_creds.decrypt_secret(
                            acct["encrypted_password"],
                            acct["nonce"],
                            int(acct.get("key_version") or 1),
                        ),
                    }
                client = shopgoodwill.Shopgoodwill(auth)
                client.shopgoodwill_session.hooks["response"] = self.outage_check_hook
            self._account_clients[account_id] = (client, now + self._account_client_ttl)
            return client
        except Exception as e:
            self.logger.error(f"Could not load SGW client for account {account_id}: {e}")
            return self.bid_shopgoodwill_client

    async def _run_claimed_job(self, job: Dict) -> None:
        """Sleep until snipe_at (if needed), place bid, complete the durable job."""
        job_id = int(job["id"])
        item_id = int(job.get("item_id") or job.get("watchlist_item_id"))
        title = str(item_id)
        try:
            for w in db.get_watchlist(job.get("user_id")):
                if int(w["item_id"]) == item_id:
                    title = w.get("title") or title
                    break
        except Exception:
            pass

        # Pre-warm SGW session ~60s before fire when we claimed early
        snipe_at = db.parse_end_time_utc(job.get("snipe_at"))
        if snipe_at is not None:
            delay = (snipe_at - datetime.datetime.now(datetime.timezone.utc)).total_seconds()
            if delay > 65:
                await asyncio.sleep(delay - 60)
                try:
                    self._client_for_job(job)
                    self.logger.info(f"Pre-warmed SGW session for job {job_id}")
                except Exception as e:
                    self.logger.warning(f"Pre-warm failed for job {job_id}: {e}")
                delay = (snipe_at - datetime.datetime.now(datetime.timezone.utc)).total_seconds()
            if delay > 0:
                self.logger.info(
                    f"Armed snipe for '{title}' in {delay:.1f}s "
                    f"(job {job_id}, snipe_at {job.get('snipe_at')})"
                )
                self._user_log(job, f"Armed snipe for '{title}' in {delay:.0f}s", item_id)
                await asyncio.sleep(delay)

        # Swap bid client for this account for the duration of place_bid
        prev = self.bid_shopgoodwill_client
        self.bid_shopgoodwill_client = self._client_for_job(job)
        self.shopgoodwill_client = self.bid_shopgoodwill_client
        try:
            outcome = await self.place_bid(item_id, job=job)
            self._user_log(job, self._outcome_message(outcome, title), item_id)
            if outcome in ("accepted", "outbid", "unclear"):
                db.mark_snipe_job_fired(job_id)
                db.complete_snipe_job(job_id, status="done")
            elif outcome is None:
                db.mark_snipe_job_fired(job_id)
                db.complete_snipe_job(job_id, status="done")
            elif outcome == "skipped":
                db.complete_snipe_job(job_id, status="done", last_error="skipped: above max")
            elif outcome == "rejected":
                db.complete_snipe_job(job_id, status="done", last_error="rejected by SGW")
            else:
                attempts = int(job.get("attempt_count") or 1)
                self.bids_placed.discard(item_id)
                if attempts >= 3:
                    db.complete_snipe_job(
                        job_id, status="done", last_error=f"aborted after {attempts} attempts"
                    )
                else:
                    db.release_snipe_job(job_id, last_error="aborted: will retry", retry=True)
        except Exception as e:
            self.logger.error(f"Claimed job {job_id} failed: {e}")
            self._user_log(job, f"Snipe failed for '{title}': {e}"[:300], item_id)
            attempts = int(job.get("attempt_count") or 1)
            self.bids_placed.discard(item_id)
            db.release_snipe_job(
                job_id,
                last_error=str(e)[:300],
                retry=attempts < 3,
            )
        finally:
            self.bid_shopgoodwill_client = prev
            self.shopgoodwill_client = prev
            self.in_flight_jobs.discard(job_id)

    async def check_win(self, item_id: int, user_id: Optional[str] = None) -> None:
        """Check SGW ~2 min after auction end to see if we won."""
        try:
            username = (
                os.getenv("SGW_USERNAME")
                or self.config.get("auth_info", {}).get("username")
                or ""
            ).lower()
            info = self.shopgoodwill_client.get_item_info(item_id)

            our_max = None
            try:
                for w in db.get_watchlist(user_id):
                    if int(w["item_id"]) == int(item_id):
                        our_max = float(w.get("max_bid") or 0) or None
                        break
            except Exception:
                our_max = None

            final_price = None
            final_shipping = None
            try:
                final_price = float(info.get("currentPrice", 0) or 0)
            except (TypeError, ValueError):
                pass
            try:
                final_shipping = float(info.get("shippingPrice", 0) or 0)
            except (TypeError, ValueError):
                pass

            won = False
            try:
                open_ids = {
                    int(o["itemId"]) for o in self.shopgoodwill_client.get_open_orders()
                }
                if item_id in open_ids:
                    won = True
            except Exception as e:
                self.logger.error(f"Open-order win check failed for {item_id}: {e}")

            winner = None
            if not won:
                bid_summary = info.get("bidHistory", {}).get("bidSummary", [])
                winner = bid_summary[0]["bidderName"] if bid_summary else None
                w = (winner or "").strip().lower()
                if w and username and (
                    w == username
                    or (
                        "*" in w
                        and len(w) == len(username)
                        and w[0] == username[0]
                        and w[-1] == username[-1]
                    )
                ):
                    won = True

            status = "won" if won else "lost"
            if not won:
                # If we never appear in bid history, this was a missed snipe — not an outbid.
                we_bid = False
                try:
                    for b in info.get("bidHistory", {}).get("bidSummary", []) or []:
                        bn = (b.get("bidderName") or "").strip().lower()
                        if bn and username and (
                            bn == username
                            or (
                                "*" in bn
                                and len(bn) == len(username)
                                and bn[0] == username[0]
                                and bn[-1] == username[-1]
                            )
                        ):
                            we_bid = True
                            break
                except Exception:
                    we_bid = False
                if not we_bid:
                    status = "missed"

            db.update_watchlist_result(item_id, status, final_price, final_shipping)

            title = info.get("title", item_id)
            db.log_snipe_activity(
                user_id,
                {
                    "won": f"Won '{title}'"
                    + (f" at ${final_price:.2f}" if final_price is not None else ""),
                    "missed": f"Missed '{title}' — no bid was placed",
                }.get(
                    status,
                    f"Lost '{title}'"
                    + (f" — sold for ${final_price:.2f}" if final_price is not None else ""),
                ),
                item_id,
            )
            if won:
                self.logger.warning(
                    f"WON '{title}' — "
                    f"final ${final_price:.2f} + ${final_shipping:.2f} shipping"
                    + (f" (our max ${our_max:.2f})" if our_max else "")
                )
            elif status == "missed":
                max_bit = f", our max ${our_max:.2f}" if our_max else ""
                final_bit = f"${final_price:.2f}" if final_price is not None else "?"
                self.logger.error(
                    f"MISSED snipe '{title}' — no bid placed (final {final_bit}{max_bit}, "
                    f"winner: {winner or 'unknown'})"
                )
            else:
                max_bit = f", our max ${our_max:.2f}" if our_max else ""
                final_bit = f"${final_price:.2f}" if final_price is not None else "?"
                note = ""
                if (
                    our_max is not None
                    and final_price is not None
                    and final_price > our_max + 1e-9
                ):
                    note = " — final above our max (outbid or bid never accepted)"
                elif (
                    our_max is not None
                    and final_price is not None
                    and final_price <= our_max + 1e-9
                ):
                    note = " — final ≤ our max (check if bid was accepted)"
                self.logger.info(
                    f"Lost '{title}' — final {final_bit}{max_bit}, "
                    f"winner: {winner or 'unknown'}{note}"
                )
        except Exception as e:
            self.logger.error(f"Win check failed for item {item_id}: {e}")

    def start(self) -> None:
        self.event_loop.create_task(self.main_loop())
        self.event_loop.run_forever()

    async def main_loop(self) -> None:
        refresh_seconds = int(self.config["bid_sniper"].get("refresh_seconds", 60))
        near_end_refresh = int(self.config["bid_sniper"].get("near_end_refresh_seconds", 5))
        near_end_window = int(self.config["bid_sniper"].get("near_end_window_seconds", 600))
        mid_refresh = int(self.config["bid_sniper"].get("mid_refresh_seconds", 30))
        mid_end_window = int(self.config["bid_sniper"].get("mid_end_window_seconds", 3600))
        # Claim early enough to sleep until snipe_at; lease must cover that wait.
        look_ahead = int(
            self.config["bid_sniper"].get("job_look_ahead_seconds", max(120, near_end_window))
        )
        lease_seconds = int(
            self.config["bid_sniper"].get("job_lease_seconds", look_ahead + 90)
        )

        # Restart safety: reclaim stale leases and ensure jobs exist for scheduled rows
        try:
            reclaimed = db.reclaim_expired_snipe_leases()
            if reclaimed:
                self.logger.warning(f"Reclaimed {reclaimed} expired snipe lease(s) on startup")
            backfilled = db.backfill_snipe_jobs()
            if backfilled:
                self.logger.warning(f"Backfilled {backfilled} snipe job(s) from watchlist")
        except Exception as e:
            self.logger.error(f"Startup lease reclaim / backfill failed: {e}")

        self.logger.info(
            f"Sniper worker {self.worker_id} polling durable snipe_jobs "
            f"(look_ahead={look_ahead}s, lease={lease_seconds}s)"
        )

        while True:
            try:
                claimed = db.claim_due_snipe_jobs(
                    worker_id=self.worker_id,
                    lease_seconds=lease_seconds,
                    look_ahead_seconds=look_ahead,
                    limit=10,
                )
                for job in claimed:
                    job_id = int(job["id"])
                    if job_id in self.in_flight_jobs:
                        continue
                    item_id = int(job.get("item_id") or job.get("watchlist_item_id"))
                    if item_id in self.bids_placed:
                        db.complete_snipe_job(
                            job_id, status="done", last_error="already bid this session"
                        )
                        continue
                    self.in_flight_jobs.add(job_id)
                    self.event_loop.create_task(
                        self._run_claimed_job(job)
                    ).add_done_callback(self.task_err_handler)
            except Exception as e:
                self.logger.error(f"Snipe job claim loop error: {e}")

            # Periodic SGW credential re-verify (surfaces breakage before snipes fail)
            try:
                await self._reverify_stale_sgw_accounts()
            except Exception as e:
                self.logger.warning(f"SGW re-verify sweep failed: {e}")

            soonest = db.soonest_pending_snipe_seconds()
            if soonest is not None and soonest <= near_end_window:
                sleep_secs = near_end_refresh
            elif soonest is not None and soonest <= mid_end_window:
                sleep_secs = mid_refresh
            else:
                sleep_secs = refresh_seconds

            await asyncio.sleep(sleep_secs)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default="config.json")
    parser.add_argument("-n", "--dry-run", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    with open(args.config, "r") as f:
        config = json.load(f)
    bid_sniper = BidSniper(config, args.dry_run)
    bid_sniper.start()


if __name__ == "__main__":
    main()
