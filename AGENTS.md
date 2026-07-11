# Agent Instructions

Read [CLAUDE.md](./CLAUDE.md) before editing. It is the canonical instruction,
runtime, and verification policy for this repo.

<!-- cross-project-testing-enforcement:start -->
## Cross-Project Testing Enforcement

When changing code, tests must prove the final user-visible behavior, not just
that a page, list, API route, or broad section loaded. Classify the touched
surface first, then cover the matching seams: unit tests for pure logic,
integration/API tests for contracts and transforms, browser/UI tests for
user-visible flows, and runtime smoke tests for deployed artifacts.

For external, scraped, provider-backed, or cached data, include messy
provider-shaped fixtures: short labels, aliases, missing IDs/codes, stale cache,
partial payloads, malformed rows, duplicate records, nullable fields, and
unexpected but real-world field shapes. Provider-backed fields that are
persisted or cached must be tested at the cache/serialization/export boundary,
not only at the initial parser boundary, so stale cached payloads still prove
final API/UI/export output is sanitized and user-visible.

UI/E2E tests must wait for dependent async data to settle and then assert
specific final content or state, such as a populated card, recommendation,
action link, detail panel, error message, recovery state, completed async
section, or final outbound API/action payload created from the rendered provider
result. A visible shell, broad container selector, or "page loaded" assertion is
not enough. For frontend changes, verify either a fresh built/served artifact
that contains the changed source or explicitly report the failed build or stale
artifact blocker; stale-hosted browser results do not count as deployed-artifact
verification.

Visual or layout changes need desktop and mobile browser checks or equivalent
overflow, clipping, occlusion, scroll, and interaction assertions. Date-sensitive
UI tests must pin time or deliberately navigate to a deterministic date range;
do not rely on the current calendar month/day producing the needed state.

Verification infrastructure is part of the contract. Required commands must use
bounded timeouts or bounded runner canaries for pytest/TestClient, jsdom/Vitest,
Playwright webServer, local runtime health, and deployed health checks. If a
runner, fixture, webServer, or runtime cannot start and answer a minimal
health/canary check inside the bound, track that as a blocking test-infra
failure with the exact command and phase. Do not bury it under feature-test
results or replace it with a weaker smoke test.

Bug fixes need a regression test that would have failed before the fix. If a
required behavior-level check cannot run, report the exact command and blocker,
the smallest isolated command that reproduces it, and whether the block happens
before the test body, inside a fixture/runner, in the browser webServer, or in
the deployed artifact.
<!-- cross-project-testing-enforcement:end -->
