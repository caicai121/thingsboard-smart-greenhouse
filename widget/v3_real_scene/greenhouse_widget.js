/**
 * 智慧农业大棚数字孪生监控 v3 - 真实背景版
 * sceneMode: 控制白天/夜晚背景
 * currentScenario: 控制设备业务状态
 */

// ========== Mock 场景数据 ==========
const scenarios = {
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
let sceneMode = 'day';        // 'day' | 'night' - 只控制背景
let currentScenario = 'normal'; // 'normal' | 'nightLamp' | 'irrigation' | 'lowWater'
let currentData = { ...scenarios.normalDay };
let autoSceneByLight = false; // 是否根据 lightIntensity 自动切换（本地演示阶段关闭）

// ========== 缓存 DOM ==========
const els = {};

function cacheElements() {
    els.bgDay = document.getElementById('bgDay');
    els.bgNight = document.getElementById('bgNight');
    els.stage = document.querySelector('.greenhouse-stage');

    // 补光灯
    els.lampGlowLeftMain = document.getElementById('lampGlowLeftMain');
    els.lampGlowRightMain = document.getElementById('lampGlowRightMain');
    els.lampGlowLeftMid = document.getElementById('lampGlowLeftMid');
    els.lampGlowRightMid = document.getElementById('lampGlowRightMid');

    // 风扇
    els.fanEffectLeft = document.getElementById('fanEffectLeft');
    els.fanEffectRight = document.getElementById('fanEffectRight');
    els.fanEffectLeftBack = document.getElementById('fanEffectLeftBack');
    els.fanEffectRightBack = document.getElementById('fanEffectRightBack');

    // 喷淋
    els.sprayLeftFront = document.getElementById('sprayLeftFront');
    els.sprayLeftMid = document.getElementById('sprayLeftMid');
    els.sprayRightMid = document.getElementById('sprayRightMid');
    els.sprayRightFront = document.getElementById('sprayRightFront');

    // 管道
    els.pipeFlowLeft = document.getElementById('pipeFlowLeft');
    els.pipeFlowRight = document.getElementById('pipeFlowRight');

    // 土壤告警
    els.soilWarningArea = document.getElementById('soilWarningArea');
    els.centerTag = document.getElementById('centerTag');

    // 数据值
    els.valTemp = document.getElementById('valTemp');
    els.valHum = document.getElementById('valHum');
    els.valSoil = document.getElementById('valSoil');
    els.valLight = document.getElementById('valLight');
    els.valCO2 = document.getElementById('valCO2');
    els.valWater = document.getElementById('valWater');
    els.waterLevelFill = document.getElementById('waterLevelFill');

    // 数据卡片
    els.cardTemp = document.getElementById('cardTemp');
    els.cardHum = document.getElementById('cardHum');
    els.cardSoil = document.getElementById('cardSoil');
    els.cardLight = document.getElementById('cardLight');
    els.cardCO2 = document.getElementById('cardCO2');
    els.cardWater = document.getElementById('cardWater');

    // 报警
    els.alarmSoil = document.getElementById('alarmSoil');
    els.textAlarmSoil = document.getElementById('textAlarmSoil');
    els.alarmTemp = document.getElementById('alarmTemp');
    els.textAlarmTemp = document.getElementById('textAlarmTemp');
    els.alarmWater = document.getElementById('alarmWater');
    els.textAlarmWater = document.getElementById('textAlarmWater');
    els.alarmCO2 = document.getElementById('alarmCO2');
    els.textAlarmCO2 = document.getElementById('textAlarmCO2');

    // 底部状态
    els.ledFan = document.getElementById('ledFan');
    els.stateFan = document.getElementById('stateFan');
    els.ledPump = document.getElementById('ledPump');
    els.statePump = document.getElementById('statePump');
    els.ledLamp = document.getElementById('ledLamp');
    els.stateLamp = document.getElementById('stateLamp');
    els.ledSpray = document.getElementById('ledSpray');
    els.stateSpray = document.getElementById('stateSpray');
    els.ledAuto = document.getElementById('ledAuto');
    els.stateAuto = document.getElementById('stateAuto');

    // 头部
    els.headerMode = document.getElementById('headerMode');
    els.clock = document.getElementById('clock');
    els.modeToggle = document.getElementById('modeToggle');

    // 场景按钮
    els.mockButtons = document.querySelectorAll('.mock-btn');
}

// ========== 动态生成喷淋粒子 ==========
function createSprayParticles(container, lineCount = 45, particleCount = 70) {
    container.innerHTML = '';

    for (let i = 0; i < lineCount; i++) {
        const line = document.createElement('span');
        line.className = 'water-line';

        const angle = -65 + Math.random() * 130;
        const length = 28 + Math.random() * 22;
        const delay = Math.random() * 0.8;
        const xOffset = -6 + Math.random() * 12;

        line.style.setProperty('--angle', `${angle}deg`);
        line.style.setProperty('--length', `${length}%`);
        line.style.setProperty('--delay', `${delay}s`);
        line.style.setProperty('--x-offset', `${xOffset}px`);

        container.appendChild(line);
    }

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('span');
        particle.className = 'water-particle';

        const angle = -70 + Math.random() * 140;
        const distance = 90 + Math.random() * 180;
        const delay = Math.random() * 1.2;
        const size = 1 + Math.random() * 2.5;

        particle.style.setProperty('--angle', `${angle}deg`);
        particle.style.setProperty('--distance', `${distance}px`);
        particle.style.setProperty('--delay', `${delay}s`);
        particle.style.setProperty('--size', `${size}px`);

        container.appendChild(particle);
    }
}

