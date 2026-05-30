console.log('>>> WIDGET STARTUP v3 <<< ' + new Date().toISOString());
/**
 * 智慧农业大棚数字孪生监控 - ThingsBoard Custom Widget
 *
 * 适配 ThingsBoard CE 4.3.0.1 Custom Widget
 * 从 ctx.data 读取遥测数据，驱动大棚场景动画
 */


const THREE_BASE = 'http://192.168.161.1:9000';

let THREE;
let OrbitControls;
let threeReady = false;
let renderer, scene, camera, controls;
let animFrameId = null;
let containerEl = null;
let rootEl = null;
let resizeObserver = null;
let intersectionObserver = null;
let threeInitStarted = false;
let frameCount = 0;

const sceneData = {
  fanStatus: false, lampStatus: false, sprayStatus: false, pumpStatus: false,
  soilAlarm: false, tempAlarm: false, waterAlarm: false, co2Alarm: false,
  waterLevel: 60, soilHumidity: 50, temperature: 25,
  hourOfDay: 12, lightIntensity: 500
};

// ========== 统一大棚坐标系 ==========
const GH = { width: 8, length: 12, height: 4, halfW: 4, halfL: 6 };

var mainPipeRef = null;
var alarmElements = {};
var lampOnColor, zeroColor; // Color对象在THREE加载后初始化

const dynamicObjects = {
  fans: [], lamps: [], sprinklers: [], sprayParticles: null,
  tankWater: null, tankFrame: null, pipeFlows: [],
  soilBeds: [], plants: [], alarmMarkers: []
};

// ========== 材质库 ==========
let matMetal, matMetalDark, matFilm, matSoil, matSoilDry, matPlantGreen;
let matPlantLight, matPlantDark, matGround, matTankBody, matTankFrame, matWater;
let matPipe, matPipeFlow, matFanHousing, matBlade, matLEDOff, matLEDOn;

function initMaterials() {
  matMetal = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.35, metalness: 0.7 });
  matMetalDark = new THREE.MeshStandardMaterial({ color: '#5a6e78', roughness: 0.3, metalness: 0.8 });
  matFilm = new THREE.MeshPhysicalMaterial({ color: '#7fa8c9', roughness: 0.25, metalness: 0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  matSoil = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.9 });
  matSoilDry = new THREE.MeshStandardMaterial({ color: '#6b4530', roughness: 0.92 });
  matPlantGreen = new THREE.MeshStandardMaterial({ color: '#3d8a30', roughness: 0.65 });
  matPlantLight = new THREE.MeshStandardMaterial({ color: '#5aad40', roughness: 0.6 });
  matPlantDark = new THREE.MeshStandardMaterial({ color: '#2d6a20', roughness: 0.7 });
  matGround = new THREE.MeshStandardMaterial({ color: '#1a2a20', roughness: 0.85 });
  matTankBody = new THREE.MeshStandardMaterial({ color: '#4060a0', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.6, depthWrite: false });
  matTankFrame = new THREE.MeshStandardMaterial({ color: '#6070a0', roughness: 0.3, metalness: 0.6 });
  matWater = new THREE.MeshStandardMaterial({ color: '#4499dd', roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.7 });
  matPipe = new THREE.MeshStandardMaterial({ color: '#5070a0', roughness: 0.3, metalness: 0.5 });
  matPipeFlow = new THREE.MeshStandardMaterial({ color: '#00d9ff', roughness: 0.1, emissive: '#003050', emissiveIntensity: 0.6 });
  matFanHousing = new THREE.MeshStandardMaterial({ color: '#556670', roughness: 0.3, metalness: 0.6 });
  matBlade = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.25, metalness: 0.5 });
  matLEDOff = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.4, metalness: 0.4 });
  matLEDOn = new THREE.MeshStandardMaterial({ color: '#ffe8a0', roughness: 0.2, emissive: '#ffe8a0', emissiveIntensity: 1.5 });
  zeroColor = new THREE.Color('#000000');
  lampOnColor = new THREE.Color('#ffe8a0');
}

