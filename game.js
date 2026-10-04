"use strict";
// ===== EASY SETTINGS (change these!) =====
const GAME_WIDTH = 320, GAME_HEIGHT = 180;
const PLAYER_SPEED = 95, PLAYER_JUMP_FORCE = 315, PLAYER_MAX_HEALTH = 3, PLAYER_ATTACK_COOLDOWN = 0.35;
const ENEMY_SPEED = 30, MASTER_VOLUME = 0.3, DEBUG_MODE = false;
const GRAVITY = 900;

const cv = document.getElementById("c"), ctx = cv.getContext("2d");
ctx.imageSmoothingEnabled = false;

// ===== SAVE (localStorage is optional) =====
let save = { mute: false, best: 1, coins: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem("tkq") || "{}")); } catch (e) { console.warn("no save", e); }
function store() { try { localStorage.setItem("tkq", JSON.stringify(save)); } catch (e) {} }
const sndBtn = document.getElementById("snd");
function setMute(m) { save.mute = m; store(); sndBtn.textContent = "Sound: " + (m ? "OFF" : "ON") + " (M)"; }
sndBtn.onclick = () => { setMute(!save.mute); sndBtn.blur(); };
setMute(save.mute);

// ===== AUDIO (retro beeps made with Web Audio, no files needed) =====
let AC = null;
function beep(f, d, type, v, slide) {
  if (save.mute) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type || "square"; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(MASTER_VOLUME * (v || 1) * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
  } catch (e) { console.warn("audio failed", e); }
}
const SFX = {
  jump: () => beep(280, .15, "square", .6, 300), sword: () => beep(200, .1, "sawtooth", .5, -80),
  hit: () => beep(150, .12, "square", .8, -60), coin: () => { beep(880, .08); setTimeout(() => beep(1320, .12), 70); },
  hurt: () => beep(220, .3, "sawtooth", 1, -150), die: () => beep(300, .8, "triangle", 1, -250),
  cp: () => { beep(520, .1); setTimeout(() => beep(780, .2), 100); }, boss: () => beep(110, .25, "square", 1, -40),
  boom: () => beep(80, .3, "sawtooth", 1, -30),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .2, "triangle"), i * 140))
};

// ===== INPUT =====
const keys = {}, press = {};
addEventListener("keydown", e => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) press[e.code] = true;
  keys[e.code] = true;
  if (e.code === "KeyM") setMute(!save.mute);
});
addEventListener("keyup", e => { keys[e.code] = false; });
const down = (...c) => c.some(k => keys[k]), hit = (...c) => c.some(k => press[k]);
const JUMPK = ["Space", "KeyW", "ArrowUp"];

// ===== LEVEL DATA =====
// plat [x,y,w,h]  mov [x,y,w,axis,range,speed]  col [x,y,w] (collapsing)  spikes/fire [x,y,w]
// en [type,x,y]  coins [x,y]  cps [x]  rocks [x]  sw [x,y,w,h]  gate [x,y,w,h]  hints [x,text]
const G = (a, b) => [a, 150, b - a, 30]; // ground from x=a to x=b
const LEVELS = [
  { name: "LEVEL 1 - THE JOURNEY BEGINS", w: 1400, sky: [[110, 190, 250], [200, 235, 255]], far: [130, 205, 160], near: [80, 165, 100], pt: [90, 190, 70], pb: [130, 90, 60], clouds: 1,
    plat: [G(0, 300), G(340, 700), G(740, 1000), G(1030, 1400), [200, 112, 40, 8], [430, 108, 48, 8], [560, 88, 48, 8], [860, 108, 48, 8]],
    en: [["slime", 520, 100], ["slime", 880, 100], ["slime", 1150, 100]],
    coins: [[100, 130], [115, 125], [130, 130], [210, 98], [225, 98], [320, 120], [440, 92], [570, 72], [720, 120], [870, 92], [1100, 130], [1115, 130], [1130, 130]],
    cps: [760], goal: 1350, hints: [[60, "A/D MOVE   SPACE JUMP"], [330, "JUMP THE GAP"], [480, "J = SWORD"], [1250, "THE CASTLE AWAITS"]],
    story: ["The castle lies beyond the forest..."] },
  { name: "LEVEL 2 - WHISPERING WOODS", w: 1900, sky: [[70, 150, 90], [140, 205, 140]], sky2: [[8, 14, 40], [25, 40, 70]], far: [30, 80, 55], near: [20, 60, 40], pt: [50, 130, 60], pb: [70, 50, 40], stars: 1,
    plat: [G(0, 260), G(320, 600), G(680, 900), G(980, 1250), G(1330, 1600), G(1680, 1900), [278, 126, 24, 8], [628, 126, 24, 8], [928, 126, 24, 8], [1278, 126, 24, 8], [1628, 126, 24, 8], [440, 105, 50, 8], [1100, 100, 50, 8]],
    spikes: [[450, 144, 24], [1120, 144, 24]],
    en: [["slime", 380, 100], ["goblin", 760, 100], ["bat", 520, 95], ["goblin", 1060, 100], ["bat", 1180, 90], ["goblin", 1420, 100], ["slime", 1520, 100], ["bat", 1750, 100]],
    coins: [[290, 112], [450, 90], [470, 90], [640, 110], [760, 130], [940, 110], [1110, 85], [1130, 85], [1290, 110], [1450, 130], [1640, 110], [1760, 130]],
    cps: [700, 1400], goal: 1860, story: ["Among the trees, a torn scrap of royal cloak...", "The Queen is alive!"] },
  { name: "LEVEL 3 - FORGOTTEN RUINS", w: 2000, sky: [[70, 70, 100], [150, 130, 150]], far: [90, 90, 120], near: [70, 70, 95], pt: [150, 150, 160], pb: [100, 100, 115], bricks: 1,
    plat: [G(0, 300), G(480, 800), G(1000, 1700), G(1760, 2000), [1718, 126, 24, 8], [1560, 108, 50, 8]],
    mov: [[310, 126, 32, "x", 100, 1.3]], col: [[812, 140, 28], [862, 140, 28], [912, 140, 28], [962, 140, 28]],
    spikes: [[1080, 144, 30], [1830, 144, 30]], sw: [1230, 146, 14, 4], gate: [1500, 60, 12, 90],
    en: [["slime", 600, 100], ["bat", 700, 90], ["slime", 1100, 100], ["goblin", 1350, 100], ["goblin", 1620, 100], ["bat", 1900, 95]],
    coins: [[320, 112], [380, 112], [826, 126], [876, 126], [926, 126], [976, 126], [1090, 120], [1250, 130], [1570, 92], [1730, 110], [1900, 130]],
    cps: [520, 1050], hints: [[1150, "STEP ON THE SWITCH"], [1860, "SHE FOUGHT HER WAY TOWARD THE TOWER"]], goal: 1960,
    story: ["She fought her way toward the tower."] },
  { name: "LEVEL 4 - THE DUNGEON", w: 2300, sky: [[15, 10, 25], [40, 25, 50]], far: [45, 32, 65], near: [32, 26, 48], pt: [120, 110, 130], pb: [70, 60, 80], bricks: 1,
    plat: [G(0, 360), G(430, 760), G(830, 1150), G(1220, 1600), G(1670, 2300), [383, 126, 24, 8], [783, 126, 24, 8], [1173, 126, 24, 8], [1623, 126, 24, 8], [560, 105, 40, 8], [1000, 100, 40, 8], [1380, 105, 40, 8]],
    fire: [[520, 142, 20], [950, 142, 24], [1330, 142, 20], [1440, 142, 16]], rocks: [620, 1060, 1500, 1900], spikes: [[1760, 144, 30]],
    sw: [1700, 146, 14, 4], gate: [2050, 60, 12, 90],
    en: [["goblin", 480, 100], ["bat", 700, 90], ["goblin", 900, 100], ["slime", 1010, 100], ["goblin", 1300, 100], ["goblin", 1400, 100], ["bat", 1500, 85], ["goblin", 1850, 100], ["slime", 1950, 100], ["goblin", 2150, 100]],
    coins: [[570, 90], [590, 90], [1010, 85], [1390, 90], [1200, 110], [1790, 120], [2000, 130], [2100, 130]],
    cps: [850, 1700], goal: 2250, hints: [[1650, "THE GATE NEEDS A SWITCH"]], story: ["Through a window... the tower rises ahead.", "The Queen is near."] },
  { name: "LEVEL 5 - THE TOWER", w: 800, sky: [[30, 20, 50], [90, 50, 90]], sky2: [[240, 120, 90], [120, 60, 100]], far: [60, 45, 90], near: [45, 35, 70], pt: [150, 140, 160], pb: [90, 80, 100], bricks: 1, stars: 1,
    plat: [G(0, 800), [100, 118, 40, 8], [180, 92, 40, 8], [260, 118, 40, 8]],
    en: [["goblin", 250, 100], ["goblin", 340, 100], ["bat", 380, 90]], coins: [[110, 104], [190, 78], [270, 104], [450, 130], [500, 130]],
    cps: [400], boss: 1, goal: 770, hints: [[430, "THE DARK KNIGHT AWAITS"]], story: [] }
];
const INTRO = ["The Queen has been taken to the ancient castle.", "The road is dangerous.", "The Knight rides alone."];

