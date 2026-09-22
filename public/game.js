// Client FPS Game Engine for 'Wardogs KW' (Custom Room System)

// Global State
window.currentUsername = '';
window.currentRoomId = '';
window.isRoomMaster = false;
window.lobbyData = null;
let selfId = null;

// Audio Context
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 1. Landing Screen Actions
function handleCreateRoomClick() {
  const input = document.getElementById('usernameInput');
  const name = (input ? input.value : '').trim();
  if (!name) {
    if (input) {
      input.focus();
      input.style.borderColor = '#ef4444';
      input.placeholder = 'WAJIB ISI USERNAME!';
    }
    return;
  }

  window.currentUsername = name;

  const promptModal = document.getElementById('promptRoomModal');
  const roomNameInput = document.getElementById('customRoomNameInput');
  if (promptModal) {
    promptModal.style.display = 'flex';
    if (roomNameInput) {
      roomNameInput.value = 'ROOM_' + Math.floor(Math.random() * 900 + 100);
      roomNameInput.focus();
    }
  }
}

function closePromptRoomModal() {
  const promptModal = document.getElementById('promptRoomModal');
  if (promptModal) promptModal.style.display = 'none';
}

function confirmCreateRoom() {
  const roomNameInput = document.getElementById('customRoomNameInput');
  const customRoomName = (roomNameInput && roomNameInput.value ? roomNameInput.value : 'ROOM_' + Math.floor(Math.random() * 900 + 100)).trim().toUpperCase();

  closePromptRoomModal();
  getAudioContext();
  connectWebSocket();

  setTimeout(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'create_room',
        username: window.currentUsername,
        roomId: customRoomName
      }));
    }
  }, 100);
}

function joinActiveRoom(roomId) {
  const input = document.getElementById('usernameInput');
  const name = (input ? input.value : '').trim();
  if (!name) {
    if (input) {
      input.focus();
      input.style.borderColor = '#ef4444';
      input.placeholder = 'WAJIB ISI USERNAME DULU!';
    }
    return;
  }

  window.currentUsername = name;
  getAudioContext();
  connectWebSocket();

  setTimeout(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'join_room',
        username: window.currentUsername,
        roomId
      }));
    }
  }, 100);
}

function requestRoomList() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'get_rooms' }));
  } else {
    connectWebSocket();
  }
}

function renderRoomsList(rooms) {
  const container = document.getElementById('activeRoomsList');
  if (!container) return;

  if (!rooms || rooms.length === 0) {
    container.innerHTML = `<div style="color:#ffd700; font-size:12px; text-align:center;">Belum ada room aktif. Klik '+ BUAT ROOM BARU' di atas!</div>`;
    return;
  }

  container.innerHTML = rooms.map(r => `
    <div class="room-row">
      <div>
        <b style="color:#ffd700; font-size:14px;">[${r.id}]</b>
        <span style="color:#cbd5e1; font-size:11.5px;">• ${r.state === 'playing' ? '🔴 Match Berlangsung' : '🟢 Di Lobby'} • Target: ${r.winTarget} Kill ${r.noBot ? '• <span style="color:#ef4444; font-weight:900;">NO BOT</span>' : ''}</span>
        <div style="font-size:11px; color:#fff; margin-top:2px;">Pemain: 🔴 ${r.redCount}/4 | 🔵 ${r.blueCount}/4 (Total ${r.totalHumans}/8)</div>
      </div>
      <button type="button" class="btn-join" ${r.isFull ? 'disabled' : ''} onclick="joinActiveRoom('${r.id}')">
        ${r.isFull ? 'FULL' : (r.state === 'playing' ? 'JOIN MATCH' : 'JOIN ROOM')}
      </button>
    </div>
  `).join('');
}

// 2. Custom Room Lobby Controls
function updateCustomLobbyUI(room) {
  window.lobbyData = room;
  // Permanent check against room.masterId
  if (room.masterId && selfId) {
    window.isRoomMaster = (room.masterId === selfId);
  } else if (room.isMaster !== undefined) {
    window.isRoomMaster = !!room.isMaster;
  }

  const landingModal = document.getElementById('landingModal');
  const customLobbyModal = document.getElementById('customLobbyModal');
  if (landingModal) landingModal.style.display = 'none';
  if (customLobbyModal) customLobbyModal.style.display = 'flex';

  const titleEl = document.getElementById('lobbyRoomTitle');
  if (titleEl) titleEl.textContent = `CUSTOM ROOM: [${room.id}]`;

  const hostBadge = document.getElementById('lobbyHostBadge');
  if (hostBadge) {
    const masterPlayer = room.players.find(p => p.id === room.masterId);
    hostBadge.textContent = `ROOM MASTER: ${masterPlayer ? masterPlayer.username : 'HOST'}`;
  }

  // Update Slots List
  const redSlotsList = document.getElementById('redSlotsList');
  const blueSlotsList = document.getElementById('blueSlotsList');
  const redSlotCount = document.getElementById('redSlotCount');
  const blueSlotCount = document.getElementById('blueSlotCount');

  const redPlayers = room.players.filter(p => p.team === 'red' && !p.isBot);
  const bluePlayers = room.players.filter(p => p.team === 'blue' && !p.isBot);

  if (redSlotCount) redSlotCount.textContent = redPlayers.length;
  if (blueSlotCount) blueSlotCount.textContent = bluePlayers.length;

  let redHtml = '';
  for (let i = 0; i < 4; i++) {
    if (i < redPlayers.length) {
      const p = redPlayers[i];
      const isMe = p.id === selfId;
      redHtml += `<div class="slot-item"><span>🔴 ${p.username} ${isMe ? '(YOU)' : ''}</span> ${p.id === room.masterId ? '<span style="color:#ffd700; font-size:10px;">★ HOST</span>' : ''}</div>`;
    } else {
      redHtml += `<div class="slot-item slot-empty">[ Slot Kosong ${i + 1} ]</div>`;
    }
  }
  if (redSlotsList) redSlotsList.innerHTML = redHtml;

  let blueHtml = '';
  for (let i = 0; i < 4; i++) {
    if (i < bluePlayers.length) {
      const p = bluePlayers[i];
      const isMe = p.id === selfId;
      blueHtml += `<div class="slot-item"><span>🔵 ${p.username} ${isMe ? '(YOU)' : ''}</span> ${p.id === room.masterId ? '<span style="color:#ffd700; font-size:10px;">★ HOST</span>' : ''}</div>`;
    } else {
      blueHtml += `<div class="slot-item slot-empty">[ Slot Kosong ${i + 1} ]</div>`;
    }
  }
  if (blueSlotsList) blueSlotsList.innerHTML = blueHtml;

  const noBotCb = document.getElementById('lobbyNoBotCheckbox');
  if (noBotCb) {
    noBotCb.checked = !!room.noBot;
    noBotCb.disabled = !window.isRoomMaster;
  }

  document.querySelectorAll('.win-btn-opt').forEach(btn => {
    if (btn.textContent.includes(String(room.winTarget))) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
    btn.disabled = !window.isRoomMaster;
  });

  const startBtn = document.getElementById('btnStartGame');
  if (startBtn) {
    if (window.isRoomMaster) {
      startBtn.disabled = false;
      startBtn.textContent = 'MULAI PERTANDINGAN (MAIN)';
    } else {
      startBtn.disabled = true;
      startBtn.textContent = 'MENUNGGU ROOM MASTER MEMULAI...';
    }
  }
}

function switchMyTeam(targetTeam) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'switch_team',
      team: targetTeam
    }));
  }
}

function hostToggleNoBot(noBotChecked) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'update_room_settings',
      noBot: noBotChecked
    }));
  }
}

function hostChangeWinTarget(target) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'update_room_settings',
      winTarget: target
    }));
  }
}

function hostStartMatch() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'start_match'
    }));
  }
}

// 3. Gameplay Engine
const canvas = document.getElementById('gameCanvas');
const crosshair = document.getElementById('crosshair');
const hitmarker = document.getElementById('hitmarker');
const hud = document.getElementById('hud');
const healthVal = document.getElementById('healthVal');
const ammoVal = document.getElementById('ammoVal');
const scoreRed = document.getElementById('scoreRed');
const scoreBlue = document.getElementById('scoreBlue');
const killFeed = document.getElementById('killFeed');
const damageFlash = document.getElementById('damageFlash');
const deathScreen = document.getElementById('deathScreen');
const victoryModal = document.getElementById('victoryModal');
const vicTitle = document.getElementById('vicTitle');
const vicSub = document.getElementById('vicSub');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNum = document.getElementById('countdownNum');
const countdownSub = document.getElementById('countdownSub');
const holoScope = document.getElementById('holoScope');
const roomDisplayBadge = document.getElementById('roomDisplayBadge');
const sbRoomTitle = document.getElementById('sbRoomTitle');

const scoreboardModal = document.getElementById('scoreboardModal');
const sbScoreRed = document.getElementById('sbScoreRed');
const sbScoreBlue = document.getElementById('sbScoreBlue');
const sbBodyRed = document.getElementById('sbBodyRed');
const sbBodyBlue = document.getElementById('sbBodyBlue');

const pauseMenuModal = document.getElementById('pauseMenuModal');
const volumeSlider = document.getElementById('volumeSlider');
const volValTxt = document.getElementById('volValTxt');
const pauseSensSlider = document.getElementById('pauseSensSlider');
const pauseSensValTxt = document.getElementById('pauseSensValTxt');
const btnResumeGame = document.getElementById('btnResumeGame');
const btnBackToLobby = document.getElementById('btnBackToLobby');

