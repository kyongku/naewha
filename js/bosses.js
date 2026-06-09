'use strict';
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??// bosses.js  ?? 蹂댁뒪 踰좎씠??+ Boss1 + BossFinal
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
// ?? Boss 踰좎씠?????????????????????????????????????????
const BossSpriteAssets = (() => {
  const makeSprite = (src) => {
    if (!src) return { img: null, loaded: false, failed: true };
    const img = new Image();
    const asset = { img, loaded: false, failed: false };
    img.onload = () => { asset.loaded = true; };
    img.onerror = () => { asset.failed = true; };
    img.src = src;
    return asset;
  };
  return {
    boss1: makeSprite('assets/sprites/boss-child.svg'),
    boss2: makeSprite('assets/sprites/boss-stopped-youth.svg'),
    boss3: makeSprite('assets/sprites/boss-fleeing-youth.svg'),
    finalBoss: makeSprite('assets/sprites/boss-final.svg'),
    // Optional effect sprite: keep circle fallback when dedicated art is absent.
    smokeCloud: makeSprite(null),
  };
})();

function segmentIntersectsRect(ax, ay, bx, by, rect) {
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  if (maxX < rect.l || minX > rect.r || maxY < rect.t || minY > rect.b) return false;
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, ax - rect.l) &&
    clip(dx, rect.r - ax) &&
    clip(-dy, ay - rect.t) &&
    clip(dy, rect.b - ay);
}

class Boss {
  constructor(x, y, callbacks = {}) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hw = 20; this.height = 64;

    this.displayName = '???';
    this.hp    = 1000;
    this.maxHp = 1000;
    this.isDead   = false;
    this.removeMe = false;
    this.onFloor  = false;
    this.onWall   = false;
    this.room     = null;

    // FSM: 'idle','approach','attack','hurt','dead'
    this.state    = 'idle';
    this.tick     = 0;
    this.HURT_FRAMES = 12;

    this._player  = null;
    this._hitFlash = 0;
    this.color    = '#c03060';
    this.baseColor = '#c03060';
    this._spriteKey = null;

    this._fighting  = false;
    this._callbacks = callbacks;  // { onDie } ??game.js?먯꽌 二쇱엯
    this._deadTimer = 0;          // ?щ쭩 ???꾨젅??移댁슫??(48?꾨젅?꾟뎵800ms ??removeMe)
    this._timeSinceLastAttack = 999;
    this._lastAttackName = null;
    this._rangedIntent = false;
    this._rangedIntentFrames = 0;
    this.RANGED_INTENT_HOLD_FRAMES = 90;
  }

  startFight() {
    if (this.state !== 'idle') return;
    this._fighting = true;
    this._changeState('approach');
    // HUD ?쒖떆??SceneState._syncBossHUD()?먯꽌 ?대떦
  }

  _changeState(s) {
    if (this.state === 'dead') return;
    this.state = s; this.tick = 0;
    this._onStateEntered(s);
  }
  _onStateEntered(_s) {}

  takeDamage(amount, sourceType = 'field', sourceAttacker = null) {
    if (this.isDead) return 0;
    this._hitFlash = 8;
    this.hp = Math.max(this.hp - amount, 0);
    spawnDmgNum(this.x, this.y - this.height - 16, amount, '#f88');
    sourceAttacker?.onDealDamage?.(amount, sourceType);
    if (this.hp <= 0) { this._die(); return amount; }
    if (sourceType === 'melee' || sourceType === 'melee_unarmed') return amount;
    if (this._isInterruptImmuneState()) return amount;
    // ?됰갚
    if (this._player) {
      this.vx = Math.sign(this.x - this._player.x) * 150;
    }
    this._changeState('hurt');
    return amount;
  }

  _die() {
    this.isDead  = true;
    this.vx = 0; this.vy = 0;
    this._onDie();
    this._callbacks.onDie?.();
    // HUD ?④?? SceneState._syncBossHUD()?먯꽌 ?대떦
    if (this.room) this.room.onEntityDied();
    this._changeState('dead');
  }
  _onDie() {}

  _processHurt() {
    if (this.tick >= this.HURT_FRAMES) {
      this.vx = 0;
      this._changeState(this._getPostHurtState());
    }
  }
  _getPostHurtState() { return 'approach'; }

  _applyGravity() {
    if (!this.onFloor)
      this.vy = Math.min(this.vy + GRAVITY * DT, MAX_FALL);
  }

  update(player) {
    if (this.removeMe) return;
    this._player = player;

    if (this.isDead) {
      this._deadTimer++;
      if (this._deadTimer >= 48) this.removeMe = true;  // 48?꾨젅????00ms) ???쒓굅
      // 以묐젰? 怨꾩냽 ?곸슜???먯뿰?ㅻ읇寃??⑥뼱吏?꾨줉 ?좎?
      this._applyGravity();
      const tiles = this.room ? this.room.allTiles() : [];
      const result = moveAndSlide(this, tiles);
      clampToRoomBounds(this);
      this.onFloor = result.onFloor;
      return;
    }

    this.tick++;
    if (this._fighting) this._timeSinceLastAttack++;
    this._applyGravity();

    if (this.state === 'hurt') this._processHurt();
    else this._processState(DT);

    const tiles = this.room ? this.room.allTiles() : [];
    const result = moveAndSlide(this, tiles);
    clampToRoomBounds(this);
    this.onFloor = result.onFloor;
    this.onWall  = result.onWall;

    if (this._hitFlash > 0) this._hitFlash--;
  }
  _processState(_dt) {}

  _distToPlayer() {
    if (!this._player) return Infinity;
    return dist2(this.x, this.y, this._player.x, this._player.y);
  }
  _dirToPlayer() {
    if (!this._player) return 1;
    return Math.sign(this._player.x - this.x) || 1;
  }

  _markAttackUsed(name) {
    this._timeSinceLastAttack = 0;
    this._lastAttackName = name || null;
    this._rangedIntent = false;
    this._rangedIntentFrames = 0;
  }

  _clearRangedIntent() {
    this._rangedIntent = false;
    this._rangedIntentFrames = 0;
  }

  _isInterruptImmuneState(state = this.state) {
    if (!state) return false;
    return state === 'chargeTelegraph' ||
      state === 'chargeDash' ||
      state === 'pulseTelegraph' ||
      state === 'pulseAttack' ||
      state === 'pulseRecovery' ||
      state.startsWith('windSlam') ||
      state.startsWith('halfBarrage') ||
      state.startsWith('heatSlash') ||
      state.startsWith('flameLine') ||
      state.startsWith('closeBurst') ||
      state.startsWith('overheatBarrage') ||
      state.startsWith('flameShot') ||
      state.startsWith('smokeCloud') ||
      state.startsWith('chokingRing') ||
      state.startsWith('blindShot') ||
      state.startsWith('smokeFlood') ||
        state.startsWith('smokeMine') ||
        state.startsWith('smokeWall') ||
        state.startsWith('chokingTrap') ||
        state.startsWith('smokeSwipe') ||
        state.startsWith('smokeHazard') ||
        state.startsWith('finalBarrage') ||
        state.startsWith('harass');
  }

  _getLineOfSightBlocked(from = this._getBodyCenter(), to = this._getPlayerCenter()) {
    const tiles = this.room ? this.room.allTiles() : [];
    for (const tile of tiles) {
      if (!tile || tile.oneWay) continue;
      if (segmentIntersectsRect(from.x, from.y, to.x, to.y, tile)) return true;
    }
    return false;
  }

  _getCombatContext() {
    const bossCenter = this._getBodyCenter ? this._getBodyCenter() : { x: this.x, y: this.y - this.height / 2 };
    const playerCenter = this._getPlayerCenter ? this._getPlayerCenter() : bossCenter;
    const dx = playerCenter.x - bossCenter.x;
    const dy = playerCenter.y - bossCenter.y;
    const horizontalDistance = Math.abs(dx);
    const verticalDistanceAbs = Math.abs(dy);
    const playerAbove = dy < -52;
    const blockedByWall = this._getLineOfSightBlocked(bossCenter, playerCenter);
    return {
      distanceToPlayer: Math.hypot(dx, dy),
      horizontalDistance,
      verticalDistance: dy,
      verticalDistanceAbs,
      playerAbove,
      playerOnPlatformLikely: playerAbove && (verticalDistanceAbs > 78 || blockedByWall),
      lineOfSight: !blockedByWall,
      blockedByWall,
      timeSinceLastAttack: this._timeSinceLastAttack,
      dx,
      dy,
      bossCenter,
      playerCenter,
    };
  }

  _refreshRangedIntent(ctx, startDistance, keepDistance) {
    if (!ctx || !Number.isFinite(startDistance) || !Number.isFinite(keepDistance)) {
      this._clearRangedIntent();
      return false;
    }
    const startTriggered = ctx.distanceToPlayer >= startDistance;
    const keepTriggered = this._rangedIntent && ctx.distanceToPlayer >= keepDistance;

    if (startTriggered) {
      this._rangedIntent = true;
      this._rangedIntentFrames = this.RANGED_INTENT_HOLD_FRAMES;
    } else if (keepTriggered) {
      this._rangedIntentFrames = Math.max(this._rangedIntentFrames - 1, 0);
      this._rangedIntent = true;
    } else if (this._rangedIntent && this._rangedIntentFrames > 0) {
      this._rangedIntentFrames = Math.max(this._rangedIntentFrames - 1, 0);
      this._rangedIntent = this._rangedIntentFrames > 0;
    } else {
      this._clearRangedIntent();
    }
    return this._rangedIntent;
  }

  // 利됰컻 ?덊듃諛뺤뒪 泥댄겕
  _checkHitbox(offX, w, h, damage) {
    if (!this._player) return;
    const cx = this.x + offX;
    const cy = this.y - this.height / 2;
    const hbL = cx - w/2, hbT = cy - h/2;
    const hbR = cx + w/2, hbB = cy + h/2;
    const pr  = eRect(this._player);
    if (pr.l < hbR && pr.r > hbL && pr.t < hbB && pr.b > hbT)
      this._dealDamageToPlayer(damage);
  }

  _getBossDamageMultiplier() {
    return Number.isFinite(this.BOSS_DAMAGE_MULTIPLIER) ? this.BOSS_DAMAGE_MULTIPLIER : 1;
  }

  _getScaledBossDamage(amount) {
    return Math.max(1, Math.round(amount * this._getBossDamageMultiplier()));
  }

  _dealDamageToPlayer(amount) {
    if (!this._player) return;
    this._player.takeDamage(this._getScaledBossDamage(amount));
  }

    _spawnProjectile(dirX, dirY, spd, dmg, spriteKey = null, opts = null) {
      Projectiles.add(new EnemyProjectile(
        this.x, this.y - 32, dirX, dirY, spd, this._getScaledBossDamage(dmg), '#f88', 7, spriteKey, opts || undefined
      ));
    }

  _initHpThresholds(ratios) {
    this._hpThresholdRatios = Array.isArray(ratios) ? [...ratios] : [];
    this._hpThresholdTriggered = new Set();
  }

  _pollHpThresholds() {
    if (!this._hpThresholdRatios || this._hpThresholdRatios.length === 0) return [];
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    const crossed = [];
    for (const threshold of this._hpThresholdRatios) {
      if (ratio <= threshold && !this._hpThresholdTriggered.has(threshold)) {
        this._hpThresholdTriggered.add(threshold);
        crossed.push(threshold);
      }
    }
    return crossed;
  }

  _getSpriteAsset() {
    if (!this._spriteKey) return null;
    return BossSpriteAssets[this._spriteKey] || null;
  }

  _drawFallbackBody(ctx, sx, sy) {
    ctx.fillStyle = this._hitFlash > 0 ? '#ffaaaa' : this.color;
    ctx.fillRect(sx - this.hw, sy - this.height, this.hw*2, this.height);
    ctx.strokeStyle = this.baseColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - this.hw, sy - this.height, this.hw*2, this.height);
    ctx.lineWidth = 1;

    const eyeX = sx + this._dirToPlayer() * 8;
    ctx.fillStyle = '#fff';
    ctx.fillRect(eyeX - 3, sy - this.height + 10, 6, 6);
    ctx.fillStyle = '#333';
    ctx.fillRect(eyeX - 1, sy - this.height + 12, 3, 3);
  }

  _drawSpriteBody(ctx, sx, sy) {
    const asset = this._getSpriteAsset();
    if (!asset || !asset.loaded || asset.failed) return false;

    ctx.save();
    ctx.translate(sx, sy - this.height / 2);
    ctx.scale(this._dirToPlayer() >= 0 ? 1 : -1, 1);
    ctx.drawImage(asset.img, -this.hw, -this.height / 2, this.hw * 2, this.height);
    ctx.restore();
    return true;
  }

  draw(ctx) {
    if (this.removeMe) return;
    const s = Camera.toScreen(this.x, this.y);
    const sx = s.x, sy = s.y;

    if (this.isDead) ctx.globalAlpha = 0.3;
    if (!this._drawSpriteBody(ctx, sx, sy))
      this._drawFallbackBody(ctx, sx, sy);

    ctx.globalAlpha = 1;
  }
}

// ?? Boss1 ??13???쒓껐 ?????????????????????????????????
class Boss1 extends Boss {
  constructor(x, y, callbacks = {}) {
    super(x, y, callbacks);
    this.displayName = 'Burning Child';
    this.hp = 900; this.maxHp = 900;
    this.hw = 16; this.height = 56;
    this.color = '#5080d0'; this.baseColor = '#5080d0';
    this._spriteKey = 'boss1';

      this.BOSS_DAMAGE_MULTIPLIER = 1.05;
      this.APPROACH_SPEED = 110;
    this.DASH_SPEED     = 800;
    this.DASH_DUR       = 15;  // frames
    this.CD_FRAMES      = 70;
    this.ATTACK_RANGE   = 150;
    this.MELEE_DMG      = 110;
    this.MELEE_W = 56; this.MELEE_H = 48;
    this.CHARGE_TELEGRAPH_FRAMES = 34;  // 0.57s @ 60fps
    this.CHARGE_DASH_FRAMES      = 22;  // 0.37s @ 60fps
    this.CHARGE_RECOVERY_FRAMES  = 48;  // 0.8s @ 60fps
    this.CHARGE_COOLDOWN_FRAMES  = 150; // 2.5s @ 60fps
    this.CHARGE_TRIGGER_MIN      = 220;
    this.CHARGE_TRIGGER_MAX      = 620;
    this.CHARGE_SPEED            = 680;
    this.HALF_BARRAGE_TRIGGER_RATIO = 0.5;
    this.HALF_BARRAGE_MOVE_SPEED    = 420;
    this.HALF_BARRAGE_ATTACK_FRAMES = 24; // 바람 구역 scheduler 시작 시간
    this.HALF_GUST_SEQUENCE_FRAMES   = 300;
    this.HALF_BARRAGE_RETURN_FRAMES = 30;  // 0.5s
    this.HALF_BARRAGE_TARGET_X      = ROOM_W * 0.5;
    this.HALF_BARRAGE_TARGET_Y      = 176;
    this.HALF_BARRAGE_AIMED_INTERVAL = 36;
    this.HALF_BARRAGE_FIXED_INTERVAL = 30;
    this.HALF_BARRAGE_SPREAD_INTERVAL = 68;
    this.HALF_BARRAGE_AIMED_SPEED    = 190;
    this.HALF_BARRAGE_FIXED_SPEED    = 175;
    this.HALF_BARRAGE_BULLET_DMG     = 24;
    this.HALF_GUST_INTERVAL_FRAMES   = 60;
    this.HALF_GUST_TELEGRAPH_FRAMES  = 48;
    this.HALF_GUST_ACTIVE_FRAMES     = 24;
    this.HALF_GUST_W                 = 300;
    this.HALF_GUST_H                 = 74;
    this.HALF_GUST_DAMAGE            = 36;
    this.HALF_GUST_PUSH              = 160;
    this.MAX_ACTIVE_WIND_ZONES       = 2;
    this.PULSE_TRIGGER_RANGE     = 220;
    this.PULSE_TELEGRAPH_FRAMES  = 34;  // 0.57s
    this.PULSE_ATTACK_FRAMES     = 9;   // 0.15s
    this.PULSE_RECOVERY_FRAMES   = 27;  // 0.45s
    this.PULSE_COOLDOWN_FRAMES   = 180; // 3.0s
    this.PULSE_RADIUS            = 220;
    this.PULSE_DAMAGE            = 64;
    this.AIR_SHOT_INTERVAL_FRAMES = 150; // 2.5s
    this.AIR_SHOT_TRIGGER_DISTANCE = 340;
    this.AIR_SHOT_KEEP_DISTANCE = 280;
    this.AIR_SHOT_TELEGRAPH_FRAMES = 14;
    this.AIR_SHOT_FIRE_FRAMES = 6;
    this.AIR_SHOT_RECOVERY_FRAMES = 10;
    this.AIR_SHOT_SPEED           = 230;
    this.AIR_SHOT_DAMAGE          = 18;
    this.AIR_SHOT_RADIUS          = 5;
    this.WIND_SLAM_RANGE          = 155;
    this.WIND_SLAM_W              = 145;
    this.WIND_SLAM_H              = 66;
    this.WIND_SLAM_TELEGRAPH_FRAMES = 48;
    this.WIND_SLAM_ATTACK_FRAMES  = 8;
    this.WIND_SLAM_RECOVERY_FRAMES = 22;
    this.WIND_SLAM_COOLDOWN_FRAMES = 96;
    this.WIND_SLAM_DAMAGE         = 32;
    this.WIND_SLAM_KNOCKBACK      = 210;
    this.CHARGE_MIN_ACTIVE_FRAMES = 4;

      this.P2_SPEED_MUL  = 1.05;
    this.P2_CD_FRAMES  = 45;

    this._dashDir    = 1;
    this._inPhase2   = false;
    this._hitApplied = false;
    this._chargeCooldown = 30;
    this._pulseCooldown = 45;
    this._airShotCooldown = this.AIR_SHOT_INTERVAL_FRAMES;
    this._windSlamCooldown = 50;
    this._windSlamDir = 1;
    this._halfBarrageTriggered = false;
    this._halfBarrageTargetX = this.HALF_BARRAGE_TARGET_X;
    this._halfBarrageTargetY = this.HALF_BARRAGE_TARGET_Y;
    this._halfBarrageStartX = x;
    this._halfBarrageStartY = y;
    this._halfGustRect = null;
    this._windGustSequence = null;
    this._windGustZones = [];
    this._combatFloorY = y;
    this._airShotDir = { x: -1, y: 0 };
  }

  takeDamage(amount, sourceType = 'field', sourceAttacker = null) {
    if (!this._isHalfBarrageState()) {
      return super.takeDamage(amount, sourceType, sourceAttacker);
    }
    if (this.isDead) return 0;

    const reduced = Math.max(1, Math.round(amount * 0.35));
    this._hitFlash = 8;
    this.hp = Math.max(this.hp - reduced, 0);
    spawnDmgNum(this.x, this.y - this.height - 16, reduced, '#f8c');
    sourceAttacker?.onDealDamage?.(reduced, sourceType);
    if (this.hp <= 0) {
      this._die();
      return reduced;
    }
    return reduced;
  }

  _getBodyCenter() {
    return { x: this.x, y: this.y - this.height / 2 };
  }

  _getPlayerCenter() {
    if (!this._player) return this._getBodyCenter();
    return {
      x: this._player.x,
      y: this._player.y - this._player.height / 2,
    };
  }

  _getChargeDashDistance() {
    return this.CHARGE_SPEED * this.CHARGE_DASH_FRAMES * DT;
  }

