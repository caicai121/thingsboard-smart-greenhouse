"""Modify full_scene_3d_merged.js to support three-tenant farm layout."""
import re

BASE = 'D:/Projects/thingsboard-smart-greenhouse/widget/three_model_demo/thingsboard'
with open(f'{BASE}/full_scene_3d_merged.js', 'r', encoding='utf-8') as f:
    js = f.read()

# === Change 1: Add tenant tracking variables after dynamicObjects ===
old1 = """const dynamicObjects = {
  fans: [], lamps: [], sprinklers: [], sprayParticles: null,
  tankWater: null, tankFrame: null, pipeFlows: [],
  soilBeds: [], plants: [], alarmMarkers: []
};"""
new1 = """const dynamicObjects = {
  fans: [], lamps: [], sprinklers: [], sprayParticles: null,
  tankWater: null, tankFrame: null, pipeFlows: [],
  soilBeds: [], plants: [], alarmMarkers: []
};

// === 三租户农场 ===
var activeTenantIndex = 0;
var allTenantObjects = [];
var allTenantGroups = [];"""

if old1 in js:
    js = js.replace(old1, new1)
    print('[OK] Change 1: tenant tracking variables added')
else:
    print('[WARN] Change 1: pattern not found')
    # Try regex
    m = re.search(r'const dynamicObjects = \{.*?\};', js, re.DOTALL)
    if m:
        print(f'  Found at pos {m.start()}, len {len(m.group())}')
        js = js[:m.start()] + new1 + js[m.end():]
        print('[OK] Change 1: applied via regex')

# === Change 2: Replace camera + steps loop with 3-tenant loop ===
# Match from "camera = new THREE.PerspectiveCamera" through "setupUIHandlers();"
old2_pattern = re.compile(
    r'(camera = new THREE\.PerspectiveCamera\(45, w / h, 0\.1, 100\);).*?(setupUIHandlers\(\);)',
    re.DOTALL
)
m2 = old2_pattern.search(js)
if m2:
    replacement = """camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 160);
    camera.position.set(0, 18, 28);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xff0000, 1);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerEl.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.5, 0);
    controls.minDistance = 6;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.update();

    // Lighting & Ground 只创建一次（全局共享）
    createLighting();
    createGround();

    // === 三租户大棚循环 ===
    var tenantPositions = [
      { x: -14, z: 0 },
      { x: 0, z: 0 },
      { x: 14, z: 0 }
    ];
    var originalSceneAdd = scene.add.bind(scene);

    var tenantSteps = [
      ['Greenhouse', createGreenhouseStructure],
      ['PlantBeds', createPlantBeds],
      ['Plants', createPlants],
      ['Fans', createFans],
      ['Lights', createLights],
      ['Sprinklers', createSprinklers],
      ['WaterTank', createWaterTank],
      ['Pipes', createPipes],
      ['AlarmMarkers', createAlarmMarkers]
    ];

    for (var t = 0; t < 3; t++) {
      var tenantGroup = new THREE.Group();
      tenantGroup.position.set(tenantPositions[t].x, 0, tenantPositions[t].z);

      var tenantObjs = {
        fans: [], lamps: [], sprinklers: [], sprayParticles: null,
        tankWater: null, tankFrame: null, pipeFlows: [],
        soilBeds: [], plants: [], alarmMarkers: []
      };

      // 重定向 create 函数输出到 tenantGroup
      dynamicObjects = tenantObjs;
      scene.add = function(obj) { tenantGroup.add(obj); };

      for (var s = 0; s < tenantSteps.length; s++) {
        try {
          console.log('[3D V2] Creating ' + tenantSteps[s][0] + ' tenant ' + t + '...');
          tenantSteps[s][1]();
        } catch (e) {
          console.error('[3D V2] Failed at ' + tenantSteps[s][0] + ':', e);
        }
      }

      // 恢复 scene.add，把 group 加入真实场景
      scene.add = originalSceneAdd;
      scene.add(tenantGroup);

      allTenantObjects.push(tenantObjs);
      allTenantGroups.push(tenantGroup);
    }

    // 恢复 dynamicObjects 指向 tenant 0（大棚1 保持真实联动）
    dynamicObjects = allTenantObjects[0];

    // === 农场场景元素 ===
    createRoad();
    createFarmlands();
    createBoundaries();
    createLabels();

    setupUIHandlers();"""
    js = js[:m2.start()] + replacement + js[m2.end():]
    print(f'[OK] Change 2: 3-tenant loop (old={m2.end()-m2.start()}chars -> new={len(replacement)}chars)')
else:
    print('[WARN] Change 2: camera/steps pattern not found')