let masterVolume = 1.0;
if (volumeSlider) {
  volumeSlider.addEventListener('input', (e) => {
    masterVolume = parseFloat(e.target.value);
    if (volValTxt) volValTxt.textContent = `${Math.round(masterVolume * 100)}%`;
  });
}

// Mouse Sensitivity with persistent localStorage and balanced base multiplier
const BASE_SENSITIVITY = 0.0009; // Diperlambat & jauh lebih halus/presisi untuk FPS
let currentSensMultiplier = parseFloat(localStorage.getItem('wardogs_sens') || '1.0');
let mouseSensitivity = BASE_SENSITIVITY * currentSensMultiplier;

if (pauseSensSlider) {
  pauseSensSlider.value = currentSensMultiplier.toString();
  if (pauseSensValTxt) pauseSensValTxt.textContent = currentSensMultiplier.toFixed(1);
  pauseSensSlider.addEventListener('input', (e) => {
    currentSensMultiplier = parseFloat(e.target.value);
    mouseSensitivity = BASE_SENSITIVITY * currentSensMultiplier;
    localStorage.setItem('wardogs_sens', currentSensMultiplier.toString());
    if (pauseSensValTxt) pauseSensValTxt.textContent = currentSensMultiplier.toFixed(1);
  });
}

if (btnResumeGame) {
  btnResumeGame.addEventListener('click', () => {
    if (pauseMenuModal) pauseMenuModal.style.display = 'none';
    canvas.requestPointerLock();
  });
}

if (btnBackToLobby) {
  btnBackToLobby.addEventListener('click', () => {
    location.reload();
  });
}

let canMove = false;
let countdownTimer = null;

function startMatchCountdown() {
  canMove = false;
  let count = 3;
  if (countdownOverlay) countdownOverlay.style.display = 'flex';
  if (countdownNum) countdownNum.textContent = count;
  if (countdownSub) countdownSub.textContent = 'PERSIAPAN DIMULAI...';

  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    count--;
    if (count > 0) {
      if (countdownNum) countdownNum.textContent = count;
    } else if (count === 0) {
      if (countdownNum) {
        countdownNum.textContent = 'GO!';
        countdownNum.style.color = '#22c55e';
      }
      if (countdownSub) countdownSub.textContent = 'TEMBAK SEMUA MUSUH!';
      canMove = true;
    } else {
      clearInterval(countdownTimer);
      if (countdownOverlay) countdownOverlay.style.display = 'none';
      if (countdownNum) countdownNum.style.color = '#ffd700';
    }
  }, 1000);
}

const MAG_SIZE = 30;
let currentClip = 30;
let reserveAmmo = 90;
let isReloading = false;
let lastShotTime = 0;
const FIRE_RATE = 88;

let isMouseDown = false;
let isAiming = false;
let aimProgress = 0;
let recoilOffsetZ = 0;
let continuousShots = 0;

let recoilPitchKick = 0;
let recoilYawKick = 0;

let selfTeam = 'red';
let selfHealth = 100;
let isDead = false;
let isPointerLocked = false;
let currentWinTargetLimit = 40;
let isMatchEnded = false;
let latestScores = { red: 0, blue: 0 };
let currentPlayersList = [];

let lastDamageTakenTime = 0;

function updateHealthRegen(delta, now) {
  if (isDead || selfHealth >= 100 || isMatchEnded) return;

  if (now - lastDamageTakenTime >= 4000) {
    const healAmount = 15 * delta;
    selfHealth = Math.min(100, selfHealth + healAmount);
    updateHealthUI();
  }
}

// Movement & Physics (Shift = Sprint Lari Cepat)
const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
  ShiftLeft: false, // Sprint
  KeyC: false,
  Tab: false
};

let isSprinting = false;
let isPlayerMoving = false;
let sprintProgress = 0;
let sprintBobTimer = 0;

// Death Fall POV Animation State
let deathAnimationProgress = 0;
let isPlayingDeathPOV = false;

const playerPos = new THREE.Vector3(0, 1.6, 0);
const playerVel = new THREE.Vector3();
let yaw = 0;
let pitch = 0;
let targetYaw = 0;
let targetPitch = 0;
let isGrounded = true;
let isCrouched = false;
const PLAYER_RADIUS = 0.5;
const NORMAL_HEIGHT = 1.65;
const CROUCH_HEIGHT = 0.95;
let currentCameraHeight = NORMAL_HEIGHT;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);
camera.position.set(0, NORMAL_HEIGHT, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4ade80, 0.75);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.1);
sunLight.position.set(40, 70, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

function playGunshotSound(pos = null) {
  if (masterVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  let vol = 0.65 * masterVolume;
  if (pos) {
    const dist = playerPos.distanceTo(new THREE.Vector3(pos.x, pos.y, pos.z));
    vol = (0.65 * masterVolume) / (1.0 + dist * 0.08);
    if (vol < 0.02) return;
  }

  const bufferSize = ctx.sampleRate * 0.16;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = pos ? 1900 : 2400;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, ctx.currentTime + 0.16);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start();
}

function playHitSound() {
  if (masterVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(850, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.35 * masterVolume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, ctx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

// Realistic Weapon Reload Sound (Metal Mag Release, Polymer Slide Insert, Heavy Bolt Catch)
function playReloadSound() {
  if (masterVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // 1. Metal Magazine Release & Friction Drop (0.12s)
  setTimeout(() => {
    // White Noise Friction
    const bufSize = ctx.sampleRate * 0.08;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32 * masterVolume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01 * masterVolume, ctx.currentTime + 0.08);
    noise.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    noise.start();
  }, 120);

  // 2. Solid Mag Insertion & Metal Click Lock (0.88s)
  setTimeout(() => {
    // Metal impact click 1
    const osc = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.06);
    g1.gain.setValueAtTime(0.45 * masterVolume, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.01 * masterVolume, ctx.currentTime + 0.06);
    osc.connect(g1);
    g1.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);

    // Deep seating thud
    const oscThud = ctx.createOscillator();
    const gThud = ctx.createGain();
    oscThud.type = 'triangle';
    oscThud.frequency.setValueAtTime(180, ctx.currentTime);
    oscThud.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.09);
    gThud.gain.setValueAtTime(0.4 * masterVolume, ctx.currentTime);
    gThud.gain.exponentialRampToValueAtTime(0.01 * masterVolume, ctx.currentTime + 0.09);
    oscThud.connect(gThud);
    gThud.connect(ctx.destination);
    oscThud.start();
    oscThud.stop(ctx.currentTime + 0.09);
  }, 880);

  // 3. Heavy Bolt Chambering Release (1.25s)
  setTimeout(() => {
    const bufSize = ctx.sampleRate * 0.1;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4 * masterVolume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01 * masterVolume, ctx.currentTime + 0.1);
    noise.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    noise.start();

    // Metallic ring
    const osc = ctx.createOscillator();
    const gRing = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
    gRing.gain.setValueAtTime(0.25 * masterVolume, ctx.currentTime);
    gRing.gain.exponentialRampToValueAtTime(0.01 * masterVolume, ctx.currentTime + 0.08);
    osc.connect(gRing);
    gRing.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }, 1250);
}

// Visual Luminous Bullet Particles Engine (Animasi Peluru Berapi & Efek Percikan Muzzle Api)
const activeBulletProjectiles = [];
const activeMuzzleFlashes = [];

const bulletOuterGeo = new THREE.SphereGeometry(0.04, 6, 6);
const bulletOuterMat = new THREE.MeshBasicMaterial({
  color: 0xff6600,
  transparent: true,
  opacity: 0.95
});
const bulletCoreGeo = new THREE.SphereGeometry(0.02, 6, 6);
const bulletCoreMat = new THREE.MeshBasicMaterial({
  color: 0xffffff
});

function spawnMuzzleFireFlash(pos, dir) {
  if (!pos) return;
  const flashGroup = new THREE.Group();

  const fireGeo = new THREE.SphereGeometry(0.08, 6, 6);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0.95 });
  const fireMesh = new THREE.Mesh(fireGeo, fireMat);
  flashGroup.add(fireMesh);

  const innerGeo = new THREE.SphereGeometry(0.04, 6, 6);
  const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  flashGroup.add(innerMesh);

  flashGroup.position.set(pos.x, pos.y, pos.z);
  scene.add(flashGroup);

  let elapsed = 0;
  const flashLife = 0.05;
  activeMuzzleFlashes.push({
    group: flashGroup,
    fireMat,
    fireGeo,
    innerGeo,
    innerMat,
    update: (dt) => {
      elapsed += dt;
      const progress = elapsed / flashLife;
      flashGroup.scale.setScalar(1 + progress * 0.5);
      fireMat.opacity = Math.max(0, 1 - progress);
      if (elapsed >= flashLife) {
        scene.remove(flashGroup);
        fireGeo.dispose();
        fireMat.dispose();
        innerGeo.dispose();
        innerMat.dispose();
        return false;
      }
      return true;
    }
  });
}

function createBulletTracer(from, dir, hitDist = 70) {
  if (!from || !dir) return;

  const start = new THREE.Vector3(from.x, from.y, from.z);
  const forward = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
  const maxDistance = (hitDist && !isNaN(hitDist)) ? Math.min(hitDist, 80) : 70;

  // Grup peluru bercahaya api
  const bulletGroup = new THREE.Group();

  const outerMesh = new THREE.Mesh(bulletOuterGeo, bulletOuterMat.clone());
  bulletGroup.add(outerMesh);

  const coreMesh = new THREE.Mesh(bulletCoreGeo, bulletCoreMat);
  bulletGroup.add(coreMesh);

  bulletGroup.position.copy(start);
  scene.add(bulletGroup);

  // Ekor api (fiery luminous trail) ramping di belakang peluru
  const tailLength = 0.75;
  const tailPoints = [start.clone(), start.clone().addScaledVector(forward, -tailLength)];
  const tailGeo = new THREE.BufferGeometry().setFromPoints(tailPoints);
  const tailMat = new THREE.LineBasicMaterial({
    color: 0xffbb00,
    transparent: true,
    opacity: 0.95
  });
  const tailLine = new THREE.Line(tailGeo, tailMat);
  scene.add(tailLine);

  const speed = 105; // Kecepatan proyektil tajam & responsif
  
  activeBulletProjectiles.push({
    group: bulletGroup,
    tail: tailLine,
    tailGeo,
    tailMat,
    pos: start.clone(),
    dir: forward,
    distTraveled: 0,
    maxDist: maxDistance,
    speed,
    tailLength
  });
}

