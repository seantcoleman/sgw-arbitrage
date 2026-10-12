"""Log wording and ShopGoodwill bidder-mask matching."""

import shopgoodwill
from bid_sniper import BidSniper


def test_short_mask_matches_specgood():
    assert shopgoodwill.bidder_is_us("S****d", "SpecGood")
    assert shopgoodwill.bidder_is_us("s********n", "sxxxxxxxxn")
    assert not shopgoodwill.bidder_is_us("P****l", "SpecGood")
    assert not shopgoodwill.bidder_is_us("S****d", "Patricia")


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
