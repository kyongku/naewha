'use strict';
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??// player.js  ?? ?뚮젅?댁뼱 + 紐⑤뱺 ?쒕툕?쒖뒪??// (combo / dash / axe / oxygen / ranged)
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
// ?? HP 援ш컙 ???????????????????????????????????????????
const HP_PHASE = { NORMAL: 0, FIRE: 1, FIREMAN: 2 };
const PHASE_THRESHOLD_RATIOS = {
  FIREMAN: 0.3,
  NORMAL: 0.6,
};
const TEMP_COMBAT_FORM = { WATER: 'WATER' };
// Temporary WATER Heat Mode damage reduction. Final value should be tuned after playtesting.
const WATER_HEAT_DAMAGE_REDUCTION_RATIO = 0.3;

const PHASE_COLORS = {
  [HP_PHASE.NORMAL]:  '#4d82e0',
  [HP_PHASE.FIRE]:    '#ff8022',
  [HP_PHASE.FIREMAN]: '#e51a1a',
};
const SPEED_MUL = { [HP_PHASE.NORMAL]:1.0, [HP_PHASE.FIRE]:1.3, [HP_PHASE.FIREMAN]:1.7 };
const AXE_DASH_DEBUG = false;

const PlayerSkillMetadata = {
  dash: {
    id: 'dash',
    name: 'Dash',
    category: 'mobility',
    unlockFlag: 'dashUnlocked',
    inputHint: 'Shift',
    description: 'A short horizontal evasive dash with brief invulnerability.',
    source: 'DashSystem',
  },
  axeThrow: {
    id: 'axeThrow',
    name: 'Axe Throw',
    category: 'weapon',
    unlockFlag: 'hasAxe',
    inputHint: 'Right Click',
    description: 'Throws the equipped axe toward the cursor when the axe is available.',
    source: 'AxeSystem',
  },
  axeAnchorDash: {
    id: 'axeAnchorDash',
    name: 'Axe Anchor Dash',
    category: 'mobility',
    unlockFlag: 'hasAxe',
    inputHint: 'Right Click on stuck axe',
    description: 'Dashes toward a stuck axe after targeting its position.',
    source: 'AxeSystem',
  },
  axeUpgrade: {
    id: 'axeUpgrade',
    name: 'Axe Upgrade',
    category: 'weapon',
    unlockFlag: 'hasAxeUpgrade',
    inputHint: 'Passive',
    description: 'Improves axe-related actions. Exact balance is not finalized.',
    source: 'AxeSystem',
  },
  oxygenBurst: {
    id: 'oxygenBurst',
    name: 'Oxygen Burst',
    category: 'oxygen',
    unlockFlag: null,
    inputHint: 'W',
    description: 'Consumes oxygen to trigger a close-range burst and movement surge.',
    source: 'OxygenSystem',
  },
  oxygenChannel: {
    id: 'oxygenChannel',
    name: 'Oxygen Channel',
    category: 'oxygen',
    unlockFlag: null,
    inputHint: 'Hold Q',
    description: 'Channels oxygen to gain oxygen if uninterrupted.',
    source: 'OxygenSystem',
  },
  skill3Heal: {
    id: 'skill3Heal',
    name: 'Skill 3 Heal',
    category: 'oxygen',
    unlockFlag: 'hasOxygen',
    inputHint: '3',
    description: 'Consumes oxygen to restore health on cooldown.',
    source: 'OxygenSystem',
  },
  oxygenUnlock: {
    id: 'oxygenUnlock',
    name: 'Oxygen',
    category: 'resource',
    unlockFlag: 'hasOxygen',
    inputHint: 'Passive',
    description: 'Unlocks the Oxygen resource layer and its future systems.',
    source: 'BossRewardLayer',
  },
  heatUnlock: {
    id: 'heatUnlock',
    name: 'Heat Control',
    category: 'resource',
    unlockFlag: 'hasHeat',
    inputHint: 'Passive',
    description: 'Unlocks active Heat combat usage such as Heat Mode and Heat-consuming ranged attacks.',
    source: 'BossRewardLayer',
  },
  smokeUnlock: {
    id: 'smokeUnlock',
    name: 'Smoke',
    category: 'resource',
    unlockFlag: 'hasSmoke',
    inputHint: 'Passive',
    description: 'Unlocks the Smoke resource layer and its future systems.',
    source: 'BossRewardLayer',
  },
  oxygenShield: {
    id: 'oxygenShield',
    name: 'Oxygen Shield',
    category: 'oxygen',
    unlockFlag: 'shieldUnlocked',
    inputHint: 'Passive on hit',
    description: 'Consumes oxygen defensively to negate incoming damage when unlocked.',
    source: 'OxygenSystem',
  },
  rangedAttack: {
    id: 'rangedAttack',
    name: 'Ranged Attack',
    category: 'offense',
    unlockFlag: null,
    inputHint: 'Right Click without available axe',
    description: 'Uses the current HP phase to fire a ranged attack when the axe is unavailable.',
    source: 'RangedSystem',
  },
};

const PlayerSpriteAssets = (() => {
  const makeSprite = (src) => {
    const img = new Image();
    const asset = { img, loaded: false, failed: false };
    img.onload = () => { asset.loaded = true; };
    img.onerror = () => { asset.failed = true; };
    img.src = src;
    return asset;
  };
  return {
    idle: makeSprite('assets/sprites/player-idle.svg'),
    attack: makeSprite('assets/sprites/player-hit.svg'),
    dash: makeSprite('assets/sprites/player-dash.svg'),
  };
})();

// ?? ComboSystem ???????????????????????????????????????
class ComboSystem {
    constructor(player) {
    this.player = player;
    // ?곹깭: 'idle','startup','active','recovery','cooldown'
    this.state = 'idle';
    this.idx   = 0;   // ?꾩옱 ? (0/1/2)
    this.tick  = 0;
    this.queued = false;

    // Axe-held combo profile.
    this.axeHits = [
      { startup:3, active:4, recovery:9, damage:45 },
      { startup:3, active:4, recovery:9, damage:45 },
      { startup:3, active:4, recovery:9, damage:45 },
    ];
    // Faster, weaker fallback when the axe is not in hand.
    this.unarmedHits = [
      { startup:2, active:3, recovery:5, damage:22 },
      { startup:2, active:3, recovery:5, damage:22 },
      { startup:2, active:3, recovery:5, damage:22 },
    ];
    this.axeHitCd     = [22, 22, 22];
    this.unarmedHitCd = [14, 14, 14];
    this.TIMEOUT    = 60;
    this.isActiveNow = false;
    this._attackStyle = 'axe';
  }

  _usesAxeProfile() { return this._attackStyle === 'axe'; }
  _getHits() { return this._usesAxeProfile() ? this.axeHits : this.unarmedHits; }
  _getHitCd() { return this._usesAxeProfile() ? this.axeHitCd : this.unarmedHitCd; }

  request() {
    if (this.state === 'idle') {
      this._attackStyle = this.player.axeSys && this.player.axeSys.hasAxe ? 'axe' : 'unarmed';
      this._startHit(0);
    }
    else if (this.state === 'recovery') this.queued = true;
    else if (this.state === 'cooldown') {
      if (this.tick >= this._getHitCd()[this.idx]) this._advance();
      else this.queued = true;
    }
  }

  tick_() {
    if (this.state === 'idle') return;
    this.tick++;
    const d = this._getHits()[this.idx];
    switch(this.state) {
      case 'startup':
        if (this.tick >= d.startup) { this._enterActive(d); } break;
      case 'active':
        if (this.tick >= d.active)  { this._enterRecovery(); } break;
      case 'recovery':
        if (this.tick >= d.recovery){ this._enterCooldown(); } break;
      case 'cooldown':
        this._processCooldown(); break;
    }
  }

  _startHit(i) {
    this.idx = i; this.tick = 0; this.state = 'startup';
    this.isActiveNow = false;
  }
  _enterActive(d) {
    this.tick = 0; this.state = 'active'; this.isActiveNow = true;
    const mul = SPEED_MUL[this.player.phase];
    this.player._onAttackActive(this.idx, d.damage * mul, this._attackStyle);
  }
  _enterRecovery() {
    this.tick = 0; this.state = 'recovery'; this.isActiveNow = false;
  }
  _enterCooldown() { this.tick = 0; this.state = 'cooldown'; }
  _processCooldown() {
    const cd = this._getHitCd()[this.idx];
    if (this.tick >= cd) {
      if (this.queued) { this.queued = false; this._advance(); return; }
      if (this.tick >= this.TIMEOUT) this._reset();
    }
  }
  _advance() {
    const next = this.idx + 1;
    if (next >= this._getHits().length) this._reset();
    else this._startHit(next);
  }
  _reset() {
    this.state = 'idle'; this.idx = 0; this.tick = 0;
    this.queued = false; this.isActiveNow = false;
    this._attackStyle = 'axe';
  }
  isAttacking() { return this.state !== 'idle'; }
}

// ?? DashSystem ????????????????????????????????????????
class DashSystem {
  constructor(player) {
    this.player = player;
    this.DIST   = 128;
    this.DUR    = 0.15;
    this.CD     = 2.5;
    this.IFRAME_DUR = 0.12;
    this._dashing   = false;
    this._timer     = 0;
    this._cdTimer   = 0;
    this._velX      = 0;
  }