# === Change 3: Add helper functions before waitUntilVisibleThenInit ===
helpers_code = """
// ========== 农场场景辅助函数 ==========

function createRoad() {
  var road = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 1.5),
    new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.9 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, -6);
  road.receiveShadow = true;
  scene.add(road);

  // 道路中线（虚线）
  var dashCount = 24;
  for (var i = 0; i < dashCount; i++) {
    var dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.08),
      new THREE.MeshBasicMaterial({ color: '#888888' })
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-24 + i * 2 + 0.5, 0.02, -6);
    scene.add(dash);
  }
}

function createFarmlands() {
  var matFarmland = new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.9 });
  var matRow = new THREE.MeshStandardMaterial({ color: '#4a2a10', roughness: 0.95 });

  var tenantXs = [-14, 0, 14];
  for (var t = 0; t < 3; t++) {
    var cx = tenantXs[t];
    var cz = 8; // 大棚后方 z

    // 农田基线
    var field = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), matFarmland);
    field.rotation.x = -Math.PI / 2;
    field.position.set(cx, 0.01, cz);
    field.receiveShadow = true;
    scene.add(field);

    // 3条田垄
    for (var r = 0; r < 3; r++) {
      var rz = cz - 1.5 + r * 1.5;
      var row = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.6), matRow);
      row.position.set(cx, 0.08, rz);
      row.receiveShadow = true; row.castShadow = true;
      scene.add(row);

      // 简化植物（小绿球）
      for (var p = 0; p < 5; p++) {
        var px = cx - 3.5 + p * 1.8 + (Math.random() - 0.5) * 0.3;
        var pz = rz + (Math.random() - 0.5) * 0.2;
        var plant = new THREE.Mesh(
          new THREE.SphereGeometry(0.12 + Math.random() * 0.08, 6, 4),
          new THREE.MeshStandardMaterial({ color: '#3d8a30', roughness: 0.6 })
        );
        plant.position.set(px, 0.18, pz);
        plant.castShadow = true;
        scene.add(plant);
      }
    }
  }
}

function createBoundaries() {
  var colors = ['#5599cc', '#55aa55', '#cc9955'];
  var ranges = [
    { xMin: -20, xMax: -8, zMin: -8, zMax: 14 },
    { xMin: -6, xMax: 6, zMin: -8, zMax: 14 },
    { xMin: 8, xMax: 20, zMin: -8, zMax: 14 }
  ];

  for (var i = 0; i < 3; i++) {
    var r = ranges[i];
    var w = r.xMax - r.xMin;
    var d = r.zMax - r.zMin;
    var cx = (r.xMin + r.xMax) / 2;
    var cz = (r.zMin + r.zMax) / 2;

    var edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.02, d));
    var edge = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: colors[i], transparent: true, opacity: 0.35, depthTest: true })
    );
    edge.position.set(cx, 0.02, cz);
    scene.add(edge);
  }
}

function createLabels() {
  var labels = [
    { text: '租户A / 大棚1', x: -14, z: -6.8 },
    { text: '租户B / 大棚2', x: 0, z: -6.8 },
    { text: '租户C / 大棚3', x: 14, z: -6.8 }
  ];

  for (var i = 0; i < 3; i++) {
    var lbl = labels[i];
    // 简单标识牌：小方块 + sprite 文字
    var signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.35, 0.08),
      new THREE.MeshStandardMaterial({ color: '#eeeeee', roughness: 0.3 })
    );
    signBoard.position.set(lbl.x, 0.3, lbl.z);
    signBoard.castShadow = true;
    scene.add(signBoard);

    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.4, metalness: 0.5 })
    );
    pole.position.set(lbl.x, 0.05, lbl.z);
    pole.castShadow = true;
    scene.add(pole);

    // Canvas texture label
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 22px Microsoft YaHei, SimHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lbl.text, 128, 38);
    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(lbl.x, 0.55, lbl.z + 0.06);
    sprite.scale.set(3.6, 0.9, 1);
    scene.add(sprite);
  }
}

"""

# Insert before waitUntilVisibleThenInit
marker = '// ========== IntersectionObserver: 等 widget 可见后再 init =========='
if marker in js:
    js = js.replace(marker, helpers_code + '\n' + marker)
    print('[OK] Change 3: helper functions added')
else:
    # Try to find with partial match
    m = re.search(r'// =+ IntersectionObserver', js)
    if m:
        js = js[:m.start()] + helpers_code + '\n' + js[m.start():]
        print(f'[OK] Change 3: helpers added before IntersectionObserver (pos {m.start()})')
    else:
        print('[WARN] Change 3: IntersectionObserver marker not found')

# Write output
with open(f'{BASE}/full_scene_3d_merged.js', 'w', encoding='utf-8') as f:
    f.write(js)
print(f'\nFinal file: {len(js)} chars')
print('Done. Three-tenant farm expansion applied.')
