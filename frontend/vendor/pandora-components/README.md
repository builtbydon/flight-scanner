# pandora-components

The shared component library for the Pandora app fleet — the **source of truth**
for reusable **code** and **UI** components. Pandora's Box hosts the browsable
**Components catalog** over the manifests in this repo and each app's repo.

Goal: build once, dedup forever. New apps check the catalog before hand-rolling,
consume components from here, and pin versions so drift is visible.

## Layout

```
src/pandora_components/     pip-installable Python code components
  crypto.py                 py.crypto — AES-256-GCM secrets at rest
tokens/                     (planned) framework-agnostic design tokens (CSS vars)
web/                        (planned) shared React UI component package
components.json             catalog source of truth (provided components + latest versions)
MANIFEST_SPEC.md            the components.json format
tests/                      pytest
```

## Use a Python component in an app

```bash
pip install pandora-components            # (editable during dev: pip install -e ../components)
```
```python
from pandora_components.crypto import encrypt, decrypt, generate_key
token = encrypt("api-secret", key)        # key = base64 32-byte; generate_key() makes one
```
Then declare it in your app's `components.json`:
```json
{ "schema": 1, "app": "your-app", "consumes": [{ "id": "py.crypto", "version": "1.0.0" }] }
```

## Tests

```bash
pip install -e . && pip install pytest
pytest -q
```

## Versioning

Each component is versioned independently: bump `version` in `components.json`
**and** the module's `__component_version__`, and add a changelog note. Apps pin
the version they consume; the catalog flags consumers that are behind.

See [MANIFEST_SPEC.md](MANIFEST_SPEC.md). Private repo; no paid services.
