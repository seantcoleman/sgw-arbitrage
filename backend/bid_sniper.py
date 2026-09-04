"""
ShopGoodwill bid sniper daemon.
Original author: Scott Conway — https://github.com/scottmconway/shopgoodwill-scripts

Usage:
    python bid_sniper.py --config config.json
    python bid_sniper.py --config config.json --dry-run

To set a max bid for an item, add it to your SGW favorites,
then set the note to: {"max_bid": 45.00}
The sniper will place a bid for that amount shortly before auction end
(controlled by bid_snipe_time_delta in the config).
"""

import argparse
import asyncio
import datetime
import json
import logging
import logging.config
import queue
from json.decoder import JSONDecodeError
from logging.handlers import QueueHandler, QueueListener
from typing import Any, Callable, Dict, Iterable, Optional
from zoneinfo import ZoneInfo

import parsedatetime
from requests.exceptions import HTTPError
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
                if self.outage_start_time is not None:
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
        date_format = self.date_format
        if "." in end_time_str:
            date_format += ".%f"
        return (
            datetime.datetime.strptime(end_time_str, date_format)
            .replace(tzinfo=ZoneInfo("America/Los_Angeles"))
            .astimezone(datetime.timezone.utc)
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
        coroutine,
        execution_datetime: datetime.datetime,
        callbacks: Optional[Iterable[Callable[[asyncio.Task], Any]]] = None,
    ) -> None:
        now = datetime.datetime.now(datetime.timezone.utc)
        await asyncio.sleep((execution_datetime - now).total_seconds())
        task = self.event_loop.create_task(coroutine)
        if callbacks:
            for callback in callbacks:
                task.add_done_callback(callback)

    async def alert_upcoming(self, item_id: int, when_label: str) -> None:
        """Log-only reminder before auction end — never places a bid."""
        favorite = self.favorites_cache["favorites"].get(item_id)
        title = favorite["title"] if favorite else str(item_id)
        self.logger.info(f"Upcoming snipe for '{title}' in {when_label}")

    async def place_bid(self, item_id: int) -> None:
        # Hard idempotency: at most one bid attempt per item per process lifetime
        if item_id in self.bids_placed:
            self.logger.info(f"Skipping duplicate bid attempt for item {item_id}")
            return None
        self.bids_placed.add(item_id)

        self.update_favorites_cache(5)
        favorite = self.favorites_cache["favorites"].get(item_id, None)
        if not favorite:
            return None

        max_bid = self._favorite_max_bid(favorite)
        if max_bid is None:
            return None

        if self.config.get("friend_list", list()):
            try:
                item_info = self.shopgoodwill_client.get_item_info(item_id)
                bid_summary = item_info["bidHistory"].get("bidSummary", list())
                if bid_summary:
                    bidder_name = bid_summary[0]["bidderName"]
                    if bidder_name in self.config.get("friend_list", list()):
                        self.logger.info(f"Canceling bid due to friendship for item '{favorite['title']}'")
                        return None
            except BaseException as be:
                self.logger.error(f"{type(be).__name__} getting info for item ID '{item_id}' - continuing")

        if not self.dry_run:
            try:
                self.bid_shopgoodwill_client.place_bid(
                    item_id, max_bid, favorite["sellerId"], quantity=1
                )
            except HTTPError as he:
                self.logger.error(f"HTTPError placing bid on '{favorite['title']}' - {he}")
                return None
            try:
                db.update_watchlist_status(item_id, "bid_placed")
            except Exception as e:
                self.logger.error(f"Failed to update watchlist status for {item_id}: {e}")

            # Schedule a win/loss check 2 minutes after auction end
            end_time_str = favorite.get("endTime", "")
            if end_time_str:
                try:
                    end_dt = self._parse_end_time(end_time_str)
                    check_dt = end_dt + datetime.timedelta(minutes=2)
                    self.event_loop.create_task(
                        self.schedule_task(
                            self.check_win(item_id),
                            check_dt,
                            [self.task_err_handler],
                        )
                    ).add_done_callback(self.task_err_handler)
                except Exception as e:
                    self.logger.error(f"Could not schedule win check for {item_id}: {e}")

        self.logger.warning(f"{self.dry_run_msg}Placing bid on '{favorite['title']}' for {max_bid}")
        return None

    async def check_win(self, item_id: int) -> None:
        """Check SGW ~2 min after auction end to see if we won."""
        try:
            username = self.config["auth_info"].get("username", "")
            info = self.shopgoodwill_client.get_item_info(item_id)

            # Final hammer price
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

            # Determine winner from bid history
            bid_summary = info.get("bidHistory", {}).get("bidSummary", [])
            winner = bid_summary[0]["bidderName"] if bid_summary else None
            won = winner and winner.lower() == username.lower()

            status = "won" if won else "lost"
            db.update_watchlist_result(item_id, status, final_price, final_shipping)

            if won:
                self.logger.warning(
                    f"WON '{info.get('title', item_id)}' — "
                    f"final ${final_price:.2f} + ${final_shipping:.2f} shipping"
                )
            else:
                self.logger.info(
                    f"Lost '{info.get('title', item_id)}' — "
                    f"winner: {winner or 'unknown'}"
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
        favorites_cache_max_seconds = int(
            self.config["bid_sniper"].get("favorites_max_cache_seconds", 60)
        )
        min_scheduling_timedelta = sorted(self.alert_time_deltas + [self.bid_time_delta])[::-1][0]

        while True:
            now = datetime.datetime.now(datetime.timezone.utc)
            soonest = self._soonest_seconds_remaining(now)
            cache_ttl = (
                5
                if soonest is not None and soonest <= near_end_window
                else favorites_cache_max_seconds
            )
            self.update_favorites_cache(cache_ttl)

            for item_id, favorite_info in self.favorites_cache["favorites"].items():
                if item_id in self.scheduled_tasks or item_id in self.bids_placed:
                    continue

                end_raw = favorite_info.get("endTime")
                if not end_raw:
                    continue
                try:
                    end_time = self._parse_end_time(end_raw)
                except Exception as e:
                    self.logger.error(f"Could not parse endTime for item {item_id}: {e}")
                    continue

                # Only schedule when we're within the look-ahead horizon
                look_ahead = datetime.timedelta(seconds=max(refresh_seconds * 3, near_end_window * 2))
                if (end_time - min_scheduling_timedelta) > now + look_ahead:
                    continue

                if end_time <= now:
                    self.scheduled_tasks.add(item_id)
                    continue

                # Favorites without a max_bid are not snipes — don't schedule or log
                if self._favorite_max_bid(favorite_info) is None:
                    continue

                for alert_time_delta in self.alert_time_deltas:
                    execution_datetime = end_time - alert_time_delta
                    if execution_datetime < now:
                        continue
                    # Alerts are reminders only — never place_bid
                    self.event_loop.create_task(
                        self.schedule_task(
                            self.alert_upcoming(
                                item_id, str(alert_time_delta)
                            ),
                            execution_datetime,
                            [self.task_err_handler],
                        )
                    ).add_done_callback(self.task_err_handler)

                bid_execution_datetime = end_time - self.bid_time_delta
                if bid_execution_datetime < now:
                    # Ideal snipe moment missed, but auction still live — bid now
                    secs_left = int((end_time - now).total_seconds())
                    late_by = int((now - bid_execution_datetime).total_seconds())
                    self.logger.warning(
                        f"Snipe window missed for '{favorite_info['title']}' "
                        f"({late_by}s late) — bidding immediately ({secs_left}s left)"
                    )
                    self.event_loop.create_task(
                        self.place_bid(item_id)
                    ).add_done_callback(self.task_err_handler)
                    self.scheduled_tasks.add(item_id)
                    continue

                self.event_loop.create_task(
                    self.schedule_task(
                        self.place_bid(item_id),
                        bid_execution_datetime,
                        [self.task_err_handler],
                    )
                ).add_done_callback(self.task_err_handler)

                self.logger.info(
                    f"Scheduled snipe for '{favorite_info['title']}' at "
                    f"{bid_execution_datetime.isoformat()}"
                )
                self.scheduled_tasks.add(item_id)

            # Ensure favorites that lack notes still get the default note template
            for item_id, favorite_info in list(self.favorites_cache["favorites"].items()):
                if self.default_note and not favorite_info.get("notes", ""):
                    try:
                        self.shopgoodwill_client.add_favorite(item_id, note=self.default_note)
                    except Exception as e:
                        self.logger.error(f"Failed to set default note on {item_id}: {e}")

            now = datetime.datetime.now(datetime.timezone.utc)
            soonest = self._soonest_seconds_remaining(now)
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
