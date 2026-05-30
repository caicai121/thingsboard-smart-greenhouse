/**
 * 智慧农业大棚数字孪生监控 - ThingsBoard Custom Widget
 *
 * 适配 ThingsBoard CE 4.3.0.1 Custom Widget
 * 从 ctx.data 读取遥测数据，驱动大棚场景动画
 */

// ========== 配置区 ==========
const CONFIG = {
    // 图片 URL 配置 - 请根据实际情况修改
    // 方案1：放在 ThingsBoard 服务器静态目录
    // dayImage: '/static/greenhouse_day.png',
    // nightImage: '/static/greenhouse_night.png',

    // 方案2：独立静态文件服务器
    // dayImage: 'http://192.168.161.130:9000/greenhouse_day.png',
    // nightImage: 'http://192.168.161.130:9000/greenhouse_night.png',

    // 方案：Windows 本地静态服务器
    dayImage: 'http://192.168.161.1:9000/greenhouse_day.png',
    nightImage: 'http://192.168.161.1:9000/greenhouse_night.png',

    // 是否启用演示模式（显示左下角按钮）
    demoMode: false,

    // 是否显示演示场景按钮
    showDemoButtons: false,

    // 数据刷新间隔 (ms)
    refreshInterval: 3000,

    // 历史数据缓存最大点数
    historyMaxPoints: 60
};

// ========== 折线图配置 ==========
const chartConfigs = {
    'tempHumidity': {
        svgId: 'svg-tempHumidity',
        series: ['temperature', 'airHumidity', 'soilHumidity'],
        colors: ['#ff6b6b', '#4ecdc4', '#d4a574'],
        yMin: [10, 0, 0],
        yMax: [45, 100, 100],
        labels: ['温度 °C', '空气湿度 %', '土壤湿度 %']
    },
    'light': {
        svgId: 'svg-light',
        series: ['outsideLight', 'lightIntensity'],
        colors: ['#ffe66d', '#ff9500'],
        yMin: [0, 0],
        yMax: [1200, 1500],
        labels: ['外界光照 lux', '棚内光照 lux']
    },
    'waterCo2': {
        svgId: 'svg-waterCo2',
        series: ['waterLevel', 'co2'],
        colors: ['#00d9ff', '#b0b0b0'],
        yMin: [0, 300],
        yMax: [100, 2000],
        labels: ['水位 %', 'CO₂ ppm']
    }
};

// ========== Mock 演示数据 ==========
const mockScenarios = {
    normalDay: {
        temperature: 24.8, airHumidity: 49.3, soilHumidity: 43.0,
        outsideLight: 600, lightIntensity: 600, co2: 641, waterLevel: 80,
        hourOfDay: 12,
        fanStatus: false, pumpStatus: false, lampStatus: false,
        sprayStatus: false, autoMode: false,
        soilAlarm: false, tempAlarm: false, waterAlarm: false, co2Alarm: false
    },
    nightLamp: {
        temperature: 22.5, airHumidity: 58.0, soilHumidity: 45.0,
        outsideLight: 0, lightIntensity: 300, co2: 620, waterLevel: 78,
        hourOfDay: 2,
        fanStatus: false, pumpStatus: false, lampStatus: true,
        sprayStatus: false, autoMode: true,
        soilAlarm: false, tempAlarm: false, waterAlarm: false, co2Alarm: false
    },
    irrigation: {
        temperature: 27.5, airHumidity: 52.0, soilHumidity: 22.0,
        outsideLight: 500, lightIntensity: 500, co2: 700, waterLevel: 75,
        hourOfDay: 14,
        fanStatus: false, pumpStatus: true, lampStatus: false,
        sprayStatus: true, autoMode: true,
        soilAlarm: true, tempAlarm: false, waterAlarm: false, co2Alarm: false
    },
    lowWater: {
        temperature: 28.0, airHumidity: 50.0, soilHumidity: 20.0,
        outsideLight: 500, lightIntensity: 500, co2: 690, waterLevel: 10,
        hourOfDay: 15,
        fanStatus: false, pumpStatus: false, lampStatus: false,
        sprayStatus: false, autoMode: true,
        soilAlarm: true, tempAlarm: false, waterAlarm: true, co2Alarm: false
    }
};

// ========== 状态变量 ==========
let sceneMode = 'day';
let currentScenario = 'normalDay';
let currentData = {};
let demoMode = false;
let currentPage = 'scene';
let els = {};
let refreshTimer = null;
let debugSliding = {};
let debugLockUntil = {};