function updateBulletProjectiles(delta) {
  for (let i = activeBulletProjectiles.length - 1; i >= 0; i--) {
    const b = activeBulletProjectiles[i];
    const step = b.speed * delta;
    b.distTraveled += step;
    b.pos.addScaledVector(b.dir, step);

    b.group.position.copy(b.pos);

    // Update ekor peluru berapi
    const tailStart = b.pos.clone();
    const tailEnd = b.pos.clone().addScaledVector(b.dir, -b.tailLength);
    b.tailGeo.setFromPoints([tailStart, tailEnd]);

    if (b.distTraveled >= b.maxDist) {
      scene.remove(b.group);
      scene.remove(b.tail);
      b.group.traverse(obj => {
        if (obj.geometry && obj.geometry !== bulletOuterGeo && obj.geometry !== bulletCoreGeo) obj.geometry.dispose();
        if (obj.material && obj.material !== bulletCoreMat) obj.material.dispose();
      });
      b.tailGeo.dispose();
      b.tailMat.dispose();
      activeBulletProjectiles.splice(i, 1);
    }
  }

  for (let i = activeMuzzleFlashes.length - 1; i >= 0; i--) {
    if (!activeMuzzleFlashes[i].update(delta)) {
      activeMuzzleFlashes.splice(i, 1);
    }
  }
}

function playJumpLandSound(pos = null) {
  if (masterVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.14);

  filter.type = 'lowpass';
  filter.frequency.value = 350;

  gain.gain.setValueAtTime(0.5 * masterVolume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, ctx.currentTime + 0.14);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.14);
}

let localStepTimer = 0;

function createGrassTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 15000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random();
    ctx.fillStyle = r > 0.6 ? '#388e3c' : (r > 0.3 ? '#4caf50' : '#1b5e20');
    ctx.fillRect(x, y, 2.5, 2.5);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

function createWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8d5b2c';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 40) {
    ctx.fillStyle = '#5c3814';
    ctx.fillRect(0, y, 256, 3);
  }
  ctx.fillStyle = 'rgba(60, 30, 10, 0.15)';
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillRect(x, y, Math.random() * 20 + 5, 1);
  }
  ctx.strokeStyle = '#3e240c';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 246);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(10, 10);
  ctx.lineTo(246, 246);
  ctx.moveTo(246, 10);
  ctx.lineTo(10, 246);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(c);
  return texture;
}

function createCamoTexture(baseColorHex, darkColorHex, lightColorHex) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, 256, 256);

  const colors = [darkColorHex, lightColorHex, '#1e293b'];
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = Math.random() * 20 + 8;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const grassTexture = createGrassTexture();
const woodTexture = createWoodTexture();
const redArmyCamoTexture = createCamoTexture('#991b1b', '#ef4444', '#7f1d1d');
const blueArmyCamoTexture = createCamoTexture('#1e40af', '#3b82f6', '#172554');

const gunGroup = new THREE.Group();
let muzzleFlashMesh = null;
let magMesh = null;
let leftHandGroup = null;
camera.add(gunGroup);
scene.add(camera);

function createAssaultRifleModel() {
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.2 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.9 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.6), gunMat);
  gunGroup.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 12), darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.45);
  gunGroup.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), goldMat);
  muzzle.position.set(0, 0.02, -0.7);
  gunGroup.add(muzzle);

  magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.12), darkMat);
  magMesh.position.set(0, -0.14, -0.05);
  magMesh.rotation.x = 0.2;
  gunGroup.add(magMesh);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.3), darkMat);
  stock.position.set(0, -0.02, 0.4);
  gunGroup.add(stock);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.16), darkMat);
  sight.position.set(0, 0.09, -0.05);
  gunGroup.add(sight);

  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.18), gloveMat);
  rightHand.position.set(0.02, -0.08, 0.15);
  rightHand.rotation.x = -0.3;
  gunGroup.add(rightHand);

  leftHandGroup = new THREE.Group();
  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.14), gloveMat);
  leftHandGroup.add(leftHand);
  leftHandGroup.position.set(-0.06, -0.14, -0.05);
  gunGroup.add(leftHandGroup);

  const flashGeo = new THREE.SphereGeometry(0.09, 8, 8);
  flashGeo.scale(1.5, 1.5, 2.5);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0 });
  muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlashMesh.position.set(0, 0.02, -0.85);
  gunGroup.add(muzzleFlashMesh);

  gunGroup.position.set(0.28, -0.24, -0.55);
}
createAssaultRifleModel();

let reloadStartTime = 0;
const RELOAD_DURATION = 1500;

function updateReloadAnimation(now) {
  if (!isReloading) {
    if (magMesh) magMesh.position.set(0, -0.14, -0.05);
    if (leftHandGroup) leftHandGroup.position.set(-0.06, -0.14, -0.05);
    return;
  }

  const elapsed = now - reloadStartTime;
  const progress = Math.min(elapsed / RELOAD_DURATION, 1.0);

  if (progress < 0.4) {
    const p1 = progress / 0.4;
    const magDrop = p1 * 0.4;
    magMesh.position.set(0, -0.14 - magDrop, -0.05 + p1 * 0.05);
    leftHandGroup.position.set(-0.06, -0.14 - magDrop, -0.05 + p1 * 0.05);
    gunGroup.rotation.z = Math.sin(p1 * Math.PI) * 0.15;
    gunGroup.rotation.x = -Math.sin(p1 * Math.PI) * 0.1;
  } else if (progress < 0.6) {
    const p2 = (progress - 0.4) / 0.2;
    magMesh.position.set(0, -0.54, 0);
    leftHandGroup.position.set(-0.15 + p2 * 0.09, -0.55 + p2 * 0.15, 0);
  } else if (progress < 0.9) {
    const p3 = (progress - 0.6) / 0.3;
    const magInsertY = -0.4 + p3 * 0.26;
    magMesh.position.set(0, magInsertY, -0.05);
    leftHandGroup.position.set(-0.06, magInsertY, -0.05);
    gunGroup.rotation.z = (1 - p3) * 0.15;
    gunGroup.rotation.x = -(1 - p3) * 0.1;
  } else {
    magMesh.position.set(0, -0.14, -0.05);
    leftHandGroup.position.set(-0.06, -0.14, -0.05);
    gunGroup.rotation.set(0, 0, 0);
  }
}

const ejectedShells = [];
const shellGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8);
const shellMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });

function ejectBulletShell() {
  const shell = new THREE.Mesh(shellGeo, shellMat);
  const ejectionWorldPos = new THREE.Vector3(0.08, 0.02, -0.1);
  gunGroup.localToWorld(ejectionWorldPos);
  shell.position.copy(ejectionWorldPos);

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  
  shell.userData = {
    vel: right.clone().multiplyScalar(2.8 + Math.random() * 0.8)
              .add(new THREE.Vector3(0, 2.0 + Math.random() * 0.8, 0))
              .add(forward.clone().multiplyScalar(-0.5)),
    rotVel: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
    life: 1.5
  };
  scene.add(shell);
  ejectedShells.push(shell);
}

const mapBoxMeshes = [];
let mapBoxesData = [];
let floorMesh = null;

const decalGeo = new THREE.PlaneGeometry(0.16, 0.16);
const decalMat = new THREE.MeshBasicMaterial({
  color: 0x111827,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4
});

function spawnBulletHole(point, normal) {
  const decal = new THREE.Mesh(decalGeo, decalMat.clone());
  decal.position.copy(point).addScaledVector(normal, 0.008);
  decal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  scene.add(decal);

  setTimeout(() => {
    const fadeInterval = setInterval(() => {
      decal.material.opacity -= 0.15;
      if (decal.material.opacity <= 0) {
        clearInterval(fadeInterval);
        scene.remove(decal);
        decal.material.dispose();
      }
    }, 40);
  }, 3000);
}

function buildMap(boxes) {
  mapBoxesData = boxes;

  const floorGeo = new THREE.PlaneGeometry(80, 80);
  const floorMat = new THREE.MeshStandardMaterial({
    map: grassTexture,
    roughness: 0.9,
    metalness: 0.05
  });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  boxes.forEach(b => {
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    let mat;

    if (b.type === 'wood') {
      mat = new THREE.MeshStandardMaterial({
        map: woodTexture,
        roughness: 0.6,
        metalness: 0.1
      });
    } else if (b.type === 'one_way_wall_red' || b.type === 'one_way_wall_blue') {
      // PINTU KHUSUS SAFEZONE (Hitam Pekat Solid Tidak Transparan)
      mat = new THREE.MeshStandardMaterial({
        color: 0x080808,
        roughness: 0.7,
        metalness: 0.85,
        transparent: false,
        opacity: 1.0
      });
    } else if (b.type === 'spawn_wall_red') {
      // DINDING MARKAS MERAH (Merah Solid Sesuai Tim)
      mat = new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        roughness: 0.5,
        metalness: 0.3,
        transparent: false,
        opacity: 1.0
      });
    } else if (b.type === 'spawn_wall_blue') {
      // DINDING MARKAS BIRU (Biru Solid Sesuai Tim)
      mat = new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        roughness: 0.5,
        metalness: 0.3,
        transparent: false,
        opacity: 1.0
      });
    } else if (b.type === 'base_red' || b.type === 'base_red_floor') {
      mat = new THREE.MeshStandardMaterial({
        color: b.color || 0xef4444,
        roughness: 0.4,
        metalness: 0.2
      });
    } else if (b.type === 'base_blue' || b.type === 'base_blue_floor') {
      mat = new THREE.MeshStandardMaterial({
        color: b.color || 0x3b82f6,
        roughness: 0.4,
        metalness: 0.2
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: b.color || 0x64748b,
        roughness: 0.7,
        metalness: 0.15
      });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, b.y, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    mapBoxMeshes.push(mesh);
  });
}

