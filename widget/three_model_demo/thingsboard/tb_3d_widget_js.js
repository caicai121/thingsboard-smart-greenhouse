/**
 * 智慧农业大棚 - 3D 数字孪生模型 Widget V2
 * ThingsBoard CE 4.3.0.1 / Three.js 0.160.0
 */
const THREE_BASE = 'http://192.168.161.1:9000';

let THREE;
let OrbitControls;
let threeReady = false;
let renderer, scene, camera, controls;
let animFrameId = null;
let containerEl = null;
let rootEl = null;
let resizeObserver = null;
let intersectionObserver = null;
let threeInitStarted = false;
let frameCount = 0;

const sceneData = {
  fanStatus: false, lampStatus: false, sprayStatus: false, pumpStatus: false,
  soilAlarm: false, tempAlarm: false, waterAlarm: false, co2Alarm: false,
  waterLevel: 60, soilHumidity: 50, temperature: 25,
  hourOfDay: 12, outsideLight: 500, lightIntensity: 500
};

// ========== 统一大棚坐标系 ==========
const GH = { width: 8, length: 12, height: 4, halfW: 4, halfL: 6 };

var mainPipeRef = null;
var alarmElements = {};
var lampOnColor, zeroColor; // Color对象在THREE加载后初始化

const dynamicObjects = {
  fans: [], lamps: [], sprinklers: [], sprayParticles: null,
  tankWater: null, tankFrame: null, pipeFlows: [],
  soilBeds: [], plants: [], alarmMarkers: []
};

// ========== 材质库 ==========
let matMetal, matMetalDark, matFilm, matSoil, matSoilDry, matPlantGreen;
let matPlantLight, matPlantDark, matGround, matTankBody, matTankFrame, matWater;
let matPipe, matPipeFlow, matFanHousing, matBlade, matLEDOff, matLEDOn;

function initMaterials() {
  matMetal = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.35, metalness: 0.7 });
  matMetalDark = new THREE.MeshStandardMaterial({ color: '#5a6e78', roughness: 0.3, metalness: 0.8 });
  matFilm = new THREE.MeshPhysicalMaterial({ color: '#7fa8c9', roughness: 0.25, metalness: 0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  matSoil = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.9 });
  matSoilDry = new THREE.MeshStandardMaterial({ color: '#6b4530', roughness: 0.92 });
  matPlantGreen = new THREE.MeshStandardMaterial({ color: '#3d8a30', roughness: 0.65 });
  matPlantLight = new THREE.MeshStandardMaterial({ color: '#5aad40', roughness: 0.6 });
  matPlantDark = new THREE.MeshStandardMaterial({ color: '#2d6a20', roughness: 0.7 });
  matGround = new THREE.MeshStandardMaterial({ color: '#1a2a20', roughness: 0.85 });
  matTankBody = new THREE.MeshStandardMaterial({ color: '#4060a0', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.6, depthWrite: false });
  matTankFrame = new THREE.MeshStandardMaterial({ color: '#6070a0', roughness: 0.3, metalness: 0.6 });
  matWater = new THREE.MeshStandardMaterial({ color: '#4499dd', roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.7 });
  matPipe = new THREE.MeshStandardMaterial({ color: '#5070a0', roughness: 0.3, metalness: 0.5 });
  matPipeFlow = new THREE.MeshStandardMaterial({ color: '#00d9ff', roughness: 0.1, emissive: '#003050', emissiveIntensity: 0.6 });
  matFanHousing = new THREE.MeshStandardMaterial({ color: '#556670', roughness: 0.3, metalness: 0.6 });
  matBlade = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.25, metalness: 0.5 });
  matLEDOff = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.4, metalness: 0.4 });
  matLEDOn = new THREE.MeshStandardMaterial({ color: '#ffe8a0', roughness: 0.2, emissive: '#ffe8a0', emissiveIntensity: 1.5 });
  zeroColor = new THREE.Color('#000000');
  lampOnColor = new THREE.Color('#ffe8a0');
}

// ========== Three.js 加载 ==========
function loadThreeModule() {
  var map = document.createElement('script');
  map.type = 'importmap';
  map.textContent = JSON.stringify({
    imports: {
      'three': THREE_BASE + '/three.module.js',
      'three/addons/': THREE_BASE + '/'
    }
  });
  document.head.appendChild(map);

  return import('three').then(function(m) {
    THREE = m;
    return import('three/addons/controls/OrbitControls.js');
  }).then(function(ocModule) {
    OrbitControls = ocModule.OrbitControls;
    if (typeof OrbitControls !== 'function') throw new Error('OrbitControls not function');
  });
}

