console.log('>>> WIDGET STARTUP v4 DUAL <<< ' + new Date().toISOString());
/**
 * 智慧农业大棚数字孪生监控 - ThingsBoard Custom Widget (Dual Greenhouse)
 *
 * v4: 支持双大棚 (01 + 02), 设备切换按钮, 独立数据/控制
 */

const THREE_BASE = 'http://192.168.161.1:9000';

// Feature flags
var ENABLE_FARMLAND = false;
var ENABLE_STREET_LIGHTS = false;

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

// ========== 设备元数据 ==========
const deviceMeta = {
  device01: {
    name: 'Greenhouse_Device_01', label: '01 大棚',
    deviceId: '2d415ac0-5803-11f1-928b-253a5007835b',
    aliasName: 'Greenhouse'
  },
  device02: {
    name: 'Greenhouse_Device_02', label: '02 大棚',
    deviceId: '8ced0b10-5c20-11f1-bd9f-8392d05e68a2',
    aliasName: 'GH02_Device'
  },
  device11: {
    name: 'Greenhouse_Device_11', label: '11 大棚',
    deviceId: '51f6cf60-5c29-11f1-bd9f-8392d05e68a2',
    aliasName: 'GH11_Device'
  },
  device12: {
    name: 'Greenhouse_Device_12', label: '12 大棚',
    deviceId: '51ff5ae0-5c29-11f1-bd9f-8392d05e68a2',
    aliasName: 'GH12_Device'
  }
};
let activeDeviceKey = 'device01';

// ========== 设备遥测数据 (分设备存储) ==========
const deviceData = {
  device01: {}, device02: {}, device11: {}, device12: {}
};

// ========== 当前活跃设备数据 (指向 deviceData[activeDeviceKey]) ==========
let currentData = {};

// ========== 大棚配置 ==========
const GH_CONFIG = { width: 8, length: 12, height: 4, halfW: 4, halfL: 6 };

// ========== 双大棚单元结构 ==========
const greenhouseUnits = {
  device01: {
    group: null,
    dynamicObjects: {
      fans: [], lamps: [], sprinklers: [],
      sprayParticles: null, tankWater: null, tankFrame: null,
      pipeFlows: [], soilBeds: [], plants: [], alarmMarkers: {}
    },
    sceneData: {
      fanStatus: false, lampStatus: false, sprayStatus: false, pumpStatus: false,
      soilAlarm: false, tempAlarm: false, waterAlarm: false, co2Alarm: false,
      waterLevel: 60, soilHumidity: 50, temperature: 25,
      hourOfDay: 12, lightIntensity: 500
    },
    mainPipeRef: null,
    ghConfig: { width: 8, length: 12, height: 4, halfW: 4, halfL: 6 }
  },
  device02: {
    group: null,
    dynamicObjects: { fans:[],lamps:[],sprinklers:[],sprayParticles:null,tankWater:null,tankFrame:null,pipeFlows:[],soilBeds:[],plants:[],alarmMarkers:{} },
    sceneData: { fanStatus:false,lampStatus:false,sprayStatus:false,pumpStatus:false,soilAlarm:false,tempAlarm:false,waterAlarm:false,co2Alarm:false,waterLevel:60,soilHumidity:50,temperature:25,hourOfDay:12,lightIntensity:500 },
    mainPipeRef: null,
    ghConfig: { width: 8, length: 12, height: 4, halfW: 4, halfL: 6 }
  },
  device11: {
    group: null,
    dynamicObjects: { fans:[],lamps:[],sprinklers:[],sprayParticles:null,tankWater:null,tankFrame:null,pipeFlows:[],soilBeds:[],plants:[],alarmMarkers:{} },
    sceneData: { fanStatus:false,lampStatus:false,sprayStatus:false,pumpStatus:false,soilAlarm:false,tempAlarm:false,waterAlarm:false,co2Alarm:false,waterLevel:60,soilHumidity:50,temperature:25,hourOfDay:12,lightIntensity:500 },
    mainPipeRef: null,
    ghConfig: { width: 8, length: 12, height: 4, halfW: 4, halfL: 6 }
  },
  device12: {
    group: null,
    dynamicObjects: { fans:[],lamps:[],sprinklers:[],sprayParticles:null,tankWater:null,tankFrame:null,pipeFlows:[],soilBeds:[],plants:[],alarmMarkers:{} },
    sceneData: { fanStatus:false,lampStatus:false,sprayStatus:false,pumpStatus:false,soilAlarm:false,tempAlarm:false,waterAlarm:false,co2Alarm:false,waterLevel:60,soilHumidity:50,temperature:25,hourOfDay:12,lightIntensity:500 },
    mainPipeRef: null,
    ghConfig: { width: 8, length: 12, height: 4, halfW: 4, halfL: 6 }
  }
};

// Raycaster 悬停拾取 + 点击聚焦
var raycaster, mouse, hoveredDeviceKey, tooltipEl, lastMouseEvent;
var mouseDownPos, cameraAnimating, CLICK_MOVE_THRESHOLD = 5;

// 便捷访问 (向后兼容部分代码)
var alarmElements = {};
var lampOnColor, zeroColor;

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
    dayImage: 'http://192.168.161.1:9000/greenhouse_day.png',
    nightImage: 'http://192.168.161.1:9000/greenhouse_night.png',
    demoMode: false,
    showDemoButtons: false,
    refreshInterval: 3000,
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
let demoMode = false;
let currentPage = 'scene';
let els = {};
let refreshTimer = null;
let debugSliding = {};
let debugLockUntil = {};
let rpcPending = { device01: {}, device02: {}, device11: {}, device12: {} };

// 历史数据缓存（按设备分开）
const historyBuffer = {
  device01: { temperature:[],airHumidity:[],soilHumidity:[],lightIntensity:[],waterLevel:[],co2:[] },
  device02: { temperature:[],airHumidity:[],soilHumidity:[],lightIntensity:[],waterLevel:[],co2:[] },
  device11: { temperature:[],airHumidity:[],soilHumidity:[],lightIntensity:[],waterLevel:[],co2:[] },
  device12: { temperature:[],airHumidity:[],soilHumidity:[],lightIntensity:[],waterLevel:[],co2:[] }
};

// ========== RPC Pending 合并 (按设备隔离) ==========
function mergeTelemetryWithPending(data, deviceKey) {
  var merged = {};
  for (var k in data) { if (data.hasOwnProperty(k)) merged[k] = data[k]; }
  var pending = rpcPending[deviceKey] || {};
  var now = Date.now();
  var execKeys = ['autoMode', 'fanStatus', 'pumpStatus', 'lampStatus', 'sprayStatus'];
  for (var i = 0; i < execKeys.length; i++) {
    var key = execKeys[i];
    var p = pending[key];
    if (!p) continue;
    if (merged[key] === p.value) {
      console.log('[RPC CONFIRMED] ' + deviceKey + ' ' + key + '=' + p.value + ' (delay ' + (now - p.startedAt) + 'ms)');
      delete pending[key];
    } else if (now - p.startedAt > 10000) {
      console.warn('[RPC TIMEOUT] ' + deviceKey + ' ' + key + ' expected=' + p.value + ' got=' + merged[key]);
      delete pending[key];
    } else {
      console.log('[RPC PENDING] ' + deviceKey + ' keep ' + key + '=' + p.value + ' (incoming=' + merged[key] + ')');
      merged[key] = p.value;
    }
  }
  return merged;
}

// ========== 从 ThingsBoard 读取数据 (按 datasource 区分) ==========
function parseBool(value) {
    return value === true || value === 'true' || value === 1 || value === '1' || value === 'True';
}

function readTelemetryData(ctx) {
    var result = { device01: {}, device02: {}, device11: {}, device12: {} };
    if (!ctx || !ctx.data) return result;

    for (var i = 0; i < ctx.data.length; i++) {
        var item = ctx.data[i];
        var deviceKey = getDeviceKeyFromItem(item);
        if (!deviceKey) continue;

        var key = item.dataKey ? item.dataKey.name : null;
        if (!key) continue;
        if (!item.data || item.data.length === 0) continue;

        var lastEntry = item.data[item.data.length - 1];
        var value = lastEntry.length > 1 ? lastEntry[1] : lastEntry[0];

        if (key === 'fanStatus' || key === 'pumpStatus' || key === 'lampStatus' ||
            key === 'sprayStatus' || key === 'autoMode' ||
            key === 'soilAlarm' || key === 'soilOverAlarm' ||
            key === 'tempAlarm' || key === 'tempLowAlarm' ||
            key === 'waterAlarm' || key === 'waterOverAlarm' || key === 'co2Alarm') {
            result[deviceKey][key] = parseBool(value);
        } else {
            result[deviceKey][key] = Number(value) || 0;
        }
    }
    return result;
}

function getDeviceKeyFromItem(item) {
    if (!item.datasource) return 'device01'; // 旧版兼容
    var dsName = item.datasource.name || '';
    var entityName = item.datasource.entityName || '';
    var aliasId = item.datasource.entityAliasId || '';

    // 精确匹配
    if (dsName === 'GH11_Device' || entityName === 'Greenhouse_Device_11') return 'device11';
    if (dsName === 'GH12_Device' || entityName === 'Greenhouse_Device_12') return 'device12';
    if (dsName === 'GH02_Device' || entityName === 'Greenhouse_Device_02') return 'device02';
    if (dsName === 'Greenhouse' || entityName === 'Greenhouse_Device_01') return 'device01';

    // aliasId 匹配
    if (aliasId === '51f6cf60-5c29-11f1-bd9f-8392d05e68a2') return 'device11';
    if (aliasId === '51ff5ae0-5c29-11f1-bd9f-8392d05e68a2') return 'device12';

    // 字符串 fallback
    var combined = dsName + entityName;
    if (combined.indexOf('12') >= 0) return 'device12';
    if (combined.indexOf('11') >= 0) return 'device11';
    if (combined.indexOf('02') >= 0) return 'device02';
    if (combined.indexOf('01') >= 0) return 'device01';

    return 'device01';
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
        // Device switch
        switchTab01: q('.tb-switch-tab-01'),
        switchTab02: q('.tb-switch-tab-02'),
        switchTab11: q('.tb-switch-tab-11'),
        switchTab12: q('.tb-switch-tab-12'),
        deviceLabel: q('.tb-device-label'),
        // Debug panel
        debugPanel: q('.tb-debug-panel'),
        debugToggle: q('#tb-debug-toggle'),
        debugBody: q('#tb-debug-body'),
        dbgStatus: q('#dbg-status'),
        dbgLiveSliders: container.querySelectorAll('.dbg-slider-live')
    };
    container.querySelectorAll('.tb-spray-effect').forEach(el => {
        createSprayParticles(el, 45, 70);
    });
}

// ========== 更新背景 ==========
function applySceneMode(mode) {
    sceneMode = mode;
    if (!els.stage) return;
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
    if (scene && threeReady) {
        if (mode === 'day') {
            scene.background = new THREE.Color('#1a3050');
        } else {
            scene.background = new THREE.Color('#020b12');
        }
    }
}

