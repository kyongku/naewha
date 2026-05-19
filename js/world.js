'use strict';

const ROOM_W = 2880;
const ROOM_H = 576;
const FLOOR_Y = 544;

function tile(x, y, w, h) { return { l: x, t: y, r: x + w, b: y + h }; }
function platTile(x, y, w, h) { return { l: x, t: y, r: x + w, b: y + h, oneWay: true }; }

function commonGeo(hasRightWall) {
  const g = [
    tile(0, 0, ROOM_W, TILE),
    tile(0, FLOOR_Y, ROOM_W, 32),
    tile(0, 0, TILE, ROOM_H),
  ];
  if (hasRightWall) g.push(tile(ROOM_W - TILE, 0, TILE, ROOM_H));
  return g;
}

class Door {
  constructor(x, y, w, h, side) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.side = side;
    this.locked = true;
    this.rect = () => this.locked ? tile(x, y, w, h) : null;
  }

  lock() { this.locked = true; }
  unlock() { this.locked = false; }

  draw(ctx) {
    const s = Camera.toScreen(this.x, this.y);
    ctx.fillStyle = this.locked ? '#5c3a1e' : '#111';
    ctx.fillRect(s.x, s.y, this.w, this.h);
    if (this.locked) {
      ctx.fillStyle = '#ffa040';
      ctx.fillRect(s.x + this.w / 2 - 4, s.y + this.h / 2 - 8, 8, 10);
    }
  }
}

class Room {
  constructor(id, geo, doors, spawnX, spawnY, isBoss) {
    this.id = id;
    this.geo = geo;
    this.doors = doors;
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.isBoss = !!isBoss;
    this.cleared = false;
    this.fightStarted = false;
    this.entities = [];
    this.nextRoom = null;
    this.prevRoom = null;
    this.onCleared = null;
  }

  allTiles() {
    const tiles = [...this.geo];
    for (const d of this.doors) {
      const r = d.rect();
      if (r) tiles.push(r);
    }
    return tiles;
  }

  addEntity(e) {
    this.entities.push(e);
    e.room = this;
  }

  onEntityDied() {
    const alive = this.entities.filter(e => !e.isDead);
    if (alive.length === 0) this._clear();
  }

  _clear() {
    if (this.cleared) return;
    this.cleared = true;
    for (const d of this.doors) {
      if (d.side === 'right') d.unlock();
    }
    this.onCleared?.(this);
  }

  checkBossTrigger(player) {
    if (!this.isBoss || this.fightStarted) return;
    if (this.entities.length === 0) return;
    const boss = this.entities[0];
    if (player.x > 600) {
      this.fightStarted = true;
      for (const d of this.doors) {
        if (d.side === 'left') d.lock();
      }
      boss.startFight();
    }
  }

  update(player) {
    if (this.isBoss) this.checkBossTrigger(player);
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.update(player);
      if (e.isDead && e.removeMe) this.entities.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#2a2a3a';
    for (const t of this.geo) {
      const s = Camera.toScreen(t.l, t.t);
      ctx.fillRect(s.x, s.y, t.r - t.l, t.b - t.t);
    }
    for (const d of this.doors) d.draw(ctx);
    for (const e of this.entities) e.draw(ctx);
  }
}

function makeRoom1() {
  const geo = [
    ...commonGeo(false),
    platTile(432, 416, 288, 24),
    platTile(1200, 336, 384, 24),
    platTile(1584, 416, 240, 24),
    platTile(2100, 416, 288, 24),
  ];
  const doors = [
    new Door(0, 64, TILE, FLOOR_Y - 64, 'left'),
    new Door(ROOM_W - TILE, 64, TILE, FLOOR_Y - 64, 'right'),
  ];
  doors[0].unlock();
  return new Room('room_1', geo, doors, 80, FLOOR_Y, false);
}

function makeRoom2() {
  const geo = [...commonGeo(false)];
  const doors = [
    new Door(0, 64, TILE, FLOOR_Y - 64, 'left'),
    new Door(ROOM_W - TILE, 64, TILE, FLOOR_Y - 64, 'right'),
  ];
  doors[0].unlock();
  doors[1].lock();
  return new Room('room_2', geo, doors, 80, FLOOR_Y, true);
}

function makeRoom3() {
  const geo = [
    ...commonGeo(false),
    platTile(480, 384, 384, 24),
    platTile(1320, 304, 384, 24),
    platTile(2160, 384, 384, 24),
  ];
  const doors = [
    new Door(0, 64, TILE, FLOOR_Y - 64, 'left'),
    new Door(ROOM_W - TILE, 64, TILE, FLOOR_Y - 64, 'right'),
  ];
  doors[0].unlock();
  return new Room('room_3', geo, doors, 80, FLOOR_Y, false);
}

function makeRoom4() {
  const geo = [...commonGeo(false)];
  const doors = [
    new Door(0, 64, TILE, FLOOR_Y - 64, 'left'),
    new Door(ROOM_W - TILE, 64, TILE, FLOOR_Y - 64, 'right'),
  ];
  doors[0].unlock();
  doors[1].lock();
  return new Room('room_4', geo, doors, 80, FLOOR_Y, true);
}

function makeMobRoom(id, variant) {
  const platformSets = [
    [
      platTile(432, 416, 288, 24),
      platTile(1200, 336, 384, 24),
      platTile(1584, 416, 240, 24),
      platTile(2100, 416, 288, 24),
    ],
    [
      platTile(480, 384, 384, 24),
      platTile(1320, 304, 384, 24),
      platTile(2160, 384, 384, 24),
    ],
    [
      platTile(384, 440, 256, 24),
      platTile(960, 352, 320, 24),
      platTile(1560, 304, 288, 24),
      platTile(2160, 400, 256, 24),
    ],
    [
      platTile(540, 340, 220, 24),
      platTile(1080, 424, 260, 24),
      platTile(1560, 320, 220, 24),
      platTile(2100, 300, 260, 24),
    ],
  ];

  const geo = [...commonGeo(false), ...platformSets[variant % platformSets.length]];
  const doors = [
    new Door(0, 64, TILE, FLOOR_Y - 64, 'left'),
    new Door(ROOM_W - TILE, 64, TILE, FLOOR_Y - 64, 'right'),
  ];
  doors[0].unlock();
  return new Room(id, geo, doors, 80, FLOOR_Y, false);
}

function makeBossRoomById(id) {
  const bossPlatforms = {
    room_2: [
      platTile(980, 430, 220, 24),
      platTile(1480, 356, 340, 24),
    ],
  };
  const geo = [...commonGeo(false), ...(bossPlatforms[id] || [])];
  const doors = [
    new Door(0, 64, TILE, FLOOR_Y - 64, 'left'),
    new Door(ROOM_W - TILE, 64, TILE, FLOOR_Y - 64, 'right'),
  ];
  doors[0].unlock();
  doors[1].lock();
  return new Room(id, geo, doors, 80, FLOOR_Y, true);
}

function buildRoomSequence() {
  return [
    makeMobRoom('room_1', 0),
    makeBossRoomById('room_2'),
    makeMobRoom('room_3', 1),
    makeBossRoomById('room_4'),
    makeMobRoom('room_5', 2),
    makeBossRoomById('room_6'),
    makeMobRoom('room_7', 3),
    makeBossRoomById('room_8'),
    makeMobRoom('room_9', 1),
    makeBossRoomById('room_10'),
    makeBossRoomById('room_11'),
  ];
}