// ========== 场景初始化 ==========
function initThree() {
  rootEl = self.ctx.$container[0];
  if (!rootEl) { console.error('[3D V2] No root element'); return; }
  containerEl = rootEl.querySelector('.tb-3d-canvas');
  if (!containerEl) { console.error('[3D V2] No canvas container'); return; }
  if (!THREE) { console.error('[3D V2] THREE not loaded'); return; }

  var w = containerEl.clientWidth;
  var h = containerEl.clientHeight;

  if (w === 0 || h === 0) {
    console.log('[3D V2] Container size 0, retry via rAF...');
    requestAnimationFrame(function() { requestAnimationFrame(initThree); });
    return;
  }

  console.log('[3D V2] initThree with container size:', w, 'x', h);

  try {
    initMaterials();

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#020b12');

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(8, 6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // DEBUG: 红色背景验证 canvas 是否显示
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
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.update();

    var steps = [
      ['Lighting', createLighting],
      ['Ground', createGround],
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
    for (var s = 0; s < steps.length; s++) {
      try {
        console.log('[3D V2] Creating ' + steps[s][0] + '...');
        steps[s][1]();
      } catch (e) {
        console.error('[3D V2] Failed at ' + steps[s][0] + ':', e);
      }
    }

    setupUIHandlers();
    attachResizeObserver();

    threeReady = true;
    console.log('[3D V2] Scene ready');

    // 双 rAF 确保首帧在 TB 布局完成后渲染
    function afterNextPaint(cb) {
      requestAnimationFrame(function() { requestAnimationFrame(cb); });
    }

    startRenderLoop();

    afterNextPaint(function() {
      resize3D(true);
      renderer.render(scene, camera);
      console.log('[3D V2] First paint after next paint');
    });

    // 多时间点兜底
    [100, 300, 600, 1000].forEach(function(delay) {
      setTimeout(function() {
        resize3D(true);
        renderer.render(scene, camera);
      }, delay);
    });

    // 2.5秒后恢复正常背景色（DEBUG 结束）
    setTimeout(function() {
      if (scene) scene.background = new THREE.Color('#020b12');
      console.log('[3D V2] Background restored');
    }, 2500);

  } catch (e) {
    console.error('[3D V2] Init failed:', e);
    if (containerEl) containerEl.innerHTML = '<div style="color:#ff3860;padding:40px;">Init error: ' + e.message + '</div>';
  }
}

// ========== IntersectionObserver: 等 widget 可见后再 init ==========
function waitUntilVisibleThenInit() {
  rootEl = self.ctx.$container[0];
  if (!rootEl) { setTimeout(waitUntilVisibleThenInit, 100); return; }

  var target = rootEl.querySelector('.tb-3d-canvas');
  if (!target) { setTimeout(waitUntilVisibleThenInit, 100); return; }

  intersectionObserver = new IntersectionObserver(function(entries) {
    var entry = entries[0];
    if (entry && entry.isIntersecting && entry.intersectionRatio > 0) {
      console.log('[3D V2] Widget visible, intersectionRatio:', entry.intersectionRatio);
      intersectionObserver.disconnect();
      intersectionObserver = null;

      if (!threeInitStarted) {
        threeInitStarted = true;
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            initThree();
          });
        });
      }
    }
  }, { threshold: 0.01 });

  intersectionObserver.observe(target);
}

// ========== UI 事件 ==========
// ========== 测试模式 ==========
var testMode = false;

function setupUIHandlers() {
  // 缓存告警元素
  ['soil','temp','water'].forEach(function(key) {
    alarmElements[key] = rootEl.querySelector('.tb-alarm-tag[data-alarm="' + key + '"]');
  });

  var resetBtn = rootEl.querySelector('.tb-3d-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      if (camera && controls) {
        camera.position.set(8, 6, 10);
        controls.target.set(0, 1.5, 0);
        controls.update();
      }
    });
  }

  // 测试面板按钮
  var panel = rootEl.querySelector('.tb-3d-test-panel');
  if (!panel) return;
  panel.addEventListener('click', function(e) {
    var btn = e.target.closest('.tb-test-btn');
    if (!btn) return;
    var key = btn.dataset.key;
    if (key === 'reset') {
      testMode = false;
      panel.querySelectorAll('.tb-test-btn').forEach(function(b) { b.classList.remove('active'); });
      console.log('[3D V2] Test mode OFF, restoring real data');
      return;
    }
    testMode = true;
    btn.classList.toggle('active');
    if (key === 'waterAlarm') {
      sceneData.waterAlarm = btn.classList.contains('active');
      sceneData.waterLevel = sceneData.waterAlarm ? 10 : 80;
    } else if (key === 'soilAlarm') {
      sceneData.soilAlarm = btn.classList.contains('active');
    } else {
      sceneData[key] = btn.classList.contains('active');
    }
    if (key === 'fanStatus') console.log('[3D Fan] fanStatus =', sceneData.fanStatus);
    console.log('[3D V2] Test:', key, '=', sceneData[key]);
  });
}

function createLighting() {
  scene.add(new THREE.AmbientLight('#2a4060', 2.0));
  var sun = new THREE.DirectionalLight('#fff8e8', 1.8);
  sun.position.set(10, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun);
  var fill = new THREE.DirectionalLight('#4466aa', 0.6);
  fill.position.set(-4, 4, -4);
  scene.add(fill);
}

function createGround() {
  var g = new THREE.Mesh(new THREE.PlaneGeometry(20, 18), matGround);
  g.rotation.x = -Math.PI / 2; g.position.y = -0.01; g.receiveShadow = true;
  scene.add(g);
  var grid = new THREE.PolarGridHelper(10, 32, 24, 64, '#0a2a30', '#0a2a30');
  grid.position.y = 0.005; scene.add(grid);
}