// 历史数据缓存（用于第 2 页折线图）
const historyBuffer = {
    temperature: [],
    airHumidity: [],
    soilHumidity: [],
    outsideLight: [],
    lightIntensity: [],
    waterLevel: [],
    co2: []
};

// ========== 从 ThingsBoard 读取数据 ==========
function getLatestValue(ctx, key, defaultValue) {
    if (!ctx || !ctx.data) return defaultValue;

    for (const item of ctx.data) {
        if (item.dataKey && item.dataKey.name === key) {
            if (item.data && item.data.length > 0) {
                const lastEntry = item.data[item.data.length - 1];
                return lastEntry.length > 1 ? lastEntry[1] : defaultValue;
            }
        }
    }
    return defaultValue;
}

function parseBool(value) {
    return value === true || value === 'true' || value === 1 || value === '1' || value === 'True';
}

function readTelemetryData(ctx) {
    return {
        temperature: Number(getLatestValue(ctx, 'temperature', 0)),
        airHumidity: Number(getLatestValue(ctx, 'airHumidity', 0)),
        soilHumidity: Number(getLatestValue(ctx, 'soilHumidity', 0)),
        outsideLight: Number(getLatestValue(ctx, 'outsideLight', 0)),
        lightIntensity: Number(getLatestValue(ctx, 'lightIntensity', 0)),
        co2: Number(getLatestValue(ctx, 'co2', 0)),
        waterLevel: Number(getLatestValue(ctx, 'waterLevel', 0)),
        hourOfDay: Number(getLatestValue(ctx, 'hourOfDay', 12)),
        fanStatus: parseBool(getLatestValue(ctx, 'fanStatus', false)),
        pumpStatus: parseBool(getLatestValue(ctx, 'pumpStatus', false)),
        lampStatus: parseBool(getLatestValue(ctx, 'lampStatus', false)),
        sprayStatus: parseBool(getLatestValue(ctx, 'sprayStatus', false)),
        autoMode: parseBool(getLatestValue(ctx, 'autoMode', false)),
        soilAlarm: parseBool(getLatestValue(ctx, 'soilAlarm', false)),
        tempAlarm: parseBool(getLatestValue(ctx, 'tempAlarm', false)),
        waterAlarm: parseBool(getLatestValue(ctx, 'waterAlarm', false)),
        co2Alarm: parseBool(getLatestValue(ctx, 'co2Alarm', false))
    };
}

// ========== 动态生成喷淋粒子 ==========
function createSprayParticles(container, lineCount, particleCount) {
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < lineCount; i++) {
        const line = document.createElement('span');
        line.className = 'tb-water-line';
        line.style.setProperty('--angle', `${-65 + Math.random() * 130}deg`);
        line.style.setProperty('--length', `${28 + Math.random() * 22}%`);
        line.style.setProperty('--delay', `${Math.random() * 0.8}s`);
        line.style.setProperty('--x-offset', `${-6 + Math.random() * 12}px`);
        container.appendChild(line);
    }

    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('span');
        p.className = 'tb-water-particle';
        p.style.setProperty('--angle', `${-70 + Math.random() * 140}deg`);
        p.style.setProperty('--distance', `${90 + Math.random() * 180}px`);
        p.style.setProperty('--delay', `${Math.random() * 1.2}s`);
        p.style.setProperty('--size', `${1 + Math.random() * 2.5}px`);
        container.appendChild(p);
    }
}