// ===== GAME STATE =====
let state = "menu", sel = 0, time = 0, fade = 1, shake = 0, endT = 0;
let lv = 0, L = LEVELS[0], p, cam = 0, respawnX = 30, coinCount = 0, coinBase = 0, atkId = 0;
let plats, movs, cols, haz, ens, coins, cps, rocks, gate, boss, bossOn, deadT, msgText = "", msgT = 0, titleT = 0, swOn = false;
const S = [], parts = [], ab = { x: 0, y: 0, w: 18, h: 14 }, tmp = { x: 0, y: 0, w: 0, h: 0 };
const wallL = { x: -20, y: -200, w: 20, h: 600 }, wallR = { x: 0, y: -200, w: 20, h: 600 }, arena = { x: 440, y: 0, w: 8, h: 150 };
const go = s => { state = s; fade = 1; sel = 0; };
const msg = s => { msgText = s; msgT = 2; };
const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = a => "rgb(" + (a[0] | 0) + "," + (a[1] | 0) + "," + (a[2] | 0) + ")";
const approach = (v, t, a) => v < t ? Math.min(t, v + a) : Math.max(t, v - a);

function addP(x, y, n, c) { for (let i = 0; i < n && parts.length < 250; i++) parts.push({ x, y, vx: (Math.random() - .5) * 120, vy: -Math.random() * 100, t: .4 + Math.random() * .4, c }); }

