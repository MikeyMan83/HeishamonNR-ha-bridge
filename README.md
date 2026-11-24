# HeishamonNR-ha-bridge

Importable Node-RED tab for [HeishaMoNR](https://github.com/edterbak/HeishaMoNR) that pushes **all flow settings and automation state** to MQTT with Home Assistant auto-discovery, so every internal value becomes a normal HA sensor with history.

- Flow file: [`ha-bridge-flow.json`](ha-bridge-flow.json), **v1.0.0** (see [`version.json`](version.json) and [`CHANGELOG.md`](CHANGELOG.md)); all node ids prefixed `habridge`, so an import never collides with package ids.
- Validated against HeishaMoNR `flows (26.5.1 stable).json` (see [CHANGELOG.md](CHANGELOG.md) for what was verified).

## Why

HeishaMoNR exposes machine data to MQTT (`panasonic_heat_pump/...`), but keeps its entire settings layer (RTC trigger/revert/ladder, SmartStart, CCC, solar, cool, pump speed) inside Node-RED globals. HA never sees those values, so you cannot chart or alarm on them, and a flow update can silently restore defaults (RTC defaults are 3.0 / 1.0) without you noticing.

## What it publishes

- All persisted settings objects, flattened to dotted keys: `F_RTC`, `F_SS`, `F_CCC`, `F_SOLAR`, `F_COOL`, `F_ReducePumpSpeed` (read from global `file` storage; nothing in Ed's flow is modified, no link-in/link-out wiring needed).
- Scalar runtime globals, including the heater element readback: `TOP97_Heater_Start_Delta`, `TOP98_Heater_Stop_Delta`, `TOP96_Heater_Delay_Time`, `TOP94_Zones_State`, `TOP99_Buffer_Installed`, `T_zone_1/2`, `VirtualState`, `Force_DHW_active`, `F_stored_next_operating_mode`.
- MQTT state topics: `heishamon/nr/<key>` (retained). Discovery configs are sent once per key per Node-RED restart to `homeassistant/sensor/heishamon_nr/<key>/config`, device **HeishaMon NR Flow**.
- Poll rates: state-like keys (state/power/setpoint/active) every 60 s, full snapshot every 10 min.

## Install

1. Node-RED menu > Import > select `ha-bridge-flow.json` > Import (as a new flow) > Deploy.
2. Open the single MQTT out node; if the broker is not pre-filled, select your own broker config.
3. Deploy. Entities appear in HA under the MQTT integration, device "HeishaMon NR Flow".

## Verify after install

- `rtc.automation_on_limit` (entity `sensor.heishamon_nr_rtc_automation_on_limit`) should equal your RTC "revert" value (e.g. 0.2). If you see 3.0/1.0, a flow update restored defaults: set them again.
- `TOP97_Heater_Start_Delta` should read -3 on J-series units with factory element settings (readback proof of start -3 / stop -1 / delay 30 min).

## Version

Current: **1.0.0** — see [`version.json`](version.json) and [`CHANGELOG.md`](CHANGELOG.md). The tab node's info field also carries the version. Validated against HeishaMoNR flow **26.5.1 (stable)**; the bridge is expected to survive HeishaMoNR updates as long as the global storage objects keep their names.

## Notes

- Fully standalone: survives HeishaMoNR updates as long as the global storage objects keep their names.
- Do not combine with earlier `wp-telemetry.json` versions (different topic prefix, would duplicate entities).
- Flow tested via mock runtime: discovery sent once per key, no duplicates, fast/slow poll split verified.
- HeishaMoNR itself is by [edterbak](https://github.com/edterbak/HeishaMoNR). This bridge: MIT license.
