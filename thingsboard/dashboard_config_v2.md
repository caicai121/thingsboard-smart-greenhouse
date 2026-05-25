# ThingsBoard 仪表盘配置说明（第二版 — 完整调试面板）

## 一、创建仪表盘

1. 登录 ThingsBoard: `http://192.168.161.130:8080`
2. 左侧菜单 **仪表盘 (Dashboards)**
3. 点击右上角 **+** 添加新仪表盘
4. 名称填写: `智慧农业大棚监测与联动控制系统`
5. 点击 **添加**
6. 在仪表盘列表中点击该仪表盘进入
7. 点击右下角铅笔图标 **进入编辑模式**

## 二、配置 Entity Alias（必须先做！）

1. 点击仪表盘右上角齿轮图标 **设置 (Settings)**
2. 选择 **Entity Aliases** 标签页
3. 点击 **+ Add alias**
4. 填写：
   - **Alias name**: `Greenhouse_Device`
   - **Filter type**: `Single entity`
   - **Type**: `Device`
   - 搜索并选择: `Greenhouse_Device_01`
5. 点击 **Add** → **Save** 关闭设置面板

> ⚠️ **不配置 Entity Alias，所有 widget 都会显示 "Failed to parse the payload"**

## 三、仪表盘布局（五区域设计）

