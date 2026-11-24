# HeishamonNR-ha-bridge

Importable Node-RED tab for [HeishaMoNR](https://github.com/edterbak/HeishaMoNR) that pushes **all flow settings and automation state** to MQTT with Home Assistant auto-discovery, so every internal value becomes a normal HA sensor with history. Since v1.2.0 the tab has its own dashboard page and keeps itself current from this repo, in line with [HeishamonNR-update-tab](https://github.com/MikeyMan83/HeishamonNR-update-tab).

- Flow file: [`ha-bridge-flow.json`](ha-bridge-flow.json), **v1.2.1** (see [`version.json`](version.json) and [`CHANGELOG.md`](CHANGELOG.md)); all node ids prefixed `habridge`, so an import never collides with package ids. Nodes carry editor coordinates, so the tab lays out cleanly on import — delete any previously imported "HA Bridge" tab first (including its dashboard items), so the new positions apply and ids do not clash.

## Why

HeishaMoNR exposes machine data to MQTT (`panasonic_heat_pump/...`), but keeps its entire settings layer (RTC trigger/revert/ladder, SmartStart, CCC, solar, cool, pump speed) inside Node-RED globals. HA never sees those values, so you cannot chart or alarm on them, and a flow update can silently restore defaults (RTC defaults are 3.0 / 1.0) without you noticing.

## What it publishes

- All persisted settings objects, flattened to dotted keys: `F_RTC`, `F_SS`, `F_CCC`, `F_SOLAR`, `F_COOL`, `F_ReducePumpSpeed`, plus `NightReductionRoomSetpoint`, `NightReductionWaterTemp`, `Schedule_conditions` and the full scheduler rows `Schedule_1..10` with per-row `state`, `toggle_item`, `action`, `setpoint`, `target`, `hour`, `minutes`, `day`, `override`, `topic` and `condition` (read from global `file` storage; nothing in Ed's flow is modified, no link-in/link-out wiring needed). Chart caches are skipped; `setpoint`/`target` do not exist in 26.5.1 and are skipped when undefined.
- Scalar runtime globals, including the heater element readback (`TOP97_Heater_Start_Delta`, `TOP98_Heater_Stop_Delta`, `TOP96_Heater_Delay_Time`, ...), DHW automation/setpoints, quiet/powerful/holiday, sterilization, and the three correction-function switches. Watched scalars that the flow leaves undefined publish as `unset` (on the live authoring system this exposed `Quiet_Mode_Level` etc. as `unset`, the readback side of the quiet-mode issue).
- MQTT state topics: `heishamon/nr/<key>` (retained). Discovery configs once per key per Node-RED restart, device **HeishaMon NR Flow**. Poll rates: state-like keys every 60 s, full snapshot every 10 min.

## Dashboard tab

In the same layout style as the update tab: two half-width columns (two `ui_group`s of width 6), full-width buttons.

- **Status**: `Version` (boot-refreshed, also after a self-update), `Values` (number of published values, full snapshot) and `Last publish` (fast + full timestamps). Fed by the publisher's second output, refreshed every 60 s.
- **Update from GitHub**: [Check for updates] (cache-busted fetch of `version.json`, shows `GitHub: vX (update!)` or `(up to date)`), the persistent GitHub / update status field, and [Update from GitHub].

## Self-update ([Update from GitHub])

Check-then-apply in one button, following the update tab's trust model:

- Pinned URLs only (`raw.githubusercontent.com/MikeyMan83/HeishamonNR-ha-bridge`), cache-buster on every fetch; a tampered `flowUrl` is refused.
- Download validation: JSON array, every id `habridge.*`-prefixed, unique ids, tab node present, and the version inside the tab info must match `version.json` (wrong file = refused, nothing changes).
- Running flows are read via the loopback Admin API (`http://127.0.0.1:1880`, or the `HAB_ADMIN_BASE` / `WPU_ADMIN_BASE` env var). If the editor is protected, the tab logs in once via `/auth/token` with the `HAB_ADMIN_USER` / `HAB_ADMIN_PASS` env vars (`WPU_ADMIN_*` also works); credentials never sit in the flow or context.
- The merge replaces **only** `habridge.*` nodes; personal tabs, the WP update tab and everything else are untouched. If the pinned MQTT broker config id does not exist locally, the bridge nodes are rewritten to the locally most-used broker (broker rescue).
- Deploys atomically via `POST /flows` with rev conflict detection (409 = a deploy raced you, press again).
- After an update the success toast may not appear (the flow replaces itself): the **Version** field booting to the new value is the confirmation. Rollback: import an older `ha-bridge-flow.json` from the repo history.

## Not included (by design)

- The flow's built-in **Log tab** (scrolling `debuglog` table). It is tab-private flow context, unreachable from a separate tab without wiring into Ed's flow (which this bridge deliberately never does). For settings and trigger events, the sensors' HA history is the log.

## Install

1. Delete any previously imported "HA Bridge" tab completely first (editor tab + its dashboard items), then Node-RED menu > Import > select `ha-bridge-flow.json` > Import (as a new flow) > Deploy. Both an "HA Bridge" editor tab and an "HA Bridge" dashboard tab appear.
2. Open the single MQTT out node; if the broker is not pre-filled, select your own broker config.
3. On the dashboard tab press [Check for updates]; from now on [Update from GitHub] keeps the tab current.

## Verify after install

- The dashboard `Version` field shows `Running: v1.2.1` after the boot refresh.
- `rtc.automation_on_limit` (entity `sensor.heishamon_nr_flow_nr_rtc_automation_on_limit`) should equal your RTC "revert" value. If you see 3.0/1.0, a flow update restored defaults: set them again.
- `TOP97_Heater_Start_Delta` should read -3 on J-series units with factory element settings.

## Version

Current: **1.2.1** — see [`version.json`](version.json) and [`CHANGELOG.md`](CHANGELOG.md). The tab node's info field also carries the version. Validated against HeishaMoNR flow **26.5.1 (stable)**; the bridge is expected to survive HeishaMoNR updates as long as the global storage objects keep their names.

## Notes

- Do not combine with earlier `wp-telemetry.json` versions (different topic prefix, would duplicate entities).
- Flow tested via a mock runtime (28 checks): phased updater state machine incl. 401/token retry, v1 and v2 Admin API shapes, broker rescue, rev conflict, tampered URL and foreign-id refusal, publish stats. Harness run ad-hoc; not committed to this repo (unlike HeishamonNR-update-tab's `test/harness.js`).
- HeishaMoNR itself is by [edterbak](https://github.com/edterbak/HeishaMoNR). This bridge: MIT license.