// ========== 缓存 DOM 元素 ==========
function cacheElements(container) {
    const q = (s) => container.querySelector(s);
    els = {
        bgDay: q('.tb-day-bg'),
        bgNight: q('.tb-night-bg'),
        stage: q('.tb-greenhouse-stage'),

        lampGlowLeftMain: q('.tb-lamp-glow-left-main'),
        lampGlowRightMain: q('.tb-lamp-glow-right-main'),
        lampGlowLeftMid: q('.tb-lamp-glow-left-mid'),
        lampGlowRightMid: q('.tb-lamp-glow-right-mid'),

        fanEffectLeft: q('.tb-fan-effect-left'),
        fanEffectRight: q('.tb-fan-effect-right'),
        fanEffectLeftBack: q('.tb-fan-effect-left-back'),
        fanEffectRightBack: q('.tb-fan-effect-right-back'),

        sprayLeftFront: q('.tb-spray-left-front'),
        sprayLeftMid: q('.tb-spray-left-mid'),
        sprayRightMid: q('.tb-spray-right-mid'),
        sprayRightFront: q('.tb-spray-right-front'),

        pipeFlowLeft: q('.tb-pipe-flow-left'),
        pipeFlowRight: q('.tb-pipe-flow-right'),

        soilWarningArea: q('.tb-soil-warning-area'),
        centerTag: q('.tb-center-tag'),

        valTemp: q('.tb-val-temp'),
        valHum: q('.tb-val-hum'),
        valSoil: q('.tb-val-soil'),
        valLight: q('.tb-val-light'),
        valCO2: q('.tb-val-co2'),
        valWater: q('.tb-val-water'),
        waterLevelFill: q('.tb-water-level-fill'),

        cardTemp: q('.tb-card-temp'),
        cardHum: q('.tb-card-hum'),
        cardSoil: q('.tb-card-soil'),
        cardLight: q('.tb-card-light'),
        cardCO2: q('.tb-card-co2'),
        cardWater: q('.tb-card-water'),

        alarmSoil: q('.tb-alarm-soil'),
        textAlarmSoil: q('.tb-text-alarm-soil'),
        alarmTemp: q('.tb-alarm-temp'),
        textAlarmTemp: q('.tb-text-alarm-temp'),
        alarmWater: q('.tb-alarm-water'),
        textAlarmWater: q('.tb-text-alarm-water'),
        alarmCO2: q('.tb-alarm-co2'),
        textAlarmCO2: q('.tb-text-alarm-co2'),

        ledFan: q('.tb-led-fan'),
        stateFan: q('.tb-state-fan'),
        ledPump: q('.tb-led-pump'),
        statePump: q('.tb-state-pump'),
        ledLamp: q('.tb-led-lamp'),
        stateLamp: q('.tb-state-lamp'),
        ledSpray: q('.tb-led-spray'),
        stateSpray: q('.tb-state-spray'),
        ledAuto: q('.tb-led-auto'),
        stateAuto: q('.tb-state-auto'),

        headerMode: q('.tb-header-mode'),
        clock: q('.tb-clock'),

        ctrlBtns: container.querySelectorAll('.tb-ctrl-btn'),
        ctrlFan: q('.tb-ctrl-fan'),
        ctrlPump: q('.tb-ctrl-pump'),
        ctrlLamp: q('.tb-ctrl-lamp'),
        ctrlSpray: q('.tb-ctrl-spray'),
        ctrlAuto: q('.tb-ctrl-auto'),

        // Debug panel
        debugPanel: q('.tb-debug-panel'),
        debugToggle: q('#tb-debug-toggle'),
        debugBody: q('#tb-debug-body'),
        dbgStatus: q('#dbg-status'),
        dbgLiveSliders: container.querySelectorAll('.dbg-slider-live')
    };

    // 初始化喷淋粒子（限制在当前容器内，避免污染其他 widget）
    container.querySelectorAll('.tb-spray-effect').forEach(el => {
        createSprayParticles(el, 45, 70);
    });
}

// ========== 更新背景 ==========
function applySceneMode(mode) {
    sceneMode = mode;
    if (!els.stage) return;
    if (mode === 'day') {
        els.bgDay.classList.add('active');
        els.bgNight.classList.remove('active');
        els.stage.classList.add('day-mode');
        els.stage.classList.remove('night-mode');
    } else {
        els.bgDay.classList.remove('active');
        els.bgNight.classList.add('active');
        els.stage.classList.add('night-mode');
        els.stage.classList.remove('day-mode');
    }
}

// ========== 更新数据面板 ==========
function updateDataPanel(data) {
    if (!els.valTemp) return;

    els.valTemp.textContent = data.temperature.toFixed(1);
    els.valHum.textContent = data.airHumidity.toFixed(1);
    els.valSoil.textContent = data.soilHumidity.toFixed(1);
    els.valLight.textContent = Math.round(data.lightIntensity);
    els.valCO2.textContent = Math.round(data.co2);
    els.valWater.textContent = data.waterLevel.toFixed(1);

    if (els.waterLevelFill) {
        els.waterLevelFill.style.width = data.waterLevel + '%';
        els.waterLevelFill.classList.toggle('tb-low', data.waterLevel < 20);
    }

    updateCardStatus(els.cardTemp, data.temperature, 32, 38);
    updateCardStatus(els.cardHum, data.airHumidity, null, null);
    updateCardStatus(els.cardSoil, data.soilHumidity, null, 30);
    updateCardStatus(els.cardLight, data.lightIntensity, null, null);
    updateCardStatus(els.cardCO2, data.co2, 1000, 1500);
    updateCardStatus(els.cardWater, data.waterLevel, null, 20);
}

