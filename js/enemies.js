'use strict';
// ═══════════════════════════════════════════════════════
// enemies.js  —  적 베이스 + Ember / MirrorShard / Golem
// ═══════════════════════════════════════════════════════

// ── Enemy 베이스 ──────────────────────────────────────
class Enemy {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hw     = 16;
    this.height = 40;
    this.hp     = 100;
    this.maxHp  = 100;
    this.knockbackDist = 32;
    this.onFloor   = false;
    this.onWall    = false;
    this.isDead    = false;
    this.removeMe  = false;
    this._deadTimer = 0;    // 사망 후 프레임 카운터 (30프레임≈500ms 뒤 removeMe)

    // FSM: 'idle','patrol','chase','attack','stun','dead'
    this.state     = 'idle';
    this.tick      = 0;
    this._stunFrames = 9;
    this._player   = null;
    this.room      = null;

    // 시각
    this.color       = '#e04040';
    this.visualH     = 40;

    // 산소 드롭률
    this.DROP_RATE = 0.3;
  }

  // ── FSM 전환 ─────────────────────────────────────
  _changeState(s) {
    if (this.state === 'dead') return;
    this.state = s; this.tick = 0;
    this._onStateEntered(s);
  }
  _onStateEntered(_s) {}

  // ── 피해 ─────────────────────────────────────────
  takeDamage(amount, sourceType = 'field', sourceAttacker = null) {
    if (this.isDead) return 0;
    this.hp -= amount;
    spawnDmgNum(this.x, this.y - this.visualH - 16, amount);
    sourceAttacker?.onDealDamage?.(amount, sourceType);
    if (this.hp <= 0) { this.hp = 0; this._die(); return amount; }
    this._enterStun();
    return amount;
  }

  _enterStun() {
    const kbDir = this._player
      ? Math.sign(this.x - this._player.x) || 1
      : 1;
    const dur = Math.max(this._stunFrames / 60, 0.016);
    this.vx = kbDir * this.knockbackDist / dur;
    this._stunFrames = 9;
    this._changeState('stun');
  }

  _die() {
    this.isDead  = true;
    this.vx = 0; this.vy = 0;
    if (this._player && Math.random() < this.DROP_RATE)
      this._player.oxygenSys.addStack(1);
    this._onDie();
    if (this.room) this.room.onEntityDied();
    this._changeState('dead');
  }
  _onDie() {}

  // ── 물리 ─────────────────────────────────────────
  _applyGravity() {
    if (!this.onFloor)
      this.vy = Math.min(this.vy + GRAVITY * DT, MAX_FALL);
  }

  _processStun() {
    if (this.tick >= this._stunFrames) {
      this.vx = 0;
      this._stunFrames = 9;
      this._changeState(this._getPostStunState());
    }
  }
  _getPostStunState() { return 'patrol'; }

  // ── 공통 헬퍼 ────────────────────────────────────
  _distToPlayer() {
    if (!this._player) return Infinity;
    return dist2(this.x, this.y, this._player.x, this._player.y);
  }
  _dirToPlayer() {
    if (!this._player) return 1;
    return Math.sign(this._player.x - this.x) || 1;
  }

  // ── 업데이트 ─────────────────────────────────────
  update(player) {
    if (this.removeMe) return;
    this._player = player;

    if (this.isDead) {
      this._deadTimer++;
      if (this._deadTimer >= 30) this.removeMe = true;  // 30프레임(≈500ms) 뒤 제거
      return;
    }

    this.tick++;
    this._applyGravity();

    if (this.state === 'stun') this._processStun();
    else this._processState(DT);

    const tiles = this.room ? this.room.allTiles() : [];
    const result = moveAndSlide(this, tiles);
    clampToRoomBounds(this);
    this.onFloor = result.onFloor;
    this.onWall  = result.onWall;
    this.onCeil  = result.onCeil;
  }
  _processState(_dt) {}

  // ── 그리기 ───────────────────────────────────────
  draw(ctx) {
    if (this.removeMe) return;
    const s = Camera.toScreen(this.x, this.y);
    const sx = s.x, sy = s.y;

    // 몸통
    if (this.isDead) {
      ctx.globalAlpha = 0.3;
    }
    ctx.fillStyle = this.state === 'stun' ? '#fff' : this.color;
    ctx.fillRect(sx - this.hw, sy - this.height, this.hw*2, this.height);
    ctx.globalAlpha = 1;

    // HP 바
    if (!this.isDead) {
      const bw = 40, bh = 5;
      const bx = sx - bw/2, by = sy - this.visualH - 16;
      const ratio = this.hp / this.maxHp;
      ctx.fillStyle = '#111';
      ctx.fillRect(bx, by, bw, bh);
      const hpColor = `hsl(${Math.round(ratio*120)},80%,40%)`;
      ctx.fillStyle = hpColor;
      ctx.fillRect(bx, by, bw * ratio, bh);
    }
  }
}

