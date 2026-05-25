# 智慧农业大棚 ThingsBoard 联调测试记录

**测试日期**: 2026-05-25
**测试人员**: Claude Code + 用户
**ThingsBoard 版本**: CE 4.3.0.1
**服务器**: 192.168.161.130
**设备**: Greenhouse_Device_01 (ID: 2d415ac0-5803-11f1-928b-253a5007835b)

---

## 第 1 步：MQTT 连接测试

**测试内容**: Python 模拟器通过 MQTT 连接 ThingsBoard

**操作**:
```bash
python device_simulator/greenhouse_device_simulator.py
```

**结果**:
```
2026-05-25 14:31:49 [MQTT] Connected to ThingsBoard
2026-05-25 14:31:49 [MQTT] Subscribed to RPC topic
```

**验收结论**: ✅ **MQTT 连接正常，设备已上线。**

---

## 第 2 步：遥测数据上传测试

**测试内容**: 6 个传感器字段是否上传到 ThingsBoard

**验证方式**: REST API 查询 + ThingsBoard 网页 Latest telemetry

**结果**:

| 字段 | 值 | 状态 |
|------|-----|------|
| temperature | 25.2°C | ✅ |
| airHumidity | 51.0% | ✅ |
| soilHumidity | 5.0% ~ 45.0% | ✅ |
| lightIntensity | 400~700 lux | ✅ |
| co2 | 600~830 ppm | ✅ |
| waterLevel | 80.0% | ✅ |

**API 检查结果**: `15/15 fields found` (6 sensors + 5 actuators + 4 alarms)

**验收结论**: ✅ **传感器遥测数据上传正常。**

---

## 第 3 步：状态字段上传测试

**测试内容**: 5 个执行器状态字段是否上传

**结果**:

| 字段 | 初始值 | 状态 |
|------|--------|------|
| fanStatus | false | ✅ |
| pumpStatus | false | ✅ |
| lampStatus | false | ✅ |
| sprayStatus | false | ✅ |
| autoMode | false | ✅ |

**验收结论**: ✅ **执行器状态字段上传正常。**

---

## 第 4 步：RPC 控制测试

**测试内容**: 5 个 SET RPC + 5 个 GET RPC

**测试方式**: REST API 发送 RPC 指令

### SET 方法测试结果

| RPC 方法 | 参数 | HTTP 状态 | 响应 | 状态 |
|----------|------|----------|------|------|
| setFan | true | 200 | `{"success":true,"method":"setFan","value":true}` | ✅ |
| setFan | false | 200 | `{"success":true,"method":"setFan","value":false}` | ✅ |
| setPump | true | 200 | `{"success":true,"method":"setPump","value":true}` | ✅ |
| setPump | false | 200 | `{"success":true,"method":"setPump","value":false}` | ✅ |
| setLamp | true | 200 | `{"success":true,"method":"setLamp","value":true}` | ✅ |
| setLamp | false | 200 | `{"success":true,"method":"setLamp","value":false}` | ✅ |
| setSpray | true | 200 | `{"success":true,"method":"setSpray","value":true}` | ✅ |
| setSpray | false | 200 | `{"success":true,"method":"setSpray","value":false}` | ✅ |
| setAutoMode | true | 200 | `{"success":true,"method":"setAutoMode","value":true}` | ✅ |
| setAutoMode | false | 200 | `{"success":true,"method":"setAutoMode","value":false}` | ✅ |

### GET 方法测试结果

| RPC 方法 | HTTP 状态 | 响应 | 状态 |
|----------|----------|------|------|
| getFan | 200 | `false` | ✅ |
| getPump | 200 | `false` | ✅ |
| getLamp | 200 | `false` | ✅ |
| getSpray | 200 | `false` | ✅ |
| getAutoMode | 200 | `false` | ✅ |

**Python 终端日志**:
```
[RPC] Received method=setFan params=true request_id=X
[STATE] setFan -> True
[RPC] Response sent
[RPC] Received method=getFan params=None request_id=Y
[RPC] getFan -> False
```

**验收结论**: ✅ **RPC 控制链路正常，设备可以接收仪表盘指令并回传状态。**

---

## 第 5 步：自动联动测试

**测试内容**: autoMode=true 时，传感器数据自动触发设备状态变化

### 测试 5.1：土壤湿度低自动灌溉

**条件**: autoMode=true, soilHumidity=29.8 (<30)

**预期**: pumpStatus=true, sprayStatus=true

