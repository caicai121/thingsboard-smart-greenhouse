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

    // 数据刷新间隔 (ms)
    refreshInterval: 3000
};

// ========== Mock 演示数据 ==========
const mockScenarios = {
    normalDay: {
        temperature: 24.8, airHumidity: 49.3, soilHumidity: 43.0,
        lightIntensity: 600, co2: 641, waterLevel: 80,
        fanStatus: false, pumpStatus: false, lampStatus: false,
        sprayStatus: false, autoMode: false,
        soilAlarm: false, tempAlarm: false, waterAlarm: false, co2Alarm: false
    },
    nightLamp: {
        temperature: 22.5, airHumidity: 58.0, soilHumidity: 45.0,
        lightIntensity: 100, co2: 620, waterLevel: 78,
        fanStatus: false, pumpStatus: false, lampStatus: true,
        sprayStatus: false, autoMode: true,
        soilAlarm: false, tempAlarm: false, waterAlarm: false, co2Alarm: false
    },
    irrigation: {
        temperature: 27.5, airHumidity: 52.0, soilHumidity: 22.0,
        lightIntensity: 500, co2: 700, waterLevel: 75,
        fanStatus: false, pumpStatus: true, lampStatus: false,
        sprayStatus: true, autoMode: true,
        soilAlarm: true, tempAlarm: false, waterAlarm: false, co2Alarm: false
    },
    lowWater: {
        temperature: 28.0, airHumidity: 50.0, soilHumidity: 20.0,
        lightIntensity: 500, co2: 690, waterLevel: 10,
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
let els = {};
let refreshTimer = null;

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
        lightIntensity: Number(getLatestValue(ctx, 'lightIntensity', 0)),
        co2: Number(getLatestValue(ctx, 'co2', 0)),
        waterLevel: Number(getLatestValue(ctx, 'waterLevel', 0)),
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
        clock: q('.tb-clock')
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

// ========== 主更新函数 ==========
function updateDashboard(data) {
    currentData = data;

    // 非演示模式下，根据真实光照自动切换昼夜背景
    if (!demoMode) {
        var newMode = data.lightIntensity < 200 ? 'night' : 'day';
        if (newMode !== sceneMode) {
            applySceneMode(newMode);
        }
    }

    updateEffects(data);
    updateDataPanel(data);
    updateAlarms(data);
    updateBottomBar(data);
    updateHeader(data);
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
    data.lightIntensity = sceneMode === 'night' ? 100 : 600;
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
    if (els.bgDay) els.bgDay.src = CONFIG.dayImage;
    if (els.bgNight) els.bgNight.src = CONFIG.nightImage;

    // 绑定演示场景按钮（始终绑定，由 demoMode 控制行为）
    var btns = $el.querySelectorAll('.tb-mock-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function() {
            loadScene(this.dataset.scene);
        });
    }

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

    // 更新仪表盘
    updateDashboard(data);
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