// ========== 更新数据面板 (根据 activeDeviceKey) ==========
function updateDataPanel(data) {
    if (!els.valTemp) return;
    els.valTemp.textContent = (data.temperature || 0).toFixed(1);
    els.valHum.textContent = (data.airHumidity || 0).toFixed(1);
    els.valSoil.textContent = (data.soilHumidity || 0).toFixed(1);
    els.valLight.textContent = Math.round(data.lightIntensity || 0);
    els.valCO2.textContent = Math.round(data.co2 || 0);
    els.valWater.textContent = (data.waterLevel || 0).toFixed(1);

    if (els.waterLevelFill) {
        els.waterLevelFill.style.width = (data.waterLevel || 0) + '%';
        els.waterLevelFill.classList.toggle('tb-low', (data.waterLevel || 0) < 20);
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
    // 双向告警: danger(红) > warn(橙) > cold(蓝) > normal
    updateAlarmRowBidir(els.alarmSoil, els.textAlarmSoil, data.soilAlarm, 'tb-alert', '土壤干旱',
                        data.soilOverAlarm, 'tb-alert-warn', '土壤过湿');
    updateAlarmRowBidir(els.alarmTemp, els.textAlarmTemp, data.tempAlarm, 'tb-alert', '温度过高',
                        data.tempLowAlarm, 'tb-alert-cold', '温度过低');
    updateAlarmRowBidir(els.alarmWater, els.textAlarmWater, data.waterAlarm, 'tb-alert', '水位过低',
                        data.waterOverAlarm, 'tb-alert-warn', '水位过高');
    // CO2 单向不变
    var co2Alert = data.co2Alarm;
    if (els.alarmCO2) els.alarmCO2.classList.toggle('tb-alert', co2Alert);
    if (els.textAlarmCO2) els.textAlarmCO2.textContent = co2Alert ? 'CO₂过高' : '正常';
}

function updateAlarmRowBidir(row, textEl, dangerOn, dangerClass, dangerText, warnOn, warnClass, warnText) {
    if (!row) return;
    row.classList.remove('tb-alert', 'tb-alert-warn', 'tb-alert-cold');
    if (dangerOn) {
        row.classList.add(dangerClass);
        if (textEl) textEl.textContent = dangerText;
    } else if (warnOn) {
        row.classList.add(warnClass);
        if (textEl) textEl.textContent = warnText;
    } else {
        if (textEl) textEl.textContent = '正常';
    }
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

// ========== 更新特效 (仅活跃设备) ==========
function updateEffects(data) {
    const isNight = sceneMode === 'night';
    const lampOn = data.lampStatus;
    // 2D CSS effects now only reflect active device
    [els.lampGlowLeftMain, els.lampGlowRightMain,
     els.lampGlowLeftMid, els.lampGlowRightMid].forEach(el => {
        if (!el) return;
        el.classList.toggle('active', lampOn);
        el.style.opacity = lampOn ? (isNight ? '0.4' : '0.2') : '0';
    });
    if (els.fanEffectLeft) els.fanEffectLeft.classList.toggle('active', data.fanStatus);
    if (els.fanEffectRight) els.fanEffectRight.classList.toggle('active', data.fanStatus);
    if (els.fanEffectLeftBack) els.fanEffectLeftBack.classList.toggle('active', data.fanStatus);
    if (els.fanEffectRightBack) els.fanEffectRightBack.classList.toggle('active', data.fanStatus);
    if (els.sprayLeftFront) els.sprayLeftFront.classList.toggle('active', data.sprayStatus);
    if (els.sprayLeftMid) els.sprayLeftMid.classList.toggle('active', data.sprayStatus);
    if (els.sprayRightMid) els.sprayRightMid.classList.toggle('active', data.sprayStatus);
    if (els.sprayRightFront) els.sprayRightFront.classList.toggle('active', data.sprayStatus);
    if (els.pipeFlowLeft) els.pipeFlowLeft.classList.toggle('active', data.pumpStatus);
    if (els.pipeFlowRight) els.pipeFlowRight.classList.toggle('active', data.pumpStatus);
    const soilAlert = data.soilAlarm || data.soilHumidity < 30;
    if (els.soilWarningArea) els.soilWarningArea.classList.toggle('active', soilAlert);
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

// ========== RPC 控制 (发送给当前活跃设备) ==========
function sendRpcToActiveDevice(method, value) {
    var meta = deviceMeta[activeDeviceKey];
    if (!meta || !meta.deviceId) {
        console.error('[RPC] Unknown device: ' + activeDeviceKey);
        return;
    }
    var url = '/api/rpc/oneway/' + meta.deviceId;
    var body = { method: method, params: value };

    console.log('[RPC] ' + activeDeviceKey + ' ' + method + ' = ' + value + ' -> ' + meta.deviceId);

    if (self.ctx && self.ctx.http) {
        var result = self.ctx.http.post(url, body);
        if (result && typeof result.subscribe === 'function') {
            result.subscribe(
                function() { console.log('[RPC OK] ' + activeDeviceKey + ' ' + method); },
                function(err) { console.error('[RPC FAIL] ' + activeDeviceKey + ' ' + method, err); }
            );
        } else if (result && typeof result.then === 'function') {
            result.then(
                function() { console.log('[RPC OK] ' + activeDeviceKey + ' ' + method); }
            ).catch(function(err) { console.error('[RPC FAIL] ' + activeDeviceKey + ' ' + method, err); });
        }
    } else if (self.ctx && self.ctx.controlApi) {
        // Fallback: 使用 controlApi (只对默认设备有效)
        console.warn('[RPC] http not available, using controlApi fallback');
        self.ctx.controlApi.sendOneWayCommand(method, value, 3000);
    } else {
        console.error('[RPC] No transport available');
    }
}

// 发送 RPC 到指定设备 (用于广播场景如 hourOfDay)
function sendRpcToDevice(deviceKey, deviceId, method, value) {
    var url = '/api/rpc/oneway/' + deviceId;
    var body = { method: method, params: value };
    console.log('[RPC BROADCAST] ' + deviceKey + ' ' + method + ' = ' + JSON.stringify(value));
    if (self.ctx && self.ctx.http) {
        var result = self.ctx.http.post(url, body);
        if (result && typeof result.subscribe === 'function') result.subscribe(function(){}, function(err){ console.error('[RPC FAIL] '+deviceKey, err); });
        else if (result && typeof result.then === 'function') result.then(function(){}).catch(function(err){ console.error('[RPC FAIL] '+deviceKey, err); });
    }
}

// 兼容旧 sendRpc 调用 (测试场景用)
function sendRpc(method, value) {
    sendRpcToActiveDevice(method, value);
}

// ========== 历史数据缓存 (按 activeDevice) ==========
function pushHistory(data) {
    var buf = historyBuffer[activeDeviceKey];
    if (!buf) return;
    var keys = ['temperature', 'airHumidity', 'soilHumidity', 'lightIntensity', 'waterLevel', 'co2'];
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (!buf[key]) buf[key] = [];
        buf[key].push(parseFloat(data[key]) || 0);
        if (buf[key].length > CONFIG.historyMaxPoints) {
            buf[key].shift();
        }
    }
}

// ========== SVG 折线图绘制 ==========
function drawChart(chartKey) {
    var cfg = chartConfigs[chartKey];
    if (!cfg) return;
    var svg = document.getElementById(cfg.svgId);
    if (!svg) return;
    svg.innerHTML = '';
    var buf = historyBuffer[activeDeviceKey];
    if (!buf) return;

    var vbW = 800, vbH = 200;
    var margin = { top: 12, right: 30, bottom: 20, left: 38 };
    var plotW = vbW - margin.left - margin.right;
    var plotH = vbH - margin.top - margin.bottom;

    for (var g = 0; g <= 4; g++) {
        var gy = margin.top + (plotH / 4) * g;
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', margin.left); line.setAttribute('y1', gy);
        line.setAttribute('x2', vbW - margin.right); line.setAttribute('y2', gy);
        line.setAttribute('class', 'tb-chart-grid-line');
        svg.appendChild(line);
    }
    var axTop = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axTop.setAttribute('x1', margin.left); axTop.setAttribute('y1', margin.top);
    axTop.setAttribute('x2', margin.left); axTop.setAttribute('y2', vbH - margin.bottom);
    axTop.setAttribute('class', 'tb-chart-axis'); svg.appendChild(axTop);
    var axBot = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axBot.setAttribute('x1', margin.left); axBot.setAttribute('y1', vbH - margin.bottom);
    axBot.setAttribute('x2', vbW - margin.right); axBot.setAttribute('y2', vbH - margin.bottom);
    axBot.setAttribute('class', 'tb-chart-axis'); svg.appendChild(axBot);

    for (var s = 0; s < cfg.series.length; s++) {
        var key = cfg.series[s];
        var data = buf[key];
        if (!data || data.length < 2) continue;
        var yMin = cfg.yMin[s], yMax = cfg.yMax[s];
        var yRange = yMax - yMin;
        if (yRange <= 0) yRange = 1;
        var points = [];
        for (var p = 0; p < data.length; p++) {
            var x = margin.left + (p / (CONFIG.historyMaxPoints - 1)) * plotW;
            var yNorm = (data[p] - yMin) / yRange;
            yNorm = Math.max(0, Math.min(1, yNorm));
            var y = margin.top + plotH - yNorm * plotH;
            points.push(x.toFixed(1) + ',' + y.toFixed(1));
        }
        var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        poly.setAttribute('points', points.join(' '));
        poly.setAttribute('class', 'tb-chart-line');
        poly.setAttribute('stroke', cfg.colors[s]);
        svg.appendChild(poly);
        var lastX = margin.left + ((data.length - 1) / (CONFIG.historyMaxPoints - 1)) * plotW;
        var lastYNorm = (data[data.length - 1] - yMin) / yRange;
        lastYNorm = Math.max(0, Math.min(1, lastYNorm));
        var lastY = margin.top + plotH - lastYNorm * plotH;
        var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', lastX); dot.setAttribute('cy', lastY);
        dot.setAttribute('r', '3'); dot.setAttribute('class', 'tb-chart-dot');
        dot.setAttribute('fill', cfg.colors[s]);
        svg.appendChild(dot);
    }
    if (cfg.series.length > 0) {
        for (var gl = 0; gl <= 4; gl++) {
            var yVal = cfg.yMin[0] + (cfg.yMax[0] - cfg.yMin[0]) * (1 - gl / 4);
            var labelY = margin.top + (plotH / 4) * gl;
            var txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', margin.left - 4); txt.setAttribute('y', labelY + 3);
            txt.setAttribute('class', 'tb-chart-label'); txt.setAttribute('text-anchor', 'end');
            txt.textContent = Math.round(yVal);
            svg.appendChild(txt);
        }
    }
}

function updateAllCharts() {
    for (var ck in chartConfigs) {
        if (chartConfigs.hasOwnProperty(ck)) drawChart(ck);
    }
}

function formatTrendValue(key, value) {
    var n = Number(value);
    if (isNaN(n)) return '--';
    if (key === 'temperature' || key === 'airHumidity' || key === 'soilHumidity' || key === 'waterLevel')
        return n.toFixed(1);
    if (key === 'lightIntensity' || key === 'co2') return Math.round(n).toString();
    return n.toString();
}

function updateSummaryCards(data) {
    var container = document.getElementById('tb-chart-summary');
    if (!container) return;
    var vals = container.querySelectorAll('.tb-summary-val');
    for (var i = 0; i < vals.length; i++) {
        var key = vals[i].dataset.key;
        if (key && data[key] !== undefined) vals[i].textContent = formatTrendValue(key, data[key]);
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
        if (dp === currentPage) dots[i].classList.add('active');
        else dots[i].classList.remove('active');
    }
}

// ========== 设备切换 ==========
function switchActiveDevice(deviceKey) {
    if (activeDeviceKey === deviceKey) return;
    console.log('[DEVICE SWITCH] ' + activeDeviceKey + ' -> ' + deviceKey);
    activeDeviceKey = deviceKey;
    currentData = deviceData[activeDeviceKey] || {};

    updateDeviceSwitchUI();
    updateDataPanel(currentData);
    updateAlarms(currentData);
    updateBottomBar(currentData);
    updateHeader(currentData);
    updateControlPanel(currentData);
    syncDebugSliders(currentData);
    updateAllCharts();
    updateSummaryCards(currentData);
    updateActiveGreenhouseHighlight(deviceKey);
    updateSkyByHour(currentData.hourOfDay);
    updateRoadLightsByHour(currentData.hourOfDay);
    if (ENABLE_STREET_LIGHTS) updateStreetLightsByHour(currentData.hourOfDay);
    var panelTitle = document.querySelector('.tb-panel-title-device');
    if (panelTitle) {
        panelTitle.textContent = deviceMeta[deviceKey].name;
    }
}

function updateDeviceSwitchUI() {
    var allTabs = { device01: els.switchTab01, device02: els.switchTab02, device11: els.switchTab11, device12: els.switchTab12 };
    for (var dk in allTabs) {
        if (allTabs[dk]) allTabs[dk].classList.toggle('active', activeDeviceKey === dk);
    }
    if (els.deviceLabel) {
        var meta = deviceMeta[activeDeviceKey];
        els.deviceLabel.textContent = (meta && meta.label || activeDeviceKey) + ' | ' + (meta && meta.name || '');
    }
}

function updateActiveGreenhouseHighlight(deviceKey) {
    var allKeys = ['device01','device02','device11','device12'];
    allKeys.forEach(function(dk) {
        var unit = greenhouseUnits[dk];
        if (!unit || !unit.group) return;
        // 通过 userData.filmMaterial 精准定位每个大棚的独立棚膜材质
        var filmMat = unit.group.userData && unit.group.userData.filmMaterial;
        if (filmMat) {
            filmMat.opacity = dk === deviceKey ? 0.30 : 0.18;
        }
    });
}
// ========== 控制面板 ==========
function updateControlPanel(data) {
    var ctrlStateMap = {
        'fanStatus':  { el: els.ctrlFan,  onText: '运行', offText: '停止' },
        'pumpStatus': { el: els.ctrlPump, onText: '运行', offText: '停止' },
        'lampStatus': { el: els.ctrlLamp, onText: '开启', offText: '关闭' },
        'sprayStatus':{ el: els.ctrlSpray, onText: '运行', offText: '停止' },
        'autoMode':   { el: els.ctrlAuto, onText: '自动', offText: '手动' }
    };
    for (var key in ctrlStateMap) {
        if (!ctrlStateMap.hasOwnProperty(key)) continue;
        var map = ctrlStateMap[key];
        if (!map.el) continue;
        var isOn = data[key];
        map.el.textContent = isOn ? map.onText : map.offText;
        var btn = map.el.closest('.tb-ctrl-btn');
        if (btn) {
            if (isOn) btn.classList.add('active');
            else btn.classList.remove('active');
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
    // autoMode 已在 onDataUpdated 中保护，这里用 mergeTelemetryWithPending 处理其他 pending
    currentData = mergeTelemetryWithPending(data, activeDeviceKey);
    // autoMode 直接从 deviceData 继承 (已在 onDataUpdated 中确定最终值)
    if (deviceData[activeDeviceKey] && deviceData[activeDeviceKey].autoMode !== undefined) {
        currentData.autoMode = deviceData[activeDeviceKey].autoMode;
    }
    // 同步回 deviceData (含 pending 覆盖的执行器状态)
    if (deviceData[activeDeviceKey]) {
        for (var k in currentData) {
            if (currentData.hasOwnProperty(k)) deviceData[activeDeviceKey][k] = currentData[k];
        }
    }
    console.log('[TELEMETRY IN] ' + activeDeviceKey + ' autoMode=' + currentData.autoMode + ' soil=' + data.soilHumidity + ' temp=' + data.temperature);

    if (!demoMode) {
        var h = data.hourOfDay !== undefined ? data.hourOfDay : 12;
        var newMode = (h >= 6 && h < 18) ? 'day' : 'night';
        if (newMode !== sceneMode) applySceneMode(newMode);
    }

    update3DModels();
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
        if (self.ctx && self.ctx.data) {
            var realData = readTelemetryData(self.ctx);
            var activeData = realData[activeDeviceKey] || {};
            updateDashboard(activeData);
        }
        document.querySelectorAll('.tb-mock-btn').forEach(function(btn) { btn.classList.remove('active'); });
        return;
    }
    var scenarioData = mockScenarios[sceneName];
    if (!scenarioData) return;
    demoMode = true;
    currentScenario = sceneName;
    if (sceneName === 'normalDay') applySceneMode('day');
    else if (sceneName === 'nightLamp') applySceneMode('night');
    var data = {};
    for (var key in scenarioData) {
        if (scenarioData.hasOwnProperty(key)) data[key] = scenarioData[key];
    }
    data.lightIntensity = sceneMode === 'night' ? 100 : 600;
    updateDashboard(data);
    document.querySelectorAll('.tb-mock-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.scene === sceneName);
    });
}

// ========== 3D Scene Initialization ==========
function initThree() {
  rootEl = self.ctx.$container[0] || self.ctx.$container;
  if (!rootEl) { console.error('[3D V2] No root element'); return; }
  containerEl = rootEl.querySelector('.tb-3d-canvas');
  if (!containerEl) { console.error('[3D V2] No canvas container'); return; }
  if (!THREE) { console.error('[3D V2] THREE not loaded'); return; }

  var w = containerEl.clientWidth;
  var h = containerEl.clientHeight;

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

    // Camera on water-tank side (-X, -Z), framing greenhouses + road + river
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 120);
    camera.position.set(-25, 15, -18);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    controls.target.set(0, 1.2, 1.5);  // looking at greenhouse row center
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.DOLLY
    };
    controls.minDistance = 3;
    controls.maxDistance = 45;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.update();

    // Shared scene elements
    createLighting();
    createGround();
    createMainRoadLeft();
    createFrontPath();
    createRiverRight();
    createSkySystem();
    updateSkyByHour(12); // default day
    updateRoadLightsByHour(12);
    if (ENABLE_STREET_LIGHTS) updateStreetLightsByHour(12);

    // Create 4 greenhouse units in a horizontal row
    // Greenhouse: 8 wide (halfW=4), center spacing=11 → 3-unit gap between neighbors
    // Layout: left road(x=-24) | [-16.5][-5.5][5.5][16.5] | right river(x=24)
    var unitPositions = {
      device01: new THREE.Vector3(-16.5, 0, 1.5),
      device02: new THREE.Vector3(-5.5, 0, 1.5),
      device11: new THREE.Vector3(5.5, 0, 1.5),
      device12: new THREE.Vector3(16.5, 0, 1.5)
    };
    for (var dk in unitPositions) {
      if (!unitPositions.hasOwnProperty(dk)) continue;
      var unit = createGreenhouseUnit({
        id: dk,
        label: deviceMeta[dk] ? deviceMeta[dk].label : dk,
        position: unitPositions[dk],
        ghConfig: { width: 8, length: 12, height: 4, halfW: 4, halfL: 6 }
      });
      scene.add(unit);
      greenhouseUnits[dk].group = unit;
    }

    if (ENABLE_FARMLAND) createSurroundingFarmland();

    setupUIHandlers();
    attachResizeObserver();

    threeReady = true;
    console.log('[3D V2] Quad greenhouse + farmland scene ready');

    function afterNextPaint(cb) {
      requestAnimationFrame(function() { requestAnimationFrame(cb); });
    }

    startRenderLoop();
    initRaycaster();

    afterNextPaint(function() {
      resize3D(true);
      renderer.render(scene, camera);
      console.log('[3D V2] First paint after next paint');
    });

    [100, 300, 600, 1000].forEach(function(delay) {
      setTimeout(function() {
        resize3D(true);
        renderer.render(scene, camera);
      }, delay);
    });

    setTimeout(function() {
      if (scene) scene.background = new THREE.Color('#020b12');
      console.log('[3D V2] Background restored');
    }, 2500);

  } catch (e) {
    console.error('[3D V2] Init failed:', e);
    if (containerEl) containerEl.innerHTML = '<div style="color:#ff3860;padding:40px;">Init error: ' + e.message + '</div>';
  }
}

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

