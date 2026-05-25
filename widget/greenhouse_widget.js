/**
 * 智慧农业大棚 SVG 动态 Widget - 深色科技风 v2
 * 数据驱动：根据 mockData 或 ThingsBoard 遥测数据更新 SVG 场景
 */

// ========== Mock 数据（本地预览用）==========
const mockData = {
    temperature: 25.3,
    airHumidity: 53.8,
    soilHumidity: 43.0,
    lightIntensity: 474.8,
    co2: 641.2,
    waterLevel: 80.0,
    fanStatus: false,
    pumpStatus: false,
    lampStatus: false,
    sprayStatus: false,
    autoMode: false,
    soilAlarm: false,
    tempAlarm: false,
    waterAlarm: false,
    co2Alarm: false,
};

// ========== 状态变量 ==========
let currentData = { ...mockData };
let manualNightMode = null; // null = 自动, true = 强制夜间, false = 强制日间

// ========== DOM 元素缓存 ==========
const els = {};

function cacheElements() {
    // SVG 元素
    els.fanBlade = document.getElementById('fan_blade');
    els.sprayDrops = document.getElementById('spray_drops');
    els.lampGlow = document.getElementById('lamp_glow');
    els.lampGlow2 = document.getElementById('lamp_glow_2');
    els.soilBed = document.getElementById('soil_bed');
    els.soilSurface = document.getElementById('soil_surface');
    els.waterFill = document.getElementById('water_fill');
    els.waterPipe = document.getElementById('water_pipe');
    els.alertPanel = document.getElementById('alert_panel');
    els.alertText = document.getElementById('alert_text');
    els.fanStatusLed = document.getElementById('fan_status_led');
    els.pumpStatusLed = document.getElementById('pump_status_led');
    els.tankStatusLed = document.getElementById('tank_status_led');
    els.barFanLed = document.getElementById('bar_fan_led');
    els.barPumpLed = document.getElementById('bar_pump_led');
    els.barLampLed = document.getElementById('bar_lamp_led');
    els.barSprayLed = document.getElementById('bar_spray_led');
    els.barAutoLed = document.getElementById('bar_auto_led');

    // 数据卡片值
    els.valTemperature = document.getElementById('valTemperature');
    els.valAirHumidity = document.getElementById('valAirHumidity');
    els.valSoilHumidity = document.getElementById('valSoilHumidity');
    els.valLight = document.getElementById('valLight');
    els.valCO2 = document.getElementById('valCO2');
    els.valWater = document.getElementById('valWater');

    // 状态指示
    els.dotFan = document.getElementById('dotFan');
    els.textFan = document.getElementById('textFan');
    els.dotPump = document.getElementById('dotPump');
    els.textPump = document.getElementById('textPump');
    els.dotLamp = document.getElementById('dotLamp');
    els.textLamp = document.getElementById('textLamp');
    els.dotSpray = document.getElementById('dotSpray');
    els.textSpray = document.getElementById('textSpray');
    els.dotAuto = document.getElementById('dotAuto');
    els.textAuto = document.getElementById('textAuto');

    // 报警
    els.alarmSoil = document.getElementById('alarmSoil');
    els.iconSoil = document.getElementById('iconSoil');
    els.statusSoil = document.getElementById('statusSoil');
    els.alarmTemp = document.getElementById('alarmTemp');
    els.iconTemp = document.getElementById('iconTemp');
    els.statusTemp = document.getElementById('statusTemp');
    els.alarmWater = document.getElementById('alarmWater');
    els.iconWater = document.getElementById('iconWater');
    els.statusWater = document.getElementById('statusWater');
    els.alarmCo2 = document.getElementById('alarmCO2');
    els.iconCo2 = document.getElementById('iconCO2');
    els.statusCo2 = document.getElementById('statusCO2');

    // 控制
    els.modeToggle = document.getElementById('modeToggle');
    els.headerMode = document.getElementById('headerMode');
    els.clock = document.getElementById('clock');
}

