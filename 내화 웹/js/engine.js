'use strict';
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??// engine.js  ?? ?섑븰 ?좏떥, ?낅젰, 移대찓?? 臾쇰━ ?ㅽ뀦
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
// ?? ?곸닔 ?????????????????????????????????????????????
const FPS      = 60;
const DT       = 1 / FPS;
const TILE     = 32;
const GRAVITY  = 900;
const MAX_FALL = 600;

// ?? ?섑븰 ?좏떥 ?????????????????????????????????????????
function clamp(v, mn, mx) { return v < mn ? mn : v > mx ? mx : v; }
function lerp(a, b, t)    { return a + (b - a) * t; }
function sgn(v)            { return v > 0 ? 1 : v < 0 ? -1 : 0; }
function dist2(ax,ay,bx,by){ return Math.sqrt((bx-ax)**2+(by-ay)**2); }
function norm(vx,vy) {
  const L = Math.sqrt(vx*vx+vy*vy);
  return L < 1e-6 ? {x:0,y:0} : {x:vx/L, y:vy/L};
}
function angle(vx,vy) { return Math.atan2(vy,vx); }
function degToRad(d)  { return d * Math.PI / 180; }

const ImageAssets = new Map();
function loadImageAsset(src) {
  if (ImageAssets.has(src)) return ImageAssets.get(src);
  const img = new Image();
  const asset = { src, img, loaded: false, failed: false, width: 0, height: 0 };
  img.onload = () => {
    asset.loaded = true;
    asset.width = img.naturalWidth || img.width || 0;
    asset.height = img.naturalHeight || img.height || 0;
  };
  img.onerror = () => { asset.failed = true; };
  img.src = src;
  ImageAssets.set(src, asset);
  return asset;
}

