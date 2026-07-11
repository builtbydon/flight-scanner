"""AES-256-GCM encryption for secrets stored at rest.

Shared **code component** `py.crypto`. App-agnostic: the 32-byte key is passed
in (as raw bytes or a base64 string), so this has zero coupling to any app's
config — each app supplies its own key. Token layout is
``base64(nonce[12] + ciphertext)``.

Extracted from finance-tracker `app/crypto.py`; the only change from that
original is decoupling the key from app settings (it's now a parameter), so the
same code can back both finance-tracker and pandoras-box.
"""
from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

__component_id__ = "py.crypto"
__component_version__ = "1.0.0"


class EncryptionError(RuntimeError):
    """Raised for a missing / malformed key or a failed decrypt."""


def generate_key() -> str:
    """Return a fresh base64-encoded 32-byte key suitable for :func:`encrypt`."""
    return base64.b64encode(os.urandom(32)).decode("ascii")


def load_key(key: str | bytes) -> bytes:
    """Normalize a key to 32 raw bytes. Accepts raw bytes or a base64 string."""
    if isinstance(key, bytes):
        raw = key
    else:
        s = (key or "").strip()
        if not s:
            raise EncryptionError(
                "encryption key is not set. Generate one with "
                "pandora_components.crypto.generate_key()."
            )
        try:
            raw = base64.b64decode(s)
        except Exception as exc:  # noqa: BLE001
            raise EncryptionError("encryption key must be base64-encoded.") from exc
    if len(raw) != 32:
        raise EncryptionError(
            f"encryption key must be 32 bytes (got {len(raw)})."
        )
    return raw


def encrypt(plaintext: str, key: str | bytes) -> str:
    """Encrypt a string, returning ``base64(nonce + ciphertext)``."""
    k = load_key(key)
    nonce = os.urandom(12)
    ciphertext = AESGCM(k).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt(token: str, key: str | bytes) -> str:
    """Reverse of :func:`encrypt`."""
    k = load_key(key)
    blob = base64.b64decode(token)
    nonce, ciphertext = blob[:12], blob[12:]
    try:
        return AESGCM(k).decrypt(nonce, ciphertext, None).decode("utf-8")
    except Exception as exc:  # noqa: BLE001
        raise EncryptionError("decryption failed (wrong key or corrupt data).") from exc
