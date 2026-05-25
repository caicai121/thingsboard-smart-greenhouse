# 智慧农业大棚监测与联动控制系统

基于 ThingsBoard 的智慧农业大棚监测与联动控制系统。

---

## 项目简介

本项目使用 Python 模拟智慧农业大棚中的传感器和执行器设备，通过 MQTT 协议接入 ThingsBoard 物联网平台，实现：

- 多传感器数据采集与上传（温度、湿度、光照、CO2、水位）
- 执行器远程控制（风扇、水泵、补光灯、喷淋）
- 自动联动控制（根据传感器数据自动调节设备）
- 异常报警监测
- ThingsBoard 仪表盘可视化

---

## 运行环境

- **操作系统**: Windows 11 / Ubuntu
- **Python**: 3.11+
- **ThingsBoard**: CE 4.3.0.1 (部署于 Ubuntu 虚拟机)
- **MQTT Broker**: ThingsBoard 内置 MQTT (端口 1883)

---

## 安装依赖

```bash
pip install -r requirements.txt
```

依赖包：
- `paho-mqtt>=2.0.0` - MQTT 客户端
- `python-dotenv>=1.0.0` - 环境变量读取

---

## ThingsBoard 设备创建步骤

1. 登录 ThingsBoard Web 界面：`http://192.168.161.130:8080`
2. 点击左侧菜单 **设备 (Devices)**
3. 点击右上角 **+** 添加新设备
4. 填写设备信息：
   - **名称**: `Greenhouse_Device_01`
   - **类型**: `smart_greenhouse`
5. 点击 **添加** 创建设备
6. 在设备列表中点击该设备，进入详情页
7. 点击 **管理凭据 (Manage credentials)**
8. 复制 **Access Token**（一串字母数字）

---

## Access Token 配置方法

1. 复制项目根目录下的 `.env.example` 为 `.env`：
   ```bash
   copy .env.example .env
   ```
2. 编辑 `.env` 文件，填入从 ThingsBoard 获取的真实 Access Token：
   ```
   THINGSBOARD_HOST=192.168.161.130
   ACCESS_TOKEN=这里填你的真实Token
   MQTT_PORT=1883
   UPLOAD_INTERVAL=3
   ```
3. **不要**将 `.env` 提交到 GitHub（已在 `.gitignore` 中排除）

---

## 运行命令

```bash
# 进入项目目录
cd thingsboard-smart-greenhouse

# 运行设备模拟器
python device_simulator/greenhouse_device_simulator.py
```

程序启动后，终端会输出连接日志和遥测数据。

---

## MQTT 数据字段说明

### 传感器遥测数据（每 3 秒上传）

| 字段名 | 含义 | 示例范围 |
|--------|------|---------|
| `temperature` | 空气温度 | 20 - 38 |
| `airHumidity` | 空气湿度 | 40 - 90 |
| `soilHumidity` | 土壤湿度 | 10 - 80 |
| `lightIntensity` | 光照强度 | 0 - 1000 |
| `co2` | 二氧化碳浓度 | 400 - 1500 |
| `waterLevel` | 水箱液位 | 0 - 100 |

### 执行器状态

| 字段名 | 含义 | 类型 |
|--------|------|------|
| `fanStatus` | 风扇状态 | boolean |
| `pumpStatus` | 水泵状态 | boolean |
| `lampStatus` | 补光灯状态 | boolean |
| `sprayStatus` | 喷淋状态 | boolean |
| `autoMode` | 自动模式 | boolean |

### 报警字段

| 字段名 | 含义 | 触发条件 |
|--------|------|---------|
| `soilAlarm` | 土壤湿度过低 | `soilHumidity < 30` |
| `tempAlarm` | 温度过高 | `temperature > 35` |
| `waterAlarm` | 水位过低 | `waterLevel < 20` |
| `co2Alarm` | CO2 过高 | `co2 > 1000` |

---

## RPC 方法说明

Python 程序订阅 `v1/devices/me/rpc/request/+` 处理以下 RPC 指令：

| RPC 方法 | 功能 | 参数 |
|----------|------|------|
| `setFan` | 控制风扇 | `true` / `false` |
| `setPump` | 控制水泵 | `true` / `false` |
| `setLamp` | 控制补光灯 | `true` / `false` |
| `setSpray` | 控制喷淋 | `true` / `false` |
| `setAutoMode` | 控制自动模式 | `true` / `false` |

收到 RPC 后，程序会：
1. 修改本地状态变量
2. 立即上传最新状态到 ThingsBoard
3. 回复 RPC 响应

---

## 自动联动规则说明

当 `autoMode = true` 时，程序自动根据传感器数据调节设备：

