# v0.4.0 release notes

`v0.4.0` is a focus release: the panel is now a token-usage dashboard, the package
identity moved to `@uskyu/dsh-usage-stats`, and the analysis area is a default
multi-model daily trend over a rolling 7-day/1-month window, with a model-usage
donut over the same window.

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

### Rolling time range drives the trend and the donut

- A new range switch ("近 7 天" / "近 1 个月") sits at the far left of the
  analysis header row, with the view switch ("曲线" / "日历") to its right. Both
  windows are **rolling and end today**: 7 days including today, or the last 30
  calendar days, so they cross month boundaries correctly. The default is
  "近 7 天".
- One window feeds both charts, so the ring always describes the same period as
  the lines. The choice is stored under `@uskyu/dsh-usage-stats:range:v1`
  (`week` / `month`); an unknown value, disabled storage or a write failure falls
  back to `week`.
- The month navigation (`‹` / `›` and `回到今天`) now appears **only in the
  calendar view**: the rolling window is independent of the calendar month, and
  month arrows next to a rolling chart wrongly suggest the trend range can be
  paged.

### Model usage donut replaces the model list

- The former "recent session costs" block and the intermediate "Today by model"
  list are both gone. In their place, "Model usage" / "模型用量" shows a donut
  for the **same rolling window as the trend**: the ring centre is the window
  total (abbreviated) and the list beside it renders one row per model — colour
  dot, model name, percentage and token count — for up to five models, with the
  tail merged into "其他模型（N）" / "Other models (N)".
- Hovering a slice thickens it, shows a compact card over the ring centre
  (model name, tokens, share) and highlights the matching list row; hovering a
  list row highlights the matching slice and shows the same card. The card
  replaces the centre total while it is visible.
- Arc lengths come from the exact token fraction, never from the rounded legend
  percentage: independent rounding makes displayed percentages sum past 100%
  (e.g. 57+33+8+2+1), which would overlap the ring and leave a seam. The final
  slice is sized to close the circumference exactly.
- Session-level cost estimates remain in `usage.sessions`, the sessions CSV, the
  JSON export, and the billing aggregation; the panel just no longer lists them.

### Compact token numbers

- Values below 10,000 render verbatim with thousands separators (`1,234`).
- Values at 10,000 and above abbreviate to at most four characters plus a
  K/M/B/T suffix (`33,818,571` → `33.8M`, `6,246,205,945` → `6.2B`,
  `999,999,999,999` → `1T`).
- The exact grouped value stays available as a `title` tooltip on the same
  element, and applies to the today/month/all-time cards, the trend tooltip, the
  donut tooltip and the donut list.

### Multi-model daily trend replaces the single curve

- The default view is now "Daily token trend" / "每日 Token 趋势图": one smooth
  Catmull-Rom line per model across the rolling window, with a colour-dot legend
  above, four dashed gridlines behind, and up to six date ticks below.
- The spline tension was raised from 0.5 to 1.0, so the trough between two peaks
  reads as a rounded U-shape instead of a sharp V.
- The x axis now ends on **today** (the window's last sample) instead of running
  to the end of the month, which used to leave a flat line from the latest day
  with data to the 31st. Tick labels use the `M/D` form (`10/19`) and always
  include the window's first and last day.
- The y axis is linear and scaled to the **largest single series**, not the daily
  total, so a busy day does not flatten every line into the bottom quarter. Days
  without usage are zero points on the baseline rather than gaps.
- Up to four models are drawn individually; the rest are merged into a grey
  "其他模型（N）" series. Hovering a day opens a card with the date, the day's
  total and each model's share; clicking a day (or pressing Enter/Space on its
  focusable hit target) opens that day's per-model detail.
- The view switch sits on the analysis header row, to the right of the range
  switch (order: curve | calendar). The choice is stored under
  `@uskyu/dsh-usage-stats:view:v1`; an unknown stored value, disabled storage or
  a write failure falls back to the curve.
- The standalone "recent 14 days" list was removed; the trend chart and the
  donut cover the same rolling window, while the calendar view keeps its own
  month.

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