  tick_(dt) {
    if (this._cdTimer > 0) this._cdTimer -= dt;
    if (this._dashing) {
      this._timer -= dt;
      this.player.vx = this._velX;
      if (this._timer <= 0) this._end();
    }
  }

  request() {
    if (!this.player.dashUnlocked) return;
    if (this._dashing || this._cdTimer > 0) return;
    this._start();
  }

  _start() {
    this._dashing = true;
    this._timer   = this.DUR;
    this.player.invincibleTimer = Math.max(this.player.invincibleTimer, this.IFRAME_DUR);
    let dx = Input.axis('KeyA', 'KeyD');
    if (dx === 0) dx = this.player.facing;
    this._velX = dx * (this.DIST / this.DUR);
  }
  _end() {
    this._dashing = false;
    this._cdTimer = this.CD;
    this._velX    = 0;
  }
  isDashing()      { return this._dashing; }
  getCdRatio()     { return clamp(this._cdTimer / this.CD, 0, 1); }
}

// ?? AxeSystem ?????????????????????????????????????????
class AxeSystem {
  constructor(player) {
    this.player      = player;
    this.hasAxe      = true;
    this.isUpgraded  = false;
    this._axe        = null;
    this._dashing    = false;
      this._pathIndex  = 1;
      this._pickupCd   = 0;
      this.DASH_SPEED  = 800;
      this.ANCHOR_MOUSE_PICK_RADIUS = 38.4;
      this.FLYING_MOUSE_PICK_RADIUS = 48;

      // 寃쎈줈 異붿쟻
      this._navPath        = [];
    this._currentTiles   = [];
    this._lastPathFrom   = { x: Infinity, y: Infinity };
    this._lastPathTo     = { x: Infinity, y: Infinity };
    this._axeWasFlying   = false;
      this.WAYPOINT_REACH  = 20;
      this.PATH_CACHE_DIST = 8;
    }

    _isFinitePoint(x, y) {
      return Number.isFinite(x) && Number.isFinite(y);
    }

