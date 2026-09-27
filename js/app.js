import * as THREE from 'https://esm.sh/three@0.160.0';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

const CONFIG = {
  headTracking: true,   // robot heads follow the pointer
  monoModels: false,    // render robots in grayscale
  trailerId: 'choj0wMlvv8',
};

const ROBOTS = [
  { url: 'models/atom.glb', name: 'Atom', gen: 'Gen 2 sparring bot',
    tag1: 'Built to take a hit.', tag2: 'Refuses to fall.',
    bio: "Max Kenton digs Atom out of a junkyard mudslide. The old sparring robot has a shadow function that mirrors a human's moves, and it carries him from underground bouts to a title fight with Zeus.",
    stats: [{ v: 'Gen 2', k: 'Generation' }, { v: '435 kg', k: 'Weight' }, { v: '2.1 m', k: 'Height' }, { v: 'Sparring', k: 'Specialty' }] },
  { url: 'models/ambush.glb', name: 'Ambush', gen: 'Fairground brawler',
    tag1: 'One last fight.', tag2: 'On the county circuit.',
    bio: 'An old World Robot Boxing fighter Charlie Kenton hauls from fair to fair. His last booking is a rigged match against Black Thunder, a 2,000-pound bull.',
    stats: [{ v: 'Gen 1', k: 'Generation' }, { v: '500 kg', k: 'Weight' }, { v: '2.4 m', k: 'Height' }, { v: 'Brawler', k: 'Specialty' }] },
  { url: 'models/midasreal_steel.glb', name: 'Midas', gen: 'Underground champion',
    tag1: 'King of the', tag2: 'Crash Palace.',
    bio: 'The star of the Crash Palace underground circuit, known for a red mohawk and for tearing opponents apart. Midas dismantles Noisy Boy in front of a packed warehouse crowd.',
    stats: [{ v: 'Custom', k: 'Build' }, { v: '550 kg', k: 'Weight' }, { v: '2.4 m', k: 'Height' }, { v: 'Destroyer', k: 'Specialty' }] },
  { url: 'models/noisy_boy.glb', name: 'Noisy Boy', gen: 'Former WRB contender',
    tag1: 'Fast and loud.', tag2: 'Wired in Japanese.',
    bio: 'Charlie buys the one-time WRB contender from designer Tak Mashido with borrowed money. Its controls answer to Japanese voice commands, and one unrehearsed fight against Midas ends it.',
    stats: [{ v: 'WRB', k: 'Generation' }, { v: '475 kg', k: 'Weight' }, { v: '2.3 m', k: 'Height' }, { v: 'Speed', k: 'Specialty' }] },
].map((r, i) => ({ ...r, num: String(i + 1).padStart(2, '0') }));

const $ = (id) => document.getElementById(id);
const track = $('track'), stageEl = $('stage3d'), video = $('video');

const state = {
  idx: 0, shown: 0, fade: 1, loaded: ROBOTS.map(() => false),
  roomy: true, tall: true, trailerOpen: false, full: false,
  shadow: false, shadowStatus: '', shadowBlocked: false,
};
let target = 0, fadeT = 0;

// ---------- DOM ----------

const navLinks = ROBOTS.map((r, i) => {
  const b = document.createElement('button');
  b.className = 'navlink';
  b.innerHTML = `<span></span><span class="bar"></span>`;
  b.firstChild.textContent = r.name;
  b.addEventListener('click', () => goTo(i));
  $('navLinks').appendChild(b);
  return b;
});
const railNums = ROBOTS.map((r, i) => {
  const b = document.createElement('button');
  b.className = 'railnum';
  b.innerHTML = `<span class="bar"></span><span></span>`;
  b.lastChild.textContent = r.num;
  b.addEventListener('click', () => goTo(i));
  $('railNums').appendChild(b);
  return b;
});

function renderRobot() {
  const r = ROBOTS[state.shown];
  document.querySelectorAll('[data-bind]').forEach(el => { el.textContent = r[el.dataset.bind]; });
  $('stats').replaceChildren(...r.stats.map(s => {
    const d = document.createElement('div');
    d.className = 'stat';
    d.innerHTML = '<span class="stat-v"></span><span class="stat-k"></span>';
    d.children[0].textContent = s.v; d.children[1].textContent = s.k;
    return d;
  }));
}

