'use strict';
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??// bosses.js  ?? 蹂댁뒪 踰좎씠??+ Boss1 + BossFinal
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
// ?? Boss 踰좎씠?????????????????????????????????????????
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

    this._fighting  = false;
    this._callbacks = callbacks;  // { onDie } ??game.js?먯꽌 二쇱엯
    this._deadTimer = 0;          // ?щ쭩 ???꾨젅??移댁슫??(48?꾨젅?꾟뎵800ms ??removeMe)
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

  // 利됰컻 ?덊듃諛뺤뒪 泥댄겕
  _checkHitbox(offX, w, h, damage) {
    if (!this._player) return;
    const cx = this.x + offX;
    const cy = this.y - this.height / 2;
    const hbL = cx - w/2, hbT = cy - h/2;
    const hbR = cx + w/2, hbB = cy + h/2;
    const pr  = eRect(this._player);
    if (pr.l < hbR && pr.r > hbL && pr.t < hbB && pr.b > hbT)
      this._player.takeDamage(damage);
  }

  _spawnProjectile(dirX, dirY, spd, dmg) {
    Projectiles.add(new EnemyProjectile(
      this.x, this.y - 32, dirX, dirY, spd, dmg, '#f88', 7
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

  draw(ctx) {
    if (this.removeMe) return;
    const s = Camera.toScreen(this.x, this.y);
    const sx = s.x, sy = s.y;

    if (this.isDead) ctx.globalAlpha = 0.3;

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

    ctx.globalAlpha = 1;
  }
}

// ?? Boss1 ??13???쒓껐 ?????????????????????????????????
class Boss1 extends Boss {
  constructor(x, y, callbacks = {}) {
    super(x, y, callbacks);
    this.displayName = 'Burning Child';
    this.hp = 500; this.maxHp = 500;
    this.hw = 16; this.height = 56;
    this.color = '#5080d0'; this.baseColor = '#5080d0';

    this.APPROACH_SPEED = 180;
    this.DASH_SPEED     = 800;
    this.DASH_DUR       = 15;  // frames
    this.CD_FRAMES      = 70;
    this.ATTACK_RANGE   = 90;
    this.MELEE_DMG      = 50;
    this.MELEE_W = 56; this.MELEE_H = 48;
    this.CHARGE_TELEGRAPH_FRAMES = 34;  // 0.57s @ 60fps
    this.CHARGE_DASH_FRAMES      = 22;  // 0.37s @ 60fps
    this.CHARGE_RECOVERY_FRAMES  = 48;  // 0.8s @ 60fps
    this.CHARGE_COOLDOWN_FRAMES  = 150; // 2.5s @ 60fps
    this.CHARGE_TRIGGER_MIN      = 150;
    this.CHARGE_TRIGGER_MAX      = 420;
    this.CHARGE_SPEED            = 680;
    this.HALF_BARRAGE_TRIGGER_RATIO = 0.5;
    this.HALF_BARRAGE_MOVE_SPEED    = 420;
    this.HALF_BARRAGE_ATTACK_FRAMES = 156; // 2.6s
    this.HALF_BARRAGE_RETURN_FRAMES = 30;  // 0.5s
    this.HALF_BARRAGE_TARGET_MARGIN_RIGHT = 180;
    this.HALF_BARRAGE_AIMED_INTERVAL = 39; // 0.65s
    this.HALF_BARRAGE_FIXED_INTERVAL = 33; // 0.55s
    this.HALF_BARRAGE_AIMED_SPEED    = 220;
    this.HALF_BARRAGE_FIXED_SPEED    = 190;
    this.HALF_BARRAGE_BULLET_DMG     = 12;
    this.PULSE_TRIGGER_RANGE     = 120;
    this.PULSE_TELEGRAPH_FRAMES  = 34;  // 0.57s
    this.PULSE_ATTACK_FRAMES     = 9;   // 0.15s
    this.PULSE_RECOVERY_FRAMES   = 27;  // 0.45s
    this.PULSE_COOLDOWN_FRAMES   = 180; // 3.0s
    this.PULSE_RADIUS            = 120;
    this.PULSE_DAMAGE            = 28;
    this.AIR_SHOT_INTERVAL_FRAMES = 150; // 2.5s
    this.AIR_SHOT_SPEED           = 230;
    this.AIR_SHOT_DAMAGE          = 8;
    this.AIR_SHOT_RADIUS          = 5;
    this.CHARGE_MIN_ACTIVE_FRAMES = 4;

    this.P2_SPEED_MUL  = 1.5;
    this.P2_CD_FRAMES  = 45;

    this._dashDir    = 1;
    this._inPhase2   = false;
    this._hitApplied = false;
    this._chargeCooldown = 30;
    this._pulseCooldown = 45;
    this._airShotCooldown = this.AIR_SHOT_INTERVAL_FRAMES;
    this._halfBarrageTriggered = false;
    this._halfBarrageTargetX = ROOM_W - this.HALF_BARRAGE_TARGET_MARGIN_RIGHT;
    this._halfBarrageStartX = x;
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
    this._tryFireAirShot();

    switch(this.state) {
      case 'idle': break;
      case 'approach': this._handleApproach(); break;
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
    this.vy = 0;
    const dx = this._halfBarrageTargetX - this.x;
    if (Math.abs(dx) <= 8) {
      this.x = this._halfBarrageTargetX;
      this.vx = 0;
      this._changeState('halfBarrageAttack');
      return;
    }
    this.vx = Math.sign(dx) * this.HALF_BARRAGE_MOVE_SPEED;
  }

  _handleHalfBarrageAttack() {
    this.vx = 0;
    this.vy = 0;
    this.x = this._halfBarrageTargetX;
    if (this.tick === 1 || this.tick % this.HALF_BARRAGE_AIMED_INTERVAL === 0)
      this._fireHalfBarrageAimedShot();
    if (this.tick === 1 || this.tick % this.HALF_BARRAGE_FIXED_INTERVAL === 0)
      this._fireHalfBarrageFixedFan();

    if (this.tick >= this.HALF_BARRAGE_ATTACK_FRAMES)
      this._changeState('halfBarrageReturn');
  }

  _handleHalfBarrageReturn() {
    this.vy = 0;
    const dx = this._player ? this._player.x - this.x : this._halfBarrageStartX - this.x;
    if (this.tick >= this.HALF_BARRAGE_RETURN_FRAMES || Math.abs(dx) <= 24) {
      this.vx = 0;
      this._changeState('approach');
      return;
    }
    this.vx = Math.sign(dx || -1) * this.APPROACH_SPEED;
  }

  _fireHalfBarrageAimedShot() {
    if (!this._player) return;
    const from = this._getBodyCenter();
    const to = this._getPlayerCenter();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    this._spawnProjectile(dx / len, dy / len, this.HALF_BARRAGE_AIMED_SPEED, this.HALF_BARRAGE_BULLET_DMG);
  }

  _fireHalfBarrageFixedFan() {
    const offsets = [-0.35, 0, 0.35];
    const baseAngle = Math.PI;
    for (const offset of offsets) {
      const a = baseAngle + offset;
      this._spawnProjectile(Math.cos(a), Math.sin(a), this.HALF_BARRAGE_FIXED_SPEED, this.HALF_BARRAGE_BULLET_DMG);
    }
  }

  _handleApproach() {
    const playerDist = this._distToPlayer();
    if (this._canStartPulse(playerDist)) {
      this._changeState('pulseTelegraph');
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

  _canFireAirShot() {
    if (this.constructor !== Boss1) return false;
    if (!this._fighting || !this._player) return false;
    if (this._airShotCooldown > 0) return false;
    if (this._isHalfBarrageState()) return false;
    const playerDist = this._distToPlayer();
    if (this.state === 'approach' &&
        (this._canStartPulse(playerDist) ||
         (this._usesTelegraphedCharge() && this._canStartCharge(playerDist)))) {
      return false;
    }
    return this.state === 'approach' ||
      this.state === 'chargeRecovery' ||
      this.state === 'pulseRecovery';
  }

  _tryFireAirShot() {
    if (!this._canFireAirShot()) return false;
    const from = this._getBodyCenter();
    const to = this._getPlayerCenter();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    Projectiles.add(new EnemyProjectile(
      from.x,
      from.y,
      dx / len,
      dy / len,
      this.AIR_SHOT_SPEED,
      this.AIR_SHOT_DAMAGE,
      '#d8f6ff',
      this.AIR_SHOT_RADIUS
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
    return true;
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
      this._player.takeDamage(this.PULSE_DAMAGE);
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

    if (this._isHalfBarrageState()) {
      const s = Camera.toScreen(this.x, this.y);
      ctx.save();
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

  _onDie() {}
}

// ?? BossFinal ??38???뚮갑愿 ?쒓껐 ?????????????????????
class Boss2 extends Boss1 {
  constructor(x, y, callbacks = {}) {
    super(x, y, callbacks);
    this.displayName = 'Stopped Youth';
    this.hp = 700; this.maxHp = 700;
    this.color = '#cf6d2c'; this.baseColor = '#cf6d2c';
    this.APPROACH_SPEED = 220;
    this.DASH_SPEED = 880;
    this.P2_SPEED_MUL = 1.25;

    this.HEAT_SLASH_TELEGRAPH_FRAMES = 30;
    this.HEAT_SLASH_ATTACK_FRAMES = 9;
    this.HEAT_SLASH_RECOVERY_FRAMES = 30;
    this.HEAT_SLASH_COOLDOWN_FRAMES = 150;
    this.HEAT_SLASH_RANGE = 190;
    this.HEAT_SLASH_DAMAGE = 46;
    this.HEAT_SLASH_W = 150;
    this.HEAT_SLASH_H = 72;
    this.HEAT_SLASH_OFFSET = 82;

    this.FLAME_LINE_TELEGRAPH_FRAMES = 39;
    this.FLAME_LINE_ATTACK_FRAMES = 21;
    this.FLAME_LINE_RECOVERY_FRAMES = 21;
    this.FLAME_LINE_COOLDOWN_FRAMES = 180;
    this.FLAME_LINE_RANGE_MIN = 120;
    this.FLAME_LINE_DAMAGE = 32;
    this.FLAME_LINE_W = 280;
    this.FLAME_LINE_H = 42;
    this.FLAME_LINE_OFFSET_AHEAD = 56;

    this.CLOSE_BURST_TRIGGER_RANGE = 110;
    this.CLOSE_BURST_TELEGRAPH_FRAMES = 24;
    this.CLOSE_BURST_ATTACK_FRAMES = 8;
    this.CLOSE_BURST_RECOVERY_FRAMES = 24;
    this.CLOSE_BURST_COOLDOWN_FRAMES = 165;
    this.CLOSE_BURST_RADIUS = 124;
    this.CLOSE_BURST_DAMAGE = 24;

    this.OVERHEAT_BARRAGE_TRIGGER_RATIO = 0.5;
    this.OVERHEAT_BARRAGE_ENTER_FRAMES = 30;
    this.OVERHEAT_BARRAGE_ATTACK_FRAMES = 180;
    this.OVERHEAT_BARRAGE_EXIT_FRAMES = 30;
    this.OVERHEAT_BARRAGE_AIMED_INTERVAL = 36;
    this.OVERHEAT_BARRAGE_FIXED_INTERVAL = 30;
    this.OVERHEAT_BARRAGE_BULLET_SPEED = 280;
    this.OVERHEAT_BARRAGE_BULLET_DAMAGE = 20;
    this.OVERHEAT_BARRAGE_MOVE_SPEED = 300;
    this.OVERHEAT_BARRAGE_TARGET_X = ROOM_W * 0.5;

    this._heatSlashCooldown = 50;
    this._flameLineCooldown = 90;
    this._closeBurstCooldown = 70;
    this._overheatBarrageTriggered = false;
    this._overheatBarrageStartX = x;
    this._lastPattern = null;
    this._slashDir = 1;
    this._flameLineCenterX = x;
  }

  _processState(_dt) {
    if (this._tryStartOverheatBarrage()) return;
    if (this._heatSlashCooldown > 0) this._heatSlashCooldown--;
    if (this._flameLineCooldown > 0) this._flameLineCooldown--;
    if (this._closeBurstCooldown > 0) this._closeBurstCooldown--;

    switch (this.state) {
      case 'idle': break;
      case 'approach': this._handleBoss2Approach(); break;
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
      return;
    }
    if (s === 'overheatBarrageExit') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'closeBurstTelegraph') {
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
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      this._slashDir = this._dirToPlayer();
      return;
    }
    if (s === 'heatSlashAttack') {
      this.vx = 0;
      this.vy = 0;
      this._hitApplied = false;
      return;
    }
    if (s === 'heatSlashRecovery') {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (s === 'flameLineTelegraph') {
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

    const playerDist = this._distToPlayer();
    const burstReady = this._closeBurstCooldown <= 0;
    const slashReady = this._heatSlashCooldown <= 0;
    const flameReady = this._flameLineCooldown <= 0;
    const canBurst = burstReady && playerDist <= this.CLOSE_BURST_TRIGGER_RANGE;
    const canSlash = slashReady && playerDist <= this.HEAT_SLASH_RANGE;
    const canFlame = flameReady && playerDist >= this.FLAME_LINE_RANGE_MIN;
    const slashPreferred = playerDist <= this.HEAT_SLASH_RANGE * 0.72;

    if (canBurst && this._lastPattern !== 'closeBurst') {
      this._changeState('closeBurstTelegraph');
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
    if (this.tick === 1 || this.tick % this.OVERHEAT_BARRAGE_AIMED_INTERVAL === 0)
      this._fireOverheatBarrageAimedShot();
    if (this.tick === 1 || this.tick % this.OVERHEAT_BARRAGE_FIXED_INTERVAL === 0)
      this._fireOverheatBarrageFixedFan();
    if (this.tick >= this.OVERHEAT_BARRAGE_ATTACK_FRAMES)
      this._changeState('overheatBarrageExit');
  }

  _handleOverheatBarrageExit() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.OVERHEAT_BARRAGE_EXIT_FRAMES)
      this._changeState('approach');
  }

  _fireOverheatBarrageAimedShot() {
    if (!this._player) return;
    const from = this._getBodyCenter();
    const to = this._getPlayerCenter();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    this._spawnProjectile(dx / len, dy / len, this.OVERHEAT_BARRAGE_BULLET_SPEED, this.OVERHEAT_BARRAGE_BULLET_DAMAGE);
  }

  _fireOverheatBarrageFixedFan() {
    const dirs = [
      { x: -1, y: 0 },
      { x: -0.72, y: 0.72 },
      { x: 0, y: 1 },
      { x: 0.72, y: 0.72 },
      { x: 1, y: 0 },
    ];
    for (const dir of dirs) {
      const len = Math.hypot(dir.x, dir.y) || 1;
      this._spawnProjectile(
        dir.x / len,
        dir.y / len,
        this.OVERHEAT_BARRAGE_BULLET_SPEED * 0.93,
        this.OVERHEAT_BARRAGE_BULLET_DAMAGE
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
      this._player.takeDamage(this.CLOSE_BURST_DAMAGE);
  }

  _getHeatSlashRect() {
    const cx = this.x + this._slashDir * this.HEAT_SLASH_OFFSET;
    const cy = this.y - this.height / 2;
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
    if (!this._hitApplied) {
      this._hitApplied = true;
      this._lastPattern = 'heatSlash';
      this._heatSlashCooldown = this.HEAT_SLASH_COOLDOWN_FRAMES;
      const rect = this._getHeatSlashRect();
      this._checkHitbox(rect.cx - this.x, rect.w, rect.h, this.HEAT_SLASH_DAMAGE);
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

  _handleHeatSlashRecovery() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.HEAT_SLASH_RECOVERY_FRAMES)
      this._changeState('approach');
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
        dur:0.25,
        alpha:0.45,
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

    if (this.state === 'closeBurstTelegraph' || this.state === 'closeBurstAttack') {
      const center = this._getBodyCenter();
      const s = Camera.toScreen(center.x, center.y);
      const alpha = this.state === 'closeBurstAttack'
        ? 0.3
        : (0.1 + 0.16 * clamp(this.tick / this.CLOSE_BURST_TELEGRAPH_FRAMES, 0, 1));
      ctx.save();
      ctx.fillStyle = `rgba(255, 176, 96, ${alpha})`;
      ctx.strokeStyle = this.state === 'closeBurstAttack'
        ? 'rgba(255, 232, 190, 0.95)'
        : 'rgba(255, 198, 142, 0.88)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.CLOSE_BURST_RADIUS, 0, Math.PI * 2);
      ctx.fill();
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
      ctx.save();
      ctx.fillStyle = `rgba(255, 138, 61, ${alpha})`;
      ctx.strokeStyle = this.state === 'heatSlashAttack'
        ? 'rgba(255, 230, 180, 0.95)'
        : 'rgba(255, 180, 120, 0.9)';
      ctx.lineWidth = 2;
      ctx.fillRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
      ctx.strokeRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
      ctx.restore();
    }

    if (this.state === 'flameLineTelegraph' || this.state === 'flameLineAttack') {
      const rect = this._getFlameLineRect();
      const s = Camera.toScreen(rect.cx, rect.cy);
      const alpha = this.state === 'flameLineAttack'
        ? 0.4
        : (0.1 + 0.18 * clamp(this.tick / this.FLAME_LINE_TELEGRAPH_FRAMES, 0, 1));
      ctx.save();
      ctx.fillStyle = this.state === 'flameLineAttack'
        ? `rgba(255, 72, 24, ${alpha})`
        : `rgba(255, 140, 72, ${alpha})`;
      ctx.strokeStyle = this.state === 'flameLineAttack'
        ? 'rgba(255, 214, 180, 0.95)'
        : 'rgba(255, 188, 138, 0.9)';
      ctx.lineWidth = 2;
      ctx.fillRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
      ctx.strokeRect(s.x - rect.w / 2, s.y - rect.h / 2, rect.w, rect.h);
      ctx.restore();
    }
  }
}

class Boss3 extends Boss1 {
  constructor(x, y, callbacks = {}) {
    super(x, y, callbacks);
    this.displayName = 'Fleeing Youth';
    this.hp = 900; this.maxHp = 900;
    this.color = '#8b63d1'; this.baseColor = '#8b63d1';
    this.APPROACH_SPEED = 230;
    this.DASH_SPEED = 980;
    this.CD_FRAMES = 54;
    this.P2_SPEED_MUL = 1.35;

    this.SMOKE_CLOUD_TELEGRAPH_FRAMES = 36;
    this.SMOKE_CLOUD_ACTIVE_FRAMES = 180;
    this.SMOKE_CLOUD_RECOVERY_FRAMES = 24;
    this.SMOKE_CLOUD_COOLDOWN_FRAMES = 210;
    this.SMOKE_CLOUD_RADIUS = 118;
    this.SMOKE_CLOUD_TICK_INTERVAL = 30;
    this.SMOKE_CLOUD_TICK_DAMAGE = 6;
    this.SMOKE_CLOUD_TICK_SMOKE_GAIN = 4;

    this.CHOKING_RING_TELEGRAPH_FRAMES = 45;
    this.CHOKING_RING_ATTACK_FRAMES = 10;
    this.CHOKING_RING_RECOVERY_FRAMES = 30;
    this.CHOKING_RING_COOLDOWN_FRAMES = 210;
    this.CHOKING_RING_RADIUS = 132;
    this.CHOKING_RING_DAMAGE = 26;
    this.CHOKING_RING_SMOKE_GAIN = 8;
    this.CHOKING_RING_MIN_CAST_RANGE = 120;

    this.BLIND_SHOT_TELEGRAPH_FRAMES = 24;
    this.BLIND_SHOT_FIRE_FRAMES = 6;
    this.BLIND_SHOT_RECOVERY_FRAMES = 24;
    this.BLIND_SHOT_COOLDOWN_FRAMES = 135;
    this.BLIND_SHOT_MIN_CAST_RANGE = 170;
    this.BLIND_SHOT_BULLET_SPEED = 240;
    this.BLIND_SHOT_DAMAGE = 14;
    this.BLIND_SHOT_RADIUS = 6;
    this.BLIND_SHOT_COLOR = '#cfc6f2';

    this.SMOKE_FLOOD_TRIGGER_RATIO = 0.5;
    this.SMOKE_FLOOD_ENTER_FRAMES = 30;
    this.SMOKE_FLOOD_ATTACK_FRAMES = 180;
    this.SMOKE_FLOOD_EXIT_FRAMES = 30;
    this.SMOKE_FLOOD_WAVE_INTERVAL = 45;
    this.SMOKE_FLOOD_CLOUD_ACTIVE_FRAMES = 90;
    this.SMOKE_FLOOD_TICK_INTERVAL = 30;
    this.SMOKE_FLOOD_TICK_DAMAGE = 5;
    this.SMOKE_FLOOD_TICK_SMOKE_GAIN = 4;
    this.SMOKE_FLOOD_RADIUS = 98;
    this.SMOKE_FLOOD_MOVE_SPEED = 90;

    this.PLAYER_ZONE_STABLE_RANGE = 44;
    this.PLAYER_ZONE_STABLE_TRIGGER_FRAMES = 84;
    this.SMOKE_CLOUD_CAST_RANGE = 230;

    this._smokeCloudCooldown = 120;
    this._chokingRingCooldown = 110;
    this._blindShotCooldown = 50;
    this._smokeFloodTriggered = false;
    this._smokeFloodZones = [];
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
    }
  }

  _onStateEntered(s) {
    super._onStateEntered(s);
    if (s === 'smokeCloudTelegraph') {
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
  }

  _tryStartSmokeFlood() {
    if (this._smokeFloodTriggered) return false;
    if (this.state !== 'approach') return false;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    if (ratio > this.SMOKE_FLOOD_TRIGGER_RATIO) return false;
    this._smokeFloodTriggered = true;
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

  _handleBoss3Approach() {
    if (!this._player) {
      this.vx = 0;
      return;
    }

    const playerDist = this._distToPlayer();
    const cloudReady = this._smokeCloudCooldown <= 0;
    const ringReady = this._chokingRingCooldown <= 0;
    const blindReady = this._blindShotCooldown <= 0;
    const canCloud = cloudReady &&
      playerDist <= this.SMOKE_CLOUD_CAST_RANGE &&
      this._playerZoneStableFrames >= this.PLAYER_ZONE_STABLE_TRIGGER_FRAMES;
    const canRing = ringReady && playerDist >= this.CHOKING_RING_MIN_CAST_RANGE;
    const canBlind = blindReady && playerDist >= this.BLIND_SHOT_MIN_CAST_RANGE;

    if (canCloud && (!canRing || this._lastPattern === 'chokingRing')) {
      this._changeState('smokeCloudTelegraph');
      return;
    }
    if (canBlind && canRing) {
      if (this._lastPattern === 'chokingRing') {
        this._changeState('blindShotTelegraph');
        return;
      }
      this._changeState('chokingRingTelegraph');
      return;
    }
    if (canRing) {
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
    else if (playerDist < desiredGap - 42) this.vx = -dir * this.APPROACH_SPEED * 0.7;
    else this.vx = 0;
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
      this._player.takeDamage(this.CHOKING_RING_DAMAGE);
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
    Projectiles.add(new EnemyProjectile(
      from.x,
      from.y,
      this._blindShotDir.x,
      this._blindShotDir.y,
      this.BLIND_SHOT_BULLET_SPEED,
      this.BLIND_SHOT_DAMAGE,
      this.BLIND_SHOT_COLOR,
      this.BLIND_SHOT_RADIUS
    ));
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
      ROOM_W * 0.22,
      ROOM_W * 0.5,
      ROOM_W * 0.78,
    ].map((x) => clamp(x, minX, maxX));
    const waveOffsets = [0, this.SMOKE_FLOOD_WAVE_INTERVAL, this.SMOKE_FLOOD_WAVE_INTERVAL * 2];
    const patterns = [
      [0, 1],
      [1, 2],
      [0, 2],
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
    this._applySmokeFloodTicks();
    if (this.tick >= this.SMOKE_FLOOD_ATTACK_FRAMES)
      this._changeState('smokeFloodExit');
  }

  _handleSmokeFloodExit() {
    this.vx = 0;
    this.vy = 0;
    if (this.tick >= this.SMOKE_FLOOD_EXIT_FRAMES) {
      this._smokeFloodZones = [];
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

    if (this.state === 'chokingRingTelegraph' || this.state === 'chokingRingAttack') {
      const s = Camera.toScreen(this._ringCenter.x, this._ringCenter.y);
      const progress = clamp(this.tick / this.CHOKING_RING_TELEGRAPH_FRAMES, 0, 1);
      const ringR = this.state === 'chokingRingAttack'
        ? this.CHOKING_RING_RADIUS * 0.92
        : this.CHOKING_RING_RADIUS * (1.2 - 0.2 * progress);
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

    if (this.state === 'smokeFloodEnter' || this.state === 'smokeFloodAttack') {
      const attackTick = this.state === 'smokeFloodEnter' ? -1 : this.tick;
      for (const zone of this._smokeFloodZones) {
        if (!zone) continue;
        const s = Camera.toScreen(zone.x, zone.y);
        const isActive = attackTick >= zone.activeStart && attackTick < zone.activeEnd;
        const isTelegraph = attackTick < zone.activeStart &&
          attackTick >= zone.telegraphStart &&
          attackTick < zone.activeStart;
        if (!isActive && !isTelegraph) continue;
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

    this.PHASE2_HP = 0.66;
    this.PHASE3_HP = 0.33;
    this._phase = 1;  // 1 / 2 / 3

    this.APPROACH_SPEED = 200;
    this._combatFloorY = y;

    this.P1_DASH_SPEED  = 700;
    this.P1_COMBO_DMG   = 45;
    this.P1_COMBO_W = 52; this.P1_COMBO_H = 48;
    this.P1_COMBO_HITS  = 3;
    this.P1_HIT_INTERVAL = 10;
    this.P1_RANGE       = 80;
    this.P1_COOLDOWN    = 80;

    this.P2_AXE_COUNT   = 3;
    this.P2_AXE_INTERVAL = 18;
    this.P2_AXE_SPEED   = 500;
    this.P2_AXE_DMG     = 70;
    this.P2_PROJ_DMG    = 65;
    this.P2_PROJ_SPEED  = 380;
    this.P2_RANGE       = 200;
    this.P2_COOLDOWN    = 90;

    this.P3_BURST_DMG    = 120;
    this.P3_BURST_RADIUS = 100;
    this.P3_BURST_JUMP   = -550;
    this.P3_COOLDOWN     = 55;

    this.FINAL_BARRAGE_ENTER_FRAMES = 36;
    this.FINAL_BARRAGE_ATTACK_FRAMES = 210;
    this.FINAL_BARRAGE_EXIT_FRAMES = 36;
    this.FINAL_BARRAGE_AIMED_INTERVAL = 32;
    this.FINAL_BARRAGE_FIXED_INTERVAL = 28;
    this.FINAL_BARRAGE_TARGET_X = ROOM_W * 0.5;
    this.FINAL_BARRAGE_TARGET_Y = 180;
    this.FINAL_BARRAGE_THRESHOLDS = [0.8, 0.6, 0.4, 0.2];
    this.FINAL_BARRAGE_BASE_SPEED = 290;
    this.FINAL_BARRAGE_SPEED_STEP = 10;
    this.FINAL_BARRAGE_BASE_DAMAGE = 18;
    this.FINAL_BARRAGE_DAMAGE_STEP = 2;

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
      this._changeState('approach');
      // ?섏씠利??꾪솚 ?쒓컖
      addVfx({ type:'circle', x: this.x, y: this.y - 32,
               r: 80, color: newPhase===3?'#ff2020':'#ff8020',
               dur: 0.5, alpha: 0.6, t: 0 });
    }
  }

  _onStateEntered(s) {
    if (s === 'approach') this.vx = 0;
    if (s === 'finalBarrageEnter') {
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
    }
  }

  _processState(_dt) {
    if (this._isFinalBarrageState()) {
      this._processFinalBarrageState();
      return;
    }
    if (this._pendingFinalBarrages.length > 0 && this.state !== 'idle') {
      this._startNextFinalBarrage();
      return;
    }
    this._checkPhaseTransition();
    switch(this.state) {
      case 'idle': break;
      case 'approach': this._handleApproach(); break;
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
    this.vx = 0;
    this.vy = 0;
    this.x = this.FINAL_BARRAGE_TARGET_X;
    this.y = this.FINAL_BARRAGE_TARGET_Y;
    if (this.tick === 1 || this.tick % this.FINAL_BARRAGE_AIMED_INTERVAL === 0)
      this._fireFinalBarrageAimedShot();
    if (this.tick === 1 || this.tick % this.FINAL_BARRAGE_FIXED_INTERVAL === 0)
      this._fireFinalBarrageFixedFan();
    if (this.tick >= this.FINAL_BARRAGE_ATTACK_FRAMES)
      this._changeState('finalBarrageExit');
  }

  _handleFinalBarrageExit() {
    this.vx = 0;
    this.vy = 0;
    const t = Math.min(this.tick / this.FINAL_BARRAGE_EXIT_FRAMES, 1);
    this.x = lerp(this.FINAL_BARRAGE_TARGET_X, this._barrageRecoverX, t);
    this.y = lerp(this.FINAL_BARRAGE_TARGET_Y, this._combatFloorY, t);
    if (this.tick >= this.FINAL_BARRAGE_EXIT_FRAMES) {
      this.x = this._barrageRecoverX;
      this.y = this._combatFloorY;
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
    this._spawnFinalBarrageProjectile(
      toX - fromX,
      toY - fromY,
      '#d8f6ff',
      7
    );
  }

  _fireFinalBarrageFixedFan() {
    const tier = this._getFinalBarrageTier();
    const count = Math.min(7, 5 + tier);
    const spread = 1.0 + tier * 0.08;
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

  _handleApproach() {
    const range = this._phase===1 ? this.P1_RANGE :
                  this._phase===2 ? this.P2_RANGE :
                  this.P3_BURST_RADIUS * 0.8;
    if (this._distToPlayer() <= range) {
      this._pickPattern();
      this._changeState('attack');
    } else {
      this.vx = this._dirToPlayer() * this.APPROACH_SPEED;
    }
  }

  _pickPattern() {
    if (this._phase === 1) {
      this._pattern = 'combo';
    } else if (this._phase === 2) {
      this._pattern = Math.random() < 0.5 ? 'axe' : 'volley';
    } else {
      const r = Math.random();
      this._pattern = r < 0.33 ? 'burst' : r < 0.66 ? 'combo' : 'axe';
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
    // ?꾩そ 諛⑺뼢 ?명뼢: dir + (0, -0.3) ???뺢퇋??    const base = norm(dx, dy);
    const d    = norm(base.x, base.y - 0.3);
    this._spawnProjectile(d.x, d.y, this.P2_AXE_SPEED, this.P2_AXE_DMG);
  }

  _processP2Volley() {
    if (!this._volleyFired && this.tick >= 18) {
      this._volleyFired = true;
      if (this._player) {
        const dx = this._player.x - this.x, dy = this._player.y - this.y;
        const base = Math.atan2(dy, dx);
        for (const deg of [-20, 0, 20]) {
          const a = base + deg * Math.PI / 180;
          this._spawnProjectile(Math.cos(a), Math.sin(a),
            this.P2_PROJ_SPEED, this.P2_PROJ_DMG);
        }
      }
    }
    if (this._volleyFired && this.tick >= 18 + this.P2_COOLDOWN)
      this._changeState('approach');
  }

  // ?? ?섏씠利?
  _handlePhase3() {
    if (this._pattern === 'burst')  this._processBurstJump();
    else if (this._pattern === 'combo') this._handlePhase1();
    else this._processAxeThrow();
  }

  _processBurstJump() {
    if (!this._burstDone && this.tick === 8) this.vy = this.P3_BURST_JUMP;
    if (!this._burstDone && this.tick === 20) {
      this._burstDone = true;
      this._checkHitbox(0, this.P3_BURST_RADIUS * 2, this.P3_BURST_RADIUS, this.P3_BURST_DMG);
      addVfx({ type:'circle', x: this.x, y: this.y - 32,
               r: this.P3_BURST_RADIUS, color:'#ff4010', dur:0.4, alpha:0.6, t:0 });
    }
    if (this._burstDone && this.tick >= 20 + this.P3_COOLDOWN)
      this._changeState('approach');
  }

  _onDie() {}
}