const droppedAmmoBoxes = [];
const ammoBoxGeo = new THREE.BoxGeometry(0.35, 0.22, 0.25);
const ammoBoxMat = new THREE.MeshStandardMaterial({
  color: 0x15803d,
  roughness: 0.4,
  metalness: 0.6,
  emissive: 0x22c55e,
  emissiveIntensity: 0.35
});

function spawnAmmoBox(pos) {
  const boxGroup = new THREE.Group();
  const mesh = new THREE.Mesh(ammoBoxGeo, ammoBoxMat);
  mesh.castShadow = true;
  boxGroup.add(mesh);

  const lidGeo = new THREE.BoxGeometry(0.37, 0.05, 0.27);
  const lidMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8 });
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.position.y = 0.12;
  boxGroup.add(lid);

  boxGroup.position.set(pos.x, 0.12, pos.z);
  scene.add(boxGroup);

  const ammoItem = {
    group: boxGroup,
    pos: new THREE.Vector3(pos.x, 0.12, pos.z),
    life: 3.0,
    collected: false
  };
  droppedAmmoBoxes.push(ammoItem);
}

function updateAmmoPickups(delta) {
  for (let i = droppedAmmoBoxes.length - 1; i >= 0; i--) {
    const item = droppedAmmoBoxes[i];
    item.life -= delta;
    item.group.rotation.y += delta * 2.5;

    const distToPlayer = playerPos.distanceTo(item.pos);
    if (!item.collected && distToPlayer < 1.8 && !isDead) {
      if (reserveAmmo < 90) {
        const added = Math.min(15, 90 - reserveAmmo);
        reserveAmmo += added;
        updateAmmoUI();
        playAmmoPickupSound();
        addFeedNotice(`+${added} Peluru Diambil! (${currentClip}/${reserveAmmo})`);
        item.collected = true;
        item.life = 0;
      }
    }

    if (item.life <= 0) {
      scene.remove(item.group);
      droppedAmmoBoxes.splice(i, 1);
    }
  }
}

function playAmmoPickupSound() {
  if (masterVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1040, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.4 * masterVolume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01 * masterVolume, ctx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

const deadRagdolls = [];

function spawnDeadRagdoll(playerData, finalPos, finalYaw) {
  const group = new THREE.Group();
  const isRed = playerData.victimTeam === 'red';
  const stickColor = isRed ? 0xef4444 : 0x3b82f6;
  const camoTexture = isRed ? redArmyCamoTexture : blueArmyCamoTexture;

  const stickSkinMat = new THREE.MeshStandardMaterial({ color: stickColor, roughness: 0.3, metalness: 0.15 });
  const camoMat = new THREE.MeshStandardMaterial({ map: camoTexture, roughness: 0.7, metalness: 0.1 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: isRed ? 0x7f1d1d : 0x1e3a8a, roughness: 0.4, metalness: 0.5 });

  const bodyRig = new THREE.Group();
  bodyRig.position.y = 0.6;

  const headGeo = new THREE.SphereGeometry(0.32, 16, 16);
  const headMesh = new THREE.Mesh(headGeo, stickSkinMat);
  headMesh.position.set(0, 1.0, 0);
  bodyRig.add(headMesh);

  const helmetGeo = new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
  helmetMesh.position.set(0, 1.03, 0);
  bodyRig.add(helmetMesh);

  const ragdollVisorMat = new THREE.MeshStandardMaterial({
    color: isRed ? 0xff2222 : 0x00f0ff,
    emissive: isRed ? 0xef4444 : 0x00d2ff,
    emissiveIntensity: 0.8
  });
  const ragdollVisor = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.08, 0.04), ragdollVisorMat);
  ragdollVisor.position.set(0, 1.02, 0.31);
  bodyRig.add(ragdollVisor);

  const torsoGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.75, 12);
  const torsoMesh = new THREE.Mesh(torsoGeo, camoMat);
  torsoMesh.position.set(0, 0.38, 0);
  bodyRig.add(torsoMesh);

  const legGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.62, 8);
  const leftLeg = new THREE.Mesh(legGeo, camoMat);
  leftLeg.position.set(-0.14, -0.31, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, camoMat);
  rightLeg.position.set(0.14, -0.31, 0);
  group.add(rightLeg);

  group.add(bodyRig);
  group.position.set(finalPos.x, 0, finalPos.z);
  group.rotation.y = finalYaw;
  scene.add(group);

  const ragdollItem = {
    group,
    bodyRig,
    leftLeg,
    rightLeg,
    life: 3.0,
    fallTime: 0,
    fallDuration: 0.55
  };
  deadRagdolls.push(ragdollItem);
}

function updateDeadRagdolls(delta) {
  for (let i = deadRagdolls.length - 1; i >= 0; i--) {
    const d = deadRagdolls[i];
    d.life -= delta;
    d.fallTime += delta;

    if (d.fallTime < d.fallDuration) {
      const p = Math.min(d.fallTime / d.fallDuration, 1.0);
      const ease = 1 - Math.pow(1 - p, 3);

      d.bodyRig.rotation.x = -ease * 1.57;
      d.bodyRig.position.y = 0.6 * (1 - ease) + 0.18 * ease;
      d.bodyRig.position.z = -ease * 0.45;

      d.leftLeg.rotation.x = -ease * 0.4;
      d.rightLeg.rotation.x = -ease * 0.35;
      d.leftLeg.position.y = -0.31 * (1 - ease) + 0.12 * ease;
      d.rightLeg.position.y = -0.31 * (1 - ease) + 0.12 * ease;
    } else {
      d.bodyRig.rotation.x = -1.57;
      d.bodyRig.position.y = 0.18;
      d.bodyRig.position.z = -0.45;
    }

    if (d.life < 0.6) {
      d.group.position.y -= delta * 0.35;
    }

    if (d.life <= 0) {
      scene.remove(d.group);
      deadRagdolls.splice(i, 1);
    }
  }
}

const otherPlayers = new Map();