function createGreenhouseStructure() {
  var gh = new THREE.Group();
  var hW = GH.halfW, hL = GH.halfL, H = GH.height;

  // 底框+侧梁已删除，仅保留拱架和脊梁

  // 拱形骨架: 7组，z = -6,-4,-2,0,2,4,6
  var archZs = [-hL, -4, -2, 0, 2, 4, hL];
  archZs.forEach(function(z) {
    var archPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-hW, 0, 0),
      new THREE.Vector3(-hW * 0.7, H * 0.75, 0),
      new THREE.Vector3(0, H, 0),
      new THREE.Vector3( hW * 0.7, H * 0.75, 0),
      new THREE.Vector3( hW, 0, 0)
    ], false, 'catmullrom', 0.5);
    var arch = new THREE.Mesh(new THREE.TubeGeometry(archPath, 32, 0.05, 8, false), matMetalDark);
    arch.position.z = z; arch.castShadow = true; arch.receiveShadow = true;
    gh.add(arch);
  });

  // 顶部脊梁（仅保留此梁连接各拱顶）
  var ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, hL*2, 8), matMetal);
  ridge.rotation.x = Math.PI/2; ridge.position.set(0, H, 0); ridge.castShadow = true;
  gh.add(ridge);

  // 棚膜: 使用与拱架相同的曲线外扩, 沿z轴挤出
  var archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-hW, 0, 0),
    new THREE.Vector3(-hW * 0.7, H * 0.75, 0),
    new THREE.Vector3(0, H, 0),
    new THREE.Vector3( hW * 0.7, H * 0.75, 0),
    new THREE.Vector3( hW, 0, 0)
  ], false, 'catmullrom', 0.5);
  var archPts = archCurve.getPoints(60);
  var filmShape = new THREE.Shape();
  filmShape.moveTo(archPts[0].x * 1.02, 0);
  for (var i = 0; i < archPts.length; i++) {
    filmShape.lineTo(archPts[i].x * 1.02, archPts[i].y + 0.04);
  }
  filmShape.lineTo(archPts[archPts.length-1].x * 1.02, 0);
  var filmGeo = new THREE.ExtrudeGeometry(filmShape, { steps: 1, depth: hL * 2, bevelEnabled: false });
  filmGeo.translate(0, 0, -hL);
  var film = new THREE.Mesh(filmGeo, matFilm);
  film.position.set(0, 0, 0);
  film.renderOrder = 0;
  film.material.depthWrite = false;
  gh.add(film);

  scene.add(gh);
}

function createPlantBeds() {
  var bg = new THREE.Group();
  // 3条种植垄沿z轴, x = -2.4, 0, 2.4 (田-喷-田-喷-田)
  var bedXs = [-2.4, 0, 2.4];
  var bedLen = GH.halfL * 1.6; // 9.6
  var bedW = 0.9, bedH = 0.12;
  bedXs.forEach(function(bx) {
    var bed = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedH, bedLen), matSoil);
    bed.position.set(bx, bedH/2 + 0.02, 0);
    bed.receiveShadow = true; bed.castShadow = true;
    bg.add(bed); dynamicObjects.soilBeds.push(bed);
  });
  scene.add(bg);
}

// ========== 植物建模 ==========
var leafColors = ['#1f6f3a', '#2fa84f', '#55c96b', '#2d8a3e', '#3cb85a'];

function createLeaf(len, wid, color) {
  var hw = wid / 2, hh = len / 2;
  var shape = new THREE.Shape();
  shape.moveTo(0, -hh);
  shape.bezierCurveTo( hw, -hh * 0.5,  hw, hh * 0.5, 0, hh);
  shape.bezierCurveTo(-hw,  hh * 0.5, -hw, -hh * 0.5, 0, -hh);
  var geo = new THREE.ShapeGeometry(shape, 3);
  var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.55, side: THREE.DoubleSide });
  var leaf = new THREE.Mesh(geo, mat);
  leaf.castShadow = true;
  return leaf;
}

function createPlant(px, pz, scale) {
  var plant = new THREE.Group();
  plant.position.set(px, 0.14, pz);

  // 细茎: 圆柱, 高0.22, 半径0.028
  var stemH = 0.22 * scale;
  var stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.03, stemH, 8),
    new THREE.MeshStandardMaterial({ color: '#4a7a38', roughness: 0.7 })
  );
  stem.position.y = stemH / 2;
  stem.castShadow = true;
  plant.add(stem);

  // 下层叶片: 7片, 向外展开接近水平
  var lowerCount = 7;
  for (var li = 0; li < lowerCount; li++) {
    var a = (li / lowerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    var lfLen = (0.14 + Math.random() * 0.06) * scale;
    var lfWid = (0.05 + Math.random() * 0.04) * scale;
    var lf = createLeaf(lfLen, lfWid, leafColors[Math.floor(Math.random() * leafColors.length)]);
    lf.position.set(Math.cos(a) * 0.07 * scale, stemH * 0.5, Math.sin(a) * 0.07 * scale);
    lf.rotation.y = -a + Math.PI / 2;
    lf.rotation.z = Math.PI / 2 - 0.3 + (Math.random() - 0.5) * 0.25; // 接近水平, 叶面朝上
    lf.rotation.order = 'YXZ';
    plant.add(lf);
  }

  // 上层叶片: 5片, 向上倾斜
  var upperCount = 5;
  for (var ui = 0; ui < upperCount; ui++) {
    var a2 = (ui / upperCount) * Math.PI * 2 + Math.random() * 0.4;
    var ulLen = (0.10 + Math.random() * 0.05) * scale;
    var ulWid = (0.04 + Math.random() * 0.03) * scale;
    var uf = createLeaf(ulLen, ulWid, leafColors[Math.floor(Math.random() * leafColors.length)]);
    uf.position.set(Math.cos(a2) * 0.04 * scale, stemH * 0.8, Math.sin(a2) * 0.04 * scale);
    uf.rotation.y = -a2 + Math.PI / 2;
    uf.rotation.z = Math.PI / 4 + (Math.random() - 0.5) * 0.3; // 向上倾斜
    uf.rotation.order = 'YXZ';
    plant.add(uf);
  }

  plant.userData = {
    baseY: plant.position.y,
    breathSpeed: 0.5 + Math.random() * 1.2,
    breathOffset: Math.random() * Math.PI * 2,
    breathAmp: 0.003 + Math.random() * 0.005
  };
  return plant;
}