function setupUIHandlers() {
  console.log('[3D V2] setupUIHandlers: no-op in Full Scene');
}

// ========== Shared Scene Elements ==========
var skySystem = { skyDome: null, stars: null, sunMesh: null, moonMesh: null, ambientLight: null, sunLight: null, fillLight: null };

function createLighting() {
  skySystem.ambientLight = new THREE.AmbientLight('#3a5070', 3.0);
  scene.add(skySystem.ambientLight);
  skySystem.sunLight = new THREE.DirectionalLight('#fff8e8', 2.5);
  skySystem.sunLight.position.set(10, 14, 8);
  skySystem.sunLight.castShadow = true;
  skySystem.sunLight.shadow.mapSize.set(2048, 2048);
  skySystem.sunLight.shadow.camera.near = 0.5; skySystem.sunLight.shadow.camera.far = 50;
  skySystem.sunLight.shadow.camera.left = -30; skySystem.sunLight.shadow.camera.right = 30;
  skySystem.sunLight.shadow.camera.top = 14; skySystem.sunLight.shadow.camera.bottom = -14;
  skySystem.sunLight.shadow.bias = -0.0005; skySystem.sunLight.shadow.normalBias = 0.04;
  scene.add(skySystem.sunLight);
  skySystem.fillLight = new THREE.DirectionalLight('#4466aa', 0.6);
  skySystem.fillLight.position.set(-4, 4, -4);
  scene.add(skySystem.fillLight);
}

function createSkySystem() {
  // 天空穹顶
  var skyGeo = new THREE.SphereGeometry(80, 32, 16);
  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#6bbcff') },
      bottomColor: { value: new THREE.Color('#d8f2ff') },
      offset: { value: 20 },
      exponent: { value: 0.6 }
    },
    vertexShader: 'varying vec3 vWorldPosition; void main() { vec4 wp=modelMatrix*vec4(position,1.0); vWorldPosition=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main() { float h=normalize(vWorldPosition+vec3(0,offset,0)).y; gl_FragColor=vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0); }'
  });
  skySystem.skyDome = new THREE.Mesh(skyGeo, skyMat);
  skySystem.skyDome.renderOrder = -10;
  scene.add(skySystem.skyDome);

  // 太阳
  var sunGeo = new THREE.SphereGeometry(1.5, 16, 16);
  var sunMat = new THREE.MeshBasicMaterial({ color: '#fffbe6' });
  skySystem.sunMesh = new THREE.Mesh(sunGeo, sunMat);
  skySystem.sunMesh.position.set(30, 40, -50);
  skySystem.sunMesh.renderOrder = -5;
  scene.add(skySystem.sunMesh);

  // 满月 (same position as sun, visible at night)
  var moonGroup = new THREE.Group();
  var moonGeo = new THREE.SphereGeometry(1.3, 24, 24);
  var moonMat = new THREE.MeshBasicMaterial({ color: '#f8f4e8' });
  var moonBody = new THREE.Mesh(moonGeo, moonMat);
  moonGroup.add(moonBody);
  // Moon glow halo
  var haloGeo = new THREE.SphereGeometry(1.9, 24, 24);
  var haloMat = new THREE.MeshBasicMaterial({ color: '#e8e0d0', transparent: true, opacity: 0.25, depthWrite: false });
  var halo = new THREE.Mesh(haloGeo, haloMat);
  moonGroup.add(halo);
  moonGroup.position.set(30, 40, -50);
  moonGroup.renderOrder = -5;
  moonGroup.visible = false;
  skySystem.moonMesh = moonGroup;
  scene.add(skySystem.moonMesh);

  // 星空
  var starCount = 500;
  var starGeo = new THREE.BufferGeometry();
  var starPositions = new Float32Array(starCount * 3);
  for (var i = 0; i < starCount; i++) {
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.random() * Math.PI * 0.45;
    var r = 75 + Math.random() * 5;
    starPositions[i*3] = Math.cos(theta) * Math.cos(phi) * r;
    starPositions[i*3+1] = Math.abs(Math.sin(phi) * r) + 3;
    starPositions[i*3+2] = Math.sin(theta) * Math.cos(phi) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  var starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, transparent: true, opacity: 0, depthWrite: false });
  skySystem.stars = new THREE.Points(starGeo, starMat);
  skySystem.stars.renderOrder = -8;
  skySystem.stars.visible = false;
  scene.add(skySystem.stars);

  console.log('[Sky] System created');
}

function updateSkyByHour(hour) {
  if (!skySystem.skyDome || !skySystem.stars || !skySystem.sunMesh) return;
  var hNum = Number(hour) || 12;
  var isDay = hNum >= 6 && hNum < 18;

  if (isDay) {
    // 白天
    skySystem.skyDome.visible = true;
    skySystem.skyDome.material.uniforms.topColor.value.set('#6bbcff');
    skySystem.skyDome.material.uniforms.bottomColor.value.set('#d8f2ff');
    skySystem.sunMesh.visible = true;
    if (skySystem.moonMesh) skySystem.moonMesh.visible = false;
    skySystem.stars.visible = false;
    skySystem.stars.material.opacity = 0;
    skySystem.ambientLight.intensity = 3.97;
    skySystem.sunLight.intensity = 3.55;
    skySystem.fillLight.intensity = 1.1;
    scene.background = new THREE.Color('#87ceeb');
  } else {
    // 夜晚
    skySystem.skyDome.visible = true;
    skySystem.skyDome.material.uniforms.topColor.value.set('#0a1020');
    skySystem.skyDome.material.uniforms.bottomColor.value.set('#0d1a2d');
    skySystem.sunMesh.visible = false;
    if (skySystem.moonMesh) skySystem.moonMesh.visible = true;
    skySystem.stars.visible = true;
    skySystem.stars.material.opacity = 0.8;
    skySystem.ambientLight.intensity = 0.35;
    skySystem.sunLight.intensity = 0.2;
    skySystem.fillLight.intensity = 0.15;
    scene.background = new THREE.Color('#020b12');
  }
  console.log('[Sky] hour=' + hNum.toFixed(1) + ' ' + (isDay ? 'DAY' : 'NIGHT'));
}

function createGround() {
  // Larger base ground: grass-green, spans full scene
  var matGrass = new THREE.MeshStandardMaterial({ color: '#2a3a20', roughness: 0.9 });
  var g = new THREE.Mesh(new THREE.PlaneGeometry(60, 28), matGrass);
  g.rotation.x = -Math.PI / 2; g.position.y = -0.01; g.receiveShadow = true;
  scene.add(g);
}

var roadLights = []; // main road street lights

