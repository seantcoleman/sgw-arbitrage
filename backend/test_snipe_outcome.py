"""Log wording and ShopGoodwill bidder-mask matching."""

import shopgoodwill
from bid_sniper import BidSniper


def test_short_mask_matches_specgood():
    assert shopgoodwill.bidder_is_us("S****d", "SpecGood")
    assert shopgoodwill.bidder_is_us("s********n", "sxxxxxxxxn")
    assert not shopgoodwill.bidder_is_us("P****l", "SpecGood")
    assert not shopgoodwill.bidder_is_us("S****d", "Patricia")


def test_prepared_snipe_skips_price_refresh_in_the_last_8_seconds():
    # Seller and price already loaded: do not spend the lead on another lookup.
    assert not BidSniper._needs_live_bid_refresh(146, 20.24, 21.24, 6)
    assert not BidSniper._needs_live_bid_refresh(146, 20.24, 21.24, 8)
    # More time left, still refresh so a price that passed the max can be skipped.
    assert BidSniper._needs_live_bid_refresh(146, 20.24, 21.24, 8.1)
    # No prep: the lookup is still how we learn the seller and the minimum.
    assert BidSniper._needs_live_bid_refresh(None, None, None, 6)
    assert BidSniper._needs_live_bid_refresh(146, None, None, 6)
    assert BidSniper._needs_live_bid_refresh(None, 20.24, 21.24, 6)


def test_failed_send_explains_itself():
    late = BidSniper._outcome_message("too_late", "Brown Tweed Suit", 26.10, "")
    assert "26.10" in late
    assert "already ended" in late
    assert "No bid placed" not in late

    rejected = BidSniper._outcome_message(
        "rejected", "Brown Tweed Suit", 26.10, "Auction has ended"
    )
    assert "rejected your $26.10 bid" in rejected
    assert "already ended" in rejected

    aborted = BidSniper._outcome_message(
        "aborted", "Brown Tweed Suit", 26.10, "ShopGoodwill didn't respond"
    )
    assert aborted.startswith("Couldn't send your $26.10 bid")
    assert "didn't respond" in aborted

    assert BidSniper._outcome_message("duplicate", "Suit", 1, "") == ""
    assert BidSniper._outcome_message("accepted", "Suit", 26.1, "") == "Bid placed on 'Suit'"
    assert "higher max" in BidSniper._outcome_message("outbid", "Suit", 15, "")
    assert "above your max" in BidSniper._outcome_message("skipped", "Suit", 50, "")
