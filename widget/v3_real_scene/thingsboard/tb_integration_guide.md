# ThingsBoard 集成指南

## 一、准备工作

### 1.1 确认设备在线

1. 确保 Python 模拟器正在运行：
   ```bash
   cd device_simulator
   python greenhouse_device_simulator.py
   ```

2. 登录 ThingsBoard `http://192.168.161.130:8080`
3. 进入 **设备** → **Greenhouse_Device_01**
4. 确认 **Latest telemetry** 中能看到 15 个字段在刷新

### 1.2 放置背景图片

**方案 A：ThingsBoard 服务器静态目录（推荐）**

SSH 登录 ThingsBoard 虚拟机，把图片放到可访问目录：

```bash
# 创建静态目录
sudo mkdir -p /usr/share/thingsboard/data/static/

# 复制图片
sudo cp greenhouse_day.png /usr/share/thingsboard/data/static/
sudo cp greenhouse_night.png /usr/share/thingsboard/data/static/

# 重启 ThingsBoard（如需要）
sudo service thingsboard restart
```

然后修改 `tb_widget_js.js` 中的图片 URL：
```javascript
const CONFIG = {
    dayImage: 'http://192.168.161.130:8080/static/greenhouse_day.png',
    nightImage: 'http://192.168.161.130:8080/static/greenhouse_night.png',
    // ...
};
```

> ⚠️ 如果 `/static/` 路径无法访问，尝试改用 `/api/` 路径或配置 nginx。

**方案 B：Python 简易静态文件服务器**

在 Windows 上运行：
```bash
cd widget/v3_real_scene/assets
python -m http.server 9000
```

然后修改图片 URL：
```javascript
dayImage: 'http://192.168.161.130:9000/greenhouse_day.png',
nightImage: 'http://192.168.161.130:9000/greenhouse_night.png',
```

> 注意：需要关闭 Windows 防火墙或开放 9000 端口。

**方案 C：Base64 内嵌（备选）**

如果以上方案都不可行，可以把图片转成 Base64：
```bash
# Linux/Mac
base64 greenhouse_day.png > day.txt
base64 greenhouse_night.png > night.txt
```

然后在 CSS 中使用：
```css
.tb-day-bg { background-image: url("data:image/png;base64,..."); }
```

---

## 二、部署 Widget（两种方式）

### 方式 A：导入 Widget JSON（推荐）

适用于 ThingsBoard 界面没有 JavaScript 标签页的情况。

#### 2.1 导入 Widget

1. 登录 ThingsBoard `http://192.168.161.130:8080`
2. 进入左侧菜单 **Widgets Library**（部件库）
3. 选择一个已有的 Widget Bundle，或点击 **+** 新建一个 Bundle：
   - **Alias**: `smart_greenhouse`
   - **Title**: `智慧农业大棚`
4. 进入 Bundle 后，点击右上角 **Import widget**（导入部件）
5. 上传文件：`greenhouse_digital_twin_widget.json`
6. 导入成功后，可以看到名为 **"智慧农业大棚数字孪生监控"** 的部件

> 如果 Widgets Library 页面找不到 Import widget 按钮，也可以在 Dashboard 编辑模式下点击 **Add new widget** → 右上角 **Import widget** → 上传 JSON。

#### 2.2 添加到 Dashboard

1. 进入目标 **Dashboard** → 点击右下角 **铅笔图标** 进入编辑模式
2. 点击 **+ Add new widget**
3. 找到 **智慧农业大棚** Bundle → 选择 **智慧农业大棚数字孪生监控**
4. 在弹出的配置窗口中：
   - **Data source type**: `Entity`
   - **Entity alias**: 选择或创建指向 `Greenhouse_Device_01` 的 alias
   - 确认 15 个 Data keys 已自动填充（如果未填充，手动添加）
5. 点击 **Add**

#### 2.3 调整大小

把 Widget 拉大，建议占满整个仪表盘区域：

- **宽度**: 整行（24 列）
- **高度**: 12~16 行

