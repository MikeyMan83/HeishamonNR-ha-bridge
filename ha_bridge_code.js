// HA BRIDGE publisher for HeishaMoNR (v2.0.1) - separate tab, does not touch Ed's logic.
// Reads the flow's own settings objects (global, file storage) and publishes
// every value to MQTT, plus HA MQTT discovery configs once per key per restart.
// Output 1: MQTT messages. Output 2: dashboard status (values count + timestamps).
// Requires MQTT discovery enabled in HA (it is, if HeishaMon entities auto-appeared).

const STATE_BASE = 'heishamon/nr';      // state topics: heishamon/nr/<key>
const DISC_BASE  = 'homeassistant/sensor/heishamon_nr'; // discovery topics

// Objects the flow persists (name = MQTT/HA prefix)
const OBJECTS = {
    rtc:   'F_RTC',
    ss:    'F_SS',
    ccc:   'F_CCC',
    solar: 'F_SOLAR',
    cool:  'F_COOL',
    pump:  'F_ReducePumpSpeed',
    nr_room:    'NightReductionRoomSetpoint',
    nr_water:   'NightReductionWaterTemp',
    sched_cond: 'Schedule_conditions'
};

// Scheduler rows: per-row fields of the 26.5.1 flow (state/toggle_item/action/hour/minutes/day/override/condition; topic only row 1). setpoint/target do not exist in 26.5.1 and are skipped when undefined.
const SCHED_SUFFIXES = ['state', 'toggle_item', 'action', 'setpoint', 'target',
                        'hour', 'minutes', 'day', 'override', 'topic', 'condition'];
for (let i = 1; i <= 10; i++) {
    for (const suf of SCHED_SUFFIXES) {
        OBJECTS['sched_' + i + '_' + suf] = 'Schedule_' + i + '_' + suf;
    }
}

// \"fast\" poll (60 s): keys that look like live state / triggers / limits
const FAST = /state|power|setpoint|active|on_off|limit/i;

const fast = (msg.topic === 'fast');

// ---------- flatten ----------
function flatten(prefix, obj, out) {
    if (obj === null || obj === undefined) return out;
    if (typeof obj !== 'object') { out[prefix] = obj; return out; }
    for (const k of Object.keys(obj)) { if (k === 'chart') continue; flatten(prefix + '.' + k, obj[k], out); }
    return out;
}

const flat = {};

// Plain scalar globals (readback / runtime state, not in F_ objects).
// Missing ones are published as 'unset' so gaps (e.g. Quiet_Mode_Level) are visible.
const SCALARS = [
    'TOP97_Heater_Start_Delta',      // J-series: factory -3 (readback = proof)
    'TOP98_Heater_Stop_Delta',       // factory -1
    'TOP96_Heater_Delay_Time',       // factory 30 min
    'TOP94_Zones_State',
    'TOP99_Buffer_Installed',
    'T_zone_1', 'T_zone_2',
    'VirtualState',
    'Force_DHW_active',
    'F_stored_next_operating_mode',
    'DHW_automation_active', 'DHW_automation_delay', 'DHW_automation_state',
    'DHW_boost_state', 'DHW_threshold_lower', 'DHW_threshold_upper',
    'DHW_SP_HIGH', 'DHW_SP_LOW',
    'Quiet_Mode_Level', 'Quietmode_time', 'Quietmode_on_off', 'Previous_Quiet_Mode_Level',
    'PowerfulMode', 'HolidayMode',
    'Sterilization_active', 'Sterilization_Temp', 'SetForceSterilization',
    'SolarFunction_active',
    'Correction_0_WAR_on_off', 'Correction_1_RTC_on_off', 'Correction_2_softstart_on_off'
];
for (const s of SCALARS) {
    const v = (global.get(s, 'file') !== undefined) ? global.get(s, 'file') : global.get(s);
    flat['nr.' + s] = (v === undefined || v === null) ? 'unset' : v;
}

for (const [prefix, varName] of Object.entries(OBJECTS)) {
    try {
        const o = global.get(varName, 'file');
        if (o !== undefined) flatten(prefix, o, flat);
    } catch (e) { /* object not initialised yet */ }
}

// ---------- publish ----------
const seen = context.get('seen') || {};
const msgs = [];

for (const key of Object.keys(flat)) {
    const v = flat[key];
    if (v === null || v === undefined) continue;
    if (fast && !FAST.test(key)) continue;   // fast tick only publishes state-like keys

    const topic = STATE_BASE + '/' + key;
    const payload = typeof v === 'object' ? JSON.stringify(v) : String(v);

    // discovery config once per key per Node-RED restart
    if (!seen[key]) {
        seen[key] = true;
        const uid = key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        msgs.push({
            topic: DISC_BASE + '/' + uid + '/config',
            payload: JSON.stringify({
                name: 'NR ' + key,
                unique_id: 'heishamon_nr_' + uid,
                state_topic: topic,
                retain: true,
                device: {
                    identifiers: ['heishamon_nr_flow'],
                    name: 'HeishaMon NR Flow',
                    manufacturer: 'HeishaMoNR bridge'
                }
            }),
            retain: true, qos: 1
        });
    }
    msgs.push({ topic: topic, payload: payload, retain: true, qos: 0 });
}

context.set('seen', seen);

// ---------- dashboard status (v2.0.1, output 2) ----------
const nState = msgs.filter(m => String(m.topic).indexOf('/config') === -1).length;
const now = new Date();
const pad = (x) => String(x).padStart(2, '0');
const at = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
const stats = global.get('HAB_stats') || {};
if (fast) { stats.fast = { n: nState, at: at }; } else { stats.full = { n: nState, at: at }; }
global.set('HAB_stats', stats);

return [msgs, { payload: stats }];
