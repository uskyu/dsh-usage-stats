# v0.4.0 release notes

`v0.4.0` is a focus release: the panel is now a token-usage dashboard, the package
identity moved to `@uskyu/dsh-usage-stats`, and the monthly view gained a curve
projection.

## Highlights

### npm identity moved to `@uskyu/dsh-usage-stats`

- `package.json`, `package-lock.json`, `cordis.patch.yml`, the Community Market
  catalog (`catalog/catalog-source.json`, `catalog/v1/plugins.json`) and the
  README/catalog endpoint all use the `@uskyu/dsh-usage-stats` identity.
- The compatible installer (`npx --yes github:uskyu/dsh-usage-stats`) still
  migrates the unscoped `name: dsh-usage-stats` entry and repairs an unquoted
  scoped identity. Profiles installed under the previous scoped name must remove
  that old package and its Cordis entry before installing this one, otherwise
  the plugin is mounted twice.

### Provider account UI removed

- The panel no longer renders a provider account section: no provider dropdown,
  balance card, subscription quota bar, account health row, or OrcaRouter entry.
- The client no longer requests `/api/usage-stats/providers`,
  `/api/usage-stats/account`, `/api/usage-stats/balance`,
  `/api/usage-stats/subscriptions`, or
  `/api/usage-stats/integrations/orcarouter`. The sidebar badge and the panel
  title are now simply "用量" / "Usage".
- The background timer no longer polls upstream account APIs; it performs local
  token aggregation only. `refresh.enabled`, `refresh.activeMs`,
  `refresh.detailMs`, `refresh.backgroundMs`, and `disableBackgroundRefresh` are
  still accepted and validated for backward compatibility: they no longer change
  panel behavior (`refresh.enabled: false` still gates server-side account-API
  caching, and the three intervals still feed account cache expiry).
- Every account HTTP route and adapter stays in the server half for external API
  consumers and explicit `monitors` configuration, with unchanged semantics.
  Credentials remain server-side; the browser receives aggregate token usage and
  the export downloads only.

### Today by model replaces the recent-session cost block

- The former "recent session costs" section is gone. In its place, "Today by
  model" / "今日模型消耗" lists up to five `provider · model` rows sorted by
  today's tokens, each with a share-of-today bar and an abbreviated token count
  (the exact value stays available as a tooltip). An empty day shows an
  explicit empty state.
- Session-level cost estimates remain in `usage.sessions`, the sessions CSV, the
  JSON export, and the billing aggregation; the panel just no longer lists them.

### Compact token numbers

- Values below 10,000 render verbatim with thousands separators (`1,234`).
- Values at 10,000 and above abbreviate to at most four characters plus a
  K/M/B/T suffix (`33,818,571` → `33.8M`, `6,246,205,945` → `6.2B`,
  `999,999,999,999` → `1T`).
- The exact grouped value stays available as a `title` tooltip on the same
  element, and applies to the today/month/all-time cards, the last-14-days list,
  the heatmap tooltips, and the today-by-model ranking.

### Calendar ⇄ curve view for the current month

- A two-button segmented control under the "daily usage this month" title
  switches between the existing calendar heatmap and a new curve view: a smooth
  SVG line with a gradient area, sized to the panel width and scaled by square
  root so a single peak does not flatten the rest of the month.
- Both views share the same day selection: clicking a calendar cell, a curve
  hit target, or a last-14-days row opens that day's per-model detail, and the
  curve targets are focusable and respond to Enter/Space.
- The choice is stored in the browser under
  `@uskyu/dsh-usage-stats:view:v1` and restored on refresh; when storage is
  unavailable the panel fails closed to the calendar view.

## Compatibility

- Supported DSH range is unchanged (`@deepseek-ai/dsh >= 0.1.0-rc.6`, `web`
  profile). Persistence and session reads still branch on capability detection,
  not on a version switch.
- The usage cache format is still `version: 5`; an existing cache is reused and
  refolded in place.
- Legacy `display.currentSessionPill` is still accepted without effect, and the
  `session-context` server endpoint keeps its v0.3.0 response semantics.
- Exports are unchanged: daily CSV, sessions CSV, and the versioned JSON, with
  the same secret-free whitelist and `costComplete` rules.

## Verification

- `npm run check` (includes `node scripts/check-release-metadata.mjs`) and
  `npm test` stay the offline gates; the README stable-version marker and the
  exact `@uskyu/dsh-usage-stats@0.4.0` install command are asserted by the
  release-metadata check.
- See [`docs/release-checklist.md`](release-checklist.md) for the v0.4.0 gates,
  including the panel regression list and the "local aggregation only" check.