function createMainRoadLeft() {
  // Wide main road with center dashed line + edge lines + street lights
  var matRoad = new THREE.MeshStandardMaterial({ color: '#25292c', roughness: 0.9 });
  var matLineWhite = new THREE.MeshBasicMaterial({ color: '#dce8ee', depthTest: true });
  var matLineYellow = new THREE.MeshBasicMaterial({ color: '#f0d888', depthTest: true });
  var roadW = 3.5, roadL = 22, roadX = -24, roadZ = 0;

  // Road surface
  var road = new THREE.Mesh(new THREE.PlaneGeometry(roadW, roadL), matRoad);
  road.rotation.x = -Math.PI / 2; road.position.set(roadX, 0.012, roadZ); road.receiveShadow = true;
  scene.add(road);

  // Edge lines (continuous white)
  [-roadW/2 + 0.15, roadW/2 - 0.15].forEach(function(off) {
    var edge = new THREE.Mesh(new THREE.PlaneGeometry(0.08, roadL), matLineWhite);
    edge.rotation.x = -Math.PI / 2; edge.position.set(roadX + off, 0.018, roadZ); scene.add(edge);
  });

  // Center dashed line (yellow)
  for (var dz = -9; dz <= 9; dz += 1.3) {
    var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.7), matLineYellow);
    dash.rotation.x = -Math.PI / 2; dash.position.set(roadX, 0.018, dz); scene.add(dash);
  }

  // ===== Street lights along outer side only (away from greenhouses) =====
  var lh = 3.2; // pole height
  var matPole = new THREE.MeshStandardMaterial({ color: '#303840', roughness: 0.4, metalness: 0.6 });
  [-1].forEach(function(side) {
    var lx = roadX + side * (roadW / 2 + 0.7);
    for (var lz = -7.5; lz <= 9; lz += 3.5) {
      var pole = new THREE.Group();

      // Pole
      var poleGeo = new THREE.CylinderGeometry(0.05, 0.07, lh, 8);
      var poleMesh = new THREE.Mesh(poleGeo, matPole);
      poleMesh.position.y = lh / 2; poleMesh.castShadow = true; pole.add(poleMesh);

      // Arm toward road
      var armGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6);
      var arm = new THREE.Mesh(armGeo, matPole);
      arm.rotation.z = Math.PI / 2; arm.position.set(-side * 0.35, lh - 0.15, 0); pole.add(arm);

      // Lamp head
      var headGeo = new THREE.BoxGeometry(0.2, 0.1, 0.3);
      var headMat = new THREE.MeshStandardMaterial({ color: '#ffe8c0', roughness: 0.3, emissive: '#000', emissiveIntensity: 0 });
      var headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.set(-side * 0.7, lh - 0.2, 0); headMesh.name = 'lampHead'; pole.add(headMesh);

      // Glow cone (night only)
      var coneGeo = new THREE.ConeGeometry(0.4, 1.5, 8);
      var coneMat = new THREE.MeshBasicMaterial({ color: '#ffe8c0', transparent: true, opacity: 0, depthWrite: false });
      var coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(-side * 0.7, lh - 1.0, 0); coneMesh.name = 'glowCone'; pole.add(coneMesh);

      // Point light
      var ptLight = new THREE.PointLight('#ffd28a', 0, 6, 1.5);
      ptLight.position.set(-side * 0.7, lh - 0.35, 0); ptLight.name = 'ptLight'; pole.add(ptLight);

      pole.position.set(lx, 0, lz);
      scene.add(pole);

      roadLights.push({
        group: pole, head: headMesh, headMat: headMat,
        cone: coneMesh, coneMat: coneMat, light: ptLight
      });
    }
  });
}

function createFrontPath() {
  // Horizontal path in front of greenhouses
  var matPath = new THREE.MeshStandardMaterial({ color: '#5a5550', roughness: 0.85 });
  var pathW = 1.7, pathL = 42, pathZ = -5.5;

  var path = new THREE.Mesh(new THREE.PlaneGeometry(pathL, pathW), matPath);
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.01, pathZ); path.receiveShadow = true;
  scene.add(path);

  // Connect to main road (L-shaped corner)
  var corner = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.7), matPath);
  corner.rotation.x = -Math.PI / 2; corner.position.set(-24, 0.011, -5.5); corner.receiveShadow = true;
  scene.add(corner);
}

var riverObjects = null; // { water, waves } for animation

function createRiverRight() {
  // 3D river: riverbed + banks + natural blue-green water + curved ripples
  var rivW = 3.5, rivL = 22, rivX = 24, rivZ = 0;
  var bankW = 0.5, bankH = 0.25;
  var halfW = rivW / 2;

  var rivGroup = new THREE.Group(); rivGroup.name = 'river3D';

  // Riverbed (dark, below water)
  var matBed = new THREE.MeshStandardMaterial({ color: '#083544', roughness: 0.95 });
  var bed = new THREE.Mesh(new THREE.PlaneGeometry(rivW, rivL), matBed);
  bed.rotation.x = -Math.PI / 2; bed.position.set(rivX, -0.08, rivZ); rivGroup.add(bed);

  // Left bank
  var matBank = new THREE.MeshStandardMaterial({ color: '#4f5a36', roughness: 0.9 });
  var bankL = new THREE.Mesh(new THREE.BoxGeometry(bankW, bankH, rivL), matBank);
  bankL.position.set(rivX - halfW - bankW/2, bankH/2, rivZ); bankL.receiveShadow = true; rivGroup.add(bankL);

  // Right bank
  var bankR = new THREE.Mesh(new THREE.BoxGeometry(bankW, bankH, rivL), matBank);
  bankR.position.set(rivX + halfW + bankW/2, bankH/2, rivZ); bankR.receiveShadow = true; rivGroup.add(bankR);

  // Main water surface (natural blue-green, semi-transparent)
  var matWater = new THREE.MeshStandardMaterial({ color: '#1b88a8', roughness: 0.18, metalness: 0.05,
    transparent: true, opacity: 0.68, depthWrite: false });
  var water = new THREE.Mesh(new THREE.PlaneGeometry(rivW - 0.1, rivL - 0.1), matWater);
  water.rotation.x = -Math.PI / 2; water.position.set(rivX, 0.006, rivZ);
  water.renderOrder = 1; water.name = 'waterSurface'; rivGroup.add(water);

  // Edge shadow strips (dark, near banks, depth cue)
  var matShadow = new THREE.MeshBasicMaterial({ color: '#061f29', transparent: true, opacity: 0.28, depthWrite: false });
  [-halfW + 0.25, halfW - 0.25].forEach(function(sx) {
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(0.45, rivL - 0.5), matShadow);
    sh.rotation.x = -Math.PI / 2; sh.position.set(rivX + sx, 0.008, rivZ);
    sh.renderOrder = 2; rivGroup.add(sh);
  });

  // Curved ripples using Line segments (short, slightly bent, flowing along z)
  var lineMatRipple = new THREE.LineBasicMaterial({ color: '#a8efff', transparent: true, opacity: 0.28, depthTest: true, depthWrite: false });
  var lineGeos = []; // store for animation
  var waveCount = 28;
  for (var i = 0; i < waveCount; i++) {
    var cx = rivX + (Math.random() - 0.5) * (rivW - 0.6);
    var cz = -11 + Math.random() * rivL;
    var len = 0.8 + Math.random() * 1.8;
    var bend = (Math.random() - 0.5) * 0.4;
    var angle = (Math.random() - 0.5) * 0.6;

    var pts = [
      new THREE.Vector3(cx - len/2, 0.01, cz - bend),
      new THREE.Vector3(cx, 0.01, cz),
      new THREE.Vector3(cx + len/2, 0.01, cz + bend)
    ];
    var curve = new THREE.QuadraticBezierCurve3(pts[0], pts[1], pts[2]);
    var curvePts = curve.getPoints(8);
    var geo = new THREE.BufferGeometry().setFromPoints(curvePts);
    var line = new THREE.Line(geo, lineMatRipple.clone());
    line.renderOrder = 2;
    line.userData = { baseZ: cz, speed: 0.004 + Math.random() * 0.012, phase: Math.random() * Math.PI * 2 };
    rivGroup.add(line); lineGeos.push(line);
  }

  scene.add(rivGroup);
  riverObjects = { water: water, lineGeos: lineGeos };
}

// ========== 外围田野 + 道路 + 路灯 ==========
var streetLights = []; // global for day/night updates

function createSurroundingFarmland() {
  var bbox = new THREE.Box3();
  ['device01','device02','device11','device12'].forEach(function(dk) {
    var unit = greenhouseUnits[dk];
    if (unit && unit.group) bbox.expandByObject(unit.group);
  });

  var marginX = 12, marginZ = 12, gap = 1.5;
  var fMinX = bbox.min.x - marginX, fMaxX = bbox.max.x + marginX;
  var fMinZ = bbox.min.z - marginZ, fMaxZ = bbox.max.z + marginZ;
  var bMinX = bbox.min.x, bMaxX = bbox.max.x, bMinZ = bbox.min.z, bMaxZ = bbox.max.z;

  var farmGroup = new THREE.Group(); farmGroup.name = 'farmland';

  // Color-varied materials
  var matSoilDeep  = new THREE.MeshStandardMaterial({ color: '#4a2f1f', roughness: 0.92 });
  var matSoilMid   = new THREE.MeshStandardMaterial({ color: '#5c3a25', roughness: 0.90 });
  var matSoilLight = new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.88 });
  var matRidge     = new THREE.MeshStandardMaterial({ color: '#7a5635', roughness: 0.85 });
  var matFurrow    = new THREE.MeshStandardMaterial({ color: '#3a2010', roughness: 0.95 });
  var matCropGreen = new THREE.MeshStandardMaterial({ color: '#4a9e30', roughness: 0.6 });
  var matCropDark  = new THREE.MeshStandardMaterial({ color: '#357520', roughness: 0.65 });
  var matBoundary  = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.8 });
  var matRoad      = new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.85 });

  var soilMats = [matSoilDeep, matSoilMid, matSoilLight];
  var cropMats = [matCropGreen, matCropDark];

  function fieldBlock(x0, x1, z0, z1, colorIdx) {
    var block = new THREE.Group();
    var w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    var soilMat = soilMats[colorIdx % 3];

    // soil base with varied color
    var base = new THREE.Mesh(new THREE.PlaneGeometry(w, d), soilMat);
    base.rotation.x = -Math.PI / 2; base.position.set(cx, 0.005, cz);
    base.receiveShadow = true; block.add(base);

    // boundary border (low wall around field)
    var bw = 0.08;
    [[x0, cx, 0, d], [x1, cx, 0, d], [cx, x0, w, 0], [cx, x1, w, 0]].forEach(function(b) {
      var border = new THREE.Mesh(new THREE.BoxGeometry(b[2] || w, 0.05, bw), matBoundary);
      border.position.set(b[0], 0.025, b[1]); border.receiveShadow = true;
      if (!b[2]) border.scale.set(1, 1, 1);
      block.add(border);
    });

    // furrows with deeper ridges
    var horiz = w > d;
    var count = Math.floor((horiz ? d : w) / 1.2);
    var step = (horiz ? d : w) / count;
    var start = -(horiz ? d : w) / 2 + step / 2;
    var rw = horiz ? w * 0.9 : 0.22, rd = horiz ? 0.22 : d * 0.9;

    for (var i = 0; i < count; i++) {
      var off = start + i * step;
      var rx = cx + (horiz ? 0 : off), rz = cz + (horiz ? off : 0);

      // furrow groove (dark)
      var groove = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.01, rd + 0.06), matFurrow);
      groove.position.set(rx, 0.006, rz); block.add(groove);

      // ridge on top (lighter)
      var ridge = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.7, 0.1, rd * 0.8), matRidge);
      ridge.position.set(rx, 0.06, rz); ridge.receiveShadow = true;
      block.add(ridge);

      // crops: more dense, varied colors
      var cropCount = (colorIdx % 2 === 0) ? 5 : 3;
      for (var j = 0; j < cropCount; j++) {
        var px = rx + (Math.random() - 0.5) * rw * 0.6;
        var pz = rz + (Math.random() - 0.5) * rd * 0.6;
        var cmat = cropMats[Math.floor(Math.random() * 2)];
        var crop = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22 + Math.random() * 0.15, 4), cmat);
        crop.position.set(px, 0.16, pz); crop.castShadow = false;
        block.add(crop);
      }
    }
    return block;
  }

  // 8 blocks with varied colors
  farmGroup.add(fieldBlock(fMinX,  bMinX - gap,  fMinZ,  fMaxZ, 0));   // left
  farmGroup.add(fieldBlock(bMaxX + gap,  fMaxX,  fMinZ,  fMaxZ, 1));   // right
  farmGroup.add(fieldBlock(bMinX,  bMaxX,  fMinZ,  bMinZ - gap, 2));   // front
  farmGroup.add(fieldBlock(bMinX,  bMaxX,  bMaxZ + gap,  fMaxZ, 0));   // back
  farmGroup.add(fieldBlock(fMinX,  bMinX - gap,  fMinZ,  bMinZ - gap, 1));  // FL
  farmGroup.add(fieldBlock(bMaxX + gap,  fMaxX,  fMinZ,  bMinZ - gap, 2));  // FR
  farmGroup.add(fieldBlock(fMinX,  bMinX - gap,  bMaxZ + gap,  fMaxZ, 1));  // BL
  farmGroup.add(fieldBlock(bMaxX + gap,  fMaxX,  bMaxZ + gap,  fMaxZ, 0));  // BR

  // ===== Farm roads =====
  var roadGroup = new THREE.Group(); roadGroup.name = 'farmRoads';
  // Front road (between greenhouses and front field)
  var roadZ = bMinZ - gap * 0.6, roadW = 1.2;
  var frontRoad = new THREE.Mesh(new THREE.PlaneGeometry(bMaxX - bMinX + 4, roadW), matRoad);
  frontRoad.rotation.x = -Math.PI / 2; frontRoad.position.set(0, 0.01, roadZ);
  frontRoad.receiveShadow = true; roadGroup.add(frontRoad);

  // Back road
  var backRoad = new THREE.Mesh(new THREE.PlaneGeometry(bMaxX - bMinX + 4, roadW), matRoad);
  backRoad.rotation.x = -Math.PI / 2; backRoad.position.set(0, 0.01, -roadZ);
  backRoad.receiveShadow = true; roadGroup.add(backRoad);

  // Left edge road
  var leftRoadZ0 = -roadZ, leftRoadD = leftRoadZ0 - roadZ;
  // Actually, let me simplify: roads around the bbox perimeter
  var rw2 = 0.9;
  // Top
  var rTop = new THREE.Mesh(new THREE.PlaneGeometry(bMaxX - bMinX + gap, rw2), matRoad);
  rTop.rotation.x = -Math.PI / 2; rTop.position.set(0, 0.012, bMaxZ + gap * 0.5);
  rTop.receiveShadow = true; roadGroup.add(rTop);
  // Bottom
  var rBot = new THREE.Mesh(new THREE.PlaneGeometry(bMaxX - bMinX + gap, rw2), matRoad);
  rBot.rotation.x = -Math.PI / 2; rBot.position.set(0, 0.012, bMinZ - gap * 0.5);
  rBot.receiveShadow = true; roadGroup.add(rBot);

  farmGroup.add(roadGroup);

  scene.add(farmGroup);

  // ===== Street lights =====
  streetLights = [];
  var lightGroup = new THREE.Group(); lightGroup.name = 'streetLights';

  // Place 10 lights: 5 along front road, 5 along back road
  var lightXs = [bMinX - 1, bMinX + 5, bMinX + 11, bMaxX - 5, bMaxX + 1];
  var lightZs = [roadZ - 0.6, roadZ + 0.6];

  lightZs.forEach(function(lz) {
    lightXs.forEach(function(lx) {
      var pole = new THREE.Group();

      // Pole
      var poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.8, 8);
      var poleMesh = new THREE.Mesh(poleGeo, matMetalDark);
      poleMesh.position.y = 1.4; poleMesh.castShadow = true;
      pole.add(poleMesh);

      // Lamp head
      var headGeo = new THREE.SphereGeometry(0.2, 8, 6);
      var headMat = new THREE.MeshStandardMaterial({ color: '#ffe8c0', roughness: 0.3, emissive: '#000000', emissiveIntensity: 0 });
      var headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.y = 2.85; headMesh.name = 'lampHead';
      pole.add(headMesh);

      // Glow cone (night only)
      var coneGeo = new THREE.ConeGeometry(0.35, 1.2, 8);
      var coneMat = new THREE.MeshBasicMaterial({ color: '#ffe8c0', transparent: true, opacity: 0, depthWrite: false });
      var coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.y = 2.1; coneMesh.name = 'glowCone';
      pole.add(coneMesh);

      // Point light
      var ptLight = new THREE.PointLight('#ffd28a', 0, 6, 1.5);
      ptLight.position.y = 2.6; ptLight.name = 'ptLight';
      pole.add(ptLight);

      pole.position.set(lx, 0, lz);
      lightGroup.add(pole);

      streetLights.push({
        group: pole,
        head: headMesh, headMat: headMat,
        cone: coneMesh, coneMat: coneMat,
        light: ptLight
      });
    });
  });

  scene.add(lightGroup);

  // store bounds for overview camera
  greenhouseUnits._farmBounds = { minX: fMinX, maxX: fMaxX, minZ: fMinZ, maxZ: fMaxZ };
}

