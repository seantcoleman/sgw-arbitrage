"""
ShopGoodwill API client.
Original author: Scott Conway — https://github.com/scottmconway/shopgoodwill-scripts
"""

import base64
import datetime
import re
import urllib.parse
from copy import deepcopy
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

import requests
from Cryptodome.Cipher import AES
from Cryptodome.Util.Padding import pad
from requests.cookies import RequestsCookieJar
from requests.exceptions import HTTPError
from requests.models import PreparedRequest, Response

_SHIPPING_COST_PATTERN = re.compile(r"Shipping: \$(\d+\.\d+) \(.*\)<\/span>")
_SGW_BUYERAPI_DOMAIN = "buyerapi.shopgoodwill.com"


class IgnoreBuyerApiCookieJar(RequestsCookieJar):
    def set_cookie(self, cookie, *args, **kwargs):
        if cookie.domain == _SGW_BUYERAPI_DOMAIN:
            return
        super().set_cookie(cookie, *args, **kwargs)


class Shopgoodwill:
    LOGIN_PAGE_URL = "https://shopgoodwill.com/signin"
    API_ROOT = "https://buyerapi.shopgoodwill.com/api"
    ENCRYPTION_INFO = {
        "key": b"6696D2E6F042FEC4D6E3F32AD541143B",
        "iv": b"0000000000000000",
        "block_size": 16,
    }
    FAVORITES_MAX_NOTE_LENGTH = 256
    INVALID_AUTH_MESSAGE = "The username or password are incorrect"

    def shopgoodwill_err_hook(self, res: Response, *args, **kwargs) -> None:
        res.raise_for_status()

    def __init__(self, auth_info: Optional[Dict] = None):
        self.shopgoodwill_session = requests.Session()
        self.shopgoodwill_session.cookies = IgnoreBuyerApiCookieJar()
        self.shopgoodwill_session.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:12.0) Gecko/20100101 Firefox/12.0"
        }
        self.shopgoodwill_session.hooks["response"] = self.shopgoodwill_err_hook
        self.logged_in = False

        if auth_info:
            access_token = auth_info.get("access_token", None)
            if access_token and self.access_token_is_valid(access_token):
                self.shopgoodwill_session.headers["Authorization"] = f"Bearer {access_token}"
            else:
                if "encrypted_username" in auth_info and "encrypted_password" in auth_info:
                    self.login(auth_info["encrypted_username"], auth_info["encrypted_password"])
                elif "username" in auth_info and "password" in auth_info:
                    self.login(
                        self._encrypt_login_value(auth_info["username"]),
                        self._encrypt_login_value(auth_info["password"]),
                    )
                else:
                    raise Exception("Invalid auth_info provided!")
            self.logged_in = True

    def _encrypt_login_value(self, plaintext: str) -> str:
        padded = pad(plaintext.encode(), Shopgoodwill.ENCRYPTION_INFO["block_size"])
        cipher = AES.new(
            Shopgoodwill.ENCRYPTION_INFO["key"],
            AES.MODE_CBC,
            Shopgoodwill.ENCRYPTION_INFO["iv"],
        )
        ciphertext = cipher.encrypt(padded)
        return urllib.parse.quote(base64.b64encode(ciphertext))

    def access_token_is_valid(self, access_token: str) -> bool:
        self.logged_in = True
        self.shopgoodwill_session.headers["Authorization"] = f"Bearer {access_token}"
        try:
            self.shopgoodwill_session.post(Shopgoodwill.API_ROOT + "/SaveSearches/GetSaveSearches")
        except HTTPError as he:
            if he.response.status_code == 401:
                self.logged_in = False
                del self.shopgoodwill_session.headers["Authorization"]
                return False
            self.logged_in = False
            del self.shopgoodwill_session.headers["Authorization"]
            raise he
        self.logged_in = False
        del self.shopgoodwill_session.headers["Authorization"]
        return True

    def requires_auth(func):
        def inner(self, *args, **kwargs):
            if not self.logged_in:
                raise Exception("This function requires login to Shopgoodwill")
            return func(self, *args, **kwargs)
        return inner

    def login(self, username: str, password: str):
        login_params = {
            "browser": "firefox",
            "remember": False,
            "clientIpAddress": "0.0.0.4",
            "appVersion": "00099a1be3bb023ff17d",
            "username": username,
            "password": password,
        }
        self.shopgoodwill_session.hooks["response"] = None
        self.shopgoodwill_session.get(Shopgoodwill.LOGIN_PAGE_URL)
        self.shopgoodwill_session.hooks["response"] = self.shopgoodwill_err_hook
        res_json = self.shopgoodwill_session.post(
            Shopgoodwill.API_ROOT + "/SignIn/Login", json=login_params
        ).json()
        if res_json["message"] == Shopgoodwill.INVALID_AUTH_MESSAGE:
            raise Exception("Invalid credentials")
        self.shopgoodwill_session.headers["Authorization"] = f"Bearer {res_json['accessToken']}"
        return True

    @requires_auth
    def get_favorites(self, favorite_type: str = "open") -> Dict[int, Dict]:
        res = self.shopgoodwill_session.post(
            Shopgoodwill.API_ROOT + "/Favorite/GetAllFavoriteItemsByType",
            params={"Type": favorite_type},
            json={},
        )
        favorites = res.json()["data"]
        parsed_favorites = dict()
        if favorites is None:
            favorites = list()
        for favorite in favorites:
            parsed_favorites[int(favorite["itemId"])] = favorite
        return parsed_favorites

    @requires_auth
    def add_favorite(self, item_id: int, note: Optional[str] = None) -> None:
        self.shopgoodwill_session.get(
            f"{Shopgoodwill.API_ROOT}/Favorite/AddToFavorite",
            params={"itemId": item_id},
        )
        if note:
            self.add_favorite_note(item_id, note)

    @requires_auth
    def add_favorite_note(self, item_id: int, note: str) -> None:
        if len(note) > Shopgoodwill.FAVORITES_MAX_NOTE_LENGTH:
            note = note[:256]
        favorites = self.get_favorites()
        if item_id not in favorites:
            raise Exception(f"Item {item_id} not in user's favorites!")
        watchlist_id = favorites[item_id]["watchlistId"]
        self.shopgoodwill_session.post(
            f"{Shopgoodwill.API_ROOT}/Favorite/Save",
            json={"notes": note, "watchlistId": watchlist_id},
        )

    @requires_auth
    def remove_favorite(self, item_id: int) -> None:
        self.shopgoodwill_session.get(
            f"{Shopgoodwill.API_ROOT}/Favorite/RemoveFromFavorite",
            params={"itemId": item_id},
        )

    @requires_auth
    def place_bid(self, item_id: int, bid_amount: float, seller_id: int, quantity: int = 1):
        bid_json = {
            "itemId": item_id,
            "bidAmount": "%.2f" % bid_amount,
            "sellerId": seller_id,
            "quantity": quantity,
        }
        self.shopgoodwill_session.post(
            f"{Shopgoodwill.API_ROOT}/ItemBid/PlaceBid", json=bid_json
        ).json()

    def get_item_info(self, item_id: int) -> Dict:
        return self.shopgoodwill_session.get(
            f"{Shopgoodwill.API_ROOT}/itemDetail/GetItemDetailModelByItemId/{item_id}"
        ).json()

    def get_item_bid_info(self, item_id: int) -> Dict:
        return self.shopgoodwill_session.get(
            f"{Shopgoodwill.API_ROOT}/itemBid/ShowBidModal", params={"itemId": item_id}
        ).json()

    def get_query_results(self, query_json: Dict, page_size: Optional[int] = 40) -> List[Dict]:
        tmp_query_json = deepcopy(query_json)
        tmp_query_json["page"] = 1
        tmp_query_json["pageSize"] = page_size
        total_listings = list()
        tmp_query_json["searchText"] = tmp_query_json["searchText"].replace('"', "")

        while True:
            query_res = self.shopgoodwill_session.post(
                Shopgoodwill.API_ROOT + "/Search/ItemListing", json=tmp_query_json
            )
            page_listings = query_res.json()["searchResults"]["items"]
            if query_res.json().get("categoryListModel", None) is None:
                raise Exception("Error response from query endpoint")
            if not page_listings:
                return total_listings
            else:
                tmp_query_json["page"] += 1
                total_listings += page_listings
            if len(total_listings) == query_res.json()["searchResults"]["itemCount"]:
                return total_listings

    def get_item_shipping_estimate(self, item_id: int, zip_code: str) -> Optional[float]:
        resp = self.shopgoodwill_session.post(
            f"{Shopgoodwill.API_ROOT}/itemDetail/CalculateShipping",
            json={
                "itemId": item_id,
                "zipCode": zip_code,
                "country": "US",
                "province": None,
                "quantity": 1,
                "clientIP": "0.0.0.0",
            },
        )
        shipping_est_price = _SHIPPING_COST_PATTERN.findall(resp.text)
        if len(shipping_est_price) > 0:
            return float(shipping_est_price[0])
        return None