  _onStateEntered(s) {
    if (s === 'approach') this.vx = 0;
    if (s === 'chargeTelegraph') {
      this.vx = 0;
      this._dashDir = this._dirToPlayer();
      this._hitApplied = false;
      addVfx({
        type: 'circle',
        x: this.x + this._dashDir * 36,
        y: this.y - this.height / 2,
        r: 28,
        color: '#a8d8ff',
        dur: 0.25,
        alpha: 0.5,
        t: 0,
      });
    }
    if (s === 'chargeDash') {
      this.vx = this._dashDir * this.CHARGE_SPEED;
      this.onWall = false;
      this._hitApplied = false;
    }
    if (s === 'chargeRecovery') {
      this.vx = 0;
      this._chargeCooldown = this.CHARGE_COOLDOWN_FRAMES;
    }
    if (s === 'pulseTelegraph') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      addVfx({
        type: 'circle',
        x: this._getBodyCenter().x,
        y: this._getBodyCenter().y,
        r: 18,
        color: '#9fd8ff',
        dur: 0.22,
        alpha: 0.35,
        t: 0,
      });
    }
    if (s === 'pulseAttack') {
      this.vx = 0;
      this.vy = 0;
    }
    if (s === 'pulseRecovery') {
      this.vx = 0;
      this.vy = 0;
      this._pulseCooldown = this.PULSE_COOLDOWN_FRAMES;
    }
    if (s === 'airShotTelegraph') {
      this.vx = 0;
      this.vy = 0;
      const from = this._getBodyCenter();
      const to = this._getPlayerCenter();
      const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      this._airShotDir = { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
    }
    if (s === 'airShotFire') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
    }
    if (s === 'airShotRecovery') {
      this.vx = 0;
      this.vy = 0;
    }
    if (s === 'windSlamTelegraph') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      this._windSlamDir = this._dirToPlayer();
    }
    if (s === 'windSlamAttack') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
    }
    if (s === 'windSlamRecovery') {
      this.vx = 0;
      this.vy = 0;
      this._windSlamCooldown = this.WIND_SLAM_COOLDOWN_FRAMES;
    }
    if (s === 'halfBarrageMove') {
      this.vx = 0;
      this.vy = 0;
      this._chargeCooldown = this.CHARGE_COOLDOWN_FRAMES;
      this._pulseCooldown = this.PULSE_COOLDOWN_FRAMES;
      this._halfBarrageStartX = this.x;
      addVfx({
        type: 'circle',
        x: this.x,
        y: this.y - this.height / 2,
        r: 52,
        color: '#ffd080',
        dur: 0.35,
        alpha: 0.45,
        t: 0,
      });
    }
      if (s === 'halfBarrageAttack') {
        this.vx = 0;
        this.vy = 0;
        this._halfGustRect = null;
        this._startWindGustSequence();
      }
    if (s === 'halfBarrageReturn') {
      this.vx = 0;
      this.vy = 0;
      this._chargeCooldown = this.CHARGE_COOLDOWN_FRAMES;
    }
    if (s === 'attack') {
      this._dashDir    = this._dirToPlayer();
      this._hitApplied = false;
    }
  }

  _processState(_dt) {
    this._updateWindGustScheduler();
    this._updateWindGustZones();
    if (!this._inPhase2 && this.hp <= this.maxHp * 0.5)
      this._inPhase2 = true;
    if (this._isHalfBarrageState()) {
      this._processHalfBarrageState();
      return;
    }
    if (this._tryStartHalfBarrage()) return;
    if (this._chargeCooldown > 0)
      this._chargeCooldown--;
    if (this._pulseCooldown > 0)
      this._pulseCooldown--;
    if (this._airShotCooldown > 0)
      this._airShotCooldown--;
    if (this._windSlamCooldown > 0)
      this._windSlamCooldown--;
    const ctx = this._getCombatContext();
      this._refreshRangedIntent(
        ctx,
        this.AIR_SHOT_TRIGGER_DISTANCE,
        this.AIR_SHOT_KEEP_DISTANCE
      );

    switch(this.state) {
      case 'idle': break;
      case 'approach': this._handleApproach(); break;
      case 'airShotTelegraph': this._handleAirShotTelegraph(); break;
      case 'airShotFire': this._handleAirShotFire(); break;
      case 'airShotRecovery': this._handleAirShotRecovery(); break;
      case 'windSlamTelegraph': this._handleWindSlamTelegraph(); break;
      case 'windSlamAttack': this._handleWindSlamAttack(); break;
      case 'windSlamRecovery': this._handleWindSlamRecovery(); break;
      case 'pulseTelegraph': this._handlePulseTelegraph(); break;
      case 'pulseAttack': this._handlePulseAttack(); break;
      case 'pulseRecovery': this._handlePulseRecovery(); break;
      case 'halfBarrageMove': this._handleHalfBarrageMove(); break;
      case 'halfBarrageAttack': this._handleHalfBarrageAttack(); break;
      case 'halfBarrageReturn': this._handleHalfBarrageReturn(); break;
      case 'chargeTelegraph': this._handleChargeTelegraph(); break;
      case 'chargeDash': this._handleChargeDash(); break;
      case 'chargeRecovery': this._handleChargeRecovery(); break;
      case 'attack':   this._handleDashAttack(); break;
    }
  }

  _usesBarragePhase() {
    return this.constructor === Boss1;
  }

  _tryStartHalfBarrage() {
    if (!this._usesBarragePhase()) return false;
    if (this._halfBarrageTriggered) return false;
    if (this.state !== 'approach') return false;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    if (ratio > this.HALF_BARRAGE_TRIGGER_RATIO) return false;
    this._halfBarrageTriggered = true;
    this._changeState('halfBarrageMove');
    return true;
  }

  _isHalfBarrageState() {
    return this.state === 'halfBarrageMove' ||
      this.state === 'halfBarrageAttack' ||
      this.state === 'halfBarrageReturn';
  }

  _processHalfBarrageState() {
    switch(this.state) {
      case 'halfBarrageMove': this._handleHalfBarrageMove(); break;
      case 'halfBarrageAttack': this._handleHalfBarrageAttack(); break;
      case 'halfBarrageReturn': this._handleHalfBarrageReturn(); break;
    }
  }

  _handleHalfBarrageMove() {
    const dy = this._halfBarrageTargetY - this.y;
    const dx = this._halfBarrageTargetX - this.x;
    if (Math.abs(dx) <= 8 && Math.abs(dy) <= 8) {
      this.x = this._halfBarrageTargetX;
      this.y = this._halfBarrageTargetY;
      this.vx = 0;
      this.vy = 0;
      this._changeState('halfBarrageAttack');
      return;
    }
    this.vx = Math.sign(dx) * this.HALF_BARRAGE_MOVE_SPEED;
    this.vy = Math.sign(dy) * this.HALF_BARRAGE_MOVE_SPEED;
  }

  _handleHalfBarrageAttack() {
    this.vx = 0;
    this.vy = 0;
    this.x = this._halfBarrageTargetX;
    this.y = this._halfBarrageTargetY;

    if (this.tick >= this.HALF_BARRAGE_ATTACK_FRAMES)
      this._changeState('halfBarrageReturn');
  }

  _startWindGustSequence() {
    this._windGustSequence = { tick: 0, spawned: 0 };
  }

  _updateWindGustScheduler() {
    if (!this._windGustSequence) return;
    const seq = this._windGustSequence;
    seq.tick++;
    const canSpawn = this._windGustZones.length < this.MAX_ACTIVE_WIND_ZONES;
    if (canSpawn && (seq.tick === 1 || seq.tick % this.HALF_GUST_INTERVAL_FRAMES === 0)) {
      this._windGustZones.push({
        ...this._buildHalfGustRect(),
        tick: 0,
        hit: false,
      });
      seq.spawned++;
    }
    if (seq.tick >= this.HALF_GUST_SEQUENCE_FRAMES)
      this._windGustSequence = null;
  }

  _updateWindGustZones() {
    if (!this._windGustZones || this._windGustZones.length === 0) return;
    const life = this.HALF_GUST_TELEGRAPH_FRAMES + this.HALF_GUST_ACTIVE_FRAMES;
    for (const zone of this._windGustZones) {
      zone.tick++;
      if (!zone.hit && zone.tick >= this.HALF_GUST_TELEGRAPH_FRAMES) {
        zone.hit = true;
        this._applyHalfGustHit(zone);
      }
    }
    this._windGustZones = this._windGustZones.filter(zone => zone.tick <= life);
  }

  _buildHalfGustRect() {
    const target = this._player ? this._getPlayerCenter() : { x: this.x, y: FLOOR_Y - 90 };
    const w = this.HALF_GUST_W;
    const h = this.HALF_GUST_H;
    const x = clamp(target.x - w / 2, TILE, ROOM_W - TILE - w);
    const y = clamp(target.y - h / 2, TILE, FLOOR_Y - h);
    return { x, y, w, h };
  }

  _applyHalfGustHit(zone = this._halfGustRect) {
    if (!this._player || !zone) return;
    const pr = eRect(this._player);
    const gr = zone;
    if (pr.l >= gr.x + gr.w || pr.r <= gr.x || pr.t >= gr.y + gr.h || pr.b <= gr.y) return;
    this._dealDamageToPlayer(this.HALF_GUST_DAMAGE);
    const pushDir = Math.sign(this._player.x - this.x) || 1;
    this._player.vx += pushDir * this.HALF_GUST_PUSH;
  }

  _handleHalfBarrageReturn() {
    const targetY = this._combatFloorY || this._halfBarrageStartY;
    const dx = this._player ? this._player.x - this.x : this._halfBarrageStartX - this.x;
    const dy = targetY - this.y;
    if (this.tick >= this.HALF_BARRAGE_RETURN_FRAMES || (Math.abs(dx) <= 24 && Math.abs(dy) <= 12)) {
      this.vx = 0;
      this.vy = 0;
      this._changeState('approach');
      return;
    }
    this.vx = Math.sign(dx || -1) * this.APPROACH_SPEED;
    this.vy = Math.sign(dy || 1) * this.APPROACH_SPEED;
  }

  _fireHalfBarrageAimedShot() {
    if (!this._player) return;
    const from = this._getBodyCenter();
    const to = this._getPlayerCenter();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    this._spawnProjectile(dx / len, dy / len, this.HALF_BARRAGE_AIMED_SPEED, this.HALF_BARRAGE_BULLET_DMG, null, { ignoreWalls: true });
  }

  _fireHalfBarrageFixedFan() {
    const volleyIndex = Math.floor(this.tick / this.HALF_BARRAGE_FIXED_INTERVAL);
    const step = (Math.PI * 2) / 12;
    const rotation = volleyIndex * 0.18;
    for (let i = 0; i < 12; i++) {
      const a = rotation + i * step;
      this._spawnProjectile(
        Math.cos(a),
        Math.sin(a),
        this.HALF_BARRAGE_FIXED_SPEED,
        this.HALF_BARRAGE_BULLET_DMG,
        null,
        { ignoreWalls: true }
      );
    }
  }

  _fireHalfBarrageAimedSpread() {
    if (!this._player) return;
    const from = this._getBodyCenter();
    const to = this._getPlayerCenter();
    const baseAngle = Math.atan2(to.y - from.y, to.x - from.x);
    for (const offset of [-0.34, -0.17, 0, 0.17, 0.34]) {
      const angle = baseAngle + offset;
      this._spawnProjectile(
        Math.cos(angle),
        Math.sin(angle),
        this.HALF_BARRAGE_AIMED_SPEED * 0.96,
        this.HALF_BARRAGE_BULLET_DMG,
        null,
        { ignoreWalls: true }
      );
    }
  }

  _handleApproach() {
    const ctx = this._getCombatContext();
      this._refreshRangedIntent(
        ctx,
        this.AIR_SHOT_TRIGGER_DISTANCE,
        this.AIR_SHOT_KEEP_DISTANCE
      );
    const playerDist = ctx.distanceToPlayer;
    const platformPressure = ctx.playerAbove || ctx.playerOnPlatformLikely;
    if (platformPressure && this._canStartAirShot(ctx)) {
      this._changeState('airShotTelegraph');
      return;
    }
    if (this._canStartWindSlam(ctx)) {
      this._changeState('windSlamTelegraph');
      return;
    }
    if (this._canStartPulse(playerDist)) {
      this._changeState('pulseTelegraph');
      return;
    }
    if (this._canStartAirShot(ctx)) {
      this._changeState('airShotTelegraph');
      return;
    }
    if (this._usesTelegraphedCharge()) {
      if (this._canStartCharge(playerDist)) {
        this._changeState('chargeTelegraph');
        return;
      }
    } else if (playerDist <= this.ATTACK_RANGE) {
      this._changeState('attack');
      return;
    }
    const spd = this.APPROACH_SPEED * (this._inPhase2 ? this.P2_SPEED_MUL : 1);
    this.vx = this._dirToPlayer() * spd;
  }

  _canStartPulse(playerDist) {
    return this.constructor === Boss1 &&
      !this._isHalfBarrageState() &&
      this._pulseCooldown <= 0 &&
      playerDist <= this.PULSE_TRIGGER_RANGE;
  }

  _canStartWindSlam(ctx = this._getCombatContext()) {
    if (this.constructor !== Boss1) return false;
    if (!this._fighting || !this._player) return false;
    if (this._windSlamCooldown > 0) return false;
    if (this._isHalfBarrageState()) return false;
    if (this.state !== 'approach') return false;
    if (ctx.timeSinceLastAttack < 14) return false;
    if (ctx.playerOnPlatformLikely || ctx.playerAbove) return false;
    if (ctx.verticalDistanceAbs > this.WIND_SLAM_H * 0.8) return false;
    return ctx.distanceToPlayer <= this.WIND_SLAM_RANGE;
  }

  _canStartAirShot(ctx = this._getCombatContext()) {
    if (this.constructor !== Boss1) return false;
    if (!this._fighting || !this._player) return false;
    if (this._airShotCooldown > 0) return false;
    if (this._isHalfBarrageState()) return false;
    if (this.state !== 'approach') return false;
    if (ctx.timeSinceLastAttack < 18) return false;
    return this._rangedIntent || ctx.playerAbove || ctx.playerOnPlatformLikely;
  }

  _fireAirShotProjectile() {
    const from = this._getBodyCenter();
    Projectiles.add(new EnemyProjectile(
      from.x,
      from.y,
      this._airShotDir.x,
      this._airShotDir.y,
      this.AIR_SHOT_SPEED,
      this._getScaledBossDamage(this.AIR_SHOT_DAMAGE),
      '#d8f6ff',
      this.AIR_SHOT_RADIUS,
      'air',
      { ignoreWalls: true }
    ));
    addVfx({
      type: 'circle',
      x: from.x,
      y: from.y,
      r: 12,
      color: '#d8f6ff',
      dur: 0.16,
      alpha: 0.45,
      t: 0,
    });
    this._airShotCooldown = this.AIR_SHOT_INTERVAL_FRAMES;
    this._markAttackUsed('airShot');
  }

  _handleAirShotTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.AIR_SHOT_TELEGRAPH_FRAMES)
      this._changeState('airShotFire');
  }

  _handleAirShotFire() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._fireAirShotProjectile();
    }
    if (this.tick >= this.AIR_SHOT_FIRE_FRAMES)
      this._changeState('airShotRecovery');
  }

  _handleAirShotRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.AIR_SHOT_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _getWindSlamRect() {
    const cx = this.x + this._windSlamDir * (this.hw + this.WIND_SLAM_W / 2 - 8);
    const cy = this.y - this.height / 2;
    return {
      x: cx - this.WIND_SLAM_W / 2,
      y: cy - this.WIND_SLAM_H / 2,
      w: this.WIND_SLAM_W,
      h: this.WIND_SLAM_H,
      cx,
      cy,
    };
  }

  _handleWindSlamTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.WIND_SLAM_TELEGRAPH_FRAMES)
      this._changeState('windSlamAttack');
  }

  _handleWindSlamAttack() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._markAttackUsed('windSlam');
      const rect = this._getWindSlamRect();
      const pr = this._player ? eRect(this._player) : null;
      if (pr && pr.l < rect.x + rect.w && pr.r > rect.x && pr.t < rect.y + rect.h && pr.b > rect.y) {
        this._dealDamageToPlayer(this.WIND_SLAM_DAMAGE);
        this._player.vx += this._windSlamDir * this.WIND_SLAM_KNOCKBACK;
      }
      addVfx({
        type:'rect',
        x: rect.cx,
        y: rect.cy,
        w: rect.w,
        h: rect.h,
        rot:0,
        color:'#d8f6ff',
        dur:0.16,
        alpha:0.4,
        t:0,
      });
    }
    if (this.tick >= this.WIND_SLAM_ATTACK_FRAMES)
      this._changeState('windSlamRecovery');
  }

  _handleWindSlamRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.WIND_SLAM_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _handlePulseTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.PULSE_TELEGRAPH_FRAMES)
      this._changeState('pulseAttack');
  }

  _handlePulseAttack() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._checkPulseHit();
      this._markAttackUsed('pulse');
      const center = this._getBodyCenter();
      addVfx({
        type: 'circle',
        x: center.x,
        y: center.y,
        r: this.PULSE_RADIUS,
        color: '#b8ecff',
        dur: 0.2,
        alpha: 0.3,
        t: 0,
      });
    }
    if (this.tick >= this.PULSE_ATTACK_FRAMES)
      this._changeState('pulseRecovery');
  }

  _handlePulseRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.PULSE_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _checkPulseHit() {
    if (!this._player) return;
    const center = this._getBodyCenter();
    const playerCenter = this._getPlayerCenter();
    if (dist2(center.x, center.y, playerCenter.x, playerCenter.y) <= this.PULSE_RADIUS)
        this._dealDamageToPlayer(this.PULSE_DAMAGE);
  }

  _canStartCharge(playerDist) {
    return this._chargeCooldown <= 0 &&
      this.onFloor &&
      playerDist >= this.CHARGE_TRIGGER_MIN &&
      playerDist <= this.CHARGE_TRIGGER_MAX;
  }

  _usesTelegraphedCharge() {
    return this.constructor === Boss1;
  }

  _handleChargeTelegraph() {
    this.vx = 0;
    if (this.tick >= this.CHARGE_TELEGRAPH_FRAMES)
      this._changeState('chargeDash');
  }

  _handleChargeDash() {
    this.vx = this._dashDir * this.CHARGE_SPEED;
    if (this.tick > this.CHARGE_MIN_ACTIVE_FRAMES &&
        (this.onWall || !this.onFloor || this._isAtChargeBoundaryAhead())) {
      this._changeState('chargeRecovery');
      return;
    }

    if (!this._hitApplied && this.tick >= 4) {
      this._hitApplied = true;
      this._markAttackUsed('charge');
      const off = this._dashDir * this.MELEE_W * 0.5;
      this._checkHitbox(off, this.MELEE_W, this.MELEE_H, this.MELEE_DMG);
      addVfx({
        type: 'rect',
        x: this.x + off, y: this.y - this.height / 2,
        w: this.MELEE_W, h: this.MELEE_H, rot: 0,
        color: '#80b0ff', dur: 0.15, alpha: 0.5, t: 0,
      });
    }

    if (this.tick >= this.CHARGE_DASH_FRAMES)
      this._changeState('chargeRecovery');
  }

  _handleChargeRecovery() {
    this.vx = 0;
    if (this.tick >= this.CHARGE_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _isAtChargeBoundaryAhead() {
    const nextX = this.x + this._dashDir * this.CHARGE_SPEED * DT;
    return nextX - this.hw <= TILE + 2 || nextX + this.hw >= ROOM_W - TILE - 2;
  }

  _handleDashAttack() {
    const dur = this.DASH_DUR;
    if (this.tick < dur) {
      this.vx = this._dashDir * this.DASH_SPEED;
      if (!this._hitApplied && this.tick === 4) {
        this._hitApplied = true;
        this._markAttackUsed('dashAttack');
        const off = this._dashDir * this.MELEE_W * 0.5;
        this._checkHitbox(off, this.MELEE_W, this.MELEE_H, this.MELEE_DMG);
        addVfx({ type:'rect',
          x: this.x + off, y: this.y - this.height/2,
          w: this.MELEE_W, h: this.MELEE_H, rot:0,
          color:'#80b0ff', dur:0.15, alpha:0.5, t:0
        });
      }
    } else {
      this.vx = 0;
      const cd = this._inPhase2 ? this.P2_CD_FRAMES : this.CD_FRAMES;
      if (this.tick >= dur + cd) this._changeState('approach');
    }
  }

  draw(ctx) {
    super.draw(ctx);

    if (this.removeMe) return;

    if (this.state === 'airShotTelegraph' || this.state === 'airShotFire') {
      const from = this._getBodyCenter();
      const toX = from.x + this._airShotDir.x * 170;
      const toY = from.y + this._airShotDir.y * 170;
      const a = this.state === 'airShotFire' ? 0.9 : 0.5;
      const s1 = Camera.toScreen(from.x, from.y);
      const s2 = Camera.toScreen(toX, toY);
      ctx.save();
      ctx.strokeStyle = `rgba(200, 238, 255, ${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(216, 246, 255, ${Math.min(a + 0.1, 1)})`;
      ctx.beginPath();
      ctx.arc(s2.x, s2.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

      if (this.state === 'pulseTelegraph') {
        const center = this._getBodyCenter();
        const s = Camera.toScreen(center.x, center.y);
      const progress = clamp(this.tick / this.PULSE_TELEGRAPH_FRAMES, 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(184, 236, 255, ${0.08 + progress * 0.1})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.PULSE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(184, 236, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.PULSE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
        ctx.restore();
      }

      if (this.state === 'windSlamTelegraph' || this.state === 'windSlamAttack') {
        const rect = this._getWindSlamRect();
        const s = Camera.toScreen(rect.cx, rect.cy);
        const progress = clamp(this.tick / this.WIND_SLAM_TELEGRAPH_FRAMES, 0, 1);
        const active = this.state === 'windSlamAttack';
        ctx.save();
        ctx.fillStyle = active
          ? 'rgba(216, 246, 255, 0.26)'
          : `rgba(184, 236, 255, ${0.08 + progress * 0.12})`;
        ctx.strokeStyle = active ? 'rgba(238, 252, 255, 0.98)' : 'rgba(216, 246, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.fillRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
        if (!active) {
          ctx.fillStyle = `rgba(238, 252, 255, ${0.12 + progress * 0.16})`;
          ctx.fillRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w * progress, rect.h);
        }
        ctx.strokeRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
        ctx.strokeStyle = `rgba(238, 252, 255, ${0.22 + progress * 0.35})`;
        for (let i = 0; i < 4; i++) {
          const y = s.y - rect.h * 0.3 + i * rect.h * 0.2;
          ctx.beginPath();
          ctx.moveTo(s.x - rect.w / 2 + 12, y);
          ctx.lineTo(s.x + rect.w / 2 - 12, y + Math.sin(this.tick * 0.2 + i) * 6);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (this._windGustZones && this._windGustZones.length > 0) {
      ctx.save();
      for (const gr of this._windGustZones) {
        const gs = Camera.toScreen(gr.x, gr.y);
        const progress = clamp(gr.tick / this.HALF_GUST_TELEGRAPH_FRAMES, 0, 1);
        const active = gr.tick >= this.HALF_GUST_TELEGRAPH_FRAMES;
        ctx.fillStyle = `rgba(184, 236, 255, ${0.08 + progress * 0.12})`;
        ctx.strokeStyle = active ? 'rgba(238, 252, 255, 0.98)' : 'rgba(216, 246, 255, 0.92)';
        ctx.lineWidth = 2;
        ctx.fillRect(gs.x, gs.y, gr.w, gr.h);
        ctx.strokeRect(gs.x, gs.y, gr.w, gr.h);
        ctx.fillStyle = `rgba(228, 250, 255, ${0.08 + progress * 0.16})`;
        ctx.fillRect(gs.x, gs.y, gr.w * (active ? 1 : progress), gr.h);
        ctx.strokeStyle = `rgba(238, 252, 255, ${0.2 + progress * 0.35})`;
        for (let i = 0; i < 6; i++) {
          const y = gs.y + gr.h * (0.15 + i * 0.14);
          ctx.beginPath();
          ctx.moveTo(gs.x + 18, y);
          ctx.lineTo(gs.x + gr.w - 18, y + Math.sin(this.tick * 0.2 + i) * 9);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (this._isHalfBarrageState()) {
      ctx.save();
      const s = Camera.toScreen(this.x, this.y);
      ctx.strokeStyle = 'rgba(255, 216, 144, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y - this.height / 2, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (!this._usesTelegraphedCharge() || this.state !== 'chargeTelegraph') return;

    const s = Camera.toScreen(this.x, this.y);
    const dashW = Math.max(84, Math.round(this._getChargeDashDistance()));
    const dashH = this.height - 12;
    const dashX = this._dashDir > 0 ? s.x + this.hw + 10 : s.x - this.hw - 10 - dashW;
    const dashY = s.y - this.height + 6;

    ctx.save();
    ctx.fillStyle = 'rgba(168, 216, 255, 0.18)';
    ctx.fillRect(dashX, dashY, dashW, dashH);
    ctx.strokeStyle = '#d8f0ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(dashX, dashY, dashW, dashH);
    ctx.restore();
  }

  _onDie() {
    this._windGustSequence = null;
    this._windGustZones = [];
  }
}

// ?? BossFinal ??38???뚮갑愿 ?쒓껐 ?????????????????????
class Boss2 extends Boss1 {
  constructor(x, y, callbacks = {}) {
    super(x, y, callbacks);
    this.displayName = 'Stopped Youth';
    this.hp = 1500; this.maxHp = 1500;
    this.color = '#cf6d2c'; this.baseColor = '#cf6d2c';
    this._spriteKey = 'boss2';
    this.BOSS_DAMAGE_MULTIPLIER = 1.2;
    this.APPROACH_SPEED = 220;
    this.DASH_SPEED = 880;
    this.P2_SPEED_MUL = 1.25;

    this.HEAT_SLASH_TELEGRAPH_FRAMES = 68;
    this.HEAT_SLASH_ATTACK_FRAMES = 8;
    this.HEAT_SLASH_RECOVERY_FRAMES = 14;
    this.HEAT_SLASH_COOLDOWN_FRAMES = 84;
    this.HEAT_SLASH_RANGE = 460;
    this.HEAT_SLASH_DAMAGE = 36;
    this.HEAT_SLASH_W = 112;
    this.HEAT_SLASH_H = 410;
    this.HEAT_SLASH_OFFSET = 170;
    this.HEAT_SLASH_TICK_INTERVAL = 30;
    this.HEAT_SLASH_ZONE_ACTIVE_FRAMES = 120;
    this.MAX_HEAT_SLASH_WALLS = 2;

    this.FLAME_LINE_TELEGRAPH_FRAMES = 30;
    this.FLAME_LINE_ATTACK_FRAMES = 42;
    this.FLAME_LINE_RECOVERY_FRAMES = 14;
    this.FLAME_LINE_COOLDOWN_FRAMES = 96;
    this.FLAME_LINE_RANGE_MIN = 140;
    this.FLAME_LINE_DAMAGE = 46;
    this.FLAME_LINE_W = 620;
    this.FLAME_LINE_H = 64;
    this.FLAME_LINE_OFFSET_AHEAD = 128;
    this.FLAME_LINE_PULSE_INTERVAL = 18;
    this.FLAME_SHOT_TELEGRAPH_FRAMES = 16;
    this.FLAME_SHOT_FIRE_FRAMES = 6;
    this.FLAME_SHOT_RECOVERY_FRAMES = 14;
    this.FLAME_SHOT_COOLDOWN_FRAMES = 120;
    this.FLAME_SHOT_TRIGGER_DISTANCE = 540;
    this.FLAME_SHOT_KEEP_DISTANCE = 480;
    this.FLAME_SHOT_SPEED = 280;
    this.FLAME_SHOT_DAMAGE = 24;
    this.FLAME_SHOT_RADIUS = 6;

    this.CLOSE_BURST_TRIGGER_RANGE = 260;
    this.CLOSE_BURST_TELEGRAPH_FRAMES = 54;
    this.CLOSE_BURST_ATTACK_FRAMES = 8;
    this.CLOSE_BURST_RECOVERY_FRAMES = 16;
    this.CLOSE_BURST_COOLDOWN_FRAMES = 96;
    this.CLOSE_BURST_RADIUS = 300;
      this.CLOSE_BURST_DAMAGE = 44;

    this.OVERHEAT_BARRAGE_TRIGGER_RATIO = 0.5;
    this.OVERHEAT_BARRAGE_ENTER_FRAMES = 24;
    this.OVERHEAT_BARRAGE_ATTACK_FRAMES = 30;
    this.OVERHEAT_BARRAGE_EXIT_FRAMES = 14;
    this.FLAME_PILLAR_SEQUENCE_FRAMES = 360;
    this.FLAME_PILLAR_SEQUENCE_COUNT = 12;
    this.OVERHEAT_BARRAGE_AIMED_INTERVAL = 34;
    this.OVERHEAT_BARRAGE_FIXED_INTERVAL = 22;
    this.OVERHEAT_BARRAGE_BULLET_SPEED = 288;
    this.OVERHEAT_BARRAGE_BULLET_DAMAGE = 24;
    this.OVERHEAT_BARRAGE_MOVE_SPEED = 300;
    this.OVERHEAT_BARRAGE_TARGET_X = ROOM_W * 0.5;
    this.FLAME_PILLAR_INTERVAL_FRAMES = 24;
    this.FLAME_PILLAR_TELEGRAPH_FRAMES = 42;
    this.FLAME_PILLAR_ACTIVE_FRAMES = 16;
    this.FLAME_PILLAR_W = 104;
    this.FLAME_PILLAR_H = 420;
    this.FLAME_PILLAR_DAMAGE = 70;
    this.MAX_ACTIVE_FIRE_ZONES = 4;

    this._heatSlashCooldown = 50;
    this._flameLineCooldown = 90;
    this._closeBurstCooldown = 70;
    this._overheatBarrageTriggered = false;
    this._overheatBarrageStartX = x;
    this._lastPattern = null;
    this._slashDir = 1;
    this._heatSlashCy = y - this.height / 2;
    this._heatSlashLastTickBucket = -1;
    this._heatSlashWalls = [];
    this._flameLineCenterX = x;
    this._flameShotCooldown = 45;
    this._flameShotDir = { x: -1, y: 0 };
    this._flamePillars = [];
    this._flamePillarSequence = null;
  }

  _processState(_dt) {
    this._updateDetachedFireZones();
    if (this._tryStartOverheatBarrage()) return;
    if (this._heatSlashCooldown > 0) this._heatSlashCooldown--;
    if (this._flameLineCooldown > 0) this._flameLineCooldown--;
    if (this._closeBurstCooldown > 0) this._closeBurstCooldown--;
    if (this._flameShotCooldown > 0) this._flameShotCooldown--;
    const ctx = this._getCombatContext();
      this._refreshRangedIntent(
        ctx,
        this.FLAME_SHOT_TRIGGER_DISTANCE,
        this.FLAME_SHOT_KEEP_DISTANCE
      );

    switch (this.state) {
      case 'idle': break;
      case 'approach': this._handleBoss2Approach(); break;
      case 'flameShotTelegraph': this._handleFlameShotTelegraph(); break;
      case 'flameShotFire': this._handleFlameShotFire(); break;
      case 'flameShotRecovery': this._handleFlameShotRecovery(); break;
      case 'overheatBarrageEnter': this._handleOverheatBarrageEnter(); break;
      case 'overheatBarrageAttack': this._handleOverheatBarrageAttack(); break;
      case 'overheatBarrageExit': this._handleOverheatBarrageExit(); break;
      case 'closeBurstTelegraph': this._handleCloseBurstTelegraph(); break;
      case 'closeBurstAttack': this._handleCloseBurstAttack(); break;
      case 'closeBurstRecovery': this._handleCloseBurstRecovery(); break;
      case 'heatSlashTelegraph': this._handleHeatSlashTelegraph(); break;
      case 'heatSlashAttack': this._handleHeatSlashAttack(); break;
      case 'heatSlashRecovery': this._handleHeatSlashRecovery(); break;
      case 'flameLineTelegraph': this._handleFlameLineTelegraph(); break;
      case 'flameLineAttack': this._handleFlameLineAttack(); break;
      case 'flameLineRecovery': this._handleFlameLineRecovery(); break;
    }
  }

  _onStateEntered(s) {
    super._onStateEntered(s);
    if (s === 'overheatBarrageEnter') {
      this.vx = 0;
      this.vy = 0;
      this._overheatBarrageStartX = this.x;
      return;
    }
    if (s === 'overheatBarrageAttack') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      return;
    }
    if (s === 'overheatBarrageExit') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
      if (s === 'closeBurstTelegraph') {
        this._clearRangedIntent();
        this.vx = 0;
        this.vy = 0;
        this._hitApplied = false;
        return;
      }
    if (s === 'closeBurstAttack') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      return;
    }
    if (s === 'closeBurstRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
      if (s === 'heatSlashTelegraph') {
        this._clearRangedIntent();
        this.vx = 0;
          this.vy = 0;
          this._hitApplied = false;
          this._heatSlashLastTickBucket = -1;
          this._slashDir = this._dirToPlayer();
          this._heatSlashCy = FLOOR_Y - this.HEAT_SLASH_H / 2;
          return;
    }
    if (s === 'heatSlashAttack') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      this._heatSlashLastTickBucket = -1;
      return;
    }
    if (s === 'heatSlashRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
      if (s === 'flameLineTelegraph') {
        this._clearRangedIntent();
        this.vx = 0;
        this.vy = 0;
        this._hitApplied = false;
        this._flameLineCenterX = this._getFlameLineTargetX();
        return;
    }
    if (s === 'flameLineAttack') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      return;
    }
    if (s === 'flameLineRecovery') {
      this.vx = 0;
      this.vy = 0;
    }
    if (s === 'flameShotTelegraph') {
      this.vx = 0;
      this.vy = 0;
      const from = this._getBodyCenter();
      const to = this._getPlayerCenter();
      const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      this._flameShotDir = { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
    }
    if (s === 'flameShotFire') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
    }
    if (s === 'flameShotRecovery') {
      this.vx = 0;
      this.vy = 0;
    }
  }

  _tryStartOverheatBarrage() {
    if (this._overheatBarrageTriggered) return false;
    if (this.state !== 'approach') return false;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    if (ratio > this.OVERHEAT_BARRAGE_TRIGGER_RATIO) return false;
    this._overheatBarrageTriggered = true;
    this._changeState('overheatBarrageEnter');
    return true;
  }

  _handleBoss2Approach() {
    if (!this._player) {
      this.vx = 0;
      return;
    }

    const ctx = this._getCombatContext();
      this._refreshRangedIntent(
        ctx,
        this.FLAME_SHOT_TRIGGER_DISTANCE,
        this.FLAME_SHOT_KEEP_DISTANCE
      );
    const playerDist = ctx.distanceToPlayer;
    const sameLayerMelee = !ctx.playerOnPlatformLikely && ctx.verticalDistanceAbs <= this.CLOSE_BURST_RADIUS * 0.55;
    const burstReady = this._closeBurstCooldown <= 0;
    const slashReady = this._heatSlashCooldown <= 0;
    const flameReady = this._flameLineCooldown <= 0;
    const flameShotReady = this._flameShotCooldown <= 0;
    const canBurst = burstReady && sameLayerMelee && playerDist <= this.CLOSE_BURST_TRIGGER_RANGE;
    const canSlash = slashReady && playerDist <= this.HEAT_SLASH_RANGE;
    const flameCanReach = !ctx.playerOnPlatformLikely && Math.abs(ctx.verticalDistance) <= this.FLAME_LINE_H * 1.35;
    const canFlame = flameReady && flameCanReach && playerDist >= this.FLAME_LINE_RANGE_MIN;
    const canFlameShot = flameShotReady &&
      ctx.timeSinceLastAttack >= 18 &&
      this._rangedIntent &&
      playerDist >= this.FLAME_SHOT_KEEP_DISTANCE;
    const slashPreferred = playerDist <= this.HEAT_SLASH_RANGE * 0.72;

    if (canBurst && this._lastPattern !== 'closeBurst') {
      this._changeState('closeBurstTelegraph');
      return;
    }

      if (ctx.playerOnPlatformLikely && canFlameShot) {
        this._changeState('flameShotTelegraph');
        return;
      }

      if (ctx.playerOnPlatformLikely && canSlash) {
        this._changeState('heatSlashTelegraph');
        return;
      }

    if (canSlash && canFlame) {
      if (this._lastPattern === 'heatSlash') {
        this._changeState('flameLineTelegraph');
        return;
      }
      if (this._lastPattern === 'flameLine' || slashPreferred) {
        this._changeState('heatSlashTelegraph');
        return;
      }
      this._changeState('flameLineTelegraph');
      return;
    }

    if (canSlash) {
      this._changeState('heatSlashTelegraph');
      return;
    }
    if (canFlameShot) {
      this._changeState('flameShotTelegraph');
      return;
    }
    if (canFlame) {
      this._changeState('flameLineTelegraph');
      return;
    }

    const desiredGap = canSlash ? this.HEAT_SLASH_RANGE * 0.58 : this.FLAME_LINE_RANGE_MIN;
    const dir = this._dirToPlayer();
    if (playerDist > desiredGap + 24) this.vx = dir * this.APPROACH_SPEED;
    else if (playerDist < desiredGap - 36) this.vx = -dir * this.APPROACH_SPEED * 0.55;
    else this.vx = 0;
  }

  _handleOverheatBarrageEnter() {
    this.vy = 0;
    const dx = this.OVERHEAT_BARRAGE_TARGET_X - this.x;
    if (Math.abs(dx) <= 8) {
      this.x = this.OVERHEAT_BARRAGE_TARGET_X;
      this.vx = 0;
    } else {
      this.vx = Math.sign(dx) * this.OVERHEAT_BARRAGE_MOVE_SPEED;
    }
    if (this.tick >= this.OVERHEAT_BARRAGE_ENTER_FRAMES) {
      this.vx = 0;
      this._changeState('overheatBarrageAttack');
    }
  }

  _handleOverheatBarrageAttack() {
    this.vx = 0;
    this.vy = 0;
    this.x = this.OVERHEAT_BARRAGE_TARGET_X;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._beginFlamePillarSequence();
    }
    if (this.tick >= this.OVERHEAT_BARRAGE_ATTACK_FRAMES)
      this._changeState('overheatBarrageExit');
  }

  _handleOverheatBarrageExit() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.OVERHEAT_BARRAGE_EXIT_FRAMES)
      this._changeState('approach');
  }

  _getActiveFireZoneCount() {
    const pillars = Array.isArray(this._flamePillars) ? this._flamePillars.length : 0;
    const walls = Array.isArray(this._heatSlashWalls) ? this._heatSlashWalls.length : 0;
    return pillars + walls;
  }

  _beginFlamePillarSequence() {
    this._flamePillarSequence = {
      tick: 0,
      spawned: 0,
      max: this.FLAME_PILLAR_SEQUENCE_COUNT,
    };
    this._lastPattern = 'flamePillar';
    this._markAttackUsed('flamePillar');
  }

  _updateDetachedFireZones() {
    this._updateFlamePillarSequence();
    this._updateFlamePillars();
    this._updateHeatSlashWalls();
  }

  _updateFlamePillarSequence() {
    const seq = this._flamePillarSequence;
    if (!seq) return;
    seq.tick++;
    const canSpawn = seq.spawned < seq.max && this._getActiveFireZoneCount() < this.MAX_ACTIVE_FIRE_ZONES;
    if (canSpawn && (seq.tick === 1 || seq.tick % this.FLAME_PILLAR_INTERVAL_FRAMES === 0)) {
      this._spawnFlamePillar(seq.spawned);
      seq.spawned++;
    }
    if (seq.tick >= this.FLAME_PILLAR_SEQUENCE_FRAMES || seq.spawned >= seq.max)
      this._flamePillarSequence = null;
  }

  _spawnFlamePillar(sequenceIndex = this._flamePillars.length) {
    const count = sequenceIndex;
    const targetX = this._player
      ? this._player.x + (count % 3 - 1) * 84
      : ROOM_W * (0.25 + (count % 4) * 0.17);
    const x = clamp(targetX, TILE + this.FLAME_PILLAR_W / 2, ROOM_W - TILE - this.FLAME_PILLAR_W / 2);
    this._flamePillars.push({
      x,
      y: FLOOR_Y - this.FLAME_PILLAR_H,
      w: this.FLAME_PILLAR_W,
      h: this.FLAME_PILLAR_H,
      tick: 0,
      hit: false,
    });
  }

  _updateFlamePillars() {
    if (!this._flamePillars || this._flamePillars.length === 0) return;
    for (const pillar of this._flamePillars) {
      pillar.tick++;
      if (!pillar.hit && pillar.tick >= this.FLAME_PILLAR_TELEGRAPH_FRAMES) {
        pillar.hit = true;
        this._checkRectHitPlayer(pillar, this.FLAME_PILLAR_DAMAGE);
        addVfx({
          type:'rect',
          x: pillar.x,
          y: pillar.y + pillar.h / 2,
          w: pillar.w,
          h: pillar.h,
          rot: 0,
          color:'#ff7a28',
          dur:0.18,
          alpha:0.34,
          t:0,
        });
      }
    }
    const life = this.FLAME_PILLAR_TELEGRAPH_FRAMES + this.FLAME_PILLAR_ACTIVE_FRAMES;
    this._flamePillars = this._flamePillars.filter(p => p.tick <= life);
  }

  _fireOverheatBarrageAimedShot() {
    if (!this._player) return;
    const from = this._getBodyCenter();
    const to = this._getPlayerCenter();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    this._spawnProjectile(dx / len, dy / len, this.OVERHEAT_BARRAGE_BULLET_SPEED, this.OVERHEAT_BARRAGE_BULLET_DAMAGE, 'fire', { ignoreWalls: true });
  }

  _fireOverheatBarrageFixedFan() {
    const volleyIndex = Math.floor(this.tick / this.OVERHEAT_BARRAGE_FIXED_INTERVAL);
    const step = (Math.PI * 2) / 12;
    const rotation = volleyIndex * 0.22;
    for (let i = 0; i < 12; i++) {
      const angle = rotation + i * step;
      this._spawnProjectile(
        Math.cos(angle),
        Math.sin(angle),
        this.OVERHEAT_BARRAGE_BULLET_SPEED * 0.93,
        this.OVERHEAT_BARRAGE_BULLET_DAMAGE,
        'fire',
        { ignoreWalls: true }
      );
    }
  }

  _handleCloseBurstTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.CLOSE_BURST_TELEGRAPH_FRAMES)
      this._changeState('closeBurstAttack');
  }

  _handleCloseBurstAttack() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._lastPattern = 'closeBurst';
      this._closeBurstCooldown = this.CLOSE_BURST_COOLDOWN_FRAMES;
      this._markAttackUsed('closeBurst');
      this._checkCloseBurstHit();
      const center = this._getBodyCenter();
      addVfx({
        type:'circle',
        x: center.x,
        y: center.y,
        r: this.CLOSE_BURST_RADIUS,
        color:'#ffb060',
        dur:0.18,
        alpha:0.34,
        t:0,
      });
    }
    if (this.tick >= this.CLOSE_BURST_ATTACK_FRAMES)
      this._changeState('closeBurstRecovery');
  }

  _handleCloseBurstRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.CLOSE_BURST_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _checkCloseBurstHit() {
    if (!this._player) return;
    const center = this._getBodyCenter();
    const playerCenter = this._getPlayerCenter();
    if (dist2(center.x, center.y, playerCenter.x, playerCenter.y) <= this.CLOSE_BURST_RADIUS)
      this._dealDamageToPlayer(this.CLOSE_BURST_DAMAGE);
  }

  _getHeatSlashRect() {
    const cx = this.x + this._slashDir * this.HEAT_SLASH_OFFSET;
    const cy = this._heatSlashCy || (this.y - this.height / 2);
    return {
      x: cx - this.HEAT_SLASH_W / 2,
      y: cy - this.HEAT_SLASH_H / 2,
      w: this.HEAT_SLASH_W,
      h: this.HEAT_SLASH_H,
      cx,
      cy,
    };
  }

  _handleHeatSlashTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.HEAT_SLASH_TELEGRAPH_FRAMES)
      this._changeState('heatSlashAttack');
  }

  _handleHeatSlashAttack() {
    this.vx = 0;
    this.vy = 0;
    const rect = this._getHeatSlashRect();
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._lastPattern = 'heatSlash';
      this._heatSlashCooldown = this.HEAT_SLASH_COOLDOWN_FRAMES;
      this._markAttackUsed('heatSlash');
      this._spawnHeatSlashWall(rect);
      addVfx({
        type:'rect',
        x: rect.cx,
        y: rect.cy,
        w: rect.w,
        h: rect.h,
        rot: 0,
        color:'#ff8a3d',
        dur:0.18,
        alpha:0.42,
        t:0,
      });
    }
    if (this.tick >= this.HEAT_SLASH_ATTACK_FRAMES)
      this._changeState('heatSlashRecovery');
  }

  _spawnHeatSlashWall(rect) {
    if (!rect) return;
    if ((this._heatSlashWalls?.length || 0) >= this.MAX_HEAT_SLASH_WALLS) return;
    if (this._getActiveFireZoneCount() >= this.MAX_ACTIVE_FIRE_ZONES) return;
    this._heatSlashWalls.push({
      ...rect,
      tick: 0,
      lastTickBucket: -1,
    });
  }

  _updateHeatSlashWalls() {
    if (!this._heatSlashWalls || this._heatSlashWalls.length === 0) return;
    for (const wall of this._heatSlashWalls) {
      wall.tick++;
      const bucket = Math.floor((wall.tick - 1) / this.HEAT_SLASH_TICK_INTERVAL);
      if (bucket !== wall.lastTickBucket) {
        wall.lastTickBucket = bucket;
        this._checkRectHitPlayer(wall, this.HEAT_SLASH_DAMAGE);
      }
    }
    this._heatSlashWalls = this._heatSlashWalls.filter(wall => wall.tick <= this.HEAT_SLASH_ZONE_ACTIVE_FRAMES);
  }

  _handleHeatSlashRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.HEAT_SLASH_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _checkRectHitPlayer(rect, damage) {
    if (!this._player || !rect) return;
    const pr = eRect(this._player);
    if (pr.l < rect.x + rect.w && pr.r > rect.x && pr.t < rect.y + rect.h && pr.b > rect.y)
      this._dealDamageToPlayer(damage);
  }

  _getFlameLineTargetX() {
    if (!this._player) return this.x;
    const minX = TILE + this.FLAME_LINE_W / 2;
    const maxX = ROOM_W - TILE - this.FLAME_LINE_W / 2;
    const facing = Math.sign(this._player.facing || this._dirToPlayer()) || 1;
    const targetX = this._player.x + facing * this.FLAME_LINE_OFFSET_AHEAD;
    return clamp(targetX, minX, maxX);
  }

  _getFlameLineRect() {
    return {
      x: this._flameLineCenterX - this.FLAME_LINE_W / 2,
      y: FLOOR_Y - this.FLAME_LINE_H,
      w: this.FLAME_LINE_W,
      h: this.FLAME_LINE_H,
      cx: this._flameLineCenterX,
      cy: FLOOR_Y - this.FLAME_LINE_H / 2,
    };
  }

  _fireFlameShot() {
    const from = this._getBodyCenter();
    const baseAngle = Math.atan2(this._flameShotDir.y, this._flameShotDir.x);
    for (const offset of [0]) {
      const angle = baseAngle + offset;
      Projectiles.add(new EnemyProjectile(
        from.x,
        from.y,
        Math.cos(angle),
        Math.sin(angle),
        this.FLAME_SHOT_SPEED,
        this._getScaledBossDamage(this.FLAME_SHOT_DAMAGE),
        '#ff9850',
        this.FLAME_SHOT_RADIUS,
        'fire',
        { ignoreWalls: true }
      ));
    }
    this._flameShotCooldown = this.FLAME_SHOT_COOLDOWN_FRAMES;
    this._lastPattern = 'flameShot';
    this._markAttackUsed('flameShot');
  }

  _handleFlameShotTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.FLAME_SHOT_TELEGRAPH_FRAMES)
      this._changeState('flameShotFire');
  }

  _handleFlameShotFire() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._fireFlameShot();
    }
    if (this.tick >= this.FLAME_SHOT_FIRE_FRAMES)
      this._changeState('flameShotRecovery');
  }

  _handleFlameShotRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.FLAME_SHOT_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _handleFlameLineTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.FLAME_LINE_TELEGRAPH_FRAMES)
      this._changeState('flameLineAttack');
  }

  _handleFlameLineAttack() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._lastPattern = 'flameLine';
      this._flameLineCooldown = this.FLAME_LINE_COOLDOWN_FRAMES;
      this._markAttackUsed('flameLine');
    }
    if (this.tick === 1 || this.tick % this.FLAME_LINE_PULSE_INTERVAL === 0) {
      const rect = this._getFlameLineRect();
      this._checkHitbox(rect.cx - this.x, rect.w, rect.h, this.FLAME_LINE_DAMAGE);
      addVfx({
        type:'rect',
        x: rect.cx,
        y: rect.cy,
        w: rect.w,
        h: rect.h,
        rot:0,
        color:'#ff5a1f',
        dur:0.18,
        alpha:0.42,
        t:0,
      });
    }
    if (this.tick >= this.FLAME_LINE_ATTACK_FRAMES)
      this._changeState('flameLineRecovery');
  }

  _handleFlameLineRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.FLAME_LINE_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _onDie() {
    this._flamePillarSequence = null;
    this._flamePillars = [];
    this._heatSlashWalls = [];
  }

  draw(ctx) {
    super.draw(ctx);

    if (this.removeMe) return;

      if (this.state === 'overheatBarrageEnter' || this.state === 'overheatBarrageAttack' || this.state === 'overheatBarrageExit') {
        const center = this._getBodyCenter();
        const s = Camera.toScreen(center.x, center.y);
      const attackAlpha = this.state === 'overheatBarrageAttack' ? 0.2 : 0.1;
      ctx.save();
      ctx.fillStyle = `rgba(255, 110, 48, ${attackAlpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 210, 168, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 44, 0, Math.PI * 2);
      ctx.stroke();
      if (this.state === 'overheatBarrageAttack') {
        ctx.strokeStyle = 'rgba(255, 164, 108, 0.75)';
        ctx.beginPath();
        ctx.moveTo(s.x - 160, s.y);
        ctx.lineTo(s.x + 160, s.y);
        ctx.moveTo(s.x, s.y - 120);
        ctx.lineTo(s.x, s.y + 120);
        ctx.stroke();
        }
        ctx.restore();
      }

        if (this._flamePillars && this._flamePillars.length > 0) {
          for (const pillar of this._flamePillars) {
          const s = Camera.toScreen(pillar.x, pillar.y);
          const progress = clamp(pillar.tick / this.FLAME_PILLAR_TELEGRAPH_FRAMES, 0, 1);
          const active = pillar.tick >= this.FLAME_PILLAR_TELEGRAPH_FRAMES;
          ctx.save();
          ctx.fillStyle = active
            ? 'rgba(255, 74, 20, 0.34)'
            : `rgba(255, 150, 64, ${0.08 + progress * 0.14})`;
          ctx.strokeStyle = active
            ? 'rgba(255, 238, 190, 0.95)'
            : 'rgba(255, 194, 118, 0.9)';
          ctx.lineWidth = 2;
          ctx.fillRect(s.x - pillar.w / 2, s.y, pillar.w, pillar.h);
          if (!active) {
            ctx.fillStyle = `rgba(255, 224, 112, ${0.1 + progress * 0.2})`;
            ctx.fillRect(s.x - pillar.w / 2, s.y + pillar.h * (1 - progress), pillar.w, pillar.h * progress);
          } else {
            ctx.fillStyle = 'rgba(255, 206, 96, 0.18)';
            for (let i = 0; i < 4; i++) {
              const x = s.x - pillar.w * 0.34 + i * pillar.w * 0.23 + Math.sin(this.tick * 0.22 + i) * 7;
              ctx.beginPath();
              ctx.moveTo(x - 10, s.y + pillar.h);
              ctx.lineTo(x, s.y + pillar.h * 0.2);
              ctx.lineTo(x + 10, s.y + pillar.h);
              ctx.fill();
            }
          }
          ctx.strokeRect(s.x - pillar.w / 2, s.y, pillar.w, pillar.h);
          ctx.restore();
          }
        }

        if (this._heatSlashWalls && this._heatSlashWalls.length > 0) {
          for (const wall of this._heatSlashWalls) {
            const s = Camera.toScreen(wall.cx, wall.cy);
            const pulse = 0.65 + 0.35 * Math.sin((wall.tick || 0) * 0.42);
            ctx.save();
            ctx.fillStyle = `rgba(255, 82, 24, ${0.24 + 0.08 * pulse})`;
            ctx.strokeStyle = 'rgba(255, 232, 184, 0.9)';
            ctx.lineWidth = 2;
            ctx.fillRect(s.x - wall.w / 2, s.y - wall.h / 2, wall.w, wall.h);
            ctx.strokeRect(s.x - wall.w / 2, s.y - wall.h / 2, wall.w, wall.h);
            ctx.fillStyle = `rgba(255, 198, 92, ${0.12 + 0.08 * pulse})`;
            for (let i = 0; i < 6; i++) {
              const x = s.x - wall.w * 0.38 + i * wall.w * 0.15 + Math.sin((wall.tick || 0) * 0.25 + i) * 5;
              ctx.beginPath();
              ctx.moveTo(x - 9, s.y + wall.h / 2);
              ctx.lineTo(x, s.y - wall.h / 2 + 18);
              ctx.lineTo(x + 9, s.y + wall.h / 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }

        if (this.state === 'closeBurstTelegraph' || this.state === 'closeBurstAttack') {
      const center = this._getBodyCenter();
      const s = Camera.toScreen(center.x, center.y);
      const alpha = this.state === 'closeBurstAttack'
        ? 0.3
        : (0.1 + 0.16 * clamp(this.tick / this.CLOSE_BURST_TELEGRAPH_FRAMES, 0, 1));
      const progress = clamp(this.tick / this.CLOSE_BURST_TELEGRAPH_FRAMES, 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(255, 118, 42, ${alpha})`;
      ctx.strokeStyle = this.state === 'closeBurstAttack'
        ? 'rgba(255, 232, 190, 0.95)'
        : 'rgba(255, 198, 142, 0.88)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.CLOSE_BURST_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      if (this.state === 'closeBurstTelegraph') {
        ctx.fillStyle = `rgba(255, 226, 118, ${0.12 + progress * 0.22})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.CLOSE_BURST_RADIUS * progress, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 106, 32, ${0.2 + progress * 0.35})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          const a = i * Math.PI * 0.2 + this.tick * 0.04;
          const inner = this.CLOSE_BURST_RADIUS * (0.24 + progress * 0.42);
          const outer = this.CLOSE_BURST_RADIUS * (0.5 + progress * 0.45);
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(a) * inner, s.y + Math.sin(a) * inner);
          ctx.lineTo(s.x + Math.cos(a) * outer, s.y + Math.sin(a) * outer);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.CLOSE_BURST_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.state === 'heatSlashTelegraph' || this.state === 'heatSlashAttack') {
      const rect = this._getHeatSlashRect();
      const s = Camera.toScreen(rect.cx, rect.cy);
      const alpha = this.state === 'heatSlashAttack'
        ? 0.32
        : (0.12 + 0.16 * clamp(this.tick / this.HEAT_SLASH_TELEGRAPH_FRAMES, 0, 1));
      const progress = clamp(this.tick / this.HEAT_SLASH_TELEGRAPH_FRAMES, 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(255, 98, 36, ${alpha})`;
      ctx.strokeStyle = this.state === 'heatSlashAttack'
        ? 'rgba(255, 230, 180, 0.95)'
        : 'rgba(255, 180, 120, 0.9)';
      ctx.lineWidth = 2;
      ctx.fillRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
      if (this.state === 'heatSlashTelegraph') {
        ctx.fillStyle = `rgba(255, 224, 104, ${0.12 + progress * 0.22})`;
        ctx.fillRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w * progress, rect.h);
        ctx.fillStyle = `rgba(255, 94, 28, ${0.08 + progress * 0.14})`;
        const tongues = 7;
        for (let i = 0; i < tongues; i++) {
          const x = s.x - rect.w / 2 + (rect.w / tongues) * (i + 0.5);
          const h = rect.h * (0.18 + 0.12 * Math.sin(this.tick * 0.35 + i));
          ctx.beginPath();
          ctx.moveTo(x - 10, s.y + rect.h / 2);
          ctx.lineTo(x, s.y + rect.h / 2 - h);
          ctx.lineTo(x + 10, s.y + rect.h / 2);
          ctx.fill();
        }
      }
      ctx.strokeRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
      ctx.restore();
    }

    if (this.state === 'flameLineTelegraph' || this.state === 'flameLineAttack') {
      const rect = this._getFlameLineRect();
      const s = Camera.toScreen(rect.cx, rect.cy);
      const progress = clamp(this.tick / this.FLAME_LINE_TELEGRAPH_FRAMES, 0, 1);
      const alpha = this.state === 'flameLineAttack'
        ? 0.4
        : (0.1 + 0.18 * progress);
      const left = s.x - rect.w / 2;
      const top = s.y - rect.h / 2;
      const pulse = this.state === 'flameLineAttack'
        ? 0.65 + 0.35 * Math.sin(this.tick * 0.6)
        : 0.35 + 0.25 * Math.sin(this.tick * 0.35);
      ctx.save();
      ctx.fillStyle = this.state === 'flameLineAttack'
        ? `rgba(255, 72, 24, ${alpha})`
        : `rgba(255, 140, 72, ${alpha})`;
      ctx.strokeStyle = this.state === 'flameLineAttack'
        ? 'rgba(255, 214, 180, 0.95)'
        : 'rgba(255, 188, 138, 0.9)';
      ctx.lineWidth = 2;
      ctx.fillRect(left, top, rect.w, rect.h);
      ctx.strokeRect(left, top, rect.w, rect.h);
      if (this.state === 'flameLineTelegraph') {
        ctx.fillStyle = `rgba(255, 214, 168, ${0.08 + progress * 0.18})`;
        ctx.fillRect(left, s.y - 3, rect.w, 6);
        ctx.strokeStyle = `rgba(255, 244, 212, ${0.5 + progress * 0.35})`;
        ctx.strokeRect(left, top, rect.w, rect.h);
      } else {
        for (let i = 0; i < 6; i++) {
          const bandX = left + ((this.tick * 28 + i * 103) % (rect.w + 120)) - 60;
          const bandW = 46 + (i % 2) * 18;
          ctx.fillStyle = `rgba(255, ${110 + i * 12}, 48, ${0.1 + 0.08 * pulse})`;
          ctx.fillRect(bandX, top + 4, bandW, rect.h - 8);
        }
        ctx.fillStyle = `rgba(255, 228, 184, ${0.18 + 0.08 * pulse})`;
        ctx.fillRect(left, top + 4, rect.w, 8);
        ctx.fillRect(left, top + rect.h - 12, rect.w, 8);
        for (let i = 0; i < 16; i++) {
          const px = left + (i / 15) * rect.w;
          const tongueH = 6 + Math.sin(this.tick * 0.45 + i * 0.7) * 5;
          ctx.strokeStyle = `rgba(255, 196, 140, ${0.22 + 0.08 * pulse})`;
          ctx.beginPath();
          ctx.moveTo(px, top + 5);
          ctx.lineTo(px, top - tongueH);
          ctx.moveTo(px, top + rect.h - 5);
          ctx.lineTo(px, top + rect.h + tongueH);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (this.state === 'flameShotTelegraph' || this.state === 'flameShotFire') {
      const from = this._getBodyCenter();
      const toX = from.x + this._flameShotDir.x * 190;
      const toY = from.y + this._flameShotDir.y * 190;
      const a = this.state === 'flameShotFire' ? 0.9 : 0.55;
      const s1 = Camera.toScreen(from.x, from.y);
      const s2 = Camera.toScreen(toX, toY);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 186, 120, ${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 130, 72, ${Math.min(a + 0.1, 1)})`;
      ctx.beginPath();
      ctx.arc(s2.x, s2.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

class Boss3 extends Boss1 {
  constructor(x, y, callbacks = {}) {
    super(x, y, callbacks);
    this.displayName = 'Fleeing Youth';
    this.hp = 2100; this.maxHp = 2100;
    this.color = '#8b63d1'; this.baseColor = '#8b63d1';
    this._spriteKey = 'boss3';
    this.BOSS_DAMAGE_MULTIPLIER = 1.2;
    this.APPROACH_SPEED = 230;
    this.DASH_SPEED = 980;
    this.CD_FRAMES = 54;
    this.P2_SPEED_MUL = 1.35;

    this.SMOKE_CLOUD_TELEGRAPH_FRAMES = 36;
      this.SMOKE_CLOUD_ACTIVE_FRAMES = 300;
      this.SMOKE_CLOUD_RECOVERY_FRAMES = 14;
      this.SMOKE_CLOUD_COOLDOWN_FRAMES = 104;
    this.SMOKE_CLOUD_RADIUS = 185;
    this.SMOKE_CLOUD_TICK_INTERVAL = 20;
    this.SMOKE_CLOUD_TICK_DAMAGE = 8;
    this.SMOKE_CLOUD_TICK_SMOKE_GAIN = 3;

      this.CHOKING_RING_TELEGRAPH_FRAMES = 76;
      this.CHOKING_RING_ATTACK_FRAMES = 12;
      this.CHOKING_RING_RECOVERY_FRAMES = 16;
      this.CHOKING_RING_COOLDOWN_FRAMES = 92;
      this.CHOKING_RING_RADIUS = 280;
      this.CHOKING_RING_DAMAGE = 64;
    this.CHOKING_RING_SMOKE_GAIN = 7;
    this.CHOKING_RING_MIN_CAST_RANGE = 120;

      this.BLIND_SHOT_TELEGRAPH_FRAMES = 16;
    this.BLIND_SHOT_FIRE_FRAMES = 6;
    this.BLIND_SHOT_RECOVERY_FRAMES = 18;
      this.BLIND_SHOT_COOLDOWN_FRAMES = 64;
    this.BLIND_SHOT_TRIGGER_DISTANCE = 380;
    this.BLIND_SHOT_KEEP_DISTANCE = 330;
    this.BLIND_SHOT_MIN_CAST_RANGE = 180;
      this.BLIND_SHOT_BULLET_SPEED = 390;
        this.BLIND_SHOT_DAMAGE = 27;
      this.BLIND_SHOT_RADIUS = 7;
      this.BLIND_SHOT_COLOR = '#cfc6f2';
      this.BLIND_SHOT_VARIETY_WINDOW_FRAMES = 60;

      this.SMOKE_FLOOD_TRIGGER_RATIOS = [0.5, 0.25];
      this.SMOKE_FLOOD_ENTER_FRAMES = 38;
      this.SMOKE_FLOOD_ATTACK_FRAMES = 300;
      this.SMOKE_FLOOD_EXIT_FRAMES = 24;
      this.SMOKE_FLOOD_WAVE_INTERVAL = 24;
      this.SMOKE_FLOOD_CLOUD_ACTIVE_FRAMES = 168;
      this.SMOKE_FLOOD_TICK_INTERVAL = 20;
      this.SMOKE_FLOOD_TICK_DAMAGE = 7;
      this.SMOKE_FLOOD_TICK_SMOKE_GAIN = 2;
      this.SMOKE_FLOOD_RADIUS = 165;
      this.SMOKE_FLOOD_MOVE_SPEED = 155;

      this.SMOKE_MINE_TELEGRAPH_FRAMES = 32;
      this.SMOKE_MINE_ACTIVE_FRAMES = 210;
      this.SMOKE_MINE_RECOVERY_FRAMES = 14;
      this.SMOKE_MINE_COOLDOWN_FRAMES = 150;
      this.SMOKE_MINE_RADIUS = 92;
      this.SMOKE_MINE_TICK_INTERVAL = 18;
      this.SMOKE_MINE_TICK_DAMAGE = 4;
      this.SMOKE_MINE_TICK_SMOKE_GAIN = 4;

      this.SMOKE_WALL_TELEGRAPH_FRAMES = 34;
      this.SMOKE_WALL_ACTIVE_FRAMES = 150;
      this.SMOKE_WALL_RECOVERY_FRAMES = 14;
      this.SMOKE_WALL_COOLDOWN_FRAMES = 180;
      this.SMOKE_WALL_W = 96;
      this.SMOKE_WALL_H = 340;
      this.SMOKE_WALL_TICK_INTERVAL = 18;
      this.SMOKE_WALL_TICK_DAMAGE = 3;
      this.SMOKE_WALL_TICK_SMOKE_GAIN = 5;

      this.CHOKING_TRAP_TELEGRAPH_FRAMES = 76;
      this.CHOKING_TRAP_ATTACK_FRAMES = 12;
      this.CHOKING_TRAP_RECOVERY_FRAMES = 16;
      this.CHOKING_TRAP_COOLDOWN_FRAMES = 140;
      this.CHOKING_TRAP_RADIUS = 145;
      this.CHOKING_TRAP_DAMAGE = 46;
      this.CHOKING_TRAP_SMOKE_GAIN = 10;

      this.SMOKE_SWIPE_TELEGRAPH_FRAMES = 42;
      this.SMOKE_SWIPE_ATTACK_FRAMES = 10;
      this.SMOKE_SWIPE_RECOVERY_FRAMES = 16;
      this.SMOKE_SWIPE_COOLDOWN_FRAMES = 105;
      this.SMOKE_SWIPE_W = 190;
      this.SMOKE_SWIPE_H = 104;
      this.SMOKE_SWIPE_OFFSET = 112;
      this.SMOKE_SWIPE_DAMAGE = 52;
      this.SMOKE_SWIPE_SMOKE_GAIN = 8;

      this.SMOKE_HAZARD_TELEGRAPH_FRAMES = 28;
      this.SMOKE_HAZARD_ACTIVE_FRAMES = 170;
      this.SMOKE_HAZARD_RECOVERY_FRAMES = 10;
      this.SMOKE_HAZARD_COOLDOWN_FRAMES = 150;
      this.SMOKE_HAZARD_RADIUS = 120;
      this.SMOKE_HAZARD_TICK_INTERVAL = 18;
      this.SMOKE_HAZARD_TICK_DAMAGE = 7;
      this.SMOKE_HAZARD_TICK_SMOKE_GAIN = 3;
      this.BOSS3_AUX_MINE_COOLDOWN_FRAMES = 120;
      this.BOSS3_AUX_WALL_COOLDOWN_FRAMES = 170;
      this.BOSS3_AUX_BLIND_COOLDOWN_FRAMES = 132;
      this.BOSS3_AUX_HAZARD_COOLDOWN_FRAMES = 240;
      this.BOSS3_AUX_MAX_ZONES = 5;

    this.PLAYER_ZONE_STABLE_RANGE = 56;
    this.PLAYER_ZONE_STABLE_TRIGGER_FRAMES = 48;
      this.SMOKE_CLOUD_CAST_RANGE = 420;
      this.SMOKE_PRESSURE_GAP_FRAMES = 60;

      this._smokeCloudCooldown = 120;
      this._chokingRingCooldown = 110;
      this._blindShotCooldown = 50;
      this._smokeMineCooldown = 80;
      this._smokeWallCooldown = 120;
      this._chokingTrapCooldown = 90;
      this._smokeSwipeCooldown = 55;
      this._smokeHazardCooldown = 110;
      this._auxMineCooldown = 90;
      this._auxWallCooldown = 130;
      this._auxBlindCooldown = 110;
      this._auxHazardCooldown = 180;
      this._auxZones = [];
      this._smokePressureCooldown = 0;
      this._blindShotPriorityFrames = 0;
      this._smokeFloodTriggerIndex = 0;
      this._smokeFloodZones = [];
      this._smokeMineZones = [];
      this._smokeWallRect = null;
      this._chokingTrapCenter = { x, y: FLOOR_Y - 120 };
      this._smokeSwipeDir = 1;
      this._smokeHazardCenter = { x, y: y - this.height / 2, lastTickBucket: -1 };
    this._lastPattern = null;
    this._playerZoneAnchor = { x: x, y: y };
    this._playerZoneStableFrames = 0;
    this._smokeCloudCenter = { x, y: FLOOR_Y - this.SMOKE_CLOUD_RADIUS * 0.35 };
    this._ringCenter = { x, y: FLOOR_Y - this.CHOKING_RING_RADIUS * 0.25 };
    this._blindShotDir = { x: -1, y: 0 };
  }

  _processState(_dt) {
      this._updatePlayerZoneTracking();
      if (this._tryStartSmokeFlood()) return;
      if (this._smokeCloudCooldown > 0) this._smokeCloudCooldown--;
      if (this._chokingRingCooldown > 0) this._chokingRingCooldown--;
        if (this._blindShotCooldown > 0) this._blindShotCooldown--;
        if (this._smokeMineCooldown > 0) this._smokeMineCooldown--;
        if (this._smokeWallCooldown > 0) this._smokeWallCooldown--;
        if (this._chokingTrapCooldown > 0) this._chokingTrapCooldown--;
        if (this._smokeSwipeCooldown > 0) this._smokeSwipeCooldown--;
        if (this._smokeHazardCooldown > 0) this._smokeHazardCooldown--;
        if (this._smokePressureCooldown > 0) this._smokePressureCooldown--;
        if (this._blindShotPriorityFrames > 0) this._blindShotPriorityFrames--;
        const ctx = this._getCombatContext();
        this._refreshRangedIntent(
          ctx,
        this.BLIND_SHOT_TRIGGER_DISTANCE,
        this.BLIND_SHOT_KEEP_DISTANCE
      );
      this._updateAuxPatterns(ctx);

    switch (this.state) {
      case 'idle': break;
      case 'approach': this._handleBoss3Approach(); break;
      case 'smokeCloudTelegraph': this._handleSmokeCloudTelegraph(); break;
      case 'smokeCloudActive': this._handleSmokeCloudActive(); break;
      case 'smokeCloudRecovery': this._handleSmokeCloudRecovery(); break;
      case 'chokingRingTelegraph': this._handleChokingRingTelegraph(); break;
      case 'chokingRingAttack': this._handleChokingRingAttack(); break;
      case 'chokingRingRecovery': this._handleChokingRingRecovery(); break;
      case 'blindShotTelegraph': this._handleBlindShotTelegraph(); break;
      case 'blindShotFire': this._handleBlindShotFire(); break;
      case 'blindShotRecovery': this._handleBlindShotRecovery(); break;
      case 'smokeFloodEnter': this._handleSmokeFloodEnter(); break;
      case 'smokeFloodAttack': this._handleSmokeFloodAttack(); break;
      case 'smokeFloodExit': this._handleSmokeFloodExit(); break;
      case 'smokeMineTelegraph': this._handleSmokeMineTelegraph(); break;
      case 'smokeMineActive': this._handleSmokeMineActive(); break;
      case 'smokeMineRecovery': this._handleSmokeMineRecovery(); break;
      case 'smokeWallTelegraph': this._handleSmokeWallTelegraph(); break;
      case 'smokeWallActive': this._handleSmokeWallActive(); break;
      case 'smokeWallRecovery': this._handleSmokeWallRecovery(); break;
      case 'chokingTrapTelegraph': this._handleChokingTrapTelegraph(); break;
      case 'chokingTrapAttack': this._handleChokingTrapAttack(); break;
      case 'chokingTrapRecovery': this._handleChokingTrapRecovery(); break;
      case 'smokeSwipeTelegraph': this._handleSmokeSwipeTelegraph(); break;
      case 'smokeSwipeAttack': this._handleSmokeSwipeAttack(); break;
      case 'smokeSwipeRecovery': this._handleSmokeSwipeRecovery(); break;
      case 'smokeHazardTelegraph': this._handleSmokeHazardTelegraph(); break;
      case 'smokeHazardActive': this._handleSmokeHazardActive(); break;
      case 'smokeHazardRecovery': this._handleSmokeHazardRecovery(); break;
    }
  }

  _onStateEntered(s) {
    super._onStateEntered(s);
      if (s === 'smokeCloudTelegraph') {
        this._clearRangedIntent();
        this.vx = 0;
        this.vy = 0;
        this._hitApplied = false;
        this._smokeCloudCenter = this._getSmokeCloudCenter();
        return;
    }
    if (s === 'smokeCloudActive') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'smokeCloudRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
      if (s === 'chokingRingTelegraph') {
        this._clearRangedIntent();
        this.vx = 0;
        this.vy = 0;
        this._hitApplied = false;
        this._ringCenter = this._getChokingRingCenter();
        return;
    }
    if (s === 'chokingRingAttack') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      return;
    }
    if (s === 'chokingRingRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'blindShotTelegraph') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      this._blindShotDir = this._getBlindShotDirection();
      return;
    }
    if (s === 'blindShotFire') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      return;
    }
    if (s === 'blindShotRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
      if (s === 'smokeFloodEnter') {
        this._clearRangedIntent();
        this.vx = 0;
        this.vy = 0;
        this._smokeFloodZones = this._buildSmokeFloodZones();
        return;
      }
    if (s === 'smokeFloodAttack') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'smokeFloodExit') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'smokeMineTelegraph') {
      this._clearRangedIntent();
      this.vx = 0;
      this.vy = 0;
      this._smokeMineZones = this._buildSmokeMineZones();
      return;
    }
    if (s === 'smokeMineActive') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'smokeMineRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'smokeWallTelegraph') {
      this._clearRangedIntent();
      this.vx = 0;
      this.vy = 0;
      this._smokeWallRect = this._buildSmokeWallRect();
      return;
    }
    if (s === 'smokeWallActive') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'smokeWallRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'chokingTrapTelegraph') {
      this._clearRangedIntent();
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      this._chokingTrapCenter = this._getDelayedTrapCenter();
      return;
    }
    if (s === 'chokingTrapAttack') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      return;
    }
    if (s === 'chokingTrapRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'smokeSwipeTelegraph') {
      this._clearRangedIntent();
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      this._smokeSwipeDir = this._dirToPlayer();
      return;
    }
    if (s === 'smokeSwipeAttack') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      return;
    }
    if (s === 'smokeSwipeRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'smokeHazardTelegraph') {
      this._clearRangedIntent();
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      this._smokeHazardCenter = this._buildSmokeHazardCenter();
      return;
    }
    if (s === 'smokeHazardActive') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'smokeHazardRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
  }

  _tryStartSmokeFlood() {
    if (this._smokeFloodTriggerIndex >= this.SMOKE_FLOOD_TRIGGER_RATIOS.length) return false;
    if (this.state !== 'approach') return false;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    const triggerRatio = this.SMOKE_FLOOD_TRIGGER_RATIOS[this._smokeFloodTriggerIndex];
    if (ratio > triggerRatio) return false;
    this._smokeFloodTriggerIndex++;
    this._changeState('smokeFloodEnter');
    return true;
  }

  _updatePlayerZoneTracking() {
    if (!this._player) return;
    const px = this._player.x;
    const py = this._player.y;
    if (dist2(px, py, this._playerZoneAnchor.x, this._playerZoneAnchor.y) <= this.PLAYER_ZONE_STABLE_RANGE) {
      this._playerZoneStableFrames++;
      return;
    }
    this._playerZoneAnchor = { x: px, y: py };
    this._playerZoneStableFrames = 0;
  }

  _updateAuxPatterns(ctx) {
    if (!this._player || !ctx) return;
    this._auxMineCooldown = Math.max(this._auxMineCooldown - 1, 0);
    this._auxWallCooldown = Math.max(this._auxWallCooldown - 1, 0);
    this._auxBlindCooldown = Math.max(this._auxBlindCooldown - 1, 0);
    this._auxHazardCooldown = Math.max(this._auxHazardCooldown - 1, 0);
    this._updateAuxZones();
    if (this.state.startsWith('smokeFlood')) return;

    const activeZoneCount = this._auxZones.length;
    if (this._auxMineCooldown <= 0 &&
        activeZoneCount < this.BOSS3_AUX_MAX_ZONES &&
        this._playerZoneStableFrames >= Math.floor(this.PLAYER_ZONE_STABLE_TRIGGER_FRAMES * 0.45)) {
      this._spawnAuxMineZone();
      this._auxMineCooldown = this.BOSS3_AUX_MINE_COOLDOWN_FRAMES;
    }
    if (this._auxWallCooldown <= 0 &&
        this._auxZones.length < this.BOSS3_AUX_MAX_ZONES &&
        (ctx.distanceToPlayer >= this.BLIND_SHOT_KEEP_DISTANCE || ctx.playerAbove || this._rangedIntent)) {
      this._spawnAuxWallZone();
      this._auxWallCooldown = this.BOSS3_AUX_WALL_COOLDOWN_FRAMES;
    }
    if (this._auxBlindCooldown <= 0 &&
        !this.state.startsWith('blindShot') &&
        ctx.distanceToPlayer >= this.CHOKING_RING_MIN_CAST_RANGE * 1.25) {
      this._blindShotDir = this._getBlindShotDirection();
      this._fireBlindShot();
      this._auxBlindCooldown = this.BOSS3_AUX_BLIND_COOLDOWN_FRAMES;
    }
    if (this._auxHazardCooldown <= 0 &&
        this._auxZones.length < this.BOSS3_AUX_MAX_ZONES &&
        ctx.distanceToPlayer <= this.CHOKING_RING_RADIUS * 0.75) {
      this._spawnAuxHazardZone();
      this._auxHazardCooldown = this.BOSS3_AUX_HAZARD_COOLDOWN_FRAMES;
    }
  }

  _spawnAuxMineZone() {
    const zones = this._buildSmokeMineZones();
    if (zones.length <= 0) return;
    const zone = zones[0];
    this._auxZones.push({
      type: 'mine',
      x: zone.x,
      y: zone.y,
      r: this.SMOKE_MINE_RADIUS,
      tick: 0,
      telegraph: this.SMOKE_MINE_TELEGRAPH_FRAMES,
      active: this.SMOKE_MINE_ACTIVE_FRAMES,
      interval: this.SMOKE_MINE_TICK_INTERVAL,
      damage: this.SMOKE_MINE_TICK_DAMAGE,
      smokeGain: this.SMOKE_MINE_TICK_SMOKE_GAIN,
      lastTickBucket: -1,
    });
  }

  _spawnAuxWallZone() {
    const wr = this._buildSmokeWallRect();
    this._auxZones.push({
      type: 'wall',
      x: wr.x,
      y: wr.y,
      w: wr.w,
      h: wr.h,
      tick: 0,
      telegraph: this.SMOKE_WALL_TELEGRAPH_FRAMES,
      active: this.SMOKE_WALL_ACTIVE_FRAMES,
      interval: this.SMOKE_WALL_TICK_INTERVAL,
      damage: this.SMOKE_WALL_TICK_DAMAGE,
      smokeGain: this.SMOKE_WALL_TICK_SMOKE_GAIN,
      lastTickBucket: -1,
    });
  }

  _spawnAuxHazardZone() {
    const center = this._buildSmokeHazardCenter();
    this._auxZones.push({
      type: 'hazard',
      x: center.x,
      y: center.y,
      r: this.SMOKE_HAZARD_RADIUS,
      tick: 0,
      telegraph: this.SMOKE_HAZARD_TELEGRAPH_FRAMES,
      active: this.SMOKE_HAZARD_ACTIVE_FRAMES,
      interval: this.SMOKE_HAZARD_TICK_INTERVAL,
      damage: this.SMOKE_HAZARD_TICK_DAMAGE,
      smokeGain: this.SMOKE_HAZARD_TICK_SMOKE_GAIN,
      lastTickBucket: -1,
    });
  }

  _updateAuxZones() {
    for (const zone of this._auxZones) {
      zone.tick++;
      if (zone.tick < zone.telegraph) continue;
      const localTick = zone.tick - zone.telegraph;
      const bucket = Math.floor(localTick / zone.interval);
      if (bucket === zone.lastTickBucket) continue;
      zone.lastTickBucket = bucket;
      let inside = false;
      if (zone.type === 'wall') {
        const pr = eRect(this._player);
        inside = pr.l < zone.x + zone.w && pr.r > zone.x && pr.t < zone.y + zone.h && pr.b > zone.y;
      } else {
        inside = this._isPlayerInsideCircle(zone, zone.r);
      }
      if (!inside) continue;
      this._player.takeDamage(zone.damage);
      this._player.smokeSys?.addSmoke?.(zone.smokeGain);
    }
    this._auxZones = this._auxZones.filter(zone => zone.tick <= zone.telegraph + zone.active);
  }

  _handleBoss3Approach() {
    if (!this._player) {
      this.vx = 0;
      return;
    }

    const ctx = this._getCombatContext();
      this._refreshRangedIntent(
        ctx,
        this.BLIND_SHOT_TRIGGER_DISTANCE,
        this.BLIND_SHOT_KEEP_DISTANCE
      );
    const playerDist = ctx.distanceToPlayer;
      const cloudReady = this._smokeCloudCooldown <= 0;
      const ringReady = this._chokingRingCooldown <= 0;
      const blindReady = this._blindShotCooldown <= 0;
      const mineReady = this._smokeMineCooldown <= 0;
      const wallReady = this._smokeWallCooldown <= 0;
      const trapReady = this._chokingTrapCooldown <= 0;
      const swipeReady = this._smokeSwipeCooldown <= 0;
      const hazardReady = this._smokeHazardCooldown <= 0;
      const pressureReady = this._smokePressureCooldown <= 0;
      const closePressure = playerDist <= this.SMOKE_SWIPE_W * 1.05 && ctx.verticalDistanceAbs <= this.SMOKE_SWIPE_H * 0.9;
      const canCloud = cloudReady &&
        pressureReady &&
        playerDist <= this.SMOKE_CLOUD_CAST_RANGE &&
        this._playerZoneStableFrames >= this.PLAYER_ZONE_STABLE_TRIGGER_FRAMES;
      const canRing = ringReady &&
        pressureReady &&
        playerDist >= this.CHOKING_RING_MIN_CAST_RANGE;
      const blindDistanceOk = this._rangedIntent
        ? playerDist >= this.BLIND_SHOT_KEEP_DISTANCE
        : playerDist >= this.BLIND_SHOT_MIN_CAST_RANGE;
      const varietyBlindDistanceOk = this._blindShotPriorityFrames > 0 &&
        playerDist >= this.CHOKING_RING_MIN_CAST_RANGE * 0.8;
      const canBlind = blindReady && (blindDistanceOk || varietyBlindDistanceOk);
      const canMine = mineReady &&
        pressureReady &&
        playerDist <= this.SMOKE_CLOUD_CAST_RANGE + 80 &&
        this._playerZoneStableFrames >= Math.floor(this.PLAYER_ZONE_STABLE_TRIGGER_FRAMES * 0.55);
      const canWall = wallReady &&
        (this._rangedIntent || ctx.playerAbove || playerDist >= this.BLIND_SHOT_KEEP_DISTANCE);
      const canTrap = trapReady &&
        (playerDist <= this.CHOKING_RING_RADIUS * 0.95 ||
          this._playerZoneStableFrames >= Math.floor(this.PLAYER_ZONE_STABLE_TRIGGER_FRAMES * 0.7));
      const canSwipe = swipeReady && closePressure;
      const canHazard = hazardReady &&
        pressureReady &&
        playerDist <= this.CHOKING_RING_RADIUS * 0.72 &&
        this._lastPattern !== 'smokeHazard';
      const floodPhase = this._smokeFloodTriggerIndex > 0;
      const blindPreferred = canBlind &&
        (this._blindShotPriorityFrames > 0 ||
         this._lastPattern === 'smokeCloud' ||
         this._lastPattern === 'chokingRing' ||
         (floodPhase && !pressureReady));

      if (canSwipe && this._lastPattern !== 'smokeSwipe') {
        this._changeState('smokeSwipeTelegraph');
        return;
      }
      if (canHazard && (this._lastPattern === 'smokeSwipe' || this._lastPattern === 'chokingRing' || playerDist < 180)) {
        this._changeState('smokeHazardTelegraph');
        return;
      }
      if (canTrap && this._lastPattern !== 'chokingTrap') {
        this._changeState('chokingTrapTelegraph');
        return;
      }
      if (canMine && this._lastPattern !== 'smokeMine') {
        this._changeState('smokeMineTelegraph');
        return;
      }
      if (canWall && this._lastPattern !== 'smokeWall' && (!canRing || playerDist >= this.BLIND_SHOT_KEEP_DISTANCE)) {
        this._changeState('smokeWallTelegraph');
        return;
      }
      if (blindPreferred && (!pressureReady || !canCloud || !canRing)) {
        this._changeState('blindShotTelegraph');
        return;
      }
      if (canCloud && !blindPreferred && (!canRing || this._lastPattern === 'chokingRing')) {
        this._changeState('smokeCloudTelegraph');
        return;
      }
        if (this._rangedIntent && canBlind && !canCloud && !canRing) {
          this._changeState('blindShotTelegraph');
          return;
        }
      if (canBlind && canRing) {
        if (blindPreferred || this._lastPattern === 'chokingRing') {
          this._changeState('blindShotTelegraph');
          return;
        }
        this._changeState('chokingRingTelegraph');
        return;
      }
      if (canRing && !blindPreferred) {
        this._changeState('chokingRingTelegraph');
        return;
      }
    if (canBlind) {
      this._changeState('blindShotTelegraph');
      return;
    }
    if (canCloud) {
      this._changeState('smokeCloudTelegraph');
      return;
    }

    const desiredGap = 170;
    const dir = this._dirToPlayer();
    if (playerDist > desiredGap + 28) this.vx = dir * this.APPROACH_SPEED;
    else if (playerDist < desiredGap - 42 || ctx.playerAbove) this.vx = -dir * this.APPROACH_SPEED * 0.7;
    else this.vx = 0;
  }

  _getSmokeSwipeRect() {
    const center = this._getBodyCenter();
    const cx = this.x + this._smokeSwipeDir * this.SMOKE_SWIPE_OFFSET;
    const cy = center.y;
    return {
      x: cx - this.SMOKE_SWIPE_W / 2,
      y: cy - this.SMOKE_SWIPE_H / 2,
      w: this.SMOKE_SWIPE_W,
      h: this.SMOKE_SWIPE_H,
      cx,
      cy,
    };
  }

  _checkRectOverlapPlayer(rect) {
    if (!this._player || !rect) return false;
    const pr = eRect(this._player);
    return pr.l < rect.x + rect.w && pr.r > rect.x && pr.t < rect.y + rect.h && pr.b > rect.y;
  }

  _handleSmokeSwipeTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_SWIPE_TELEGRAPH_FRAMES)
      this._changeState('smokeSwipeAttack');
  }

  _handleSmokeSwipeAttack() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._lastPattern = 'smokeSwipe';
      this._smokeSwipeCooldown = this.SMOKE_SWIPE_COOLDOWN_FRAMES;
      this._markAttackUsed('smokeSwipe');
      const rect = this._getSmokeSwipeRect();
      if (this._checkRectOverlapPlayer(rect)) {
        this._dealDamageToPlayer(this.SMOKE_SWIPE_DAMAGE);
        this._player.smokeSys?.addSmoke?.(this.SMOKE_SWIPE_SMOKE_GAIN);
      }
      addVfx({
        type:'rect',
        x: rect.cx,
        y: rect.cy,
        w: rect.w,
        h: rect.h,
        rot: 0,
        color:'#c8b6ee',
        dur:0.16,
        alpha:0.32,
        t:0,
      });
    }
    if (this.tick >= this.SMOKE_SWIPE_ATTACK_FRAMES)
      this._changeState('smokeSwipeRecovery');
  }

  _handleSmokeSwipeRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_SWIPE_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _buildSmokeHazardCenter() {
    const center = this._getBodyCenter();
    return {
      x: clamp(center.x, TILE + this.SMOKE_HAZARD_RADIUS, ROOM_W - TILE - this.SMOKE_HAZARD_RADIUS),
      y: clamp(center.y, this.SMOKE_HAZARD_RADIUS, FLOOR_Y - this.SMOKE_HAZARD_RADIUS * 0.25),
      lastTickBucket: -1,
    };
  }

  _applySmokeHazardTick() {
    const center = this._smokeHazardCenter;
    if (!center) return;
    const bucket = Math.floor(this.tick / this.SMOKE_HAZARD_TICK_INTERVAL);
    if (bucket < 0 || bucket === center.lastTickBucket) return;
    center.lastTickBucket = bucket;
    if (!this._isPlayerInsideCircle(center, this.SMOKE_HAZARD_RADIUS)) return;
    this._player.takeDamage(this.SMOKE_HAZARD_TICK_DAMAGE);
    this._player.smokeSys?.addSmoke?.(this.SMOKE_HAZARD_TICK_SMOKE_GAIN);
  }

  _handleSmokeHazardTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_HAZARD_TELEGRAPH_FRAMES) {
      this._lastPattern = 'smokeHazard';
      this._smokeHazardCooldown = this.SMOKE_HAZARD_COOLDOWN_FRAMES;
      this._smokePressureCooldown = Math.max(this._smokePressureCooldown, Math.floor(this.SMOKE_PRESSURE_GAP_FRAMES * 0.6));
      this._markAttackUsed('smokeHazard');
      this._changeState('smokeHazardActive');
    }
  }

  _handleSmokeHazardActive() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick === 1 || this.tick % this.SMOKE_HAZARD_TICK_INTERVAL === 0)
      this._applySmokeHazardTick();
    if (this.tick >= this.SMOKE_HAZARD_ACTIVE_FRAMES)
      this._changeState('smokeHazardRecovery');
  }

  _handleSmokeHazardRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_HAZARD_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _buildSmokeMineZones() {
    if (!this._player) return [];
    const minX = TILE + this.SMOKE_MINE_RADIUS;
    const maxX = ROOM_W - TILE - this.SMOKE_MINE_RADIUS;
    const floorY = FLOOR_Y - this.SMOKE_MINE_RADIUS * 0.35;
    const dir = Math.sign(this._player.x - this.x) || 1;
    const anchors = [
      this._player.x,
      this._player.x + dir * 115,
    ];
    return anchors.map((x) => ({
      x: clamp(x, minX, maxX),
      y: floorY,
      lastTickBucket: -1,
    }));
  }

  _isPlayerInsideCircle(center, radius) {
    if (!this._player || !center) return false;
    const playerCenter = this._getPlayerCenter();
    return dist2(center.x, center.y, playerCenter.x, playerCenter.y) <= radius;
  }

  _applySmokeMineTicks() {
    for (const zone of this._smokeMineZones) {
      if (!zone) continue;
      const bucket = Math.floor(this.tick / this.SMOKE_MINE_TICK_INTERVAL);
      if (bucket < 0 || bucket === zone.lastTickBucket) continue;
      zone.lastTickBucket = bucket;
      if (!this._isPlayerInsideCircle(zone, this.SMOKE_MINE_RADIUS)) continue;
      this._player.takeDamage(this.SMOKE_MINE_TICK_DAMAGE);
      this._player.smokeSys?.addSmoke?.(this.SMOKE_MINE_TICK_SMOKE_GAIN);
    }
  }

  _handleSmokeMineTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_MINE_TELEGRAPH_FRAMES) {
      this._lastPattern = 'smokeMine';
      this._smokeMineCooldown = this.SMOKE_MINE_COOLDOWN_FRAMES;
      this._smokePressureCooldown = Math.max(this._smokePressureCooldown, Math.floor(this.SMOKE_PRESSURE_GAP_FRAMES * 0.75));
      this._markAttackUsed('smokeMine');
      this._changeState('smokeMineActive');
    }
  }

  _handleSmokeMineActive() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick === 1 || this.tick % this.SMOKE_MINE_TICK_INTERVAL === 0)
      this._applySmokeMineTicks();
    if (this.tick >= this.SMOKE_MINE_ACTIVE_FRAMES)
      this._changeState('smokeMineRecovery');
  }

  _handleSmokeMineRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_MINE_RECOVERY_FRAMES) {
      this._smokeMineZones = [];
      this._changeState('approach');
    }
  }

  _buildSmokeWallRect() {
    if (!this._player) {
      return {
        x: clamp(this.x, TILE + this.SMOKE_WALL_W, ROOM_W - TILE - this.SMOKE_WALL_W) - this.SMOKE_WALL_W / 2,
        y: FLOOR_Y - this.SMOKE_WALL_H,
        w: this.SMOKE_WALL_W,
        h: this.SMOKE_WALL_H,
        lastTickBucket: -1,
      };
    }
    const dir = Math.sign(this._player.x - this.x) || 1;
    const centerX = clamp(this._player.x - dir * 90, TILE + this.SMOKE_WALL_W / 2, ROOM_W - TILE - this.SMOKE_WALL_W / 2);
    return {
      x: centerX - this.SMOKE_WALL_W / 2,
      y: FLOOR_Y - this.SMOKE_WALL_H,
      w: this.SMOKE_WALL_W,
      h: this.SMOKE_WALL_H,
      lastTickBucket: -1,
    };
  }

  _isPlayerInsideSmokeWall() {
    if (!this._player || !this._smokeWallRect) return false;
    const pr = eRect(this._player);
    const wr = this._smokeWallRect;
    return pr.l < wr.x + wr.w && pr.r > wr.x && pr.t < wr.y + wr.h && pr.b > wr.y;
  }

  _applySmokeWallTick() {
    if (!this._smokeWallRect) return;
    const bucket = Math.floor(this.tick / this.SMOKE_WALL_TICK_INTERVAL);
    if (bucket < 0 || bucket === this._smokeWallRect.lastTickBucket) return;
    this._smokeWallRect.lastTickBucket = bucket;
    if (!this._isPlayerInsideSmokeWall()) return;
    this._player.takeDamage(this.SMOKE_WALL_TICK_DAMAGE);
    this._player.smokeSys?.addSmoke?.(this.SMOKE_WALL_TICK_SMOKE_GAIN);
  }

  _handleSmokeWallTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_WALL_TELEGRAPH_FRAMES) {
      this._lastPattern = 'smokeWall';
      this._smokeWallCooldown = this.SMOKE_WALL_COOLDOWN_FRAMES;
      this._markAttackUsed('smokeWall');
      this._changeState('smokeWallActive');
    }
  }

  _handleSmokeWallActive() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick === 1 || this.tick % this.SMOKE_WALL_TICK_INTERVAL === 0)
      this._applySmokeWallTick();
    if (this.tick >= this.SMOKE_WALL_ACTIVE_FRAMES)
      this._changeState('smokeWallRecovery');
  }

  _handleSmokeWallRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_WALL_RECOVERY_FRAMES) {
      this._smokeWallRect = null;
      this._changeState('approach');
    }
  }

  _getDelayedTrapCenter() {
    if (!this._player) return this._getBodyCenter();
    const minX = TILE + this.CHOKING_TRAP_RADIUS;
    const maxX = ROOM_W - TILE - this.CHOKING_TRAP_RADIUS;
    return {
      x: clamp(this._player.x, minX, maxX),
      y: clamp(this._player.y - this._player.height / 2, this.CHOKING_TRAP_RADIUS, FLOOR_Y - this.CHOKING_TRAP_RADIUS * 0.25),
    };
  }

  _checkChokingTrapHit() {
    if (!this._isPlayerInsideCircle(this._chokingTrapCenter, this.CHOKING_TRAP_RADIUS)) return;
    this._dealDamageToPlayer(this.CHOKING_TRAP_DAMAGE);
    this._player.smokeSys?.addSmoke?.(this.CHOKING_TRAP_SMOKE_GAIN);
  }

  _handleChokingTrapTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.CHOKING_TRAP_TELEGRAPH_FRAMES)
      this._changeState('chokingTrapAttack');
  }

  _handleChokingTrapAttack() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._lastPattern = 'chokingTrap';
      this._chokingTrapCooldown = this.CHOKING_TRAP_COOLDOWN_FRAMES;
      this._markAttackUsed('chokingTrap');
      this._checkChokingTrapHit();
      addVfx({
        type:'circle',
        x: this._chokingTrapCenter.x,
        y: this._chokingTrapCenter.y,
        r: this.CHOKING_TRAP_RADIUS,
        color:'#c8b6ee',
        dur:0.2,
        alpha:0.36,
        t:0,
      });
    }
    if (this.tick >= this.CHOKING_TRAP_ATTACK_FRAMES)
      this._changeState('chokingTrapRecovery');
  }

  _handleChokingTrapRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.CHOKING_TRAP_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _getSmokeCloudCenter() {
    if (!this._player) {
      return { x: this.x, y: FLOOR_Y - this.SMOKE_CLOUD_RADIUS * 0.35 };
    }
    const minX = TILE + this.SMOKE_CLOUD_RADIUS;
    const maxX = ROOM_W - TILE - this.SMOKE_CLOUD_RADIUS;
    return {
      x: clamp(this._playerZoneAnchor.x, minX, maxX),
      y: FLOOR_Y - this.SMOKE_CLOUD_RADIUS * 0.35,
    };
  }

  _isPlayerInsideSmokeCloud() {
    if (!this._player) return false;
    const center = this._smokeCloudCenter;
    const playerCenter = this._getPlayerCenter();
    return dist2(center.x, center.y, playerCenter.x, playerCenter.y) <= this.SMOKE_CLOUD_RADIUS;
  }

  _applySmokeCloudTick() {
    if (!this._isPlayerInsideSmokeCloud()) return;
    this._player.takeDamage(this.SMOKE_CLOUD_TICK_DAMAGE);
    this._player.smokeSys?.addSmoke?.(this.SMOKE_CLOUD_TICK_SMOKE_GAIN);
  }

  _handleSmokeCloudTelegraph() {
    this.vx = 0;
    this.vy = 0;
        if (this.tick >= this.SMOKE_CLOUD_TELEGRAPH_FRAMES) {
          this._lastPattern = 'smokeCloud';
          this._smokeCloudCooldown = this.SMOKE_CLOUD_COOLDOWN_FRAMES;
          this._smokePressureCooldown = this.SMOKE_PRESSURE_GAP_FRAMES;
          this._blindShotPriorityFrames = this.BLIND_SHOT_VARIETY_WINDOW_FRAMES;
          this._markAttackUsed('smokeCloud');
          this._changeState('smokeCloudActive');
        }
  }

  _handleSmokeCloudActive() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick === 1 || this.tick % this.SMOKE_CLOUD_TICK_INTERVAL === 0)
      this._applySmokeCloudTick();
    if (this.tick >= this.SMOKE_CLOUD_ACTIVE_FRAMES)
      this._changeState('smokeCloudRecovery');
  }

  _handleSmokeCloudRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_CLOUD_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _getChokingRingCenter() {
    if (!this._player) return this._getBodyCenter();
    const minX = TILE + this.CHOKING_RING_RADIUS;
    const maxX = ROOM_W - TILE - this.CHOKING_RING_RADIUS;
    return {
      x: clamp(this._player.x, minX, maxX),
      y: clamp(this._player.y - this._player.height / 2, this.CHOKING_RING_RADIUS, FLOOR_Y - this.CHOKING_RING_RADIUS * 0.25),
    };
  }

  _checkChokingRingHit() {
    if (!this._player) return;
    const playerCenter = this._getPlayerCenter();
    if (dist2(this._ringCenter.x, this._ringCenter.y, playerCenter.x, playerCenter.y) <= this.CHOKING_RING_RADIUS) {
      this._dealDamageToPlayer(this.CHOKING_RING_DAMAGE);
      this._player.smokeSys?.addSmoke?.(this.CHOKING_RING_SMOKE_GAIN);
    }
  }

  _handleChokingRingTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.CHOKING_RING_TELEGRAPH_FRAMES)
      this._changeState('chokingRingAttack');
  }

  _handleChokingRingAttack() {
    this.vx = 0;
    this.vy = 0;
      if (!this._hitApplied) {
        this._hitApplied = true;
        this._lastPattern = 'chokingRing';
        this._chokingRingCooldown = this.CHOKING_RING_COOLDOWN_FRAMES;
        this._smokePressureCooldown = this.SMOKE_PRESSURE_GAP_FRAMES;
        this._blindShotPriorityFrames = this.BLIND_SHOT_VARIETY_WINDOW_FRAMES;
        this._markAttackUsed('chokingRing');
        this._checkChokingRingHit();
        addVfx({
        type:'circle',
        x: this._ringCenter.x,
        y: this._ringCenter.y,
        r: this.CHOKING_RING_RADIUS,
        color:'#d6d0e8',
        dur:0.2,
        alpha:0.32,
        t:0,
      });
    }
    if (this.tick >= this.CHOKING_RING_ATTACK_FRAMES)
      this._changeState('chokingRingRecovery');
  }

  _handleChokingRingRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.CHOKING_RING_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _getBlindShotDirection() {
    if (!this._player) return { x: -1, y: 0 };
    const from = this._getBodyCenter();
    const to = this._getPlayerCenter();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  _fireBlindShot() {
    const from = this._getBodyCenter();
    const baseAngle = Math.atan2(this._blindShotDir.y, this._blindShotDir.x);
    for (const offset of [-0.16, 0, 0.16]) {
      const angle = baseAngle + offset;
      Projectiles.add(new EnemyProjectile(
        from.x,
        from.y,
        Math.cos(angle),
        Math.sin(angle),
        this.BLIND_SHOT_BULLET_SPEED,
        this._getScaledBossDamage(this.BLIND_SHOT_DAMAGE),
        this.BLIND_SHOT_COLOR,
        this.BLIND_SHOT_RADIUS,
        null,
        { ignoreWalls: true }
      ));
    }
  }

  _handleBlindShotTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.BLIND_SHOT_TELEGRAPH_FRAMES)
      this._changeState('blindShotFire');
  }

  _handleBlindShotFire() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._lastPattern = 'blindShot';
      this._blindShotCooldown = this.BLIND_SHOT_COOLDOWN_FRAMES;
      this._markAttackUsed('blindShot');
      this._fireBlindShot();
      const from = this._getBodyCenter();
      addVfx({
        type:'circle',
        x: from.x,
        y: from.y,
        r: 12,
        color:this.BLIND_SHOT_COLOR,
        dur:0.16,
        alpha:0.34,
        t:0,
      });
    }
    if (this.tick >= this.BLIND_SHOT_FIRE_FRAMES)
      this._changeState('blindShotRecovery');
  }

  _handleBlindShotRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.BLIND_SHOT_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _buildSmokeFloodZones() {
    const minX = TILE + this.SMOKE_FLOOD_RADIUS;
    const maxX = ROOM_W - TILE - this.SMOKE_FLOOD_RADIUS;
    const y = FLOOR_Y - this.SMOKE_FLOOD_RADIUS * 0.35;
    const laneXs = [
      ROOM_W * 0.18,
      ROOM_W * 0.4,
      ROOM_W * 0.62,
      ROOM_W * 0.84,
    ].map((x) => clamp(x, minX, maxX));
    const waveOffsets = [
      0,
      this.SMOKE_FLOOD_WAVE_INTERVAL,
      this.SMOKE_FLOOD_WAVE_INTERVAL * 2,
      this.SMOKE_FLOOD_WAVE_INTERVAL * 3,
      this.SMOKE_FLOOD_WAVE_INTERVAL * 4,
    ];
    const patterns = [
      [0, 2],
      [1, 3],
      [0, 1, 3],
      [0, 2, 3],
      [1, 2],
    ];
    const zones = [];
    for (let i = 0; i < waveOffsets.length; i++) {
      const telegraphStart = waveOffsets[i];
      const activeStart = telegraphStart + this.SMOKE_FLOOD_WAVE_INTERVAL;
      const indexes = patterns[i] || [1];
      for (const laneIndex of indexes) {
        zones.push({
          x: laneXs[laneIndex],
          y,
          telegraphStart,
          activeStart,
          activeEnd: activeStart + this.SMOKE_FLOOD_CLOUD_ACTIVE_FRAMES,
          lastTickBucket: -1,
        });
      }
    }
    return zones;
  }

  _isPlayerInsideSmokeFloodZone(zone) {
    if (!this._player || !zone) return false;
    const playerCenter = this._getPlayerCenter();
    return dist2(zone.x, zone.y, playerCenter.x, playerCenter.y) <= this.SMOKE_FLOOD_RADIUS;
  }

  _applySmokeFloodTicks() {
    const attackTick = this.tick;
    for (const zone of this._smokeFloodZones) {
      if (!zone) continue;
      if (attackTick < zone.activeStart || attackTick >= zone.activeEnd) continue;
      const localTick = attackTick - zone.activeStart;
      const bucket = Math.floor(localTick / this.SMOKE_FLOOD_TICK_INTERVAL);
      if (bucket < 0 || bucket === zone.lastTickBucket) continue;
      zone.lastTickBucket = bucket;
      if (!this._isPlayerInsideSmokeFloodZone(zone)) continue;
      this._player.takeDamage(this.SMOKE_FLOOD_TICK_DAMAGE);
      this._player.smokeSys?.addSmoke?.(this.SMOKE_FLOOD_TICK_SMOKE_GAIN);
    }
  }

  _handleSmokeFloodEnter() {
    this.vy = 0;
    this.vx = this._dirToPlayer() * this.SMOKE_FLOOD_MOVE_SPEED * 0.2;
    if (this.tick >= this.SMOKE_FLOOD_ENTER_FRAMES) {
      this.vx = 0;
      this._changeState('smokeFloodAttack');
    }
  }

  _handleSmokeFloodAttack() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick === this.SMOKE_FLOOD_WAVE_INTERVAL && this._blindShotCooldown <= 0) {
      this._blindShotDir = this._getBlindShotDirection();
      this._fireBlindShot();
      this._blindShotCooldown = this.BLIND_SHOT_COOLDOWN_FRAMES;
    }
    this._applySmokeFloodTicks();
    if (this.tick >= this.SMOKE_FLOOD_ATTACK_FRAMES)
      this._changeState('smokeFloodExit');
  }

  _handleSmokeFloodExit() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_FLOOD_EXIT_FRAMES) {
        this._smokeFloodZones = [];
        this._smokePressureCooldown = Math.max(this._smokePressureCooldown, this.SMOKE_PRESSURE_GAP_FRAMES);
        this._blindShotPriorityFrames = Math.max(this._blindShotPriorityFrames, this.BLIND_SHOT_VARIETY_WINDOW_FRAMES + 30);
        this._chokingRingCooldown = Math.max(this._chokingRingCooldown - 24, 0);
        this._lastPattern = 'smokeFlood';
        this._changeState('approach');
      }
    }

  draw(ctx) {
    super.draw(ctx);

    if (this.removeMe) return;

    if (this.state === 'smokeCloudTelegraph' || this.state === 'smokeCloudActive') {
      const center = this._smokeCloudCenter;
      const s = Camera.toScreen(center.x, center.y);
      const alpha = this.state === 'smokeCloudActive'
        ? 0.22
        : (0.08 + 0.14 * clamp(this.tick / this.SMOKE_CLOUD_TELEGRAPH_FRAMES, 0, 1));
      const sprite = BossSpriteAssets.smokeCloud;
      const phase = this.tick * 0.08;
      if (sprite && sprite.loaded && !sprite.failed) {
        const size = this.SMOKE_CLOUD_RADIUS * 2;
        ctx.save();
        ctx.globalAlpha = alpha + 0.18;
        ctx.drawImage(sprite.img, s.x - size / 2, s.y - size / 2, size, size);
        ctx.restore();
      } else {
      ctx.save();
      ctx.fillStyle = this.state === 'smokeCloudActive'
        ? `rgba(128, 108, 148, ${alpha})`
        : `rgba(176, 156, 198, ${alpha})`;
      ctx.strokeStyle = this.state === 'smokeCloudActive'
        ? 'rgba(220, 210, 240, 0.7)'
        : 'rgba(208, 196, 228, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.SMOKE_CLOUD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.SMOKE_CLOUD_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const orbit = phase + i * 1.24;
        const ox = Math.cos(orbit) * this.SMOKE_CLOUD_RADIUS * (0.22 + i * 0.07);
        const oy = Math.sin(orbit * 1.4) * this.SMOKE_CLOUD_RADIUS * 0.14;
        const r = this.SMOKE_CLOUD_RADIUS * (0.32 + i * 0.08);
        ctx.fillStyle = this.state === 'smokeCloudActive'
          ? `rgba(172, 154, 196, ${0.06 + i * 0.015})`
          : `rgba(196, 182, 216, ${0.04 + i * 0.012})`;
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(232, 224, 244, ${this.state === 'smokeCloudActive' ? 0.28 : 0.18})`;
      for (let i = 0; i < 3; i++) {
        const swirlR = this.SMOKE_CLOUD_RADIUS * (0.42 + i * 0.18);
        ctx.lineWidth = 1.5 + i * 0.5;
        ctx.beginPath();
        ctx.arc(
          s.x + Math.cos(phase + i) * 8,
          s.y + Math.sin(phase * 0.8 + i) * 6,
          swirlR,
          phase + i * 0.7,
          phase + i * 0.7 + Math.PI * 1.2
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.state === 'chokingRingTelegraph' || this.state === 'chokingRingAttack') {
      const s = Camera.toScreen(this._ringCenter.x, this._ringCenter.y);
      const progress = clamp(this.tick / this.CHOKING_RING_TELEGRAPH_FRAMES, 0, 1);
      const ringR = this.state === 'chokingRingAttack'
        ? this.CHOKING_RING_RADIUS * 0.92
        : this.CHOKING_RING_RADIUS * (1.2 - 0.2 * progress);
      const pulse = this.state === 'chokingRingAttack'
        ? 0.75 + 0.25 * Math.sin(this.tick * 0.8)
        : 0.35 + progress * 0.4;
      ctx.save();
      ctx.strokeStyle = this.state === 'chokingRingAttack'
        ? 'rgba(244, 236, 255, 0.95)'
        : 'rgba(210, 196, 236, 0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = this.state === 'chokingRingAttack'
        ? 'rgba(198, 186, 226, 0.18)'
        : 'rgba(148, 128, 176, 0.08)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 246, 255, ${0.28 + 0.18 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, ringR * (this.state === 'chokingRingAttack' ? 1.03 : 1.08), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(214, 202, 236, ${0.22 + 0.12 * pulse})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, ringR * 0.74, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.state === 'blindShotTelegraph' || this.state === 'blindShotFire') {
      const from = this._getBodyCenter();
      const toX = from.x + this._blindShotDir.x * 170;
      const toY = from.y + this._blindShotDir.y * 170;
      const a = this.state === 'blindShotFire' ? 0.9 : 0.55;
      const s1 = Camera.toScreen(from.x, from.y);
      const s2 = Camera.toScreen(toX, toY);
      ctx.save();
      ctx.strokeStyle = `rgba(220, 212, 255, ${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(220, 212, 255, ${Math.min(a + 0.1, 1)})`;
      ctx.beginPath();
      ctx.arc(s2.x, s2.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this._auxZones && this._auxZones.length > 0) {
      for (const zone of this._auxZones) {
        const progress = clamp(zone.tick / zone.telegraph, 0, 1);
        const active = zone.tick >= zone.telegraph;
        ctx.save();
        if (zone.type === 'wall') {
          const s = Camera.toScreen(zone.x, zone.y);
          ctx.fillStyle = active ? 'rgba(118, 96, 144, 0.18)' : `rgba(178, 158, 208, ${0.08 + progress * 0.1})`;
          ctx.strokeStyle = active ? 'rgba(226, 214, 246, 0.58)' : 'rgba(218, 204, 244, 0.82)';
          ctx.lineWidth = 2;
          ctx.fillRect(s.x, s.y, zone.w, zone.h);
          ctx.strokeRect(s.x, s.y, zone.w, zone.h);
        } else {
          const s = Camera.toScreen(zone.x, zone.y);
          const r = active ? zone.r : zone.r * progress;
          ctx.fillStyle = active ? 'rgba(126, 104, 150, 0.16)' : `rgba(190, 174, 220, ${0.08 + progress * 0.1})`;
          ctx.strokeStyle = active ? 'rgba(226, 214, 248, 0.58)' : 'rgba(218, 204, 244, 0.86)';
          ctx.lineWidth = 2;
          ctx.setLineDash(active ? [] : [8, 7]);
          ctx.beginPath();
          ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    }

    if (this.state === 'smokeSwipeTelegraph' || this.state === 'smokeSwipeAttack') {
      const rect = this._getSmokeSwipeRect();
      const s = Camera.toScreen(rect.cx, rect.cy);
      const progress = this.state === 'smokeSwipeTelegraph'
        ? clamp(this.tick / this.SMOKE_SWIPE_TELEGRAPH_FRAMES, 0, 1)
        : 1;
      ctx.save();
      ctx.fillStyle = this.state === 'smokeSwipeAttack'
        ? 'rgba(190, 174, 220, 0.26)'
        : `rgba(156, 132, 190, ${0.08 + progress * 0.12})`;
      ctx.strokeStyle = this.state === 'smokeSwipeAttack'
        ? 'rgba(248, 242, 255, 0.92)'
        : 'rgba(224, 210, 250, 0.9)';
      ctx.lineWidth = 2;
      ctx.fillRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
      if (this.state === 'smokeSwipeTelegraph') {
        ctx.fillStyle = `rgba(230, 220, 250, ${0.08 + progress * 0.18})`;
        ctx.fillRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w * progress, rect.h);
      }
      ctx.strokeRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
      ctx.restore();
    }

    if ((this.state === 'smokeHazardTelegraph' || this.state === 'smokeHazardActive') && this._smokeHazardCenter) {
      const center = this._smokeHazardCenter;
      const s = Camera.toScreen(center.x, center.y);
      const progress = this.state === 'smokeHazardTelegraph'
        ? clamp(this.tick / this.SMOKE_HAZARD_TELEGRAPH_FRAMES, 0, 1)
        : 1;
      ctx.save();
      ctx.fillStyle = this.state === 'smokeHazardActive'
        ? 'rgba(122, 102, 146, 0.2)'
        : `rgba(178, 158, 208, ${0.08 + progress * 0.1})`;
      ctx.strokeStyle = this.state === 'smokeHazardActive'
        ? 'rgba(226, 214, 246, 0.68)'
        : 'rgba(218, 204, 244, 0.88)';
      ctx.lineWidth = 2;
      ctx.setLineDash(this.state === 'smokeHazardTelegraph' ? [9, 7] : []);
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.SMOKE_HAZARD_RADIUS * progress, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.state === 'smokeHazardActive') {
        ctx.strokeStyle = 'rgba(238, 232, 250, 0.22)';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(
            s.x + Math.sin(this.tick * 0.08 + i) * 5,
            s.y + Math.cos(this.tick * 0.07 + i) * 4,
            this.SMOKE_HAZARD_RADIUS * (0.42 + i * 0.18),
            this.tick * 0.03 + i,
            this.tick * 0.03 + i + Math.PI * 1.2
          );
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if ((this.state === 'smokeMineTelegraph' || this.state === 'smokeMineActive') && this._smokeMineZones.length > 0) {
      const progress = this.state === 'smokeMineTelegraph'
        ? clamp(this.tick / this.SMOKE_MINE_TELEGRAPH_FRAMES, 0, 1)
        : 1;
      for (const zone of this._smokeMineZones) {
        const s = Camera.toScreen(zone.x, zone.y);
        const r = this.state === 'smokeMineTelegraph'
          ? this.SMOKE_MINE_RADIUS * (0.45 + progress * 0.55)
          : this.SMOKE_MINE_RADIUS;
        ctx.save();
        ctx.fillStyle = this.state === 'smokeMineActive'
          ? 'rgba(126, 104, 150, 0.2)'
          : `rgba(190, 174, 220, ${0.08 + progress * 0.12})`;
        ctx.strokeStyle = this.state === 'smokeMineActive'
          ? 'rgba(226, 214, 248, 0.66)'
          : 'rgba(218, 204, 244, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash(this.state === 'smokeMineTelegraph' ? [8, 8] : []);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(238, 232, 250, ${this.state === 'smokeMineActive' ? 0.26 : 0.18})`;
        ctx.beginPath();
        ctx.arc(s.x + Math.sin(this.tick * 0.08) * 5, s.y, this.SMOKE_MINE_RADIUS * 0.58, this.tick * 0.04, this.tick * 0.04 + Math.PI * 1.35);
        ctx.stroke();
        ctx.restore();
      }
    }

    if ((this.state === 'smokeWallTelegraph' || this.state === 'smokeWallActive') && this._smokeWallRect) {
      const wr = this._smokeWallRect;
      const s = Camera.toScreen(wr.x, wr.y);
      const progress = this.state === 'smokeWallTelegraph'
        ? clamp(this.tick / this.SMOKE_WALL_TELEGRAPH_FRAMES, 0, 1)
        : 1;
      const fillH = wr.h * progress;
      ctx.save();
      ctx.fillStyle = this.state === 'smokeWallActive'
        ? 'rgba(118, 96, 144, 0.22)'
        : 'rgba(178, 158, 208, 0.11)';
      ctx.strokeStyle = this.state === 'smokeWallActive'
        ? 'rgba(226, 214, 246, 0.72)'
        : 'rgba(218, 204, 244, 0.88)';
      ctx.lineWidth = 2;
      ctx.fillRect(s.x, s.y, wr.w, wr.h);
      ctx.strokeRect(s.x, s.y, wr.w, wr.h);
      if (this.state === 'smokeWallTelegraph') {
        ctx.fillStyle = `rgba(214, 202, 242, ${0.08 + progress * 0.16})`;
        ctx.fillRect(s.x, s.y + wr.h - fillH, wr.w, fillH);
      } else {
        ctx.strokeStyle = 'rgba(238, 232, 250, 0.22)';
        for (let i = 0; i < 4; i++) {
          const x = s.x + wr.w * (0.2 + i * 0.2) + Math.sin(this.tick * 0.08 + i) * 8;
          ctx.beginPath();
          ctx.moveTo(x, s.y + 12);
          ctx.lineTo(x + Math.sin(this.tick * 0.06 + i) * 12, s.y + wr.h - 12);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (this.state === 'chokingTrapTelegraph' || this.state === 'chokingTrapAttack') {
      const s = Camera.toScreen(this._chokingTrapCenter.x, this._chokingTrapCenter.y);
      const progress = this.state === 'chokingTrapTelegraph'
        ? clamp(this.tick / this.CHOKING_TRAP_TELEGRAPH_FRAMES, 0, 1)
        : 1;
      const r = this.state === 'chokingTrapAttack'
        ? this.CHOKING_TRAP_RADIUS
        : this.CHOKING_TRAP_RADIUS * (1.25 - progress * 0.25);
      ctx.save();
      ctx.fillStyle = this.state === 'chokingTrapAttack'
        ? 'rgba(198, 184, 228, 0.2)'
        : `rgba(156, 132, 190, ${0.08 + progress * 0.12})`;
      ctx.strokeStyle = this.state === 'chokingTrapAttack'
        ? 'rgba(246, 240, 255, 0.92)'
        : 'rgba(224, 210, 250, 0.92)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = `rgba(246, 240, 255, ${0.24 + progress * 0.22})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.CHOKING_TRAP_RADIUS * 0.68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.state === 'smokeFloodEnter' || this.state === 'smokeFloodAttack') {
      const attackTick = this.state === 'smokeFloodEnter' ? 0 : this.tick;
      for (const zone of this._smokeFloodZones) {
        if (!zone) continue;
        const s = Camera.toScreen(zone.x, zone.y);
        const isActive = attackTick >= zone.activeStart && attackTick < zone.activeEnd;
        const isTelegraph = this.state === 'smokeFloodEnter' ||
          (attackTick < zone.activeStart &&
          attackTick >= zone.telegraphStart &&
          attackTick < zone.activeStart);
        if (!isActive && !isTelegraph) continue;
        const sprite = BossSpriteAssets.smokeCloud;
        if (sprite && sprite.loaded && !sprite.failed) {
          ctx.save();
          ctx.globalAlpha = isActive ? 0.24 : 0.14;
          ctx.drawImage(
            sprite.img,
            s.x - this.SMOKE_FLOOD_RADIUS,
            s.y - this.SMOKE_FLOOD_RADIUS,
            this.SMOKE_FLOOD_RADIUS * 2,
            this.SMOKE_FLOOD_RADIUS * 2
          );
          ctx.restore();
          continue;
        }
        ctx.save();
        ctx.fillStyle = isActive
          ? 'rgba(122, 102, 146, 0.22)'
          : 'rgba(182, 164, 206, 0.12)';
        ctx.strokeStyle = isActive
          ? 'rgba(222, 212, 242, 0.68)'
          : 'rgba(214, 202, 236, 0.88)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.SMOKE_FLOOD_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.SMOKE_FLOOD_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

class Boss4 extends Boss1 {
  constructor(x, y, callbacks = {}) {
    super(x, y, callbacks);
    this.displayName = 'Broken Firefighter';
    this.hp = 1150; this.maxHp = 1150;
    this.hw = 20; this.height = 64;
    this.color = '#8e6f56'; this.baseColor = '#8e6f56';
    this.APPROACH_SPEED = 170;
    this.DASH_SPEED = 760;
    this.MELEE_DMG = 80;
    this.CD_FRAMES = 46;
  }
}

class Boss5 extends Boss1 {
  constructor(x, y, callbacks = {}) {
    super(x, y, callbacks);
    this.displayName = 'Stalled Will';
    this.hp = 1350; this.maxHp = 1350;
    this.color = '#464646'; this.baseColor = '#464646';
    this.APPROACH_SPEED = 210;
    this.DASH_SPEED = 920;
    this.MELEE_DMG = 90;
    this.P2_SPEED_MUL = 1.2;
  }
}

class BossFinal extends Boss {
  constructor(x, y, callbacks = {}) {
    super(x, y, callbacks);
    this.displayName = 'Lee Han-gyeol';
    this.hp = 2000; this.maxHp = 2000;
    this.hw = 20; this.height = 64;
    this.color = '#d04010'; this.baseColor = '#d04010';
    this._spriteKey = 'finalBoss';

    this.PHASE2_HP = 0.66;
    this.PHASE3_HP = 0.33;
    this._phase = 1;  // 1 / 2 / 3

    this.APPROACH_SPEED = 200;
    this._combatFloorY = y;

    this.P1_DASH_SPEED  = 700;
    this.P1_COMBO_DMG   = 45;
    this.P1_COMBO_W = 52; this.P1_COMBO_H = 48;
    this.P1_COMBO_HITS  = 3;
      this.P1_HIT_INTERVAL = 8;
      this.P1_RANGE       = 160;
      this.P1_COOLDOWN    = 68;

      this.P2_AXE_COUNT   = 4;
      this.P2_AXE_INTERVAL = 14;
    this.P2_AXE_SPEED   = 500;
    this.P2_AXE_DMG     = 70;
    this.P2_PROJ_DMG    = 65;
      this.P2_PROJ_SPEED  = 420;
      this.P2_RANGE       = 360;
      this.P2_COOLDOWN    = 76;

      this.P3_BURST_DMG    = 135;
    this.P3_BURST_RADIUS = 150;
    this.P3_BURST_JUMP   = -550;
      this.P3_COOLDOWN     = 44;

    this.FINAL_BARRAGE_ENTER_FRAMES = 36;
    this.FINAL_BARRAGE_ATTACK_FRAMES = 210;
    this.FINAL_BARRAGE_EXIT_FRAMES = 36;
    this.FINAL_BARRAGE_AIMED_INTERVAL = 32;
    this.FINAL_BARRAGE_FIXED_INTERVAL = 28;
    this.FINAL_BARRAGE_TARGET_X = ROOM_W * 0.5;
    this.FINAL_BARRAGE_TARGET_Y = 180;
    this.FINAL_BARRAGE_THRESHOLDS = [0.8, 0.6, 0.4, 0.2];
      this.FINAL_BARRAGE_BASE_SPEED = 320;
      this.FINAL_BARRAGE_SPEED_STEP = 18;
      this.FINAL_BARRAGE_BASE_DAMAGE = 22;
      this.FINAL_BARRAGE_DAMAGE_STEP = 3;
    this.HARASS_TELEGRAPH_FRAMES = 16;
    this.HARASS_FIRE_FRAMES = 6;
    this.HARASS_RECOVERY_FRAMES = 12;
      this.HARASS_COOLDOWN = 72;
    this.HARASS_TRIGGER_DISTANCE = 440;
    this.HARASS_KEEP_DISTANCE = 390;
      this.HARASS_SPEED = 360;
      this.HARASS_DAMAGE = 22;
      this.HARASS_RADIUS = 6;

    this._pattern     = 'combo';  // 'combo','axe','volley','burst'
    this._hitCount    = 0;
    this._nextHitT    = 0;
    this._axeCount    = 0;
    this._nextAxeT    = 0;
    this._volleyFired = false;
    this._burstDone   = false;
    this._dashDone    = false;
    this._pendingFinalBarrages = [];
      this._activeFinalBarrageThreshold = null;
      this._barrageEnterFromX = x;
      this._barrageEnterFromY = y;
      this._barrageRecoverX = x;
      this._barrageRecoverY = y;
      this._harassCooldown = 0;
      this._harassDir = { x: -1, y: 0 };

    this._initHpThresholds(this.FINAL_BARRAGE_THRESHOLDS);
  }

  takeDamage(amount, sourceType = 'field', sourceAttacker = null) {
    if (this.isDead) return 0;
    const wasBarrage = this._isFinalBarrageState();

    this._hitFlash = 8;
    this.hp = Math.max(this.hp - amount, 0);
    spawnDmgNum(this.x, this.y - this.height - 16, amount, '#f88');
    sourceAttacker?.onDealDamage?.(amount, sourceType);

    if (this.hp <= 0) {
      this._die();
      return amount;
    }

    const crossed = this._pollHpThresholds();
    if (crossed.length > 0) this._pendingFinalBarrages.push(...crossed);

    if (wasBarrage) return amount;
    if (sourceType === 'melee' || sourceType === 'melee_unarmed') return amount;
    if (this._isInterruptImmuneState()) return amount;

    if (this._pendingFinalBarrages.length > 0) {
      this._startNextFinalBarrage();
      return amount;
    }

    if (this._player)
      this.vx = Math.sign(this.x - this._player.x) * 150;
    this._changeState('hurt');
    return amount;
  }

    _checkPhaseTransition() {
      const ratio = this.hp / this.maxHp;
      let newPhase = this._phase;
      if (ratio <= this.PHASE3_HP)      newPhase = 3;
      else if (ratio <= this.PHASE2_HP) newPhase = 2;
      if (newPhase !== this._phase) {
        this._phase = newPhase;
        if (this.state === 'attack')
          this._changeState('approach');
        // ?섏씠利??꾪솚 ?쒓컖
        addVfx({ type:'circle', x: this.x, y: this.y - 32,
                 r: 80, color: newPhase===3?'#ff2020':'#ff8020',
                 dur: 0.5, alpha: 0.6, t: 0 });
      }
    }

    _onStateEntered(s) {
      super._onStateEntered(s);
      if (s === 'approach') this.vx = 0;
      if (s === 'finalBarrageEnter') {
        this._clearRangedIntent();
        this.vx = 0;
        this.vy = 0;
        this._barrageEnterFromX = this.x;
        this._barrageEnterFromY = this.y;
      addVfx({
        type: 'circle',
        x: this.x,
        y: this.y - this.height / 2,
        r: 58,
        color: '#ffb080',
        dur: 0.35,
        alpha: 0.45,
        t: 0,
      });
      return;
    }
    if (s === 'finalBarrageAttack') {
      this.vx = 0;
      this.vy = 0;
      this.x = this.FINAL_BARRAGE_TARGET_X;
      this.y = this.FINAL_BARRAGE_TARGET_Y;
      return;
    }
    if (s === 'finalBarrageExit') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'attack') {
      this._hitCount    = 0;  this._nextHitT  = 0;
      this._axeCount    = 0;  this._nextAxeT  = 0;
      this._volleyFired = false;
      this._burstDone   = false;
      this._dashDone    = false;
      this.vx = 0;
      return;
    }
      if (s === 'harassTelegraph') {
        this.vx = 0;
        this.vy = 0;
        const from = { x: this.x, y: this.y - this.height / 2 };
        const to = this._player ? {
          x: this._player.x,
          y: this._player.y - this._player.height / 2,
        } : from;
        const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        this._harassDir = { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
        return;
      }
    if (s === 'harassFire') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      return;
    }
    if (s === 'harassRecovery') {
      this.vx = 0;
    }
  }

  _processState(_dt) {
    if (this._isFinalBarrageState()) {
      this._processFinalBarrageState();
      return;
    }
    if (this._harassCooldown > 0) this._harassCooldown--;
    const ctx = this._getCombatContext();
      this._refreshRangedIntent(
        ctx,
        this.HARASS_TRIGGER_DISTANCE,
        this.HARASS_KEEP_DISTANCE
      );
    if (this._pendingFinalBarrages.length > 0 && this.state !== 'idle') {
      this._startNextFinalBarrage();
      return;
    }
    this._checkPhaseTransition();
    switch(this.state) {
      case 'idle': break;
      case 'approach': this._handleApproach(); break;
      case 'harassTelegraph': this._handleHarassTelegraph(); break;
      case 'harassFire': this._handleHarassFire(); break;
      case 'harassRecovery': this._handleHarassRecovery(); break;
      case 'attack':
        if (this._phase === 1)      this._handlePhase1();
        else if (this._phase === 2) this._handlePhase2();
        else                        this._handlePhase3();
        break;
    }
  }

  _isFinalBarrageState() {
    return this.state === 'finalBarrageEnter' ||
      this.state === 'finalBarrageAttack' ||
      this.state === 'finalBarrageExit';
  }

    _startNextFinalBarrage() {
      if (this._isFinalBarrageState()) return false;
      if (this._pendingFinalBarrages.length <= 0) return false;
      this._activeFinalBarrageThreshold = this._pendingFinalBarrages.shift();
      this._barrageRecoverX = this.x;
      this._barrageRecoverY = this.y;
      this._changeState('finalBarrageEnter');
      return true;
    }

  _processFinalBarrageState() {
    switch (this.state) {
      case 'finalBarrageEnter': this._handleFinalBarrageEnter(); break;
      case 'finalBarrageAttack': this._handleFinalBarrageAttack(); break;
      case 'finalBarrageExit': this._handleFinalBarrageExit(); break;
    }
  }

  _handleFinalBarrageEnter() {
    this.vx = 0;
    this.vy = 0;
    const t = Math.min(this.tick / this.FINAL_BARRAGE_ENTER_FRAMES, 1);
    this.x = lerp(this._barrageEnterFromX, this.FINAL_BARRAGE_TARGET_X, t);
    this.y = lerp(this._barrageEnterFromY, this.FINAL_BARRAGE_TARGET_Y, t);
    if (this.tick >= this.FINAL_BARRAGE_ENTER_FRAMES)
      this._changeState('finalBarrageAttack');
  }

  _handleFinalBarrageAttack() {
    const tier = this._getFinalBarrageTier();
    const aimedInterval = Math.max(14, this.FINAL_BARRAGE_AIMED_INTERVAL - tier * 5);
    const fixedInterval = Math.max(14, this.FINAL_BARRAGE_FIXED_INTERVAL - tier * 4);
    const crossInterval = [0, 52, 40, 30][tier];
    const spiralInterval = [0, 0, 48, 34][tier];
    this.vx = 0;
    this.vy = 0;
    this.x = this.FINAL_BARRAGE_TARGET_X;
    this.y = this.FINAL_BARRAGE_TARGET_Y;
    if (this.tick === 1 || this.tick % aimedInterval === 0)
      this._fireFinalBarrageAimedShot();
    if (this.tick === 1 || this.tick % fixedInterval === 0)
      this._fireFinalBarrageFixedFan();
    if (crossInterval > 0 && (this.tick === 1 || this.tick % crossInterval === 0))
      this._fireFinalBarrageCrossFan();
    if (spiralInterval > 0 && (this.tick === 1 || this.tick % spiralInterval === 0))
      this._fireFinalBarrageSpiralBurst();
    if (this.tick >= this.FINAL_BARRAGE_ATTACK_FRAMES + tier * 36)
      this._changeState('finalBarrageExit');
  }

    _handleFinalBarrageExit() {
      this.vx = 0;
      this.vy = 0;
      const t = Math.min(this.tick / this.FINAL_BARRAGE_EXIT_FRAMES, 1);
      this.x = lerp(this.FINAL_BARRAGE_TARGET_X, this._barrageRecoverX, t);
      this.y = lerp(this.FINAL_BARRAGE_TARGET_Y, this._barrageRecoverY, t);
      if (this.tick >= this.FINAL_BARRAGE_EXIT_FRAMES) {
        this.x = this._barrageRecoverX;
        this.y = this._barrageRecoverY;
        if (!this._startNextFinalBarrage())
          this._changeState('approach');
      }
  }

  _getFinalBarrageTier() {
    const idx = this.FINAL_BARRAGE_THRESHOLDS.indexOf(this._activeFinalBarrageThreshold);
    return idx >= 0 ? idx : 0;
  }

  _getFinalBarrageBulletSpeed() {
    return this.FINAL_BARRAGE_BASE_SPEED +
      this._getFinalBarrageTier() * this.FINAL_BARRAGE_SPEED_STEP;
  }

  _getFinalBarrageBulletDamage() {
    return this.FINAL_BARRAGE_BASE_DAMAGE +
      this._getFinalBarrageTier() * this.FINAL_BARRAGE_DAMAGE_STEP;
  }

  _spawnFinalBarrageProjectile(dirX, dirY, color, radius = 6, speed = null, damage = null) {
    const len = Math.hypot(dirX, dirY) || 1;
    Projectiles.add(new EnemyProjectile(
      this.x,
      this.y - this.height * 0.35,
      dirX / len,
      dirY / len,
      speed ?? this._getFinalBarrageBulletSpeed(),
      damage ?? this._getFinalBarrageBulletDamage(),
      color,
      radius
    ));
  }

  _fireFinalBarrageAimedShot() {
    if (!this._player) return;
    const fromX = this.x;
    const fromY = this.y - this.height * 0.35;
    const toX = this._player.x;
    const toY = this._player.y - this._player.height * 0.5;
    const tier = this._getFinalBarrageTier();
    const base = Math.atan2(toY - fromY, toX - fromX);
    const offsets = tier >= 3 ? [-0.16, 0, 0.16] : tier >= 2 ? [-0.1, 0.1] : [0];
    for (const offset of offsets) {
      this._spawnFinalBarrageProjectile(
        Math.cos(base + offset),
        Math.sin(base + offset),
        '#d8f6ff',
        7
      );
    }
  }

  _fireFinalBarrageFixedFan() {
    const tier = this._getFinalBarrageTier();
    const count = Math.min(9, 5 + tier * 2);
    const spread = 1.0 + tier * 0.16;
    const baseAngle = Math.PI * 0.5;
    const speed = this._getFinalBarrageBulletSpeed() * 0.96;
    const damage = this._getFinalBarrageBulletDamage();
    for (let i = 0; i < count; i++) {
      const ratio = count === 1 ? 0.5 : i / (count - 1);
      const angle = baseAngle - spread * 0.5 + spread * ratio;
      const color = i % 2 === 0 ? '#ff8a66' : '#9ea4b8';
      this._spawnFinalBarrageProjectile(
        Math.cos(angle),
        Math.sin(angle),
        color,
        6,
        speed,
        damage
      );
    }
  }

  _fireFinalBarrageCrossFan() {
    const tier = this._getFinalBarrageTier();
    const count = tier >= 2 ? 6 : 4;
    const baseAngle = Math.PI * 0.5 + (this.tick * 0.045);
    const spread = tier >= 2 ? 1.18 : 0.9;
    for (let i = 0; i < count; i++) {
      const ratio = count === 1 ? 0.5 : i / (count - 1);
      const angle = baseAngle - spread * 0.5 + spread * ratio;
      this._spawnFinalBarrageProjectile(
        Math.cos(angle),
        Math.sin(angle),
        '#ffc48c',
        6,
        this._getFinalBarrageBulletSpeed() * 0.9,
        this._getFinalBarrageBulletDamage()
      );
    }
  }

  _fireFinalBarrageSpiralBurst() {
    const arms = 6;
    const baseAngle = this.tick * 0.09;
    for (let i = 0; i < arms; i++) {
      const angle = baseAngle + (Math.PI * 2 * i) / arms;
      this._spawnFinalBarrageProjectile(
        Math.cos(angle),
        Math.sin(angle),
        i % 2 === 0 ? '#ff8a66' : '#d8f6ff',
        6,
        this._getFinalBarrageBulletSpeed() * 0.88,
        this._getFinalBarrageBulletDamage()
      );
    }
  }

  _handleApproach() {
      const ctx = this._getCombatContext();
        this._refreshRangedIntent(
          ctx,
          this.HARASS_TRIGGER_DISTANCE,
          this.HARASS_KEEP_DISTANCE
        );
      const range = this._phase===1 ? this.P1_RANGE :
                    this._phase===2 ? this.P2_RANGE :
                    this.P3_BURST_RADIUS * 0.8;
      const bossCenter = { x: this.x, y: this.y - this.height / 2 };
      const playerCenter = this._player ? {
        x: this._player.x,
        y: this._player.y - this._player.height / 2,
      } : bossCenter;
      const directDistance = Math.hypot(playerCenter.x - bossCenter.x, playerCenter.y - bossCenter.y);
      const farEnoughForHarass = directDistance >= Math.max(this.HARASS_TRIGGER_DISTANCE, range + 140);
      const shouldHarass = farEnoughForHarass && this._canUseHarassShot(ctx, range, directDistance);
      if (shouldHarass) {
        this._changeState('harassTelegraph');
        return;
      }
        if (directDistance <= range) {
          this._clearRangedIntent();
          this._pickPattern();
          this._changeState('attack');
        } else {
          this.vx = this._dirToPlayer() * this.APPROACH_SPEED;
        }
  }

    _canUseHarassShot(ctx, range, distanceOverride = null) {
      if (!ctx || !this._player) return false;
      if (this._harassCooldown > 0) return false;
      if (ctx.timeSinceLastAttack < 12) return false;
      const distance = Number.isFinite(distanceOverride) ? distanceOverride : ctx.distanceToPlayer;
      const farHarassDistance = Math.max(this.HARASS_TRIGGER_DISTANCE, range + 140);
      return distance >= farHarassDistance;
    }

  _fireHarassShot() {
    const from = { x: this.x, y: this.y - this.height / 2 };
    const count = this._phase === 1 ? 1 : this._phase === 2 ? 3 : 5;
    const offsets = count === 1 ? [0] : count === 3 ? [-0.14, 0, 0.14] : [-0.22, -0.1, 0, 0.1, 0.22];
    const baseAngle = Math.atan2(this._harassDir.y, this._harassDir.x);
    for (const offset of offsets) {
      const angle = baseAngle + offset;
      Projectiles.add(new EnemyProjectile(
        from.x,
        from.y,
        Math.cos(angle),
        Math.sin(angle),
        this.HARASS_SPEED,
        this.HARASS_DAMAGE,
        '#f2d0b0',
        this.HARASS_RADIUS,
        null,
        { ignoreWalls: true }
      ));
    }
    this._harassCooldown = this.HARASS_COOLDOWN;
    this._markAttackUsed('harass');
  }

  _handleHarassTelegraph() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.HARASS_TELEGRAPH_FRAMES)
      this._changeState('harassFire');
  }

  _handleHarassFire() {
    this.vx = 0;
    this.vy = 0;
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._fireHarassShot();
    }
    if (this.tick >= this.HARASS_FIRE_FRAMES)
      this._changeState('harassRecovery');
  }

  _handleHarassRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.HARASS_RECOVERY_FRAMES)
      this._changeState('approach');
  }

  _pickPattern() {
    if (this._phase === 1) {
      this._pattern = 'combo';
    } else if (this._phase === 2) {
      this._pattern = Math.random() < 0.45 ? 'axe' : 'volley';
    } else {
      const r = Math.random();
      this._pattern = r < 0.25 ? 'burst' : r < 0.5 ? 'combo' : r < 0.75 ? 'axe' : 'volley';
    }
  }

  // ?? ?섏씠利?: 肄ㅻ낫 ?뚯쭊
  _handlePhase1() {
    if (this._hitCount < this.P1_COMBO_HITS) {
      if (!this._dashDone) {
        this.vx = this._dirToPlayer() * this.P1_DASH_SPEED;
        if (this.tick >= 6) { this._dashDone = true; this.vx = 0; }
      }
      const shouldHit = this._hitCount === 0
        ? this.tick >= this._nextHitT + 4
        : this.tick >= this._nextHitT;
      if (shouldHit) this._doComboHit();
    } else {
      if (this.tick >= this._nextHitT + this.P1_COOLDOWN)
        this._changeState('approach');
    }
  }

  _doComboHit() {
    const off = this._dirToPlayer() * this.P1_COMBO_W * 0.5;
    this._checkHitbox(off, this.P1_COMBO_W, this.P1_COMBO_H, this.P1_COMBO_DMG);
    addVfx({ type:'rect',
      x: this.x + off, y: this.y - this.height/2,
      w: this.P1_COMBO_W, h: this.P1_COMBO_H, rot:0,
      color:'#ff8060', dur:0.1, alpha:0.5, t:0
    });
    this._hitCount++;
    this._nextHitT = this.tick + this.P1_HIT_INTERVAL;
    this._markAttackUsed('combo');
  }

  // ?? ?섏씠利?
  _handlePhase2() {
    if (this._pattern === 'axe')    this._processAxeThrow();
    else                            this._processP2Volley();
  }

  _processAxeThrow() {
    if (this._axeCount < this.P2_AXE_COUNT) {
      if (this.tick >= this._nextAxeT) {
        this._fireAxe();
        this._axeCount++;
        this._nextAxeT += this.P2_AXE_INTERVAL;
      }
    } else {
      if (this.tick >= this._nextAxeT + this.P2_COOLDOWN)
        this._changeState('approach');
    }
  }

  _fireAxe() {
    if (!this._player) return;
    const dx = this._player.x - this.x;
    const dy = this._player.y - this.y;
    const base = norm(dx, dy);
    const d    = norm(base.x, base.y - 0.3);
    this._spawnProjectile(d.x, d.y, this.P2_AXE_SPEED, this.P2_AXE_DMG);
    this._markAttackUsed('axe');
  }

  _processP2Volley() {
    if (!this._volleyFired && this.tick >= 18) {
      this._volleyFired = true;
      this._markAttackUsed('volley');
      if (this._player) {
        const dx = this._player.x - this.x, dy = this._player.y - this.y;
        const base = Math.atan2(dy, dx);
        const spreadSet = this._phase >= 3 ? [-32, -16, 0, 16, 32] : [-20, 0, 20];
        for (const deg of spreadSet) {
          const a = base + deg * Math.PI / 180;
          this._spawnProjectile(Math.cos(a), Math.sin(a),
            this.P2_PROJ_SPEED, this.P2_PROJ_DMG);
        }
      }
    }
    if (this._volleyFired && this.tick >= 18 + (this._phase >= 3 ? Math.max(52, this.P2_COOLDOWN - 18) : this.P2_COOLDOWN))
      this._changeState('approach');
  }

  // ?? ?섏씠利?
  _handlePhase3() {
    if (this._pattern === 'burst')  this._processBurstJump();
    else if (this._pattern === 'combo') this._handlePhase1();
    else if (this._pattern === 'volley') this._processP2Volley();
    else this._processAxeThrow();
  }

  _processBurstJump() {
    if (!this._burstDone && this.tick === 8) this.vy = this.P3_BURST_JUMP;
    if (!this._burstDone && this.tick === 20) {
      this._burstDone = true;
      this._markAttackUsed('burst');
      this._checkHitbox(0, this.P3_BURST_RADIUS * 2, this.P3_BURST_RADIUS, this.P3_BURST_DMG);
      addVfx({ type:'circle', x: this.x, y: this.y - 32,
               r: this.P3_BURST_RADIUS, color:'#ff4010', dur:0.4, alpha:0.6, t:0 });
    }
    if (this._burstDone && this.tick >= 20 + this.P3_COOLDOWN)
      this._changeState('approach');
  }

  draw(ctx) {
    super.draw(ctx);
    if (this.removeMe) return;

    if (this.state === 'harassTelegraph' || this.state === 'harassFire') {
      const from = { x: this.x, y: this.y - this.height / 2 };
      const toX = from.x + this._harassDir.x * 200;
      const toY = from.y + this._harassDir.y * 200;
      const a = this.state === 'harassFire' ? 0.9 : 0.55;
      const s1 = Camera.toScreen(from.x, from.y);
      const s2 = Camera.toScreen(toX, toY);
      ctx.save();
      ctx.strokeStyle = `rgba(242, 220, 184, ${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 184, 124, ${Math.min(a + 0.1, 1)})`;
      ctx.beginPath();
      ctx.arc(s2.x, s2.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _onDie() {}
}


