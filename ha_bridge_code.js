// Standalone copy of the function node code from ha-bridge-flow.json
// (kept in the repo for easy reading / diffing; edit the flow via Node-RED import)

// HA BRIDGE for HeishaMoNR (c) placed in a separate tab, does not touch Ed's logic.
// Reads the flow's own settings objects (global, file storage) and publishes
// every value to MQTT. Also sends Home Assistant MQTT discovery configs once,
// so entities appear automatically (device: "HeishaMon NR Flow").
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
    pump:  'F_ReducePumpSpeed'
};

// "fast" poll (60 s): keys that look like live state / triggers
const FAST = /state|power|setpoint|active|on_off/i;

const fast = (msg.topic === 'fast');

// ---------- flatten ----------
function flatten(prefix, obj, out) {
    if (obj === null || obj === undefined) return out;
    if (typeof obj !== 'object') { out[prefix] = obj; return out; }
    for (const k of Object.keys(obj)) { flatten(prefix + '.' + k, obj[k], out); }
    return out;
}

const flat = {};

// Plain scalar globals (readback / runtime state, not in F_ objects)
const SCALARS = [
    'TOP97_Heater_Start_Delta',      // J-series: factory −3 (readback = proof)
    'TOP98_Heater_Stop_Delta',       // factory −1
    'TOP96_Heater_Delay_Time',       // factory 30 min
    'TOP94_Zones_State',
    'TOP99_Buffer_Installed',
    'T_zone_1', 'T_zone_2',
    'VirtualState',
    'Force_DHW_active',
    'F_stored_next_operating_mode'
];
for (const s of SCALARS) {
    const v = (global.get(s, 'file') !== undefined) ? global.get(s, 'file') : global.get(s);
    if (v !== undefined && v !== null) flat['nr.' + s] = v;
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
const now = Date.now();
let newSeen = false;

for (const key of Object.keys(flat)) {
    const v = flat[key];
    if (v === null || v === undefined) continue;
    if (fast && !FAST.test(key)) continue;   // fast tick only publishes state-like keys

    const topic = STATE_BASE + '/' + key;
    const payload = typeof v === 'object' ? JSON.stringify(v) : String(v);

    // discovery config once per key per Node-RED restart
    if (!seen[key]) {
        seen[key] = true; newSeen = true;
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
return [msgs];