function updateCardStatus(card, value, warnThreshold, dangerThreshold) {
    if (!card) return;
    card.classList.remove('tb-warning', 'tb-danger');
    if (dangerThreshold !== null && value < dangerThreshold) {
        card.classList.add('tb-danger');
    } else if (warnThreshold !== null && value > warnThreshold) {
        card.classList.add('tb-warning');
    }
}

// ========== 更新报警面板 ==========
function updateAlarms(data) {
    updateAlarmRow(els.alarmSoil, els.textAlarmSoil, data.soilAlarm, '土壤干旱');
    updateAlarmRow(els.alarmTemp, els.textAlarmTemp, data.tempAlarm, '温度过高');
    updateAlarmRow(els.alarmWater, els.textAlarmWater, data.waterAlarm, '水位过低');
    updateAlarmRow(els.alarmCO2, els.textAlarmCO2, data.co2Alarm, 'CO₂过高');
}

function updateAlarmRow(row, textEl, isAlert, alertText) {
    if (!row) return;
    row.classList.toggle('tb-alert', isAlert);
    if (textEl) textEl.textContent = isAlert ? alertText : '正常';
}

// ========== 更新底部状态条 ==========
function updateBottomBar(data) {
    updateDeviceStatus(els.ledFan, els.stateFan, data.fanStatus, '运行', '停止', 'tb-on');
    updateDeviceStatus(els.ledPump, els.statePump, data.pumpStatus, '运行', '停止', 'tb-on-blue');
    updateDeviceStatus(els.ledLamp, els.stateLamp, data.lampStatus, '开启', '关闭', 'tb-on-yellow');
    updateDeviceStatus(els.ledSpray, els.stateSpray, data.sprayStatus, '运行', '停止', 'tb-on-cyan');
    updateDeviceStatus(els.ledAuto, els.stateAuto, data.autoMode, '自动', '手动', 'tb-on-orange');
}

function updateDeviceStatus(led, state, isOn, onText, offText, onClass) {
    if (!led) return;
    led.className = 'tb-device-led';
    if (isOn) {
        led.classList.add(onClass);
        if (state) { state.textContent = onText; state.classList.add('tb-on'); }
    } else {
        if (state) { state.textContent = offText; state.classList.remove('tb-on'); }
    }
}

// ========== 更新头部 ==========
function updateHeader(data) {
    if (els.headerMode) {
        els.headerMode.textContent = data.autoMode ? '自动模式' : '手动模式';
        els.headerMode.className = 'tb-stat-value' + (data.autoMode ? ' tb-status-online' : '');
    }
}

// ========== 更新特效 ==========
function updateEffects(data) {
    const isNight = sceneMode === 'night';

    // 补光灯
    const lampOn = data.lampStatus;
    [els.lampGlowLeftMain, els.lampGlowRightMain,
     els.lampGlowLeftMid, els.lampGlowRightMid].forEach(el => {
        if (!el) return;
        el.classList.toggle('active', lampOn);
        el.style.opacity = lampOn ? (isNight ? '0.9' : '0.6') : '0';
    });

    // 风扇
    if (els.fanEffectLeft) els.fanEffectLeft.classList.toggle('active', data.fanStatus);
    if (els.fanEffectRight) els.fanEffectRight.classList.toggle('active', data.fanStatus);
    if (els.fanEffectLeftBack) els.fanEffectLeftBack.classList.toggle('active', data.fanStatus);
    if (els.fanEffectRightBack) els.fanEffectRightBack.classList.toggle('active', data.fanStatus);

    // 喷淋
    if (els.sprayLeftFront) els.sprayLeftFront.classList.toggle('active', data.sprayStatus);
    if (els.sprayLeftMid) els.sprayLeftMid.classList.toggle('active', data.sprayStatus);
    if (els.sprayRightMid) els.sprayRightMid.classList.toggle('active', data.sprayStatus);
    if (els.sprayRightFront) els.sprayRightFront.classList.toggle('active', data.sprayStatus);

    // 管道
    if (els.pipeFlowLeft) els.pipeFlowLeft.classList.toggle('active', data.pumpStatus);
    if (els.pipeFlowRight) els.pipeFlowRight.classList.toggle('active', data.pumpStatus);

    // 土壤告警
    const soilAlert = data.soilAlarm || data.soilHumidity < 30;
    if (els.soilWarningArea) els.soilWarningArea.classList.toggle('active', soilAlert);

    // 中央标签
    const texts = [];
    if (data.autoMode) texts.push('自动模式运行中');
    if (data.sprayStatus) texts.push('灌溉系统运行中');
    if (data.pumpStatus) texts.push('水泵运行中');
    if (els.centerTag) {
        if (texts.length > 0) {
            els.centerTag.setAttribute('data-text', texts[0]);
            els.centerTag.classList.add('active');
        } else {
            els.centerTag.classList.remove('active');
        }
    }
}

