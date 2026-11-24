## v1.3.0 (current, 21 nodes)

Wording and layout sweep: one concept = one name, full sentences on every surface, and the same sentence on toast and status field. Layout and vocabulary borrowed from the update tab, which received the same UI/UX golden-standard sweep in its v4.12.9/v4.12.10. No behaviour change beyond the texts.

- **Update status** is now the single name of the persistent check-result field (was "GitHub / update status"); its group is called **Update**. [Check for updates] writes one full sentence, identical on toast and field: `Bridge update available: X.Y.Z. Press [Update from GitHub].` or `Up to date (X.Y.Z).` (replaces the `GitHub: vX (update!)` / `(up to date)` shorthand).
- Every failure path uses the same `Update failed: <reason>.` template on both surfaces (toast topic `HA Bridge error`); the 409 rev conflict names the button to press again.
- Version field boot sentence: `Running bridge version 1.3.0.` (was `Running: v1.2.1`), matching the update tab's sentence style.
- Deploy success: toast `Bridge update succeeded: now running X. Fields refresh after the restart.` and field `Last update: X (ok).`; the locale-dependent timestamp was dropped so the texts are deterministic and testable.
- Layout: all four status fields share the update tab widget style (width 6, height 2, left-aligned); both buttons carry tooltips; editor node names follow one casing convention.
- The mock-runtime test harness is now committed as `test/harness.js` (like the update-tab repo) and runs the real flow funcs: 56/56 green.

## v1.2.1 (21 nodes)

Repo hygiene only, no runtime change — one consistent current version across flow, version.json, README and CHANGELOG:

- CHANGELOG entries now carry node counts like HeishamonNR-update-tab (`## vX.Y.Z (current, N nodes)`); `ha-bridge-flow.json` and `version.json` reformatted to 2-space indent with trailing newline, matching the update-tab repo.
- Corrected the v1.1.4 entry and the publisher comment: HeishaMoNR 26.5.1 stores no `Schedule_N_setpoint`/`Schedule_N_target` (skipped when undefined), and `topic` only on row 1.
- The v1.2.0 mock harness (28/28) was run ad-hoc and is NOT committed, unlike update-tab's `test/harness.js`.

## v1.2.0 (21 nodes)

