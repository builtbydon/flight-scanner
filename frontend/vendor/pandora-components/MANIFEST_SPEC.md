# `components.json` — the manifest spec

The Pandora's Box **Components catalog** is built by scanning `components.json`
files. There are two roles:

- **The catalog source** — this repo's root `components.json` (`"role":
  "catalog-source"`). Its `provides[]` is the canonical list of shared
  components and their **latest** versions. This is the source of truth.
- **App manifests** — a `components.json` at the root of each app repo. It
  declares what that app **consumes** (and any components it **provides** but
  hasn't promoted to the shared repo yet).

Pandora scans the catalog source + every registered project's manifest, then
builds the catalog and the **app × component × version** drift matrix.

## Component record (in `provides[]`)

| field | required | meaning |
|---|---|---|
| `id` | yes | stable id, `"<lang>.<name>"` for code (`py.crypto`) or `"ui.<name>"` for UI (`ui.dropdown`) |
| `kind` | yes | `"code"` or `"ui"` |
| `name` | yes | human label |
| `summary` | yes | what it is / when to use it (shown in the catalog; agents read this) |
| `version` | yes | semver of this component |
| `language` | code | `python` / `typescript` / `css` |
| `import` | code | how to import it (`pandora_components.crypto`) |
| `source` | no | path to canonical source within its repo |
| `deps` | no | other component `id`s this one relies on |
| `powers_ui` / `powered_by` | no | cross-links: a code component can `powers_ui` a UI id; a UI component is `powered_by` code ids |
| `tags` | no | freeform |
| `changelog` | no | `{version: note}` |

## App manifest

```json
{
  "schema": 1,
  "app": "finance-tracker",
  "consumes": [
    { "id": "py.crypto", "version": "1.0.0" }
  ],
  "provides": []
}
```

- `consumes[]` — `{id, version}` of each shared component the app uses. The
  scanner compares `version` to the catalog-source's latest → **up-to-date**,
  **behind**, or **ahead**.
- `provides[]` — full component records (same shape as above) for components the
  app owns that aren't in the shared repo yet. These appear in the catalog with
  `owner = <app>` so nothing is invisible; promote them to the shared repo when a
  second app wants them.

## Rules for apps (enforced via app-prereqs)

1. **Check the catalog before hand-rolling.** Query `GET /api/components` (or the
   Components tab) for an existing component first.
2. **Consume, don't copy.** Depend on `pandora-components` and pin the version in
   `consumes[]`.
3. **Register what you build.** A genuinely new, reusable component goes in your
   `provides[]` (and gets promoted to the shared repo when shared).
4. **Bump versions** in the shared repo's `components.json` + the component's
   `__component_version__`; add a changelog note.