// ?? AABB ?????????????????????????????????????????????
// entity: x=諛쒖쨷?촞, y=諛쒖쨷?촟, hw=諛섑룺, height=?믪씠
function eRect(e) {
  return { l: e.x - e.hw, t: e.y - e.height, r: e.x + e.hw, b: e.y };
}
function overlap(a, b) {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

// ?? ?낅젰 ?????????????????????????????????????????????
const Input = {
  keys: {},
  pressed: {},
  released: {},
  mouseWX: 0,
  mouseWY: 0,
  mouseSX: 0,
  mouseSY: 0,
  mb: {},
  mbPressed: {},
  _capturedCodes: new Set([
    'Space',
    'ShiftLeft', 'ShiftRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'Digit0', 'Digit1', 'Digit2', 'Digit3',
    'Digit6', 'Digit7', 'Digit8', 'Digit9',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ]),

  _isEditableTarget(target) {
    if (!target || typeof target !== 'object') return false;
    const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
    return !!target.isContentEditable ||
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT';
  },

  _isDebugCapturedCode(code) {
    if (!['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(code)) return false;
    return typeof window === 'object' && !!window.NAEHWA_DEBUG_MODE;
  },

  _shouldPreventKeyDefault(e) {
    return (Input._capturedCodes.has(e.code) || Input._isDebugCapturedCode(e.code)) &&
      !Input._isEditableTarget(e.target);
  },
  
    init(canvas) {
      canvas.tabIndex = 0;
      const blockContextMenu = (e) => e.preventDefault();
      window.addEventListener('contextmenu', blockContextMenu, { capture: true });
      document.addEventListener('contextmenu', blockContextMenu, { capture: true });
      window.addEventListener('keydown', e => {
        if (Input._shouldPreventKeyDefault(e))
          e.preventDefault();
        if (!Input.keys[e.code]) Input.pressed[e.code] = true;
        Input.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => {
      if (Input._shouldPreventKeyDefault(e))
        e.preventDefault();
      Input.keys[e.code] = false;
      Input.released[e.code] = true;
    });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      const sx = (e.clientX - r.left) * (canvas.width  / r.width);
      const sy = (e.clientY - r.top)  * (canvas.height / r.height);
      Input.mouseSX = sx; Input.mouseSY = sy;
      const w = Camera.toWorld(sx, sy);
      Input.mouseWX = w.x; Input.mouseWY = w.y;
    });
    canvas.addEventListener('mousedown', e => {
      canvas.focus?.();
      Input.mb[e.button] = true;
      Input.mbPressed[e.button] = true;
      e.preventDefault();
    });
    canvas.addEventListener('mouseup', e => {
      Input.mb[e.button] = false;
      e.preventDefault();
    });
      canvas.addEventListener('contextmenu', blockContextMenu, { capture: true });
    },

  flush() {
    Input.pressed  = {};
    Input.released = {};
    Input.mbPressed = {};
  },

  isDown(c)        { return !!Input.keys[c]; },
  isJust(c)        { return !!Input.pressed[c]; },
  isJustRel(c)     { return !!Input.released[c]; },
  isMbDown(b)      { return !!Input.mb[b]; },
  isMbJust(b)      { return !!Input.mbPressed[b]; },
  axis(neg, pos)   { return (Input.isDown(pos)?1:0) - (Input.isDown(neg)?1:0); },
};

// ?? 移대찓??????????????????????????????????????????????
const Camera = {
  x: 0, y: 0,
  vw: 960, vh: 576,
  rw: 1920, rh: 576,
  scale: 1,
  
  snap(ex, ey) {
    this.x = clamp(ex - this.vw/2, 0, this.rw - this.vw);
    this.y = clamp(ey - 32 - this.vh/2, 0, Math.max(0, this.rh - this.vh));
  },
  follow(ex, ey) {
    const tx = clamp(ex - this.vw/2, 0, this.rw - this.vw);
    const ty = clamp(ey - 32 - this.vh/2, 0, Math.max(0, this.rh - this.vh));
      this.x = lerp(this.x, tx, 0.12);
      this.y = lerp(this.y, ty, 0.12);
    },
    toWorld(sx, sy)  {
      const inv = this.scale > 0 ? 1 / this.scale : 1;
      return { x: sx * inv + this.x, y: sy * inv + this.y };
    },
  toScreen(wx, wy) {
    return { x: (wx - this.x) * this.scale, y: (wy - this.y) * this.scale };
  },
};

// ?? 臾쇰━ ?ㅽ뀦 ?꾩궛湲???????????????????????????????????
const PhysicsAccum = {
  acc: 0,
  steps: 0,
  update(dt) {
    this.acc += dt;
    this.steps = 0;
    while (this.acc >= DT) { this.acc -= DT; this.steps++; }
    // 理쒕? 4 ?ㅽ뀦 諛⑹?
    if (this.steps > 4) this.steps = 4;
  },
};

// ?? ?대룞 + 異⑸룎 ?닿껐 (move_and_slide ?ы똿) ?????????????
// tiles: ?뺤쟻 {l,t,r,b} 諛곗뿴, entity: {x,y,vx,vy,hw,height}
// 諛섑솚: {onFloor, onWall, onCeil}
function moveAndSlide(e, tiles) {
  let onFloor = false, onWall = false, onCeil = false;
  const ignoreOneWay = (e.dropThroughTimer ?? 0) > 0;
  const PLATFORM_LAND_X_MARGIN = 12;

  e.x += e.vx * DT;
  for (const t of tiles) {
    if (t.oneWay) continue;
    const r = eRect(e);
    if (!overlap(r, t)) continue;
    const ol = r.r - t.l;
    const or2 = t.r - r.l;
    if (ol < or2) { e.x -= ol; if (e.vx > 0) { e.vx = 0; onWall = true; } }
    else           { e.x += or2; if (e.vx < 0) { e.vx = 0; onWall = true; } }
  }

  const prevY = e.y;
  e.y += e.vy * DT;
  for (const t of tiles) {
    const r = eRect(e);
    if (t.oneWay) {
      if (ignoreOneWay) continue;
      const horizontalOverlap =
        r.r > t.l - PLATFORM_LAND_X_MARGIN &&
        r.l < t.r + PLATFORM_LAND_X_MARGIN;
      if (!horizontalOverlap) continue;
      if (r.b <= t.t || r.t >= t.b) continue;
      const ot = r.b - t.t;
      const ob = t.b - r.t;
      if (ot < ob && e.vy >= 0 && prevY <= t.t) {
        e.y -= ot;
        e.vy = 0;
        onFloor = true;
      }
      continue;
    }
    if (!overlap(r, t)) continue;
    const ot = r.b - t.t;
    const ob = t.b - r.t;
    {
      if (ot < ob) {
        e.y -= ot;
        if (e.vy > 0) { e.vy = 0; onFloor = true; }
      } else {
        e.y += ob;
        if (e.vy < 0) { e.vy = 0; onCeil = true; }
      }
    }
  }
  return { onFloor, onWall, onCeil };
}
function clampToRoomBounds(e) {
  if (typeof ROOM_W !== 'number' || typeof ROOM_H !== 'number') return;
  e.x = clamp(e.x, e.hw, ROOM_W - e.hw);
  e.y = clamp(e.y, e.height, ROOM_H);
}

const DmgNumbers = [];
function spawnDmgNum(x, y, val, color='#ff4') {
  DmgNumbers.push({ x, y, val: Math.round(val), t: 0, color });
}
function updateDmgNumbers() {
  for (let i = DmgNumbers.length-1; i >= 0; i--) {
    const d = DmgNumbers[i];
    d.t += DT;
    d.y -= 40 * DT;
    if (d.t > 1.0) DmgNumbers.splice(i, 1);
  }
}
function drawDmgNumbers(ctx) {
  for (const d of DmgNumbers) {
    const s = Camera.toScreen(d.x, d.y);
    const alpha = clamp(1 - d.t, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = d.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d.val, s.x, s.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ?? ?쒓컖 ?댄럺??紐⑸줉 ??????????????????????????????????
const Vfx = [];
function addVfx(v) { Vfx.push(v); }
function updateVfx() {
  for (let i = Vfx.length-1; i >= 0; i--) {
    Vfx[i].t += DT;
    if (Vfx[i].t >= Vfx[i].dur) Vfx.splice(i, 1);
  }
}
function drawVfx(ctx) {
  for (const v of Vfx) {
    const s = Camera.toScreen(v.x, v.y);
    const p = v.t / v.dur;
    ctx.globalAlpha = (1 - p) * (v.alpha ?? 0.7);
    if (v.type === 'rect') {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(v.rot ?? 0);
      ctx.fillStyle = v.color;
      ctx.fillRect(-v.w/2, -v.h/2, v.w, v.h);
      ctx.restore();
    } else if (v.type === 'circle') {
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, v.r * (1 + p * 0.3), 0, Math.PI*2);
      ctx.fill();
    } else if (v.type === 'ring') {
      ctx.save();
      ctx.strokeStyle = v.color;
      ctx.lineWidth = (v.lineWidth ?? 3) * (1 - p * 0.35);
      ctx.beginPath();
      ctx.arc(s.x, s.y, v.r * (1 + p * (v.expand ?? 0.18)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (v.type === 'slashArc') {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(v.rot ?? 0);
      ctx.strokeStyle = v.color;
      ctx.lineWidth = (v.lineWidth ?? 5) * (1 - p * 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, v.r * (1 + p * 0.08), v.a0, v.a1);
      ctx.stroke();
      if (v.coreColor) {
        ctx.globalAlpha *= 0.8;
        ctx.strokeStyle = v.coreColor;
        ctx.lineWidth = Math.max(1, (v.lineWidth ?? 5) * 0.45);
        ctx.beginPath();
        ctx.arc(0, 0, v.r * (1 + p * 0.03), v.a0 + 0.03, v.a1 - 0.03);
        ctx.stroke();
      }
      ctx.restore();
      } else if (v.type === 'hitSpark') {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(v.rot ?? 0);
        ctx.strokeStyle = v.color;
      ctx.lineWidth = (v.lineWidth ?? 2.5) * (1 - p * 0.2);
      const rays = v.rays ?? 5;
      const len = (v.len ?? 16) * (1 + p * 0.18);
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2;
        const x0 = Math.cos(angle) * len * 0.18;
        const y0 = Math.sin(angle) * len * 0.18;
        const x1 = Math.cos(angle) * len;
        const y1 = Math.sin(angle) * len;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        ctx.restore();
      } else if (v.type === 'sprite') {
        if (!v.asset || !v.asset.loaded || v.asset.failed) continue;
        const scale = 1 + p * (v.scaleRate ?? 0);
        const w = (v.w ?? v.asset.width) * scale;
        const h = (v.h ?? v.asset.height) * scale;
        const anchorX = v.anchorX ?? 0.5;
        const anchorY = v.anchorY ?? 0.5;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(v.rot ?? 0);
        ctx.scale(v.flipX ? -1 : 1, v.flipY ? -1 : 1);
        if (v.blend) ctx.globalCompositeOperation = v.blend;
        ctx.drawImage(v.asset.img, -w * anchorX, -h * anchorY, w, h);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

