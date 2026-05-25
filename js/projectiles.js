'use strict';
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??// projectiles.js  ?? ?뚮젅?댁뼱/???ъ궗泥?// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
// Liang-Barsky ?멸렇癒쇳듃 vs AABB (?ъ궗泥??곕꼸留?諛⑹?)
function sweptAABB(x0, y0, x1, y1, rect) {
  const dx = x1 - x0, dy = y1 - y0;
  let tMin = 0, tMax = 1;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > tMax) return false; if (r > tMin) tMin = r; }
    else        { if (r < tMin) return false; if (r < tMax) tMax = r; }
    return true;
  };
  if (!clip(-dx, x0 - rect.l)) return false;
  if (!clip( dx, rect.r - x0)) return false;
  if (!clip(-dy, y0 - rect.t)) return false;
  if (!clip( dy, rect.b - y0)) return false;
  return tMin <= tMax;
}

const ProjectileSpriteAssets = (() => {
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
    // Test-safe optional sprites: keep fallback circles when dedicated art is absent.
    air: makeSprite(null),
    fire: makeSprite(null),
  };
})();

// ?? ?꾨겮 ?ъ궗泥?????????????????????????????????????????
class Axe {
  constructor(x, y, vx, vy, ownerPlayer, upgraded) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.hw = 10; this.height = 10;
    this.owner      = ownerPlayer;
    this.upgraded   = upgraded;
    this.state      = 'flying';  // 'flying' | 'stuck'
    this.isDead     = false;
    this.removeMe   = false;
    this.flyFrames  = 0;
    this.hostX      = 0; this.hostY = 0;   // 諛뺥엺 ?꾩튂
    this.hostEntity = null;
    this.hostOffX   = 0; this.hostOffY = 0;
    this.damage     = upgraded ? 90 : 50;
    this.hitEntities = new Set();
    this.rotation   = 0;
  }

  update(tiles, entities) {
    if (this.isDead) return;
    if (this.state === 'flying') {
      this._updateFlying(tiles, entities);
    } else {
      this._updateStuck();
    }
    if (!this.isDead && this._isOutsideRecoveryBounds()) {
      this.pickup();
      return;
    }
    this.rotation += 0.2;
  }

  _axeRect() {
    const R = 12;
    return { l: this.x - R, t: this.y - R, r: this.x + R, b: this.y + R };
  }

  _isOutsideRecoveryBounds() {
    const margin = 4;
    return (
      this.x <= TILE - margin ||
      this.x >= ROOM_W - TILE + margin ||
      this.y <= TILE - margin ||
      this.y >= FLOOR_Y + margin
    );
  }

  _shouldIgnoreTile(t) {
    // Keep normal sticking behavior on surfaces. Recovery is handled by the
    // post-update outside-bounds check instead.
    return false;
  }

  _oneWayHitSurface(prevX, prevY, nextX, nextY, t, R) {
    if (!t.oneWay) return null;
    if (this.vy <= 0) return null;
    const hitXRange = (hitX) => hitX >= t.l - R && hitX <= t.r + R;

    const prevBottom = prevY + R;
    const nextBottom = nextY + R;
    if (prevBottom > t.t || nextBottom < t.t) return null;

    const denom = nextBottom - prevBottom;
    if (Math.abs(denom) < 1e-6) return null;
    const hitT = (t.t - prevBottom) / denom;
    if (hitT < 0 || hitT > 1) return null;

    const hitX = prevX + (nextX - prevX) * hitT;
    if (!hitXRange(hitX)) return null;

    return {
      x: clamp(hitX, t.l, t.r),
      y: t.t - R,
    };
  }

  _updateFlying(tiles, entities) {
    this.flyFrames++;
    const prevX = this.x;
    const prevY = this.y;
    this.vy += GRAVITY * DT;
    this.vy = Math.min(this.vy, MAX_FALL);
    this.x += this.vx * DT;
    this.y += this.vy * DT;

    const R = 12;
    if (this._isOutsideRecoveryBounds()) {
      this.pickup();
      return;
    }

    const STICK_OUTSET = 6;

      // ???異⑸룎: 理쒖냼 寃뱀묠 異뺤쑝濡?諛?대궦 ??諛뺥옒
      if (this.flyFrames > 5) {
        for (const t of tiles) {
          if (this._shouldIgnoreTile(t)) continue;
          if (t.oneWay) {
            const hit = this._oneWayHitSurface(prevX, prevY, this.x, this.y, t, R);
            if (!hit) continue;
            this.x = hit.x;
            this.y = this.vy > 0 ? hit.y - STICK_OUTSET : hit.y + STICK_OUTSET;
            this._stickTo(null, this.x, this.y);
            return;
          }
          const et = { l: t.l - R, t: t.t - R, r: t.r + R, b: t.b + R };
          if (sweptAABB(prevX, prevY, this.x, this.y, et)) {
            const ar = { l: this.x - R, t: this.y - R, r: this.x + R, b: this.y + R };
            const ol  = ar.r - t.l;
            const or_ = t.r - ar.l;
            const ot  = ar.b - t.t;
          const ob  = t.b - ar.t;
          const mn  = Math.min(ol, or_, ot, ob);
          if      (mn === ot)  this.y = t.t - R - STICK_OUTSET;
          else if (mn === ob)  this.y = t.b + R + STICK_OUTSET;
          else if (mn === ol)  this.x = t.l - R - STICK_OUTSET;
          else                 this.x = t.r + R + STICK_OUTSET;
          this._stickTo(null, this.x, this.y);
          return;
        }
      }
    }

    // ??異⑸룎 (5?꾨젅???댄썑)
    if (this.flyFrames > 5) {
      for (const e of entities) {
        if (e.isDead) continue;
        if (this.hitEntities.has(e)) continue;
        const er = eRect(e);
        const ar = { l: this.x - R, t: this.y - R, r: this.x + R, b: this.y + R };
        if (overlap(ar, er)) {
          e.takeDamage(this.damage, 'axe', this.owner);
          this.hitEntities.add(e);
          if (!e.isDead) { this._stickTo(e, this.x, this.y); return; }
          // ???щ쭩 ??愿??(怨꾩냽 ?좎븘媛?
        }
      }
    }

    // 踰붿쐞 珥덇낵
    const ownerDist = dist2(this.x, this.y, this.owner.x, this.owner.y);
    if (ownerDist > 5000) this.pickup();
  }

  _stickTo(hostEntity, wx, wy) {
    this.state = 'stuck';
    this.vx = 0; this.vy = 0;
    this.hostEntity = hostEntity;
    this.hostX = wx; this.hostY = wy;
    if (hostEntity) {
      this.hostOffX = wx - hostEntity.x;
      this.hostOffY = wy - hostEntity.y;
    }
  }

  _updateStuck() {
    if (this.hostEntity) {
      if (this.hostEntity.isDead || this.hostEntity.removeMe ||
          !Number.isFinite(this.hostEntity.x) || !Number.isFinite(this.hostEntity.y)) {
        console.warn('axe stuck target removed/dead');
        this.pickup();
        return;
      } else {
        this.x = this.hostEntity.x + this.hostOffX;
        this.y = this.hostEntity.y + this.hostOffY;
        this.hostX = this.x; this.hostY = this.y;
      }
    }
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      console.warn('invalid axe anchor target');
      this.pickup();
      return;
    }
    if (!this.hostEntity && this._isOutsideRecoveryBounds()) {
      this.pickup();
    }
  }

  isStuck() { return this.state === 'stuck'; }

  pickup() {
    this.isDead = true;
    this.removeMe = true;
    if (this.owner) this.owner.axeSys.onAxePickedUp();
  }

  draw(ctx) {
    if (this.isDead) return;
    const s = Camera.toScreen(this.x, this.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = '#a07830';
    ctx.fillRect(-10, -4, 20, 8);
    ctx.fillStyle = '#c09840';
    ctx.fillRect(4, -8, 8, 16);
    ctx.restore();
  }
}