然后点击 **Save dashboard** → **Exit edit mode**。

---

### 方式 B：手动创建 Custom Widget（备选）

适用于 ThingsBoard 有 Custom Widget / HTML Card 且支持 JS 标签页的情况。

#### 2.1 进入 Widget 编辑

1. 登录 ThingsBoard
2. 进入目标 **Dashboard** → 点击右下角 **铅笔图标** 进入编辑模式
3. 点击 **+ Add new widget**
4. 选择 **Create new widget** → **Custom widget**

#### 2.2 粘贴 HTML

在 **HTML** 标签页中，粘贴 `tb_widget_html.html` 的全部内容。

#### 2.3 粘贴 CSS

在 **CSS** 标签页中，粘贴 `tb_widget_css.css` 的全部内容。

#### 2.4 粘贴 JavaScript

在 **JavaScript** 标签页中，粘贴 `tb_widget_js.js` 的全部内容。

> HTML、CSS、JS 三部分相互独立，JS 会自动在 ThingsBoard 渲染好的 DOM 中查找元素。

#### 2.5 配置数据源

在 **Data source** 标签页中：

1. **Data source type**: `Entity`
2. **Entity alias**: 选择或创建指向 `Greenhouse_Device_01` 的 alias
3. **Data keys** 添加以下 15 个字段：

```
temperature
airHumidity
soilHumidity
lightIntensity
co2
waterLevel
fanStatus
pumpStatus
lampStatus
sprayStatus
autoMode
soilAlarm
tempAlarm
waterAlarm
co2Alarm
```

> 注意：每个 key 的 Type 选择 `Timeseries`。

#### 2.6 保存 Widget

1. 点击 **Save** 保存 Widget
2. 调整 Widget 大小，建议占满整个仪表盘区域
3. 点击 **Exit edit mode** 查看效果

---

## 三、验证清单

| 序号 | 验证项 | 预期结果 |
|------|--------|---------|
| 1 | 背景图显示 | 能看到大棚白天/夜晚背景 |
| 2 | 数据刷新 | 右侧 6 个环境数据在变化 |
| 3 | 白天/夜晚切换 | lightIntensity < 200 时自动切换夜晚 |
| 4 | 风扇特效 | fanStatus=true 时风扇旋转 |
| 5 | 喷淋特效 | sprayStatus=true 时出现水雾 |
| 6 | 灯光特效 | lampStatus=true 时灯管发光 |
| 7 | 管道高亮 | pumpStatus=true 时管道变亮 |
| 8 | 土壤告警 | soilHumidity < 30 时显示告警 |
| 9 | 水位告警 | waterLevel < 20 时卡片变红 |
| 10 | 底部状态 | 5 个设备状态 LED 正确显示 |

---

## 四、常见问题

### Q1: 背景图不显示
- 检查图片 URL 是否正确
- 在浏览器直接访问图片 URL 看是否能打开
- 检查是否有跨域(CORS)限制

### Q2: 数据不刷新
- 确认 Python 模拟器正在运行
- 确认设备 `Greenhouse_Device_01` 在线
- 检查 Data keys 是否全部添加

### Q3: 动画不触发
- 检查 `fanStatus`/`sprayStatus`/`lampStatus` 等布尔值是否正确解析
- ThingsBoard 可能返回字符串 `"true"` 而非布尔值 `true`

### Q4: Widget 显示错位
- 调整 Widget 大小为全屏或接近全屏
- 检查浏览器缩放比例是否为 100%

---

## 五、文件说明

| 文件 | 用途 |
|------|------|
| `greenhouse_digital_twin_widget.json` | **ThingsBoard 可导入的 Widget JSON**（推荐方式） |
| `tb_widget_html.html` | Widget HTML 结构（手动创建用） |
| `tb_widget_css.css` | Widget 样式（手动创建用） |
| `tb_widget_js.js` | Widget 逻辑（手动创建用） |
| `tb_integration_guide.md` | 本集成文档 |
| `tb_widget_all_in_one.html` | 合一版本（本地浏览器预览用）|