| 条件 | 自动动作 |
|------|---------|
| `soilHumidity < 30` | 开启水泵和喷淋 |
| `soilHumidity > 45` | 关闭水泵和喷淋 |
| `temperature > 32` | 开启风扇 |
| `temperature < 28` | 关闭风扇 |
| `lightIntensity < 200` | 开启补光灯 |
| `lightIntensity > 500` | 关闭补光灯 |
| `waterLevel < 20` | 强制关闭水泵和喷淋，触发水位报警 |

> **优先级说明**：水位过低保护优先级最高。即使土壤湿度低需要灌溉，水位低于 20 时也会强制关闭水泵和喷淋。

---

## 测试验收步骤

### 第 1 步：测试 MQTT 连接
运行程序，确认终端输出 `[MQTT] Connected to ThingsBoard`，ThingsBoard 设备页显示在线。

### 第 2 步：测试遥测数据上传
在 ThingsBoard 设备 Latest telemetry 中查看是否出现 `temperature`、`airHumidity` 等 6 个传感器字段。

### 第 3 步：测试状态字段上传
查看是否出现 `fanStatus`、`pumpStatus`、`lampStatus`、`sprayStatus`、`autoMode`。

### 第 4 步：测试 RPC 控制
在仪表盘点击风扇开关，确认 Python 终端出现 `[RPC] Received method=setFan`，并确认 `fanStatus = true`。

### 第 5 步：测试自动模式
打开 `autoMode = true`，验证：
- `soilHumidity < 30` 时自动开启水泵和喷淋
- `temperature > 32` 时自动开启风扇
- `lightIntensity < 200` 时自动开启补光灯

### 第 6 步：测试水位保护
当 `waterLevel < 20` 时，验证水泵和喷淋被强制关闭，`waterAlarm = true`。

### 第 7 步：测试报警字段
查看 `soilAlarm`、`tempAlarm`、`waterAlarm`、`co2Alarm` 随传感器数据正确变化。

---

## 截图清单（用于实验报告）

配置完仪表盘后，按以下顺序截图保存到 `screenshots/` 目录：

| 序号 | 文件名 | 截图内容 | 操作步骤 |
|------|--------|---------|---------|
| 1 | `01_device_online.png` | 设备在线状态 | 设备列表页 → Greenhouse_Device_01 |
| 2 | `02_latest_telemetry.png` | 最新遥测数据 | 设备详情 → Latest telemetry 标签 |
| 3 | `03_rpc_control_on.png` | RPC 控制-开启 | 仪表盘 → 点击风扇开关 ON |
| 4 | `04_rpc_control_off.png` | RPC 控制-关闭 | 仪表盘 → 点击风扇开关 OFF |
| 5 | `05_auto_control_before.png` | 自动联动-触发前 | 自动模式 OFF，记录 soilHumidity |
| 6 | `06_auto_control_after.png` | 自动联动-触发后 | 打开自动模式，等待 3 秒 |
| 7 | `07_water_protection.png` | 水位保护 | 低水位时（waterLevel < 20） |
| 8 | `08_alarm_status.png` | 报警字段状态 | 查看报警区各卡片 |
| 9 | `09_dashboard_overview.png` | 仪表盘总览 | 整个仪表盘页面 |
| 10 | `10_history_chart.png` | 历史曲线 | 等待 1-2 分钟后查看图表 |

---

## 项目结构

```
thingsboard-smart-greenhouse/
├── README.md                           # 项目说明
├── requirements.txt                    # Python 依赖
├── .env.example                        # 环境变量模板
├── .gitignore                          # Git 忽略规则
├── device_simulator/
│   └── greenhouse_device_simulator.py  # 设备模拟器主程序
├── thingsboard/
│   ├── dashboard_config_v1.md          # 仪表盘配置说明（基础版）
│   └── dashboard_config_v2.md          # 仪表盘配置说明（完整调试面板）
├── widget/
│   └── (SVG 动态大棚组件)
├── docs/
│   ├── project_plan.md                 # 项目计划
│   └── test_record.md                  # 联调测试记录
└── screenshots/
    └── (测试截图)
```

---

## 阶段规划

| 阶段 | 内容 | 状态 |
|------|------|------|
| 第一阶段 | 底层设备模拟 + MQTT 上传 + RPC 控制 + 自动联动 + 报警 | ✅ 已完成 |
| 第二阶段 | 普通 ThingsBoard 仪表盘 | 待开始 |
| 第三阶段 | 报警与 Rule Chain | 待开始 |
| 第四阶段 | SVG 动态大棚 Widget | 待开始 |
| 第五阶段 | 实验报告和演示材料 | 待开始 |