    _isPointInsideRoom(x, y) {
      const minX = this.player.hw;
      const maxX = ROOM_W - this.player.hw;
      const halfH = this.player.height / 2;
      const minY = halfH;
      const maxY = FLOOR_Y - halfH;
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    _clampGoalToRoom(goal) {
      if (!goal || !this._isFinitePoint(goal.x, goal.y)) return null;
      const minX = this.player.hw;
      const maxX = ROOM_W - this.player.hw;
      const halfH = this.player.height / 2;
      const minY = halfH;
      const maxY = FLOOR_Y - halfH;
      return {
        x: clamp(goal.x, minX, maxX),
        y: clamp(goal.y, minY, maxY),
      };
    }

    _cancelInvalidAnchor(reason) {
      if (reason === 'invalid')
        console.warn('invalid axe anchor target');
      else if (reason === 'outside')
        console.warn('axe target outside room bounds');
      this._dashing = false;
      this.player.vx = 0;
      this.player.vy = 0;
      if (this._axe && !this._axe.isDead) this._axe.pickup();
    }

    _debugDashStart(goal) {
      if (!AXE_DASH_DEBUG || !this._axe) return;
      const host = this._axe.hostEntity || null;
      const stuckType = host ? 'enemy' : (this._axe.isStuck() ? 'tile' : 'flying');
      console.log('axe dash start', {
        axeX: this._axe.x,
        axeY: this._axe.y,
        targetX: goal ? goal.x : null,
        targetY: goal ? goal.y : null,
        playerX: this.player.x,
        playerY: this.player.y,
        roomBounds: { minX: 0, maxX: ROOM_W, minY: 0, maxY: FLOOR_Y },
        stuckType,
        hostEntity: host ? {
          alive: !host.isDead,
          dead: !!host.isDead,
          removeMe: !!host.removeMe,
          x: host.x,
          y: host.y,
        } : null,
      });
      // Likely failure candidates:
      // - enemy-stuck axe position resolves inside target hitbox or near floor bounds
      // - computed goal is valid numerically but unsuitable for collision-free landing
    }

    _findDashAnchor() {
      if (!this._axe) return null;
      if (this._axe.hostEntity && !this._axe.hostEntity.isDead && !this._axe.hostEntity.removeMe) {
        const hostRect = eRect(this._axe.hostEntity);
        const playerCenter = { x: this.player.x, y: this.player.y - this.player.height / 2 };
        const candidates = [
          { side: 'top',    x: clamp(this._axe.x, hostRect.l, hostRect.r), y: hostRect.t - this.player.height / 2 },
          { side: 'bottom', x: clamp(this._axe.x, hostRect.l, hostRect.r), y: hostRect.b + this.player.height / 2 },
          { side: 'left',   x: hostRect.l - this.player.hw, y: clamp(this._axe.y, hostRect.t, hostRect.b) },
          { side: 'right',  x: hostRect.r + this.player.hw, y: clamp(this._axe.y, hostRect.t, hostRect.b) },
        ];
        let best = null;
        let bestScore = Infinity;
        for (const c of candidates) {
          const score = dist2(playerCenter.x, playerCenter.y, c.x, c.y);
          if (score < bestScore) {
            bestScore = score;
            best = { side: c.side, rect: hostRect, kind: 'enemy' };
          }
        }
        return best;
      }
      const stickOffset = 18;
      let best = null;
      let bestScore = Infinity;
      for (const t of this._currentTiles || []) {
        const candidates = t.oneWay
          ? [{ side: 'top', x: clamp(this._axe.x, t.l, t.r), y: t.t - stickOffset }]
          : [
              { side: 'top',    x: clamp(this._axe.x, t.l, t.r), y: t.t - stickOffset },
              { side: 'bottom', x: clamp(this._axe.x, t.l, t.r), y: t.b + stickOffset },
              { side: 'left',   x: t.l - stickOffset, y: clamp(this._axe.y, t.t, t.b) },
              { side: 'right',  x: t.r + stickOffset, y: clamp(this._axe.y, t.t, t.b) },
            ];
        for (const c of candidates) {
            const score = dist2(this._axe.x, this._axe.y, c.x, c.y);
            if (score < bestScore) {
              bestScore = score;
              best = { tile: t, side: c.side, kind: 'tile' };
            }
          }
        }
      return bestScore <= 24 ? best : null;
    }

    _getDashGoal() {
      if (!this._axe) return null;
      if (!this._axe.isStuck()) {
        return this._clampGoalToRoom({ x: this._axe.x, y: this._axe.y });
      }
      const anchor = this._findDashAnchor();
      if (!anchor) {
        return this._clampGoalToRoom({ x: this._axe.x, y: this._axe.y });
      }
      if (anchor.kind === 'enemy') {
        const r = anchor.rect;
        let goal;
        switch (anchor.side) {
          case 'top':    goal = { x: clamp(this._axe.x, r.l + this.player.hw, r.r - this.player.hw), y: r.t - this.player.height / 2 }; break;
          case 'bottom': goal = { x: clamp(this._axe.x, r.l + this.player.hw, r.r - this.player.hw), y: r.b + this.player.height / 2 }; break;
          case 'left':   goal = { x: r.l - this.player.hw, y: clamp(this._axe.y, r.t, r.b) }; break;
          case 'right':  goal = { x: r.r + this.player.hw, y: clamp(this._axe.y, r.t, r.b) }; break;
          default:       goal = { x: this._axe.x, y: this._axe.y };
        }
        return this._clampGoalToRoom(goal);
      }
      const t = anchor.tile;
      let goal;
      switch (anchor.side) {
        case 'top':    goal = { x: this._axe.x, y: t.t - this.player.height / 2 }; break;
        case 'bottom': goal = { x: this._axe.x, y: t.b + this.player.height / 2 }; break;
        case 'left':   goal = { x: t.l - this.player.hw, y: this._axe.y }; break;
        case 'right':  goal = { x: t.r + this.player.hw, y: this._axe.y }; break;
        default:       goal = { x: this._axe.x, y: this._axe.y };
      }
      return this._clampGoalToRoom(goal);
    }

    _snapPlayerToGoal(goal) {
      if (!goal) return;
      const safeGoal = this._clampGoalToRoom(goal);
      if (!safeGoal) {
        console.warn('invalid axe anchor target');
        return;
      }
      if (!this._isPointInsideRoom(safeGoal.x, safeGoal.y)) {
        console.warn('axe target outside room bounds');
        return;
      }
      this.player.x = safeGoal.x;
      this.player.y = safeGoal.y + this.player.height / 2;
      clampToRoomBounds(this.player);
    }

  tick_(dt, tiles) {
    this._currentTiles = tiles;
    if (this._pickupCd > 0) this._pickupCd -= dt;

    // ?먮룞 以띻린: 諛붾떏 ?꾨겮??Y 湲곗?, ?뚮옯???꾨겮??洹쇱젒 湲곗?
    if (!this._dashing && this._axe && !this._axe.isDead &&
        this._pickupCd <= 0) {
      const playerRect = eRect(this.player);
      const nearestX = clamp(this._axe.x, playerRect.l, playerRect.r);
      const nearestY = clamp(this._axe.y, playerRect.t, playerRect.b);
      const canPickup = dist2(this._axe.x, this._axe.y, nearestX, nearestY) <= 32;
      const ceilingPickup =
        this._axe.isStuck() &&
        this._axe.y <= TILE + 16 &&
        Math.abs(this.player.x - this._axe.x) <= this.player.hw + 16 &&
        playerRect.t <= TILE + 24;
      if (canPickup || ceilingPickup) { this._axe.pickup(); return; }
    }

      if (!this._dashing && this._axe && !this._axe.isDead) {
        if (this._axe.isStuck()) {
          // 寃쎈줈 罹먯떆 媛깆떊 (?뚮젅?댁뼱媛 ?쇱젙 嫄곕━ ?댁긽 ?대룞?덉쓣 ??
          const from    = { x: this.player.x, y: this.player.y - 32 };
          const to      = this._getDashGoal() || { x: this._axe.x, y: this._axe.y - 32 };
          const movedFrom = dist2(from.x, from.y, this._lastPathFrom.x, this._lastPathFrom.y);
          const movedTo   = dist2(to.x,   to.y,   this._lastPathTo.x,   this._lastPathTo.y);
          if (movedFrom > this.PATH_CACHE_DIST || movedTo > this.PATH_CACHE_DIST ||
              this._navPath.length === 0) {
          this._navPath      = this._findPath(tiles, from, to) || [];
          this._lastPathFrom = { x: from.x, y: from.y };
          this._lastPathTo   = { x: to.x,   y: to.y   };
        }
      } else {
        // ?꾨겮 鍮꾪뻾 以? 吏곸꽑 ?쒖떆
        this._navPath = [];
        this._lastPathFrom = { x: Infinity, y: Infinity };
      }
    }

    if (this._dashing) this._processDash();
  }

    requestRightClick(wx, wy) {
      if (this._dashing) return;

      if (this._axe && !this._axe.isDead) {
        // mouse pick radius reduced for more precise axe anchor selection
        const dashRange = this._axe.isStuck()
          ? this.ANCHOR_MOUSE_PICK_RADIUS
          : this.FLYING_MOUSE_PICK_RADIUS;
        if (dist2(wx, wy, this._axe.x, this._axe.y) < dashRange) this._startDash();
        else if (this.player.phase !== HP_PHASE.NORMAL) this.player.rangedSys.requestRanged(wx, wy);
        return;
      }
    if (this.hasAxe) {
      if (dist2(this.player.x, this.player.y - 32, wx, wy) < 32) return;
      this._throw(wx, wy);
      return;
    }

    this.player.rangedSys.requestRanged(wx, wy);
  }

  _throw(wx, wy) {
    this.hasAxe    = false;
    this._pickupCd = 0.5;
    this._navPath      = [];
    this._lastPathFrom = { x: Infinity, y: Infinity };
    this._lastPathTo   = { x: Infinity, y: Infinity };
    const AXE_RADIUS = 12;
    const spawnX   = this.player.x + 16 * Math.sign(wx - this.player.x);
    const spawnY   = Math.max(this.player.y - 32, TILE + AXE_RADIUS + 4);
    const d        = norm(wx - spawnX, wy - spawnY);
    const speed    = 700;
    const axe      = new Axe(spawnX, spawnY, d.x * speed, d.y * speed,
                             this.player, this.isUpgraded);
    this._axe = axe;
    Projectiles.add(axe);
  }

      _startDash() {
        if (!this._axe) return;
        const from = { x: this.player.x, y: this.player.y - 32 };
        const to   = this._getDashGoal();
        this._debugDashStart(to);
        if (!to || !this._isFinitePoint(to.x, to.y)) { this._cancelInvalidAnchor('invalid'); return; }
        if (!this._isPointInsideRoom(to.x, to.y)) { this._cancelInvalidAnchor('outside'); return; }
        const path = this._findPath(this._currentTiles, from, to) ||
                     (this._navPath.length >= 2 ? [from, ...this._navPath.slice(1)] : null) ||
                     [from, to];
        this._navPath   = path;
        this._pathIndex = 1;
        this._axeWasFlying = false;
        this._dashing   = true;
      }

      _processDash() {
        if (!this._axe || this._axe.isDead) { this._endDash(false); return; }
        if (this._pathIndex >= this._navPath.length) { this._endDash(false); return; }

        const goal = this._getDashGoal();
        if (!goal || !this._isFinitePoint(goal.x, goal.y)) { this._cancelInvalidAnchor('invalid'); return; }
        if (!this._isPointInsideRoom(goal.x, goal.y)) { this._cancelInvalidAnchor('outside'); return; }

        const cx = this.player.x, cy = this.player.y - 32;
        if (dist2(cx, cy, goal.x, goal.y) < 20) {
          this._snapPlayerToGoal(goal);
          this._endDash(true); return;
        }

      if (!this._axe.isStuck()) {
        this._axeWasFlying = true;
        const dir = norm(goal.x - cx, goal.y - cy);
        this.player.vx = dir.x * this.DASH_SPEED;
        this.player.vy = dir.y * this.DASH_SPEED;
        return;
      }

      if (this._axeWasFlying) {
        this._axeWasFlying = false;
        const from = { x: cx, y: cy };
        const path = this._findPath(this._currentTiles, from, goal) ||
                     (this._navPath.length >= 2 ? [from, ...this._navPath.slice(1)] : null) ||
                     [from, goal];
        this._navPath = path;
        this._pathIndex = 1;
        }

        const target = this._navPath[this._pathIndex];
        if (!target || !this._isFinitePoint(target.x, target.y)) { this._cancelInvalidAnchor('invalid'); return; }
        if (dist2(cx, cy, target.x, target.y) < this.WAYPOINT_REACH) {
          this._pathIndex++;
          if (this._pathIndex >= this._navPath.length) {
            this._snapPlayerToGoal(goal);
            this._endDash(true); return;
          }
        }

      const next = this._navPath[this._pathIndex];
      if (!next || !this._isFinitePoint(next.x, next.y)) { this._cancelInvalidAnchor('invalid'); return; }
      const dir = norm(next.x - cx, next.y - cy);
      this.player.vx = dir.x * this.DASH_SPEED;
      this.player.vy = dir.y * this.DASH_SPEED;
    }

  _endDash(pickupAxe = false) {
    this._dashing  = false;
    this.player.vx = 0;
    this.player.vy = 0;
    if (pickupAxe && this._axe && !this._axe.isDead) this._axe.pickup();
  }

  onAxePickedUp() {
    this.hasAxe        = true;
    this._axe          = null;
    this._dashing      = false;
    this._navPath      = [];
    this._axeWasFlying = false;
    this._lastPathFrom = { x: Infinity, y: Infinity };
    this._lastPathTo   = { x: Infinity, y: Infinity };
  }

  upgrade()   { this.isUpgraded = true; }
  isDashing() { return this._dashing; }

  drawRope(ctx) {
    if (!this._axe || this._axe.isDead) return;
    const armX = this.player.x, armY = this.player.y - 32;

    // Always end the rope at the live axe position. Cached path points are
    // useful as intermediate bends, but must not replace the actual axe end.
    const pts = [{ x: armX, y: armY }];
    if (this._navPath.length >= 3) {
      pts.push(...this._navPath.slice(1, -1));
    }
    pts.push({ x: this._axe.x, y: this._axe.y });

    ctx.strokeStyle = '#6b4515';
    ctx.lineWidth   = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const s0 = Camera.toScreen(pts[0].x, pts[0].y);
    ctx.moveTo(s0.x, s0.y);
    for (let i = 1; i < pts.length; i++) {
      const si = Camera.toScreen(pts[i].x, pts[i].y);
      ctx.lineTo(si.x, si.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  }

  // ?? 寃쎈줈 ?먯깋 (Liang-Barsky 媛?쒖꽑) ??????????????????

    _findPath(tiles, from, to) {
      const solids = (tiles || []).filter(t => !t.oneWay || this._oneWayBlocksPath(t, from, to));
      // Option A: Minkowski sum ???뚮젅?댁뼱 諛섑겕湲곕쭔??????쎌갹 (?뚮뜑留?臾쇰━??誘몄쟻??
      const PW = 16, PH = 32;  // ?뚮젅?댁뼱 hw, height/2
      const inf = solids.map(t => ({ l: t.l - PW, t: t.t - PH, r: t.r + PW, b: t.b + PH }));

    // 吏곸꽑 媛?쒖꽑 ?뺤씤
    if (!this._raycastBlockingTile(inf, from, to)) return [from, to];

    // 吏곸꽑???ㅼ젣濡?留됰뒗 ?쎌갹 ??쇱쓽 肄붾꼫留??꾨낫濡??ъ슜 (臾닿??????肄붾꼫 ?쒖쇅)
    const MARGIN = 4;
    const blockingTiles = inf.filter(t => this._lineIntersectsRect(from, to, t));
    const corners = [];
    for (const t of blockingTiles) {
      for (const c of this._getTileCorners(t, MARGIN)) {
        if (!this._pointInAnyTile(c, inf)) corners.push(c);
      }
    }

    // 1-hop 寃쎈줈: 肄붾꼫 ?섎굹 寃쎌쑀
    for (const c of corners) {
      if (!this._raycastBlockingTile(inf, from, c) &&
          !this._raycastBlockingTile(inf, c, to)) {
        return [from, c, to];
      }
    }

    // 2-hop 寃쎈줈: from?먯꽌 媛源뚯슫 肄붾꼫 6媛??곗꽑 ?쒕룄
    const nearFrom = [...corners].sort((a, b) =>
      dist2(a.x, a.y, from.x, from.y) - dist2(b.x, b.y, from.x, from.y)
    ).slice(0, 6);

    for (const c1 of nearFrom) {
      if (this._raycastBlockingTile(inf, from, c1)) continue;
      for (const c2 of corners) {
        if (c2 === c1) continue;
        if (this._raycastBlockingTile(inf, c1, c2)) continue;
        if (!this._raycastBlockingTile(inf, c2, to)) {
          return [from, c1, c2, to];
        }
      }
    }

    return null;  // 湲??놁쓬 ??以??딄?
  }

  _raycastBlockingTile(tiles, from, to) {
    for (const t of tiles) {
      if (this._lineIntersectsRect(from, to, t)) return true;
    }
    return false;
  }

  // Liang-Barsky: ?좊텇 ?대?(???앹젏 ?쒖쇅, 琯=0.01)媛 rect瑜??듦낵?섎㈃ true
  _lineIntersectsRect(from, to, rect) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    let tMin = 0.01, tMax = 0.99;
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-9) return q > 0;
      const r = q / p;
      if (p < 0) { if (r > tMax) return false; if (r > tMin) tMin = r; }
      else       { if (r < tMin) return false; if (r < tMax) tMax = r; }
      return true;
    };
    return clip(-dx, from.x - rect.l) && clip(dx, rect.r - from.x) &&
           clip(-dy, from.y - rect.t) && clip(dy, rect.b - from.y) &&
           tMin <= tMax;
  }

