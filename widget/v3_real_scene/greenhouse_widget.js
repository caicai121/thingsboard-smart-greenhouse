/**
 * 智慧农业大棚数字孪生监控 v3 - 真实背景版
 */

// ========== Mock 场景数据 ==========
const scenes = {
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

let currentData = { ...scenes.normalDay };
let manualDayNight = null; // null = 自动, true = 强制白天, false = 强制夜间

// ========== 缓存 DOM ==========
const els = {};

function cacheElements() {
    // 背景
    els.bgDay = document.getElementById('bgDay');
    els.bgNight = document.getElementById('bgNight');

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

    // 中央标签
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

// ========== 更新背景 ==========
function updateBackground(data) {
    let isDay;
    if (manualDayNight !== null) {
        isDay = manualDayNight;
    } else {
        isDay = data.lightIntensity >= 200;
    }

    if (isDay) {
        els.bgDay.classList.add('active');
        els.bgNight.classList.remove('active');
    } else {
        els.bgDay.classList.remove('active');
        els.bgNight.classList.add('active');
    }
}

// ========== 更新补光灯 ==========
function updateLamps(data) {
    const on = data.lampStatus;
    const isNight = !els.bgDay.classList.contains('active');

    [els.lampGlowLeftMain, els.lampGlowRightMain,
     els.lampGlowLeftMid, els.lampGlowRightMid].forEach(el => {
        el.classList.toggle('active', on);
        // 夜间更强
        el.style.opacity = on ? (isNight ? '0.9' : '0.6') : '0';
    });
}

// ========== 更新风扇 ==========
function updateFans(data) {
    els.fanEffectLeft.classList.toggle('active', data.fanStatus);
    els.fanEffectRight.classList.toggle('active', data.fanStatus);
    els.fanEffectLeftBack.classList.toggle('active', data.fanStatus);
    els.fanEffectRightBack.classList.toggle('active', data.fanStatus);
}

// ========== 更新喷淋 ==========
function updateSpray(data) {
    const on = data.sprayStatus;
    els.sprayLeftFront.classList.toggle('active', on);
    els.sprayLeftMid.classList.toggle('active', on);
    els.sprayRightMid.classList.toggle('active', on);
    els.sprayRightFront.classList.toggle('active', on);
}

// ========== 更新管道 ==========
function updatePipes(data) {
    els.pipeFlowLeft.classList.toggle('active', data.pumpStatus);
    els.pipeFlowRight.classList.toggle('active', data.pumpStatus);
}

// ========== 更新土壤告警 ==========
function updateSoilWarning(data) {
    const alert = data.soilAlarm || data.soilHumidity < 30;
    els.soilWarningArea.classList.toggle('active', alert);
}

// ========== 更新中央标签 ==========
function updateCenterTag(data) {
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
}

// ========== 更新数据面板 ==========
function updateDataPanel(data) {
    els.valTemp.textContent = data.temperature.toFixed(1);
    els.valHum.textContent = data.airHumidity.toFixed(1);
    els.valSoil.textContent = data.soilHumidity.toFixed(1);
    els.valLight.textContent = Math.round(data.lightIntensity);
    els.valCO2.textContent = Math.round(data.co2);
    els.valWater.textContent = data.waterLevel.toFixed(1);

    // 水位条
    els.waterLevelFill.style.width = data.waterLevel + '%';
    els.waterLevelFill.classList.toggle('low', data.waterLevel < 20);

    // 卡片状态
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
    currentData = { ...data };

    updateBackground(data);
    updateLamps(data);
    updateFans(data);
    updateSpray(data);
    updatePipes(data);
    updateSoilWarning(data);
    updateCenterTag(data);
    updateDataPanel(data);
    updateAlarms(data);
    updateBottomBar(data);
    updateHeader(data);
}

// ========== 切换昼夜 ==========
function toggleDayNight() {
    if (manualDayNight === null) {
        manualDayNight = !els.bgDay.classList.contains('active');
    } else {
        manualDayNight = !manualDayNight;
    }
    updateBackground(currentData);
}

// ========== 场景切换 ==========
function loadScene(sceneName) {
    if (scenes[sceneName]) {
        updateUI(scenes[sceneName]);

        // 更新按钮状态
        els.mockButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scene === sceneName);
        });
    }
}

// ========== 时钟 ==========
function updateClock() {
    const now = new Date();
    els.clock.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
}

// ========== 初始化 ==========
function init() {
    cacheElements();

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
    console.log('  loadScene("normalDay")   - 正常白天');
    console.log('  loadScene("nightLamp")   - 夜间补光');
    console.log('  loadScene("irrigation")  - 自动灌溉');
    console.log('  loadScene("lowWater")    - 低水位报警');
    console.log('  toggleDayNight()          - 手动切换昼夜');
}

// DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
