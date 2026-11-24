## v1.1.2 (current)

Editor layout only, no runtime change: wider node spacing (`injects x=180, function x=440, mqtt out/debug x=740`, ys 100-240) so the tab does not hug the left edge of the canvas. Tip: delete any previously imported "HA Bridge" tab before re-importing, otherwise Node-RED may keep the old node positions.

## v1.1.1

Editor layout only, no runtime change: `x`/`y` coordinates added to all nodes in `ha-bridge-flow.json`, so the tab renders as a clean left-to-right flow in the editor (fast/slow injects on the left, publisher function in the middle, mqtt out + debug on the right) instead of all nodes stacked at the origin on import.

## v1.1.0

Fixes + coverage, re-validated against HeishaMoNR `flows (26.5.1 stable).json`:

- `chart` subkeys inside the settings objects (`F_CCC.z1.chart`, `F_COOL.chart`, ...) are no longer flattened into per-data-point entities — HA records its own history of the live values, so the chart cache is redundant there.
- Fast-poll (60 s) regex now also matches `limit` (`/state|power|setpoint|active|on_off|limit/i`): `rtc.automation_on_limit` / `automation_off_limit` and the RTC ladder limits publish every 60 s instead of only on the 10 min snapshot (previously `on_limit` was missed while `off_limit` accidentally matched via "on_off").
- Coverage extended beyond the `F_*` objects (all names verified present in the 26.5.1 flow, file store): objects `NightReductionRoomSetpoint`, `NightReductionWaterTemp`, `Schedule_conditions`, `Schedule_1..10_state` + `Schedule_1..10_toggle_item`; scalars `DHW_automation_active/delay/state`, `DHW_boost_state`, `DHW_threshold_lower/upper`, `DHW_SP_HIGH/LOW`, `Quiet_Mode_Level`, `Quietmode_time`, `Previous_Quiet_Mode_Level`, `PowerfulMode`, `HolidayMode`, `Sterilization_active`, `Sterilization_Temp`, `SetForceSterilization`, `SolarFunction_active`, `Correction_0_WAR_on_off`, `Correction_1_RTC_on_off`, `Correction_2_softstart_on_off`.
- Mock-runtime re-test: chart keys absent from output, limit keys present on the fast tick, all new keys published on the full tick, discovery configs still sent once per key per Node-RED restart.

## v1.0.0

Initial release of the HA bridge tab (`ha-bridge-flow.json`, 6 nodes, ids prefixed `habridge`).

- Publishes all persisted HeishaMoNR settings objects (`F_RTC`, `F_SS`, `F_CCC`, `F_SOLAR`, `F_COOL`, `F_ReducePumpSpeed`, read from global `file` storage) flattened to dotted keys, plus scalar runtime globals (`TOP97/98/96_Heater_*`, `TOP94_Zones_State`, `TOP99_Buffer_Installed`, `T_zone_1/2`, `VirtualState`, `Force_DHW_active`, `F_stored_next_operating_mode`), to retained MQTT topics `heishamon/nr/<key>`.
- Sends Home Assistant MQTT discovery configs once per key per Node-RED restart to `homeassistant/sensor/heishamon_nr/<uid>/config` (device "HeishaMon NR Flow"), so every value becomes a normal HA sensor with history. Poll rates: state-like keys every 60 s, full snapshot every 10 min.
- Read-only towards the flow: only `global.get`, no writes, separate tab, no link-in/link-out wiring.
- Validated against HeishaMoNR `flows (26.5.1 stable).json`: every key the bridge reads exists with the expected storage store; RTC automation defaults 3.0/1.0, heater-delta readback ranges, and the `panasonic_heat_pump/...` upstream prefix (no collision with `heishamon/nr/...`) all confirmed in the flow source. Flow code in `ha-bridge-flow.json` is identical to `ha_bridge_code.js`; behaviour re-verified in a mock Node-RED runtime (fast tick emits only state-like keys, discovery once per key, retained payloads correct).

Known limitations (documented, not bugs; chart keys and the fast-poll regex quirk were fixed in v1.1.0):

- The mqtt out node references a broker config id from the authoring instance; on import elsewhere, select your own broker (see README Install step 2).
- HA generates entity ids as `sensor.heishamon_nr_<uid>` (node_id `heishamon_nr` + object id from the discovery topic).