  _pointInAnyTile(pt, tiles) {
    for (const t of tiles) {
      if (pt.x > t.l && pt.x < t.r && pt.y > t.t && pt.y < t.b) return true;
    }
    return false;
  }

    _getTileCorners(tile, margin) {
      return [
        { x: tile.l - margin, y: tile.t - margin },
        { x: tile.r + margin, y: tile.t - margin },
        { x: tile.l - margin, y: tile.b + margin },
        { x: tile.r + margin, y: tile.b + margin },
      ];
    }

    _oneWayBlocksPath(tile, from, to) {
      const top = tile.t;
      const startsBelowTop = from.y > top + 4;
      const goalAtOrAboveTop = to.y <= top + 4;
      const crossesTopLevel = Math.min(from.y, to.y) <= top && Math.max(from.y, to.y) >= top;
      const overlapsX = Math.max(from.x, to.x) >= tile.l && Math.min(from.x, to.x) <= tile.r;
      return startsBelowTop && goalAtOrAboveTop && crossesTopLevel && overlapsX;
    }
  }

// ?? OxygenSystem ??????????????????????????????????????
class OxygenSystem {
  constructor(player) {
    this.player       = player;
    this.enabled      = false;
    this.stacks       = 0;
    this.MAX_STACKS   = 5;
    this.shieldUnlocked = false;

    // High-cost Oxygen AoE. Final cost should be tuned after playtesting.
    this.BURST_OXYGEN_COST = 2;
    this.BURST_DMG     = 200;
    this.BURST_RADIUS  = 120;
    this.BURST_DUR     = 0.25;
    this.BURST_SPEED_MUL = 3.5;
    this._bursting     = false;
      this._burstTimer   = 0;

      this.CHANNEL_DUR      = 1.5;
      // Temporary Heat-to-Oxygen conversion cost. Final value should be tuned after playtesting.
      this.BASE_OXYGEN_HEAT_CONVERSION_COST = 20;
      this._channeling   = false;
      this._channelTimer = 0;

    // ?대뱶
    this.SHIELD_STACK_REQ = 3;
    this.SHIELD_CD        = 8;
    this._shieldCd        = 0;
  }

  tick_(dt, entities) {
    if (this._shieldCd > 0) this._shieldCd -= dt;
    if (this._bursting)   this._processBurst(dt);
    if (this._channeling) this._processChannel(dt, entities);
  }

  requestBurst(mouseWX, mouseWY, entities) {
    if (!this.enabled) return;
    if (!this.canSpendStacks(this.BURST_OXYGEN_COST) || this._channeling || this._bursting) return;
    if (!this.spendStacks(this.BURST_OXYGEN_COST)) return;
    this._startBurst(mouseWX, mouseWY, entities);
  }

  _startBurst(mx, my, entities) {
    this._bursting   = true;
    this._burstTimer = this.BURST_DUR;

      // 踰붿쐞 ?쇳빐
      for (const e of entities) {
        if (e.isDead) continue;
      const d = dist2(this.player.x, this.player.y, e.x, e.y);
        if (d <= this.BURST_RADIUS) e.takeDamage(this.BURST_DMG, 'burst', this.player);
    }

    // 踰꾩뒪???쒓컖
    addVfx({ type:'circle', x: this.player.x, y: this.player.y - 32,
             r: this.BURST_RADIUS, color:'#40e0ff', dur:0.3, alpha:0.5, t:0 });
  }

  _processBurst(dt) {
    this._burstTimer -= dt;
    if (this._burstTimer <= 0) this._bursting = false;
  }

  requestChannelStart() {
    if (!this.enabled) return;
    if (this.stacks >= this.MAX_STACKS || this._channeling || this._bursting) return;
    this._channeling   = true;
    this._channelTimer = 0;
  }

  requestChannelStop() {
    if (!this._channeling) return;
    this._channeling   = false;
    this._channelTimer = 0;
  }

  _processChannel(dt, entities) {
    this._channelTimer += dt;
    if (this._channelTimer >= this.CHANNEL_DUR) {
      this._channeling   = false;
      this._channelTimer = 0;
      if (this.stacks >= this.MAX_STACKS) return;
      if (!this.player.heatSys || !this.player.heatSys.enabled) return;
      const cost = this.getHeatToOxygenConversionCost();
      if (!this.player.heatSys.canSpendHeat(cost)) return;
      if (!this.player.heatSys.spendHeat(cost)) return;
      this.addStack(1);
    }
  }

  tryShieldBlock() {
    if (this.player.invincibleTimer > 0) return false;
    if (this.player.dashSys && this.player.dashSys.isDashing()) return false;
    if (!this.enabled) return false;
    if (!this.shieldUnlocked) return false;
    if (!this.canSpendStacks(this.SHIELD_STACK_REQ)) return false;
    if (this._shieldCd > 0) return false;
    this.spendStacks(this.SHIELD_STACK_REQ);
    this._shieldCd = this.SHIELD_CD;
    addVfx({ type:'circle', x: this.player.x, y: this.player.y - 32,
             r:50, color:'#80c0ff', dur:0.5, alpha:0.6, t:0 });
    return true;
  }

  hasStacks(n) { return this.stacks >= n; }
  canSpendStacks(n) { return this.enabled && this.hasStacks(n); }
  addStack(n = 1) { this.stacks = Math.min(this.stacks + n, this.MAX_STACKS); }
  _consumeStack(n) { this.stacks = Math.max(this.stacks - n, 0); }
  spendStacks(n) {
    if (!this.canSpendStacks(n)) return false;
    this._consumeStack(n);
    return true;
  }
  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled && this._channeling) this.requestChannelStop();
  }

  isChanneling() { return this._channeling; }
  isBursting()   { return this._bursting; }
  getChannelRatio() { return clamp(this._channelTimer / this.CHANNEL_DUR, 0, 1); }
  getHeatToOxygenConversionCost() {
    return this.player?.getRecoveryConfig?.().qHeatCost ??
      this.BASE_OXYGEN_HEAT_CONVERSION_COST;
  }
}

