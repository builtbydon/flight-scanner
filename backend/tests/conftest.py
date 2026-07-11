"""Make `backend/` importable (so `from services import ...` works) and force
mock mode so no test ever hits the network."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("FLIGHT_SCANNER_MOCK", "1")