function updateStreetLightsByHour(hour) {
  if (!streetLights.length) return;
  var h = Number(hour) || 12;
  var isNight = h < 6 || h >= 18;

  streetLights.forEach(function(sl) {
    if (isNight) {
      sl.headMat.emissive.set('#ffe8c0'); sl.headMat.emissiveIntensity = 0.8;
      sl.coneMat.opacity = 0.18; sl.cone.visible = true;
      sl.light.intensity = 0.9;
    } else {
      sl.headMat.emissive.set('#000000'); sl.headMat.emissiveIntensity = 0;
      sl.coneMat.opacity = 0; sl.cone.visible = false;
      sl.light.intensity = 0;
    }
  });
}

function updateRoadLightsByHour(hour) {
  if (!roadLights.length) return;
  var h = Number(hour) || 12;
  var isNight = h < 6 || h >= 18;

  roadLights.forEach(function(sl) {
    if (isNight) {
      sl.headMat.emissive.set('#ffe8c0'); sl.headMat.emissiveIntensity = 1.5;
      sl.coneMat.opacity = 0.2; sl.cone.visible = true;
      sl.light.intensity = 1.0;
    } else {
      sl.headMat.emissive.set('#000000'); sl.headMat.emissiveIntensity = 0;
      sl.coneMat.opacity = 0; sl.cone.visible = false;
      sl.light.intensity = 0;
    }
  });
}

// ========== createGreenhouseUnit ==========
function createGreenhouseUnit(options) {
  var unitGroup = new THREE.Group();
  var ghConfig = options.ghConfig;
  var deviceKey = options.id;

  // Store ghConfig for later reference
  unitGroup.userData = { deviceKey: deviceKey, ghConfig: ghConfig, label: options.label };

  // Get the dynamic objects store for this unit
  var dobjs = greenhouseUnits[deviceKey].dynamicObjects;

  // Build all subcomponents inside the group
  createGreenhouseStructure(unitGroup, ghConfig);
  createPlantBeds(unitGroup, ghConfig, dobjs);
  createPlants(unitGroup, ghConfig, dobjs);
  createFans(unitGroup, ghConfig, dobjs);
  createLights(unitGroup, ghConfig, dobjs);
  createSprinklers(unitGroup, ghConfig, dobjs);
  createWaterTank(unitGroup, ghConfig, dobjs);
  createPipes(unitGroup, ghConfig, dobjs, deviceKey);
  createAlarmMarkers(unitGroup, ghConfig, dobjs);

  // Position the entire unit
  unitGroup.position.copy(options.position);

  // 透明碰撞盒: 按棚膜区域收窄, 不含水箱/管道
  var gh = ghConfig;
  var hitW = (gh.width - 0.4) * 0.95;
  var hitH = (gh.height - 0.2) * 0.7;
  var hitL = gh.length - 0.4;
  var hitBoxGeo = new THREE.BoxGeometry(hitW, hitH, hitL);
  var hitBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  var hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
  hitBox.position.set(0, hitH / 2 + 0.1, 0);
  hitBox.userData.deviceKey = deviceKey;
  hitBox.userData.isHitBox = true;
  unitGroup.add(hitBox);
  unitGroup.userData.hitBox = hitBox;

  // 标记所有子对象归属
  tagGroupDevice(unitGroup, deviceKey, options.label);

  return unitGroup;
}

function tagGroupDevice(group, deviceKey, label) {
  group.traverse(function(obj) {
    obj.userData.deviceKey = deviceKey;
    obj.userData.label = label;
  });
}

// ========== 3D 模型创建函数 (参数化版本) ==========

function createGreenhouseStructure(parentGroup, ghConfig) {
  var gh = new THREE.Group();
  var hW = ghConfig.halfW, hL = ghConfig.halfL, H = ghConfig.height;

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

  var ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, hL*2, 8), matMetal);
  ridge.rotation.x = Math.PI/2; ridge.position.set(0, H, 0); ridge.castShadow = true;
  gh.add(ridge);

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
  // clone 棚膜材质避免跨大棚高亮串扰
  var film = new THREE.Mesh(filmGeo, matFilm.clone());
  film.position.set(0, 0, 0);
  film.renderOrder = 0;
  film.material.depthWrite = false;
  gh.add(film);
  // 保存 film 引用供高亮切换使用
  parentGroup.userData.filmMaterial = film.material;

  parentGroup.add(gh);
}

function createPlantBeds(parentGroup, ghConfig, dobjs) {
  var bg = new THREE.Group();
  var bedXs = [-2.4, 0, 2.4];
  var bedLen = ghConfig.halfL * 1.6;
  var bedW = 0.9, bedH = 0.12;
  bedXs.forEach(function(bx) {
    // clone 材质避免跨大棚串色
    var bed = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedH, bedLen), matSoil.clone());
    bed.position.set(bx, bedH/2 + 0.02, 0);
    bed.receiveShadow = true; bed.castShadow = true;
    bg.add(bed); dobjs.soilBeds.push(bed);
  });
  parentGroup.add(bg);
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
  var stemH = 0.22 * scale;
  var stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.03, stemH, 8),
    new THREE.MeshStandardMaterial({ color: '#4a7a38', roughness: 0.7 })
  );
  stem.position.y = stemH / 2; stem.castShadow = true;
  plant.add(stem);
  var lowerCount = 7;
  for (var li = 0; li < lowerCount; li++) {
    var a = (li / lowerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    var lfLen = (0.14 + Math.random() * 0.06) * scale;
    var lfWid = (0.05 + Math.random() * 0.04) * scale;
    var lf = createLeaf(lfLen, lfWid, leafColors[Math.floor(Math.random() * leafColors.length)]);
    lf.position.set(Math.cos(a) * 0.07 * scale, stemH * 0.5, Math.sin(a) * 0.07 * scale);
    lf.rotation.y = -a + Math.PI / 2;
    lf.rotation.z = Math.PI / 2 - 0.3 + (Math.random() - 0.5) * 0.25;
    lf.rotation.order = 'YXZ';
    plant.add(lf);
  }
  var upperCount = 5;
  for (var ui = 0; ui < upperCount; ui++) {
    var a2 = (ui / upperCount) * Math.PI * 2 + Math.random() * 0.4;
    var ulLen = (0.10 + Math.random() * 0.05) * scale;
    var ulWid = (0.04 + Math.random() * 0.03) * scale;
    var uf = createLeaf(ulLen, ulWid, leafColors[Math.floor(Math.random() * leafColors.length)]);
    uf.position.set(Math.cos(a2) * 0.04 * scale, stemH * 0.8, Math.sin(a2) * 0.04 * scale);
    uf.rotation.y = -a2 + Math.PI / 2;
    uf.rotation.z = Math.PI / 4 + (Math.random() - 0.5) * 0.3;
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

function createPlants(parentGroup, ghConfig, dobjs) {
  var pg = new THREE.Group();
  var bedXs = [-2.4, 0, 2.4];
  var plantZs = [-4.2, -2.5, -0.8, 0.8, 2.5, 4.2];
  bedXs.forEach(function(bx) {
    [-0.3, 0.3].forEach(function(ox) {
      plantZs.forEach(function(pz) {
        var scale = 3 * (0.8 + Math.random() * 0.4);
        var plant = createPlant(bx + ox, pz + (Math.random() - 0.5) * 0.2, scale);
        pg.add(plant);
        dobjs.plants.push(plant);
      });
    });
  });
  parentGroup.add(pg);
}

function createFans(parentGroup, ghConfig, dobjs) {
  var fg = new THREE.Group();
  var guardMat = new THREE.MeshBasicMaterial({ color: '#445566', transparent: true, opacity: 0.55, depthWrite: false });
  var bladeMat = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.25, metalness: 0.5 });
  var bladeGeo = new THREE.BoxGeometry(0.07, 0.45, 0.04);
  var capMat = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.25, metalness: 0.6 });
  var hW = ghConfig.halfW;

  var fanConfigs = [
    { pos: [-hW + 0.2, 2.1, -2.5], side: 'left' },
    { pos: [hW - 0.2, 2.1, 2.5], side: 'right' }
  ];

  fanConfigs.forEach(function(cfg) {
    var fanGroup = new THREE.Group();
    var frameGroup = new THREE.Group();
    var bladesGroup = new THREE.Group();

    var outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 16, 24), matMetalDark);
    outerRing.castShadow = true;
    frameGroup.add(outerRing);

    var innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 12, 16), matMetal);
    frameGroup.add(innerRing);

    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 12), matMetalDark);
    hub.rotation.x = Math.PI / 2; hub.castShadow = true;
    frameGroup.add(hub);

    var barLen = 0.54;
    for (var j = 0; j < 2; j++) {
      var barAngle = j * Math.PI / 2 + Math.PI / 4;
      var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, barLen, 6), guardMat);
      bar.rotation.z = barAngle; bar.position.z = 0.04;
      frameGroup.add(bar);
    }
    var guardRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.005, 8, 24), guardMat);
    guardRing.position.z = 0.04;
    frameGroup.add(guardRing);

    var bracketArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), matMetalDark);
    bracketArm.rotation.x = Math.PI / 2; bracketArm.position.z = -0.2; bracketArm.castShadow = true;
    frameGroup.add(bracketArm);

    var wallPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.04), matMetalDark);
    wallPlate.position.z = -0.39; wallPlate.castShadow = true;
    frameGroup.add(wallPlate);

    var strut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8), matMetalDark);
    strut.position.set(0, -0.22, -0.08); strut.rotation.x = -Math.PI / 4.5; strut.castShadow = true;
    frameGroup.add(strut);

    for (var i = 0; i < 3; i++) {
      var blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 0.15;
      blade.rotation.z = (i / 3) * Math.PI * 2;
      blade.castShadow = true;
      bladesGroup.add(blade);
    }
    bladesGroup.add(new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12), capMat
    ).rotateX(Math.PI / 2));

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

    fanGroup.add(frameGroup);
    fanGroup.add(bladesGroup);
    fanGroup.add(airflowGroup);
    fanGroup.userData = { bladesGroup: bladesGroup, airflow: airflowGroup };
    fanGroup.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    if (cfg.side === 'left') {
      fanGroup.rotation.y = Math.PI / 2;
    } else {
      fanGroup.rotation.y = -Math.PI / 2;
    }
    fg.add(fanGroup);
    dobjs.fans.push(fanGroup);
  });

  parentGroup.add(fg);
}