function render() {
  const { idx, shown, fade, loaded, roomy, tall, full, shadow } = state;
  document.querySelectorAll('[data-fade]').forEach(el => { el.style.opacity = fade; });
  document.querySelectorAll('[data-shift]').forEach(el => { el.style.transform = `translateY(${fade ? 0 : 14}px)`; });
  document.querySelectorAll('[data-roomy]').forEach(el => el.classList.toggle('is-hidden', !roomy));
  document.querySelectorAll('[data-tall]').forEach(el => el.classList.toggle('is-hidden', !tall));
  navLinks.forEach((b, i) => b.classList.toggle('on', i === idx));
  railNums.forEach((b, i) => b.classList.toggle('on', i === idx));

  const loading = $('loading');
  loading.hidden = loaded[idx];
  loading.textContent = 'Loading ' + ROBOTS[idx].name;

  $('camLabel').textContent = full ? (shadow ? 'Half body' : 'Close-up') : 'Full body';
  document.body.classList.toggle('shadow-on', shadow);
  $('exploreLabel').textContent = full ? 'Close-up view' : 'Explore ' + ROBOTS[shown].name;

  $('preview').classList.toggle('on', shadow);
  $('shadowStatus').textContent = state.shadowStatus;
  $('shadowLabel').textContent = shadow ? 'Exit shadow mode' : 'Shadow mode';
  $('shadowBtn').classList.toggle('active', shadow);
  const openTab = $('openTab');
  openTab.hidden = !state.shadowBlocked;
  openTab.href = window.location.href;

  const tr = $('trailer'), frame = tr.querySelector('.trailer-frame');
  tr.hidden = !state.trailerOpen;
  if (state.trailerOpen && !frame.firstChild) {
    const f = document.createElement('iframe');
    f.src = 'https://www.youtube.com/embed/' + CONFIG.trailerId + '?autoplay=1&rel=0';
    f.title = 'Real Steel trailer';
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    frame.appendChild(f);
  } else if (!state.trailerOpen && frame.firstChild) {
    frame.replaceChildren();
  }
}

function setState(patch) {
  const prevShown = state.shown;
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  if (state.shown !== prevShown) renderRobot();
  render();
}

// ---------- navigation ----------

function select(idx) {
  target = idx;
  setState({ idx, fade: 0 });
  clearTimeout(fadeT);
  fadeT = setTimeout(() => setState({ shown: idx, fade: 1 }), 220);
}

function goTo(i) {
  const top = track.getBoundingClientRect().top + window.scrollY;
  const total = track.offsetHeight - window.innerHeight;
  window.scrollTo({ top: top + (i + 0.5) * total / ROBOTS.length, behavior: 'smooth' });
}

function onScroll() {
  const r = track.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  const p = Math.min(0.9999, Math.max(0, -r.top / total));
  const idx = Math.floor(p * ROBOTS.length);
  if (idx !== state.idx) select(idx);
}

function onResize() {
  setState({
    roomy: window.innerHeight >= 640 && window.innerWidth >= 1000,
    tall: window.innerHeight >= 620,
  });
}

const actions = {
  openTrailer: () => setState({ trailerOpen: true }),
  closeTrailer: () => setState({ trailerOpen: false }),
  toggleCam: () => setState(s => ({ full: !s.full })),
  toggleShadow: () => toggleShadow(),
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) actions[el.dataset.action]();
});
$('trailer').addEventListener('click', (e) => { if (e.target === e.currentTarget) actions.closeTrailer(); });

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onResize);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { setState({ trailerOpen: false }); if (state.shadow) exitShadow(); }
});

// ---------- shadow mode (webcam pose → robot arms) ----------

let stream = null, landmarker = null, tracking = false, found = false, lastVT;
let shadowPose = null, shadowHead = null;

