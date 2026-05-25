# 智慧农业大棚 SVG 动态 Widget

## 本地预览

直接用浏览器打开 `greenhouse_widget.html`：

```bash
cd widget
# Windows
start greenhouse_widget.html

# 或用 Python 启动本地服务器
cd widget
python -m http.server 8080
# 然后访问 http://localhost:8080/greenhouse_widget.html
```

## 测试方法

打开浏览器开发者工具 (F12) → Console，输入：

```javascript
// 开启风扇
setMockData({fanStatus: true});

// 开启喷淋
setMockData({sprayStatus: true});

// 开启补光灯
setMockData({lampStatus: true});

// 土壤干旱（土地变黄 + 报警）
setMockData({soilHumidity: 20});

// 水位过低（水箱变红 + 报警）
setMockData({waterLevel: 10});

// 夜间模式（光照低）
setMockData({lightIntensity: 100});

// 手动切换夜间/日间模式
toggleNightMode();

// 自动模式运行中
setMockData({autoMode: true});
```

## ThingsBoard 集成方法

### 方案 A：HTML Value Card（推荐，最简单）

1. 在 ThingsBoard 仪表盘中添加 **HTML Value Card** widget
2. 数据源选择 `Greenhouse_Device`，数据键任选（如 `temperature`）
3. 将 `greenhouse_widget.html` 的 `<body>` 内内容复制到 Card 的 HTML 中
4. 将 `greenhouse_widget.css` 内容复制到 Card 的 CSS 中
5. 将 `greenhouse_widget.js` 内容复制到 Card 的 JS 中
6. 修改 JS 中的 `updateFromThingsBoard` 函数，从 ThingsBoard 数据源读取数据

### 方案 B：自定义 HTML Card

1. 添加 **HTML Card** widget
2. 在 **Settings → HTML** 中粘贴完整 HTML（含内联 CSS 和 JS）
3. 在 **Advanced → Action** 中配置数据更新回调

### 关键修改点

从本地 mockData 切换到 ThingsBoard 数据时，需要修改 JS：

```javascript
// 删除这行（本地模拟用）
setInterval(simulateDataChanges, 3000);

// 替换为 ThingsBoard 数据接收
function onDataUpdate(ctx) {
    const telemetry = {};
    for (const key of ['temperature', 'airHumidity', 'soilHumidity',
                        'lightIntensity', 'co2', 'waterLevel',
                        'fanStatus', 'pumpStatus', 'lampStatus',
                        'sprayStatus', 'autoMode',
                        'soilAlarm', 'tempAlarm', 'waterAlarm', 'co2Alarm']) {
        const value = ctx.data[key] && ctx.data[key][0] && ctx.data[key][0][1];
        if (value !== undefined) {
            telemetry[key] = value;
        }
    }
    updateFromThingsBoard(telemetry);
}
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `greenhouse_widget.html` | 主 HTML 文件，包含 SVG 场景和面板布局 |
| `greenhouse_widget.css` | 样式文件，含日间/夜间主题和动画 |
| `greenhouse_widget.js` | 数据驱动逻辑，含 mockData 和 ThingsBoard 接口 |

## SVG 元素 ID 清单

| ID | 元素 | 控制方式 |
|----|------|---------|
| `fanBlade` | 风扇叶片 | CSS animation: spin |
| `sprayDrops` | 喷淋水滴 | CSS animation: drop |
| `lampGlow` | 补光灯光晕 | CSS animation: pulse |
| `lampGlow2` | 补光灯2光晕 | CSS animation: pulse |
| `soil` | 土地 | fill 属性切换渐变 |
| `waterFill` | 水箱水位 | height/y 属性动态调整 |
| `waterTank` | 水箱整体 | 颜色变化 |
| `alertPanel` | 报警提示框 | opacity + animation |
| `autoModeIndicator` | 自动模式指示 | opacity 切换 |
| `sceneBg` | 场景背景 | fill 颜色切换 |
| `greenhouseBack` | 大棚玻璃 | fill 渐变切换 |
| `plantLeft` | 左侧植物 | 静态 |
| `plantRight` | 右侧植物 | 静态 |