class HeatSystem {
  constructor(player) {
    this.player = player;
      this.enabled = true;
      this.combatUnlocked = false;
      this.value = 0;
      // Temporary Heat cap for HUD/testing. Final value should be tuned after playtesting.
      this.BASE_MAX_VALUE = 150;
      this.maxValue = this.BASE_MAX_VALUE;
      // Temporary Heat gain rate. Final gain scaling should be tuned after playtesting.
      this.GAIN_PER_DAMAGE = 0.25;
      // Temporary per-form Heat drain values. Final drain should be tuned after playtesting.
      this.NORMAL_HEAT_DRAIN_PER_SECOND = 10;
      this.FIRE_HEAT_DRAIN_PER_SECOND = 12;
      this.FIREMAN_HEAT_DRAIN_PER_SECOND = 8;
      this.WATER_HEAT_DRAIN_PER_SECOND = 6;
      // Temporary NORMAL-form movement bonus for Heat Mode. Final value should be tuned after playtesting.
      this.NORMAL_MOVE_SPEED_MUL = 1.15;
      this.activeMode = null;
    }

  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled) this.activeMode = null;
  }

  setCombatUnlocked(v) {
    this.combatUnlocked = !!v;
    if (!this.combatUnlocked) this.activeMode = null;
  }

  tick_(dt) {
      if (!this.enabled || this.activeMode !== 'formHeat') return;
      this.value = clamp(this.value - this.getDrainPerSecondForCurrentForm() * dt, 0, this.maxValue);
      if (this.value <= 0) {
        this.value = 0;
        this.activeMode = null;
      }
    }

  addHeat(amount) {
    if (!this.enabled) return false;
    if (!Number.isFinite(amount) || amount <= 0) return false;
    this.value = clamp(this.value + amount, 0, this.maxValue);
    return true;
  }

  canSpendHeat(amount) {
    if (!this.enabled) return false;
    if (!Number.isFinite(amount) || amount < 0) return false;
    return this.value >= amount;
  }

  spendHeat(amount) {
    if (!this.canSpendHeat(amount)) return false;
    this.value = clamp(this.value - amount, 0, this.maxValue);
    if (this.value <= 0) this.activeMode = null;
    return true;
  }

  gainFromDamage(amount, sourceType) {
    if (!this.enabled) return false;
    if (sourceType !== 'melee' && sourceType !== 'axe') return false;
    if (!Number.isFinite(amount) || amount <= 0) return false;
    return this.addHeat(amount * this.GAIN_PER_DAMAGE);
  }

  toggleFormHeatMode() {
    // Temporary input binding. Exact key may change after input layout review.
    if (!this.enabled) return false;
    if (!this.combatUnlocked) return false;
    if (this.activeMode === 'formHeat') {
      this.activeMode = null;
      return true;
    }
    if (this.value <= 0) return false;
    this.activeMode = 'formHeat';
    return true;
  }

  getNormalMoveSpeedMul() {
    if (!this.enabled) return 1;
    if (this.activeMode !== 'formHeat') return 1;
    if (this.player.phase !== HP_PHASE.NORMAL) return 1;
    return this.NORMAL_MOVE_SPEED_MUL;
  }

  isFormHeatModeActive() {
    return this.enabled && this.combatUnlocked && this.activeMode === 'formHeat';
  }

  getDrainPerSecondForCurrentForm() {
    switch (this.player.phase) {
      case HP_PHASE.NORMAL: return this.NORMAL_HEAT_DRAIN_PER_SECOND;
      case HP_PHASE.FIRE: return this.FIRE_HEAT_DRAIN_PER_SECOND;
      case HP_PHASE.FIREMAN: return this.FIREMAN_HEAT_DRAIN_PER_SECOND;
      default: return this.WATER_HEAT_DRAIN_PER_SECOND;
    }
  }

  applyRecoveryConfig(config) {
    const nextMax = Number.isFinite(config?.heatMaxValue)
      ? config.heatMaxValue
      : this.BASE_MAX_VALUE;
    this.maxValue = nextMax;
    this.value = clamp(this.value, 0, this.maxValue);
  }
}

class SmokeSystem {
  constructor(player) {
    this.player = player;
    this.enabled = false;
    // Temporary Smoke cap and gain. Final values should be tuned after playtesting.
    this.maxValue = 100;
    this.value = 0;
    this.GAIN_PER_DAMAGE = 0.5;
    // Temporary Smoke slow thresholds and multipliers. Final values should
    // be tuned after playtesting.
    this.SMOKE_SLOW_THRESHOLD_1 = 40;
    this.SMOKE_SLOW_THRESHOLD_2 = 70;
    this.SMOKE_SLOW_MULTIPLIER_1 = 0.9;
    this.SMOKE_SLOW_MULTIPLIER_2 = 0.8;
    // Temporary Skill 3 heal reduction thresholds and multipliers. Final
    // values should be tuned after playtesting.
    this.SMOKE_HEAL_REDUCTION_THRESHOLD_1 = 40;
    this.SMOKE_HEAL_REDUCTION_THRESHOLD_2 = 70;
    this.SMOKE_HEAL_MULTIPLIER_1 = 0.85;
    this.SMOKE_HEAL_MULTIPLIER_2 = 0.70;
    // Temporary WATER-form Smoke cleansing rate. Final value should be tuned
    // after playtesting.
    this.BASE_WATER_SMOKE_REDUCTION_PER_SECOND = 8;
    this.SMOKE_RELEASE_COST = 30;
    this.SMOKE_RELEASE_DAMAGE = 55;
    this.SMOKE_RELEASE_RADIUS = 150;
    this.SMOKE_RELEASE_COOLDOWN = 6;
    this.SMOKE_RELEASE_KNOCKBACK_SPEED = 180;
    this._releaseCooldown = 0;
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled) this.value = 0;
  }

  addSmoke(amount) {
    if (!this.enabled) return false;
    if (!Number.isFinite(amount) || amount <= 0) return false;
    this.value = clamp(this.value + amount, 0, this.maxValue);
    return true;
  }

  reduceSmoke(amount) {
    if (!this.enabled) return false;
    if (!Number.isFinite(amount) || amount <= 0) return false;
    this.value = clamp(this.value - amount, 0, this.maxValue);
    return true;
  }

  gainFromDamage(amount) {
    if (!this.enabled) return false;
    if (!Number.isFinite(amount) || amount <= 0) return false;
    return this.addSmoke(amount * this.GAIN_PER_DAMAGE);
  }

  tick_(dt) {
    if (!this.enabled) return;
    if (this._releaseCooldown > 0)
      this._releaseCooldown = Math.max(this._releaseCooldown - dt, 0);
    if (this.player.getCurrentCombatForm() !== TEMP_COMBAT_FORM.WATER) return;
    this.reduceSmoke(this.getWaterSmokeReductionPerSecond() * dt);
  }

  canRelease() {
    if (!this.enabled) return false;
    if (this._releaseCooldown > 0) return false;
    return this.value >= this.SMOKE_RELEASE_COST;
  }

  requestRelease(entities) {
    if (!this.canRelease()) return false;
    if (!this.reduceSmoke(this.SMOKE_RELEASE_COST)) return false;

    this._releaseCooldown = this.SMOKE_RELEASE_COOLDOWN;
    const cx = this.player.x;
    const cy = this.player.y - 32;
    addVfx({
      type:'circle',
      x: cx,
      y: cy,
      r: this.SMOKE_RELEASE_RADIUS,
      color:'#b8b8c8',
      dur:0.28,
      alpha:0.45,
      t:0
    });

    for (const e of entities || []) {
      if (!e || e.isDead) continue;
      const ey = e.y - ((e.height || 0) / 2);
      if (dist2(cx, cy, e.x, ey) > this.SMOKE_RELEASE_RADIUS) continue;
      e.takeDamage(this.SMOKE_RELEASE_DAMAGE, 'smoke', this.player);
      if (Number.isFinite(e.vx))
        e.vx = Math.sign(e.x - cx || this.player.facing || 1) * this.SMOKE_RELEASE_KNOCKBACK_SPEED;
    }
    return true;
  }

  getReleaseCooldownRatio() {
    return clamp(this._releaseCooldown / this.SMOKE_RELEASE_COOLDOWN, 0, 1);
  }

  getReleaseCdRatio() {
    return this.getReleaseCooldownRatio();
  }

  getMoveSpeedMultiplier() {
    if (!this.enabled) return 1;
    if (this.value < this.SMOKE_SLOW_THRESHOLD_1) return 1;
    if (this.value < this.SMOKE_SLOW_THRESHOLD_2) return this.SMOKE_SLOW_MULTIPLIER_1;
    return this.SMOKE_SLOW_MULTIPLIER_2;
  }

  getHealMultiplier() {
    if (!this.enabled) return 1;
    if (this.value < this.SMOKE_HEAL_REDUCTION_THRESHOLD_1) return 1;
    if (this.value < this.SMOKE_HEAL_REDUCTION_THRESHOLD_2) return this.SMOKE_HEAL_MULTIPLIER_1;
    return this.SMOKE_HEAL_MULTIPLIER_2;
  }

  getWaterSmokeReductionPerSecond() {
    return this.player?.getRecoveryConfig?.().waterSmokeReductionPerSecond ??
      this.BASE_WATER_SMOKE_REDUCTION_PER_SECOND;
  }
}

// ?? RangedSystem ??????????????????????????????????????
class RangedSystem {
    constructor(player) {
      this.player = player;
      this.state  = 'idle';
      this.tick   = 0;
    this._pendingDir = { x:1, y:0 };
    this._pendingPhase = HP_PHASE.NORMAL;

    this.SHOCK_DMG = 50; this.SHOCK_W = 64; this.SHOCK_H = 32;
    this.SHOCK_STARTUP = 5; this.SHOCK_RECOVERY = 12; this.SHOCK_CD = 1.2;

        // FIRE ?붿뿼
        this.FIRE_DMG = 60; this.FIRE_SPEED = 2400;
        this.FIRE_STARTUP = 4; this.FIRE_RECOVERY = 10; this.FIRE_CD = 0.8;
        // Temporary per-shot Heat cost for FIRE ranged attacks. Final cost should be tuned after playtesting.
        this.FIRE_RANGED_HEAT_COST = 15;
        // Temporary per-shot Heat cost for FIREMAN suppression or water-style ranged attacks.
        // Final cost should be tuned after playtesting.
        this.FIREMAN_RANGED_HEAT_COST = 10;

      this.WATER_DMG = 80; this.WATER_SPEED = 3000;
      this.WATER_STARTUP = 4; this.WATER_RECOVERY = 12; this.WATER_CD = 1.0;

    this._cdShock = 0; this._cdFire = 0; this._cdWater = 0;
  }

  requestRanged(mouseWX, mouseWY) {
    if (this.state !== 'idle') return;
    const phase = this.player.phase;
    if (!this._canFire(phase)) return;
    const spawnY = this.player.y - 44;
    const d = norm(mouseWX - this.player.x, mouseWY - spawnY);
    this._pendingDir   = d.x === 0 && d.y === 0 ? {x:1,y:0} : d;
    this._pendingPhase = phase;
    this.tick  = 0;
    this.state = 'startup';
  }