// ?? ?뚮젅?댁뼱 ?ъ궗泥?????????????????????????????????????
class PlayerProjectile {
  constructor(x, y, dirX, dirY, speed, damage, maxRange, color, radius, sourceType, ownerPlayer) {
    this.x = x; this.y = y;
    this.vx = dirX * speed; this.vy = dirY * speed;
    this.damage   = damage;
    this.maxRange = maxRange;  // 0 = 臾댁젣??    this.color    = color;
    this.radius   = radius || 6;
    this.traveled = 0;
    this.isDead   = false;
    this.removeMe = false;
    this.hw = this.radius; this.height = this.radius;
    this.sourceType = sourceType || 'ranged';
    this.ownerPlayer = ownerPlayer || null;
  }

  update(tiles, entities) {
    if (this.isDead) return;
    const prevX = this.x, prevY = this.y;
    const dx = this.vx * DT, dy = this.vy * DT;
    this.x += dx; this.y += dy;
    this.traveled += Math.sqrt(dx*dx + dy*dy);

    // ?ш굅由?珥덇낵
    if (this.maxRange > 0 && this.traveled >= this.maxRange) {
      this._die(); return;
    }

    // 踰?異⑸룎 (swept: 怨좎냽 ?ъ궗泥??곕꼸留?諛⑹?)
    const R = this.radius;
    for (const t of tiles) {
      const et = { l: t.l-R, t: t.t-R, r: t.r+R, b: t.b+R };
      if (sweptAABB(prevX, prevY, this.x, this.y, et)) { this._die(); return; }
    }

    // 적 충돌도 swept로 처리해 고속 탄환의 터널링을 막는다.
    for (const e of entities) {
      if (e.isDead) continue;
      const er = eRect(e);
      const hitbox = { l: er.l-R, t: er.t-R, r: er.r+R, b: er.b+R };
      if (sweptAABB(prevX, prevY, this.x, this.y, hitbox)) {
          e.takeDamage(this.damage, this.sourceType, this.ownerPlayer);
          this._die(); return;
        }
      }
  }