function createStickmanPlayerMesh(player) {
  const group = new THREE.Group();
  const isRed = player.team === 'red';
  const stickColor = isRed ? 0xef4444 : 0x3b82f6;
  const camoTexture = isRed ? redArmyCamoTexture : blueArmyCamoTexture;

  const stickSkinMat = new THREE.MeshStandardMaterial({
    color: stickColor,
    roughness: 0.3,
    metalness: 0.15,
    emissive: stickColor,
    emissiveIntensity: 0.2
  });

  const camoMat = new THREE.MeshStandardMaterial({ map: camoTexture, roughness: 0.7, metalness: 0.1 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: isRed ? 0x7f1d1d : 0x1e3a8a, roughness: 0.4, metalness: 0.5 });
  const gunBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.8 });
  const gunAccentMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.9 });

  const headGeo = new THREE.SphereGeometry(0.32, 20, 20);
  const headMesh = new THREE.Mesh(headGeo, stickSkinMat);
  headMesh.position.set(0, 1.6, 0);
  headMesh.castShadow = true;
  headMesh.userData = { playerId: player.id, part: 'head' };
  group.add(headMesh);

  const helmetGeo = new THREE.SphereGeometry(0.35, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
  helmetMesh.position.set(0, 1.63, 0);
  helmetMesh.castShadow = true;
  group.add(helmetMesh);

  const helmetBrimGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.05, 18);
  const helmetBrim = new THREE.Mesh(helmetBrimGeo, helmetMat);
  helmetBrim.position.set(0, 1.62, 0);
  group.add(helmetBrim);

  // BAGIAN WAJAH (Kacamata & Masker): Diputar 180 Derajat Menghadap Sisi Depan (+Z)
  const visorGoggleMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.3,
    metalness: 0.8
  });
  const visorLensMat = new THREE.MeshStandardMaterial({
    color: isRed ? 0xff2222 : 0x00f0ff,
    emissive: isRed ? 0xef4444 : 0x00d2ff,
    emissiveIntensity: 0.9,
    roughness: 0.1,
    metalness: 0.7
  });

  // Bingkai Goggles Wajah Depan
  const visorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.1), visorGoggleMat);
  visorFrame.position.set(0, 1.62, 0.26);
  group.add(visorFrame);

  // Kaca Visor Menyala (Menghadap Depan +Z)
  const visorLens = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.08, 0.04), visorLensMat);
  visorLens.position.set(0, 1.62, 0.31);
  group.add(visorLens);

  // Masker Taktis Wajah Depan
  const maskMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.14), visorGoggleMat);
  maskMesh.position.set(0, 1.46, 0.25);
  group.add(maskMesh);

  // BAGIAN BELAKANG HELM: Modul Hitam Bersih (Menghadap Belakang -Z)
  const helmetBackModule = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.07), visorGoggleMat);
  helmetBackModule.position.set(0, 1.62, -0.27);
  group.add(helmetBackModule);

  const torsoGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.75, 16);
  const torsoMesh = new THREE.Mesh(torsoGeo, camoMat);
  torsoMesh.position.set(0, 0.98, 0);
  torsoMesh.castShadow = true;
  torsoMesh.userData = { playerId: player.id, part: 'body' };
  group.add(torsoMesh);

  const vestGeo = new THREE.CylinderGeometry(0.165, 0.15, 0.45, 16);
  const vestMat = new THREE.MeshStandardMaterial({ color: isRed ? 0x450a0a : 0x0f172a, roughness: 0.6 });
  const vestMesh = new THREE.Mesh(vestGeo, vestMat);
  vestMesh.position.set(0, 1.05, 0);
  group.add(vestMesh);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.15, 0.6, 0);
  const legGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.62, 12);
  const leftLeg = new THREE.Mesh(legGeo, camoMat);
  leftLeg.position.set(0, -0.31, 0);
  leftLeg.castShadow = true;
  leftLeg.userData = { playerId: player.id, part: 'leg' };
  leftLegPivot.add(leftLeg);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.15, 0.6, 0);
  const rightLeg = new THREE.Mesh(legGeo, camoMat);
  rightLeg.position.set(0, -0.31, 0);
  rightLeg.castShadow = true;
  rightLeg.userData = { playerId: player.id, part: 'leg' };
  rightLegPivot.add(rightLeg);
  group.add(rightLegPivot);

  const weaponRig = new THREE.Group();
  weaponRig.position.set(0, 1.25, 0);

  const armGeo = new THREE.CylinderGeometry(0.05, 0.042, 0.52, 12);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.18, 0, 0);
  const leftArm = new THREE.Mesh(armGeo, camoMat);
  leftArm.position.set(0, -0.22, 0);
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  leftArmPivot.rotation.x = -1.25;
  leftArmPivot.rotation.y = 0.5;
  leftArmPivot.rotation.z = -0.15;
  weaponRig.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.18, 0, 0);
  const rightArm = new THREE.Mesh(armGeo, camoMat);
  rightArm.position.set(0, -0.22, 0);
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);
  rightArmPivot.rotation.x = -1.15;
  rightArmPivot.rotation.y = -0.18;
  rightArmPivot.rotation.z = 0.05;

  const rifleGroup = new THREE.Group();
  const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.65), gunBodyMat);
  const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), gunBodyMat);
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.set(0, 0.02, -0.45);
  const rifleMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.1), gunBodyMat);
  rifleMag.position.set(0, -0.12, -0.05);
  rifleMag.rotation.x = 0.2;
  const rifleSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.12), gunAccentMat);
  rifleSight.position.set(0, 0.08, -0.05);

  rifleGroup.add(rifleBody, rifleBarrel, rifleMag, rifleSight);
  rifleGroup.position.set(0.02, -0.25, -0.15);
  rifleGroup.rotation.x = 1.15;
  rifleGroup.rotation.y = Math.PI;
  rightArmPivot.add(rifleGroup);

  weaponRig.add(rightArmPivot);
  group.add(weaponRig);

  const canvasText = document.createElement('canvas');
  canvasText.width = 256;
  canvasText.height = 64;
  const ctx = canvasText.getContext('2d');
  ctx.fillStyle = isRed ? '#ef4444' : '#3b82f6';
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(player.username, 128, 45);

  const texture = new THREE.CanvasTexture(canvasText);
  const spriteMat = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(0, 2.25, 0);
  sprite.scale.set(1.9, 0.48, 1);
  group.add(sprite);

  group.position.set(player.x, player.y, player.z);
  scene.add(group);

  return {
    group,
    headMesh,
    bodyMesh: torsoMesh,
    legMesh: leftLeg,
    leftLegPivot,
    rightLegPivot,
    weaponRig,
    leftArmPivot,
    rightArmPivot,
    targetPos: new THREE.Vector3(player.x, player.y, player.z),
    targetYaw: player.yaw || 0,
    isMoving: false,
    animTime: Math.random() * 10
  };
}

let ws = null;

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'get_rooms' }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'room_list') {
      renderRoomsList(msg.rooms);
    }

    if (msg.type === 'error') {
      alert(msg.message);
      const landing = document.getElementById('landingModal');
      if (landing) landing.style.display = 'flex';
      return;
    }

    if (msg.type === 'room_lobby_update') {
      if (msg.selfId) selfId = msg.selfId;
      updateCustomLobbyUI(msg.room);
    }

    if (msg.type === 'match_started' || msg.type === 'init') {
      const customLobby = document.getElementById('customLobbyModal');
      const landingModal = document.getElementById('landingModal');
      if (customLobby) customLobby.style.display = 'none';
      if (landingModal) landingModal.style.display = 'none';

      if (msg.selfId) selfId = msg.selfId;
      if (msg.player) {
        selfTeam = msg.player.team;
        selfHealth = msg.player.health;
        playerPos.set(msg.player.x, msg.player.y, msg.player.z);
        yaw = msg.player.yaw;
        targetYaw = yaw;
        pitch = msg.player.pitch;
        targetPitch = pitch;
      } else {
        const me = msg.players.find(p => p.id === selfId);
        if (me) {
          selfTeam = me.team;
          selfHealth = me.health;
          playerPos.set(me.x, me.y, me.z);
          yaw = me.yaw;
          targetYaw = yaw;
          pitch = me.pitch;
          targetPitch = pitch;
        }
      }

      currentWinTargetLimit = (msg.room && msg.room.winTarget) ? msg.room.winTarget : (msg.winTarget || 40);
      isMatchEnded = false;
      latestScores = msg.scores || (msg.room && msg.room.scores) || { red: 0, blue: 0 };
      currentPlayersList = msg.players;

      const rId = (msg.room && msg.room.id) || msg.roomId || 'DEFAULT';
      const noBotFlag = (msg.room && msg.room.noBot) || msg.noBot;
      if (roomDisplayBadge) roomDisplayBadge.textContent = `ROOM: ${rId} [TARGET: ${currentWinTargetLimit} KILL]` + (noBotFlag ? ' [NO BOT]' : '');
      if (sbRoomTitle) sbRoomTitle.textContent = `ROOM: ${rId} (WIN TARGET: ${currentWinTargetLimit} KILL)` + (noBotFlag ? ' [NO BOT]' : '');

      buildMap(msg.boxes);
      updateScores(latestScores);
      updateHealthUI();
      updateAmmoUI();
      renderScoreboard();

      otherPlayers.forEach((val) => scene.remove(val.group));
      otherPlayers.clear();

      msg.players.forEach(p => {
        if (p.id !== selfId) {
          otherPlayers.set(p.id, createStickmanPlayerMesh(p));
        }
      });

      startMatchCountdown();

      try {
        canvas.requestPointerLock();
      } catch (e) {}
    }

    if (msg.type === 'sync') {
      currentPlayersList = msg.players;
      const currentServerIds = new Set(msg.players.map(p => p.id));

      otherPlayers.forEach((val, id) => {
        if (!currentServerIds.has(id)) {
          scene.remove(val.group);
          otherPlayers.delete(id);
        }
      });

      msg.players.forEach(p => {
        if (p.id === selfId) {
          if (otherPlayers.has(selfId)) {
            scene.remove(otherPlayers.get(selfId).group);
            otherPlayers.delete(selfId);
          }
          return;
        }

        if (otherPlayers.has(p.id)) {
          const remote = otherPlayers.get(p.id);
          remote.targetPos.set(p.x, p.y || 0, p.z);
          remote.targetYaw = p.yaw;
          remote.isMoving = !!p.isMoving;
          remote.isSprinting = !!p.isSprinting;
          remote.group.visible = !p.isDead;
        } else {
          const newPlayerMesh = createStickmanPlayerMesh(p);
          newPlayerMesh.isSprinting = !!p.isSprinting;
          otherPlayers.set(p.id, newPlayerMesh);
        }
      });

      if (scoreboardModal.style.display === 'flex') {
        renderScoreboard();
      }
    }

    if (msg.type === 'bullet_tracer') {
      if (msg.origin && msg.direction) {
        let spawnPos = msg.origin;
        if (msg.shooterId && otherPlayers.has(msg.shooterId)) {
          const shooter = otherPlayers.get(msg.shooterId);
          if (shooter && shooter.group) {
            spawnPos = {
              x: shooter.group.position.x,
              y: shooter.group.position.y + 1.25,
              z: shooter.group.position.z
            };
          }
        }
        spawnMuzzleFireFlash(spawnPos, msg.direction);
        playGunshotSound(spawnPos);
        createBulletTracer(spawnPos, msg.direction, 70);
      }
    }

    if (msg.type === 'hit_feedback') {
      showHitmarker(msg.part);
    }

    if (msg.type === 'health_update') {
      if (msg.id === selfId) {
        if (msg.health < selfHealth) {
          lastDamageTakenTime = performance.now();
        }
        selfHealth = msg.health;
        updateHealthUI();
        triggerDamageFlash();
      }
    }

    if (msg.type === 'match_win') {
      isMatchEnded = true;
      const winner = msg.winnerTeam;
      const isWinner = winner === selfTeam;

      if (vicTitle && vicSub && victoryModal) {
        vicTitle.textContent = isWinner ? 'VICTORY!' : 'DEFEAT!';
        vicTitle.style.color = isWinner ? '#ffd700' : '#ef4444';
        vicSub.textContent = `TIM ${winner.toUpperCase()} MENCAPAI ${msg.winTarget} KILL & MEMENANGKAN PERTANDINGAN!`;
        victoryModal.style.display = 'flex';
      }
    }

    if (msg.type === 'kill_log') {
      latestScores = msg.scores;
      currentPlayersList = msg.players;
      updateScores(msg.scores);
      renderScoreboard();

      displayKillLogCard(msg);

      let victimPos = { x: 0, z: 0 };
      let victimYaw = 0;
      if (msg.victimId === selfId) {
        victimPos = { x: playerPos.x, z: playerPos.z };
        victimYaw = yaw;
        isDead = true;
        isPlayingDeathPOV = true;
        deathAnimationProgress = 0;

        // Sembunyikan senjata POV saat mati
        gunGroup.visible = false;
        crosshair.style.display = 'none';
        holoScope.style.display = 'none';

        startRespawnCountdown();
      } else if (otherPlayers.has(msg.victimId)) {
        const victimObj = otherPlayers.get(msg.victimId);
        victimPos = { x: victimObj.group.position.x, z: victimObj.group.position.z };
        victimYaw = victimObj.group.rotation.y;
      }

      spawnDeadRagdoll(msg, victimPos, victimYaw);
      spawnAmmoBox(victimPos);
    }

    if (msg.type === 'player_respawn') {
      if (msg.player.id === selfId) {
        isDead = false;
        isPlayingDeathPOV = false;
        deathAnimationProgress = 0;
        selfHealth = 100;
        currentClip = MAG_SIZE;
        reserveAmmo = 90;
        isReloading = false;
        isAiming = false;

        // Munculkan kembali senjata POV saat respawn
        gunGroup.visible = true;
        gunGroup.position.set(0.28, -0.24, -0.55);
        gunGroup.rotation.set(0, 0, 0);

        playerPos.set(msg.player.x, msg.player.y, msg.player.z);
        yaw = msg.player.yaw;
        targetYaw = yaw;
        pitch = 0;
        targetPitch = 0;
        deathScreen.style.display = 'none';
        updateHealthUI();
        updateAmmoUI();
      }
    }

    if (msg.type === 'feed') {
      addFeedNotice(msg.text);
    }
  };
}