function createPlants() {
  var pg = new THREE.Group();
  var bedXs = [-2.4, 0, 2.4];
  // 每条垄2列, 每列6棵 (3x放大后间距加大)
  var plantZs = [-4.2, -2.5, -0.8, 0.8, 2.5, 4.2];

  bedXs.forEach(function(bx) {
    [-0.3, 0.3].forEach(function(ox) {
      plantZs.forEach(function(pz) {
        var scale = 3 * (0.8 + Math.random() * 0.4);
        var plant = createPlant(bx + ox, pz + (Math.random() - 0.5) * 0.2, scale);
        pg.add(plant);
        dynamicObjects.plants.push(plant);
      });
    });
  });
  scene.add(pg);
}

function createFans() {
  var fg = new THREE.Group();
  var guardMat = new THREE.MeshBasicMaterial({ color: '#445566', transparent: true, opacity: 0.55, depthWrite: false });

  // 扇叶: 参考 index_v2 的 3 长叶设计
  var bladeMat = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.25, metalness: 0.5 });
  var bladeGeo = new THREE.BoxGeometry(0.07, 0.45, 0.04);
  // 中心帽材质
  var capMat = new THREE.MeshStandardMaterial({ color: '#889ca8', roughness: 0.25, metalness: 0.6 });

  var fanConfigs = [
    { pos: [-3.8, 2.1, -2.5], side: 'left' },
    { pos: [3.8, 2.1, 2.5], side: 'right' }
  ];

  fanConfigs.forEach(function(cfg) {
    var fanGroup = new THREE.Group();
    var frameGroup = new THREE.Group();
    var bladesGroup = new THREE.Group();

    // === frameGroup: 外圈 + 电机毂 + 支架 + 防护网 ===

    // 外圈保护框 (深灰金属 Torus, r=0.3, tube=0.035)
    var outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.035, 16, 24), matMetalDark
    );
    outerRing.castShadow = true;
    frameGroup.add(outerRing);

    // 内圈加固环
    var innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.018, 12, 16), matMetal
    );
    frameGroup.add(innerRing);

    // 中心电机毂
    var hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.09, 12), matMetalDark
    );
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    frameGroup.add(hub);

    // 防护网: 2根交叉细杆 + 细外圈 (半透明, 不遮挡扇叶)
    var barLen = 0.54;
    for (var j = 0; j < 2; j++) {
      var barAngle = j * Math.PI / 2 + Math.PI / 4;
      var bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, barLen, 6), guardMat
      );
      bar.rotation.z = barAngle;
      bar.position.z = 0.04;
      frameGroup.add(bar);
    }
    var guardRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.005, 8, 24), guardMat
    );
    guardRing.position.z = 0.04;
    frameGroup.add(guardRing);

    // 安装支架 (连接到侧壁)
    var bracketArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), matMetalDark
    );
    bracketArm.rotation.x = Math.PI / 2;
    bracketArm.position.z = -0.2;
    bracketArm.castShadow = true;
    frameGroup.add(bracketArm);

    var wallPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.28, 0.04), matMetalDark
    );
    wallPlate.position.z = -0.39;
    wallPlate.castShadow = true;
    frameGroup.add(wallPlate);

    var strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8), matMetalDark
    );
    strut.position.set(0, -0.22, -0.08);
    strut.rotation.x = -Math.PI / 4.5;
    strut.castShadow = true;
    frameGroup.add(strut);

    // === bladesGroup: 3片扇叶 (参考 index_v2) ===
    for (var i = 0; i < 3; i++) {
      var blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 0.15;
      blade.rotation.z = (i / 3) * Math.PI * 2;
      blade.castShadow = true;
      bladesGroup.add(blade);
    }
    // 中心帽
    bladesGroup.add(new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12), capMat
    ).rotateX(Math.PI / 2));

    // === 气流线 ===
    var airflowGroup = new THREE.Group();
    var airGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.55, 6);
    for (var k = 0; k < 4; k++) {
      var ang = (k / 4) * Math.PI * 2 + Math.PI / 8;
      var r = 0.13;
      var airLine = new THREE.Mesh(airGeo, new THREE.MeshBasicMaterial({
        color: '#88ccff', transparent: true, opacity: 0.2, depthWrite: false
      }));
      airLine.position.set(Math.cos(ang) * r, Math.sin(ang) * r, 0.28);
      airLine.rotation.x = Math.PI / 2;
      airLine.userData = { baseOpacity: 0.08 + Math.random() * 0.15, phase: Math.random() * Math.PI * 2 };
      airflowGroup.add(airLine);
    }
    airflowGroup.visible = false;

    // === 组装 ===
    fanGroup.add(frameGroup);
    fanGroup.add(bladesGroup);
    fanGroup.add(airflowGroup);
    fanGroup.userData = { bladesGroup: bladesGroup, airflow: airflowGroup };

    // === 定位 + 朝向 ===
    fanGroup.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    // 默认扇面在XY平面朝+Z; left (-3.8) 朝 +X (棚内), right (3.8) 朝 -X (棚内)
    if (cfg.side === 'left') {
      fanGroup.rotation.y = Math.PI / 2;
    } else {
      fanGroup.rotation.y = -Math.PI / 2;
    }
    console.log('[3D Fan] Created ' + cfg.side + ' fan, bladesGroup in userData:', !!fanGroup.userData.bladesGroup);

    fg.add(fanGroup);
    dynamicObjects.fans.push(fanGroup);
  });

  scene.add(fg);
}