```
┌─────────────────────────────────────────────────────────────┐
│                    系统标题区域                                │
│              智慧农业大棚监测与联动控制系统                      │
├─────────────────────────────────────────────────────────────┤
│  实时传感器数据区 (6 Cards)    │  设备控制区 (5 Switch)        │
│  [温度] [湿度] [土壤] [光照]   │  [风扇] [水泵] [补光] [喷淋]   │
│  [CO2]  [水位]                 │  [自动模式]                   │
├─────────────────────────────────────────────────────────────┤
│  设备状态指示区 (5 指示灯)      │  报警状态区 (4 报警卡片)       │
│  ●风扇 ●水泵 ●补光 ●喷淋 ●自动 │  [土壤] [温度] [水位] [CO2]    │
├─────────────────────────────────────────────────────────────┤
│              历史曲线区 (Time Series Chart)                  │
│         temperature / soilHumidity / lightIntensity          │
│                        / waterLevel                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、区域一：系统标题

1. 点击 **+ Add new widget**
2. 选择 **Cards** → **Markdown/HTML card**（或任意标题类卡片）
3. 在 **Content** 中输入:
   ```markdown
   # 智慧农业大棚监测与联动控制系统
   ```
4. **Datasource**: 可不绑定（或绑定 `Greenhouse_Device`）
5. **Settings → Title**: 留空
6. 调整大小：横跨整个顶部，高度约 60-80px
7. 点击 **Add**

---

## 五、区域二：实时传感器数据（6 个 Cards）

### 5.1 添加温度卡片

1. **+ Add new widget** → **Cards** → **Latest values** → 选择带数字显示的模板（如 "Simple card" 或 "Simple card animated"）
2. **Datasource**:
   - **Entity alias**: `Greenhouse_Device`
   - **Timeseries data keys**: 添加 `temperature`
3. **Settings**:
   - **Title**: `空气温度`
   - **Units**: `°C`
   - 可选：设置颜色阈值（如 >35°C 变红）
4. **Add**

### 5.2 添加其他 5 个传感器卡片

重复上述步骤，分别添加：

| 字段 | 标题 | 单位 |
|------|------|------|
| `airHumidity` | `空气湿度` | `%` |
| `soilHumidity` | `土壤湿度` | `%` |
| `lightIntensity` | `光照强度` | `lux` |
| `co2` | `CO2浓度` | `ppm` |
| `waterLevel` | `水箱水位` | `%` |

### 5.3 布局

- 将 6 个 Cards 放在仪表盘上半部分左侧
- 建议排成 2 行 × 3 列
- 每个卡片宽度约 200px，高度约 120px

---

## 六、区域三：设备控制开关（5 个 Switch Control）

### 6.1 添加风扇开关

1. **+ Add new widget** → **Control widgets** → **Switch control**
2. **Target device**:
   - **Entity alias**: `Greenhouse_Device`
3. **Advanced → 获取开/关值设置**:
   - **使用方法获取值**: 调用 RPC 获取值方法
   - **RPC 获取值方法**: `getFan`
   - **解析值的函数**:
     ```js
     return data;
     ```
4. **Advanced → 更新值设置**:
   - **RPC 设置值方法**: `setFan`
   - **转换值的函数**:
     ```js
     return value;
     ```
5. **Advanced → RPC 请求超时时间**: `3000`
6. **Settings → Title**: `风扇`
7. **Add**

### 6.2 添加其他 4 个开关

完全相同的步骤，只是 RPC 方法名不同：

| 开关 | 获取值方法 | 设置值方法 | 标题 |
|------|-----------|-----------|------|
| 水泵 | `getPump` | `setPump` | `水泵` |
| 补光灯 | `getLamp` | `setLamp` | `补光灯` |
| 喷淋 | `getSpray` | `setSpray` | `喷淋` |
| 自动模式 | `getAutoMode` | `setAutoMode` | `自动模式` |

### 6.3 布局

- 将 5 个 Switch 放在仪表盘上半部分右侧
- 建议排成 1 列或 2 列
- 每个开关宽度约 200px，高度约 60px

---

## 七、区域四左：设备状态指示器（5 个 LED/布尔值卡片）

### 7.1 推荐做法：使用布尔值卡片 + 颜色

1. **+ Add new widget** → **Cards** → **Latest values** → 选择布尔值显示模板（如 "Boolean card" 或 "Label card"）
2. **Datasource**:
   - **Entity alias**: `Greenhouse_Device`
   - **Timeseries data keys**: `fanStatus`
3. **Settings**:
   - **Title**: `风扇状态`
   - 颜色设置（在 Advanced 或 Style 标签页）：
     - `true` / `on`: 绿色 (#00C853)
     - `false` / `off`: 灰色 (#9E9E9E)
4. **Add**

### 7.2 添加其他 4 个状态指示器

| 字段 | 标题 | true 颜色 | false 颜色 |
|------|------|----------|-----------|
| `pumpStatus` | `水泵状态` | 蓝色 (#2196F3) | 灰色 |
| `lampStatus` | `补光灯状态` | 黄色 (#FFC107) | 灰色 |
| `sprayStatus` | `喷淋状态` | 青色 (#00BCD4) | 灰色 |
| `autoMode` | `自动模式` | 橙色 (#FF9800) | 灰色 |

### 7.3 备选方案：使用 HTML Value Card

如果布尔值卡片不支持颜色切换，可以使用 **HTML Value Card**：

1. **+ Add new widget** → **Cards** → **HTML value card**
2. **Datasource**: `Greenhouse_Device`, key: `fanStatus`
3. **Content**:
   ```html
   <div style="text-align:center; padding:10px;">
     <div style="font-size:24px; font-weight:bold; color: ${fanStatus ? '#00C853' : '#9E9E9E'};">
       ${fanStatus ? '● 开启' : '○ 关闭'}
     </div>
     <div style="font-size:14px; margin-top:5px;">风扇</div>
   </div>
   ```

### 7.4 布局

- 将 5 个状态指示器放在中间偏左位置
- 建议排成 1 行 × 5 列或 2 行排列
- 每个指示器宽度约 150px，高度约 80px

---

## 八、区域四右：报警状态显示（4 个报警卡片）

### 8.1 添加土壤报警卡片

1. **+ Add new widget** → **Cards** → **Latest values** → 选择布尔值卡片模板
2. **Datasource**:
   - **Entity alias**: `Greenhouse_Device`
   - **Timeseries data keys**: `soilAlarm`
3. **Settings**:
   - **Title**: `土壤湿度报警`
   - 颜色设置：
     - `true`: 红色 (#F44336)，文字"异常"
     - `false`: 绿色 (#4CAF50)，文字"正常"
4. **Add**

### 8.2 添加其他 3 个报警卡片

| 字段 | 标题 | true 显示 | false 显示 |
|------|------|----------|-----------|
| `tempAlarm` | `温度报警` | 🔴 温度过高 | 🟢 正常 |
| `waterAlarm` | `水位报警` | 🔴 水位过低 | 🟢 正常 |
| `co2Alarm` | `CO2报警` | 🔴 CO2过高 | 🟢 正常 |

### 8.3 布局

- 将 4 个报警卡片放在中间偏右位置
- 建议排成 2 行 × 2 列
- 每个卡片宽度约 180px，高度约 80px

---

## 九、区域五：历史曲线（Time Series Line Chart）

### 9.1 添加折线图

1. **+ Add new widget** → **Charts** → **Time series** → **Line chart**（或 "Timeseries line chart"）
2. **Datasource**:
   - **Entity alias**: `Greenhouse_Device`
   - **Timeseries data keys**: `temperature`, `soilHumidity`, `lightIntensity`, `waterLevel`
3. **Settings**:
   - **Title**: `传感器历史趋势`
   - **Timewindow**: **Real-time: Last 5 minutes**
     > ⚠️ 默认可能是 1 分钟，数据点可能落在范围外导致空白
4. **Advanced**:
   - **Legend**: 显示（勾选 Show legend）
   - **Y-axis label**: 根据字段自动或留空
5. **Add**

### 9.2 布局

- 将图表放在仪表盘底部
- 横跨整个宽度
- 高度约 250-300px

---

## 十、保存仪表盘

1. 点击右上角 **保存 (Save)**
2. 点击 **退出编辑模式 (Exit edit mode)**
3. 确认所有组件正常显示

---

## 十一、截图清单（用于实验报告）

配置完成后，请按以下顺序截图：

| 序号 | 截图内容 | 操作步骤 | 预期效果 |
|------|---------|---------|---------|
| 1 | **设备在线** | 设备列表页 → Greenhouse_Device_01 | 显示"已连接"或绿色在线状态 |
| 2 | **Latest telemetry** | 设备详情 → Latest telemetry 标签 | 显示 15 个字段的最新值 |
| 3 | **RPC 控制-开** | 仪表盘 → 点击风扇开关 → ON | 开关变 ON，Python 终端出现 `[RPC] Received method=setFan` |
| 4 | **RPC 控制-关** | 仪表盘 → 点击风扇开关 → OFF | 开关变 OFF，Python 终端出现 `[RPC] Received method=setFan` |
| 5 | **自动联动-触发前** | 自动模式 OFF，记录 soilHumidity | 土壤湿度 < 30% 时 pumpStatus=false |
| 6 | **自动联动-触发后** | 打开自动模式，等待 3 秒 | pumpStatus=true, sprayStatus=true |
| 7 | **水位保护** | 需配合低水位测试（水位 < 20） | pumpStatus=false, sprayStatus=false, waterAlarm=true |
| 8 | **报警字段** | 查看报警区各卡片 | soilAlarm=true（红色异常）或 false（绿色正常） |
| 9 | **仪表盘总览** | 整个仪表盘页面 | 五个区域全部正常显示 |
| 10 | **历史曲线** | 等待 1-2 分钟后查看图表 | 显示温度/土壤/光照/水位的变化曲线 |

> 💡 **截图保存位置**: 保存到 `screenshots/` 目录，命名格式：`01_device_online.png`, `02_latest_telemetry.png` 等

---

## 十二、常见问题

### Q1: Switch Control 拨动后无反应
- 检查 Python 终端是否有 `[RPC] Received method=xxx` 日志
- 检查 RPC 方法名是否完全匹配（区分大小写）
- 检查 Entity Alias 是否正确指向 Greenhouse_Device_01

### Q2: 开关状态不同步
- 确认 "获取值方法" 和 "设置值方法" 都配置了
- 获取值方法应为 `getFan` 等，不是 `setFan`
- 解析函数应为 `return data;`

### Q3: 图表空白无数据
- 将时间窗口改为 **Last 5 minutes**
- 确认模拟器程序正在运行
- 检查 Entity Alias 是否配置正确

### Q4: 报警卡片颜色不变化
- 检查布尔值卡片的颜色设置选项
- 如不支持，改用 HTML Value Card 自定义样式

### Q5: "Failed to parse the payload"
- Entity Alias 为空或未配置
- 重新配置 Entity Alias 并绑定到所有 widget