// ========== RPC 控制 ==========
var DEVICE_ID = '2d415ac0-5803-11f1-928b-253a5007835b';

function sendRpc(method, value) {
    if (!self.ctx || !self.ctx.http) {
        console.warn('[RPC] http service not available');
        return;
    }
    console.log('[RPC] ' + method + ' = ' + value);
    self.ctx.http.post('/api/rpc/oneway/' + DEVICE_ID, {
        method: method,
        params: value
    }).subscribe(
        function() {},
        function(err) { console.error('[RPC] FAIL:', err); }
    );
}

// ========== 历史数据缓存 ==========
function pushHistory(data) {
    var keys = ['temperature', 'airHumidity', 'soilHumidity', 'outsideLight', 'lightIntensity', 'waterLevel', 'co2'];
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (!historyBuffer[key]) historyBuffer[key] = [];
        historyBuffer[key].push(parseFloat(data[key]) || 0);
        if (historyBuffer[key].length > CONFIG.historyMaxPoints) {
            historyBuffer[key].shift();
        }
    }
}

// ========== SVG 折线图绘制 ==========
function drawChart(chartKey) {
    var cfg = chartConfigs[chartKey];
    if (!cfg) return;
    var svg = document.getElementById(cfg.svgId);
    if (!svg) return;

    // 清空 SVG
    svg.innerHTML = '';

    var vbW = 800, vbH = 200;
    var margin = { top: 12, right: 30, bottom: 20, left: 38 };
    var plotW = vbW - margin.left - margin.right;
    var plotH = vbH - margin.top - margin.bottom;

    // 背景网格
    var gridCount = 4;
    for (var g = 0; g <= gridCount; g++) {
        var gy = margin.top + (plotH / gridCount) * g;
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', margin.left);
        line.setAttribute('y1', gy);
        line.setAttribute('x2', vbW - margin.right);
        line.setAttribute('y2', gy);
        line.setAttribute('class', 'tb-chart-grid-line');
        svg.appendChild(line);
    }

    // 边框轴线
    var axTop = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axTop.setAttribute('x1', margin.left); axTop.setAttribute('y1', margin.top);
    axTop.setAttribute('x2', margin.left); axTop.setAttribute('y2', vbH - margin.bottom);
    axTop.setAttribute('class', 'tb-chart-axis');
    svg.appendChild(axTop);

    var axBot = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axBot.setAttribute('x1', margin.left); axBot.setAttribute('y1', vbH - margin.bottom);
    axBot.setAttribute('x2', vbW - margin.right); axBot.setAttribute('y2', vbH - margin.bottom);
    axBot.setAttribute('class', 'tb-chart-axis');
    svg.appendChild(axBot);

    // 绘制每条数据线
    for (var s = 0; s < cfg.series.length; s++) {
        var key = cfg.series[s];
        var data = historyBuffer[key];
        if (!data || data.length < 2) continue;

        var yMin = cfg.yMin[s];
        var yMax = cfg.yMax[s];
        var yRange = yMax - yMin;
        if (yRange <= 0) yRange = 1;

        // 构建 polyline 点
        var points = [];
        for (var p = 0; p < data.length; p++) {
            var x = margin.left + (p / (CONFIG.historyMaxPoints - 1)) * plotW;
            var yNorm = (data[p] - yMin) / yRange;
            yNorm = Math.max(0, Math.min(1, yNorm));
            var y = margin.top + plotH - yNorm * plotH;
            points.push(x.toFixed(1) + ',' + y.toFixed(1));
        }

        // 折线
        var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        poly.setAttribute('points', points.join(' '));
        poly.setAttribute('class', 'tb-chart-line');
        poly.setAttribute('stroke', cfg.colors[s]);
        svg.appendChild(poly);

        // 末端数据点
        var lastX = margin.left + ((data.length - 1) / (CONFIG.historyMaxPoints - 1)) * plotW;
        var lastYNorm = (data[data.length - 1] - yMin) / yRange;
        lastYNorm = Math.max(0, Math.min(1, lastYNorm));
        var lastY = margin.top + plotH - lastYNorm * plotH;
        var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', lastX);
        dot.setAttribute('cy', lastY);
        dot.setAttribute('r', '3');
        dot.setAttribute('class', 'tb-chart-dot');
        dot.setAttribute('fill', cfg.colors[s]);
        svg.appendChild(dot);
    }

    // Y 轴标签 (左轴显示第一个系列范围)
    if (cfg.series.length > 0) {
        for (var gl = 0; gl <= gridCount; gl++) {
            var yVal = cfg.yMin[0] + (cfg.yMax[0] - cfg.yMin[0]) * (1 - gl / gridCount);
            var labelY = margin.top + (plotH / gridCount) * gl;
            var txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', margin.left - 4);
            txt.setAttribute('y', labelY + 3);
            txt.setAttribute('class', 'tb-chart-label');
            txt.setAttribute('text-anchor', 'end');
            txt.textContent = Math.round(yVal);
            svg.appendChild(txt);
        }
    }
}