function createLights() {
  var lg = new THREE.Group();
  // 4条灯带挂在顶部横梁下，平行于z轴（种植垄方向）
  [[-2, -3], [2, -3], [-2, 3], [2, 3]].forEach(function(p) {
    var lamp = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 2.5), matLEDOff.clone());
    body.castShadow = true; body.name = 'lampBody'; lamp.add(body);
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 2.3), matLEDOn.clone());
    glow.rotation.x = -Math.PI/2; glow.position.y = -0.03; glow.name = 'glowPanel';
    glow.material.opacity = 0; glow.material.transparent = true; glow.material.emissiveIntensity = 0;
    lamp.add(glow);
    var spot = new THREE.SpotLight('#ffe8a0', 0, 10, Math.PI/5, 0.3, 0.5);
    spot.position.y = -0.5; spot.name = 'lampSpot'; lamp.add(spot);
    lamp.position.set(p[0], GH.height - 0.9, p[1]); // y ≈ 3.1
    lamp.userData = { body: body, glow: glow, spotLight: spot };
    lg.add(lamp); dynamicObjects.lamps.push(lamp);
  });
  scene.add(lg);
}

function createSprinklers() {
  var sg = new THREE.Group();
  // 2条喷淋线 x=-1.2, 1.2 各3个喷头 z=-3.5,0,3.5 (田-喷-田-喷-田)
  [[-1.2, -3.5], [-1.2, 0], [-1.2, 3.5], [1.2, -3.5], [1.2, 0], [1.2, 3.5]].forEach(function(p) {
    var head = new THREE.Group();
    var pipeH = 1.5;
    var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, pipeH, 8), matPipe);
    pipe.position.y = pipeH/2; pipe.castShadow = true; head.add(pipe);
    var nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 8), matMetalDark);
    nozzle.position.y = pipeH; nozzle.castShadow = true; head.add(nozzle);
    head.position.set(p[0], 0, p[1]);
    sg.add(head);
  });
  scene.add(sg);

  // V3 风格喷雾: 2条喷淋线，6个喷头
  var sprayGroup = new THREE.Group(); sprayGroup.visible = false;
  var sprinklerPositions = [[-1.2, 1.5, -3.5], [-1.2, 1.5, 0], [-1.2, 1.5, 3.5],
                             [1.2, 1.5, -3.5], [1.2, 1.5, 0], [1.2, 1.5, 3.5]];
  var pGeo = new THREE.SphereGeometry(0.02, 4, 3);
  var pMat = new THREE.MeshBasicMaterial({ color: '#aaddff', transparent: true, opacity: 0.7 });

  sprinklerPositions.forEach(function(sp) {
    for (var i = 0; i < 15; i++) {
      var pt = new THREE.Mesh(pGeo, pMat);
      // 喷头向左右扩散覆盖相邻两床: angle偏向±X方向
      var dirX = sp[0] < 0 ? 1 : -1; // 左线喷右, 右线喷左
      var angle = (Math.random() - 0.5) * Math.PI * 0.7 + (dirX > 0 ? -Math.PI*0.15 : Math.PI*0.85);
      var radius = 0.05 + Math.random() * 1.3;
      var drop = Math.random() * 1.2;
      pt.position.set(
        sp[0] + Math.cos(angle) * radius,
        sp[1] - drop,
        sp[2] + Math.sin(angle) * radius
      );
      pt.userData = {
        originX: sp[0], originY: sp[1], originZ: sp[2],
        speed: 1.5 + Math.random() * 3, offset: Math.random() * Math.PI * 2,
        radius: radius, angle: angle
      };
      sprayGroup.add(pt);
    }
  });
  scene.add(sprayGroup);
  dynamicObjects.sprayParticles = sprayGroup;
}