function initSprayParticles() {
    document.querySelectorAll('.spray-effect').forEach(el => {
        createSprayParticles(el, 45, 70);
    });
}

// ========== 应用场景模式（背景）==========
function applySceneMode(mode) {
    sceneMode = mode;
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

// ========== 应用业务场景（设备状态）==========
function applyScenario(data) {
    currentData = { ...data };

    // 补光灯
    const lampOn = data.lampStatus;
    const isNight = sceneMode === 'night';
    [els.lampGlowLeftMain, els.lampGlowRightMain,
     els.lampGlowLeftMid, els.lampGlowRightMid].forEach(el => {
        el.classList.toggle('active', lampOn);
        el.style.opacity = lampOn ? (isNight ? '0.9' : '0.6') : '0';
    });

    // 风扇
    els.fanEffectLeft.classList.toggle('active', data.fanStatus);
    els.fanEffectRight.classList.toggle('active', data.fanStatus);
    els.fanEffectLeftBack.classList.toggle('active', data.fanStatus);
    els.fanEffectRightBack.classList.toggle('active', data.fanStatus);

    // 喷淋
    const sprayOn = data.sprayStatus;
    els.sprayLeftFront.classList.toggle('active', sprayOn);
    els.sprayLeftMid.classList.toggle('active', sprayOn);
    els.sprayRightMid.classList.toggle('active', sprayOn);
    els.sprayRightFront.classList.toggle('active', sprayOn);

    // 管道
    els.pipeFlowLeft.classList.toggle('active', data.pumpStatus);
    els.pipeFlowRight.classList.toggle('active', data.pumpStatus);

    // 土壤告警
    const soilAlert = data.soilAlarm || data.soilHumidity < 30;
    els.soilWarningArea.classList.toggle('active', soilAlert);

    // 中央标签
    const texts = [];
    if (data.autoMode) texts.push('自动模式运行中');
    if (data.sprayStatus) texts.push('灌溉系统运行中');
    if (data.pumpStatus) texts.push('水泵运行中');
    if (texts.length > 0) {
        els.centerTag.setAttribute('data-text', texts[0]);
        els.centerTag.classList.add('active');
    } else {
        els.centerTag.classList.remove('active');
    }

    // 数据面板
    updateDataPanel(data);
    updateAlarms(data);
    updateBottomBar(data);
    updateHeader(data);
}

// ========== 更新数据面板 ==========
function updateDataPanel(data) {
    els.valTemp.textContent = data.temperature.toFixed(1);
    els.valHum.textContent = data.airHumidity.toFixed(1);
    els.valSoil.textContent = data.soilHumidity.toFixed(1);
    els.valLight.textContent = Math.round(data.lightIntensity);
    els.valCO2.textContent = Math.round(data.co2);
    els.valWater.textContent = data.waterLevel.toFixed(1);

    els.waterLevelFill.style.width = data.waterLevel + '%';
    els.waterLevelFill.classList.toggle('low', data.waterLevel < 20);

    updateCardStatus(els.cardTemp, data.temperature, 32, 38);
    updateCardStatus(els.cardHum, data.airHumidity, null, null);
    updateCardStatus(els.cardSoil, data.soilHumidity, null, 30);
    updateCardStatus(els.cardLight, data.lightIntensity, null, null);
    updateCardStatus(els.cardCO2, data.co2, 1000, 1500);
    updateCardStatus(els.cardWater, data.waterLevel, null, 20);
}

function updateCardStatus(card, value, warnThreshold, dangerThreshold) {
    card.classList.remove('warning', 'danger');
    if (dangerThreshold !== null && value < dangerThreshold) {
        card.classList.add('danger');
    } else if (warnThreshold !== null && value > warnThreshold) {
        card.classList.add('warning');
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
    row.classList.toggle('alert', isAlert);
    textEl.textContent = isAlert ? alertText : '正常';
}

// ========== 更新底部状态条 ==========
function updateBottomBar(data) {
    updateDeviceStatus(els.ledFan, els.stateFan, data.fanStatus, '运行', '停止', 'on');
    updateDeviceStatus(els.ledPump, els.statePump, data.pumpStatus, '运行', '停止', 'on-blue');
    updateDeviceStatus(els.ledLamp, els.stateLamp, data.lampStatus, '开启', '关闭', 'on-yellow');
    updateDeviceStatus(els.ledSpray, els.stateSpray, data.sprayStatus, '运行', '停止', 'on-cyan');
    updateDeviceStatus(els.ledAuto, els.stateAuto, data.autoMode, '自动', '手动', 'on-orange');
}

function updateDeviceStatus(led, state, isOn, onText, offText, onClass) {
    led.className = 'device-led';
    if (isOn) {
        led.classList.add(onClass);
        state.textContent = onText;
        state.classList.add('on');
    } else {
        state.textContent = offText;
        state.classList.remove('on');
    }
}

// ========== 更新头部 ==========
function updateHeader(data) {
    els.headerMode.textContent = data.autoMode ? '自动模式' : '手动模式';
    els.headerMode.className = 'stat-value' + (data.autoMode ? ' status-online' : '');
}

// ========== 主更新函数 ==========
function updateUI(data) {
    applyScenario(data);
}

// ========== 切换昼夜（只改背景，不改业务状态）==========
function toggleDayNight() {
    const newMode = sceneMode === 'day' ? 'night' : 'day';
    applySceneMode(newMode);
    // 更新当前数据的 lightIntensity 以匹配场景
    currentData.lightIntensity = newMode === 'day' ? 600 : 100;
    updateDataPanel(currentData);
}

// ========== 场景切换 ==========
function loadScene(sceneName) {
    const scenarioData = scenarios[sceneName];
    if (!scenarioData) return;

    currentScenario = sceneName;

    // 只有 normalDay 和 nightLamp 改变背景模式
    if (sceneName === 'normalDay') {
        applySceneMode('day');
    } else if (sceneName === 'nightLamp') {
        applySceneMode('night');
    }
    // irrigation 和 lowWater 保持当前背景模式不变

    // 根据当前场景模式调整 lightIntensity
    const data = { ...scenarioData };
    data.lightIntensity = sceneMode === 'night' ? 100 : 600;

    applyScenario(data);

    // 更新按钮状态
    els.mockButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.scene === sceneName);
    });
}

// ========== 时钟 ==========
function updateClock() {
    const now = new Date();
    els.clock.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
}

// ========== 初始化 ==========
function init() {
    cacheElements();
    initSprayParticles();

    // 事件绑定
    els.modeToggle.addEventListener('click', toggleDayNight);
    els.mockButtons.forEach(btn => {
        btn.addEventListener('click', () => loadScene(btn.dataset.scene));
    });

    // 初始渲染
    loadScene('normalDay');

    // 时钟
    updateClock();
    setInterval(updateClock, 1000);

    console.log('%c🌱 智慧农业大棚数字孪生监控 v3 已启动', 'color: #35f28f; font-size: 14px; font-weight: bold;');
    console.log('%c可用场景：', 'color: #00d9ff;');
    console.log('  loadScene("normalDay")   - 正常白天（切白天背景）');
    console.log('  loadScene("nightLamp")   - 夜间补光（切夜晚背景）');
    console.log('  loadScene("irrigation")  - 自动灌溉（保持当前背景）');
    console.log('  loadScene("lowWater")    - 低水位报警（保持当前背景）');
    console.log('  toggleDayNight()          - 手动切换昼夜（不改业务状态）');
}

// DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