// ========== Three.js 加载 ==========
function loadThreeModule() {
  var map = document.createElement('script');
  map.type = 'importmap';
  map.textContent = JSON.stringify({
    imports: {
      'three': THREE_BASE + '/three.module.js',
      'three/addons/': THREE_BASE + '/'
    }
  });
  document.head.appendChild(map);

  return import('three').then(function(m) {
    THREE = m;
    return import('three/addons/controls/OrbitControls.js');
  }).then(function(ocModule) {
    OrbitControls = ocModule.OrbitControls;
    if (typeof OrbitControls !== 'function') throw new Error('OrbitControls not function');
  });
}


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
        series: ['lightIntensity'],
        colors: ['#ff9500'],
        yMin: [0],
        yMax: [1500],
        labels: ['棚内光照 lux']
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
        temperature: 24.8, airHumidity: 49.3, soilHumidity: 43.0, lightIntensity: 600, co2: 641, waterLevel: 80,
        hourOfDay: 12,
        fanStatus: false, pumpStatus: false, lampStatus: false,
        sprayStatus: false, autoMode: false,
        soilAlarm: false, tempAlarm: false, waterAlarm: false, co2Alarm: false
    },
    nightLamp: {
        temperature: 22.5, airHumidity: 58.0, soilHumidity: 45.0, lightIntensity: 300, co2: 620, waterLevel: 78,
        hourOfDay: 2,
        fanStatus: false, pumpStatus: false, lampStatus: true,
        sprayStatus: false, autoMode: true,
        soilAlarm: false, tempAlarm: false, waterAlarm: false, co2Alarm: false
    },
    irrigation: {
        temperature: 27.5, airHumidity: 52.0, soilHumidity: 22.0, lightIntensity: 500, co2: 700, waterLevel: 75,
        hourOfDay: 14,
        fanStatus: false, pumpStatus: true, lampStatus: false,
        sprayStatus: true, autoMode: true,
        soilAlarm: true, tempAlarm: false, waterAlarm: false, co2Alarm: false
    },
    lowWater: {
        temperature: 28.0, airHumidity: 50.0, soilHumidity: 20.0, lightIntensity: 500, co2: 690, waterLevel: 10,
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
let rpcPending = {};

// 历史数据缓存（用于第 2 页折线图）
const historyBuffer = {
    temperature: [],
    airHumidity: [],
    soilHumidity: [],    lightIntensity: [],
    waterLevel: [],
    co2: []
};

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
        soilHumidity: Number(getLatestValue(ctx, 'soilHumidity', 0)),        lightIntensity: Number(getLatestValue(ctx, 'lightIntensity', 0)),
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
    // 3D 模型替代了背景图片，bgDay/bgNight 可能不存在
    if (mode === 'day') {
        if (els.bgDay) els.bgDay.classList.add('active');
        if (els.bgNight) els.bgNight.classList.remove('active');
        els.stage.classList.add('day-mode');
        els.stage.classList.remove('night-mode');
    } else {
        if (els.bgDay) els.bgDay.classList.remove('active');
        if (els.bgNight) els.bgNight.classList.add('active');
        els.stage.classList.add('night-mode');
        els.stage.classList.remove('day-mode');
    }
    // 3D 场景氛围: 白天偏亮, 夜晚偏暗
    if (scene && threeReady) {
        if (mode === 'day') {
            scene.background = new THREE.Color('#1a3050');
        } else {
            scene.background = new THREE.Color('#020b12');
        }
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
    console.log('[ALARMS] soilAlarm=' + data.soilAlarm + ' tempAlarm=' + data.tempAlarm + ' waterAlarm=' + data.waterAlarm + ' co2Alarm=' + data.co2Alarm);
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

    // 补光灯 (3D模型已接管灯光效果, 2D CSS效果保留但不强制)
    const lampOn = data.lampStatus;
    [els.lampGlowLeftMain, els.lampGlowRightMain,
     els.lampGlowLeftMid, els.lampGlowRightMid].forEach(el => {
        if (!el) return;
        el.classList.toggle('active', lampOn);
        el.style.opacity = lampOn ? (isNight ? '0.4' : '0.2') : '0';
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
    var keys = ['temperature', 'airHumidity', 'soilHumidity', 'lightIntensity', 'waterLevel', 'co2'];
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
    if (key === 'lightIntensity' || key === 'co2') {
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
        'hourOfDay':     { unit: 'h', decimals: 1 }
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
    // autoMode 仅由用户点击控制，其他执行器走 pending 合并
    var savedAutoMode = currentData.autoMode;
    currentData = mergeTelemetryWithPending(data);
    if (savedAutoMode !== undefined) {
      currentData.autoMode = savedAutoMode;
    }
    console.log('[TELEMETRY IN] autoMode=' + currentData.autoMode + ' (kept) soil=' + data.soilHumidity);

    // 非演示模式下，根据时间自动切换昼夜背景
    if (!demoMode) {
        var h = data.hourOfDay !== undefined ? data.hourOfDay : 12;
        var newMode = (h >= 6 && h < 18) ? 'day' : 'night';
        if (newMode !== sceneMode) {
            applySceneMode(newMode);
        }
    }

    update3DModel(currentData);
    updateEffects(currentData);
    updateDataPanel(currentData);
    updateAlarms(currentData);
    updateBottomBar(currentData);
    updateHeader(currentData);
    updateControlPanel(currentData);
    syncDebugSliders(currentData);
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


// ========== 3D 场景初始化 ==========
// ========== 场景初始化 ==========
function initThree() {
  rootEl = self.ctx.$container[0] || self.ctx.$container;
  if (!rootEl) { console.error('[3D V2] No root element'); return; }
  containerEl = rootEl.querySelector('.tb-3d-canvas');
  if (!containerEl) { console.error('[3D V2] No canvas container'); return; }
  if (!THREE) { console.error('[3D V2] THREE not loaded'); return; }

  var w = containerEl.clientWidth;
  var h = containerEl.clientHeight;

  // 如果 canvas 容器尺寸为0, 用 rootEl 的尺寸并显式设置 canvas 大小
  if (w === 0 || h === 0) {
    w = rootEl.clientWidth;
    h = rootEl.clientHeight;
    if (w > 0 && h > 0) {
      console.log('[3D V2] Container was 0x0, using rootEl size:', w, 'x', h);
      containerEl.style.width = w + 'px';
      containerEl.style.height = h + 'px';
    } else {
      console.log('[3D V2] Container & rootEl both 0, retry via rAF...');
      requestAnimationFrame(function() { requestAnimationFrame(initThree); });
      return;
    }
  }

  console.log('[3D V2] initThree with size:', w, 'x', h);
  console.log('[3D V2] rootEl found:', !!rootEl, 'containerEl found:', !!containerEl);

  try {
    initMaterials();

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#020b12');

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(8, 6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // DEBUG: 红色背景验证 canvas 是否显示
    renderer.setClearColor(0xff0000, 1);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerEl.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.5, 0);
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.update();

    var steps = [
      ['Lighting', createLighting],
      ['Ground', createGround],
      ['Greenhouse', createGreenhouseStructure],
      ['PlantBeds', createPlantBeds],
      ['Plants', createPlants],
      ['Fans', createFans],
      ['Lights', createLights],
      ['Sprinklers', createSprinklers],
      ['WaterTank', createWaterTank],
      ['Pipes', createPipes],
      ['AlarmMarkers', createAlarmMarkers]
    ];
    for (var s = 0; s < steps.length; s++) {
      try {
        console.log('[3D V2] Creating ' + steps[s][0] + '...');
        steps[s][1]();
      } catch (e) {
        console.error('[3D V2] Failed at ' + steps[s][0] + ':', e);
      }
    }

    setupUIHandlers();
    attachResizeObserver();

    threeReady = true;
    console.log('[3D V2] Scene ready');

    // 双 rAF 确保首帧在 TB 布局完成后渲染
    function afterNextPaint(cb) {
      requestAnimationFrame(function() { requestAnimationFrame(cb); });
    }

    startRenderLoop();

    afterNextPaint(function() {
      resize3D(true);
      renderer.render(scene, camera);
      console.log('[3D V2] First paint after next paint');
    });

    // 多时间点兜底
    [100, 300, 600, 1000].forEach(function(delay) {
      setTimeout(function() {
        resize3D(true);
        renderer.render(scene, camera);
      }, delay);
    });

    // 2.5秒后恢复正常背景色（DEBUG 结束）
    setTimeout(function() {
      if (scene) scene.background = new THREE.Color('#020b12');
      console.log('[3D V2] Background restored');
    }, 2500);

  } catch (e) {
    console.error('[3D V2] Init failed:', e);
    if (containerEl) containerEl.innerHTML = '<div style="color:#ff3860;padding:40px;">Init error: ' + e.message + '</div>';
  }
}


// ========== IntersectionObserver: 等 widget 可见后再 init ==========
function waitUntilVisibleThenInit() {
  rootEl = self.ctx.$container[0] || self.ctx.$container;
  if (!rootEl) { setTimeout(waitUntilVisibleThenInit, 100); return; }

  var target = rootEl.querySelector('.tb-3d-canvas');
  if (!target) { setTimeout(waitUntilVisibleThenInit, 100); return; }

  intersectionObserver = new IntersectionObserver(function(entries) {
    var entry = entries[0];
    if (entry && entry.isIntersecting && entry.intersectionRatio > 0) {
      console.log('[3D V2] Widget visible, intersectionRatio:', entry.intersectionRatio);
      intersectionObserver.disconnect();
      intersectionObserver = null;

      if (!threeInitStarted) {
        threeInitStarted = true;
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            initThree();
          });
        });
      }
    }
  }, { threshold: 0.01 });

  intersectionObserver.observe(target);

  // 兜底: 2秒后如果还没初始化, 直接强制初始化
  setTimeout(function() {
    if (!threeInitStarted && !threeReady) {
      console.log('[3D V2] IntersectionObserver timeout, force init');
      threeInitStarted = true;
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          initThree();
        });
      });
    }
  }, 2000);
}