function createWaterTank() {
  var tg = new THREE.Group();
  // 水箱在大棚左前外侧
  var tankW = 1.0, tankH = 1.1, tankD = 0.8;
  var frameEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(tankW, tankH, tankD));
  var frame = new THREE.LineSegments(frameEdges, new THREE.LineBasicMaterial({ color: '#6088bb' }));
  frame.position.y = tankH/2; tg.add(frame); dynamicObjects.tankFrame = frame;
  var body = new THREE.Mesh(new THREE.BoxGeometry(tankW-0.05, tankH-0.05, tankD-0.05), matTankBody);
  body.position.y = tankH/2; body.castShadow = true; body.receiveShadow = true;
  body.renderOrder = 1; body.material.depthWrite = false; tg.add(body);
  var water = new THREE.Mesh(new THREE.BoxGeometry(tankW-0.1, 0.01, tankD-0.1), matWater);
  water.position.y = 0.08; water.renderOrder = 0; tg.add(water);
  dynamicObjects.tankWater = water;
  tg.add(new THREE.Mesh(new THREE.BoxGeometry(tankW+0.05, 0.05, tankD+0.05), matMetalDark));
  // 位置: 左前外侧
  tg.position.set(-GH.halfW - 1.0, 0, -GH.halfL + 0.6);
  scene.add(tg);
}

function createPipes() {
  var pg = new THREE.Group();
  var tankX = -GH.halfW - 1.0;
  var tankZ = -GH.halfL + 0.6;
  var sideX = GH.halfW - 0.4;  // 管道靠两侧走

  // 左侧主管: 水箱 → 沿左侧 → 后方
  var leftPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(tankX, 0.25, tankZ),
    new THREE.Vector3(-sideX, 0.25, -GH.halfL + 0.5),
    new THREE.Vector3(-sideX, 0.25, 0),
    new THREE.Vector3(-sideX, 0.25, GH.halfL - 0.5)
  ]);
  var leftPipe = new THREE.Mesh(new THREE.TubeGeometry(leftPath, 32, 0.05, 8, false), matPipe);
  leftPipe.castShadow = true; pg.add(leftPipe);

  // 右侧主管: 前端 → 沿右侧 → 后方
  var rightPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(sideX, 0.25, -GH.halfL + 0.5),
    new THREE.Vector3(sideX, 0.25, 0),
    new THREE.Vector3(sideX, 0.25, GH.halfL - 0.5)
  ]);
  var rightPipe = new THREE.Mesh(new THREE.TubeGeometry(rightPath, 24, 0.05, 8, false), matPipe);
  rightPipe.castShadow = true; mainPipeRef = rightPipe; pg.add(rightPipe);

  // 前端横向连接管
  var frontPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-sideX, 0.25, -GH.halfL + 0.5),
    new THREE.Vector3(0, 0.25, -GH.halfL + 0.5),
    new THREE.Vector3(sideX, 0.25, -GH.halfL + 0.5)
  ]);
  pg.add(new THREE.Mesh(new THREE.TubeGeometry(frontPath, 16, 0.05, 8, false), matPipe));

  // 后端横向连接管
  var backPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-sideX, 0.25, GH.halfL - 0.5),
    new THREE.Vector3(0, 0.25, GH.halfL - 0.5),
    new THREE.Vector3(sideX, 0.25, GH.halfL - 0.5)
  ]);
  pg.add(new THREE.Mesh(new THREE.TubeGeometry(backPath, 16, 0.05, 8, false), matPipe));

  // 从主管到喷头(x=±1.2, z=-3.5/0/3.5)的短支管
  [[-1.2, -3.5], [-1.2, 0], [-1.2, 3.5], [1.2, -3.5], [1.2, 0], [1.2, 3.5]].forEach(function(sp) {
    var sx = sp[0] > 0 ? sideX : -sideX;
    var bp = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0.25, sp[1]),
      new THREE.Vector3(sp[0], 0.25, sp[1])
    ]);
    pg.add(new THREE.Mesh(new THREE.TubeGeometry(bp, 8, 0.035, 6, false), matPipe));
  });

  // 流动光点沿左侧主管
  for (var i = 0; i < 8; i++) {
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), matPipeFlow.clone());
    dot.visible = false; dot.userData = { pathProgress: Math.random(), speed: 0.1+Math.random()*0.2, path: leftPath };
    pg.add(dot); dynamicObjects.pipeFlows.push(dot);
  }
  // 流动光点沿右侧主管
  for (var j = 0; j < 8; j++) {
    var dot2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), matPipeFlow.clone());
    dot2.visible = false; dot2.userData = { pathProgress: Math.random(), speed: 0.1+Math.random()*0.2, path: rightPath };
    pg.add(dot2); dynamicObjects.pipeFlows.push(dot2);
  }
  scene.add(pg);
}

function createAlarmMarkers() {
  var mg = new THREE.Group();
  function makeMarker(color, pos) {
    var g = new THREE.Group();
    var s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0 }));
    g.add(s); g.position.copy(pos); g.visible = false; g.userData = { sphere: s };
    mg.add(g); return g;
  }
  dynamicObjects.alarmMarkers = {
    soil: makeMarker('#ff9500', new THREE.Vector3(0, 0.35, 0)),
    temp: makeMarker('#ff3860', new THREE.Vector3(0, GH.height - 0.5, -GH.halfL + 0.5)),
    water: makeMarker('#ff3860', new THREE.Vector3(-GH.halfW - 1.0, 0.9, -GH.halfL + 0.6))
  };
  scene.add(mg);
}