Dashboard status tab + GitHub self-update, in line with [HeishamonNR-update-tab](https://github.com/MikeyMan83/HeishamonNR-update-tab).

- The tab now has its own node-red-dashboard page "HA Bridge": two half-width columns (`ui_group`s of width 6, full-width buttons, like the update tab layout). Column **Status**: running version (boot-refreshed, also after a self-update), number of published values, last fast/full publish timestamps (fed by the publisher's new output 2, refreshed every 60 s). Column **Update from GitHub**: [Check for updates], the persistent GitHub / update status field, [Update from GitHub].
- [Check for updates]: cache-busted fetch of the pinned `version.json`, shows `GitHub: vX (update!) / (up to date)` — also guards against CDN edge caches.
- [Update from GitHub]: check-then-apply in one button. Validates the download (JSON array, `habridge.*` ids only, unique, tab node present, tab-info version must match version.json), reads the running flows via the loopback Admin API (`http://127.0.0.1:1880` or `HAB_ADMIN_BASE`/`WPU_ADMIN_BASE`; `/auth/token` with `HAB_ADMIN_USER`/`HAB_ADMIN_PASS` when the editor is protected, `WPU_ADMIN_*` also accepted; credentials never sit in the flow or context), replaces **only** `habridge.*` nodes, rescues the MQTT broker reference to the locally most-used broker when the pinned config id does not exist, and deploys atomically (`POST /flows` with rev conflict reporting; 409 tells you to press again).
- Errors surface as a toast plus the persistent GitHub / update status field; network failures are caught by a scope-limited catch node on the http node.
- Known behaviour after a self-update: the success toast may not appear (the flow replaces itself); the Version field booting to the new value is the confirmation.
- Mock-runtime harness: 28/28 checks green (phased state machine incl. 401 -> token -> retry, v1/v2 Admin API shapes, broker rescue, personal-tab survival, rev conflict, tampered flowUrl, foreign node id, version mismatch refusal, up-to-date short-circuit, publish stats round-trip). Two bugs found and fixed by the harness before release: JSON payloads from the http node arrive as objects (string-only parsing would have failed), and a deploy-body variable shadowed the parse helper (TDZ).
- em dashes removed from user-facing toast texts.

## v1.1.4 (6 nodes)

Scheduler coverage + observability, re-validated against HeishaMoNR `flows (26.5.1 stable).json` and a mock runtime:

- Scheduler rows now publish the per-row fields the 26.5.1 flow actually stores (verified in the source): `state`, `toggle_item`, `action`, `hour`, `minutes`, `day`, `override`, `condition` on every row and `topic` on row 1, for rows `Schedule_1..10`. `setpoint` and `target` are also read but do not exist in 26.5.1, so they are skipped when undefined. Previously only `_state` and `_toggle_item` were covered, so the actual scheduled action (e.g. which row sets the Quiet mode level, at what time) was invisible in HA.
- Watched scalar globals that the flow leaves undefined now publish as `unset` instead of being skipped. On the live system this immediately showed `Quiet_Mode_Level`, `Quietmode_time` and `Quietmode_on_off` are undefined (file store), the readback side of the known "night quiet mode does not engage" issue.
- Added `Quietmode_on_off` to the watched scalars.
- Logs are explicitly out of scope (documented in README): the flow's Log tab is tab-private flow context (`flow.set('debuglog')`), so a separate tab cannot read it without wiring into Ed's flow.
- Mock-runtime re-test: scheduler action/hour published per row, `unset` published for undefined watched scalars, discovery configs still sent once per key per Node-RED restart, fast tick still limited to state-like keys.

## v1.1.3 (6 nodes)

Docs only, no runtime change: corrected the HA entity_id examples. HA actually generates ids as `sensor.heishamon_nr_flow_nr_<slug>` — device-name prefix `heishamon_nr_flow` ("HeishaMon NR Flow") plus the object id from the discovery name `NR <key>` — e.g. `sensor.heishamon_nr_flow_nr_rtc_automation_on_limit`.

## v1.1.2 (6 nodes)

Editor layout only, no runtime change: wider node spacing so the tab does not hug the left edge of the canvas. Tip: delete any previously imported "HA Bridge" tab before re-importing.

## v1.1.1 (6 nodes)

Editor layout only, no runtime change: `x`/`y` coordinates added to all nodes, so the tab renders as a clean left-to-right flow instead of all nodes stacked at the origin on import.

## v1.1.0 (6 nodes)

Fixes + coverage, re-validated against HeishaMoNR `flows (26.5.1 stable).json`:

- `chart` subkeys inside the settings objects are no longer flattened into per-data-point entities — HA records its own history of the live values.
- Fast-poll (60 s) regex now also matches `limit`: `rtc.automation_on_limit` / `automation_off_limit` and the RTC ladder limits publish every 60 s instead of only on the 10 min snapshot.
- Coverage extended beyond the `F_*` objects (all names verified present in the 26.5.1 flow, file store): `NightReductionRoomSetpoint`, `NightReductionWaterTemp`, `Schedule_conditions`, `Schedule_1..10_state` + `_toggle_item`; scalars `DHW_automation_*`, `DHW_boost_state`, `DHW_threshold_*`, `DHW_SP_HIGH/LOW`, `Quiet_Mode_Level`, `Quietmode_time`, `Previous_Quiet_Mode_Level`, `PowerfulMode`, `HolidayMode`, `Sterilization_active/Temp`, `SetForceSterilization`, `SolarFunction_active`, `Correction_0/1/2_*_on_off`.
- Mock-runtime re-test green.

## v1.0.0 (6 nodes)

Initial release of the HA bridge tab (6 nodes, ids prefixed `habridge`). Publishes all persisted HeishaMoNR settings objects plus scalar runtime globals to retained MQTT topics `heishamon/nr/<key>`, with HA MQTT discovery once per key (device "HeishaMon NR Flow"). Read-only towards the flow: only `global.get`, no writes, separate tab, no link-in/link-out wiring. Validated against HeishaMoNR 26.5.1; mock-verified (discovery once per key, fast tick state-only).

- Known edge: the mqtt out node references a broker config id from the authoring instance; on import elsewhere, select your own broker (Install step 2).
- The flow's built-in Log tab is not mirrored (tab-private context).