async function toggleShadow() {
  if (state.shadow) return exitShadow();
  setState({ shadow: true, full: false, shadowBlocked: false, shadowStatus: 'Starting camera' });
  let s;
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('no api'), { name: 'NotSupportedError' });
    s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
  } catch (e) {
    console.warn('camera', e);
    const framed = window.self !== window.top;
    const msg = e.name === 'NotFoundError' ? 'No camera found on this device.'
      : framed ? 'This preview window blocks the camera. Open the page in its own tab.'
      : 'Camera permission was denied. Allow it in the address bar and try again.';
    setState({ shadowStatus: msg, shadowBlocked: framed && e.name !== 'NotFoundError' });
    return;
  }
  try {
    if (!state.shadow) { s.getTracks().forEach(t => t.stop()); return; }
    stream = s;
    video.srcObject = s;
    await video.play();
    if (!landmarker) {
      setState({ shadowStatus: 'Loading tracker' });
      const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
      const vision = await import(base + '/vision_bundle.mjs');
      const files = await vision.FilesetResolver.forVisionTasks(base + '/wasm');
      landmarker = await vision.PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'GPU' },
        runningMode: 'VIDEO', numPoses: 1,
      });
    }
    if (!state.shadow) return;
    tracking = true;
    setState({ shadowStatus: 'Step back so your upper body is in view' });
  } catch (e) {
    console.warn('tracker', e);
    setState({ shadowStatus: 'Motion tracker failed to load. Check your connection and try again.' });
  }
}

function exitShadow() {
  tracking = false;
  stream && stream.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null;
  shadowHead = null; found = false;
  setState({ shadow: false, full: false, shadowStatus: '', shadowBlocked: false });
}

// Tracked pose, in a mirrored world space (x flipped so the robot moves like a
// reflection). A/C = the player's right arm/leg, B/D = left. Directions are unit vectors.
function newPose() {
  const down = () => [0, -1, 0];
  return {
    // arms: upper, lower, hand direction, knuckle line (index → pinky; palm-down rest = backwards)
    A: { u: down(), l: down(), h: down(), s: [0, 0, -1] }, B: { u: down(), l: down(), h: down(), s: [0, 0, -1] },
    C: { u: down(), l: down() }, D: { u: down(), l: down() },   // legs: thigh, shin
    lean: [0, 1, 0],
    yaw: 0,     // whole-body turn (hips)
    twist: 0,   // shoulder turn; the chest adds twist − yaw on top of the body turn
    w: 0, legW: 0,                                               // blend weights (0 = rest pose)
  };
}

