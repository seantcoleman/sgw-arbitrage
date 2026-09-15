"""
Encrypt ShopGoodwill credentials at rest (AES-256-GCM).

CREDENTIAL_ENC_KEY must be a 32-byte key, base64-encoded, and lives only on
the Oracle VM — never in Supabase or the browser.
"""

from __future__ import annotations

import base64
import os
from typing import Tuple

from Cryptodome.Cipher import AES
from Cryptodome.Random import get_random_bytes

KEY_VERSION = 1


def _load_key() -> bytes:
    raw = (os.getenv("CREDENTIAL_ENC_KEY") or "").strip()
    if not raw:
        raise RuntimeError("CREDENTIAL_ENC_KEY is not set")
    try:
        key = base64.b64decode(raw)
    except Exception as e:
        raise RuntimeError("CREDENTIAL_ENC_KEY must be base64") from e
    if len(key) != 32:
        raise RuntimeError("CREDENTIAL_ENC_KEY must decode to 32 bytes")
    return key


def encrypt_secret(plaintext: str) -> Tuple[str, str, int]:
    """
    Returns (ciphertext_b64, nonce_b64, key_version).
    Ciphertext includes the GCM auth tag appended.
    """
    key = _load_key()
    nonce = get_random_bytes(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ct, tag = cipher.encrypt_and_digest(plaintext.encode("utf-8"))
    blob = base64.b64encode(ct + tag).decode("ascii")
    nonce_b64 = base64.b64encode(nonce).decode("ascii")
    return blob, nonce_b64, KEY_VERSION


def decrypt_secret(ciphertext_b64: str, nonce_b64: str, key_version: int = 1) -> str:
    if key_version != KEY_VERSION:
        raise RuntimeError(f"Unsupported key_version={key_version}")
    key = _load_key()
    nonce = base64.b64decode(nonce_b64)
    blob = base64.b64decode(ciphertext_b64)
    if len(blob) < 16:
        raise ValueError("ciphertext too short")
    ct, tag = blob[:-16], blob[-16:]
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ct, tag).decode("utf-8")


def generate_key_b64() -> str:
    """Helper for ops: python -c 'from crypto_creds import generate_key_b64; print(generate_key_b64())'"""
    return base64.b64encode(get_random_bytes(32)).decode("ascii")
