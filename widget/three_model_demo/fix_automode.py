"""Apply autoMode rpcPending fix + diagnostic logging to rolled-back JS."""
import re

path = 'D:/Projects/thingsboard-smart-greenhouse/widget/three_model_demo/thingsboard/full_scene_3d_merged.js'
with open(path, 'r', encoding='utf-8') as f:
    js = f.read()

# 1: Add rpcPending variable after debugLockUntil
old1 = 'let debugSliding = {};\nlet debugLockUntil = {};\n'
new1 = 'let debugSliding = {};\nlet debugLockUntil = {};\nlet rpcPending = {};\n'
js = js.replace(old1, new1)
print('[OK] Added rpcPending')

# 2: Add mergeTelemetryWithPending function after the variable block
mergeFunc = '''
// ========== RPC Pending 合并 ==========
function mergeTelemetryWithPending(data) {
  var merged = {};
  for (var k in data) { if (data.hasOwnProperty(k)) merged[k] = data[k]; }
  var now = Date.now();
  var execKeys = ['autoMode', 'fanStatus', 'pumpStatus', 'lampStatus', 'sprayStatus'];
  for (var i = 0; i < execKeys.length; i++) {
    var key = execKeys[i];
    var pending = rpcPending[key];
    if (!pending) continue;
    if (merged[key] === pending.value) {
      console.log('[RPC CONFIRMED] ' + key + '=' + pending.value + ' (delay ' + (now - pending.startedAt) + 'ms)');
      delete rpcPending[key];
    } else if (now - pending.startedAt > 10000) {
      console.warn('[RPC TIMEOUT] ' + key + ' expected=' + pending.value + ' got=' + merged[key]);
      delete rpcPending[key];
    } else {
      console.log('[RPC PENDING] keep ' + key + '=' + pending.value + ' (incoming=' + merged[key] + ')');
      merged[key] = pending.value;
    }
  }
  return merged;
}
'''
# Insert after historyBuffer block
marker2 = "const historyBuffer = {"
pos2 = js.find(marker2)
if pos2 > 0:
    # Find end of historyBuffer declaration
    end = js.find('};', pos2)
    js = js[:end+2] + '\n' + mergeFunc + js[end+2:]
    print('[OK] Added mergeTelemetryWithPending')
else:
    print('[WARN] historyBuffer not found')

# 3: Fix updateDashboard to use mergeTelemetryWithPending
old3 = 'function updateDashboard(data) {\n    currentData = data;'
if old3 in js:
    new3 = '''function updateDashboard(data) {
    console.log('[TELEMETRY IN] autoMode=' + data.autoMode + ' soil=' + data.soilHumidity + ' fan=' + data.fanStatus + ' spray=' + data.sprayStatus + ' | pending=' + JSON.stringify(Object.keys(rpcPending)));
    currentData = mergeTelemetryWithPending(data);
    console.log('[DASHBOARD AFTER MERGE] autoMode=' + currentData.autoMode + ' | pending=' + JSON.stringify(Object.keys(rpcPending)));'''
    js = js.replace(old3, new3)
    print('[OK] Fixed updateDashboard')
else:
    print('[WARN] updateDashboard not matched')

# 4: Fix control button click handler
old4 = "            var rpcMethod = this.dataset.rpc;\n            var dataKey = this.dataset.key;\n            // Toggle: if currently ON, send false; if OFF, send true\n            var currentOn = currentData[dataKey];\n            var newValue = !currentOn;\n            // Optimistic UI update: immediately reflect the toggle\n            currentData[dataKey] = newValue;\n            updateControlPanel(currentData);\n            sendRpc(rpcMethod, newValue);\n            console.log('[Ctrl] Click: ' + rpcMethod + '(' + newValue + '), current ' + dataKey + '=' + currentOn);"
new4 = """            var rpcMethod = this.dataset.rpc;
            var dataKey = this.dataset.key;
            var currentOn = currentData[dataKey];
            var newValue = !currentOn;
            console.log('[AUTO CLICK] key=' + dataKey + ' before=' + currentOn + ' next=' + newValue + ' time=' + Date.now());
            if (dataKey === 'autoMode') {
              console.log('[AUTO DEBUG] === autoMode click: ' + currentOn + ' -> ' + newValue + ' ===');
            }
            currentData[dataKey] = newValue;
            rpcPending[dataKey] = { value: newValue, startedAt: Date.now() };
            updateControlPanel(currentData);
            sendRpc(rpcMethod, newValue);
            console.log('[RPC SEND] ' + rpcMethod + '=' + newValue + ' time=' + Date.now());"""
if old4 in js:
    js = js.replace(old4, new4)
    print('[OK] Fixed click handler + added RPC pending')
else:
    print('[WARN] click handler not matched')

# 5: Add stopPropagation + logs to debug slider change handler
old5 = "            slider.addEventListener('change', function() {\n                debugSliding[key] = false;\n                var val = parseFloat(this.value);\n                sendRpc('setDebugSensor', { key: key, value: val });\n                // 锁定 2 秒防旧遥测回写（0.5s 间隔够了）\n                debugLockUntil[key] = Date.now() + 2000;\n                if (els.dbgStatus) {\n                    els.dbgStatus.textContent = '✓ ' + key + '=' + val.toFixed(decimals) + unit;\n                    els.dbgStatus.className = 'tb-debug-status ok';\n                }\n            });"
new5 = """            slider.addEventListener('pointerdown', function(e) { e.stopPropagation(); debugSliding[key] = true; });
            slider.addEventListener('pointerup', function(e) { e.stopPropagation(); debugSliding[key] = false; });
            slider.addEventListener('input', function(e) { e.stopPropagation(); });
            slider.addEventListener('change', function(e) {
                e.stopPropagation();
                debugSliding[key] = false;
                var val = parseFloat(this.value);
                console.log('[DEBUG SENSOR SEND] key=' + key + ' val=' + val + ' | autoMode NOT sent');
                sendRpc('setDebugSensor', { key: key, value: val });
                debugLockUntil[key] = Date.now() + 2000;
                if (els.dbgStatus) {
                    els.dbgStatus.textContent = '✓ ' + key + '=' + val.toFixed(decimals) + unit;
                    els.dbgStatus.className = 'tb-debug-status ok';
                }
            });"""
if old5 in js:
    js = js.replace(old5, new5)
    print('[OK] Added stopPropagation to slider events')
else:
    print('[WARN] slider handler not matched')

with open(path, 'w', encoding='utf-8') as f:
    f.write(js)
print(f'Final JS: {len(js)} chars')