function trackShadow(dt) {
  const sp = shadowPose || (shadowPose = newPose());
  if (tracking && landmarker && video.readyState >= 2 && video.currentTime !== lastVT) {
    lastVT = video.currentTime;
    let res = null, hit = false;
    try { res = landmarker.detectForVideo(video, performance.now()); } catch (e) {}
    const L = res && res.worldLandmarks && res.worldLandmarks[0];
    if (L && L[11].visibility > 0.5 && L[12].visibility > 0.5) {
      hit = true;
      const c = (l) => [-l.x, -l.y, -l.z];
      const norm = (d) => { const n = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / n, d[1] / n, d[2] / n]; };
      const dir = (a, b) => { const p = c(L[a]), q = c(L[b]); return norm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]); };
      const m = 0.45;
      const mix = (o, n) => { for (let j = 0; j < 3; j++) o[j] += (n[j] - o[j]) * m; };

      // Arms
      mix(sp.A.u, dir(12, 14)); mix(sp.A.l, dir(14, 16));
      mix(sp.B.u, dir(11, 13)); mix(sp.B.l, dir(13, 15));

      // Hands: wrist bend (wrist → knuckles) and fist twist (index → pinky line).
      const hand = (tg, wr, pk, ix) => {
        if (L[wr].visibility < 0.5) return;
        const W = c(L[wr]), P = c(L[pk]), I = c(L[ix]);
        mix(tg.h, norm([(P[0] + I[0]) / 2 - W[0], (P[1] + I[1]) / 2 - W[1], (P[2] + I[2]) / 2 - W[2]]));
        mix(tg.s, norm([P[0] - I[0], P[1] - I[1], P[2] - I[2]]));
      };
      hand(sp.A, 16, 18, 20); hand(sp.B, 15, 17, 19);

      // Turning: the whole body follows the hip line, the chest adds the
      // shoulders' extra twist on top. Lean comes from hips → shoulders.
      const sh = c(L[12]), sl = c(L[11]);
      const lineYaw = (r, l) => Math.max(-1.3, Math.min(1.3, -Math.atan2(r[2] - l[2], r[0] - l[0])));
      const sy = lineYaw(sh, sl);
      const hipsIn = L[23].visibility > 0.3 && L[24].visibility > 0.3;
      const hy = hipsIn ? lineYaw(c(L[24]), c(L[23])) : sy;
      sp.twist += (sy - sp.twist) * m;
      sp.yaw += (hy - sp.yaw) * m;
      if (hipsIn) {
        const hr = c(L[24]), hl = c(L[23]);
        let up = norm([(sh[0] + sl[0] - hr[0] - hl[0]) / 2, (sh[1] + sl[1] - hr[1] - hl[1]) / 2, (sh[2] + sl[2] - hr[2] - hl[2]) / 2]);
        const MAX = 0.6, h = Math.hypot(up[0], up[2]);
        if (Math.acos(Math.max(-1, Math.min(1, up[1]))) > MAX && h > 1e-6) {
          up = [up[0] / h * Math.sin(MAX), Math.cos(MAX), up[2] / h * Math.sin(MAX)];
        }
        mix(sp.lean, up);
      }

      // Legs — only when the knees are in frame.
      const legsIn = L[25].visibility > 0.5 && L[26].visibility > 0.5;
      if (legsIn) {
        mix(sp.C.u, dir(24, 26)); mix(sp.C.l, L[28].visibility > 0.3 ? dir(26, 28) : dir(24, 26));
        mix(sp.D.u, dir(23, 25)); mix(sp.D.l, L[27].visibility > 0.3 ? dir(25, 27) : dir(23, 25));
      }
      sp.legsIn = legsIn;

      // Head: yaw/pitch from nose vs. ears, roll from the ear line.
      const nose = L[0], er = L[8], el = L[7];
      const ed = Math.hypot(er.x - el.x, er.z - el.z) || 0.15;
      const yaw = Math.max(-0.8, Math.min(0.8, -(nose.x - (er.x + el.x) / 2) / ed * 1.6));
      const pitch = Math.max(-0.45, Math.min(0.45, ((nose.y - (er.y + el.y) / 2) / ed) * 1.4));
      const a = c(er), b = c(el);
      const roll = Math.max(-0.5, Math.min(0.5, Math.atan2(-(b[1] - a[1]), -(b[0] - a[0]))));
      shadowHead = { yaw, pitch, roll };
    }
    if (hit !== found) {
      found = hit;
      setState({ shadowStatus: hit ? 'Tracking. Move and the robot follows.' : 'Step back so your upper body is in view' });
    }
  }
  const goal = tracking && found ? 1 : 0;
  sp.w += (goal - sp.w) * Math.min(1, dt * 4);
  sp.legW += ((goal && sp.legsIn ? 1 : 0) - sp.legW) * Math.min(1, dt * 4);
  if (!tracking) shadowHead = null;
}

const T = { a: new THREE.Vector3(), b: new THREE.Vector3(), T: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), pq: new THREE.Quaternion(), pi: new THREE.Quaternion(), e: new THREE.Euler(), up: new THREE.Vector3(0, 1, 0), k: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Vector3() };
// Assumed knuckle line (index → pinky) of every robot's hand in its rest pose: pointing backwards.
const REST_KNUCKLES = new THREE.Vector3(0, 0, -1);

