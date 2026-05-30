/**
 * ThingsBoard Debug Sensor Panel
 * 传感器调试控制台 — 覆盖模拟器数据，快速触发联动
 */

var DEVICE_ID = '2d415ac0-5803-11f1-928b-253a5007835b';
var els = {};
var currentOverrides = {};

function setStatus(text, isError) {
    if (els.status) {
        els.status.textContent = text;
        els.status.className = 'dbg-status' + (isError ? ' dbg-err' : ' dbg-ok');
    }
}

function sendRpc(method, params) {
    if (!self.ctx || !self.ctx.http) {
        console.warn('[Debug] http not available');
        setStatus('HTTP 不可用', true);
        return;
    }
    console.log('[Debug] ' + method, params);
    self.ctx.http.post('/api/rpc/oneway/' + DEVICE_ID, {
        method: method,
        params: params
    }).subscribe(
        function() {
            setStatus('成功: ' + method);
            console.log('[Debug] OK: ' + method);
        },
        function(err) {
            setStatus('失败: ' + method, true);
            console.error('[Debug] FAIL: ' + method, err);
        }
    );
}

function cacheElements(container) {
    var q = function(s) { return container.querySelector(s); };
    els = {
        slider: q('#dbg-soilHumidity'),
        value: q('#dbg-val-soilHumidity'),
        status: q('#dbg-status'),
        applyBtns: container.querySelectorAll('.dbg-btn-apply'),
        clearBtns: container.querySelectorAll('.dbg-btn-clear'),
        clearAllBtn: q('.dbg-btn-clear-all')
    };
}

self.onInit = function() {
    console.log('[Debug Panel] Initializing...');
    var $el = self.ctx.$container[0] || self.ctx.$container;
    cacheElements($el);

    // Slider value display
    if (els.slider && els.value) {
        els.slider.addEventListener('input', function() {
            els.value.textContent = this.value;
        });
    }

    // Apply button: send setDebugSensor RPC
    for (var i = 0; i < els.applyBtns.length; i++) {
        els.applyBtns[i].addEventListener('click', function() {
            var key = this.dataset.key;
            var val = parseFloat(document.getElementById('dbg-' + key).value);
            sendRpc('setDebugSensor', { key: key, value: val });
            currentOverrides[key] = val;
            console.log('[Debug] Override ' + key + ' = ' + val);
        });
    }

    // Clear button: send clearDebugSensor RPC
    for (var j = 0; j < els.clearBtns.length; j++) {
        els.clearBtns[j].addEventListener('click', function() {
            var key = this.dataset.key;
            sendRpc('clearDebugSensor', { key: key });
            delete currentOverrides[key];
            console.log('[Debug] Clear ' + key);
        });
    }

    // Clear all button
    if (els.clearAllBtn) {
        els.clearAllBtn.addEventListener('click', function() {
            sendRpc('clearAllDebugSensors', {});
            currentOverrides = {};
            console.log('[Debug] Clear all');
        });
    }

    setStatus('就绪');
    console.log('[Debug Panel] Ready');
};

self.onDataUpdated = function() {
    // Read current soilHumidity from telemetry to sync slider
    if (!self.ctx || !self.ctx.data || !els.slider) return;
    for (var i = 0; i < self.ctx.data.length; i++) {
        var dk = self.ctx.data[i];
        if (dk.dataKey && dk.dataKey.name === 'soilHumidity' && dk.data && dk.data.length > 0) {
            var last = dk.data[dk.data.length - 1];
            var val = parseFloat(last.length > 1 ? last[1] : last[0]);
            if (!isNaN(val) && !currentOverrides['soilHumidity']) {
                els.slider.value = Math.round(val);
                if (els.value) els.value.textContent = Math.round(val);
            }
        }
    }
};

self.onDestroy = function() {
    console.log('[Debug Panel] Destroyed');
};