// ========== 更新数据面板 ==========
function updateDataPanel(data) {
    els.valTemperature.textContent = data.temperature.toFixed(1);
    els.valAirHumidity.textContent = data.airHumidity.toFixed(1);
    els.valSoilHumidity.textContent = data.soilHumidity.toFixed(1);
    els.valLight.textContent = Math.round(data.lightIntensity);
    els.valCO2.textContent = Math.round(data.co2);
    els.valWater.textContent = data.waterLevel.toFixed(1);

    // 土壤湿度卡片状态
    const soilCard = document.getElementById('cardSoilHumidity');
    soilCard.classList.remove('warning', 'danger');
    if (data.soilHumidity < 20) {
        soilCard.classList.add('danger');
    } else if (data.soilHumidity < 30) {
        soilCard.classList.add('warning');
    }

    // 水位卡片状态
    const waterCard = document.getElementById('cardWater');
    waterCard.classList.remove('warning', 'danger');
    if (data.waterLevel < 10) {
        waterCard.classList.add('danger');
    } else if (data.waterLevel < 20) {
        waterCard.classList.add('warning');
    }

    // 温度卡片状态
    const tempCard = document.getElementById('cardTemperature');
    tempCard.classList.remove('warning', 'danger');
    if (data.temperature > 38) {
        tempCard.classList.add('danger');
    } else if (data.temperature > 32) {
        tempCard.classList.add('warning');
    }
}

// ========== 更新设备状态 ==========
function updateDeviceStatus(data) {
    // 风扇
    if (data.fanStatus) {
        els.fanBlade.classList.add('rotating');
        els.fanStatusLed.classList.add('on');
        els.dotFan.classList.add('active');
        els.textFan.textContent = '运行';
        els.textFan.classList.add('active');
        els.barFanLed.classList.add('on');
    } else {
        els.fanBlade.classList.remove('rotating');
        els.fanStatusLed.classList.remove('on');
        els.dotFan.classList.remove('active');
        els.textFan.textContent = '停止';
        els.textFan.classList.remove('active');
        els.barFanLed.classList.remove('on');
    }

    // 水泵
    if (data.pumpStatus) {
        els.pumpStatusLed.classList.add('on');
        els.dotPump.classList.add('active');
        els.textPump.textContent = '运行';
        els.textPump.classList.add('active');
        els.barPumpLed.classList.add('on');
        els.waterPipe.classList.add('active');
    } else {
        els.pumpStatusLed.classList.remove('on');
        els.dotPump.classList.remove('active');
        els.textPump.textContent = '停止';
        els.textPump.classList.remove('active');
        els.barPumpLed.classList.remove('on');
        els.waterPipe.classList.remove('active');
    }

    // 补光灯
    if (data.lampStatus) {
        els.lampGlow.classList.add('active');
        els.lampGlow2.classList.add('active');
        els.lampGlow.style.opacity = '0.6';
        els.lampGlow2.style.opacity = '0.6';
        els.dotLamp.classList.add('active');
        els.textLamp.textContent = '开启';
        els.textLamp.classList.add('active');
        els.barLampLed.classList.add('on');
    } else {
        els.lampGlow.classList.remove('active');
        els.lampGlow2.classList.remove('active');
        els.lampGlow.style.opacity = '0';
        els.lampGlow2.style.opacity = '0';
        els.dotLamp.classList.remove('active');
        els.textLamp.textContent = '关闭';
        els.textLamp.classList.remove('active');
        els.barLampLed.classList.remove('on');
    }

    // 喷淋
    if (data.sprayStatus) {
        els.sprayDrops.classList.add('active');
        els.sprayDrops.style.opacity = '1';
        els.dotSpray.classList.add('active');
        els.textSpray.textContent = '运行';
        els.textSpray.classList.add('active');
        els.barSprayLed.classList.add('on');
    } else {
        els.sprayDrops.classList.remove('active');
        els.sprayDrops.style.opacity = '0';
        els.dotSpray.classList.remove('active');
        els.textSpray.textContent = '停止';
        els.textSpray.classList.remove('active');
        els.barSprayLed.classList.remove('on');
    }

    // 自动模式
    if (data.autoMode) {
        els.dotAuto.classList.add('warning');
        els.textAuto.textContent = '自动';
        els.textAuto.classList.add('active');
        els.barAutoLed.classList.add('on');
        els.headerMode.textContent = '自动模式';
        els.headerMode.style.color = 'var(--accent-orange)';
    } else {
        els.dotAuto.classList.remove('warning');
        els.textAuto.textContent = '手动';
        els.textAuto.classList.remove('active');
        els.barAutoLed.classList.remove('on');
        els.headerMode.textContent = '手动模式';
        els.headerMode.style.color = 'var(--text-secondary)';
    }
}