// Twist a bone about its own length so its knuckle line matches `side`, blended by w.
function roll(bone, side, w) {
  if (!bone.tip) return;
  bone.node.getWorldPosition(T.a);
  T.b.copy(bone.tip); bone.node.localToWorld(T.b);
  const A = T.b.sub(T.a); if (A.lengthSq() < 1e-12) return;
  A.normalize();
  // Where the rest knuckle line has been carried by the bone's current rotation.
  bone.node.getWorldQuaternion(T.pq); T.pi.copy(bone.rq).invert();
  const k = T.k.copy(REST_KNUCKLES).applyQuaternion(T.pi).applyQuaternion(T.pq);
  k.addScaledVector(A, -k.dot(A));
  const s = T.s.set(side[0], side[1], side[2]); s.addScaledVector(A, -s.dot(A));
  if (k.lengthSq() < 1e-4 || s.lengthSq() < 1e-4) return;
  const ang = Math.atan2(T.c.crossVectors(k, s).dot(A), k.dot(s));
  T.q.setFromAxisAngle(A, ang * w);
  worldRot(bone.node, bone.node.quaternion.clone(), T.q);
}

// Rotate `node` by world-space rotation q on top of its rest orientation `base`.
function worldRot(node, base, q) {
  node.parent.getWorldQuaternion(T.pq); T.pi.copy(T.pq).invert();
  node.quaternion.copy(T.pi).multiply(q).multiply(T.pq).multiply(base);
  node.updateMatrixWorld(true);
}

// Swing a bone so the segment from its joint to its tip points along `dir`, blended by w.
function aim(bone, dir, w) {
  if (!bone.tip) return;
  bone.node.getWorldPosition(T.a);
  T.b.copy(bone.tip); bone.node.localToWorld(T.b);
  const D = T.b.sub(T.a); if (D.lengthSq() < 1e-12) return;
  D.normalize();
  T.T.set(dir[0], dir[1], dir[2]).normalize().lerp(D, 1 - w).normalize();
  T.q.setFromUnitVectors(D, T.T);
  worldRot(bone.node, bone.node.quaternion.clone(), T.q);
}

function applyPose(p, i) {
  const rig = p.userData.rig; if (!rig) return;
  rig.joints.forEach(j => j.node.quaternion.copy(j.base));
  const sp = shadowPose;
  const live = i === target && sp && (sp.w > 0.001 || sp.legW > 0.001);
  p.rotation.y = live ? sp.yaw * sp.w : 0;   // whole robot turns with the player's hips
  p.updateMatrixWorld(true);
  if (!live) return;
  const w = sp.w;
  const chestTwist = Math.max(-0.7, Math.min(0.7, sp.twist - sp.yaw)) * w;

  // Chest: lean at the base of the spine, twist at the chest.
  if (rig.spineRoot) {
    T.T.set(sp.lean[0], sp.lean[1], sp.lean[2]).normalize().lerp(T.up, 1 - w).normalize();
    T.q.setFromUnitVectors(T.up, T.T);
    if (rig.spineRoot.node === rig.chest?.node) { T.e.set(0, chestTwist, 0); T.q2.setFromEuler(T.e); T.q.multiply(T.q2); }
    worldRot(rig.spineRoot.node, rig.spineRoot.base, T.q);
  }
  if (rig.chest && rig.chest !== rig.spineRoot) {
    T.e.set(0, chestTwist, 0); T.q.setFromEuler(T.e);
    worldRot(rig.chest.node, rig.chest.node.quaternion.clone(), T.q);
  }

  rig.arms.forEach(a => {
    const tg = a.side > 0 ? sp.A : sp.B;
    aim(a.u, tg.u, w); aim(a.l, tg.l, w);
    // With a hand joint: bend the wrist and twist the hand. Without one, twist the forearm.
    if (a.h) { aim(a.h, tg.h, w * 0.8); roll(a.h, tg.s, w); } else roll(a.l, tg.s, w);
  });
  if (sp.legW > 0.001) rig.legs.forEach(g => { const tg = g.side > 0 ? sp.C : sp.D; aim(g.u, tg.u, sp.legW); aim(g.l, tg.l, sp.legW); });
}