**实际日志**:
```
15:07:55 [STATE] autoMode set to True
15:07:58 [AUTO] soilHumidity low, pump and spray enabled
```

**后续**: 土壤湿度从 25.6 上升到 27.9（水泵灌溉后回升）

**结果**: ✅ **正常**

### 测试 5.2：温度高自动开启风扇

**条件**: autoMode=true, temperature > 32

**说明**: 当前温度约 25°C，尚未达到触发条件。需在后续高温场景下验证。

**结果**: ⏳ **待验证（需升温场景）**

### 测试 5.3：光照低自动开启补光灯

**条件**: autoMode=true, lightIntensity < 200

**说明**: 当前光照约 400~700 lux，尚未达到触发条件。需在夜间场景下验证。

**结果**: ⏳ **待验证（需夜间场景）**

**验收结论**: ✅ **自动联动逻辑正常（土壤湿度触发已验证）。**

---

## 第 6 步：水位保护测试

**测试内容**: waterLevel < 20 时强制关闭水泵和喷淋

### 测试 6.1：低水位时自动模式

**条件**: autoMode=true, waterLevel=15 (<20)

**预期**: pumpStatus=false, sprayStatus=false（强制关闭）

**实际日志**:
```
15:11:22 [STATE] autoMode set to True
15:11:23 [AUTO] waterLevel low, pump and spray forced OFF
15:11:26 [AUTO] waterLevel low, pump and spray forced OFF
```

**验证**: pumpStatus 保持 false，sprayStatus 保持 false

**结果**: ✅ **正常**

### Bug 修复记录

**发现问题**: 原代码中水位保护只在 `pumpStatus or sprayStatus` 为 true 时才触发，
且土壤湿度控制逻辑在水位保护之后执行，导致低水位时仍会尝试开启水泵。

**修复方案**: 将水位保护改为无条件执行（无论当前状态），
且土壤湿度控制只在 `waterLevel >= 20` 时执行。

**修复提交**: `d03f9fe`

**验收结论**: ✅ **低水位保护逻辑正常。**

---

## 第 7 步：报警字段测试

**测试内容**: 4 个报警字段随传感器数据变化

**验证方式**: REST API 查询遥测数据

| 字段 | 触发条件 | 初始状态 | 低土壤湿度时 | 状态 |
|------|---------|---------|------------|------|
| soilAlarm | soilHumidity < 30 | false | **true** | ✅ |
| tempAlarm | temperature > 35 | false | false | ✅ |
| waterAlarm | waterLevel < 20 | false | true (水位=15时) | ✅ |
| co2Alarm | co2 > 1000 | false | false | ✅ |

**验收结论**: ✅ **报警状态字段上传正常。**

---

## 总体验收结果

| 步骤 | 测试项 | 状态 |
|------|--------|------|
| 1 | MQTT 连接 | ✅ 通过 |
| 2 | 遥测数据上传 | ✅ 通过 |
| 3 | 状态字段上传 | ✅ 通过 |
| 4 | RPC 控制 | ✅ 通过 |
| 5 | 自动联动 | ✅ 通过（土壤湿度触发验证，温度/光照待场景验证） |
| 6 | 水位保护 | ✅ 通过 |
| 7 | 报警字段 | ✅ 通过 |

**阶段一结论**: ✅ **底层设备功能闭环已跑通。**

Python 模拟设备 → MQTT 上传数据 → ThingsBoard 显示实时数据 ✅
ThingsBoard 仪表盘开关 → RPC 下发指令 → Python 接收并改变状态 ✅
Python 自动联动 → 状态上传 → ThingsBoard 同步显示 ✅
传感器异常 → 报警字段变化 → 仪表盘显示异常 ✅

---

## 已知问题与修复

| 问题 | 现象 | 修复 | 提交 |
|------|------|------|------|
| paho-mqtt VERSION1 弃用警告 | 运行时出现 DeprecationWarning | 升级到 VERSION2，更新回调签名 | `a020aa4` |
| 水位保护逻辑缺陷 | 低水位时自动模式仍会开启水泵 | 重构 apply_auto_control()，水位保护无条件优先 | `d03f9fe` |
| Switch Control 状态不同步 | 仪表盘开关显示与实际状态不一致 | 新增 getFan/getPump/getLamp/getSpray/getAutoMode RPC | `8d58999` |

---

## 下一阶段

进入 **第二阶段：普通 ThingsBoard 仪表盘优化**

- 完善仪表盘布局和组件
- 优化历史曲线时间窗口
- 添加更多可视化组件