// ========== 3D 测试面板(在Full Scene中隐藏) ==========
var testMode3D = false;

// setupUIHandlers 在 Full Scene 中无需操作(测试面板不存在)
function setupUIHandlers() {
  console.log('[3D V2] setupUIHandlers: no-op in Full Scene');
}

// ========== 3D 模型创建函数 ==========
function createLighting() {
  scene.add(new THREE.AmbientLight('#2a4060', 2.0));
  var sun = new THREE.DirectionalLight('#fff8e8', 1.8);
  sun.position.set(10, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun);
  var fill = new THREE.DirectionalLight('#4466aa', 0.6);
  fill.position.set(-4, 4, -4);
  scene.add(fill);
}

function createGround() {
  var g = new THREE.Mesh(new THREE.PlaneGeometry(20, 18), matGround);
  g.rotation.x = -Math.PI / 2; g.position.y = -0.01; g.receiveShadow = true;
  scene.add(g);
  var grid = new THREE.PolarGridHelper(10, 32, 24, 64, '#0a2a30', '#0a2a30');
  grid.position.y = 0.005; scene.add(grid);
}

function createGreenhouseStructure() {
  var gh = new THREE.Group();
  var hW = GH.halfW, hL = GH.halfL, H = GH.height;

  // 底框+侧梁已删除，仅保留拱架和脊梁

  // 拱形骨架: 7组，z = -6,-4,-2,0,2,4,6
  var archZs = [-hL, -4, -2, 0, 2, 4, hL];
  archZs.forEach(function(z) {
    var archPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-hW, 0, 0),
      new THREE.Vector3(-hW * 0.7, H * 0.75, 0),
      new THREE.Vector3(0, H, 0),
      new THREE.Vector3( hW * 0.7, H * 0.75, 0),
      new THREE.Vector3( hW, 0, 0)
    ], false, 'catmullrom', 0.5);
    var arch = new THREE.Mesh(new THREE.TubeGeometry(archPath, 32, 0.05, 8, false), matMetalDark);
    arch.position.z = z; arch.castShadow = true; arch.receiveShadow = true;
    gh.add(arch);
  });

  // 顶部脊梁（仅保留此梁连接各拱顶）
  var ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, hL*2, 8), matMetal);
  ridge.rotation.x = Math.PI/2; ridge.position.set(0, H, 0); ridge.castShadow = true;
  gh.add(ridge);

  // 棚膜: 使用与拱架相同的曲线外扩, 沿z轴挤出
  var archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-hW, 0, 0),
    new THREE.Vector3(-hW * 0.7, H * 0.75, 0),
    new THREE.Vector3(0, H, 0),
    new THREE.Vector3( hW * 0.7, H * 0.75, 0),
    new THREE.Vector3( hW, 0, 0)
  ], false, 'catmullrom', 0.5);
  var archPts = archCurve.getPoints(60);
  var filmShape = new THREE.Shape();
  filmShape.moveTo(archPts[0].x * 1.02, 0);
  for (var i = 0; i < archPts.length; i++) {
    filmShape.lineTo(archPts[i].x * 1.02, archPts[i].y + 0.04);
  }
  filmShape.lineTo(archPts[archPts.length-1].x * 1.02, 0);
  var filmGeo = new THREE.ExtrudeGeometry(filmShape, { steps: 1, depth: hL * 2, bevelEnabled: false });
  filmGeo.translate(0, 0, -hL);
  var film = new THREE.Mesh(filmGeo, matFilm);
  film.position.set(0, 0, 0);
  film.renderOrder = 0;
  film.material.depthWrite = false;
  gh.add(film);

  scene.add(gh);
}

function createPlantBeds() {
  var bg = new THREE.Group();
  // 3条种植垄沿z轴, x = -2.4, 0, 2.4 (田-喷-田-喷-田)
  var bedXs = [-2.4, 0, 2.4];
  var bedLen = GH.halfL * 1.6; // 9.6
  var bedW = 0.9, bedH = 0.12;
  bedXs.forEach(function(bx) {
    var bed = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedH, bedLen), matSoil);
    bed.position.set(bx, bedH/2 + 0.02, 0);
    bed.receiveShadow = true; bed.castShadow = true;
    bg.add(bed); dynamicObjects.soilBeds.push(bed);
  });
  scene.add(bg);
}