// ========== 更新报警状态 ==========
function updateAlarmStatus(data) {
    updateAlarmItem('soil', data.soilAlarm, '土壤干旱');
    updateAlarmItem('temp', data.tempAlarm, '温度过高');
    updateAlarmItem('water', data.waterAlarm, '水位过低');
    updateAlarmItem('co2', data.co2Alarm, 'CO₂过高');

    // 报警提示框
    const alerts = [];
    if (data.soilAlarm) alerts.push('⚠ 土壤湿度过低，建议灌溉');
    if (data.tempAlarm) alerts.push('⚠ 温度过高');
    if (data.waterAlarm) alerts.push('⚠ 水位过低，请立即补水');
    if (data.co2Alarm) alerts.push('⚠ CO₂ 浓度过高');

    if (alerts.length > 0) {
        els.alertText.textContent = alerts[0];
        els.alertPanel.style.opacity = '1';
        els.alertPanel.classList.add('active');
    } else {
        els.alertPanel.style.opacity = '0';
        els.alertPanel.classList.remove('active');
    }
}

function updateAlarmItem(name, isAlert, alertText) {
    const item = els[`alarm${name.charAt(0).toUpperCase() + name.slice(1)}`];
    const icon = els[`icon${name.charAt(0).toUpperCase() + name.slice(1)}`];
    const status = els[`status${name.charAt(0).toUpperCase() + name.slice(1)}`];

    if (isAlert) {
        item.classList.add('alert');
        status.textContent = alertText;
    } else {
        item.classList.remove('alert');
        status.textContent = '正常';
    }
}

// ========== 更新 SVG 场景 ==========
function updateSVGScene(data) {
    // 土壤颜色（根据土壤湿度）
    const bedRect = els.soilBed.querySelector('rect');
    if (data.soilHumidity < 30) {
        bedRect.setAttribute('stroke', 'url(#bedBorderDry)');
        els.soilSurface.setAttribute('fill', '#2a2a1a');
    } else {
        bedRect.setAttribute('stroke', 'url(#bedBorderNormal)');
        els.soilSurface.setAttribute('fill', '#1a3a2a');
    }

    // 水箱水位
    const waterHeight = Math.max(3, (data.waterLevel / 100) * 80);
    const waterY = 100 - waterHeight;
    els.waterFill.setAttribute('height', waterHeight);
    els.waterFill.setAttribute('y', waterY);

    // 水箱颜色和状态灯
    els.tankStatusLed.classList.remove('alert');
    if (data.waterLevel < 20) {
        els.waterFill.setAttribute('fill', 'rgba(255,56,96,0.5)');
        els.tankStatusLed.classList.add('alert');
    } else if (data.waterLevel < 40) {
        els.waterFill.setAttribute('fill', 'rgba(255,149,0,0.4)');
    } else {
        els.waterFill.setAttribute('fill', 'rgba(0,168,232,0.4)');
    }
}

// ========== 夜间模式 ==========
function checkNightMode(data) {
    if (manualNightMode !== null) {
        return manualNightMode;
    }
    return data.lightIntensity < 200;
}

function applyNightMode(isNight) {
    document.body.classList.toggle('night-mode', isNight);

    // SVG 背景调整
    const sceneBg = document.getElementById('sceneBg');
    if (sceneBg) {
        sceneBg.setAttribute('fill', isNight ? '#040d14' : 'url(#bgGradient)');
    }
}

// ========== 主更新函数 ==========
function updateUI(data) {
    currentData = { ...data };

    updateDataPanel(data);
    updateDeviceStatus(data);
    updateAlarmStatus(data);
    updateSVGScene(data);

    const shouldBeNight = checkNightMode(data);
    applyNightMode(shouldBeNight);
}