// ========== 渲染循环 ==========
function startRenderLoop() {
  var clock = new THREE.Clock();
  function render() {
    animFrameId = requestAnimationFrame(render);
    var dt = Math.min(clock.getDelta(), 0.1);
    var time = performance.now() * 0.001;

    frameCount++;
    if (frameCount % 120 === 0) {
      console.log('[3D V2] render loop alive, frame:', frameCount,
        'size:', containerEl ? containerEl.clientWidth + 'x' + containerEl.clientHeight : '?');
    }

    if (controls) controls.update();

    // 风扇旋转 + 气流动画
    dynamicObjects.fans.forEach(function(fan) {
      var bladesGroup = fan.userData.bladesGroup;
      if (bladesGroup) {
        bladesGroup.userData = bladesGroup.userData || { currentSpeed: 0 };
        var target = sceneData.fanStatus ? 12 : 0;
        bladesGroup.userData.currentSpeed += (target - bladesGroup.userData.currentSpeed) * Math.min(dt * 4, 1);
        bladesGroup.rotation.z += bladesGroup.userData.currentSpeed * dt;
        // 低频调试日志
        if (frameCount === 60) {
          console.log('[3D Fan] bladesGroup exists:', !!fan.userData.bladesGroup, 'fanStatus:', sceneData.fanStatus, 'speed:', bladesGroup.userData.currentSpeed.toFixed(2));
        }
      }
      // 气流线可见性 + 脉冲
      var airflow = fan.userData.airflow;
      if (airflow) {
        airflow.visible = sceneData.fanStatus;
        if (sceneData.fanStatus) {
          airflow.children.forEach(function(line) {
            var ud = line.userData;
            line.material.opacity = ud.baseOpacity + Math.abs(Math.sin(time * 8 + ud.phase)) * 0.15;
          });
        }
      }
    });

    // LED 灯光
    dynamicObjects.lamps.forEach(function(lamp) {
      var ud = lamp.userData;
      var ti = sceneData.lampStatus ? 2.5 : 0;
      var tg = sceneData.lampStatus ? 0.9 : 0;
      if (ud.glow) {
        ud.glow.material.emissiveIntensity += (ti - ud.glow.material.emissiveIntensity) * dt * 3;
        ud.glow.material.opacity += (tg - ud.glow.material.opacity) * dt * 3;
      }
      if (ud.spotLight) ud.spotLight.intensity += (ti - ud.spotLight.intensity) * dt * 3;
      if (ud.body) {
        if (sceneData.lampStatus) { ud.body.material.color.set('#ffe8a0'); ud.body.material.emissive = lampOnColor; ud.body.material.emissiveIntensity += (0.6 - ud.body.material.emissiveIntensity) * dt * 3; }
        else { ud.body.material.color.set('#555555'); ud.body.material.emissive = zeroColor; ud.body.material.emissiveIntensity += (0 - ud.body.material.emissiveIntensity) * dt * 3; }
      }
    });

    // 喷淋粒子: V3风格锥形喷雾
    if (dynamicObjects.sprayParticles) {
      dynamicObjects.sprayParticles.visible = sceneData.sprayStatus;
      if (sceneData.sprayStatus) {
        dynamicObjects.sprayParticles.children.forEach(function(p) {
          var ud = p.userData;
          // 粒子从喷头向下向外运动，循环重置
          var cycle = ((time * ud.speed + ud.offset) % 1.5) / 1.5; // 0→1 循环
          var r = ud.radius * cycle;
          var dy = cycle * 1.3;
          p.position.set(
            ud.originX + Math.cos(ud.offset) * r,
            ud.originY - dy,
            ud.originZ + Math.sin(ud.offset) * r
          );
          p.material.opacity = 0.3 + (1 - cycle) * 0.5;
        });
      }
    }

    // 水箱液位
    if (dynamicObjects.tankWater) {
      var level = sceneData.waterLevel / 100;
      dynamicObjects.tankWater.position.y = 0.06 + level * 1.0;
      dynamicObjects.tankWater.scale.y = Math.max(0.01, level);
      if (sceneData.waterAlarm) {
        dynamicObjects.tankWater.material.color.set('#ff4040');
        dynamicObjects.tankWater.material.emissive = new THREE.Color('#401010');
        dynamicObjects.tankWater.material.emissiveIntensity = 0.5 + Math.sin(time * 4) * 0.3;
      } else {
        dynamicObjects.tankWater.material.color.set('#4499dd');
        dynamicObjects.tankWater.material.emissive = new THREE.Color('#000000');
        dynamicObjects.tankWater.material.emissiveIntensity = 0;
      }
    }

    // 管道流动
    dynamicObjects.pipeFlows.forEach(function(dot) {
      dot.visible = sceneData.pumpStatus;
      if (sceneData.pumpStatus) {
        dot.userData.pathProgress += dot.userData.speed * dt;
        if (dot.userData.pathProgress > 1) dot.userData.pathProgress -= 1;
        dot.position.copy(dot.userData.path.getPoint(dot.userData.pathProgress));
        dot.material.opacity = 0.4 + Math.sin(dot.userData.pathProgress * Math.PI * 2) * 0.3;
      }
    });

    // 管道颜色 (直接引用, 不走scene.traverse)
    if (mainPipeRef) mainPipeRef.material.color.set(sceneData.pumpStatus ? '#00b8e8' : '#5070a0');

    // 土壤
    dynamicObjects.soilBeds.forEach(function(bed) {
      bed.material.color.set(sceneData.soilAlarm ? '#8a5030' : '#4a3020');
    });

    // 植物呼吸
    dynamicObjects.plants.forEach(function(plant) {
      var ud = plant.userData;
      if (ud && ud.breathSpeed) plant.position.y = ud.baseY + Math.sin(time * ud.breathSpeed + ud.breathOffset) * ud.breathAmp;
    });

    // HTML 告警标签 (缓存元素)
    ['soil','temp','water'].forEach(function(key) {
      var el = alarmElements[key];
      if (el) {
        var active = sceneData[key + 'Alarm'];
        if (active) el.classList.add('active'); else el.classList.remove('active');
      }
    });

    // 告警标记
    var mks = dynamicObjects.alarmMarkers;
    if (mks) {
      [mks.soil, mks.temp, mks.water].forEach(function(m) {
        var active = (m === mks.soil && sceneData.soilAlarm) || (m === mks.temp && sceneData.tempAlarm) || (m === mks.water && sceneData.waterAlarm);
        m.visible = active;
        if (active && m.userData.sphere) m.userData.sphere.material.opacity = 0.5 + Math.sin(time * 6) * 0.5;
      });
    }

    if (renderer && scene && camera) renderer.render(scene, camera);
  }
  render();
}

