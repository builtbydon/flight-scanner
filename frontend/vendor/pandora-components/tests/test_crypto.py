"""Tests for the py.crypto shared component (node --test equivalent for Python:
plain pytest, no app context)."""
from __future__ import annotations

import base64

import pytest

from pandora_components import crypto


def test_round_trip():
    key = crypto.generate_key()
    token = crypto.encrypt("hunter2", key)
    assert token != "hunter2"
    assert crypto.decrypt(token, key) == "hunter2"


def test_generate_key_is_32_bytes_base64():
    key = crypto.generate_key()
    assert len(base64.b64decode(key)) == 32


def test_accepts_raw_bytes_key():
    raw = base64.b64decode(crypto.generate_key())
    token = crypto.encrypt("secret", raw)
    assert crypto.decrypt(token, raw) == "secret"


def test_nonce_is_random_per_encrypt():
    key = crypto.generate_key()
    assert crypto.encrypt("x", key) != crypto.encrypt("x", key)


def test_blank_key_raises():
    with pytest.raises(crypto.EncryptionError):
        crypto.encrypt("x", "")


def test_non_base64_key_raises():
    with pytest.raises(crypto.EncryptionError):
        crypto.encrypt("x", "not!base64!!")


def test_wrong_length_key_raises():
    short = base64.b64encode(b"tooshort").decode()
    with pytest.raises(crypto.EncryptionError):
        crypto.encrypt("x", short)


def test_decrypt_with_wrong_key_raises():
    token = crypto.encrypt("x", crypto.generate_key())
    with pytest.raises(crypto.EncryptionError):
        crypto.decrypt(token, crypto.generate_key())