// ========== 植物建模 ==========
var leafColors = ['#1f6f3a', '#2fa84f', '#55c96b', '#2d8a3e', '#3cb85a'];

function createLeaf(len, wid, color) {
  var hw = wid / 2, hh = len / 2;
  var shape = new THREE.Shape();
  shape.moveTo(0, -hh);
  shape.bezierCurveTo( hw, -hh * 0.5,  hw, hh * 0.5, 0, hh);
  shape.bezierCurveTo(-hw,  hh * 0.5, -hw, -hh * 0.5, 0, -hh);
  var geo = new THREE.ShapeGeometry(shape, 3);
  var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.55, side: THREE.DoubleSide });
  var leaf = new THREE.Mesh(geo, mat);
  leaf.castShadow = true;
  return leaf;
}

function createPlant(px, pz, scale) {
  var plant = new THREE.Group();
  plant.position.set(px, 0.14, pz);

  // 细茎: 圆柱, 高0.22, 半径0.028
  var stemH = 0.22 * scale;
  var stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.03, stemH, 8),
    new THREE.MeshStandardMaterial({ color: '#4a7a38', roughness: 0.7 })
  );
  stem.position.y = stemH / 2;
  stem.castShadow = true;
  plant.add(stem);

  // 下层叶片: 7片, 向外展开接近水平
  var lowerCount = 7;
  for (var li = 0; li < lowerCount; li++) {
    var a = (li / lowerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    var lfLen = (0.14 + Math.random() * 0.06) * scale;
    var lfWid = (0.05 + Math.random() * 0.04) * scale;
    var lf = createLeaf(lfLen, lfWid, leafColors[Math.floor(Math.random() * leafColors.length)]);
    lf.position.set(Math.cos(a) * 0.07 * scale, stemH * 0.5, Math.sin(a) * 0.07 * scale);
    lf.rotation.y = -a + Math.PI / 2;
    lf.rotation.z = Math.PI / 2 - 0.3 + (Math.random() - 0.5) * 0.25; // 接近水平, 叶面朝上
    lf.rotation.order = 'YXZ';
    plant.add(lf);
  }

  // 上层叶片: 5片, 向上倾斜
  var upperCount = 5;
  for (var ui = 0; ui < upperCount; ui++) {
    var a2 = (ui / upperCount) * Math.PI * 2 + Math.random() * 0.4;
    var ulLen = (0.10 + Math.random() * 0.05) * scale;
    var ulWid = (0.04 + Math.random() * 0.03) * scale;
    var uf = createLeaf(ulLen, ulWid, leafColors[Math.floor(Math.random() * leafColors.length)]);
    uf.position.set(Math.cos(a2) * 0.04 * scale, stemH * 0.8, Math.sin(a2) * 0.04 * scale);
    uf.rotation.y = -a2 + Math.PI / 2;
    uf.rotation.z = Math.PI / 4 + (Math.random() - 0.5) * 0.3; // 向上倾斜
    uf.rotation.order = 'YXZ';
    plant.add(uf);
  }

  plant.userData = {
    baseY: plant.position.y,
    breathSpeed: 0.5 + Math.random() * 1.2,
    breathOffset: Math.random() * Math.PI * 2,
    breathAmp: 0.003 + Math.random() * 0.005
  };
  return plant;
}

function createPlants() {
  var pg = new THREE.Group();
  var bedXs = [-2.4, 0, 2.4];
  // 每条垄2列, 每列6棵 (3x放大后间距加大)
  var plantZs = [-4.2, -2.5, -0.8, 0.8, 2.5, 4.2];

  bedXs.forEach(function(bx) {
    [-0.3, 0.3].forEach(function(ox) {
      plantZs.forEach(function(pz) {
        var scale = 3 * (0.8 + Math.random() * 0.4);
        var plant = createPlant(bx + ox, pz + (Math.random() - 0.5) * 0.2, scale);
        pg.add(plant);
        dynamicObjects.plants.push(plant);
      });
    });
  });
  scene.add(pg);
}