function createLights(parentGroup, ghConfig, dobjs) {
  var lg = new THREE.Group();
  var H = ghConfig.height;
  [[-2, -3], [2, -3], [-2, 3], [2, 3]].forEach(function(p) {
    var lamp = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 2.5), matLEDOff.clone());
    body.castShadow = true; body.name = 'lampBody'; lamp.add(body);
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 2.3), matLEDOn.clone());
    glow.rotation.x = -Math.PI/2; glow.position.y = -0.03; glow.name = 'glowPanel';
    glow.material.opacity = 0; glow.material.transparent = true; glow.material.emissiveIntensity = 0;
    lamp.add(glow);
    // 3 个 SpotLight 沿灯管 Z 轴排列，模拟矩形光照，范围 ×2
    var spotLights = [];
    [-1.08, 0, 1.08].forEach(function(sz) {
      var spot = new THREE.SpotLight('#ffe8a0', 0, 0, Math.PI * 0.289, 0.4, 1.0);
      spot.position.set(0, -0.5, sz); spot.name = 'lampSpot';
      spot.target.position.set(0, -5, sz); lamp.add(spot.target);
      lamp.add(spot); spotLights.push(spot);
    });
    lamp.position.set(p[0], H - 0.9, p[1]);
    lamp.userData = { body: body, glow: glow, spotLights: spotLights };
    lg.add(lamp); dobjs.lamps.push(lamp);
  });
  parentGroup.add(lg);
}

function createSprinklers(parentGroup, ghConfig, dobjs) {
  var sg = new THREE.Group();
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
  parentGroup.add(sg);

  var sprayGroup = new THREE.Group(); sprayGroup.visible = false;
  var sprinklerPositions = [[-1.2, 1.5, -3.5], [-1.2, 1.5, 0], [-1.2, 1.5, 3.5],
                             [1.2, 1.5, -3.5], [1.2, 1.5, 0], [1.2, 1.5, 3.5]];
  var pGeo = new THREE.SphereGeometry(0.02, 4, 3);
  var pMat = new THREE.MeshBasicMaterial({ color: '#aaddff', transparent: true, opacity: 0.7 });
  sprinklerPositions.forEach(function(sp) {
    for (var i = 0; i < 15; i++) {
      var pt = new THREE.Mesh(pGeo, pMat);
      var dirX = sp[0] < 0 ? 1 : -1;
      var angle = (Math.random() - 0.5) * Math.PI * 0.7 + (dirX > 0 ? -Math.PI*0.15 : Math.PI*0.85);
      var radius = 0.05 + Math.random() * 1.3;
      var drop = Math.random() * 1.2;
      pt.position.set(sp[0] + Math.cos(angle) * radius, sp[1] - drop, sp[2] + Math.sin(angle) * radius);
      pt.userData = {
        originX: sp[0], originY: sp[1], originZ: sp[2],
        speed: 1.5 + Math.random() * 3, offset: Math.random() * Math.PI * 2,
        radius: radius, angle: angle
      };
      sprayGroup.add(pt);
    }
  });
  parentGroup.add(sprayGroup);
  dobjs.sprayParticles = sprayGroup;
  dobjs.sprinklers = sg; // store sprinkler heads reference
}

function createWaterTank(parentGroup, ghConfig, dobjs) {
  var tg = new THREE.Group();
  var tankW = 1.0, tankH = 1.1, tankD = 0.8;
  var frameEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(tankW, tankH, tankD));
  var frame = new THREE.LineSegments(frameEdges, new THREE.LineBasicMaterial({ color: '#6088bb' }));
  frame.position.y = tankH/2; tg.add(frame); dobjs.tankFrame = frame;
  var body = new THREE.Mesh(new THREE.BoxGeometry(tankW-0.05, tankH-0.05, tankD-0.05), matTankBody);
  body.position.y = tankH/2; body.castShadow = true; body.receiveShadow = true;
  body.renderOrder = 1; body.material.depthWrite = false; tg.add(body);
  // clone 水材质避免跨大棚串色
  var water = new THREE.Mesh(new THREE.BoxGeometry(tankW-0.1, 0.01, tankD-0.1), matWater.clone());
  water.position.y = 0.08; water.renderOrder = 0; tg.add(water);
  dobjs.tankWater = water;
  tg.add(new THREE.Mesh(new THREE.BoxGeometry(tankW+0.05, 0.05, tankD+0.05), matMetalDark));
  tg.position.set(-ghConfig.halfW - 1.0, 0, -ghConfig.halfL + 0.6);
  parentGroup.add(tg);
}

function createPipes(parentGroup, ghConfig, dobjs, deviceKey) {
  var pg = new THREE.Group();
  var tankX = -ghConfig.halfW - 1.0;
  var tankZ = -ghConfig.halfL + 0.6;
  var sideX = ghConfig.halfW - 0.4;

  var leftPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(tankX, 0.25, tankZ),
    new THREE.Vector3(-sideX, 0.25, -ghConfig.halfL + 0.5),
    new THREE.Vector3(-sideX, 0.25, 0),
    new THREE.Vector3(-sideX, 0.25, ghConfig.halfL - 0.5)
  ]);
  // clone 管道材质避免跨大棚串色
  var unitPipeMat = matPipe.clone();
  var leftPipe = new THREE.Mesh(new THREE.TubeGeometry(leftPath, 32, 0.05, 8, false), unitPipeMat);
  leftPipe.castShadow = true; pg.add(leftPipe);

  var rightPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(sideX, 0.25, -ghConfig.halfL + 0.5),
    new THREE.Vector3(sideX, 0.25, 0),
    new THREE.Vector3(sideX, 0.25, ghConfig.halfL - 0.5)
  ]);
  var rightPipe = new THREE.Mesh(new THREE.TubeGeometry(rightPath, 24, 0.05, 8, false), unitPipeMat);
  rightPipe.castShadow = true; greenhouseUnits[deviceKey].mainPipeRef = rightPipe; pg.add(rightPipe);

  var frontPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-sideX, 0.25, -ghConfig.halfL + 0.5),
    new THREE.Vector3(0, 0.25, -ghConfig.halfL + 0.5),
    new THREE.Vector3(sideX, 0.25, -ghConfig.halfL + 0.5)
  ]);
  pg.add(new THREE.Mesh(new THREE.TubeGeometry(frontPath, 16, 0.05, 8, false), unitPipeMat));

  var backPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-sideX, 0.25, ghConfig.halfL - 0.5),
    new THREE.Vector3(0, 0.25, ghConfig.halfL - 0.5),
    new THREE.Vector3(sideX, 0.25, ghConfig.halfL - 0.5)
  ]);
  pg.add(new THREE.Mesh(new THREE.TubeGeometry(backPath, 16, 0.05, 8, false), unitPipeMat));

  [[-1.2, -3.5], [-1.2, 0], [-1.2, 3.5], [1.2, -3.5], [1.2, 0], [1.2, 3.5]].forEach(function(sp) {
    var sx = sp[0] > 0 ? sideX : -sideX;
    var bp = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0.25, sp[1]),
      new THREE.Vector3(sp[0], 0.25, sp[1])
    ]);
    pg.add(new THREE.Mesh(new THREE.TubeGeometry(bp, 8, 0.035, 6, false), matPipe));
  });

  for (var i = 0; i < 8; i++) {
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), matPipeFlow.clone());
    dot.visible = false; dot.userData = { pathProgress: Math.random(), speed: 0.1+Math.random()*0.2, path: leftPath };
    pg.add(dot); dobjs.pipeFlows.push(dot);
  }
  for (var j = 0; j < 8; j++) {
    var dot2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), matPipeFlow.clone());
    dot2.visible = false; dot2.userData = { pathProgress: Math.random(), speed: 0.1+Math.random()*0.2, path: rightPath };
    pg.add(dot2); dobjs.pipeFlows.push(dot2);
  }
  parentGroup.add(pg);
}

function createAlarmMarkers(parentGroup, ghConfig, dobjs) {
  var mg = new THREE.Group();
  function makeMarker(color, pos) {
    var g = new THREE.Group();
    var s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0 }));
    g.add(s); g.position.copy(pos); g.visible = false; g.userData = { sphere: s };
    mg.add(g); return g;
  }
  dobjs.alarmMarkers = {
    soil: makeMarker('#ff9500', new THREE.Vector3(0, 0.35, 0)),
    temp: makeMarker('#ff3860', new THREE.Vector3(0, ghConfig.height - 0.5, -ghConfig.halfL + 0.5)),
    water: makeMarker('#ff3860', new THREE.Vector3(-ghConfig.halfW - 1.0, 0.9, -ghConfig.halfL + 0.6))
  };
  parentGroup.add(mg);
}

// ========== 3D 模型数据更新桥接 ==========
function update3DModels() {
  if (!threeReady) return;
  var allKeys = ['device01','device02','device11','device12'];
  for (var i=0;i<allKeys.length;i++) {
    update3DModelForUnit(greenhouseUnits[allKeys[i]], deviceData[allKeys[i]] || {});
  }
}

function update3DModelForUnit(unit, data) {
  if (!unit) return;
  var sd = unit.sceneData;
  sd.fanStatus = data.fanStatus || false;
  sd.lampStatus = data.lampStatus || false;
  sd.sprayStatus = data.sprayStatus || false;
  sd.pumpStatus = data.pumpStatus || false;
  sd.soilAlarm = data.soilAlarm || false;
  sd.soilOverAlarm = data.soilOverAlarm || false;
  sd.tempAlarm = data.tempAlarm || false;
  sd.tempLowAlarm = data.tempLowAlarm || false;
  sd.waterAlarm = data.waterAlarm || false;
  sd.waterOverAlarm = data.waterOverAlarm || false;
  sd.co2Alarm = data.co2Alarm || false;
  sd.waterLevel = Number(data.waterLevel) || 60;
  sd.soilHumidity = Number(data.soilHumidity) || 50;
  sd.temperature = Number(data.temperature) || 25;
  sd.hourOfDay = Number(data.hourOfDay) || 12;
  sd.lightIntensity = Number(data.lightIntensity) || 500;
}

// ========== 3D 渲染循环 ==========
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

    // Update all 4 greenhouses
    animateGreenhouseUnit(greenhouseUnits.device01, time, dt);
    animateGreenhouseUnit(greenhouseUnits.device02, time, dt);
    animateGreenhouseUnit(greenhouseUnits.device11, time, dt);
    animateGreenhouseUnit(greenhouseUnits.device12, time, dt);

    // River animation: slow flowing ripples along z
    if (riverObjects && riverObjects.lineGeos) {
      var rLen = 22; // river length
      riverObjects.lineGeos.forEach(function(line) {
        var ud = line.userData;
        line.position.z += ud.speed;
        if (line.position.z > rLen/2 + 1) line.position.z = -rLen/2 - 1;
        // subtle opacity shimmer
        line.material.opacity = 0.2 + Math.sin(time * 1.5 + ud.phase) * 0.1;
      });
    }

    if (renderer && scene && camera) renderer.render(scene, camera);
  }
  render();
}