function updateAllCharts() {
    for (var ck in chartConfigs) {
        if (chartConfigs.hasOwnProperty(ck)) {
            drawChart(ck);
        }
    }
}

// ========== 数值格式化 ==========
function formatTrendValue(key, value) {
    var n = Number(value);
    if (isNaN(n)) return '--';
    if (key === 'temperature' || key === 'airHumidity' || key === 'soilHumidity' || key === 'waterLevel') {
        return n.toFixed(1);
    }
    if (key === 'outsideLight' || key === 'lightIntensity' || key === 'co2') {
        return Math.round(n).toString();
    }
    return n.toString();
}

// ========== 第 2 页摘要卡片 ==========
function updateSummaryCards(data) {
    var container = document.getElementById('tb-chart-summary');
    if (!container) return;
    var vals = container.querySelectorAll('.tb-summary-val');
    for (var i = 0; i < vals.length; i++) {
        var key = vals[i].dataset.key;
        if (key && data[key] !== undefined) {
            vals[i].textContent = formatTrendValue(key, data[key]);
        }
    }
}

// ========== 页面切换 ==========
function switchPage(targetPage) {
    if (currentPage === targetPage) return;
    currentPage = targetPage;

    var sceneLayer = document.querySelector('.tb-page-scene');
    var chartLayer = document.querySelector('.tb-page-chart');
    var arrowLeft = document.getElementById('tb-arrow-left');
    var arrowRight = document.getElementById('tb-arrow-right');
    var root = document.querySelector('.tb-app-container');

    if (targetPage === 'chart') {
        if (sceneLayer) { sceneLayer.classList.remove('active'); sceneLayer.classList.add('exit-left'); }
        if (chartLayer) { chartLayer.classList.add('active'); chartLayer.classList.remove('exit-left'); }
        if (arrowLeft) arrowLeft.style.display = '';
        if (arrowRight) arrowRight.style.display = 'none';
        if (root) { root.classList.add('tb-page-chart-active'); root.classList.remove('tb-page-scene-active'); }
    } else {
        if (chartLayer) { chartLayer.classList.remove('active'); chartLayer.classList.add('exit-left'); }
        if (sceneLayer) { sceneLayer.classList.add('active'); sceneLayer.classList.remove('exit-left'); }
        if (arrowLeft) arrowLeft.style.display = 'none';
        if (arrowRight) arrowRight.style.display = '';
        if (root) { root.classList.add('tb-page-scene-active'); root.classList.remove('tb-page-chart-active'); }
    }

    updatePageIndicator();
}

function updatePageIndicator() {
    var dots = document.querySelectorAll('.tb-page-dot');
    for (var i = 0; i < dots.length; i++) {
        var dp = dots[i].dataset.page;
        if (dp === currentPage) {
            dots[i].classList.add('active');
        } else {
            dots[i].classList.remove('active');
        }
    }
}