// ── Ember — 불씨 ──────────────────────────────────────
class Ember extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hw = 14; this.height = 28; this.visualH = 28;
    this.hp = 150; this.maxHp = 150;
    this.knockbackDist = 32;
    this.color = '#ff6020';

    this.DETECT = 256;
    this.DASH_SPEED = 500;
    this.DASH_DMG   = 90;
    this.STARTUP    = 12;
    this.RECOVERY   = 72;

    this._dashDir  = { x:0, y:0 };
    this._hasHit   = false;
  }

  _applyGravity() {
    if (this.state === 'stun') {
      if (!this.onFloor)
        this.vy = Math.min(this.vy + GRAVITY * DT, MAX_FALL);
    } else if (this.state === 'attack') {
      // 돌진 중: velocity 완전 제어
    } else {
      this.vy = 0;  // 부유
    }
  }

  _onStateEntered(s) {
    if (s === 'idle')   { this.vx = 0; this.vy = 0; }
    if (s === 'chase')  { this.vx = 0; }
    if (s === 'attack') {
      this._hasHit = false;
      if (this._player) {
        const d = norm(this._player.x - this.x, this._player.y - this.y);
        this._dashDir = d;
      } else {
        this._dashDir = { x: this._dirToPlayer(), y: 0 };
      }
    }
    if (s === 'stun') {}
  }

  _processState(dt) {
    switch(this.state) {
      case 'idle':
        if (this._distToPlayer() <= this.DETECT) this._changeState('chase');
        break;
      case 'chase':
        if (this.tick >= this.STARTUP) this._changeState('attack');
        break;
      case 'attack':
        this.vx = this._dashDir.x * this.DASH_SPEED;
        this.vy = this._dashDir.y * this.DASH_SPEED;
        // 플레이어 피격 체크
        if (!this._hasHit && this._player) {
          const pr = eRect(this._player);
          const ar = eRect(this);
          if (overlap(ar, pr)) {
            this._player.takeDamage(this.DASH_DMG);
            this._hasHit = true;
          }
        }
        if (this._hasHit || this.onWall || this.onCeil ||
            (this.onFloor && this._dashDir.y >= 0)) {
          this.vx = 0; this.vy = 0;
          this._stunFrames = this.RECOVERY;
          this._changeState('stun');
        }
        break;
    }
  }
  _getPostStunState() { return 'idle'; }
}

// ── MirrorShard — 거울파편 ────────────────────────────
class MirrorShard extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hw = 14; this.height = 40; this.visualH = 40;
    this.hp = 200; this.maxHp = 200;
    this.knockbackDist = 22;
    this.color = '#80c0e0';

    this.DETECT    = 320;
    this.RETREAT   = 160;
    this.RETREAT_SPEED = 150;
    this.PROJ_SPEED    = 350;
    this.DMG_NORMAL    = 55;
    this.DMG_SHOTGUN   = 40;
    this.SHOTGUN_HP    = 0.4;
    this.STARTUP       = 30;
    this.CD_NORMAL     = 1.5;
    this.CD_SHOTGUN    = 2.5;

    this._shootCd  = 0;
    this._inRecovery = false;
  }

  _onStateEntered(s) {
    if (s === 'patrol') this.vx = 0;
    if (s === 'attack') { this.vx = 0; this._inRecovery = false; }
  }

  _processState(dt) {
    this._shootCd = Math.max(this._shootCd - dt, 0);
    switch(this.state) {
      case 'idle':   this._changeState('patrol'); break;
      case 'patrol':
        if (this._distToPlayer() <= this.DETECT) this._changeState('chase');
        break;
      case 'chase':
        this._handleRetreat();
        if (this._distToPlayer() > this.DETECT) this._changeState('patrol');
        else if (this._shootCd <= 0) this._changeState('attack');
        break;
      case 'attack':
        this.vx = 0;
        if (!this._inRecovery) {
          if (this.tick >= this.STARTUP) {
            this._fire();
            this._inRecovery = true;
            this.tick = 0;
          }
        } else {
          this._changeState('chase');
        }
        break;
    }
  }

  _handleRetreat() {
    if (this._distToPlayer() < this.RETREAT)
      this.vx = -this._dirToPlayer() * this.RETREAT_SPEED;
    else this.vx = 0;
  }

  _fire() {
    const isShotgun = this.hp / this.maxHp <= this.SHOTGUN_HP;
    const d = this._dirToPlayer();

    if (isShotgun) {
      this._shootCd = this.CD_SHOTGUN;
      for (const [dx, dy] of [[d,0],[d,-1],[d,1]]) {
        const nd = norm(dx, dy);
        Projectiles.add(new EnemyProjectile(
          this.x, this.y - 20,
          nd.x, nd.y,
          this.PROJ_SPEED, this.DMG_SHOTGUN,
          '#a0d8f0', 5
        ));
      }
    } else {
      this._shootCd = this.CD_NORMAL;
      Projectiles.add(new EnemyProjectile(
        this.x, this.y - 20,
        d, 0,
        this.PROJ_SPEED, this.DMG_NORMAL,
        '#80c0e0', 5
      ));
    }
  }

  _getPostStunState() { return 'patrol'; }
}