// ========== 手动切换夜间模式 ==========
function toggleNightMode() {
    if (manualNightMode === null) {
        manualNightMode = !checkNightMode(currentData);
    } else {
        manualNightMode = !manualNightMode;
    }
    applyNightMode(manualNightMode);
}

// ========== 时钟更新 ==========
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
    if (els.clock) {
        els.clock.textContent = timeStr;
    }
}

// ========== 随机数据模拟（用于本地演示）==========
function simulateDataChanges() {
    const data = { ...currentData };

    // 小幅随机波动
    data.temperature += (Math.random() - 0.5) * 0.3;
    data.airHumidity += (Math.random() - 0.5) * 0.8;
    data.co2 += (Math.random() - 0.5) * 3;
    data.lightIntensity += (Math.random() - 0.5) * 8;

    // 限制范围
    data.temperature = Math.max(15, Math.min(45, data.temperature));
    data.airHumidity = Math.max(30, Math.min(100, data.airHumidity));
    data.co2 = Math.max(300, Math.min(2000, data.co2));
    data.lightIntensity = Math.max(0, Math.min(1200, data.lightIntensity));

    // 水泵运行时土壤湿度上升，水位下降
    if (data.pumpStatus) {
        data.soilHumidity += 0.2;
        data.waterLevel -= 0.08;
    } else {
        data.soilHumidity -= 0.03;
    }

    data.soilHumidity = Math.max(5, Math.min(90, data.soilHumidity));
    data.waterLevel = Math.max(0, Math.min(100, data.waterLevel));

    // 更新报警
    data.soilAlarm = data.soilHumidity < 30;
    data.tempAlarm = data.temperature > 35;
    data.waterAlarm = data.waterLevel < 20;
    data.co2Alarm = data.co2 > 1000;

    updateUI(data);
}

// ========== 快速测试函数 ==========
function setMockData(overrides) {
    const newData = { ...currentData, ...overrides };
    updateUI(newData);
}

// ========== ThingsBoard 集成接口 ==========
function updateFromThingsBoard(telemetry) {
    const mapping = {
        temperature: 'temperature',
        airHumidity: 'airHumidity',
        soilHumidity: 'soilHumidity',
        lightIntensity: 'lightIntensity',
        co2: 'co2',
        waterLevel: 'waterLevel',
        fanStatus: 'fanStatus',
        pumpStatus: 'pumpStatus',
        lampStatus: 'lampStatus',
        sprayStatus: 'sprayStatus',
        autoMode: 'autoMode',
        soilAlarm: 'soilAlarm',
        tempAlarm: 'tempAlarm',
        waterAlarm: 'waterAlarm',
        co2Alarm: 'co2Alarm',
    };

    const newData = { ...currentData };
    for (const [tbKey, localKey] of Object.entries(mapping)) {
        if (telemetry[tbKey] !== undefined) {
            const value = telemetry[tbKey];
            if (value === 'true' || value === true) {
                newData[localKey] = true;
            } else if (value === 'false' || value === false) {
                newData[localKey] = false;
            } else {
                newData[localKey] = parseFloat(value) || value;
            }
        }
    }

    updateUI(newData);
}

// ========== 初始化 ==========
function init() {
    cacheElements();

    // 绑定事件
    els.modeToggle.addEventListener('click', toggleNightMode);

    // 初始渲染
    updateUI(mockData);

    // 启动时钟
    updateClock();
    setInterval(updateClock, 1000);

    // 启动模拟数据变化（本地演示用，ThingsBoard 集成时请删除）
    setInterval(simulateDataChanges, 3000);

    console.log('%c🌱 智慧农业大棚数字孪生监控已启动', 'color: #35f28f; font-size: 14px; font-weight: bold;');
    console.log('%c可用测试命令：', 'color: #00d9ff;');
    console.log('  setMockData({fanStatus: true})     - 开启风扇');
    console.log('  setMockData({sprayStatus: true})   - 开启喷淋');
    console.log('  setMockData({lampStatus: true})    - 开启补光灯');
    console.log('  setMockData({soilHumidity: 20})    - 土壤干旱');
    console.log('  setMockData({waterLevel: 10})      - 水位过低');
    console.log('  setMockData({lightIntensity: 100}) - 夜间模式');
    console.log('  toggleNightMode()                   - 手动切换夜间模式');
}

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