function startLevel(i) { coinBase = coinCount; loadLevel(i); }
function loadLevel(i) {
  lv = i; L = LEVELS[i];
  plats = L.plat.map(a => ({ x: a[0], y: a[1], w: a[2], h: a[3] }));
  movs = (L.mov || []).map(a => ({ x: a[0], y: a[1], w: a[2], h: 6, ax: a[3], r: a[4], sp: a[5], x0: a[0], y0: a[1], dx: 0, dy: 0 }));
  cols = (L.col || []).map(a => ({ x: a[0], y: a[1], w: a[2], h: 8, t: -1, fall: false, vy: 0 }));
  haz = (L.spikes || []).map(a => ({ x: a[0], y: a[1], w: a[2], h: 6, f: 0 })).concat((L.fire || []).map(a => ({ x: a[0], y: a[1], w: a[2], h: 8, f: 1 })));
  ens = (L.en || []).map(a => mkEnemy(a[0], a[1], a[2]));
  coins = (L.coins || []).map(a => ({ x: a[0], y: a[1], got: false }));
  cps = (L.cps || []).map(x => ({ x, on: false }));
  rocks = (L.rocks || []).map((x, k) => ({ x, t: k * .8, y: -20 }));
  gate = L.gate ? { x: L.gate[0], y: L.gate[1], w: L.gate[2], h: L.gate[3], open: false } : null;
  boss = L.boss ? mkBoss() : null; bossOn = false;
  wallR.x = L.w; respawnX = 30; cam = 0; parts.length = 0; titleT = 2.5;
  newPlayer();
}
function newPlayer() {
  p = { x: respawnX, y: 100, w: 10, h: 14, vx: 0, vy: 0, face: 1, on: false, coy: 0, buf: 0, atk: 0, cd: 0, inv: 0, stun: 0, hp: PLAYER_MAX_HEALTH, dead: false, ride: null, anim: 0 };
  deadT = 0;
  if (boss && !boss.dead) { boss = mkBoss(); bossOn = false; }
}
function mkEnemy(t, x, y) {
  const d = { slime: [10, 8, 1], goblin: [10, 14, 2], bat: [10, 8, 1] }[t];
  return { t, x, y, w: d[0], h: d[1], hp: d[2], vx: 0, vy: 0, dir: -1, cd: 0, at: 0, flash: 0, x0: x, y0: y, tm: Math.random() * 6, id: -1, dead: false, on: false, hw: false };
}
function mkBoss() { return { x: 620, y: 110, w: 16, h: 22, hp: 8, vx: 0, vy: 0, dir: -1, st: "idle", t: 1.5, n: 0, vul: false, flash: 0, id: -1, dead: false, air: false, land: 0, on: false, hw: false }; }

// ===== PHYSICS =====
function buildSolids() {
  S.length = 0;
  for (const r of plats) S.push(r);
  for (const m of movs) S.push(m);
  for (const c of cols) if (!c.fall) S.push(c);
  if (gate && !gate.open) S.push(gate);
  S.push(wallL, wallR);
  if (bossOn && boss && !boss.dead) S.push(arena);
}
// Moves an entity, X first then Y, pushing it out of solids
function move(e, dt) {
  const dx = e.vx * dt; e.x += dx; e.hw = false;
  if (dx) for (const s of S) if (ov(e, s)) { e.x = dx > 0 ? s.x - e.w : s.x + s.w; e.hw = true; e.vx = 0; }
  e.y += e.vy * dt; e.on = false; e.ride = null;
  for (const s of S) if (ov(e, s)) { if (e.vy >= 0) { e.y = s.y - e.h; e.on = true; e.ride = s; } else e.y = s.y + s.h; e.vy = 0; }
}
function groundAhead(e) {
  const px = e.x + (e.dir > 0 ? e.w + 3 : -3), py = e.y + e.h + 3;
  for (const s of S) if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return true;
  return false;
}

// ===== PLAYER =====
function updPlayer(dt) {
  if (p.dead) { p.vy += GRAVITY * dt; p.y += p.vy * dt; return; }
  const dir = (down("KeyD", "ArrowRight") ? 1 : 0) - (down("KeyA", "ArrowLeft") ? 1 : 0);
  if (p.stun <= 0) {
    p.vx = approach(p.vx, dir * PLAYER_SPEED, (dir ? (p.on ? 1100 : 750) : (p.on ? 1500 : 250)) * dt);
    if (dir) p.face = dir;
  }
  p.coy = p.on ? .1 : p.coy - dt;
  p.buf = hit(...JUMPK) ? .12 : p.buf - dt;
  if (p.buf > 0 && p.coy > 0 && p.stun <= 0) { p.vy = -PLAYER_JUMP_FORCE; p.buf = 0; p.coy = 0; SFX.jump(); }
  if (!down(...JUMPK) && p.vy < -110) p.vy = -110; // let go early = short hop
  p.vy = Math.min(p.vy + GRAVITY * dt, 400);
  if (p.ride && p.ride.dx !== undefined) { p.x += p.ride.dx; p.y += p.ride.dy; } // ride moving platforms
  move(p, dt);
  if (p.ride && p.ride.t !== undefined && p.ride.t < 0) p.ride.t = .5; // collapsing platform starts to fall
  if (hit("KeyJ") && p.cd <= 0 && p.stun <= 0) { p.atk = .18; p.cd = PLAYER_ATTACK_COOLDOWN; atkId++; SFX.sword(); }
  p.atk -= dt; p.cd -= dt; p.inv -= dt; p.stun -= dt; p.anim += dt * Math.abs(p.vx) * .12;
  ab.x = p.face > 0 ? p.x + p.w : p.x - ab.w; ab.y = p.y;
  if (p.y > 210) fall();
}
function hurtP(dir) {
  if (p.inv > 0 || p.dead) return;
  p.hp--; p.inv = 1.2; p.vx = dir * 130; p.vy = -160; p.stun = .2; shake = .2; SFX.hurt(); addP(p.x + 5, p.y + 7, 8, "#e33");
  if (p.hp <= 0) { p.dead = true; deadT = 1.3; p.vy = -200; SFX.die(); addP(p.x + 5, p.y + 7, 20, "#c4ccd6"); }
}
function fall() {
  p.hp--; SFX.hurt();
  if (p.hp <= 0) { p.dead = true; deadT = .6; p.vy = 0; SFX.die(); return; }
  p.x = respawnX; p.y = 100; p.vx = p.vy = 0; p.inv = 1.5;
}