  _die() { this.isDead = true; this.removeMe = true; }

  draw(ctx) {
    if (this.isDead) return;
    const s = Camera.toScreen(this.x, this.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, this.radius, 0, Math.PI*2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.x, s.y, this.radius + 3, 0, Math.PI*2);
    ctx.fillStyle = this.color + '40';
    ctx.fill();
  }
}

// ?? ???ъ궗泥???????????????????????????????????????????
class EnemyProjectile {
  constructor(x, y, dirX, dirY, speed, damage, color, radius, spriteKey = null, opts = {}) {
    this.x = x; this.y = y;
    this.vx = dirX * speed; this.vy = dirY * speed;
    this.damage = damage;
    this.color  = color || '#8cf';
    this.radius = radius || 5;
    this.spriteKey = spriteKey;
    this.ignoreWalls = !!opts.ignoreWalls;
    this.isDead = false;
    this.removeMe = false;
  }

  update(tiles, player) {
    if (this.isDead) return;
    const prevX = this.x, prevY = this.y;
    this.x += this.vx * DT;
    this.y += this.vy * DT;

    // 踰?異⑸룎 (swept: 怨좎냽 ?ъ궗泥??곕꼸留?諛⑹?)
    const R = 4;
    if (!this.ignoreWalls) {
      for (const t of tiles) {
        const et = { l: t.l-R, t: t.t-R, r: t.r+R, b: t.b+R };
        if (sweptAABB(prevX, prevY, this.x, this.y, et)) { this._die(); return; }
      }
    }

    // ?뚮젅?댁뼱 異⑸룎
    const pr = eRect(player);
    if (this.x >= pr.l && this.x <= pr.r && this.y >= pr.t && this.y <= pr.b) {
      player.takeDamage(this.damage);
      this._die();
    }

    // 踰붿쐞 ?쒗븳 (3000px)
    if (Math.abs(this.x - player.x) > 3000 || this.y < -200 || this.y > ROOM_H + 200)
      this._die();
  }

  _die() { this.isDead = true; this.removeMe = true; }

  _getSpriteAsset() {
    if (!this.spriteKey) return null;
    return ProjectileSpriteAssets[this.spriteKey] || null;
  }

  draw(ctx) {
    if (this.isDead) return;
    const s = Camera.toScreen(this.x, this.y);
    const asset = this._getSpriteAsset();
    if (asset && asset.loaded && !asset.failed) {
      const size = this.radius * 4;
      ctx.drawImage(asset.img, s.x - size / 2, s.y - size / 2, size, size);
      return;
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, this.radius, 0, Math.PI*2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

// ?? ?ъ궗泥?? 愿由??????????????????????????????????????
const Projectiles = {
  list: [],
  add(p)   { this.list.push(p); },
  update(tiles, enemies, player) {
    for (const p of this.list) {
      if (p instanceof EnemyProjectile) p.update(tiles, player);
      else p.update(tiles, enemies);
    }
    this._cleanup();
  },
  _cleanup() {
    for (let i = this.list.length-1; i >= 0; i--) {
      if (this.list[i].removeMe) this.list.splice(i,1);
    }
  },
  draw(ctx) { for (const p of this.list) p.draw(ctx); },
  clear()   { this.list = []; },
};