// Find the chest, spine, arm and leg joints. Handles skinned rigs (ValveBiped,
// Mixamo) and node hierarchies where each part mesh hangs off a plain node.
function buildRig(obj) {
  const wp = (o) => o.getWorldPosition(new THREE.Vector3());
  const isAnc = (a, o) => { for (let q = o.parent; q; q = q.parent) if (q === a) return true; return false; };
  // A named node that only holds meshes is a part, not a joint — use its parent.
  const resolve = (o) => (o.isMesh || (!o.isBone && o.children.length && o.children.every(c => c.isMesh))) ? o.parent : o;
  const find = (re, root = obj) => {
    const out = [];
    root.traverse(o => {
      const n = o.name.toLowerCase();
      if (/lcd|end|top|ik[._\d]|ik$|twist/.test(n) || !re.test(n)) return;
      const r = resolve(o); if (r && !out.includes(r)) out.push(r);
    });
    return out;
  };
  const joint = (node, next) => {
    let tip = null;
    if (next) tip = node.worldToLocal(wp(next));
    else {
      // No child joint (e.g. no hand bone): aim at the far side of the part's own meshes.
      const b = new THREE.Box3();
      node.traverse(o => { if (o.isMesh) b.expandByObject(o); });
      if (!b.isEmpty()) { const p = wp(node); tip = node.worldToLocal(b.getCenter(new THREE.Vector3()).sub(p).multiplyScalar(2).add(p)); }
    }
    if (tip && tip.lengthSq() < 1e-10) tip = null;
    return { node, base: node.quaternion.clone(), rq: node.getWorldQuaternion(new THREE.Quaternion()), tip };
  };
  // Hand joint: aim at its end node, or carry on along the forearm if it has none.
  const handJoint = (node, prev) => {
    const p = wp(node);
    let best = null, bd = 1e-5;
    node.children.forEach(ch => { if (ch.isMesh) return; const d = wp(ch).distanceTo(p); if (d > bd) { bd = d; best = ch; } });
    const tipW = best ? wp(best) : p.clone().add(p.clone().sub(wp(prev)).multiplyScalar(0.3));
    return { node, base: node.quaternion.clone(), rq: node.getWorldQuaternion(new THREE.Quaternion()), tip: node.worldToLocal(tipW) };
  };
  const limbs = (upperRe, lowerRe, tipRe, withHand) => {
    const out = [];
    find(upperRe).forEach(u => {
      if (out.some(x => x.u.node === u)) return;
      const l = find(lowerRe, u).find(x => x !== u && isAnc(u, x)); if (!l) return;
      const t = find(tipRe, l).find(x => x !== l && isAnc(l, x));
      out.push({ side: Math.sign(wp(u).x) || 1, u: joint(u, l), l: joint(l, t), h: withHand && t && t.isBone ? handJoint(t, l) : null });
    });
    return out;
  };

  const arms = limbs(/upperarm|leftarm|rightarm/, /forearm|lowerarm/, /hand|wrist/, true);
  const legs = limbs(/thigh|upleg/, /calf|shin|leftleg|rightleg|lowerleg/, /foot|ankle/);

  let chest = null;
  if (arms.length > 1) {
    for (let q = arms[0].u.node.parent; q && q !== obj; q = q.parent) {
      if (isAnc(q, arms[1].u.node)) { chest = q; break; }
    }
  }
  // Spine root: walk down from the chest until the next node would also carry the legs.
  let spineRoot = chest;
  if (chest && legs.length) {
    while (spineRoot.parent && spineRoot.parent !== obj && !legs.some(g => isAnc(spineRoot.parent, g.u.node))) spineRoot = spineRoot.parent;
  }
  const chestJ = chest ? { node: chest, base: chest.quaternion.clone() } : null;
  const rootJ = spineRoot === chest ? chestJ : spineRoot ? { node: spineRoot, base: spineRoot.quaternion.clone() } : null;

  let heads = find(/head/);
  if (heads.some(h => h.isBone)) heads = heads.filter(h => h.isBone);
  heads = heads.filter(h => !heads.some(a => isAnc(a, h)));

  const joints = [chestJ, rootJ, ...[...arms, ...legs].flatMap(x => [x.u, x.l, x.h])].filter((j, k, a) => j && a.indexOf(j) === k);
  return { arms, legs, chest: chestJ, spineRoot: rootJ, joints, heads };
}

// ---------- three.js stage ----------