function createFans() {
  var fg = new THREE.Group();
  var guardMat = new THREE.MeshBasicMaterial({ color: '#445566', transparent: true, opacity: 0.55, depthWrite: false });

  // 扇叶: 参考 index_v2 的 3 长叶设计
  var bladeMat = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.25, metalness: 0.5 });
  var bladeGeo = new THREE.BoxGeometry(0.07, 0.45, 0.04);
  // 中心帽材质
  var capMat = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.25, metalness: 0.6 });

  var fanConfigs = [
    { pos: [-3.8, 2.1, -2.5], side: 'left' },
    { pos: [3.8, 2.1, 2.5], side: 'right' }
  ];

  fanConfigs.forEach(function(cfg) {
    var fanGroup = new THREE.Group();
    var frameGroup = new THREE.Group();
    var bladesGroup = new THREE.Group();

    // === frameGroup: 外圈 + 电机毂 + 支架 + 防护网 ===

    // 外圈保护框 (深灰金属 Torus, r=0.3, tube=0.035)
    var outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.035, 16, 24), matMetalDark
    );
    outerRing.castShadow = true;
    frameGroup.add(outerRing);

    // 内圈加固环
    var innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.018, 12, 16), matMetal
    );
    frameGroup.add(innerRing);

    // 中心电机毂
    var hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.09, 12), matMetalDark
    );
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    frameGroup.add(hub);

    // 防护网: 2根交叉细杆 + 细外圈 (半透明, 不遮挡扇叶)
    var barLen = 0.54;
    for (var j = 0; j < 2; j++) {
      var barAngle = j * Math.PI / 2 + Math.PI / 4;
      var bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, barLen, 6), guardMat
      );
      bar.rotation.z = barAngle;
      bar.position.z = 0.04;
      frameGroup.add(bar);
    }
    var guardRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.005, 8, 24), guardMat
    );
    guardRing.position.z = 0.04;
    frameGroup.add(guardRing);

    // 安装支架 (连接到侧壁)
    var bracketArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), matMetalDark
    );
    bracketArm.rotation.x = Math.PI / 2;
    bracketArm.position.z = -0.2;
    bracketArm.castShadow = true;
    frameGroup.add(bracketArm);

    var wallPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.28, 0.04), matMetalDark
    );
    wallPlate.position.z = -0.39;
    wallPlate.castShadow = true;
    frameGroup.add(wallPlate);

    var strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8), matMetalDark
    );
    strut.position.set(0, -0.22, -0.08);
    strut.rotation.x = -Math.PI / 4.5;
    strut.castShadow = true;
    frameGroup.add(strut);

    // === bladesGroup: 3片扇叶 (参考 index_v2) ===
    for (var i = 0; i < 3; i++) {
      var blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 0.15;
      blade.rotation.z = (i / 3) * Math.PI * 2;
      blade.castShadow = true;
      bladesGroup.add(blade);
    }
    // 中心帽
    bladesGroup.add(new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12), capMat
    ).rotateX(Math.PI / 2));

    // === 气流线 ===
    var airflowGroup = new THREE.Group();
    var airGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.55, 6);
    for (var k = 0; k < 4; k++) {
      var ang = (k / 4) * Math.PI * 2 + Math.PI / 8;
      var r = 0.13;
      var airLine = new THREE.Mesh(airGeo, new THREE.MeshBasicMaterial({
        color: '#88ccff', transparent: true, opacity: 0.2, depthWrite: false
      }));
      airLine.position.set(Math.cos(ang) * r, Math.sin(ang) * r, 0.28);
      airLine.rotation.x = Math.PI / 2;
      airLine.userData = { baseOpacity: 0.08 + Math.random() * 0.15, phase: Math.random() * Math.PI * 2 };
      airflowGroup.add(airLine);
    }
    airflowGroup.visible = false;

    // === 组装 ===
    fanGroup.add(frameGroup);
    fanGroup.add(bladesGroup);
    fanGroup.add(airflowGroup);
    fanGroup.userData = { bladesGroup: bladesGroup, airflow: airflowGroup };

    // === 定位 + 朝向 ===
    fanGroup.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    // 默认扇面在XY平面朝+Z; left (-3.8) 朝 +X (棚内), right (3.8) 朝 -X (棚内)
    if (cfg.side === 'left') {
      fanGroup.rotation.y = Math.PI / 2;
    } else {
      fanGroup.rotation.y = -Math.PI / 2;
    }
    console.log('[3D Fan] Created ' + cfg.side + ' fan, bladesGroup in userData:', !!fanGroup.userData.bladesGroup);

    fg.add(fanGroup);
    dynamicObjects.fans.push(fanGroup);
  });

  scene.add(fg);
}

function createLights() {
  var lg = new THREE.Group();
  // 4条灯带挂在顶部横梁下，平行于z轴（种植垄方向）
  [[-2, -3], [2, -3], [-2, 3], [2, 3]].forEach(function(p) {
    var lamp = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 2.5), matLEDOff.clone());
    body.castShadow = true; body.name = 'lampBody'; lamp.add(body);
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 2.3), matLEDOn.clone());
    glow.rotation.x = -Math.PI/2; glow.position.y = -0.03; glow.name = 'glowPanel';
    glow.material.opacity = 0; glow.material.transparent = true; glow.material.emissiveIntensity = 0;
    lamp.add(glow);
    var spot = new THREE.SpotLight('#ffe8a0', 0, 10, Math.PI/5, 0.3, 0.5);
    spot.position.y = -0.5; spot.name = 'lampSpot'; lamp.add(spot);
    lamp.position.set(p[0], GH.height - 0.9, p[1]); // y ≈ 3.1
    lamp.userData = { body: body, glow: glow, spotLight: spot };
    lg.add(lamp); dynamicObjects.lamps.push(lamp);
  });
  scene.add(lg);
}

function createSprinklers() {
  var sg = new THREE.Group();
  // 2条喷淋线 x=-1.2, 1.2 各3个喷头 z=-3.5,0,3.5 (田-喷-田-喷-田)
  [[-1.2, -3.5], [-1.2, 0], [-1.2, 3.5], [1.2, -3.5], [1.2, 0], [1.2, 3.5]].forEach(function(p) {
    var head = new THREE.Group();
    var pipeH = 1.5;
    var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, pipeH, 8), matPipe);
    pipe.position.y = pipeH/2; pipe.castShadow = true; head.add(pipe);
    var nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 8), matMetalDark);
    nozzle.position.y = pipeH; nozzle.castShadow = true; head.add(nozzle);
    head.position.set(p[0], 0, p[1]);
    sg.add(head);
  });
  scene.add(sg);

  // V3 风格喷雾: 2条喷淋线，6个喷头
  var sprayGroup = new THREE.Group(); sprayGroup.visible = false;
  var sprinklerPositions = [[-1.2, 1.5, -3.5], [-1.2, 1.5, 0], [-1.2, 1.5, 3.5],
                             [1.2, 1.5, -3.5], [1.2, 1.5, 0], [1.2, 1.5, 3.5]];
  var pGeo = new THREE.SphereGeometry(0.02, 4, 3);
  var pMat = new THREE.MeshBasicMaterial({ color: '#aaddff', transparent: true, opacity: 0.7 });

  sprinklerPositions.forEach(function(sp) {
    for (var i = 0; i < 15; i++) {
      var pt = new THREE.Mesh(pGeo, pMat);
      // 喷头向左右扩散覆盖相邻两床: angle偏向±X方向
      var dirX = sp[0] < 0 ? 1 : -1; // 左线喷右, 右线喷左
      var angle = (Math.random() - 0.5) * Math.PI * 0.7 + (dirX > 0 ? -Math.PI*0.15 : Math.PI*0.85);
      var radius = 0.05 + Math.random() * 1.3;
      var drop = Math.random() * 1.2;
      pt.position.set(
        sp[0] + Math.cos(angle) * radius,
        sp[1] - drop,
        sp[2] + Math.sin(angle) * radius
      );
      pt.userData = {
        originX: sp[0], originY: sp[1], originZ: sp[2],
        speed: 1.5 + Math.random() * 3, offset: Math.random() * Math.PI * 2,
        radius: radius, angle: angle
      };
      sprayGroup.add(pt);
    }
  });
  scene.add(sprayGroup);
  dynamicObjects.sprayParticles = sprayGroup;
}