function animateGreenhouseUnit(unit, time, dt) {
  if (!unit) return;
  var sd = unit.sceneData;
  var dobjs = unit.dynamicObjects;
  var unitGroup = unit.group;
  if (!unitGroup) return;

  // Fans
  dobjs.fans.forEach(function(fan) {
    var bladesGroup = fan.userData.bladesGroup;
    if (bladesGroup) {
      bladesGroup.userData = bladesGroup.userData || { currentSpeed: 0 };
      var target = sd.fanStatus ? 12 : 0;
      bladesGroup.userData.currentSpeed += (target - bladesGroup.userData.currentSpeed) * Math.min(dt * 4, 1);
      bladesGroup.rotation.z += bladesGroup.userData.currentSpeed * dt;
    }
    var airflow = fan.userData.airflow;
    if (airflow) {
      airflow.visible = sd.fanStatus;
      if (sd.fanStatus) {
        airflow.children.forEach(function(line) {
          var ud = line.userData;
          line.material.opacity = ud.baseOpacity + Math.abs(Math.sin(time * 8 + ud.phase)) * 0.15;
        });
      }
    }
  });

  // LED Lights
  dobjs.lamps.forEach(function(lamp) {
    var ud = lamp.userData;
    var ti = sd.lampStatus ? 11.25 : 0;
    var tg = sd.lampStatus ? 0.9 : 0;
    if (ud.glow) {
      ud.glow.material.emissiveIntensity += (ti - ud.glow.material.emissiveIntensity) * dt * 3;
      ud.glow.material.opacity += (tg - ud.glow.material.opacity) * dt * 3;
    }
    if (ud.spotLights) ud.spotLights.forEach(function(s) { s.intensity += (ti - s.intensity) * dt * 3; });
    if (ud.body) {
      if (sd.lampStatus) {
        ud.body.material.color.set('#ffe8a0'); ud.body.material.emissive = lampOnColor;
        ud.body.material.emissiveIntensity += (2.7 - ud.body.material.emissiveIntensity) * dt * 3;
      } else {
        ud.body.material.color.set('#555555'); ud.body.material.emissive = zeroColor;
        ud.body.material.emissiveIntensity += (0 - ud.body.material.emissiveIntensity) * dt * 3;
      }
    }
  });

  // Spray particles
  if (dobjs.sprayParticles) {
    dobjs.sprayParticles.visible = sd.sprayStatus;
    if (sd.sprayStatus) {
      dobjs.sprayParticles.children.forEach(function(p) {
        var ud = p.userData;
        var cycle = ((time * ud.speed + ud.offset) % 1.5) / 1.5;
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

  // Water tank level
  if (dobjs.tankWater) {
    var level = sd.waterLevel / 100;
    dobjs.tankWater.position.y = 0.06 + level * 1.0;
    dobjs.tankWater.scale.y = Math.max(0.01, level);
    if (sd.waterAlarm) {
      dobjs.tankWater.material.color.set('#ff4040');
      dobjs.tankWater.material.emissive = new THREE.Color('#401010');
      dobjs.tankWater.material.emissiveIntensity = 0.5 + Math.sin(time * 4) * 0.3;
    } else if (sd.waterOverAlarm) {
      dobjs.tankWater.material.color.set('#ff9500');
      dobjs.tankWater.material.emissive = new THREE.Color('#302000');
      dobjs.tankWater.material.emissiveIntensity = 0.4 + Math.sin(time * 3) * 0.25;
    } else {
      dobjs.tankWater.material.color.set('#4499dd');
      dobjs.tankWater.material.emissive = new THREE.Color('#000000');
      dobjs.tankWater.material.emissiveIntensity = 0;
    }
  }

  // Pipe flow
  dobjs.pipeFlows.forEach(function(dot) {
    dot.visible = sd.pumpStatus;
    if (sd.pumpStatus) {
      dot.userData.pathProgress += dot.userData.speed * dt;
      if (dot.userData.pathProgress > 1) dot.userData.pathProgress -= 1;
      dot.position.copy(dot.userData.path.getPoint(dot.userData.pathProgress));
      dot.material.opacity = 0.4 + Math.sin(dot.userData.pathProgress * Math.PI * 2) * 0.3;
    }
  });

  // Main pipe color
  var mpr = unit.mainPipeRef;
  if (mpr) mpr.material.color.set(sd.pumpStatus ? '#00b8e8' : '#5070a0');

  // Soil
  dobjs.soilBeds.forEach(function(bed) {
    if (sd.soilAlarm) bed.material.color.set('#8a5030');
    else if (sd.soilOverAlarm) bed.material.color.set('#2a1a10');
    else bed.material.color.set('#4a3020');
  });

  // 低温告警: 棚膜偏蓝
  var filmMat = unitGroup.userData && unitGroup.userData.filmMaterial;
  if (filmMat) {
    if (sd.tempLowAlarm) filmMat.color.lerp(new THREE.Color('#6688cc'), 0.1);
    else filmMat.color.lerp(new THREE.Color('#7fa8c9'), 0.05);
  }

  // Plants
  dobjs.plants.forEach(function(plant) {
    var ud = plant.userData;
    if (ud && ud.breathSpeed) plant.position.y = ud.baseY + Math.sin(time * ud.breathSpeed + ud.breathOffset) * ud.breathAmp;
  });

  // Alarm markers
  var mks = dobjs.alarmMarkers;
  if (mks) {
    var markerList = [mks.soil, mks.temp, mks.water];
    for (var mi = 0; mi < markerList.length; mi++) {
      var m = markerList[mi];
      if (!m) continue;
      var active = false;
      if (mi === 0) active = sd.soilAlarm;
      else if (mi === 1) active = sd.tempAlarm;
      else if (mi === 2) active = sd.waterAlarm;
      m.visible = active;
      if (active && m.userData.sphere) m.userData.sphere.material.opacity = 0.5 + Math.sin(time * 6) * 0.5;
    }
  }
}

// ========== 3D 尺寸同步 ==========
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

function handleWindowResize() {
  requestAnimationFrame(function() { resize3D(true); });
}

// ========== 鼠标悬停拾取 + Tooltip ==========
function initRaycaster() {
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  hoveredDeviceKey = null;
  cameraAnimating = false;
  tooltipEl = rootEl ? rootEl.querySelector('.tb-greenhouse-tooltip') : null;
  var canvas = renderer.domElement;
  canvas.addEventListener('mousemove', on3DMouseMove);
  canvas.addEventListener('mouseleave', hideGreenhouseTooltip);
  // 点击聚焦：防拖动误触发
  canvas.addEventListener('pointerdown', function(e) { mouseDownPos = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('click', on3DClick);
  console.log('[Tooltip] Raycaster + click-focus initialized');
}

function isRealClick(e) {
  if (!mouseDownPos) return true;
  var dx = e.clientX - mouseDownPos.x;
  var dy = e.clientY - mouseDownPos.y;
  return Math.sqrt(dx*dx + dy*dy) <= CLICK_MOVE_THRESHOLD;
}

function getDeviceKeyFromPointer(event) {
  if (!renderer || !camera || !raycaster) return null;
  var rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  var hitBoxes = [
    greenhouseUnits.device01.group ? greenhouseUnits.device01.group.userData.hitBox : null,
    greenhouseUnits.device02.group ? greenhouseUnits.device02.group.userData.hitBox : null,
    greenhouseUnits.device11.group ? greenhouseUnits.device11.group.userData.hitBox : null,
    greenhouseUnits.device12.group ? greenhouseUnits.device12.group.userData.hitBox : null
  ].filter(Boolean);
  var intersects = raycaster.intersectObjects(hitBoxes, false);
  return intersects.length ? (intersects[0].object.userData.deviceKey || null) : null;
}

function on3DClick(event) {
  if (!isRealClick(event)) return;
  var dk = getDeviceKeyFromPointer(event);
  if (!dk) return;
  focusCameraOnGreenhouse(dk);
  switchActiveDevice(dk);
  console.log('[Click Focus+Switch] ' + dk);
}

function focusCameraOnGreenhouse(deviceKey) {
  var unit = greenhouseUnits[deviceKey];
  if (!unit || !unit.group) return;

  // Greenhouse center in world space
  var ghCenter = new THREE.Vector3();
  unit.group.getWorldPosition(ghCenter);

  // Water tank world position (use dynamic object if available, fallback to known local offset)
  var tankWorld = new THREE.Vector3();
  var dobjs = greenhouseUnits[deviceKey].dynamicObjects;
  if (dobjs && dobjs.waterTank && dobjs.waterTank.group) {
    dobjs.waterTank.group.getWorldPosition(tankWorld);
  } else {
    // Fallback: local offset (-halfW-1, 0, -halfL+0.6) = (-5, 0, -5.4)
    tankWorld.copy(ghCenter).add(new THREE.Vector3(-5, 0, -5.4));
  }

  // Direction from greenhouse center toward water tank
  var dir = new THREE.Vector3().subVectors(tankWorld, ghCenter).setY(0).normalize();
  if (dir.lengthSq() < 0.001) dir.set(-0.7, 0, -0.7).normalize();

  // Camera behind the tank, looking at greenhouse center
  var lookAt = ghCenter.clone(); lookAt.y += 1.0;
  var camPos = ghCenter.clone().add(dir.clone().multiplyScalar(14)).add(new THREE.Vector3(0, 5.5, 0));

  animateCameraTo(camPos, lookAt, 700);
}

function focusCameraOverview() {
  // Camera on water-tank side, framing greenhouses + left road + right river
  animateCameraTo(new THREE.Vector3(-25, 15, -18), new THREE.Vector3(0, 1.2, 1.5), 800);
}

var animFrameId2 = null;
function animateCameraTo(targetPosition, targetLookAt, duration) {
  if (!camera || !controls) return;
  // 取消上一个动画
  if (animFrameId2) { cancelAnimationFrame(animFrameId2); animFrameId2 = null; }
  var startPos = camera.position.clone();
  var startTarget = controls.target.clone();
  var endPos = targetPosition.clone();
  var endTarget = targetLookAt.clone();
  var startTime = performance.now();
  controls.enabled = false;
  cameraAnimating = true;

  function step(now) {
    var t = Math.min((now - startTime) / duration, 1);
    var eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
    camera.position.lerpVectors(startPos, endPos, eased);
    controls.target.lerpVectors(startTarget, endTarget, eased);
    controls.update();
    if (t < 1) { animFrameId2 = requestAnimationFrame(step); }
    else { controls.enabled = true; cameraAnimating = false; animFrameId2 = null; }
  }
  animFrameId2 = requestAnimationFrame(step);
}

function on3DMouseMove(event) {
  if (!renderer || !camera || !scene) return;
  lastMouseEvent = event;
  var rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  var hitBoxes = [
    greenhouseUnits.device01.group ? greenhouseUnits.device01.group.userData.hitBox : null,
    greenhouseUnits.device02.group ? greenhouseUnits.device02.group.userData.hitBox : null,
    greenhouseUnits.device11.group ? greenhouseUnits.device11.group.userData.hitBox : null,
    greenhouseUnits.device12.group ? greenhouseUnits.device12.group.userData.hitBox : null
  ].filter(Boolean);

  var intersects = raycaster.intersectObjects(hitBoxes, false);
  if (intersects.length > 0) {
    var dk = intersects[0].object.userData.deviceKey;
    if (dk) {
      hoveredDeviceKey = dk;
      showGreenhouseTooltip(dk, event.clientX, event.clientY);
      highlightHoveredGreenhouse(dk);
      return;
    }
  }
  hoveredDeviceKey = null;
  hideGreenhouseTooltip();
  clearHoverHighlight();
}

function showGreenhouseTooltip(deviceKey, clientX, clientY) {
  if (!tooltipEl) return;
  var data = deviceData[deviceKey] || {};
  var meta = deviceMeta[deviceKey] || {};
  var hasAlarm = parseBool(data.soilAlarm) || parseBool(data.soilOverAlarm) ||
                 parseBool(data.tempAlarm) || parseBool(data.tempLowAlarm) ||
                 parseBool(data.waterAlarm) || parseBool(data.waterOverAlarm) ||
                 parseBool(data.co2Alarm);

  tooltipEl.innerHTML =
    '<div class="tooltip-title">' + (meta.label || deviceKey) + '</div>' +
    '<div class="tooltip-row"><span class="tooltip-label">设备</span><span class="tooltip-value">' + (meta.name || '-') + '</span></div>' +
    '<div class="tooltip-row"><span class="tooltip-label">温度</span><span class="tooltip-value">' + fmtV(data.temperature,1) + ' °C</span></div>' +
    '<div class="tooltip-row"><span class="tooltip-label">空气湿度</span><span class="tooltip-value">' + fmtV(data.airHumidity,1) + ' %</span></div>' +
    '<div class="tooltip-row"><span class="tooltip-label">土壤湿度</span><span class="tooltip-value">' + fmtV(data.soilHumidity,1) + ' %</span></div>' +
    '<div class="tooltip-row"><span class="tooltip-label">棚内光照</span><span class="tooltip-value">' + fmtV(data.lightIntensity,0) + ' lux</span></div>' +
    '<div class="tooltip-row"><span class="tooltip-label">CO2</span><span class="tooltip-value">' + fmtV(data.co2,0) + ' ppm</span></div>' +
    '<div class="tooltip-row"><span class="tooltip-label">水箱液位</span><span class="tooltip-value">' + fmtV(data.waterLevel,1) + ' %</span></div>' +
    '<div class="tooltip-row"><span class="tooltip-label">模式</span><span class="tooltip-value">' + (parseBool(data.autoMode) ? '自动' : '手动') + '</span></div>' +
    '<div class="tooltip-row"><span class="tooltip-label">报警</span><span class="' + (hasAlarm ? 'tooltip-alarm' : 'tooltip-normal') + '">' + (hasAlarm ? '有报警' : '正常') + '</span></div>';

  var offset = 16;
  tooltipEl.style.display = 'block';
  tooltipEl.style.left = (clientX + offset) + 'px';
  tooltipEl.style.top = (clientY + offset) + 'px';

  requestAnimationFrame(function() {
    var rect = tooltipEl.getBoundingClientRect();
    var left = clientX + offset;
    var top = clientY + offset;
    if (left + rect.width > window.innerWidth - 8) left = clientX - rect.width - offset;
    if (top + rect.height > window.innerHeight - 8) top = clientY - rect.height - offset;
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
  });
}

function hideGreenhouseTooltip() {
  if (tooltipEl) tooltipEl.style.display = 'none';
}

function fmtV(value, digits) {
  var n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '--';
}

function updateFilmHighlights(hoveredDK) {
  ['device01','device02','device11','device12'].forEach(function(dk) {
    var unit = greenhouseUnits[dk];
    if (!unit || !unit.group) return;
    // 棚膜透明度
    var filmMat = unit.group.userData && unit.group.userData.filmMaterial;
    if (filmMat) {
      var isActive = activeDeviceKey === dk;
      var isHovered = dk === hoveredDK;
      if (isActive) filmMat.opacity = 0.30;
      else if (isHovered) filmMat.opacity = 0.24;
      else filmMat.opacity = 0.18;
    }
    // 拱形钢架描边: 懒创建
    var archOutline = unit.group.userData.archOutline;
    if (!archOutline) {
      var gh = unit.ghConfig || { halfW:4, halfL:6, height:4 };
      archOutline = new THREE.Group();
      var tubeRad = 0.06;
      var tubeSegs = 6;
      var glowMat = new THREE.MeshBasicMaterial({ color: '#00d9ff', transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      // 拱形曲线(稍微外扩避免埋进钢架)
      var archCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-gh.halfW*1.01, 0.01, 0), new THREE.Vector3(-gh.halfW*0.71, gh.height*0.76, 0),
        new THREE.Vector3(0, gh.height*1.01, 0), new THREE.Vector3(gh.halfW*0.71, gh.height*0.76, 0),
        new THREE.Vector3(gh.halfW*1.01, 0.01, 0)
      ], false, 'catmullrom', 0.5);
      // 仅两端拱架
      [-gh.halfL, gh.halfL].forEach(function(z) {
        var pts3d = archCurve.getPoints(50).map(function(p) { return new THREE.Vector3(p.x, p.y, z); });
        var curve3d = new THREE.CatmullRomCurve3(pts3d);
        archOutline.add(new THREE.Mesh(new THREE.TubeGeometry(curve3d, 40, tubeRad, tubeSegs, false), glowMat));
      });
      // 底部两侧边线
      var baseCurveL = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-gh.halfW*1.01, 0.02, -gh.halfL), new THREE.Vector3(-gh.halfW*1.01, 0.02, gh.halfL)]);
      var baseCurveR = new THREE.CatmullRomCurve3([
        new THREE.Vector3(gh.halfW*1.01, 0.02, -gh.halfL), new THREE.Vector3(gh.halfW*1.01, 0.02, gh.halfL)]);
      archOutline.add(new THREE.Mesh(new THREE.TubeGeometry(baseCurveL, 20, tubeRad, tubeSegs, false), glowMat));
      archOutline.add(new THREE.Mesh(new THREE.TubeGeometry(baseCurveR, 20, tubeRad, tubeSegs, false), glowMat));
      archOutline.renderOrder = 10;
      unit.group.add(archOutline);
      unit.group.userData.archOutline = archOutline;
    }
    // 切换可见性
    archOutline.children.forEach(function(line) {
      var isActive = activeDeviceKey === dk;
      var isHovered = dk === hoveredDK;
      if (isActive) {
        line.material.color.set('#00d9ff'); line.material.opacity = 0.95;
      } else if (isHovered) {
        line.material.color.set('#00d9ff'); line.material.opacity = 0.45;
      } else {
        line.material.opacity = 0;
      }
    });
  });
}

// 弃用 updateActiveGreenhouseHighlight, 统一用 updateFilmHighlights
function updateActiveGreenhouseHighlight(dk) { updateFilmHighlights(null); }
function highlightHoveredGreenhouse(dk) { updateFilmHighlights(dk); }
function clearHoverHighlight() { updateFilmHighlights(null); }

// ========== ThingsBoard Widget 生命周期 ==========

self.onInit = function() {
    console.log('[Full Scene+3D Dual] Initializing...');

    var $el = self.ctx.$container[0] || self.ctx.$container;
    cacheElements($el);

    console.log('[Full Scene+3D Dual] Dual greenhouse mode active');

    window.addEventListener('resize', handleWindowResize);
    loadThreeModule().then(function() {
        console.log('[Full Scene+3D Dual] Three.js loaded, waiting for visibility...');
        waitUntilVisibleThenInit();
    }).catch(function(err) {
        console.error('[Full Scene+3D Dual] Three.js load failed:', err);
    });

    // ===== Device switch tabs =====
    ['device01','device02','device11','device12'].forEach(function(dk) {
        var tab = els['switchTab'+dk.replace('device','')];
        if (tab) tab.addEventListener('click', function() { switchActiveDevice(dk); });
    });

    // ===== Overview button =====
    var overviewBtn = document.getElementById('tb-overview-btn');
    if (overviewBtn) overviewBtn.addEventListener('click', focusCameraOverview);

    // ===== Demo buttons =====
    var mockBtnsContainer = $el.querySelector('.tb-mock-buttons');
    if (mockBtnsContainer) {
        mockBtnsContainer.style.display = CONFIG.showDemoButtons ? '' : 'none';
    }
    var btns = $el.querySelectorAll('.tb-mock-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function() {
            loadScene(this.dataset.scene);
        });
    }

    // ===== Control buttons (RPC to active device) =====
    var ctrlBtns = $el.querySelectorAll('.tb-ctrl-btn');
    for (var j = 0; j < ctrlBtns.length; j++) {
        ctrlBtns[j].addEventListener('click', function() {
            var rpcMethod = this.dataset.rpc;
            var dataKey = this.dataset.key;
            var currentOn = currentData[dataKey];
            var newValue = !currentOn;
            console.log('[CLICK] ' + activeDeviceKey + ' ' + dataKey + ': ' + currentOn + ' -> ' + newValue);

            if (dataKey === 'autoMode') {
              // 本地立即更新 + 标记保护 + 发送 RPC
              currentData.autoMode = newValue;
              deviceData[activeDeviceKey].autoMode = newValue;
              deviceData[activeDeviceKey]._autoModeLocal = true;
              updateControlPanel(currentData);
              sendRpcToActiveDevice(rpcMethod, newValue);
              console.log('[AUTO] ' + activeDeviceKey + ' toggled to ' + newValue + ' (RPC sent)');
              return;
            }

            currentData[dataKey] = newValue;
            deviceData[activeDeviceKey][dataKey] = newValue;
            if (!rpcPending[activeDeviceKey]) rpcPending[activeDeviceKey] = {};
            rpcPending[activeDeviceKey][dataKey] = { value: newValue, startedAt: Date.now() };
            updateControlPanel(currentData);
            sendRpcToActiveDevice(rpcMethod, newValue);
            console.log('[RPC SEND] ' + activeDeviceKey + ' ' + rpcMethod + '=' + newValue);
        });
    }

    // ===== Debug panel =====
    if (els.debugToggle && els.debugPanel) {
        els.debugToggle.addEventListener('click', function() {
            els.debugPanel.classList.toggle('collapsed');
        });
    }

    // ===== Debug sliders (send to active device) =====
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
            slider.addEventListener('input', function(e) {
                e.stopPropagation();
                if (display) display.textContent = parseFloat(this.value).toFixed(decimals) + unit;
            });
            slider.addEventListener('change', function(e) {
                e.stopPropagation();
                debugSliding[key] = false;
                var val = parseFloat(this.value);
                // hourOfDay: 广播到所有4个设备，保证时间统一
                if (key === 'hourOfDay') {
                    ['device01','device02','device11','device12'].forEach(function(dk) {
                        var meta = deviceMeta[dk];
                        if (meta) sendRpcToDevice(dk, meta.deviceId, 'setDebugSensor', { key: key, value: val });
                    });
                } else {
                    sendRpcToActiveDevice('setDebugSensor', { key: key, value: val });
                }
                debugLockUntil[key] = Date.now() + 2000;
                if (els.dbgStatus) {
                    els.dbgStatus.textContent = '✓ ' + (key === 'hourOfDay' ? 'ALL' : activeDeviceKey) + ' ' + key + '=' + val.toFixed(decimals) + unit;
                    els.dbgStatus.className = 'tb-debug-status ok';
                }
            });
        })();
    }

    // ===== Page switch arrows =====
    var arrowLeft = document.getElementById('tb-arrow-left');
    var arrowRight = document.getElementById('tb-arrow-right');
    if (arrowLeft) {
        arrowLeft.addEventListener('click', function() { switchPage('scene'); });
        arrowLeft.style.display = 'none';
    }
    if (arrowRight) {
        arrowRight.addEventListener('click', function() { switchPage('chart'); });
    }
    var dots = $el.querySelectorAll('.tb-page-dot');
    for (var di = 0; di < dots.length; di++) {
        dots[di].addEventListener('click', function() {
            switchPage(this.dataset.page);
        });
    }

    updateAllCharts();
    updatePageIndicator();

    // ===== Clock =====
    if (els.clock) {
        els.clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        refreshTimer = setInterval(function() {
            if (els.clock) {
                els.clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
            }
        }, 1000);
    }

    // Initialize currentData to device01
    currentData = deviceData.device01 || {};
    updateDeviceSwitchUI();
    updateDashboard(mockScenarios.normalDay);
    console.log('[Full Scene+3D Dual] Ready. Active device: ' + activeDeviceKey);
};