// Repair export quirks in a loaded mesh:
// - Mirrored parts (e.g. Noisy Boy's right leg and arm) come with their triangle
//   order already reversed. three.js reverses it again for mirrored objects, so the
//   part renders inside-out and black. Put the order back to match the normals.
// - Mirror-smooth, non-metal materials (roughness ~0) reflect the dark room and
//   read as black chrome; give them a little roughness.
function fixMesh(m) {
  const g = m.geometry;
  if (g && g.index && g.attributes.normal) {
    const P = g.attributes.position, N = g.attributes.normal, I = g.index;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    let agree = 0, tot = 0;
    for (let t = 0; t + 2 < I.count; t += 3) {
      a.fromBufferAttribute(P, I.getX(t)); b.fromBufferAttribute(P, I.getX(t + 1)); c.fromBufferAttribute(P, I.getX(t + 2));
      n.fromBufferAttribute(N, I.getX(t));
      if (b.sub(a).cross(c.sub(a)).dot(n) > 0) agree++;
      tot++;
    }
    if (tot && agree / tot < 0.5) {
      m.geometry = g.clone();
      const J = m.geometry.index;
      for (let t = 0; t + 2 < J.count; t += 3) { const x = J.getX(t + 1); J.setX(t + 1, J.getX(t + 2)); J.setX(t + 2, x); }
      J.needsUpdate = true;
    }
  }
  (Array.isArray(m.material) ? m.material : [m.material]).forEach(mat => {
    if (mat && mat.roughness !== undefined && mat.roughness < 0.2 && mat.metalness < 0.5) {
      mat.roughness = 0.35;
      if (mat.clearcoat) mat.clearcoatRoughness = Math.max(mat.clearcoatRoughness, 0.2);
    }
  });
}