// ===== ENEMIES =====
function updEnemy(e, dt) {
  e.flash -= dt; e.tm += dt;
  if (e.t === "bat") { e.x = e.x0 + Math.sin(e.tm * 1.2) * 50; e.y = e.y0 + Math.sin(e.tm * 3) * 10; e.dir = Math.cos(e.tm * 1.2) > 0 ? 1 : -1; return; }
  const dx = p.x - e.x, near = e.t === "goblin" && !p.dead && Math.abs(dx) < 90 && Math.abs(p.y - e.y) < 30;
  let sp = ENEMY_SPEED * (e.t === "slime" ? .8 : 1);
  if (near) { e.dir = dx > 0 ? 1 : -1; sp *= 1.5; if (e.at <= 0 && e.cd <= 0 && Math.abs(dx) < 20) e.at = .55; }
  const was = e.at;
  if (e.at > 0) { e.at -= dt; sp = 0; if (was > 0 && e.at <= 0) e.cd = .9; }
  e.cd -= dt;
  e.vx = e.dir * sp; e.vy = Math.min(e.vy + GRAVITY * dt, 400);
  move(e, dt);
  if (e.hw || (e.on && sp && !groundAhead(e))) { if (near) e.x -= e.dir * sp * dt; else e.dir = -e.dir; }
}
function hurtEnemy(e, n) {
  e.hp -= n; e.flash = .15; SFX.hit(); addP(e.x + e.w / 2, e.y + e.h / 2, 6, "#fff");
  if (e.hp <= 0) { e.dead = true; addP(e.x + e.w / 2, e.y + e.h / 2, 12, e.t === "slime" ? "#5c5" : e.t === "bat" ? "#86a" : "#6a4"); }
}
function updEnemies() {
  for (const e of ens) {
    if (e.dead) continue;
    if (p.atk > 0 && e.id !== atkId && ov(ab, e)) { e.id = atkId; hurtEnemy(e, 1); e.x += p.face * 6; if (e.dead) continue; }
    if (p.dead) continue;
    if (ov(p, e) && p.inv <= 0) {
      if (p.vy > 60 && p.y + p.h - e.y < 10) { hurtEnemy(e, 1); p.vy = -220; } else hurtP(p.x < e.x ? -1 : 1);
    }
    if (e.t === "goblin" && e.at > 0 && e.at <= .15) {
      tmp.x = e.dir > 0 ? e.x + e.w : e.x - 14; tmp.y = e.y + 2; tmp.w = 14; tmp.h = 10;
      if (ov(p, tmp)) hurtP(e.dir);
    }
  }
}

// ===== BOSS: THE DARK KNIGHT (swing -> charge -> jump, then repeat) =====
function updBoss(dt) {
  const b = boss; if (!b || b.dead) return;
  if (!bossOn) { if (p.x > 470 && !p.dead) { bossOn = true; msg("THE DARK KNIGHT!"); SFX.boss(); } else { b.vy = Math.min(b.vy + GRAVITY * dt, 400); move(b, dt); return; } }
  b.flash -= dt; b.t -= dt; b.land -= dt; b.vul = b.st === "rest" || b.st === "stun";
  const toP = p.x > b.x ? 1 : -1;
  if (b.st === "idle") { b.dir = toP; b.vx = 0; if (b.t <= 0) { b.st = ["swing", "charge", "jump"][b.n++ % 3]; b.t = b.st === "jump" ? .5 : .7; } }
  else if (b.st === "swing") { if (b.t <= 0) { b.st = "rest"; b.t = 1.1; } }
  else if (b.st === "charge") {
    if (b.t > 0) { b.dir = toP; b.vx = 0; }
    else { b.vx = b.dir * 150; if (b.hw || b.t < -1.3) { b.st = "stun"; b.t = 1.5; b.vx = 0; shake = .3; SFX.boom(); } }
  } else if (b.st === "jump") {
    if (b.t > 0) b.vx = 0;
    else if (!b.air) { b.air = true; b.vy = -250; b.vx = Math.max(-120, Math.min(120, (p.x - b.x) / .55)); }
    else if (b.on) { b.air = false; b.vx = 0; b.st = "rest"; b.t = 1.1; shake = .35; b.land = .15; SFX.boom(); }
  } else if (b.t <= 0) { b.st = "idle"; b.t = .8; }
  b.vy = Math.min(b.vy + GRAVITY * dt, 500); move(b, dt);
  if (p.dead) return;
  if (p.atk > 0 && b.id !== atkId && ov(ab, b)) {
    b.id = atkId;
    if (b.vul) { b.hp--; b.flash = .2; shake = .25; SFX.boss(); addP(b.x + 8, b.y + 10, 10, "#fff");
      if (b.hp <= 0) { b.dead = true; msg("THE PATH IS CLEAR!"); addP(b.x + 8, b.y + 10, 40, "#936"); SFX.win(); } }
    else beep(600, .06, "square", .5); // clang: armor blocks you
  }
  let hurt = false;
  if (b.st === "swing" && b.t <= .2 && b.t > 0) { tmp.x = b.dir > 0 ? b.x + b.w : b.x - 28; tmp.y = b.y; tmp.w = 28; tmp.h = 20; hurt = ov(p, tmp); }
  if ((b.st === "charge" && b.t <= 0) || b.air) hurt = hurt || ov(p, b);
  if (b.land > 0) { tmp.x = b.x - 14; tmp.y = b.y + b.h - 8; tmp.w = b.w + 28; tmp.h = 8; hurt = hurt || ov(p, tmp); }
  if (hurt) hurtP(p.x < b.x ? -1 : 1);
}