function createWaterTank() {
  var tg = new THREE.Group();
  // 水箱在大棚左前外侧
  var tankW = 1.0, tankH = 1.1, tankD = 0.8;
  var frameEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(tankW, tankH, tankD));
  var frame = new THREE.LineSegments(frameEdges, new THREE.LineBasicMaterial({ color: '#6088bb' }));
  frame.position.y = tankH/2; tg.add(frame); dynamicObjects.tankFrame = frame;
  var body = new THREE.Mesh(new THREE.BoxGeometry(tankW-0.05, tankH-0.05, tankD-0.05), matTankBody);
  body.position.y = tankH/2; body.castShadow = true; body.receiveShadow = true;
  body.renderOrder = 1; body.material.depthWrite = false; tg.add(body);
  var water = new THREE.Mesh(new THREE.BoxGeometry(tankW-0.1, 0.01, tankD-0.1), matWater);
  water.position.y = 0.08; water.renderOrder = 0; tg.add(water);
  dynamicObjects.tankWater = water;
  tg.add(new THREE.Mesh(new THREE.BoxGeometry(tankW+0.05, 0.05, tankD+0.05), matMetalDark));
  // 位置: 左前外侧
  tg.position.set(-GH.halfW - 1.0, 0, -GH.halfL + 0.6);
  scene.add(tg);
}

function createPipes() {
  var pg = new THREE.Group();
  var tankX = -GH.halfW - 1.0;
  var tankZ = -GH.halfL + 0.6;
  var sideX = GH.halfW - 0.4;  // 管道靠两侧走

  // 左侧主管: 水箱 → 沿左侧 → 后方
  var leftPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(tankX, 0.25, tankZ),
    new THREE.Vector3(-sideX, 0.25, -GH.halfL + 0.5),
    new THREE.Vector3(-sideX, 0.25, 0),
    new THREE.Vector3(-sideX, 0.25, GH.halfL - 0.5)
  ]);
  var leftPipe = new THREE.Mesh(new THREE.TubeGeometry(leftPath, 32, 0.05, 8, false), matPipe);
  leftPipe.castShadow = true; pg.add(leftPipe);

  // 右侧主管: 前端 → 沿右侧 → 后方
  var rightPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(sideX, 0.25, -GH.halfL + 0.5),
    new THREE.Vector3(sideX, 0.25, 0),
    new THREE.Vector3(sideX, 0.25, GH.halfL - 0.5)
  ]);
  var rightPipe = new THREE.Mesh(new THREE.TubeGeometry(rightPath, 24, 0.05, 8, false), matPipe);
  rightPipe.castShadow = true; mainPipeRef = rightPipe; pg.add(rightPipe);

  // 前端横向连接管
  var frontPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-sideX, 0.25, -GH.halfL + 0.5),
    new THREE.Vector3(0, 0.25, -GH.halfL + 0.5),
    new THREE.Vector3(sideX, 0.25, -GH.halfL + 0.5)
  ]);
  pg.add(new THREE.Mesh(new THREE.TubeGeometry(frontPath, 16, 0.05, 8, false), matPipe));

  // 后端横向连接管
  var backPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-sideX, 0.25, GH.halfL - 0.5),
    new THREE.Vector3(0, 0.25, GH.halfL - 0.5),
    new THREE.Vector3(sideX, 0.25, GH.halfL - 0.5)
  ]);
  pg.add(new THREE.Mesh(new THREE.TubeGeometry(backPath, 16, 0.05, 8, false), matPipe));

  // 从主管到喷头(x=±1.2, z=-3.5/0/3.5)的短支管
  [[-1.2, -3.5], [-1.2, 0], [-1.2, 3.5], [1.2, -3.5], [1.2, 0], [1.2, 3.5]].forEach(function(sp) {
    var sx = sp[0] > 0 ? sideX : -sideX;
    var bp = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0.25, sp[1]),
      new THREE.Vector3(sp[0], 0.25, sp[1])
    ]);
    pg.add(new THREE.Mesh(new THREE.TubeGeometry(bp, 8, 0.035, 6, false), matPipe));
  });

  // 流动光点沿左侧主管
  for (var i = 0; i < 8; i++) {
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), matPipeFlow.clone());
    dot.visible = false; dot.userData = { pathProgress: Math.random(), speed: 0.1+Math.random()*0.2, path: leftPath };
    pg.add(dot); dynamicObjects.pipeFlows.push(dot);
  }
  // 流动光点沿右侧主管
  for (var j = 0; j < 8; j++) {
    var dot2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), matPipeFlow.clone());
    dot2.visible = false; dot2.userData = { pathProgress: Math.random(), speed: 0.1+Math.random()*0.2, path: rightPath };
    pg.add(dot2); dynamicObjects.pipeFlows.push(dot2);
  }
  scene.add(pg);
}

function createAlarmMarkers() {
  var mg = new THREE.Group();
  function makeMarker(color, pos) {
    var g = new THREE.Group();
    var s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0 }));
    g.add(s); g.position.copy(pos); g.visible = false; g.userData = { sphere: s };
    mg.add(g); return g;
  }
  dynamicObjects.alarmMarkers = {
    soil: makeMarker('#ff9500', new THREE.Vector3(0, 0.35, 0)),
    temp: makeMarker('#ff3860', new THREE.Vector3(0, GH.height - 0.5, -GH.halfL + 0.5)),
    water: makeMarker('#ff3860', new THREE.Vector3(-GH.halfW - 1.0, 0.9, -GH.halfL + 0.6))
  };
  scene.add(mg);
}