function updateControlPanel(data) {
    var ctrlStateMap = {
        'fanStatus':  { el: els.ctrlFan,  onText: '运行', offText: '停止' },
        'pumpStatus': { el: els.ctrlPump, onText: '运行', offText: '停止' },
        'lampStatus': { el: els.ctrlLamp, onText: '开启', offText: '关闭' },
        'sprayStatus':{ el: els.ctrlSpray,onText: '运行', offText: '停止' },
        'autoMode':   { el: els.ctrlAuto, onText: '自动', offText: '手动' }
    };

    for (var key in ctrlStateMap) {
        if (!ctrlStateMap.hasOwnProperty(key)) continue;
        var map = ctrlStateMap[key];
        if (!map.el) continue;
        var isOn = data[key];
        map.el.textContent = isOn ? map.onText : map.offText;

        // Update parent button active state
        var btn = map.el.closest('.tb-ctrl-btn');
        if (btn) {
            if (isOn) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }
}

function syncDebugSliders(data) {
    if (demoMode) return;
    var sensors = {
        'soilHumidity':  { unit: '%', decimals: 1 },
        'temperature':   { unit: '°C', decimals: 1 },
        'waterLevel':    { unit: '%', decimals: 1 },
        'co2':           { unit: '', decimals: 0 },
        'hourOfDay':     { unit: 'h', decimals: 1 },
        'outsideLight':  { unit: '', decimals: 0 }
    };
    for (var key in sensors) {
        if (!sensors.hasOwnProperty(key)) continue;
        // 用户正在拖拽或刚点了"应用"时不覆盖
        if (debugSliding[key]) continue;
        if (debugLockUntil[key] && Date.now() < debugLockUntil[key]) continue;
        var slider = document.getElementById('dbg-' + key);
        var display = document.getElementById('dbg-val-' + key);
        if (!slider) continue;
        var v = data[key];
        if (v === undefined || v === null) continue;
        v = parseFloat(v);
        if (isNaN(v)) continue;
        var d = sensors[key].decimals;
        slider.value = v.toFixed(d);
        if (display) display.textContent = v.toFixed(d) + sensors[key].unit;
    }
}

// ========== 主更新函数 ==========
function updateDashboard(data) {
    currentData = data;

    // 非演示模式下，根据时间自动切换昼夜背景
    if (!demoMode) {
        var h = data.hourOfDay !== undefined ? data.hourOfDay : 12;
        var newMode = (h >= 6 && h < 18) ? 'day' : 'night';
        if (newMode !== sceneMode) {
            applySceneMode(newMode);
        }
    }

    updateEffects(data);
    updateDataPanel(data);
    updateAlarms(data);
    updateBottomBar(data);
    updateHeader(data);
    updateControlPanel(data);
    syncDebugSliders(data);
}

// ========== 演示场景加载 ==========
function loadScene(sceneName) {
    if (sceneName === 'restore') {
        demoMode = false;
        currentScenario = 'live';
        // 重新读取真实遥测数据
        if (self.ctx && self.ctx.data) {
            const realData = readTelemetryData(self.ctx);
            updateDashboard(realData);
        }
        // 清除按钮高亮
        document.querySelectorAll('.tb-mock-btn').forEach(function(btn) {
            btn.classList.remove('active');
        });
        return;
    }

    var scenarioData = mockScenarios[sceneName];
    if (!scenarioData) return;

    demoMode = true;
    currentScenario = sceneName;

    // 只有 normalDay 和 nightLamp 显式改变背景
    // irrigation 和 lowWater 保持当前 day/night 状态不变
    if (sceneName === 'normalDay') {
        applySceneMode('day');
    } else if (sceneName === 'nightLamp') {
        applySceneMode('night');
    }

    var data = {};
    for (var key in scenarioData) {
        if (scenarioData.hasOwnProperty(key)) {
            data[key] = scenarioData[key];
        }
    }
    updateDashboard(data);

    // 高亮当前按钮
    document.querySelectorAll('.tb-mock-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.scene === sceneName);
    });
}

// ========== ThingsBoard Widget 生命周期 ==========