// ===== MAIN PLAY UPDATE =====
function updPlay(dt) {
  if (hit("KeyR")) { coinCount = coinBase; loadLevel(lv); return; }
  if (hit("KeyP", "Escape")) { go("paused"); return; }
  for (const m of movs) { const ph = Math.sin(time * m.sp) * .5 + .5, nx = m.x0 + (m.ax === "x" ? ph * m.r : 0), ny = m.y0 + (m.ax === "y" ? ph * m.r : 0); m.dx = nx - m.x; m.dy = ny - m.y; m.x = nx; m.y = ny; }
  for (const c of cols) { if (c.t >= 0 && !c.fall) { c.t -= dt; if (c.t <= 0) { c.fall = true; c.vy = 0; SFX.boom(); } } if (c.fall) { c.vy += 500 * dt; c.y += c.vy * dt; } }
  buildSolids();
  updPlayer(dt);
  for (const e of ens) if (!e.dead) updEnemy(e, dt);
  updEnemies(); updBoss(dt);
  if (!p.dead) {
    for (const h of haz) if (ov(p, h) && p.inv <= 0) { hurtP(p.vx >= 0 ? -1 : 1); p.vy = -200; }
    for (const r of rocks) {
      r.t += dt; const c = r.t % 3.2; r.y = c < .8 ? -20 : (c - .8) * 200 - 10;
      if (c >= .8 && r.y < 150) { tmp.x = r.x; tmp.y = r.y; tmp.w = 8; tmp.h = 8; if (ov(p, tmp)) hurtP(p.x < r.x ? -1 : 1); }
    }
    for (const c of coins) if (!c.got) { tmp.x = c.x - 4; tmp.y = c.y - 4; tmp.w = 8; tmp.h = 8; if (ov(p, tmp)) { c.got = true; coinCount++; save.coins++; SFX.coin(); addP(c.x, c.y, 6, "#fd4"); } }
    for (const c of cps) if (!c.on) { tmp.x = c.x - 4; tmp.y = 126; tmp.w = 8; tmp.h = 24; if (ov(p, tmp)) { c.on = true; respawnX = c.x; msg("CHECKPOINT REACHED"); SFX.cp(); addP(c.x, 130, 16, "#fd4"); } }
    if (L.sw && gate && !gate.open) { tmp.x = L.sw[0]; tmp.y = L.sw[1] - 8; tmp.w = L.sw[2]; tmp.h = L.sw[3] + 8; if (ov(p, tmp)) { gate.open = true; msg("A GATE RUMBLES OPEN"); SFX.boom(); shake = .3; } }
    if (!(boss && !boss.dead)) { tmp.x = L.goal - 8; tmp.y = 118; tmp.w = 16; tmp.h = 32; if (ov(p, tmp)) { save.best = Math.max(save.best, lv + 2); store(); SFX.win(); go("complete"); } }
  } else { deadT -= dt; if (deadT <= 0) { store(); go("over"); } }
  for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t -= dt; q.vy += 300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.t <= 0) parts.splice(i, 1); }
  const target = p.x + 5 - 160 + p.face * 20;
  cam += (target - cam) * Math.min(1, dt * 6);
  cam = Math.max(0, Math.min(L.w - GAME_WIDTH, cam));
  shake = Math.max(0, shake - dt); msgT -= dt; titleT -= dt;
}

// ===== MENUS & STATE FLOW =====
const MENUS = { menu: ["PLAY", "HOW TO PLAY", "CREDITS"], paused: ["RESUME", "RESTART LEVEL", "MAIN MENU"], over: ["RETRY LEVEL", "MAIN MENU"], theend: ["PLAY AGAIN"] };
const menuY = () => state === "menu" ? 112 : state === "theend" ? 150 : 92;
function newGame() { coinCount = 0; coinBase = 0; go("story"); }
function menuAct() {
  const i = sel;
  if (state === "menu") { if (i === 0) newGame(); else go(i === 1 ? "howto" : "credits"); }
  else if (state === "paused") { if (i === 0) go("play"); else if (i === 1) { coinCount = coinBase; loadLevel(lv); go("play"); } else go("menu"); }
  else if (state === "over") { if (i === 0) { newPlayer(); go("play"); } else go("menu"); }
  else if (state === "theend") newGame();
}
function advance() {
  if (state === "story") { startLevel(0); go("play"); }
  else if (state === "howto" || state === "credits") go("menu");
  else if (state === "complete") { if (lv < 4) { startLevel(lv + 1); go("play"); } else { endT = 0; go("ending"); } }
}
function update(dt) {
  time += dt; fade = Math.max(0, fade - dt * 2);
  if (MENUS[state]) {
    const n = MENUS[state].length;
    if (hit("ArrowDown", "KeyS")) sel = (sel + 1) % n;
    if (hit("ArrowUp", "KeyW")) sel = (sel + n - 1) % n;
    if (hit("Enter", "Space", "KeyJ")) menuAct();
    else if (state === "paused" && hit("KeyP", "Escape")) go("play");
  } else if (state === "play") updPlay(dt);
  else if (state === "ending") { endT += dt; if (endT > 19) go("theend"); }
  else if (hit("Enter", "Space", "KeyJ", "Escape")) advance();
  for (const k in press) delete press[k];
}
function canvasPos(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * GAME_WIDTH, (e.clientY - r.top) / r.height * GAME_HEIGHT]; }
function menuHit(e) { if (!MENUS[state]) return -1; const [x, y] = canvasPos(e), i = Math.floor((y - menuY() + 10) / 16); return i >= 0 && i < MENUS[state].length && Math.abs(x - 160) < 70 ? i : -1; }
cv.addEventListener("mousemove", e => { const i = menuHit(e); if (i >= 0) sel = i; });
cv.addEventListener("click", e => { const i = menuHit(e); if (i >= 0) { sel = i; menuAct(); } else if (!MENUS[state] && state !== "play" && state !== "ending") advance(); });