self.onDataUpdated = function() {
    if (demoMode) return;

    // *** 关键: 先保存本地 autoMode (用户点击产生的)，防止被遥测覆盖 ***
    var savedAutoMode01 = deviceData.device01 ? deviceData.device01.autoMode : undefined;
    var savedAutoMode02 = deviceData.device02 ? deviceData.device02.autoMode : undefined;

    var allData = readTelemetryData(self.ctx);

    // 只合并遥测中实际存在的字段，autoMode 特殊处理防止覆盖
    ['device01', 'device02', 'device11', 'device12'].forEach(function(dk) {
        var src = allData[dk];
        if (!src) return;
        var dst = deviceData[dk];
        if (!dst) { deviceData[dk] = {}; dst = deviceData[dk]; }

        for (var k in src) {
            if (!src.hasOwnProperty(k)) continue;
            if (k === 'autoMode') {
                // 如果用户刚手动设置了 autoMode，不覆盖
                if (dst._autoModeLocal === true) {
                    // 检查遥测是否已确认（值匹配 → RPC 生效 → 解锁）
                    if (src.autoMode === dst.autoMode) {
                        dst._autoModeLocal = false;
                        console.log('[AUTO CONFIRMED] ' + dk + ' autoMode=' + dst.autoMode + ' confirmed by telemetry, lock released');
                    }
                    // 不覆盖
                } else {
                    dst.autoMode = src.autoMode;
                }
            } else {
                dst[k] = src[k];
            }
        }
    });

    // Update current device panels
    var activeData = deviceData[activeDeviceKey] || {};
    updateDashboard(activeData);

    // Update 3D models for all devices from their stored data
    update3DModels();

    // Update sky based on active device's hourOfDay
    updateSkyByHour(activeData.hourOfDay);
    updateRoadLightsByHour(activeData.hourOfDay);
    if (ENABLE_STREET_LIGHTS) updateStreetLightsByHour(activeData.hourOfDay);

    // Refresh tooltip if mouse is hovering
    if (hoveredDeviceKey && lastMouseEvent) {
      showGreenhouseTooltip(hoveredDeviceKey, lastMouseEvent.clientX, lastMouseEvent.clientY);
    }

    // History and charts
    pushHistory(activeData);
    updateAllCharts();
    updateSummaryCards(activeData);
};

self.onResize = function() {
    resize3D(true);
};

self.onDestroy = function() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    window.removeEventListener('resize', handleWindowResize);
    if (renderer && renderer.domElement) {
      renderer.domElement.removeEventListener('mousemove', on3DMouseMove);
      renderer.domElement.removeEventListener('mouseleave', hideGreenhouseTooltip);
      renderer.domElement.removeEventListener('click', on3DClick);
    }
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
    console.log('[Full Scene+3D Dual] Destroyed');
};