function initThree() {
  if (CONFIG.monoModels) stageEl.classList.add('mono');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  stageEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffd9d0, 0x220806, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(3, 5, 5); scene.add(key);
  const rimL = new THREE.DirectionalLight(0xff3a1a, 4); rimL.position.set(-5, 3, -4); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0xff6a4a, 2.5); rimR.position.set(5, 2, -4); scene.add(rimR);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const H = 2.6;
  let dist = 7, distClose = 2.5, distHalf = 4, offX = 0;
  const frame = () => {
    const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(14));
    const narrow = camera.aspect < 0.9 ? 1.5 : 1;
    dist = (H * 1.02) / 2 / tanHalf * narrow;
    distClose = (H * 0.42) / 2 / tanHalf * narrow;
    distHalf = (H * 0.66) / 2 / tanHalf * narrow;   // shadow mode: waist up
    const visW = 2 * dist * tanHalf * camera.aspect;
    offX = w >= 760 ? -visW * 0.2 : 0;
  };
  new ResizeObserver(frame).observe(stageEl); frame();

  const pivots = [];
  const loader = new GLTFLoader();
  ROBOTS.forEach((r, i) => {
    loader.load(r.url, (gltf) => {
      const obj = gltf.scene;
      obj.traverse(o => { if (o.isMesh) fixMesh(o); });
      const measure = () => {
        obj.updateMatrixWorld(true);
        const b = new THREE.Box3();
        obj.traverse(o => { if (o.isMesh && o.visible) { if (o.isSkinnedMesh) o.computeBoundingBox(); b.expandByObject(o, true); } });
        return b.isEmpty() ? new THREE.Box3().setFromObject(obj, true) : b;
      };
      let box = measure();
      const size = box.getSize(new THREE.Vector3());
      obj.scale.multiplyScalar(H / (size.y || 1));
      box = measure();
      const c = box.getCenter(new THREE.Vector3());
      obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;

      const pivot = new THREE.Group(); pivot.add(obj);
      pivot.userData.yaw = 0; pivot.userData.pitch = 0;
      pivot.userData.s = 0; pivot.visible = false;
      scene.add(pivot); pivots[i] = pivot;
      pivot.updateMatrixWorld(true);

      pivot.userData.rig = buildRig(obj);
      pivot.userData.heads = pivot.userData.rig.heads.map(node => ({ node, base: node.quaternion.clone() }));
      pivot.userData.roll = 0;

      setState(s => { const l = s.loaded.slice(); l[i] = true; return { loaded: l }; });
    }, undefined, (e) => console.warn('GLB failed', r.url, e));
  });

  const mouse = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = e.clientY / window.innerHeight - 0.5; });
  const clock = new THREE.Clock();
  const cam = { x: 0, y: 0 };
  let z = state.full ? 1 : 0, sh = 0;
  const tv = new THREE.Vector3(), tE = new THREE.Euler(), tD = new THREE.Quaternion(), tP = new THREE.Quaternion(), tI = new THREE.Quaternion();

  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);

    // Cross-fade: the next robot only grows in once the others have shrunk out.
    const othersOut = pivots.every((p, i) => !p || i === target || p.userData.s < 0.12);
    pivots.forEach((p, i) => {
      if (!p) return;
      const on = i === target && othersOut;
      p.userData.s += ((on ? 1 : 0) - p.userData.s) * Math.min(1, dt * (on ? 5 : 9));
      const s = p.userData.s;
      p.visible = s > 0.01;
      p.scale.setScalar(Math.max(0.0001, 0.7 + 0.3 * s));
      p.position.y = (1 - s) * -0.4;
      p.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.transparent = s < 0.99; m.opacity = s; }); } });
    });

    cam.x += (mouse.x * 0.9 - cam.x) * 0.05; cam.y += (-mouse.y * 0.4 - cam.y) * 0.05;
    z += ((state.full ? 1 : 0) - z) * Math.min(1, dt * 3.5);
    const e = z * z * (3 - 2 * z);
    // In shadow mode the robot moves to the centre and the close view becomes half body.
    sh += ((state.shadow ? 1 : 0) - sh) * Math.min(1, dt * 3.5);
    const f = sh * sh * (3 - 2 * sh);
    const dNear = distClose + (distHalf - distClose) * f;
    const yNear = H * 0.84 + (H * 0.68 - H * 0.84) * f;
    const d = dNear + (dist - dNear) * e;
    const ox = offX * (1 - f) * (d / dist);
    const lookY = yNear + (H * 0.47 - yNear) * e;
    const m = 0.35 + 0.65 * e;
    camera.position.set(ox + cam.x * m, lookY + 0.05 + cam.y * m, d);
    camera.lookAt(ox, lookY, 0);
    camera.updateMatrixWorld();

    trackShadow(dt);
    pivots.forEach((p, i) => { if (p && p.visible) applyPose(p, i); });

    // Head tracking: follow the pointer, or the player's head in shadow mode.
    const mx = mouse.x * 2, my = -mouse.y * 2;
    pivots.forEach((p, i) => {
      if (!p || !p.visible || !p.userData.heads.length) return;
      const u = p.userData, active = i === target && CONFIG.headTracking;
      let ty = 0, tp = 0, tr = 0;
      if (i === target && shadowHead) {
        // The chest already carries the body twist, so the head only adds the rest.
        const sp = shadowPose;
        ty = Math.max(-0.8, Math.min(0.8, shadowHead.yaw - sp.twist * sp.w));
        tp = shadowHead.pitch; tr = shadowHead.roll;
      } else if (active) {
        u.heads[0].node.getWorldPosition(tv).project(camera);
        ty = Math.max(-0.8, Math.min(0.8, (mx - tv.x) * 0.9));
        tp = Math.max(-0.45, Math.min(0.45, -(my - tv.y) * 0.6));
      }
      u.yaw += (ty - u.yaw) * Math.min(1, dt * 6);
      u.pitch += (tp - u.pitch) * Math.min(1, dt * 6);
      u.roll += (tr - u.roll) * Math.min(1, dt * 6);
      tE.set(u.pitch, u.yaw, u.roll, 'YXZ'); tD.setFromEuler(tE);
      u.heads.forEach(h => {
        h.node.parent.getWorldQuaternion(tP);
        tI.copy(tP).invert();
        h.node.quaternion.copy(tI).multiply(tD).multiply(tP).multiply(h.base);
      });
    });

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();
}

renderRobot();
onResize();
onScroll();
initThree();