self.onInit = function() {
    console.log('[TB Widget] Greenhouse monitoring initializing...');

    // 缓存 DOM 元素（HTML 已由 ThingsBoard 从 HTML 标签页渲染到容器中）
    var $el = self.ctx.$container[0] || self.ctx.$container;
    cacheElements($el);

    // 设置图片 URL
    console.log('[Greenhouse] dayImage =', CONFIG.dayImage);
    console.log('[Greenhouse] nightImage =', CONFIG.nightImage);
    console.log('[Greenhouse] bgDay element =', els.bgDay);
    console.log('[Greenhouse] bgNight element =', els.bgNight);

    if (els.bgDay) {
        els.bgDay.src = CONFIG.dayImage;
        els.bgDay.onload = function() { console.log('[Greenhouse] day image loaded OK'); };
        els.bgDay.onerror = function() { console.error('[Greenhouse] day image FAILED'); };
    }
    if (els.bgNight) {
        els.bgNight.src = CONFIG.nightImage;
        els.bgNight.onload = function() { console.log('[Greenhouse] night image loaded OK'); };
        els.bgNight.onerror = function() { console.error('[Greenhouse] night image FAILED'); };
    }

    // 演示场景按钮：根据配置显示/隐藏
    var mockBtnsContainer = $el.querySelector('.tb-mock-buttons');
    if (mockBtnsContainer) {
        mockBtnsContainer.style.display = CONFIG.showDemoButtons ? '' : 'none';
    }

    // 绑定演示场景按钮（始终绑定，由 demoMode 控制行为）
    var btns = $el.querySelectorAll('.tb-mock-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function() {
            loadScene(this.dataset.scene);
        });
    }

    // 绑定设备控制按钮
    var ctrlBtns = $el.querySelectorAll('.tb-ctrl-btn');
    for (var j = 0; j < ctrlBtns.length; j++) {
        ctrlBtns[j].addEventListener('click', function() {
            var rpcMethod = this.dataset.rpc;
            var dataKey = this.dataset.key;
            // Toggle: if currently ON, send false; if OFF, send true
            var currentOn = currentData[dataKey];
            var newValue = !currentOn;
            // Optimistic UI update: immediately reflect the toggle
            currentData[dataKey] = newValue;
            updateControlPanel(currentData);
            sendRpc(rpcMethod, newValue);
            console.log('[Ctrl] Click: ' + rpcMethod + '(' + newValue + '), current ' + dataKey + '=' + currentOn);
        });
    }

    // 调试面板：折叠/展开
    if (els.debugToggle && els.debugPanel) {
        els.debugToggle.addEventListener('click', function() {
            els.debugPanel.classList.toggle('collapsed');
        });
    }

    // 调试面板：滑块拖拽显示 + 松手即发 RPC
    var debugUnitMap = { soilHumidity: '%', temperature: '°C', waterLevel: '%', co2: '', hourOfDay: 'h', outsideLight: '' };
    var debugDecimals = { soilHumidity: 1, temperature: 1, waterLevel: 1, co2: 0, hourOfDay: 1, outsideLight: 0 };
    for (var ds = 0; ds < els.dbgLiveSliders.length; ds++) {
        (function() {
            var slider = els.dbgLiveSliders[ds];
            var key = slider.dataset.key;
            var unit = debugUnitMap[key] || '';
            var decimals = debugDecimals[key] || 0;
            var display = document.getElementById('dbg-val-' + key);
            debugSliding[key] = false;

            slider.addEventListener('pointerdown', function() { debugSliding[key] = true; });
            slider.addEventListener('pointerup', function() { debugSliding[key] = false; });
            // 拖拽时实时更新显示
            slider.addEventListener('input', function() {
                if (display) display.textContent = parseFloat(this.value).toFixed(decimals) + unit;
            });
            // 松手时立即发送 RPC
            slider.addEventListener('change', function() {
                debugSliding[key] = false;
                var val = parseFloat(this.value);
                sendRpc('setDebugSensor', { key: key, value: val });
                // 锁定 2 秒防旧遥测回写（0.5s 间隔够了）
                debugLockUntil[key] = Date.now() + 2000;
                if (els.dbgStatus) {
                    els.dbgStatus.textContent = '✓ ' + key + '=' + val.toFixed(decimals) + unit;
                    els.dbgStatus.className = 'tb-debug-status ok';
                }
            });
        })();
    }

    // 页面切换箭头
    var arrowLeft = document.getElementById('tb-arrow-left');
    var arrowRight = document.getElementById('tb-arrow-right');
    if (arrowLeft) {
        arrowLeft.addEventListener('click', function() { switchPage('scene'); });
        arrowLeft.style.display = 'none'; // 初始在第 1 页，左箭头隐藏
    }
    if (arrowRight) {
        arrowRight.addEventListener('click', function() { switchPage('chart'); });
    }

    // 页面指示器圆点
    var dots = $el.querySelectorAll('.tb-page-dot');
    for (var di = 0; di < dots.length; di++) {
        dots[di].addEventListener('click', function() {
            switchPage(this.dataset.page);
        });
    }

    // 初始化图表 SVG（绘制空网格）
    updateAllCharts();
    updatePageIndicator();

    // 时钟
    if (els.clock) {
        els.clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        refreshTimer = setInterval(function() {
            if (els.clock) {
                els.clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
            }
        }, 1000);
    }

    // 初始显示默认场景（等待真实数据覆盖）
    updateDashboard(mockScenarios.normalDay);
    console.log('[TB Widget] Greenhouse monitoring ready. demoMode=false, waiting for telemetry.');
};

self.onDataUpdated = function() {
    // 演示模式下不覆盖画面，由 loadScene 控制
    if (demoMode) return;

    // 读取 ThingsBoard 遥测数据
    var data = readTelemetryData(self.ctx);

    // 更新仪表盘（第 1 页）
    updateDashboard(data);

    // 推入历史缓存 + 更新图表（第 2 页）
    pushHistory(data);
    updateAllCharts();
    updateSummaryCards(data);
};

self.onResize = function() {
    // 如有需要，处理尺寸变化
};

self.onDestroy = function() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    console.log('[TB Widget] Greenhouse monitoring destroyed');
};