// ========== 尺寸同步 & ResizeObserver ==========
function resize3D(forceRender) {
  if (!threeReady || !renderer || !camera || !containerEl) return;
  var rect = containerEl.getBoundingClientRect();
  var w = rect.width;
  var h = rect.height;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setViewport(0, 0, w, h);
  if (forceRender && scene) renderer.render(scene, camera);
}

function attachResizeObserver() {
  if (!containerEl || typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver(function() { resize3D(true); });
  resizeObserver.observe(containerEl);
}

// ========== Window resize 监听 ==========
function handleWindowResize() {
  requestAnimationFrame(function() { resize3D(true); });
}

// ========== 遥测读取 ==========
function getLatestValue(ctx, key, defaultValue) {
  if (!ctx || !ctx.data) return defaultValue;
  for (var i = 0; i < ctx.data.length; i++) {
    var item = ctx.data[i];
    if (item.dataKey && item.dataKey.name === key && item.data && item.data.length > 0) {
      var last = item.data[item.data.length - 1];
      return last.length > 1 ? last[1] : defaultValue;
    }
  }
  return defaultValue;
}

function parseBool(val) {
  if (val === true || val === 'true' || val === 1 || val === '1') return true;
  if (val === false || val === 'false' || val === 0 || val === '0') return false;
  return false;
}

// ========== TB Widget 生命周期 ==========
self.onInit = function() {
  console.log('[3D V2] Init, loading Three.js from ' + THREE_BASE);
  window.addEventListener('resize', handleWindowResize);
  loadThreeModule().then(function() {
    waitUntilVisibleThenInit();
  }).catch(function(err) {
    console.error('[3D V2] Load failed:', err);
    rootEl = self.ctx.$container[0];
    if (rootEl) rootEl.innerHTML = '<div style="color:#ff3860;padding:40px;text-align:center">3D 加载失败<br><small>' + err.message + '</small></div>';
  });
};

self.onDataUpdated = function() {
  if (!threeReady) return;
  if (testMode) return; // 测试模式不覆盖真实状态
  sceneData.fanStatus = parseBool(getLatestValue(self.ctx, 'fanStatus', false));
  sceneData.lampStatus = parseBool(getLatestValue(self.ctx, 'lampStatus', false));
  sceneData.sprayStatus = parseBool(getLatestValue(self.ctx, 'sprayStatus', false));
  sceneData.pumpStatus = parseBool(getLatestValue(self.ctx, 'pumpStatus', false));
  sceneData.soilAlarm = parseBool(getLatestValue(self.ctx, 'soilAlarm', false));
  sceneData.tempAlarm = parseBool(getLatestValue(self.ctx, 'tempAlarm', false));
  sceneData.waterAlarm = parseBool(getLatestValue(self.ctx, 'waterAlarm', false));
  sceneData.co2Alarm = parseBool(getLatestValue(self.ctx, 'co2Alarm', false));
  sceneData.waterLevel = Number(getLatestValue(self.ctx, 'waterLevel', 60));
  sceneData.soilHumidity = Number(getLatestValue(self.ctx, 'soilHumidity', 50));
  sceneData.temperature = Number(getLatestValue(self.ctx, 'temperature', 25));
  sceneData.hourOfDay = Number(getLatestValue(self.ctx, 'hourOfDay', 12));
  sceneData.outsideLight = Number(getLatestValue(self.ctx, 'outsideLight', 500));
  sceneData.lightIntensity = Number(getLatestValue(self.ctx, 'lightIntensity', 500));
};

self.onResize = function() {
  resize3D(true);
};

self.onDestroy = function() {
  window.removeEventListener('resize', handleWindowResize);
  if (intersectionObserver) { intersectionObserver.disconnect(); intersectionObserver = null; }
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  if (renderer) {
    renderer.dispose();
    if (containerEl && renderer.domElement && containerEl.contains(renderer.domElement))
      containerEl.removeChild(renderer.domElement);
    renderer = null;
  }
  if (scene) {
    scene.traverse(function(obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(function(m){m.dispose();});
        else obj.material.dispose();
      }
    });
    scene = null;
  }
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
  threeReady = false;
  console.log('[3D V2] Destroyed');
};