  tick_(dt, entities) {
    if (this._cdShock > 0) this._cdShock -= dt;
    if (this._cdFire  > 0) this._cdFire  -= dt;
    if (this._cdWater > 0) this._cdWater -= dt;

    if (this.state === 'idle') return;
    this.tick++;

    const su = this._getStartup(this._pendingPhase);
    const re = this._getRecovery(this._pendingPhase);

      if (this.state === 'startup' && this.tick >= su) {
        const fired = this._fire(this._pendingPhase, entities);
        if (fired) {
          this._applyCd(this._pendingPhase);
          this.tick  = 0;
          this.state = 'recovery';
        } else {
          this.state = 'idle';
          this.tick = 0;
        }
      } else if (this.state === 'recovery' && this.tick >= re) {
        this.state = 'idle'; this.tick = 0;
      }
    }

    _fire(phase, entities) {
      const mul = SPEED_MUL[phase];
      const sx  = this.player.x, sy = this.player.y - 44;
      const d   = this._pendingDir;

    if (phase === HP_PHASE.NORMAL) {
      // 異⑷꺽?? 利됰컻 AABB
      const ox = d.x * this.SHOCK_W * 0.5;
      const oy = d.y * this.SHOCK_W * 0.5;
      const dmg = this.SHOCK_DMG * mul;
      const hbL = sx + ox - this.SHOCK_W/2, hbT = sy + oy - this.SHOCK_H/2;
      const hbR = hbL + this.SHOCK_W,       hbB = hbT + this.SHOCK_H;
        for (const e of entities) {
          if (e.isDead) continue;
          const er = eRect(e);
          if (er.l < hbR && er.r > hbL && er.t < hbB && er.b > hbT)
          e.takeDamage(dmg, 'ranged', this.player);
        }
        addVfx({ type:'rect', x: sx + ox, y: sy + oy, w: this.SHOCK_W, h: this.SHOCK_H,
                 rot: angle(d.x, d.y), color:'#d8e8ff', dur:0.15, alpha:0.75, t:0 });
        return true;

      } else if (phase === HP_PHASE.FIRE) {
        if (!this.player.heatSys || !this.player.heatSys.combatUnlocked) return false;
        if (!this.player.heatSys.canSpendHeat(this.FIRE_RANGED_HEAT_COST)) return false;
        if (!this.player.heatSys.spendHeat(this.FIRE_RANGED_HEAT_COST)) return false;
        const proj = new PlayerProjectile(sx, sy, d.x, d.y,
          this.FIRE_SPEED, this.FIRE_DMG * mul, 0, '#ff7210', 6, 'ranged', this.player);
        Projectiles.add(proj);
        return true;

        } else {
          // Heat-powered suppression / water / compressed stream.
          // This is not fire damage.
          if (!this.player.heatSys || !this.player.heatSys.combatUnlocked) return false;
          if (!this.player.heatSys.canSpendHeat(this.FIREMAN_RANGED_HEAT_COST)) return false;
          if (!this.player.heatSys.spendHeat(this.FIREMAN_RANGED_HEAT_COST)) return false;
          const proj = new PlayerProjectile(sx, sy, d.x, d.y,
            this.WATER_SPEED, this.WATER_DMG * mul, 0, '#30c0ff', 7, 'ranged', this.player);
          Projectiles.add(proj);
          return true;
        }
      }

  _canFire(phase) {
      if (phase === HP_PHASE.NORMAL) return false;
      if (!this.player.heatSys || !this.player.heatSys.combatUnlocked) return false;
      if (phase === HP_PHASE.FIRE) return this._cdFire <= 0;
      if (phase === HP_PHASE.FIREMAN) return this._cdWater <= 0;
      return this._cdWater <= 0;
      }
  _applyCd(phase) {
    if (phase === HP_PHASE.NORMAL)  this._cdShock = this.SHOCK_CD;
    else if (phase === HP_PHASE.FIRE) this._cdFire = this.FIRE_CD;
    else this._cdWater = this.WATER_CD;
  }
  _getStartup(p) { return p===HP_PHASE.NORMAL?this.SHOCK_STARTUP:this.FIRE_STARTUP; }
  _getRecovery(p){ return p===HP_PHASE.NORMAL?this.SHOCK_RECOVERY:this.FIRE_RECOVERY; }
  getCdRatio(phase) {
    if (phase === HP_PHASE.NORMAL)  return clamp(this._cdShock / this.SHOCK_CD, 0, 1);
    if (phase === HP_PHASE.FIRE)    return clamp(this._cdFire  / this.FIRE_CD,  0, 1);
    return clamp(this._cdWater / this.WATER_CD, 0, 1);
  }
  isAttacking() { return this.state !== 'idle'; }
}

// Future form skill framework note:
// - Skill1: form-specific survival / defense / movement
// - Skill2: form-specific offense / resource action
// - Skill3: shared Oxygen heal
// Current milestone only implements Skill2 Smoke Release plus axe/unarmed split.

