## v1.0.0 (current)

Initial release of the HA bridge tab (`ha-bridge-flow.json`, 6 nodes, ids prefixed `habridge`).

- Publishes all persisted HeishaMoNR settings objects (`F_RTC`, `F_SS`, `F_CCC`, `F_SOLAR`, `F_COOL`, `F_ReducePumpSpeed`, read from global `file` storage) flattened to dotted keys, plus scalar runtime globals (`TOP97/98/96_Heater_*`, `TOP94_Zones_State`, `TOP99_Buffer_Installed`, `T_zone_1/2`, `VirtualState`, `Force_DHW_active`, `F_stored_next_operating_mode`), to retained MQTT topics `heishamon/nr/<key>`.
- Sends Home Assistant MQTT discovery configs once per key per Node-RED restart to `homeassistant/sensor/heishamon_nr/<uid>/config` (device "HeishaMon NR Flow"), so every value becomes a normal HA sensor with history. Poll rates: state-like keys every 60 s, full snapshot every 10 min.
- Read-only towards the flow: only `global.get`, no writes, separate tab, no link-in/link-out wiring.
- Validated against HeishaMoNR `flows (26.5.1 stable).json`: every key the bridge reads exists with the expected storage store; RTC automation defaults 3.0/1.0, heater-delta readback ranges, and the `panasonic_heat_pump/...` upstream prefix (no collision with `heishamon/nr/...`) all confirmed in the flow source. Flow code in `ha-bridge-flow.json` is identical to `ha_bridge_code.js`; behaviour re-verified in a mock Node-RED runtime (fast tick emits only state-like keys, discovery once per key, retained payloads correct).

Known limitations (documented, not bugs):

- `chart` subkeys inside `F_CCC`/`F_COOL` are flattened per data point (`ccc.z1.chart.0.x`, ...), creating extra one-off entities; HA keeps its own history of the live values, so chart data is redundant in HA.
- The 60 s fast-poll regex `/state|power|setpoint|active|on_off/i` matches `automation_off_limit` but not `automation_on_limit`, so `rtc.automation_on_limit` only publishes on the 10 min tick.
- The mqtt out node references a broker config id from the authoring instance; on import elsewhere, select your own broker (see README Install step 2).
- HA generates entity ids as `sensor.heishamon_nr_<uid>` (node_id `heishamon_nr` + object id from the discovery topic).
