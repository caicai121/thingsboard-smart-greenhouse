/**
 * 智慧农业大棚 SVG 动态 Widget
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
let isNightMode = false;
let manualNightMode = null; // null = 自动, true = 强制夜间, false = 强制日间

// ========== DOM 元素缓存 ==========
const els = {};

function cacheElements() {
    // SVG 元素
    els.fanBlade = document.getElementById('fanBlade');
    els.sprayDrops = document.getElementById('sprayDrops');
    els.lampGlow = document.getElementById('lampGlow');
    els.lampGlow2 = document.getElementById('lampGlow2');
    els.soil = document.getElementById('soil');
    els.waterFill = document.getElementById('waterFill');
    els.alertPanel = document.getElementById('alertPanel');
    els.alertText = document.getElementById('alertText');
    els.autoModeIndicator = document.getElementById('autoModeIndicator');
    els.sceneBg = document.getElementById('sceneBg');
    els.greenhouseBack = document.getElementById('greenhouseBack');

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
    els.alarmCO2 = document.getElementById('alarmCO2');
    els.iconCO2 = document.getElementById('iconCO2');
    els.statusCO2 = document.getElementById('statusCO2');

    // 控制
    els.modeToggle = document.getElementById('modeToggle');
    els.modeIndicator = document.getElementById('modeIndicator');
}

// ========== 更新数据面板 ==========
function updateDataPanel(data) {
    els.valTemperature.textContent = data.temperature.toFixed(1);
    els.valAirHumidity.textContent = data.airHumidity.toFixed(1);
    els.valSoilHumidity.textContent = data.soilHumidity.toFixed(1);
    els.valLight.textContent = Math.round(data.lightIntensity);
    els.valCO2.textContent = Math.round(data.co2);
    els.valWater.textContent = data.waterLevel.toFixed(1);

    // 土壤湿度卡片变色
    const soilCard = document.getElementById('cardSoilHumidity');
    if (data.soilHumidity < 30) {
        soilCard.style.background = 'rgba(231, 76, 60, 0.1)';
        soilCard.style.borderColor = 'rgba(231, 76, 60, 0.3)';
    } else {
        soilCard.style.background = '';
        soilCard.style.borderColor = 'transparent';
    }

    // 水位卡片变色
    const waterCard = document.getElementById('cardWater');
    if (data.waterLevel < 20) {
        waterCard.style.background = 'rgba(231, 76, 60, 0.1)';
        waterCard.style.borderColor = 'rgba(231, 76, 60, 0.3)';
    } else {
        waterCard.style.background = '';
        waterCard.style.borderColor = 'transparent';
    }
}

// ========== 更新设备状态 ==========
function updateDeviceStatus(data) {
    // 风扇
    if (data.fanStatus) {
        els.fanBlade.classList.add('rotating');
        els.dotFan.classList.add('active');
        els.textFan.textContent = '运行中';
        els.textFan.classList.add('active');
    } else {
        els.fanBlade.classList.remove('rotating');
        els.dotFan.classList.remove('active');
        els.textFan.textContent = '关闭';
        els.textFan.classList.remove('active');
    }

    // 水泵
    if (data.pumpStatus) {
        els.dotPump.classList.add('active');
        els.textPump.textContent = '运行中';
        els.textPump.classList.add('active');
    } else {
        els.dotPump.classList.remove('active');
        els.textPump.textContent = '关闭';
        els.textPump.classList.remove('active');
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
    } else {
        els.lampGlow.classList.remove('active');
        els.lampGlow2.classList.remove('active');
        els.lampGlow.style.opacity = '0';
        els.lampGlow2.style.opacity = '0';
        els.dotLamp.classList.remove('active');
        els.textLamp.textContent = '关闭';
        els.textLamp.classList.remove('active');
    }

    // 喷淋
    if (data.sprayStatus) {
        els.sprayDrops.classList.add('active');
        els.sprayDrops.style.opacity = '1';
        els.dotSpray.classList.add('active');
        els.textSpray.textContent = '运行中';
        els.textSpray.classList.add('active');
    } else {
        els.sprayDrops.classList.remove('active');
        els.sprayDrops.style.opacity = '0';
        els.dotSpray.classList.remove('active');
        els.textSpray.textContent = '关闭';
        els.textSpray.classList.remove('active');
    }

    // 自动模式
    if (data.autoMode) {
        els.dotAuto.classList.add('warning');
        els.textAuto.textContent = '自动';
        els.textAuto.classList.add('active');
        els.autoModeIndicator.style.opacity = '1';
    } else {
        els.dotAuto.classList.remove('warning');
        els.textAuto.textContent = '手动';
        els.textAuto.classList.remove('active');
        els.autoModeIndicator.style.opacity = '0';
    }
}

// ========== 更新报警状态 ==========
function updateAlarmStatus(data) {
    updateAlarmItem('soil', data.soilAlarm, '土壤湿度过低');
    updateAlarmItem('temp', data.tempAlarm, '温度过高');
    updateAlarmItem('water', data.waterAlarm, '水位过低');
    updateAlarmItem('co2', data.co2Alarm, 'CO₂ 过高');

    // 报警提示框
    const alerts = [];
    if (data.soilAlarm) alerts.push('⚠️ 土壤湿度过低，建议灌溉');
    if (data.tempAlarm) alerts.push('⚠️ 温度过高');
    if (data.waterAlarm) alerts.push('⚠️ 水位过低，请补水');
    if (data.co2Alarm) alerts.push('⚠️ CO₂ 浓度过高');

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
        icon.textContent = '!';
        status.textContent = alertText;
    } else {
        item.classList.remove('alert');
        icon.textContent = '✓';
        status.textContent = '正常';
    }
}

// ========== 更新 SVG 场景 ==========
function updateSVGScene(data) {
    // 土地颜色（根据土壤湿度）
    if (data.soilHumidity < 30) {
        els.soil.setAttribute('fill', 'url(#soilDry)');
    } else {
        els.soil.setAttribute('fill', 'url(#soilNormal)');
    }

    // 水箱水位
    const waterHeight = Math.max(5, (data.waterLevel / 100) * 75);
    const waterY = 95 - waterHeight;
    els.waterFill.setAttribute('height', waterHeight);
    els.waterFill.setAttribute('y', waterY);

    // 水箱颜色（低水位变红）
    if (data.waterLevel < 20) {
        els.waterFill.setAttribute('fill', '#e74c3c');
    } else {
        els.waterFill.setAttribute('fill', '#4a90d9');
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
    isNightMode = isNight;
    document.body.classList.toggle('night-mode', isNight);
    document.body.classList.toggle('day-mode', !isNight);

    // 更新模式指示器
    els.modeIndicator.textContent = isNight ? '夜间模式' : '日间模式';
    els.modeToggle.querySelector('.mode-icon').textContent = isNight ? '☀️' : '🌙';

    // SVG 背景
    if (isNight) {
        els.sceneBg.setAttribute('fill', '#1a2332');
        els.greenhouseBack.setAttribute('fill', 'url(#glassGradientNight)');
    } else {
        els.sceneBg.setAttribute('fill', '#f0f5f0');
        els.greenhouseBack.setAttribute('fill', 'url(#glassGradient)');
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
    if (shouldBeNight !== isNightMode) {
        applyNightMode(shouldBeNight);
    }
}

// ========== 手动切换夜间模式 ==========
function toggleNightMode() {
    if (manualNightMode === null) {
        manualNightMode = !isNightMode;
    } else {
        manualNightMode = !manualNightMode;
    }
    applyNightMode(manualNightMode);
}

// ========== 随机数据模拟（用于本地演示）==========
function simulateDataChanges() {
    const data = { ...currentData };

    // 小幅随机波动
    data.temperature += (Math.random() - 0.5) * 0.5;
    data.airHumidity += (Math.random() - 0.5) * 1;
    data.co2 += (Math.random() - 0.5) * 5;
    data.lightIntensity += (Math.random() - 0.5) * 10;

    // 限制范围
    data.temperature = Math.max(15, Math.min(45, data.temperature));
    data.airHumidity = Math.max(30, Math.min(100, data.airHumidity));
    data.co2 = Math.max(300, Math.min(2000, data.co2));
    data.lightIntensity = Math.max(0, Math.min(1200, data.lightIntensity));

    // 水泵运行时土壤湿度上升，水位下降
    if (data.pumpStatus) {
        data.soilHumidity += 0.3;
        data.waterLevel -= 0.1;
    } else {
        data.soilHumidity -= 0.05;
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

// ========== 快速测试函数（修改 mockData 并刷新）==========
function setMockData(overrides) {
    const newData = { ...currentData, ...overrides };
    updateUI(newData);
}

// ========== ThingsBoard 集成接口 ==========
/**
 * 从 ThingsBoard 接收遥测数据时调用此函数
 * @param {Object} telemetry - ThingsBoard 遥测数据对象
 */
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
            // ThingsBoard 布尔值可能是字符串
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

    // 启动模拟数据变化（本地演示用，ThingsBoard 集成时请删除）
    setInterval(simulateDataChanges, 3000);

    console.log('Greenhouse Widget initialized');
    console.log('Available test functions:');
    console.log('  setMockData({fanStatus: true}) - 开启风扇');
    console.log('  setMockData({sprayStatus: true}) - 开启喷淋');
    console.log('  setMockData({lampStatus: true}) - 开启补光灯');
    console.log('  setMockData({soilHumidity: 20}) - 土壤干旱');
    console.log('  setMockData({waterLevel: 10}) - 水位过低');
    console.log('  setMockData({lightIntensity: 100}) - 夜间模式');
    console.log('  toggleNightMode() - 手动切换夜间模式');
}

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