// ===== DRAWING HELPERS =====
const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
function txt(s, x, y, sz, c, al) { ctx.font = "bold " + sz + "px monospace"; ctx.textAlign = al || "center"; ctx.fillStyle = "#000"; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = c || "#fff"; ctx.fillText(s, x, y); }
const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
function heart(x, y, c) { HEART.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] === "1") R(x + i, y + j, 1, 1, c); }); }
function drawBg(l, cx, prog) {
  const top = l.sky2 ? mix(l.sky[0], l.sky2[0], prog) : l.sky[0], bot = l.sky2 ? mix(l.sky[1], l.sky2[1], prog) : l.sky[1];
  const g = ctx.createLinearGradient(0, 0, 0, 180); g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 180);
  if (l.stars) { ctx.globalAlpha = l.sky2 ? prog : 1; for (let i = 0; i < 40; i++) R((i * 73) % 320, (i * 37) % 90, 1, 1, "#fff"); ctx.globalAlpha = 1; }
  if (l.clouds) for (let i = 0; i < 5; i++) { const x = ((i * 130 - cx * .1 + time * 3) % 450 + 450) % 450 - 60; R(x, 25 + i * 9 % 30, 34, 8, "#fff"); R(x + 6, 21 + i * 9 % 30, 22, 5, "#fff"); }
  for (let x = 0; x < 320; x += 4) { const h = 55 + Math.sin((x + cx * .2) * .03) * 18 + Math.sin((x + cx * .2) * .09) * 6; R(x, 180 - h, 4, h, rgb(l.far)); }
  for (let x = 0; x < 320; x += 4) { const h = 35 + Math.sin((x + cx * .5) * .05 + 2) * 14 + Math.sin((x + cx * .5) * .13) * 5; R(x, 180 - h, 4, h, rgb(l.near)); }
  if (l.bricks) { const lc = rgb(mix(l.near, [0, 0, 0], .4)); for (let y = 0; y < 150; y += 12) { R(0, y, 320, 1, lc); for (let x = -((cx * .5) % 24); x < 320; x += 24) R(x + (y / 12 % 2) * 12, y, 1, 12, lc); } }
}
function drawCastle(x, y, c) { R(x, y, 60, 50, c); R(x - 10, y - 20, 18, 70, c); R(x + 52, y - 30, 18, 80, c); for (let i = 0; i < 6; i++) R(x + i * 10, y - 4, 6, 4, c); R(x + 54, y - 40, 14, 10, c); R(x + 58, y - 48, 6, 8, c); R(x + 24, y + 28, 12, 22, "#1a1020"); }
function drawKnight(x, y, face, anim, atk, air, vx) {
  ctx.save(); ctx.translate(Math.round(x + 5), Math.round(y)); ctx.scale(face, 1);
  const f = Math.sin(anim * 2) * 2, flut = Math.min(4, Math.abs(vx) / 25) + (air ? 2 : 0);
  R(-6 - flut, 6, 4 + flut, 8 + (air ? 0 : (anim | 0) % 2), "#2a3b8f"); // cape
  R(-5, -1, 10, 7, "#12121f"); R(-4, 5, 8, 7, "#12121f"); // outline
  R(-3, 0, 7, 6, "#c4ccd6"); R(1, 3, 3, 1, "#12121f"); R(-1, -2, 2, 2, "#c33"); // helmet
  R(-3, 6, 7, 5, "#aab3c2"); R(-3, 9, 7, 1, "#6b4f2a"); // body
  R(-3 + (air ? -1 : f), 11, 3, 3, "#8a93a3"); R(1 + (air ? 1 : -f), 11, 3, 3, "#8a93a3"); // legs
  if (atk > 0) { R(4, 6, 18, 2, "#12121f"); R(4, 6, 17, 1, "#eef4ff"); R(5, 3, 2, 8, "#c9a227"); }
  else { R(4, 2, 2, 10, "#12121f"); R(4, 2, 1, 9, "#eef4ff"); R(3, 8, 4, 1, "#c9a227"); }
  ctx.restore();
}
function drawQueen(x, y, face, anim) {
  ctx.save(); ctx.translate(Math.round(x + 5), Math.round(y)); ctx.scale(face, 1);
  R(-4, 6, 9, 8, "#12121f"); R(-3, 6, 7, 8 + (Math.sin(anim * 3) > 0 ? 0 : 0), "#7a2fa5"); R(-3, 11, 7, 1, "#c9a227");
  R(-3, 0, 7, 6, "#12121f"); R(-2, 1, 5, 5, "#f0c8a0"); R(-3, -1, 7, 2, "#c9a227"); R(-3, 2, 2, 7, "#5a2a10"); R(2, 3, 1, 1, "#222");
  ctx.restore();
}
function drawEnemy(e) {
  if (e.flash > 0 && ((e.flash * 40) | 0) % 2) return;
  const x = Math.round(e.x), y = Math.round(e.y), t = e.t;
  if (t === "slime") { const sq = Math.sin(e.tm * 8) * 1; R(x - 1, y + 1 - sq, 12, 8 + sq, "#12121f"); R(x, y + 2 - sq, 10, 6 + sq, "#5c5"); R(x + 2, y + 3 - sq, 2, 2, "#fff"); R(x + 6, y + 3 - sq, 2, 2, "#fff"); R(x + 3, y + 4 - sq, 1, 1, "#000"); R(x + 7, y + 4 - sq, 1, 1, "#000"); }
  else if (t === "bat") { const w = Math.sin(e.tm * 18) * 3; R(x - 5, y + 1 + w, 6, 3, "#12121f"); R(x + 9, y + 1 + w, 6, 3, "#12121f"); R(x - 4, y + 2 + w, 4, 1, "#86a"); R(x + 10, y + 2 + w, 4, 1, "#86a"); R(x, y, 10, 7, "#12121f"); R(x + 1, y + 1, 8, 5, "#86a"); R(x + 2, y + 2, 2, 2, "#f55"); R(x + 6, y + 2, 2, 2, "#f55"); }
  else {
    const wind = e.at > .15 ? -3 : 0, sw = e.at > 0 && e.at <= .15;
    ctx.save(); ctx.translate(x + 5, y); ctx.scale(e.dir, 1);
    R(-5, -1, 10, 15, "#12121f"); R(-4, 0, 8, 6, "#6a4"); R(-6, 1, 2, 2, "#6a4"); R(3, 1, 2, 2, "#6a4"); R(0, 2, 2, 2, "#f33"); R(-3, 6, 7, 5, "#7a5230"); R(-3, 11 + (Math.sin(e.tm * 12) > 0 ? 0 : 1), 3, 3, "#4a3220"); R(1, 11, 3, 3, "#4a3220");
    R(4, 4 + wind, 2, 7, "#ccc"); if (sw) R(5, 6, 10, 2, "#eee");
    ctx.restore();
  }
}
function drawBoss(b) {
  if (b.flash > 0 && ((b.flash * 40) | 0) % 2) return;
  ctx.save(); ctx.translate(Math.round(b.x + 8), Math.round(b.y)); ctx.scale(b.dir, 1);
  const tel = (b.st === "swing" && b.t > .2) || (b.st === "charge" && b.t > 0) || (b.st === "jump" && b.t > 0);
  const body = b.vul ? "#7a7ac0" : tel && ((time * 14) | 0) % 2 ? "#a33" : "#3a3446";
  R(-9, 6, 5, 14, "#2a0f1e"); R(-8, -1, 16, 24, "#0a0a12"); R(-7, 0, 14, 8, body); R(-4, 3, 9, 2, "#f22"); R(-1, -4, 2, 4, "#a22");
  R(-7, 8, 14, 9, body); R(-6, 17, 5, 5, "#222030"); R(1, 17, 5, 5, "#222030");
  if (b.st === "swing") { if (b.t > .2) { R(6, -14, 3, 18, "#12121f"); R(7, -14, 1, 17, "#bbb"); } else { R(6, 6, 28, 4, "#12121f"); R(7, 7, 26, 2, "#eee"); } }
  else { R(7, 6, 3, 14, "#12121f"); R(8, 6, 1, 13, "#bbb"); }
  ctx.restore();
}
function drawWorld() {
  const x0 = cam - 40, x1 = cam + 360, t = time;
  for (const r of plats.concat(movs, cols)) {
    if (r.x > x1 || r.x + r.w < x0 || (r.fall && r.y > 190)) continue;
    const jig = r.t > 0 && !r.fall ? Math.sin(t * 60) : 0;
    R(r.x + jig, r.y, r.w, r.h, rgb(L.pb)); R(r.x + jig, r.y, r.w, 3, rgb(L.pt));
    ctx.strokeStyle = "#12121f"; ctx.strokeRect(Math.round(r.x + jig) + .5, Math.round(r.y) + .5, r.w - 1, r.h - 1);
    if (r.h > 20) for (let x = r.x + 6; x < r.x + r.w - 6; x += 20) R(x, r.y + 12, 6, 1, "rgba(0,0,0,.25)");
  }
  if (L.hints) for (const h of L.hints) txt(h[1], h[0], 70, 7, "#fff");
  if (gate && !gate.open) { R(gate.x, gate.y, gate.w, gate.h, "#555"); for (let y = gate.y; y < gate.y + gate.h; y += 6) R(gate.x, y, gate.w, 2, "#999"); }
  if (L.sw) R(L.sw[0], L.sw[1], L.sw[2], L.sw[3], gate && gate.open ? "#4c4" : "#c44");
  for (const h of haz) {
    if (h.x > x1 || h.x + h.w < x0) continue;
    if (!h.f) for (let i = 0; i < h.w; i += 6) { ctx.fillStyle = "#cfd6e0"; ctx.beginPath(); ctx.moveTo(h.x + i, h.y + 6); ctx.lineTo(h.x + i + 3, h.y); ctx.lineTo(h.x + i + 6, h.y + 6); ctx.fill(); }
    else for (let i = 0; i < h.w; i += 4) { const fh = 4 + (Math.sin(t * 12 + i) + 1) * 3; R(h.x + i, h.y + 8 - fh, 4, fh, "#e63"); R(h.x + i + 1, h.y + 8 - fh * .5, 2, fh * .5, "#fd4"); }
  }
  for (const r of rocks) { const c = r.t % 3.2; if (c < .8) R(r.x, 148, 8, 2, ((t * 10) | 0) % 2 ? "#f44" : "#822"); else if (r.y < 150) { R(r.x - 1, r.y - 1, 10, 10, "#12121f"); R(r.x, r.y, 8, 8, "#888"); R(r.x + 1, r.y + 1, 3, 2, "#bbb"); } }
  for (const c of cps) { R(c.x, 130, 2, 20, "#aaa"); R(c.x + 2, 130, c.on ? 10 + Math.sin(t * 8) * 2 : 8, 7, c.on ? "#d33" : "#777"); if (c.on) R(c.x + 5, 132, 3, 3, "#fd4"); }
  if (!(boss && !boss.dead)) { const g = L.goal; R(g - 12, 118, 24, 32, "#12121f"); R(g - 10, 120, 20, 30, "#665a78"); R(g - 6, 126, 12, 24, "#1a1020"); R(g - 6, 124, 12, 3, "#1a1020"); R(g + 12, 100, 2, 50, "#aaa"); R(g + 14, 100, 9 + Math.sin(t * 6) * 2, 7, "#fd4"); }
  coins.forEach((c, i) => { if (c.got || c.x > x1 || c.x < x0) return; const w = Math.abs(Math.cos(t * 5 + i)) * 5 + 1; R(c.x - w / 2 - 1, c.y - 4, w + 2, 8, "#12121f"); R(c.x - w / 2, c.y - 3, w, 6, "#fc2"); R(c.x - w / 2, c.y - 3, w / 2, 2, "#ffe"); if (((t * 3 + i) | 0) % 5 === 0 && ((t * 20) | 0) % 3 === 0) R(c.x + 4, c.y - 5, 1, 1, "#fff"); });
  for (const e of ens) if (!e.dead && e.x < x1 && e.x > x0) drawEnemy(e);
  if (boss && !boss.dead) drawBoss(boss);
  if (!p.dead && !(p.inv > 0 && ((t * 16) | 0) % 2)) drawKnight(p.x, p.y, p.face, p.anim, p.atk, !p.on, p.vx);
  for (const q of parts) R(q.x, q.y, 2, 2, q.c);
}
function drawHud() {
  for (let i = 0; i < PLAYER_MAX_HEALTH; i++) heart(6 + i * 10, 6, i < p.hp ? "#e22" : "#522");
  txt("COINS: " + String(coinCount).padStart(2, "0"), 314, 13, 8, "#fd4", "right");
  if (titleT > 0) { ctx.globalAlpha = Math.min(1, titleT); txt(L.name, 160, 40, 9, "#fff"); ctx.globalAlpha = 1; }
  if (msgT > 0) txt(msgText, 160, 60, 8, "#fd4");
  if (boss && bossOn && !boss.dead) { R(110, 168, 100, 5, "#12121f"); R(111, 169, 98 * boss.hp / 8, 3, "#c22"); }
  if (DEBUG_MODE) txt("FPS " + fps + "  x:" + (p.x | 0) + " y:" + (p.y | 0) + "  lvl " + (lv + 1) + "  hp " + p.hp, 6, 172, 6, "#0f0", "left");
}
function drawMenu() {
  const y0 = menuY();
  MENUS[state].forEach((s, i) => { const on = i === sel; txt((on ? "> " : "") + s + (on ? " <" : ""), 160, y0 + i * 16, 10, on ? "#fd4" : "#ccc"); });
}
function dim(a) { ctx.fillStyle = "rgba(0,0,0," + a + ")"; ctx.fillRect(0, 0, 320, 180); }
function drawEnding(t) {
  if (t < 9) { // the Queen's chamber
    R(0, 0, 320, 180, "#2a1a3a"); for (let y = 0; y < 150; y += 12) R(0, y, 320, 1, "#3a2a4a");
    R(130, 30, 60, 70, "#12121f"); R(134, 34, 52, 62, "#e9a060"); R(158, 34, 4, 62, "#12121f"); R(134, 64, 52, 4, "#12121f");
    R(0, 150, 320, 30, "#5a4a6a"); R(0, 150, 320, 3, "#8a7a9a");
    const kx = Math.min(120, -10 + t * 50);
    drawKnight(kx, 136, 1, t * 6, 0, false, kx < 120 ? 50 : 0); drawQueen(210, 136, t > 1.5 ? -1 : 1, 0);
    if (t > 2 && t < 4.5) txt("QUEEN: You came.", 160, 126, 9, "#e9c6ff");
    if (t > 4.5 && t < 8) txt("KNIGHT: I promised I would.", 160, 126, 9, "#cfe0ff");
  } else { // sunrise
    const u = Math.min(1, (t - 9) / 6), l = { sky: [[20, 25, 70], [60, 40, 90]], sky2: [[90, 170, 240], [255, 190, 110]], far: [60, 100, 70], near: [50, 130, 60] };
    drawBg(l, t * 5, u);
    R(220, 140 - u * 60, 20, 20, "#fe9"); R(222, 138 - u * 60, 16, 24, "#fe9"); // sun
    drawCastle(210, 100, "#2a2036"); R(0, 150, 320, 30, "#4a9a4a"); R(0, 150, 320, 3, "#7c4");
    const wx = 40 + Math.min(1, (t - 10) / 8) * 110, wa = (t - 10) * 8;
    drawKnight(wx, 136, 1, wa, 0, false, 40); drawQueen(wx - 14, 136, 1, wa);
    if (t > 14) txt("THE KINGDOM WAS SAFE ONCE AGAIN.", 160, 40, 8, "#fff");
    if (t > 16.5) txt("THE END", 160, 70, 18, "#fd4");
  }
}

