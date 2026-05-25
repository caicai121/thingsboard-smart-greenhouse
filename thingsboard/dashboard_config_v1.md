# ThingsBoard 仪表盘配置说明（第一版）

## 一、创建仪表盘

1. 登录 ThingsBoard: `http://192.168.161.130:8080`
2. 左侧菜单 **仪表盘 (Dashboards)**
3. 点击右上角 **+** 添加新仪表盘
4. 名称填写: `智慧农业大棚监测与联动控制系统`
5. 点击 **添加**
6. 在仪表盘列表中点击该仪表盘进入编辑模式
7. 点击右下角铅笔图标 **进入编辑模式**

## 二、配置 Entity Alias（关键步骤）

仪表盘必须先配置 Entity Alias，否则所有 widget 都无法绑定设备。

1. 点击仪表盘右上角齿轮图标 **设置 (Settings)**
2. 选择 **Entity Aliases** 标签页
3. 点击 **+ Add alias**
4. 填写：
   - **Alias name**: `Greenhouse_Device`
   - **Filter type**: `Single entity`
   - **Type**: `Device`
   - 搜索并选择: `Greenhouse_Device_01`
5. 点击 **Add**
6. 点击 **保存 (Save)** 关闭设置面板

## 三、添加 Widget — 实时数据区

### 3.1 添加 Cards 显示传感器数值

1. 点击 **+ Add new widget**
2. 选择 **Cards** → **Latest values** → 选择一个数字卡片模板（如 "Simple card"）
3. 在 **Datasource** 中：
   - **Entity alias**: 选择 `Greenhouse_Device`
   - **Timeseries data keys**: 依次添加 `temperature`, `airHumidity`, `soilHumidity`, `lightIntensity`, `co2`, `waterLevel`
4. 点击右下角 **齿轮图标** 进入高级设置（每个 widget 的设置）：
   - **Title**: 留空或自定义
   - **Units**: 
     - temperature: `°C`
     - airHumidity: `%`
     - soilHumidity: `%`
     - lightIntensity: `lux`
     - co2: `ppm`
     - waterLevel: `%`
5. 点击 **Add** 添加到仪表盘
6. 拖拽调整位置和大小

### 3.2 建议布局

将 6 个 Cards 放在仪表盘上半部分，排成一行或两行。

## 四、添加 Widget — 设备控制区（RPC 开关）

这是最关键的部分，每个开关对应一个 RPC 方法。

### 4.1 添加风扇开关

1. 点击 **+ Add new widget**
2. 选择 **Control widgets** → **Switch control**
3. 在 **Target device** 中：
   - **Entity alias**: 选择 `Greenhouse_Device`
4. 在 **Advanced** 标签页中设置 RPC：
   - **RPC settings**:
     - **RPC method**: `setFan`
     - **RPC request params**: `true` / `false`（Switch 会自动传递布尔值）
   - **Initial value**: 不勾选（使用设备状态）
5. 在 **Settings** 标签页：
   - **Title**: `风扇`
6. 点击 **Add**

### 4.2 添加水泵开关

同上步骤，RPC method 改为 `setPump`，Title 改为 `水泵`。

### 4.3 添加补光灯开关

RPC method: `setLamp`，Title: `补光灯`。

### 4.4 添加喷淋开关

RPC method: `setSpray`，Title: `喷淋`。

### 4.5 添加自动模式开关

RPC method: `setAutoMode`，Title: `自动模式`。

### 4.6 控制区布局

将 5 个 Switch Control 放在一排或两排，位于仪表盘中间偏左位置。

> **重要提示**：
> - 如果 Switch Control 拨动后状态不同步，检查 `publish_telemetry` 是否在 RPC 处理后立即回传了状态字段。
> - 确保每个 Switch 的 **Target device** 都选择了正确的 Entity Alias。

## 五、添加 Widget — 设备状态区

### 5.1 添加状态指示灯

1. 点击 **+ Add new widget**
2. 选择 **Cards** → **Latest values** → 选择一个布尔值显示模板
3. Datasource: `Greenhouse_Device`
4. Timeseries keys: `fanStatus`, `pumpStatus`, `lampStatus`, `sprayStatus`, `autoMode`
5. 或者使用 **Status indicators** widget 更直观地显示开关状态

## 六、添加 Widget — 历史曲线区

### 6.1 添加时间序列图表

1. 点击 **+ Add new widget**
2. 选择 **Charts** → **Time series** → **Line chart**
3. Datasource: `Greenhouse_Device`
4. Timeseries keys: `temperature`, `soilHumidity`, `lightIntensity`, `waterLevel`
5. 在 **Settings** 标签页：
   - **Title**: `传感器历史曲线`
   - **Timewindow**: 建议设置为 **Real-time: Last 5 minutes**（默认 1 分钟可能看不到数据）
6. 点击 **Add**

> **注意**：如果图表空白，检查：
> 1. 时间窗口是否太短（改为 5 分钟）
> 2. 程序是否正常运行并上传数据
> 3. Entity Alias 是否正确配置

## 七、添加 Widget — 报警状态区

### 7.1 添加报警指示

1. 点击 **+ Add new widget**
2. 选择 **Cards** → **Latest values** → 选择布尔值卡片
3. Datasource: `Greenhouse_Device`
4. Timeseries keys: `soilAlarm`, `tempAlarm`, `waterAlarm`, `co2Alarm`
5. 可以设置颜色：
   - `true` 时显示红色
   - `false` 时显示绿色

或者使用 **Alarms table** widget（需要 ThingsBoard 原生 Alarm）：
1. 选择 **Alarm widgets** → **Alarms table**
2. 配置 Alarm source 为 `Greenhouse_Device`
3. 注意：如果使用原生 Alarm，需要配置 Rule Chain，当前阶段可以先用布尔值字段代替

## 八、仪表盘布局建议

```
┌─────────────────────────────────────────────────────┐
│  实时数据区 (6个Cards)                                 │
│  [温度] [湿度] [土壤] [光照] [CO2] [水位]              │
├─────────────────────────────────────────────────────┤
│  控制区 (5个Switch)        │  状态区 (5个指示器)        │
│  [风扇] [水泵] [补光] [喷淋] [自动] │  ●风扇 ●水泵 ●补光 ●喷淋 ●自动 │
├─────────────────────────────────────────────────────┤
│  历史曲线区 (Line Chart)                              │
│  temperature / soilHumidity / lightIntensity / waterLevel │
├─────────────────────────────────────────────────────┤
│  报警状态区 (4个布尔值)                                │
│  [土壤报警] [温度报警] [水位报警] [CO2报警]             │
└─────────────────────────────────────────────────────┘
```

## 九、保存仪表盘

1. 点击右上角 **保存 (Save)** 保存仪表盘
2. 点击 **退出编辑模式 (Exit edit mode)** 查看效果

## 十、常见问题排查

### Q1: 开关拨动后设备没反应
- 检查 Python 终端是否有 `[RPC] Received method=xxx` 日志
- 检查 Entity Alias 是否正确指向设备
- 检查 RPC method 名称是否与代码中一致（区分大小写）

### Q2: 开关状态不同步
- 确认 RPC 处理后代码立即回传了状态字段
- 检查时间窗口设置

### Q3: 图表不显示数据
- 将时间窗口改为 **Last 5 minutes**
- 确认程序正在运行并上传数据
- 检查 Entity Alias 配置

### Q4: "Failed to parse the payload"
- Entity Alias 为空或未配置
- 重新配置 Entity Alias 并绑定到 widget