const raycaster = new THREE.Raycaster();

function shootWeapon() {
  const now = performance.now();
  if (now - lastShotTime < FIRE_RATE || isReloading || isDead || !isPointerLocked || isMatchEnded || isSprinting) return;
  if (currentClip <= 0) {
    reloadWeapon();
    return;
  }

  currentClip--;
  lastShotTime = now;
  continuousShots++;
  updateAmmoUI();
  playGunshotSound();

  ejectBulletShell();
  if (muzzleFlashMesh) {
    muzzleFlashMesh.material.opacity = 1;
    setTimeout(() => { if (muzzleFlashMesh) muzzleFlashMesh.material.opacity = 0; }, 35);
  }

  // Status akurasi & recoil berdasarkan posisi gerak pemain
  const inAir = !isGrounded;
  const isMoving = isPlayerMoving && canMove;

  // Recoil Damping (Kamera & Hentakan Senjata Mantap & Berbobot)
  let recoilDamping = 1.0;
  if (isCrouched && !isMoving) {
    recoilDamping = 0.22; // Jongkok diam: Sangat stabil & recoil minimal
  } else if (isAiming && !isMoving) {
    recoilDamping = 0.35; // Aim diam: Stabil presisi
  } else if (isMoving) {
    recoilDamping = isCrouched ? 1.15 : 1.65; // Bergerak/jalan: Hentakan terasa
  }
  if (inAir) recoilDamping *= 2.0;

  recoilOffsetZ = isAiming ? 0.03 : (isCrouched ? 0.04 : 0.075);

  const kickUp = (0.006 + Math.min(continuousShots * 0.0012, 0.018)) * recoilDamping;
  const kickSide = ((Math.random() - 0.5) * (isMoving ? 0.018 : 0.0035)) * recoilDamping;
  recoilPitchKick += kickUp;
  recoilYawKick += kickSide;

  // Base Bloom & Spread (Akurasi Tinggi saat Jongkok/Aim, Menyebar saat Bergerak)
  let baseBloom = 0.0006;
  let bloomGrowth = 0.0005;
  let maxBloom = 0.007;

  if (isCrouched && !isMoving) {
    baseBloom = 0.0001;
    bloomGrowth = 0.00015;
    maxBloom = 0.0022;
  } else if (isAiming && !isMoving) {
    baseBloom = 0.00018;
    bloomGrowth = 0.00022;
    maxBloom = 0.003;
  } else if (isMoving) {
    baseBloom = isCrouched ? 0.02 : 0.038;
    bloomGrowth = 0.003;
    maxBloom = 0.075;
  }

  if (inAir) {
    baseBloom = 0.06;
    maxBloom = 0.10;
  }

  const bloom = Math.min(baseBloom + continuousShots * bloomGrowth, maxBloom);
  const spreadAngle = Math.random() * Math.PI * 2;
  const spreadDist = Math.random() * bloom;
  const spreadX = Math.cos(spreadAngle) * spreadDist;
  const spreadY = Math.sin(spreadAngle) * spreadDist;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y += spreadY;
  dir.x += spreadX;
  dir.normalize();

  const origin = camera.position.clone();

  raycaster.set(origin, dir);
  raycaster.far = 130;

  const hitTargets = [];
  otherPlayers.forEach(p => {
    if (p.group.visible) {
      hitTargets.push(p.headMesh, p.bodyMesh, p.legMesh);
    }
  });

  const surfaceTargets = mapBoxMeshes.slice();
  if (floorMesh) surfaceTargets.push(floorMesh);
  const allIntersectTargets = hitTargets.concat(surfaceTargets);
  const intersects = raycaster.intersectObjects(allIntersectTargets, false);

  let targetHitDistance = 70;
  if (intersects.length > 0) {
    const firstHit = intersects[0];
    targetHitDistance = firstHit.distance;
    const hitObj = firstHit.object;

    if (hitObj.userData && hitObj.userData.playerId) {
      const { playerId, part } = hitObj.userData;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'hit',
          targetId: playerId,
          part
        }));
      }
    } else {
      if (firstHit.point && firstHit.face) {
        const worldNormal = firstHit.face.normal.clone().applyQuaternion(hitObj.quaternion);
        spawnBulletHole(firstHit.point, worldNormal);
      }
    }
  }

  // Posisi moncong senjata di koordinat dunia untuk tracer lokal
  const nozzleWorldPos = new THREE.Vector3();
  if (muzzleFlashMesh) {
    muzzleFlashMesh.getWorldPosition(nozzleWorldPos);
  } else {
    nozzleWorldPos.copy(origin);
  }

  // Tampilkan animasi peluru melesat bercahaya api untuk tembakan sendiri
  spawnMuzzleFireFlash(nozzleWorldPos, dir);
  createBulletTracer(nozzleWorldPos, dir, targetHitDistance);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'shoot',
      origin: { x: nozzleWorldPos.x, y: nozzleWorldPos.y, z: nozzleWorldPos.z },
      direction: { x: dir.x, y: dir.y, z: dir.z }
    }));
  }
}

function reloadWeapon() {
  if (isReloading || currentClip === MAG_SIZE || reserveAmmo <= 0 || isMatchEnded) return;
  isReloading = true;
  reloadStartTime = performance.now();
  ammoVal.textContent = 'RELOADING...';
  
  // Putar suara mekanikal reload 3 tahap (cabut mag, pasang mag, kokang)
  playReloadSound();

  setTimeout(() => {
    const needed = MAG_SIZE - currentClip;
    const toLoad = Math.min(needed, reserveAmmo);
    currentClip += toLoad;
    reserveAmmo -= toLoad;
    isReloading = false;
    updateAmmoUI();
  }, RELOAD_DURATION);
}

function showHitmarker(part) {
  playHitSound();
  hitmarker.style.opacity = '1';
  hitmarker.style.transform = 'translate(-50%, -50%) scale(1.35)';
  const color = part === 'head' ? '#ef4444' : '#ffd700';
  document.querySelectorAll('.hm-line').forEach(el => el.style.background = color);

  setTimeout(() => {
    hitmarker.style.opacity = '0';
    hitmarker.style.transform = 'translate(-50%, -50%) scale(0.8)';
  }, 130);
}

function triggerDamageFlash() {
  damageFlash.style.opacity = '1';
  setTimeout(() => damageFlash.style.opacity = '0', 160);
}

function updateHealthUI() {
  const displayHp = Math.round(selfHealth);
  healthVal.textContent = displayHp;
  if (displayHp <= 25) healthVal.style.color = '#ef4444';
  else if (displayHp <= 50) healthVal.style.color = '#f59e0b';
  else healthVal.style.color = '#ffd700';
}

function updateAmmoUI() {
  if (!isReloading) {
    ammoVal.textContent = `${currentClip} / ${reserveAmmo}`;
  }
}

function updateScores(scores) {
  scoreRed.textContent = `RED: ${scores.red}`;
  scoreBlue.textContent = `BLUE: ${scores.blue}`;
  if (sbScoreRed) sbScoreRed.textContent = `${scores.red} / ${currentWinTargetLimit}`;
  if (sbScoreBlue) sbScoreBlue.textContent = `${scores.blue} / ${currentWinTargetLimit}`;
}