// ?? Player 硫붿씤 ???????????????????????????????????????
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hw = 16; this.height = 64;

    // ?섏튂
    this.BASE_MAX_HP  = 1000;
    this.MAX_HP       = this.BASE_MAX_HP;
    this.baseSpeed    = 200;
    this.JUMP_VEL     = -350;
    this.DJUMP_VEL    = -280;
    this.MAX_JUMPS    = 2;

    // ?곹깭
    this.hp           = 1000;
    this.phase        = HP_PHASE.NORMAL;
      this.temporaryForm = null;
      this.temporaryFormTimer = 0;
      this.jumpCount    = 0;
      this.onFloor      = false;
      this.onWall       = false;
      this.facing       = 1;
      this.dashUnlocked = false;
      this.isDead       = false;
      this.invincibleTimer = 0;
      this.dropThroughTimer = 0;
      this._recoveryConfig = null;
      // Temporary Skill 3 healing values. Final cost, healing, and cooldown
      // should be tuned after playtesting.
      this.SKILL3_OXYGEN_COST = 2;
      this.SKILL3_HEAL_RATIO = 0.25;
      this.BASE_SKILL3_COOLDOWN = 8;
      this._skill3Cooldown = 0;

    this._hitFlash    = 0;
    this._atkDir      = { x:1, y:0 };
    this.UNARMED_ATCK_LEN = 56;
    this.UNARMED_ATCK_W = 18;
    this.UNARMED_HEAT_GAIN_MULTIPLIER = 0.5;
    this._lastAttackStyle = 'axe';

      this.comboSys  = new ComboSystem(this);
      this.dashSys   = new DashSystem(this);
      this.axeSys    = new AxeSystem(this);
      this.oxygenSys = new OxygenSystem(this);
      this.heatSys   = new HeatSystem(this);
      this.smokeSys  = new SmokeSystem(this);
      this.rangedSys = new RangedSystem(this);

    // 怨듦꺽 ?덊듃諛뺤뒪 ?쒖떆
    this._atkFlash    = 0;
    this.ATCK_LEN     = 80;
    this.ATCK_W       = 22;

      this._currentEntities = [];  // physicsUpdate()?먯꽌 留??ㅽ뀦 媛깆떊
      this.onDeath = null;         // () => void ??game.js?먯꽌 二쇱엯
      this._lastSafeAxeDashPos = { x, y };
      this._spriteW = this.hw * 2;
      this._spriteH = this.height;
    }

  // ?? ?낅젰 泥섎━ ??????????????????????????????????????
  processInput(entities) {
    // 醫뚰겢由? 肄ㅻ낫
    if (Input.isMbJust(0)) {
      if (!this.dashSys.isDashing() && !this.oxygenSys.isChanneling()) {
        const armX = this.x, armY = this.y - 32;
        const d = norm(Input.mouseWX - armX, Input.mouseWY - armY);
        if (d.x !== 0 || d.y !== 0) this._atkDir = d;
        if (Math.abs(d.x) > 0.1) this.facing = Math.sign(d.x);
        this.comboSys.request();
      }
    }

    if (Input.isMbJust(2)) {
      if (!this.oxygenSys.isChanneling() && !this.dashSys.isDashing()) {
        this.axeSys.requestRightClick(Input.mouseWX, Input.mouseWY);
      }
    }

    // ??? Shift
    if (Input.isJust('ShiftLeft') || Input.isJust('ShiftRight')) {
      if (!this.oxygenSys.isChanneling() && !this.axeSys.isDashing())
        this.dashSys.request();
    }

    // 踰꾩뒪?? W
    if (Input.isJust('KeyW')) {
      this.oxygenSys.requestBurst(Input.mouseWX, Input.mouseWY, entities);
    }

      if (Input.isJust('KeyQ'))    this.oxygenSys.requestChannelStart();
      if (Input.isJustRel('KeyQ')) this.oxygenSys.requestChannelStop();
      if (Input.isJust('Digit1'))  this.heatSys.toggleFormHeatMode();
      if (Input.isJust('Digit2'))  this.smokeSys.requestRelease(entities);
      if (Input.isJust('Digit3'))  this.requestSkill3Heal();

      // ?먰봽: Space
        if (Input.isJust('Space')) {
        if (this.onFloor && Input.isDown('KeyS')) {
          this.dropThroughTimer = 0.18;
          this.onFloor = false;
          this.vy = Math.max(this.vy, 80);
          return;
        }
        if (this.jumpCount < this.MAX_JUMPS) {
          this.vy = this.jumpCount === 0 ? this.JUMP_VEL : this.DJUMP_VEL;
          this.jumpCount++;
      }
    }
  }

  // ?? 臾쇰━ ?낅뜲?댄듃 ??????????????????????????????????
  physicsUpdate(dt, tiles, entities) {
    if (this.isDead) return;
    this._currentEntities = entities;
      if (this.invincibleTimer > 0) {
        this.invincibleTimer = Math.max(this.invincibleTimer - dt, 0);
      }
      if (this.dropThroughTimer > 0) {
        this.dropThroughTimer = Math.max(this.dropThroughTimer - dt, 0);
      }
      if (this.temporaryFormTimer > 0) {
        this.temporaryFormTimer = Math.max(this.temporaryFormTimer - dt, 0);
        if (this.temporaryFormTimer <= 0) this.temporaryForm = null;
      }
      if (this._skill3Cooldown > 0) {
        this._skill3Cooldown = Math.max(this._skill3Cooldown - dt, 0);
      }

    // Update dash first so movement reacts on the same simulation step.
    this.dashSys.tick_(dt);
    const axeDashActiveAtStart = this.axeSys.isDashing();
    if (axeDashActiveAtStart) {
      this.axeSys.tick_(dt, tiles);
    }

    // 以묐젰
    if (!this.onFloor) {
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    }

    // ?대룞 ?쒖뼱
    if (this.axeSys.isDashing()) {
      // axe ?뚯쭊: axeSys媛 velocity 吏곸젒 ?ㅼ젙
    } else if (this.oxygenSys.isBursting()) {
    } else if (this.dashSys.isDashing()) {
      // ??? dashSys媛 vx ?ㅼ젙
    } else if (this.oxygenSys.isChanneling()) {
      this.vx = 0;
    } else {
      const dir = Input.axis('KeyA', 'KeyD');
      if (dir !== 0 && !this.comboSys.isAttacking())
        this.facing = Math.sign(dir);
        const spd =
          this.baseSpeed *
          SPEED_MUL[this.phase] *
          this.heatSys.getNormalMoveSpeedMul() *
          this.smokeSys.getMoveSpeedMultiplier();
        this.vx = dir * spd;
      }

    if (this.axeSys.isDashing()) {
      const nextX = this.x + this.vx * dt;
      const nextY = this.y + this.vy * dt;
      if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
        console.warn('player invalid position during axe dash');
        this.x = this._lastSafeAxeDashPos.x;
        this.y = this._lastSafeAxeDashPos.y;
        this.axeSys._endDash(false);
      } else if (nextX < 0 || nextX > ROOM_W || nextY < 0 || nextY > ROOM_H) {
        console.warn('player invalid position during axe dash');
        this.x = this._lastSafeAxeDashPos.x;
        this.y = this._lastSafeAxeDashPos.y;
        this.axeSys._endDash(false);
      } else {
        this._lastSafeAxeDashPos.x = this.x;
        this._lastSafeAxeDashPos.y = this.y;
        this.x = nextX;
        this.y = nextY;
      }
      clampToRoomBounds(this);
      this.onFloor = false;
      this.onWall = false;
    } else {
      const result = moveAndSlide(this, tiles);
      clampToRoomBounds(this);
      this.onFloor = result.onFloor;
      this.onWall  = result.onWall;
      if (result.onFloor) this.jumpCount = 0;
    }

    // ?쒕툕?쒖뒪??tick
    if (!axeDashActiveAtStart) {
      this.axeSys.tick_(dt, tiles);
      }
      this.oxygenSys.tick_(dt, entities);
      this.heatSys.tick_(dt);
      this.smokeSys.tick_(dt);
      this.rangedSys.tick_(dt, entities);
      this.comboSys.tick_();

    if (this._hitFlash > 0) this._hitFlash--;
    if (this._atkFlash > 0) this._atkFlash--;
  }

  // ?? 肄ㅻ낫 ?덊듃諛뺤뒪 諛쒕룞 ?????????????????????????????
    _onAttackActive(idx, damage, attackStyle = 'axe') {
      this._atkFlash = 4;
    this._lastAttackStyle = attackStyle;
    const isUnarmed = attackStyle === 'unarmed';
    const attackLen = isUnarmed ? this.UNARMED_ATCK_LEN : this.ATCK_LEN;
    const attackW = isUnarmed ? this.UNARMED_ATCK_W : this.ATCK_W;
    const sourceType = isUnarmed ? 'melee_unarmed' : 'melee';
    // Use body overlap so attacks connect when the hitbox reaches the target body.
    const cx = this.x + this._atkDir.x * attackLen * 0.5;
    const cy = (this.y - 32) + this._atkDir.y * attackLen * 0.5;
    const hb = {
      l: cx - (attackLen / 2 + 8),
      r: cx + (attackLen / 2 + 8),
      t: cy - (attackW / 2 + 8),
      b: cy + (attackW / 2 + 8),
    };

    const hits = this._currentEntities;
    for (const e of hits) {
      if (e.isDead) continue;
      if (!overlap(hb, eRect(e))) continue;
      e.takeDamage(damage, sourceType, this);
    }
    }

  // ?? ?쇳빐 諛쏄린 ??????????????????????????????????????
  takeDamage(amount) {
    if (this.isDead) return;
    if (this.invincibleTimer > 0) return;
    if (this.dashSys.isDashing()) return;
    if (this.oxygenSys.tryShieldBlock()) return;

    this._hitFlash = 10;
    if (this.oxygenSys.isChanneling()) this.oxygenSys.requestChannelStop();

    let finalDamage = amount;
    if (this.getCurrentCombatForm() === TEMP_COMBAT_FORM.WATER && this.heatSys.isFormHeatModeActive()) {
      finalDamage *= (1 - WATER_HEAT_DAMAGE_REDUCTION_RATIO);
    }

    const prevHp = this.hp;
    this.hp = Math.max(this.hp - finalDamage, 0);
    const appliedDamage = Math.max(prevHp - this.hp, 0);
    if (appliedDamage > 0) {
      spawnDmgNum(this.x, this.y - this.height - 20, appliedDamage, '#ffb8a8');
      this.smokeSys.gainFromDamage(appliedDamage);
    }
    this._checkPhase();
    if (this.hp <= 0) this._die();
  }

  heal(amount) {
      this.hp = Math.min(this.hp + amount, this.MAX_HP);
      this._checkPhase();
    }

  requestSkill3Heal() {
    if (this.isDead) return false;
    if (this._skill3Cooldown > 0) return false;
    if (this.hp >= this.MAX_HP) return false;
    if (!this.oxygenSys.canSpendStacks(this.SKILL3_OXYGEN_COST)) return false;
    if (!this.oxygenSys.spendStacks(this.SKILL3_OXYGEN_COST)) return false;
    if (this.oxygenSys.isChanneling()) this.oxygenSys.requestChannelStop();

    this._skill3Cooldown = this.getSkill3CooldownDuration();
    const baseHealAmount = this.MAX_HP * this.SKILL3_HEAL_RATIO;
    const finalHealAmount = baseHealAmount * this.smokeSys.getHealMultiplier();
    this.heal(finalHealAmount);
    addVfx({
      type:'circle',
      x: this.x,
      y: this.y - 32,
      r: 36,
      color:'#7ce8ff',
      dur:0.35,
      alpha:0.65,
      t:0
    });
    return true;
  }

  onDealDamage(amount, sourceType) {
      if (sourceType === 'melee_unarmed') {
        this.heatSys.gainFromDamage(amount * this.UNARMED_HEAT_GAIN_MULTIPLIER, 'melee');
        return;
      }
      this.heatSys.gainFromDamage(amount, sourceType);
    }

  getSmokeReleaseStatus() {
    if (!this.smokeSys || !this.smokeSys.enabled) return null;
    if (this.smokeSys._releaseCooldown > 0) return `${this.smokeSys._releaseCooldown.toFixed(1)}s`;
    if (this.smokeSys.value < this.smokeSys.SMOKE_RELEASE_COST) return 'SMOKE LOW';
    return 'READY';
  }

  activateTemporaryWaterForm(duration = this.getTemporaryWaterFormDuration()) {
    if (!Number.isFinite(duration) || duration <= 0) {
      this.temporaryForm = null;
      this.temporaryFormTimer = 0;
      return false;
    }
    this.temporaryForm = TEMP_COMBAT_FORM.WATER;
    this.temporaryFormTimer = duration;
    return true;
  }

  getCurrentCombatForm() {
    return this.temporaryForm || this.phase;
  }

  setRecoveryConfig(config) {
    this._recoveryConfig = config || null;
    const nextMaxHp = this.BASE_MAX_HP + (Number.isFinite(this._recoveryConfig?.maxHpBonus)
      ? this._recoveryConfig.maxHpBonus
      : 0);
    this.MAX_HP = nextMaxHp;
    this.hp = clamp(this.hp, 0, this.MAX_HP);
    this.heatSys.applyRecoveryConfig(this._recoveryConfig);
  }

  getRecoveryConfig() {
    return this._recoveryConfig || {};
  }

  getPhaseThresholdRatios() {
    return [PHASE_THRESHOLD_RATIOS.FIREMAN, PHASE_THRESHOLD_RATIOS.NORMAL];
  }

  getSkill3CooldownDuration() {
    return this.getRecoveryConfig().skill3Cooldown ?? this.BASE_SKILL3_COOLDOWN;
  }

  getTemporaryWaterFormDuration() {
    return this.getRecoveryConfig().waterDuration ?? 5;
  }

  _checkPhase() {
    const hpRatio = this.MAX_HP > 0 ? this.hp / this.MAX_HP : 0;
    let np;
    if (hpRatio > PHASE_THRESHOLD_RATIOS.NORMAL)      np = HP_PHASE.NORMAL;
    else if (hpRatio > PHASE_THRESHOLD_RATIOS.FIREMAN) np = HP_PHASE.FIRE;
    else                                               np = HP_PHASE.FIREMAN;
    this.phase = np;
  }

  _die() {
    this.isDead = true;
    this.onDeath?.();
  }

  // ?? 諛??꾪솚 ???쒕툕?쒖뒪???쇨큵 ?뺣━ ??????????????????
  onRoomTransition() {
      this.vx = 0; this.vy = 0;
      this.invincibleTimer = 0;
      this.dropThroughTimer = 0;
      this.comboSys._reset();
    if (this.oxygenSys.isChanneling()) this.oxygenSys.requestChannelStop();
    this.dashSys._dashing = false;
    this.dashSys._cdTimer = 0;
      if (this.axeSys._axe) this.axeSys.onAxePickedUp();
    }

  _isAttackPoseActive() {
    return this.comboSys.state === 'startup' ||
           this.comboSys.state === 'active' ||
           this.comboSys.state === 'recovery';
  }

  _getCurrentSpriteAsset() {
    if (this.dashSys.isDashing()) return PlayerSpriteAssets.dash;
    return this._isAttackPoseActive() ? PlayerSpriteAssets.attack : PlayerSpriteAssets.idle;
  }

  _getFormVisualStyle() {
    const form = this.getCurrentCombatForm();
    const heatBoost = this.heatSys.isFormHeatModeActive() ? 1.2 : 1;
    switch (form) {
      case HP_PHASE.FIRE:
        return {
          body: '#8c4430',
          glow: '#ff6a24',
          outline: '#ffb06a',
          fill: '#ff7d36',
          tint: '#ff6a32',
          bodyOverlay: '#ff8b52',
          glowAlpha: 0.18 * heatBoost,
          outlineAlpha: 0.9,
          fillAlpha: 0.08 * heatBoost,
          tintAlpha: 0.46 * heatBoost,
          bodyOverlayAlpha: 0.32 * heatBoost,
          waterShield: false,
        };
      case HP_PHASE.FIREMAN:
        return {
          body: '#2c6572',
          glow: '#36c8ff',
          outline: '#9ae8ff',
          fill: '#4fd8ff',
          tint: '#36c8ff',
          bodyOverlay: '#72e1ff',
          glowAlpha: 0.18 * heatBoost,
          outlineAlpha: 0.88,
          fillAlpha: 0.06 * heatBoost,
          tintAlpha: 0.42 * heatBoost,
          bodyOverlayAlpha: 0.28 * heatBoost,
          waterShield: false,
        };
      case TEMP_COMBAT_FORM.WATER:
        return {
          body: '#2b4f7e',
          glow: '#58b8ff',
          outline: '#d2f1ff',
          fill: '#8fd8ff',
          tint: '#4aa8ff',
          bodyOverlay: '#96dbff',
          glowAlpha: 0.16 * heatBoost,
          outlineAlpha: 0.78,
          fillAlpha: 0.08 * heatBoost,
          tintAlpha: 0.44 * heatBoost,
          bodyOverlayAlpha: 0.3 * heatBoost,
          waterShield: true,
        };
      default:
        return {
          body: '#4a4f5d',
          glow: '#ffffff',
          outline: '#ffffff',
          fill: '#ffffff',
          tint: '#7c8496',
          glowAlpha: 0,
          outlineAlpha: 0,
          fillAlpha: 0,
          tintAlpha: 0,
          bodyOverlay: '#7c8496',
          bodyOverlayAlpha: 0,
          waterShield: false,
        };
    }
  }

  _drawFormAura(ctx, sx, sy, style) {
    if (!style || (style.glowAlpha <= 0 && !style.waterShield)) return;
    const centerY = sy - this.height / 2;
    const heatBoost = this.heatSys.isFormHeatModeActive();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (style.glowAlpha > 0) {
      ctx.fillStyle = style.glow;
      ctx.globalAlpha = style.glowAlpha;
      ctx.beginPath();
      ctx.ellipse(
        sx,
        centerY,
        this.hw + (heatBoost ? 13 : 10),
        this.height / 2 + (heatBoost ? 11 : 8),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    if (style.waterShield) {
      ctx.strokeStyle = style.outline;
      ctx.globalAlpha = 0.42 + (heatBoost ? 0.08 : 0);
      ctx.lineWidth = heatBoost ? 3 : 2;
      ctx.beginPath();
      ctx.ellipse(sx, centerY, this.hw + 8, this.height / 2 + 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawFormOverlay(ctx, sx, sy, style) {
    if (!style || (style.outlineAlpha <= 0 && style.fillAlpha <= 0)) return;
    ctx.save();
    if (style.fillAlpha > 0) {
      ctx.fillStyle = style.fill;
      ctx.globalAlpha = style.fillAlpha;
      ctx.fillRect(sx - this.hw - 1, sy - this.height - 1, this.hw * 2 + 2, this.height + 2);
    }
    if (style.outlineAlpha > 0) {
      ctx.strokeStyle = style.outline;
      ctx.globalAlpha = style.outlineAlpha;
      ctx.lineWidth = style.waterShield ? 2 : 2.5;
      ctx.strokeRect(sx - this.hw - 1, sy - this.height - 1, this.hw * 2 + 2, this.height + 2);
    }
    ctx.restore();
  }

  _drawFallbackBody(ctx, sx, sy, color) {
    if (this._hitFlash > 0) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = color;
    }
    ctx.fillRect(sx - this.hw, sy - this.height, this.hw * 2, this.height);

    // Future form-specific sprite variations can be layered with tint/effects
    // without changing the current attack and movement rendering contract.
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - this.hw, sy - this.height, this.hw * 2, this.height);
    ctx.lineWidth = 1;
  }

  _drawSpriteBody(ctx, sx, sy, style) {
    const asset = this._getCurrentSpriteAsset();
    if (!asset || !asset.loaded || asset.failed) return false;

    ctx.save();
    ctx.translate(sx, sy - this.height / 2);
    ctx.scale(this.facing >= 0 ? 1 : -1, 1);
    ctx.drawImage(asset.img, -this._spriteW / 2, -this._spriteH / 2, this._spriteW, this._spriteH);
    if (style && style.tintAlpha > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = style.tintAlpha;
      ctx.fillStyle = this._hitFlash > 0 ? '#ffffff' : style.tint;
      ctx.fillRect(-this._spriteW / 2, -this._spriteH / 2, this._spriteW, this._spriteH);
      if (style.bodyOverlayAlpha > 0) {
        const torsoW = this._spriteW * 0.54;
        const torsoH = this._spriteH * 0.52;
        const torsoX = -torsoW / 2;
        const torsoY = -this._spriteH * 0.02;
        ctx.globalAlpha = style.bodyOverlayAlpha;
        ctx.fillStyle = this._hitFlash > 0 ? '#ffffff' : style.bodyOverlay;
        ctx.fillRect(torsoX, torsoY, torsoW, torsoH);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return true;
  }

    // ?? 洹몃━湲?????????????????????????????????????????
  draw(ctx) {
    // 濡쒗봽 (?꾨겮)
    this.axeSys.drawRope(ctx);

    const s = Camera.toScreen(this.x, this.y);
    const sx = s.x, sy = s.y;

    if (this.oxygenSys.isChanneling()) {
      const p = this.oxygenSys.getChannelRatio();
      ctx.strokeStyle = '#40e0ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy - 32, 30 * p + 10, -Math.PI/2, -Math.PI/2 + Math.PI*2*p);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

      const formStyle = this._getFormVisualStyle();
      const color = formStyle.body ?? PHASE_COLORS[this.phase];
      this._drawFormAura(ctx, sx, sy, formStyle);
      if (!this._drawSpriteBody(ctx, sx, sy, formStyle)) {
        this._drawFallbackBody(ctx, sx, sy, color);
      }
      this._drawFormOverlay(ctx, sx, sy, formStyle);

      // ?쇨뎬 諛⑺뼢 ?쒖떆
      ctx.fillStyle = '#fff';
    const eyeX = sx + this.facing * 6;
    ctx.fillRect(eyeX - 2, sy - 52, 4, 4);

    // 怨듦꺽 踰붿쐞 ?쒖떆
    if (this._atkFlash > 0 && this.comboSys.isAttacking()) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.translate(sx, sy - 32);
      ctx.rotate(angle(this._atkDir.x, this._atkDir.y));
      const isUnarmed = this._lastAttackStyle === 'unarmed';
      const attackLen = isUnarmed ? this.UNARMED_ATCK_LEN : this.ATCK_LEN;
      const attackW = isUnarmed ? this.UNARMED_ATCK_W : this.ATCK_W;
      ctx.fillStyle = isUnarmed ? '#ffd080' : '#ff6040';
      ctx.fillRect(0, -attackW/2, attackLen, attackW);
      ctx.restore();
    }
  }
}