// ── Golem — 골렘 ──────────────────────────────────────
class Golem extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hw = 18; this.height = 58; this.visualH = 58;
    this.hp = 450; this.maxHp = 450;
    this.knockbackDist = 6;
    this.color = '#8a7060';

    this.PATROL_SPEED = 100;
    this.PATROL_RANGE = 128;
    this.CHASE_SPEED  = 100;
    this.DETECT       = 200;

    this.SLAM_RANGE   = 64;
    this.SLAM_W       = 48; this.SLAM_H = 48;
    this.SLAM_DMG     = 100;
    this.SLAM_STARTUP = 42; this.SLAM_RECOVERY = 60;

    this.PUSH_RANGE   = 32;
    this.PUSH_DMG     = 40;
    this.PUSH_KB      = 960;
    this.PUSH_STARTUP = 18;
    this.PUSH_CD      = 3;

    this._spawnX     = x;
    this._patrolDir  = 1;
    this._attackType = 'slam';  // 'slam' | 'push'
    this._inRecovery = false;
    this._pushCd     = 0;
    this._slamDone   = false;
  }

  _processState(dt) {
    this._pushCd = Math.max(this._pushCd - dt, 0);
    switch(this.state) {
      case 'idle':   this._changeState('patrol'); break;
      case 'patrol': this._handlePatrol(); break;
      case 'chase':  this._handleChase(); break;
      case 'attack': this.vx = 0; this._processAttack(); break;
    }
  }

  _handlePatrol() {
    this.vx = this._patrolDir * this.PATROL_SPEED;
    const offset = this.x - this._spawnX;
    if (offset > this.PATROL_RANGE)  this._patrolDir = -1;
    if (offset < -this.PATROL_RANGE) this._patrolDir =  1;
    if (this.onWall) this._patrolDir = -this._patrolDir;
    if (this._distToPlayer() <= this.DETECT) this._changeState('chase');
  }

  _handleChase() {
    this.vx = this._dirToPlayer() * this.CHASE_SPEED;
    const d = this._distToPlayer();
    if (d > this.DETECT) { this._changeState('patrol'); return; }
    if (d <= this.PUSH_RANGE && this._pushCd <= 0) {
      this._attackType = 'push'; this._changeState('attack'); return;
    }
    if (d <= this.SLAM_RANGE) {
      this._attackType = 'slam'; this._changeState('attack');
    }
  }

  _onStateEntered(s) {
    if (s === 'attack') {
      this.vx = 0; this._inRecovery = false; this._slamDone = false;
    }
  }

  _processAttack() {
    const startup  = this._attackType === 'slam' ? this.SLAM_STARTUP  : this.PUSH_STARTUP;
    const recovery = this._attackType === 'slam' ? this.SLAM_RECOVERY : 0;

    if (!this._inRecovery) {
      if (this.tick >= startup) {
        this._doAttack();
        this._inRecovery = true; this.tick = 0;
      }
    } else {
      if (this.tick >= recovery) {
        if (this._attackType === 'push') this._pushCd = this.PUSH_CD;
        this._changeState('chase');
      }
    }
  }

  _doAttack() {
    if (this._attackType === 'slam') this._doSlam();
    else this._doPush();
  }

  _doSlam() {
    if (!this._player) return;
    const ox  = this._dirToPlayer() * this.SLAM_W * 0.5;
    const hbL = this.x + ox - this.SLAM_W/2, hbT = this.y - this.height/2 - this.SLAM_H/2;
    const hbR = hbL + this.SLAM_W, hbB = hbT + this.SLAM_H;
    const pr  = eRect(this._player);
    if (pr.l < hbR && pr.r > hbL && pr.t < hbB && pr.b > hbT)
      this._player.takeDamage(this.SLAM_DMG);
    // 슬램 VFX
    addVfx({ type:'rect', x: this.x + ox, y: this.y - this.height/2,
             w: this.SLAM_W, h: this.SLAM_H, rot:0, color:'#c0a060', dur:0.2, alpha:0.5, t:0 });
  }

  _doPush() {
    if (!this._player || this._distToPlayer() > this.PUSH_RANGE) return;
    this._player.takeDamage(this.PUSH_DMG);
    const pushDir = Math.sign(this._player.x - this.x) || 1;
    this._player.vx = pushDir * this.PUSH_KB;
  }

  _getPostStunState() { return 'patrol'; }

  draw(ctx) {
    super.draw(ctx);
    if (!this.isDead && this.state === 'attack') {
      // 공격 준비 표시
      const s = Camera.toScreen(this.x, this.y);
      ctx.fillStyle = this._attackType === 'slam' ? '#ffaa00' : '#ff4444';
      ctx.fillRect(s.x - 4, s.y - this.height - 20, 8, 8);
    }
  }
}

// ── GolemAxe (Golem 상속) ─────────────────────────────
class GolemAxe extends Golem {
  constructor(x, y) {
    super(x, y);
    this.color = '#708090';
    this._axeDropped = false;
  }

  _onDie() {
    // 도끼 확정 드롭: AxeSystem 내부 상태(경로·대시 플래그)까지 일괄 초기화
    if (this._player && !this._axeDropped) {
      this._axeDropped = true;
      this._player.axeSys.onAxePickedUp();
    }
  }
}