// ========== 3D 渲染循环 ==========
// ========== 渲染循环 ==========
function startRenderLoop() {
  var clock = new THREE.Clock();
  function render() {
    animFrameId = requestAnimationFrame(render);
    var dt = Math.min(clock.getDelta(), 0.1);
    var time = performance.now() * 0.001;

    frameCount++;
    if (frameCount % 120 === 0) {
      console.log('[3D V2] render loop alive, frame:', frameCount,
        'size:', containerEl ? containerEl.clientWidth + 'x' + containerEl.clientHeight : '?');
    }

    if (controls) controls.update();

    // 风扇旋转 + 气流动画
    dynamicObjects.fans.forEach(function(fan) {
      var bladesGroup = fan.userData.bladesGroup;
      if (bladesGroup) {
        bladesGroup.userData = bladesGroup.userData || { currentSpeed: 0 };
        var target = sceneData.fanStatus ? 12 : 0;
        bladesGroup.userData.currentSpeed += (target - bladesGroup.userData.currentSpeed) * Math.min(dt * 4, 1);
        bladesGroup.rotation.z += bladesGroup.userData.currentSpeed * dt;
        // 低频调试日志
        if (frameCount === 60) {
          console.log('[3D Fan] bladesGroup exists:', !!fan.userData.bladesGroup, 'fanStatus:', sceneData.fanStatus, 'speed:', bladesGroup.userData.currentSpeed.toFixed(2));
        }
      }
      // 气流线可见性 + 脉冲
      var airflow = fan.userData.airflow;
      if (airflow) {
        airflow.visible = sceneData.fanStatus;
        if (sceneData.fanStatus) {
          airflow.children.forEach(function(line) {
            var ud = line.userData;
            line.material.opacity = ud.baseOpacity + Math.abs(Math.sin(time * 8 + ud.phase)) * 0.15;
          });
        }
      }
    });

    // LED 灯光
    dynamicObjects.lamps.forEach(function(lamp) {
      var ud = lamp.userData;
      var ti = sceneData.lampStatus ? 2.5 : 0;
      var tg = sceneData.lampStatus ? 0.9 : 0;
      if (ud.glow) {
        ud.glow.material.emissiveIntensity += (ti - ud.glow.material.emissiveIntensity) * dt * 3;
        ud.glow.material.opacity += (tg - ud.glow.material.opacity) * dt * 3;
      }
      if (ud.spotLight) ud.spotLight.intensity += (ti - ud.spotLight.intensity) * dt * 3;
      if (ud.body) {
        if (sceneData.lampStatus) { ud.body.material.color.set('#ffe8a0'); ud.body.material.emissive = lampOnColor; ud.body.material.emissiveIntensity += (0.6 - ud.body.material.emissiveIntensity) * dt * 3; }
        else { ud.body.material.color.set('#555555'); ud.body.material.emissive = zeroColor; ud.body.material.emissiveIntensity += (0 - ud.body.material.emissiveIntensity) * dt * 3; }
      }
    });

    // 喷淋粒子: V3风格锥形喷雾
    if (dynamicObjects.sprayParticles) {
      dynamicObjects.sprayParticles.visible = sceneData.sprayStatus;
      if (sceneData.sprayStatus) {
        dynamicObjects.sprayParticles.children.forEach(function(p) {
          var ud = p.userData;
          // 粒子从喷头向下向外运动，循环重置
          var cycle = ((time * ud.speed + ud.offset) % 1.5) / 1.5; // 0→1 循环
          var r = ud.radius * cycle;
          var dy = cycle * 1.3;
          p.position.set(
            ud.originX + Math.cos(ud.offset) * r,
            ud.originY - dy,
            ud.originZ + Math.sin(ud.offset) * r
          );
          p.material.opacity = 0.3 + (1 - cycle) * 0.5;
        });
      }
    }

    // 水箱液位
    if (dynamicObjects.tankWater) {
      var level = sceneData.waterLevel / 100;
      dynamicObjects.tankWater.position.y = 0.06 + level * 1.0;
      dynamicObjects.tankWater.scale.y = Math.max(0.01, level);
      if (sceneData.waterAlarm) {
        dynamicObjects.tankWater.material.color.set('#ff4040');
        dynamicObjects.tankWater.material.emissive = new THREE.Color('#401010');
        dynamicObjects.tankWater.material.emissiveIntensity = 0.5 + Math.sin(time * 4) * 0.3;
      } else {
        dynamicObjects.tankWater.material.color.set('#4499dd');
        dynamicObjects.tankWater.material.emissive = new THREE.Color('#000000');
        dynamicObjects.tankWater.material.emissiveIntensity = 0;
      }
    }

    // 管道流动
    dynamicObjects.pipeFlows.forEach(function(dot) {
      dot.visible = sceneData.pumpStatus;
      if (sceneData.pumpStatus) {
        dot.userData.pathProgress += dot.userData.speed * dt;
        if (dot.userData.pathProgress > 1) dot.userData.pathProgress -= 1;
        dot.position.copy(dot.userData.path.getPoint(dot.userData.pathProgress));
        dot.material.opacity = 0.4 + Math.sin(dot.userData.pathProgress * Math.PI * 2) * 0.3;
      }
    });

    // 管道颜色 (直接引用, 不走scene.traverse)
    if (mainPipeRef) mainPipeRef.material.color.set(sceneData.pumpStatus ? '#00b8e8' : '#5070a0');

    // 土壤
    dynamicObjects.soilBeds.forEach(function(bed) {
      bed.material.color.set(sceneData.soilAlarm ? '#8a5030' : '#4a3020');
    });

    // 植物呼吸
    dynamicObjects.plants.forEach(function(plant) {
      var ud = plant.userData;
      if (ud && ud.breathSpeed) plant.position.y = ud.baseY + Math.sin(time * ud.breathSpeed + ud.breathOffset) * ud.breathAmp;
    });

    // HTML 告警标签 (缓存元素)
    ['soil','temp','water'].forEach(function(key) {
      var el = alarmElements[key];
      if (el) {
        var active = sceneData[key + 'Alarm'];
        if (active) el.classList.add('active'); else el.classList.remove('active');
      }
    });

    // 告警标记
    var mks = dynamicObjects.alarmMarkers;
    if (mks) {
      [mks.soil, mks.temp, mks.water].forEach(function(m) {
        var active = (m === mks.soil && sceneData.soilAlarm) || (m === mks.temp && sceneData.tempAlarm) || (m === mks.water && sceneData.waterAlarm);
        m.visible = active;
        if (active && m.userData.sphere) m.userData.sphere.material.opacity = 0.5 + Math.sin(time * 6) * 0.5;
      });
    }

    if (renderer && scene && camera) renderer.render(scene, camera);
  }
  render();
}