// ===== MAIN DRAW =====
let fps = 0;
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state === "menu") {
    drawBg(LEVELS[0], time * 12, 0); drawCastle(230, 100, "#4a4560"); R(0, 150, 320, 30, "#5a3d28"); R(0, 150, 320, 4, "#5ac048");
    drawKnight(80, 136, 1, time * 2, 0, false, 0);
    txt("THE KNIGHT'S", 160, 42, 16, "#fd4"); txt("LAST QUEST", 160, 62, 16, "#fd4"); txt("A small adventure awaits...", 160, 80, 7, "#fff");
    drawMenu();
  } else if (state === "howto" || state === "credits" || state === "story") {
    R(0, 0, 320, 180, "#14101e");
    const lines = state === "howto" ? ["HOW TO PLAY", "", "A/D or ARROWS  move", "SPACE / W / UP  jump", "J  sword attack", "P / ESC  pause   R  restart level", "M  sound on/off", "", "Jump on slimes, slash the rest.", "Coins are optional. Find the Queen!"]
      : state === "credits" ? ["CREDITS", "", "THE KNIGHT'S LAST QUEST", "An original pixel-art adventure", "made with HTML, CSS and JavaScript.", "", "Thanks for playing!"] : INTRO;
    lines.forEach((s, i) => txt(s, 160, 40 + i * 14, i === 0 && state !== "story" ? 11 : 8, i === 0 && state !== "story" ? "#fd4" : "#ddd"));
    txt("press ENTER", 160, 168, 7, "#888");
  } else if (state === "ending" || state === "theend") {
    drawEnding(state === "ending" ? endT : 99); if (state === "theend") drawMenu();
  } else {
    const prog = L.w > 320 ? cam / (L.w - 320) : 0;
    drawBg(L, cam, prog);
    ctx.save(); ctx.translate(-Math.round(cam) + (shake > 0 ? (Math.random() - .5) * 6 : 0), shake > 0 ? (Math.random() - .5) * 6 : 0);
    drawWorld(); ctx.restore();
    drawHud();
    if (state === "paused") { dim(.6); txt("PAUSED", 160, 60, 14, "#fff"); drawMenu(); }
    if (state === "over") { dim(.7); txt("YOU HAVE FALLEN...", 160, 58, 14, "#e44"); drawMenu(); }
    if (state === "complete") { dim(.7); txt("LEVEL COMPLETE", 160, 55, 14, "#fd4"); L.story.forEach((s, i) => txt(s, 160, 85 + i * 14, 8, "#fff")); txt("COINS: " + coinCount, 160, 130, 8, "#fd4"); txt("press ENTER", 160, 160, 7, "#aaa"); }
  }
  if (fade > 0) { ctx.fillStyle = "rgba(0,0,0," + fade + ")"; ctx.fillRect(0, 0, 320, 180); }
}

// ===== LOOP (fixed 60Hz updates, drawn with requestAnimationFrame) =====
let last = 0, acc = 0, fc = 0, ft = 0;
function frame(ts) {
  try {
    const dt = Math.min(.1, (ts - last) / 1000 || 0); last = ts; acc += dt;
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; }
    draw(); fc++; ft += dt; if (ft >= 1) { fps = fc; fc = 0; ft = 0; }
  } catch (e) { console.error("game error", e); }
  requestAnimationFrame(frame);
}
loadLevel(0);
requestAnimationFrame(frame);