function displayKillLogCard(data) {
  const card = document.createElement('div');
  card.className = 'kill-log-card';

  if (data.killerId === selfId) card.classList.add('self-kill');
  if (data.victimId === selfId) card.classList.add('self-victim');

  const killerTeamClass = data.killerTeam === 'red' ? 'team-txt-red' : 'team-txt-blue';
  const victimTeamClass = data.victimTeam === 'red' ? 'team-txt-red' : 'team-txt-blue';

  let assistHtml = '';
  if (data.assisterName) {
    assistHtml = `<span class="assist-txt">+ ${data.assisterName}</span>`;
  }

  const headshotBadgeHtml = data.isHeadshot ? `<span class="headshot-badge">🎯 HEADSHOT</span>` : '';

  card.innerHTML = `
    <span class="${killerTeamClass}">${data.killerName}</span>
    ${assistHtml}
    <span class="gun-icon">🔫</span>
    ${headshotBadgeHtml}
    <span class="${victimTeamClass}">${data.victimName}</span>
  `;

  killFeed.appendChild(card);

  setTimeout(() => {
    card.style.opacity = '0';
    card.style.transform = 'translateX(50px) scale(0.9)';
    setTimeout(() => {
      if (card.parentNode) card.parentNode.removeChild(card);
    }, 300);
  }, 4500);
}

function addFeedNotice(text) {
  const item = document.createElement('div');
  item.className = 'kill-log-card';
  item.style.fontSize = '12px';
  item.style.color = '#ffd700';
  item.textContent = text;
  killFeed.appendChild(item);
  setTimeout(() => {
    if (item.parentNode) item.parentNode.removeChild(item);
  }, 3500);
}

function renderScoreboard() {
  if (!currentPlayersList.length) return;

  const redPlayers = currentPlayersList.filter(p => p.team === 'red').sort((a, b) => b.kills - a.kills);
  const bluePlayers = currentPlayersList.filter(p => p.team === 'blue').sort((a, b) => b.kills - a.kills);

  const rowHtml = (p) => {
    const isSelf = p.id === selfId;
    return `
      <tr class="${isSelf ? 'sb-self-row' : ''}">
        <td>${p.username} ${isSelf ? '(YOU)' : ''}</td>
        <td>${p.kills || 0}</td>
        <td>${p.deaths || 0}</td>
        <td>${p.assists || 0}</td>
      </tr>
    `;
  };

  sbBodyRed.innerHTML = redPlayers.map(rowHtml).join('') || '<tr><td colspan="4" style="text-align:center; color:#ffd700;">Belum ada pemain</td></tr>';
  sbBodyBlue.innerHTML = bluePlayers.map(rowHtml).join('') || '<tr><td colspan="4" style="text-align:center; color:#ffd700;">Belum ada pemain</td></tr>';
}

window.addEventListener('beforeunload', (e) => {
  if (isPointerLocked) {
    e.preventDefault();
    e.returnValue = '';
  }
});