// ========== 3D 尺寸同步 ==========
// ========== 尺寸同步 & ResizeObserver ==========
function resize3D(forceRender) {
  if (!threeReady || !renderer || !camera || !containerEl) return;
  var rect = containerEl.getBoundingClientRect();
  var w = rect.width;
  var h = rect.height;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setViewport(0, 0, w, h);
  if (forceRender && scene) renderer.render(scene, camera);
}

function attachResizeObserver() {
  if (!containerEl || typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver(function() { resize3D(true); });
  resizeObserver.observe(containerEl);
}

// ========== Window resize 监听 ==========
function handleWindowResize() {
  requestAnimationFrame(function() { resize3D(true); });
}


// ========== 3D 模型数据更新桥接 ==========
function update3DModel(data) {
  if (!threeReady) return;
  // 同步遥测数据到 3D sceneData
  sceneData.fanStatus = data.fanStatus || false;
  sceneData.lampStatus = data.lampStatus || false;
  sceneData.sprayStatus = data.sprayStatus || false;
  sceneData.pumpStatus = data.pumpStatus || false;
  sceneData.soilAlarm = data.soilAlarm || false;
  sceneData.tempAlarm = data.tempAlarm || false;
  sceneData.waterAlarm = data.waterAlarm || false;
  sceneData.co2Alarm = data.co2Alarm || false;
  sceneData.waterLevel = Number(data.waterLevel) || 60;
  sceneData.soilHumidity = Number(data.soilHumidity) || 50;
  sceneData.temperature = Number(data.temperature) || 25;
  sceneData.hourOfDay = Number(data.hourOfDay) || 12;
    sceneData.lightIntensity = Number(data.lightIntensity) || 500;
}


// ========== ThingsBoard Widget 生命周期 ==========

self.onInit = function() {
    console.log('[Full Scene+3D] Initializing...');

    // 缓存 DOM 元素（HTML 已由 ThingsBoard 从 HTML 标签页渲染到容器中）
    var $el = self.ctx.$container[0] || self.ctx.$container;
    cacheElements($el);

    // 不再加载白天/夜晚背景图片，3D 模型替代
    console.log('[Full Scene+3D] 3D model will replace background images');

    // ===== 加载 Three.js 并初始化 3D 场景 =====
    console.log('[Full Scene+3D] Loading Three.js...');
    window.addEventListener('resize', handleWindowResize);
    loadThreeModule().then(function() {
        console.log('[Full Scene+3D] Three.js loaded, waiting for visibility...');
    waitUntilVisibleThenInit();
    }).catch(function(err) {
        console.error('[Full Scene+3D] Three.js load failed:', err);
    });

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
            var currentOn = currentData[dataKey];
            var newValue = !currentOn;
            console.log('[CLICK] ' + dataKey + ': ' + currentOn + ' -> ' + newValue);

            if (dataKey === 'autoMode') {
              // autoMode 纯前端本地状态，不走 RPC（避免 MQTT 断连导致遥测冲突）
              currentData.autoMode = newValue;
              updateControlPanel(currentData);
              console.log('[AUTO] Local toggle only, no RPC. autoMode=' + newValue);
              return;
            }

            currentData[dataKey] = newValue;
            rpcPending[dataKey] = { value: newValue, startedAt: Date.now() };
            updateControlPanel(currentData);
            sendRpc(rpcMethod, newValue);
            console.log('[RPC SEND] ' + rpcMethod + '=' + newValue);
        });
    }

    // 调试面板：折叠/展开
    if (els.debugToggle && els.debugPanel) {
        els.debugToggle.addEventListener('click', function() {
            els.debugPanel.classList.toggle('collapsed');
        });
    }

    // 调试面板：滑块拖拽显示 + 松手即发 RPC
    var debugUnitMap = { soilHumidity: '%', temperature: '°C', waterLevel: '%', co2: '', hourOfDay: 'h' };
    var debugDecimals = { soilHumidity: 1, temperature: 1, waterLevel: 1, co2: 0, hourOfDay: 1 };
    for (var ds = 0; ds < els.dbgLiveSliders.length; ds++) {
        (function() {
            var slider = els.dbgLiveSliders[ds];
            var key = slider.dataset.key;
            var unit = debugUnitMap[key] || '';
            var decimals = debugDecimals[key] || 0;
            var display = document.getElementById('dbg-val-' + key);
            debugSliding[key] = false;

            slider.addEventListener('pointerdown', function(e) { e.stopPropagation(); debugSliding[key] = true; });
            slider.addEventListener('pointerup', function(e) { e.stopPropagation(); debugSliding[key] = false; });
            // 拖拽时实时更新显示
            slider.addEventListener('input', function(e) {
                e.stopPropagation();
                if (display) display.textContent = parseFloat(this.value).toFixed(decimals) + unit;
            });
            // 松手时立即发送 RPC
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
    resize3D(true);
};

self.onDestroy = function() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    // 3D 资源释放
    window.removeEventListener('resize', handleWindowResize);
    if (intersectionObserver) { intersectionObserver.disconnect(); intersectionObserver = null; }
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (renderer) {
        renderer.dispose();
        if (containerEl && renderer.domElement && containerEl.contains(renderer.domElement))
            containerEl.removeChild(renderer.domElement);
        renderer = null;
    }
    if (scene) {
        scene.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(function(m){m.dispose();});
                else obj.material.dispose();
            }
        });
        scene = null;
    }
    threeReady = false;
    console.log('[Full Scene+3D] Destroyed');
};
