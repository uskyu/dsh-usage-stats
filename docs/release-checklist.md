# Release checklist

This is the release gate for `@uskyu/dsh-usage-stats`. Completing the checklist prepares a release; it does not authorize npm publishing, tagging, or creating a GitHub Release.

## 1. Release candidate baseline

- [ ] Start from the reviewed release-candidate PR merged into a clean `main`; record this commit as `RC_BASE_SHA` for provenance only.
- [ ] Do not publish or tag `RC_BASE_SHA`: the release version has not been committed yet.
- [ ] Confirm `cordis.patch.yml` quotes `@uskyu/dsh-usage-stats` and `lib/client.js` registers the same identity through `__ModuleLoader__.load()`.
- [ ] Confirm the release notes describe estimated costs as estimates and list every unsupported/fail-closed case.

## 2. Automated gates

```bash
npm ci
npm run check
npm test
npm pack --json
```

- [ ] Inspect the pack manifest: no credentials, local caches, screenshots, backups, review diffs, or untracked planning files.
- [ ] Install the generated tarball into an isolated DSH profile; do not validate only against the source checkout.
- [ ] Confirm malformed settings fail before routes or timers register.
- [ ] Confirm non-GET and non-loopback export/API requests remain rejected.

## 3. Fresh install and migration

- [ ] Fresh isolated profile: install, restart DSH, hard-refresh the browser, open Usage Stats.
- [ ] Upgrade an existing v0.3.2 profile without deleting its usage cache or monitor configuration.
- [ ] Confirm the npm identity rename is upgrade-safe: remove the previous scoped package and its Cordis entry from `cordis.patch.yml`, install `@uskyu/dsh-usage-stats`, and verify the plugin mounts exactly once (the installer only migrates the unscoped `dsh-usage-stats` entry and an unquoted scoped name).
- [ ] Confirm a valid old cache is migrated/refolded and retains exact token totals.
- [ ] Replace the cache with malformed JSON; confirm the plugin rebuilds from authoritative session events without blocking DSH startup.
- [ ] Confirm existing account monitors remain compatible and no new provider/monitor is inserted into user configuration.
- [ ] Confirm legacy `display.currentSessionPill: true` and `false` configurations both start successfully and neither registers composer UI.
- [ ] ~~Confirm a persisted provider selection survives browser refresh and DSH restart; removing that provider clears the saved id and uses the existing fallback.~~ Not applicable since v0.4.0: the panel has no provider selector and the client stores only the calendar/curve view preference (`@uskyu/dsh-usage-stats:view:v1`).
- [ ] ~~Confirm OrcaRouter is added only through the explicit fresh-user synthetic Add action; startup performs no settings mutation and existing provider configuration is not overwritten.~~ Not applicable since v0.4.0: the panel exposes no OrcaRouter entry. The route remains server-side only.
- [ ] ~~Confirm OrcaRouter balance succeeds through `/v1/balance` or the compatible billing fallback, pricing stays unknown/null, and no credential value reaches the browser or export payloads.~~ Still valid as a server-side API check: verify through `GET /api/usage-stats/account?provider=<id>` and keep the pricing/credential assertions.
- [ ] Confirm unchanged persisted fallback logs read only from the folded cursor, appended events remain incremental, and truncation/rewrite still refolds from sequence 0 (#58/#57).

## 4. Export and security

- [ ] Download daily CSV, session CSV, and the versioned JSON export.
- [ ] Check commas, quotes, CR/LF, Unicode titles, and spreadsheet-formula prefixes.
- [ ] Confirm incomplete/mixed-currency estimates export as blank/null rather than partial amounts.
- [ ] Search every export for credential names/values, Authorization, cookies, raw URLs with userinfo/query data, prompt text, response text, and file paths.
- [ ] Confirm exported pricing provenance contains only public rule/source metadata.

## 5. Real DSH release-candidate regression

### v0.4.0-specific gates

The v0.4.0 panel is token-usage only. These checks replace the v0.3.5 account-card gates.

- [ ] The sidebar footer entry and the panel title read "用量" / "Usage"; no "Balance" wording remains in the panel.
- [ ] The panel renders today/month/all-time totals, the cache-hit caption, the trend/calendar view switch, the model-usage donut, and the three export links — and no provider selector, balance card, subscription quota bar, account health, or OrcaRouter entry. The old "recent 14 days" list must be gone.
- [ ] Values below 10,000 keep thousands separators (`1,234`); 10,000 and above abbreviate to at most four characters plus a K/M/B/T suffix (`33.8M`, `6.2B`, `1T`); hovering a value shows the exact number on the totals cards, the trend tooltip and the donut list.
- [ ] The view switch sits inside the month-navigation row, immediately left of the `‹ 2026年10月 ›` arrows (order: curve | calendar) and costs no extra vertical space. The curve view is the default; a stored `heat`/`curve` choice survives a browser refresh through `localStorage` key `@uskyu/dsh-usage-stats:view:v1`, and an unknown stored value falls back to the curve.
- [ ] The trend chart draws one smooth coloured line per model over the selected month, with a colour-dot legend, four dashed gridlines, date ticks (`1 日` / `7 日` / …), and a hover card showing the day, the day total and each model's share. The y axis is linear and scaled to the largest single series, not the daily total. Up to four individual models are drawn; the rest are merged into a grey "其他模型（N）" series. Clicking a day (mouse or keyboard) opens that day's per-model detail.
- [ ] The model-usage donut covers the currently selected month: the ring centre shows that month's total (abbreviated) and the list beside it shows colour dot, model name, percentage and token count for up to five models, with the tail merged into "其他模型（N）". Arc lengths must use the exact token fractions rather than the rounded legend percentages, so the ring closes without a seam.
- [ ] The client issues no request to `/api/usage-stats/providers`, `/api/usage-stats/account`, `/api/usage-stats/balance`, `/api/usage-stats/subscriptions`, or `/api/usage-stats/integrations/orcarouter`: only `/api/usage-stats/usage` and the export downloads are called.
- [ ] All account routes stay reachable and unchanged for external API consumers, while the background timer performs local token aggregation only.

### v0.3.5-specific gates (historical)

This block records the v0.3.5 acceptance run. Its account-card and provider-selector items describe the UI as it existed before v0.4.0; keep them for provenance and verify current behavior against the v0.4.0 gates above.

DSH 0.2 Desktop / DeepSeek Account:

- [x] Real DSH Desktop acceptance completed on 2026-10-01 using the Host-owned `deepseek-account` route.
- [x] The provider selector exposes DeepSeek Account separately from API-key DeepSeek.
- [x] Signed-in account balance renders without requiring `DEEPSEEK_API_KEY`.
- [x] Signing out invalidates the previous balance on the next UI read and renders a signed-out state; signing back in restores the balance.
- [x] Browser/client payloads contain only locale/timezone metadata; raw account token, Cookie, PKCE, and Host-only token resolution never cross the Host boundary.
- [x] CNY and USD wallets remain separate and are never summed across currencies.

MiniMax Coding Plan:

- [x] Known CN/global routes pin credentials to their own region; an upstream 1004/2049 rejection cannot send a known-region key to the other region.
- [x] Only a route with no region signal may retry the other region after an explicit 1004/2049 credential rejection.
- [x] Explicit `usageBaseURL` never falls back to another host.
- [x] PR #122 contributor validated the CN Coding Plan path against a real account and observed two quota windows.
- [x] QueryAccount-level regression coverage locks the global 2049 case to `.io` hosts only.

Packaging/client compatibility:

- [x] Obsolete `@deepseek-ai/dsh-client-runtime` is absent from `dsh.client.inject`; locale and UI-primitives activation entries remain.
- [x] Recent-session cost estimates omit incomplete or mixed-currency amounts rather than showing partial costs.
- [x] DeepSeek peak/off-peak countdown remains scoped to the official route and fails closed for custom relays.

Persistence:

- [ ] Current DSH `list()` entries shaped as `{ header, revision }` resolve to real session ids; no persisted read uses `"undefined"`.
- [ ] The current DSH path uses `list()` + `open(id, "read")` + `handle.read()` and closes every read handle.
- [ ] The current DSH modern path never calls the removed `readFrom()`.
- [ ] The legacy `listSnapshots()` + `readFrom()` fallback remains covered.
- [ ] An unchanged revision skips unnecessary reads.
- [ ] Incremental cursor semantics remain intact.
- [ ] Truncation/rewrite recovery still performs a full refold when needed.
- [ ] `session/disposed` settled sessions are picked up without double counting.
- [ ] A failed persisted read does not erase a previously valid fold.

Declarative balance:

- [ ] Explicit `remaining` wins, including `0`.
- [ ] Missing `remaining` plus valid `used` and `total` derives `max(0, total - used)`.
- [ ] The divisor applies after raw-unit derivation.
- [ ] `used > total` derives `remaining: 0`.
- [ ] Malformed explicit `remaining` is `invalid-response`.
- [ ] Insufficient values do not expose `total` as `remaining`.

- [ ] Test the latest supported `@deepseek-ai/dsh` Desktop/Web release candidate with an isolated profile.
- [ ] Confirm DSH starts without `Failed to load plugins` or loader identity errors.
- [ ] Confirm client bundle load and that `sidebar.footer.action` is the only extension point registered by dsh-usage-stats; verify panel open/close, the curve/calendar switch in the month row, the trend chart, the model-usage donut, budget states, and manual refresh.
- [ ] At 700 / 500 / 400 / 320 px, confirm dsh-usage-stats registers no `conversation.input.*` component or composer DOM and leaves native Permission / Model / Context / Submit layout untouched. Record any remaining sub-400 px overlap as DSH host behavior rather than changing host controls from this plugin.
- [ ] Test the sidebar action and panel in light and dark themes.
- [ ] Confirm the month-navigation row still fits at narrow panel widths with the view switch, `‹ month ›` and the `回到今天` button, and that the trend legend wraps instead of overflowing.
- [ ] Confirm the background timer performs local token aggregation only: with any `refresh.enabled` / `disableBackgroundRefresh` value, no background upstream account request is made and repeated panel refreshes return local aggregates. The legacy `refresh.*` / `disableBackgroundRefresh` keys must still be accepted so old configurations start unchanged (they now only gate server-side account-API caching, not the panel).
- [ ] #53 and #14 are closed and are not v0.4.0 release blockers. If a real enterprise proxy or MiniMax Coding Plan environment is available, record sanitized observations; otherwise mark those checks `NOT TESTED` without claiming a fix.

## 6. Create the immutable release commit

Do not run this section until every release-candidate gate above passes and the maintainer approves preparing the release commit.

- [ ] Create a release branch from the reviewed `main` at `RC_BASE_SHA`.
- [ ] Run `npm run release:sync -- 0.4.0` once to update `package.json`, `package-lock.json`, the Community Market catalog, and documented stable-version references together.
- [ ] Confirm the v0.4.0 release notes use final stable wording, preserve the historical v0.3.x notes, and do not claim unverified #14/#53 fixes or include out-of-scope behavior.
- [ ] Run the release gates again against the synchronized version:

```bash
npm run check
npm test
npm pack --json
```

- [ ] Inspect the final pack manifest, then commit all version/release metadata changes with `chore: prepare v0.4.0 release`.
- [ ] Record that commit as `RELEASE_SHA`; this replaces `RC_BASE_SHA` as the only publish/tag identity.
- [ ] Confirm the working tree is clean and `HEAD` equals `RELEASE_SHA`.
- [ ] Confirm the committed package version, not merely the working-tree version:

```bash
test "$(git show "$RELEASE_SHA:package.json" | jq -r .version)" = "0.4.0"
```

The release invariant is:

```text
npm published source commit
== v0.4.0 tag commit
== GitHub Release commit
== package/catalog version commit
== RELEASE_SHA
```

## 7. Publish and market closeout

Do not run this section until the immutable release commit exists and the maintainer explicitly authorizes publishing.

- [ ] `npm whoami` returns the expected publisher.
- [ ] From a clean checkout/worktree at exactly `RELEASE_SHA`, run `npm publish --access public --registry=https://registry.npmjs.org/`.
- [ ] `npm view "@uskyu/dsh-usage-stats" version --registry=https://registry.npmjs.org/` equals the target version.
- [ ] Merge or push the release commit to `main` according to the chosen branch workflow; verify `main` contains the exact `RELEASE_SHA` without recreating the release changes.
- [ ] Only after npm and `main` verification: create the signed/annotated `v0.4.0` tag pointing explicitly to `RELEASE_SHA`.
- [ ] Verify the tag resolves to the published source commit:

```bash
test "$(git rev-parse v0.4.0^{commit})" = "$RELEASE_SHA"
```

- [ ] Create the GitHub Release from `v0.4.0`; verify it resolves to `RELEASE_SHA`.
- [ ] Verify the public Pages `catalog-source.json` and `/v1/plugins` response content type, package name, and exact version.
- [ ] Install the exact npm version through DSH Desktop Community Market and restart the host.
- [ ] Close the npm/market release issue only after the Desktop Market installation succeeds.