canvas.addEventListener('click', () => {
  const landing = document.getElementById('landingModal');
  const customLobby = document.getElementById('customLobbyModal');
  const pause = document.getElementById('pauseMenuModal');

  const inMenu = (landing && landing.style.display !== 'none') ||
                 (customLobby && customLobby.style.display !== 'none') ||
                 (pause && pause.style.display !== 'none');

  if (!isPointerLocked && !isDead && !inMenu && !isMatchEnded) {
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === canvas;
  if (isPointerLocked) {
    crosshair.style.display = 'block';
    hud.style.display = 'block';
    if (pauseMenuModal) pauseMenuModal.style.display = 'none';
  } else {
    crosshair.style.display = 'none';
    const landing = document.getElementById('landingModal');
    const customLobby = document.getElementById('customLobbyModal');
    const inMenu = (landing && landing.style.display !== 'none') || (customLobby && customLobby.style.display !== 'none');

    if (!inMenu && !isDead && !isMatchEnded) {
      if (pauseMenuModal) pauseMenuModal.style.display = 'flex';
    }
  }
});

document.addEventListener('mousemove', (e) => {
  if (!isPointerLocked || isDead || isMatchEnded) return;
  targetYaw -= e.movementX * mouseSensitivity;
  targetPitch -= e.movementY * mouseSensitivity;
  targetPitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, targetPitch));
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('mousedown', (e) => {
  const landing = document.getElementById('landingModal');
  const customLobby = document.getElementById('customLobbyModal');
  const pause = document.getElementById('pauseMenuModal');

  if ((landing && landing.style.display !== 'none') ||
      (customLobby && customLobby.style.display !== 'none') ||
      (pause && pause.style.display !== 'none')) return;

  if (e.button === 0) {
    isMouseDown = true;
    shootWeapon();
  } else if (e.button === 2) {
    if (!isDead && isPointerLocked && !isMatchEnded) {
      isAiming = !isAiming;
    }
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    isMouseDown = false;
    continuousShots = 0;
  }
});

// Global ESC Handler for Pause Menu (Bisa diakses oleh semua pemain)
function togglePauseMenu() {
  const landing = document.getElementById('landingModal');
  const customLobby = document.getElementById('customLobbyModal');
  const pause = document.getElementById('pauseMenuModal');

  // Jangan buka jika masih di halaman login / custom lobby room
  if ((landing && landing.style.display !== 'none') || (customLobby && customLobby.style.display !== 'none')) return;

  if (pause) {
    if (pause.style.display === 'flex') {
      pause.style.display = 'none';
      if (!isDead && !isMatchEnded) {
        canvas.requestPointerLock();
      }
    } else {
      pause.style.display = 'flex';
      try {
        document.exitPointerLock();
      } catch (e) {}
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    e.preventDefault();
    togglePauseMenu();
    return;
  }

  const landing = document.getElementById('landingModal');
  const customLobby = document.getElementById('customLobbyModal');
  if ((landing && landing.style.display !== 'none') || (customLobby && customLobby.style.display !== 'none')) return;

  if (e.code === 'Tab') {
    e.preventDefault();
    keys.Tab = true;
    scoreboardModal.style.display = 'flex';
    renderScoreboard();
    return;
  }

  if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
  if (e.code === 'KeyR') reloadWeapon();
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    keys.Tab = false;
    scoreboardModal.style.display = 'none';
    return;
  }
  if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

function checkCollision(newX, newZ) {
  for (const b of mapBoxesData) {
    if (b.type === 'base_red_floor' || b.type === 'base_blue_floor') continue;

    if (b.type === 'one_way_wall_red') {
      if (playerPos.z >= -21.0 && newZ < -21.0) return true;
      continue;
    }

    if (b.type === 'one_way_wall_blue') {
      if (playerPos.z <= 21.0 && newZ > 21.0) return true;
      continue;
    }

    const minX = b.x - b.w / 2 - PLAYER_RADIUS;
    const maxX = b.x + b.w / 2 + PLAYER_RADIUS;
    const minZ = b.z - b.d / 2 - PLAYER_RADIUS;
    const maxZ = b.z + b.d / 2 + PLAYER_RADIUS;

    if (newX > minX && newX < maxX && newZ > minZ && newZ < maxZ) {
      const boxBottom = b.y - b.h / 2;
      const boxTop = b.y + b.h / 2;
      const playerFeet = playerPos.y;
      const playerHead = playerPos.y + currentCameraHeight;
      if (playerHead > boxBottom && playerFeet < boxTop) {
        return true;
      }
    }
  }
  return false;
}

// Death Respawn Countdown Timer (Animasi POV jatuh dramatis sebelum layar eliminate 3s muncul)
let deathCountdownTimer = null;
function startRespawnCountdown() {
  if (deathCountdownTimer) clearInterval(deathCountdownTimer);

  deathScreen.style.display = 'none';

  // Jeda 0.85s untuk membiarkan kamera POV jatuh miring ke lantai terlebih dahulu
  setTimeout(() => {
    if (isDead) {
      let secondsLeft = 3;
      deathScreen.style.display = 'flex';
      deathScreen.innerHTML = `ELIMINATED<span id="deathTimerTxt">Respawn dalam ${secondsLeft} detik...</span>`;

      deathCountdownTimer = setInterval(() => {
        secondsLeft--;
        const timerTxt = document.getElementById('deathTimerTxt');
        if (timerTxt && secondsLeft > 0) {
          timerTxt.textContent = `Respawn dalam ${secondsLeft} detik...`;
        } else {
          clearInterval(deathCountdownTimer);
        }
      }, 1000);
    }
  }, 850);
}

let lastTime = performance.now();

function updatePhysics(delta) {
  // Animasi Third Person Death Cam (Kamera mundur & naik melihat mayat terbaring di lantai)
  if (isDead) {
    if (isPlayingDeathPOV) {
      deathAnimationProgress = Math.min(deathAnimationProgress + delta * 1.8, 1.0);
      const ease = 1 - Math.pow(1 - deathAnimationProgress, 3);
      
      const camDist = 1.0 + ease * 2.8;
      const camHeight = NORMAL_HEIGHT * (1 - ease) + 2.2 * ease;
      const behindX = playerPos.x - Math.sin(yaw) * camDist;
      const behindZ = playerPos.z - Math.cos(yaw) * camDist;

      camera.position.set(behindX, playerPos.y + camHeight, behindZ);
      camera.lookAt(playerPos.x, playerPos.y + 0.2, playerPos.z);
    }
    return;
  }

  if (isMatchEnded) return;

  const moveDir = new THREE.Vector3();
  if (canMove) {
    if (keys.KeyW) moveDir.z -= 1;
    if (keys.KeyS) moveDir.z += 1;
    if (keys.KeyA) moveDir.x -= 1;
    if (keys.KeyD) moveDir.x += 1;
  }
  const isMoving = moveDir.lengthSq() > 0;
  isPlayerMoving = isMoving;
  moveDir.normalize();

  isCrouched = keys.KeyC;
  isSprinting = keys.ShiftLeft && !isCrouched && isMoving && !isReloading;
  if (isSprinting && isAiming) {
    isAiming = false; // Batal bidik saat sprint lari
  }

  const targetSprint = isSprinting ? 1.0 : 0.0;
  sprintProgress += (targetSprint - sprintProgress) * 0.22;

  const targetAim = isAiming && !isReloading && !isSprinting ? 1.0 : 0.0;
  aimProgress += (targetAim - aimProgress) * 0.42;

  camera.fov = 75 - (aimProgress * 27) + (sprintProgress * 7);
  camera.updateProjectionMatrix();

  const hipX = 0.28, hipY = -0.24, hipZ = -0.55;
  const adsX = 0.0, adsY = -0.15, adsZ = -0.42;
  
  if (isSprinting) {
    sprintBobTimer += delta * 15;
  }
  const sprintBobX = Math.cos(sprintBobTimer * 0.5) * 0.035 * sprintProgress;
  const sprintBobY = Math.abs(Math.sin(sprintBobTimer)) * 0.035 * sprintProgress;

  const currentGunX = hipX * (1 - sprintProgress) + 0.16 * sprintProgress + (adsX - hipX) * aimProgress + sprintBobX;
  const currentGunY = hipY * (1 - sprintProgress) + (-0.56) * sprintProgress + (adsY - hipY) * aimProgress + sprintBobY;
  const currentGunZ = hipZ * (1 - sprintProgress) + (-0.46) * sprintProgress + (adsZ - hipZ) * aimProgress;

  const gunRotX = (-0.45) * sprintProgress;
  const gunRotY = (-0.22) * sprintProgress;
  const gunRotZ = (0.35) * sprintProgress + Math.sin(sprintBobTimer * 0.5) * 0.08 * sprintProgress;

  if (isPointerLocked) {
    if (sprintProgress > 0.4) {
      crosshair.style.display = 'none';
      holoScope.style.display = 'none';
    } else if (aimProgress > 0.6) {
      crosshair.style.display = 'none';
      holoScope.style.display = 'flex';
      holoScope.style.opacity = ((aimProgress - 0.6) / 0.4).toFixed(2);
    } else {
      crosshair.style.display = 'block';
      holoScope.style.display = 'none';

      // Dinamis crosshair mekar saat bergerak / rapat saat jongkok diam
      const chTop = document.querySelector('.ch-top');
      const chBottom = document.querySelector('.ch-bottom');
      const chLeft = document.querySelector('.ch-left');
      const chRight = document.querySelector('.ch-right');
      if (chTop && chBottom && chLeft && chRight) {
        const isMoving = isPlayerMoving && canMove;
        let gap = 5;
        if (isCrouched && !isMoving) {
          gap = 2;
        } else if (!isMoving) {
          gap = 4 + Math.min(continuousShots * 1.2, 8);
        } else {
          gap = 12 + Math.min(continuousShots * 2.0, 14);
        }
        chTop.style.transform = `translateY(-${gap}px)`;
        chBottom.style.transform = `translateY(${gap}px)`;
        chLeft.style.transform = `translateX(-${gap}px)`;
        chRight.style.transform = `translateX(${gap}px)`;
      }
    }
  }

  const currentSensFactor = isAiming ? 0.65 : 1.0;
  yaw += (targetYaw - yaw) * 0.85 * currentSensFactor;
  pitch += (targetPitch - pitch) * 0.85 * currentSensFactor;

  const targetCamHeight = isCrouched ? CROUCH_HEIGHT : NORMAL_HEIGHT;
  currentCameraHeight += (targetCamHeight - currentCameraHeight) * 0.2;

  let speed = isAiming ? 5.5 : (isCrouched ? 3.8 : (isSprinting ? 12.15 : 8.5));

  moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

  const moveX = moveDir.x * speed * delta;
  const moveZ = moveDir.z * speed * delta;

  if (moveX !== 0 && !checkCollision(playerPos.x + moveX, playerPos.z)) {
    playerPos.x += moveX;
  }
  if (moveZ !== 0 && !checkCollision(playerPos.x, playerPos.z + moveZ)) {
    playerPos.z += moveZ;
  }

  // Suara Footstep Pemain Sendiri (Irama lebih cepat saat sprint)
  if (isMoving && isGrounded && !isCrouched) {
    localStepTimer += delta * (isSprinting ? 20 : 12);
    if (localStepTimer > 3.6) {
      localStepTimer = 0;
      playFootstepSound();
    }
  } else {
    localStepTimer = 3.0;
  }

  // Jump & Landing Sound
  if (keys.Space && isGrounded && !isCrouched && canMove) {
    playerVel.y = 7.5;
    isGrounded = false;
  }

  const wasGroundedBefore = isGrounded;
  playerVel.y -= 22 * delta;
  playerPos.y += playerVel.y * delta;

  if (playerPos.y <= 0) {
    playerPos.y = 0;
    playerVel.y = 0;
    isGrounded = true;

    if (!wasGroundedBefore) {
      playJumpLandSound();
    }
  }

  if (!isMouseDown) {
    recoilPitchKick *= 0.80;
    recoilYawKick *= 0.80;
  }

  camera.position.set(playerPos.x, playerPos.y + currentCameraHeight, playerPos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw + recoilYawKick;
  camera.rotation.x = pitch + recoilPitchKick;
  camera.rotation.z = 0;

  recoilOffsetZ *= 0.82;
  gunGroup.position.set(currentGunX, currentGunY, currentGunZ + recoilOffsetZ);
  if (!isReloading) {
    gunGroup.rotation.set(gunRotX, gunRotY, gunRotZ);
  }

  if (ws && ws.readyState === WebSocket.OPEN && selfId) {
    ws.send(JSON.stringify({
      type: 'move',
      x: playerPos.x,
      y: playerPos.y,
      z: playerPos.z,
      yaw,
      pitch,
      isCrouched,
      isMoving,
      isSprinting
    }));
  }
}

function updateShells(delta) {
  for (let i = ejectedShells.length - 1; i >= 0; i--) {
    const s = ejectedShells[i];
    s.userData.life -= delta;
    if (s.userData.life <= 0) {
      scene.remove(s);
      s.geometry.dispose();
      ejectedShells.splice(i, 1);
      continue;
    }
    s.userData.vel.y -= 15 * delta;
    s.position.addScaledVector(s.userData.vel, delta);
    s.rotation.x += s.userData.rotVel.x * delta;
    s.rotation.y += s.userData.rotVel.y * delta;

    if (s.position.y < 0.02) {
      s.position.y = 0.02;
      s.userData.vel.y = -s.userData.vel.y * 0.3;
      s.userData.vel.x *= 0.6;
      s.userData.vel.z *= 0.6;
    }
  }
}

function updateRemotePlayers(delta) {
  otherPlayers.forEach((p, id) => {
    if (id === selfId) {
      p.group.visible = false;
      return;
    }

    const prevX = p.group.position.x;
    const prevZ = p.group.position.z;

    p.group.position.x += (p.targetPos.x - p.group.position.x) * 0.3;
    p.group.position.y = 0;
    p.group.position.z += (p.targetPos.z - p.group.position.z) * 0.3;
    
    p.group.rotation.order = 'YXZ';
    p.group.rotation.y = p.targetYaw;

    const dX = p.group.position.x - prevX;
    const dZ = p.group.position.z - prevZ;
    const isMovingActual = p.isMoving || (dX * dX + dZ * dZ) > 0.0001;
    const isSprint = p.isSprinting && isMovingActual;

    // Pose condong / nunduk ke depan saat sedang berlari sprint
    const targetTilt = isSprint ? 0.32 : 0;
    p.group.rotation.x += (targetTilt - p.group.rotation.x) * 0.2;

    // Putar suara langkah kaki stereo 3D musuh & teman saat bergerak / lari
    if (isMovingActual && p.group.visible) {
      const animSpeed = isSprint ? 22 : 13;
      const legAngleMax = isSprint ? 1.05 : 0.72;
      p.animTime += delta * animSpeed;
      const legAngle = Math.sin(p.animTime) * legAngleMax;
      p.leftLegPivot.rotation.x = legAngle;
      p.rightLegPivot.rotation.x = -legAngle;

      p.stepAccum = (p.stepAccum || 0) + delta * animSpeed;
      if (p.stepAccum > 3.2) {
        p.stepAccum = 0;
        playFootstepSound(p.group.position);
      }

      if (p.weaponRig) {
        p.weaponRig.position.y = 1.25 + Math.abs(Math.sin(p.animTime * 2)) * (isSprint ? 0.06 : 0.035);
        p.weaponRig.rotation.x = isSprint ? 0.5 : 0;
        p.weaponRig.rotation.z = Math.sin(p.animTime) * (isSprint ? 0.12 : 0.035);
      }
      if (p.leftArmPivot && p.rightArmPivot) {
        p.leftArmPivot.rotation.x = (isSprint ? -0.8 : -1.25) + Math.sin(p.animTime) * 0.15;
        p.rightArmPivot.rotation.x = (isSprint ? -0.7 : -1.15) + Math.cos(p.animTime) * 0.15;
      }
    } else {
      p.group.rotation.x = 0;
      p.leftLegPivot.rotation.x = 0;
      p.rightLegPivot.rotation.x = 0;
      p.stepAccum = 2.8;
      if (p.weaponRig) {
        p.weaponRig.position.y = 1.25;
        p.weaponRig.rotation.x = 0;
        p.weaponRig.rotation.z = 0;
      }
      if (p.leftArmPivot && p.rightArmPivot) {
        p.leftArmPivot.rotation.x = -1.25;
        p.rightArmPivot.rotation.x = -1.15;
      }
    }
  });
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (isMouseDown && isPointerLocked && !isDead && !isReloading && canMove) {
    shootWeapon();
  }

  updatePhysics(delta);
  updateHealthRegen(delta, now);
  updateReloadAnimation(now);
  updateShells(delta);
  updateBulletProjectiles(delta);
  updateAmmoPickups(delta);
  updateDeadRagdolls(delta);
  updateRemotePlayers(delta);

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
});
