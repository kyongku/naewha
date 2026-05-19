'use strict';
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??// game.js  ?? GameManager, HUD, ??愿由? 硫붿씤 猷⑦봽
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
// ?? HUD ???????????????????????????????????????????????
const DEBUG_MODE = true; // Set to false before shipping builds.

const HUD = {
  _bossVisible: false,
  _bossName:    '',
  _bossHp:      0,
  _bossMaxHp:   1,
  _showUnlockedDebug: false,

  // HP諛??됱긽 (?뚮젅?댁뼱 紐명넻 ??PHASE_COLORS? 蹂꾧컻 ??HP諛??꾩슜)
  _phaseBarColors: {
    [HP_PHASE.NORMAL]:  '#50d070',
    [HP_PHASE.FIRE]:    '#ff8820',
    [HP_PHASE.FIREMAN]: '#e03030',
  },
  // ?먭굅由?荑⑤떎??諛??됱긽
  _phaseRngColors: {
    [HP_PHASE.NORMAL]:  '#a0c8ff',
    [HP_PHASE.FIRE]:    '#ff8040',
    [HP_PHASE.FIREMAN]: '#40c0ff',
  },
    _phaseLabels: {
    [HP_PHASE.NORMAL]:  'NORMAL',
    [HP_PHASE.FIRE]:    'FIRE',
    [HP_PHASE.FIREMAN]: 'FIREMAN',
  },

  showBoss(name, maxHp) {
    this._bossVisible = true;
    this._bossName    = name;
    this._bossHp      = maxHp;
    this._bossMaxHp   = maxHp;
  },
  updateBossHp(hp) { this._bossHp = hp; },
  hideBoss()       { this._bossVisible = false; },

  _skillMeta(skillId) {
    if (typeof PlayerSkillMetadata === 'object' && PlayerSkillMetadata)
      return PlayerSkillMetadata[skillId] || null;
    return null;
  },

  _formatUnlockedSkill(skillId, fallbackName, fallbackInput) {
    const meta = this._skillMeta(skillId);
    return {
      id: skillId,
      name: meta && meta.name ? meta.name : fallbackName,
      inputHint: meta && meta.inputHint ? meta.inputHint : fallbackInput,
    };
  },

  _getUnlockedSkillLines() {
    const lines = [];
    if (GameManager && GameManager.hasOxygen) {
      lines.push(this._formatUnlockedSkill('oxygenUnlock', 'Oxygen', 'Passive'));
    }
    if (GameManager && GameManager.hasHeat) {
      lines.push(this._formatUnlockedSkill('heatUnlock', 'Heat Control', 'Passive'));
    }
    if (GameManager && GameManager.hasSmoke) {
      lines.push(this._formatUnlockedSkill('smokeUnlock', 'Smoke', 'Passive'));
    }
    return lines;
  },

  _getRewardToast() {
    if (typeof GameManager !== 'object' || !GameManager) return null;
    const toast = GameManager.rewardToast;
    if (!toast || !Number.isFinite(toast.timer) || toast.timer <= 0) return null;
    return toast;
  },

  draw(ctx, player) {
    const W = 960, H = 576;
    ctx.save();
    ctx.resetTransform();

    // ?? ?뚮젅?댁뼱 HP 諛??????????????????????????????
    const hpRatio = player.hp / player.MAX_HP;
    const barW = 240, barH = 14, barX = 16, barY = 16;
    ctx.fillStyle = '#111';
    ctx.fillRect(barX, barY, barW, barH);
    const phaseColors = this._phaseBarColors;
    ctx.fillStyle = phaseColors[player.phase];
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.fillText(`HP  ${Math.ceil(player.hp)} / ${player.MAX_HP}`, barX + 4, barY + 11);

    // ?? ?곗냼 ?ㅽ깮 ??????????????????????????????????
    const ox = barX, oy = barY + barH + 6;
    ctx.fillStyle = '#88aacc';
    ctx.font = '10px monospace';
    ctx.fillText('O2', ox, oy + 10);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < player.oxygenSys.stacks ? '#20d8ff' : '#1a2030';
        ctx.beginPath();
        ctx.arc(ox + 22 + i * 22, oy + 6, 8, 0, Math.PI * 2);
        ctx.fill();
      ctx.strokeStyle = '#40a0c0';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (player.heatSys && player.heatSys.enabled) {
        const heatRatio = player.heatSys && player.heatSys.maxValue > 0
          ? clamp(player.heatSys.value / player.heatSys.maxValue, 0, 1)
          : 0;
        const heatValue = player.heatSys ? Math.round(player.heatSys.value) : 0;
        const heatMax = player.heatSys ? Math.round(player.heatSys.maxValue) : 0;
        const hx = barX;
        const hy = oy + 20;
        const hw = 132;
        const hh = 8;
        ctx.fillStyle = '#ffb266';
        ctx.font = '10px monospace';
        ctx.fillText('HEAT', hx, hy + 9);
        ctx.fillStyle = '#111';
        ctx.fillRect(hx + 34, hy + 1, hw, hh);
        ctx.fillStyle = '#ff7a1a';
        ctx.fillRect(hx + 34, hy + 1, hw * heatRatio, hh);
        ctx.strokeStyle = '#a04b12';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx + 34, hy + 1, hw, hh);
        ctx.fillStyle = '#ffb266';
        ctx.font = '9px monospace';
        ctx.fillText(`${heatValue} / ${heatMax}`, hx + 34 + hw + 8, hy + 8);
        const heatStatus = player.heatSys && player.heatSys.combatUnlocked
          ? (player.heatSys.activeMode === 'formHeat' ? 'MODE ON' : 'MODE OFF')
          : 'LOCKED';
        ctx.fillStyle = player.heatSys && player.heatSys.combatUnlocked
          ? (player.heatSys.activeMode === 'formHeat' ? '#ffd08a' : '#7a5a38')
          : '#6a4d34';
        ctx.font = '9px monospace';
        ctx.fillText(heatStatus, hx + 174, hy + 9);
      }

      if (GameManager.hasSmoke || (player.smokeSys && player.smokeSys.enabled)) {
        const smokeRatio = player.smokeSys && player.smokeSys.maxValue > 0
          ? clamp(player.smokeSys.value / player.smokeSys.maxValue, 0, 1)
          : 0;
        const sx = barX;
        const sy = oy + ((player.heatSys && player.heatSys.enabled) ? 36 : 20);
        const sw = 132;
        const sh = 8;
        ctx.fillStyle = '#b8b8c8';
        ctx.font = '10px monospace';
        ctx.fillText('SMOKE', sx, sy + 9);
        ctx.fillStyle = '#111';
        ctx.fillRect(sx + 34, sy + 1, sw, sh);
        ctx.fillStyle = '#8a90b8';
        ctx.fillRect(sx + 34, sy + 1, sw * smokeRatio, sh);
        ctx.strokeStyle = '#4e5675';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 34, sy + 1, sw, sh);
      }

      // ?? 荑⑤떎??諛???????????????????????????????????
      const resourceRows =
        ((player.heatSys && player.heatSys.enabled) ? 1 : 0) +
        (GameManager.hasSmoke || (player.smokeSys && player.smokeSys.enabled) ? 1 : 0);
      const cdW = 100, cdH = 8, cdX = barX, cdY = oy + 22 + resourceRows * 16;

    const dashReady = 1 - player.dashSys.getCdRatio();
    ctx.fillStyle = '#111';
    ctx.fillRect(cdX, cdY, cdW, cdH);
    ctx.fillStyle = dashReady >= 1 ? '#60d0ff' : '#204060';
    ctx.fillRect(cdX, cdY, cdW * dashReady, cdH);
    ctx.fillStyle = '#88aacc';
    ctx.font = '9px monospace';
    ctx.fillText('DASH', cdX + 2, cdY + cdH - 1);

    const rngReady = 1 - player.rangedSys.getCdRatio(player.phase);
    const rcdY = cdY + cdH + 4;
    ctx.fillStyle = '#111';
    ctx.fillRect(cdX, rcdY, cdW, cdH);
    ctx.fillStyle = rngReady >= 1 ? this._phaseRngColors[player.phase] : '#202030';
    ctx.fillRect(cdX, rcdY, cdW * rngReady, cdH);
    ctx.fillStyle = '#88aacc';
    ctx.fillText('RANGED', cdX + 2, rcdY + cdH - 1);

    // 梨꾨꼸留?吏꾪뻾
    if (player.oxygenSys.isChanneling()) {
      const cr = player.oxygenSys.getChannelRatio();
      const cchY = rcdY + cdH + 4;
      ctx.fillStyle = '#002a3a';
      ctx.fillRect(cdX, cchY, cdW, cdH);
      ctx.fillStyle = '#20e8ff';
      ctx.fillRect(cdX, cchY, cdW * cr, cdH);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#20e8ff';
      ctx.fillText('CHANNEL', cdX + 2, cchY + cdH - 1);
    }

    const skill3Y = rcdY + cdH + 16;
    let skill3State = 'READY';
    let skill3Color = '#7ce8ff';
    if (player._skill3Cooldown > 0) {
      skill3State = `${player._skill3Cooldown.toFixed(1)}s`;
      skill3Color = '#406880';
    } else if (player.hp >= player.MAX_HP) {
      skill3State = 'HP MAX';
      skill3Color = '#88aacc';
    } else if (player.oxygenSys.stacks < player.SKILL3_OXYGEN_COST) {
      skill3State = 'O2 LOW';
      skill3Color = '#4f6d80';
    }
    ctx.fillStyle = '#88aacc';
    ctx.font = '9px monospace';
    ctx.fillText('SKILL3', cdX, skill3Y);
    ctx.fillStyle = skill3Color;
    ctx.fillText(skill3State, cdX + 48, skill3Y);

    if (player.smokeSys && player.smokeSys.enabled) {
      const smokeSkill2Y = skill3Y + 12;
      const smokeReleaseState = player.getSmokeReleaseStatus();
      let smokeReleaseColor = '#b8b8c8';
      if (smokeReleaseState === 'READY') smokeReleaseColor = '#e8f0ff';
      else if (smokeReleaseState === 'SMOKE LOW') smokeReleaseColor = '#687080';
      else smokeReleaseColor = '#7a88a0';
      ctx.fillStyle = '#88aacc';
      ctx.fillText('SKILL2', cdX, smokeSkill2Y);
      ctx.fillStyle = smokeReleaseColor;
      ctx.fillText(smokeReleaseState, cdX + 48, smokeSkill2Y);
    }

    // HP 援ш컙 ?덉씠釉?    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = phaseColors[player.phase];
    ctx.fillText(this._phaseLabels[player.phase], barX + barW + 8, barY + 11);

    // ?꾨겮 ?뚯? ?꾩씠肄?    ctx.font = '10px monospace';
    ctx.fillStyle = player.axeSys.hasAxe ? '#c09840' : '#444';
    ctx.fillText('AXE', barX + barW + 8, barY + 26);

    // ?? 蹂댁뒪 HP 諛??????????????????????????????????
    if (this._bossVisible) {
      const bw = 500, bh = 18;
      const bx = (W - bw) / 2, by = H - 50;
      ctx.fillStyle = '#111';
      ctx.fillRect(bx, by, bw, bh);
      const br = this._bossHp / this._bossMaxHp;
      const r = Math.round(200 + br * 20), g = Math.round(br * 50), b2 = Math.round(br * 30);
      ctx.fillStyle = `rgb(${r},${g},${b2})`;
      ctx.fillRect(bx, by, bw * br, bh);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this._bossName, W / 2, by - 6);
      ctx.textAlign = 'left';
      // HP ?レ옄
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(this._bossHp)} / ${this._bossMaxHp}`, W / 2, by + 13);
      ctx.textAlign = 'left';
    }

    // ?? 議곗옉踰??뚰듃 ????????????????????????????????
    const rewardToast = this._getRewardToast();
    if (rewardToast) {
      const panelPaddingX = 14;
      const panelPaddingY = 12;
      const rowGap = 16;
      const titleFont = 'bold 14px monospace';
      const itemFont = '11px monospace';
      const panelRight = W - 20;
      const panelTop = 14;
      const lines = Array.isArray(rewardToast.lines) ? rewardToast.lines : [];

      ctx.textAlign = 'right';
      ctx.font = itemFont;
      let maxTextWidth = 0;
      for (let i = 0; i < lines.length; i++) {
        maxTextWidth = Math.max(maxTextWidth, ctx.measureText(lines[i]).width);
      }
      ctx.font = titleFont;
      maxTextWidth = Math.max(maxTextWidth, ctx.measureText(rewardToast.title || 'Reward Unlocked').width);

      const panelWidth = Math.ceil(maxTextWidth + panelPaddingX * 2);
      const panelHeight = panelPaddingY * 2 + 16 + Math.max(lines.length, 1) * rowGap;
      const panelLeft = panelRight - panelWidth;

      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(panelLeft, panelTop, panelWidth, panelHeight);
      ctx.strokeStyle = 'rgba(255,215,120,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(panelLeft, panelTop, panelWidth, panelHeight);

      const textX = panelRight - panelPaddingX;
      const titleY = panelTop + panelPaddingY + 10;
      ctx.fillStyle = 'rgba(255,235,170,0.98)';
      ctx.font = titleFont;
      ctx.fillText(rewardToast.title || 'Reward Unlocked', textX, titleY);

      ctx.font = itemFont;
      ctx.fillStyle = 'rgba(230,240,255,0.96)';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], textX, titleY + 18 + i * rowGap);
      }
    } else if (this._showUnlockedDebug) {
      const unlocked = this._getUnlockedSkillLines();
      if (unlocked.length > 0) {
      const panelPaddingX = 12;
      const panelPaddingY = 10;
      const rowGap = 16;
      const titleFont = 'bold 13px monospace';
      const itemFont = '11px monospace';
      const panelRight = W - 20;
      const panelTop = 14;

      ctx.textAlign = 'right';
      ctx.font = itemFont;
      let maxTextWidth = 0;
      for (let i = 0; i < unlocked.length; i++) {
        const skill = unlocked[i];
        const text = `${skill.name} [${skill.inputHint}]`;
        maxTextWidth = Math.max(maxTextWidth, ctx.measureText(text).width);
      }
      ctx.font = titleFont;
      maxTextWidth = Math.max(maxTextWidth, ctx.measureText('UNLOCKED').width);

      const panelWidth = Math.ceil(maxTextWidth + panelPaddingX * 2);
      const panelHeight = panelPaddingY * 2 + 14 + unlocked.length * rowGap;
      const panelLeft = panelRight - panelWidth;

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(panelLeft, panelTop, panelWidth, panelHeight);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(panelLeft, panelTop, panelWidth, panelHeight);

      const textX = panelRight - panelPaddingX;
      const titleY = panelTop + panelPaddingY + 10;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = titleFont;
      ctx.fillText('UNLOCKED', textX, titleY);

      ctx.font = itemFont;
      ctx.fillStyle = 'rgba(210,230,255,0.95)';
      for (let i = 0; i < unlocked.length; i++) {
        const skill = unlocked[i];
        const text = `${skill.name} [${skill.inputHint}]`;
        ctx.fillText(text, textX, titleY + 18 + i * rowGap);
      }
      }
    }

    ctx.textAlign = 'left';

    ctx.restore();
  },
};

const BossRewardTable = {
  boss1: {
    bossId: 'boss1',
    rewardId: 'oxygenUnlock',
    rewardName: 'Oxygen',
    unlockFlag: 'hasOxygen',
    rewardType: 'resource',
    source: 'Boss1',
  },
  boss2: {
    bossId: 'boss2',
    rewardId: 'heatUnlock',
    rewardName: 'Heat Control',
    unlockFlag: 'hasHeat',
    rewardType: 'resource',
    source: 'Boss2',
  },
  boss3: {
    bossId: 'boss3',
    rewardId: 'smokeUnlock',
    rewardName: 'Smoke',
    unlockFlag: 'hasSmoke',
    rewardType: 'resource',
    source: 'Boss3',
  },
  boss4: {
    bossId: 'boss4',
    rewardId: 'oxygenBoostCandidate',
    rewardName: 'Oxygen Boost Candidate',
    unlockFlag: null,
    rewardType: 'candidate',
    source: 'Boss4',
  },
  boss5: {
    bossId: 'boss5',
    rewardId: 'finalPrepCandidate',
    rewardName: 'Final Prep Candidate',
    unlockFlag: null,
    rewardType: 'candidate',
    source: 'Boss5',
  },
};

// ?? GameManager ???????????????????????????????????????
const GameManager = {
  hasDash:        false,
  hasAxeUpgrade:  false,
  hasShield:      false,
  hasOxygen:      false,
  hasHeat:        false,
  hasSmoke:       false,
  deathCount:     0,
  clearedRooms:   [],
  _pendingReset:  false,  // ?뚮젅?댁뼱 ?щ쭩 ???ㅼ쓬 猷⑦봽 ?깆뿉????由ъ뀑
  rewardToast:    null,

  _skillMeta(skillId) {
    if (typeof PlayerSkillMetadata === 'object' && PlayerSkillMetadata)
      return PlayerSkillMetadata[skillId] || null;
    return null;
  },

  _showRewardToast(skillId, fallbackName, fallbackInput) {
    const meta = this._skillMeta(skillId);
    const name = meta && meta.name ? meta.name : fallbackName;
    const inputHint = meta && meta.inputHint ? meta.inputHint : fallbackInput;
    this.rewardToast = {
        title: 'Reward Unlocked',
        lines: [`${name} [${inputHint}]`],
        timer: 3,
      };
    },

    _showDebugToast(text) {
      this.rewardToast = {
        title: 'Debug',
        lines: [text],
        timer: 2,
      };
      console.log('[DEBUG]', text);
    },

  updateRewardToast(dt) {
    if (!this.rewardToast) return;
    this.rewardToast.timer -= dt;
    if (this.rewardToast.timer <= 0) this.rewardToast = null;
  },

  applyBossReward(bossId) {
    if (typeof BossRewardTable !== 'object' || !BossRewardTable) return;
    const reward = BossRewardTable[bossId];
    if (!reward || !reward.unlockFlag) return;

    switch (reward.unlockFlag) {
      case 'hasOxygen':
        this.unlockOxygen();
        this._showRewardToast('oxygenUnlock', 'Oxygen', 'Passive');
        return;
      case 'hasHeat':
        this.unlockHeat();
        this._showRewardToast('heatUnlock', 'Heat', 'Passive');
        return;
      case 'hasSmoke':
        this.unlockSmoke();
        this._showRewardToast('smokeUnlock', 'Smoke', 'Passive');
        return;
      default:
        this[reward.unlockFlag] = true;
        return;
    }
  },

  unlockOxygen() {
    if (this.hasOxygen) return;
    this.hasOxygen = true;
    if (GameState && GameState.player) GameState.player.oxygenSys.setEnabled(true);
    // Boss1 reward compatibility: Oxygen unlock also grants Dash.
    this.unlockDash();
  },

  unlockHeat() {
      if (this.hasHeat) return;
      this.hasHeat = true;
      if (GameState && GameState.player) GameState.player.heatSys.setCombatUnlocked(true);
      // Temporary compatibility: keep the current Boss2 reward effect alive
      // until Heat-backed progression replaces the axe upgrade path.
      this.unlockAxeUpgrade();
    },

  unlockSmoke() {
    if (this.hasSmoke) return;
    this.hasSmoke = true;
    if (GameState && GameState.player) GameState.player.smokeSys.setEnabled(true);
    // Temporary compatibility: keep the current Boss3 reward effect alive
    // until Smoke-backed progression replaces the shield unlock path.
    this.unlockShield();
  },

  unlockDash() {
    if (this.hasDash) return;
    this.hasDash = true;
    if (GameState && GameState.player) GameState.player.dashUnlocked = true;
  },
  unlockAxeUpgrade() {
    if (this.hasAxeUpgrade) return;
    this.hasAxeUpgrade = true;
    if (GameState && GameState.player) GameState.player.axeSys.upgrade();
  },
  unlockShield() {
    if (this.hasShield) return;
    this.hasShield = true;
    if (GameState && GameState.player) GameState.player.oxygenSys.shieldUnlocked = true;
  },
  applyUnlocks(player) {
      player.oxygenSys.setEnabled(this.hasOxygen);
      player.heatSys.setEnabled(true);
      player.heatSys.setCombatUnlocked(this.hasHeat);
      player.smokeSys.setEnabled(this.hasSmoke);
      if (this.hasOxygen)     this.unlockDash(); // Temporary compatibility
      if (this.hasHeat)       this.unlockAxeUpgrade(); // Temporary compatibility
      if (this.hasSmoke)      this.unlockShield(); // Temporary compatibility
      if (this.hasDash)       player.dashUnlocked = true;
    if (this.hasAxeUpgrade) player.axeSys.upgrade();
    if (this.hasShield)     player.oxygenSys.shieldUnlocked = true;
  },
  onPlayerDeath() {
    this.deathCount++;
    this._pendingReset = true;  // ?꾩옱 update() ?ㅽ깮 ?꾨즺 ??猷⑦봽?먯꽌 泥섎━
  },
  onRoomCleared(room) {
    if (!this.clearedRooms.includes(room.id))
      this.clearedRooms.push(room.id);
  },
};

// ?? GameState ?????????????????????????????????????????
let GameState = null;

class SceneState {
  constructor(rooms) {
    this.rooms            = rooms;
    this.roomIndex        = 0;
    this.player           = null;
    this.transitioning    = false;
    this._transitionTimer = 0;    // 諛??꾪솚 ?섏씠????대㉧ (珥?
    this._bossHudActive   = false; // ?꾩옱 蹂댁뒪 HUD媛 ?쒖떆 以묒씤吏

    this._initRooms();
    this._initPlayer();
  }

  get currentRoom() { return this.rooms[this.roomIndex]; }

  _initRooms() {
    for (let i = 0; i < this.rooms.length - 1; i++) {
      this.rooms[i].nextRoom   = this.rooms[i + 1];
      this.rooms[i + 1].prevRoom = this.rooms[i];
    }

    // 肄쒕갚 二쇱엯: world.js??Game/GameManager瑜?吏곸젒 紐⑤쫫
    for (const r of this.rooms) {
      r.onCleared = (room) => GameManager.onRoomCleared(room);
    }

    // 諛?1: Ember횞2 + Golem횞1  (x쨌1.5)
    const r1 = this.rooms[0];
    [new Ember(600, FLOOR_Y), new Ember(1350, FLOOR_Y), new Golem(1950, FLOOR_Y)]
      .forEach(e => r1.addEntity(e));

    // 諛?2: Boss1  (x쨌1.5)
    const r2 = this.rooms[1];
    r2.addEntity(new Boss1(2100, FLOOR_Y, {
      onDie: () => GameManager.applyBossReward('boss1'),
    }));

    // 諛?3: MirrorShard횞2 + GolemAxe횞1  (x쨌1.5)
    const r3 = this.rooms[2];
    [new MirrorShard(750, FLOOR_Y), new MirrorShard(1650, FLOOR_Y), new GolemAxe(2250, FLOOR_Y)]
      .forEach(e => r3.addEntity(e));

    // 諛?4: BossFinal  (x쨌1.5)
    const r4 = this.rooms[3];
    r4.addEntity(new Boss2(2100, FLOOR_Y, {
      onDie: () => GameManager.applyBossReward('boss2'),
    }));

    const r5 = this.rooms[4];
    [new Ember(620, FLOOR_Y), new MirrorShard(1180, FLOOR_Y), new Golem(1760, FLOOR_Y), new Ember(2320, FLOOR_Y)]
      .forEach(e => r5.addEntity(e));

    const r6 = this.rooms[5];
    r6.addEntity(new Boss3(2100, FLOOR_Y, {
      onDie: () => GameManager.applyBossReward('boss3'),
    }));

    const r7 = this.rooms[6];
    [new Golem(820, FLOOR_Y), new Ember(1440, FLOOR_Y), new MirrorShard(2280, FLOOR_Y)]
      .forEach(e => r7.addEntity(e));

    const r8 = this.rooms[7];
    r8.addEntity(new Boss4(2100, FLOOR_Y, {
      onDie: () => GameManager.applyBossReward('boss4'),
    }));

    const r9 = this.rooms[8];
    [new Ember(720, FLOOR_Y), new Ember(1320, FLOOR_Y), new MirrorShard(1840, FLOOR_Y), new GolemAxe(2360, FLOOR_Y)]
      .forEach(e => r9.addEntity(e));

    const r10 = this.rooms[9];
    r10.addEntity(new Boss5(2100, FLOOR_Y, {
      onDie: () => GameManager.applyBossReward('boss5'),
    }));

    const r11 = this.rooms[10];
    r11.addEntity(new BossFinal(2100, FLOOR_Y, {
      onDie: () => { Game._endingTimer = 2.0; },
    }));
  }

  _initPlayer() {
    const r = this.currentRoom;
    this.player = new Player(r.spawnX, r.spawnY);
    GameManager.applyUnlocks(this.player);
    this.player.onDeath = () => GameManager.onPlayerDeath();
  }

  // ?? 諛??꾪솚 泥댄겕 ?????????????????????????????????
  _checkTransition() {
    if (this.transitioning) return;
    const p = this.player, r = this.currentRoom;

    if (r.cleared && p.x >= ROOM_W - TILE * 2 && this.roomIndex < this.rooms.length - 1) {
      this._goToRoom(this.roomIndex + 1, 'right');
    } else if (p.x <= TILE * 2 && this.roomIndex > 0) {
      this._goToRoom(this.roomIndex - 1, 'left');
    }
  }

  _goToRoom(idx, from) {
    this.transitioning    = true;
    this._transitionTimer = 0.2;  // 200ms ?섏씠?? 釉뚮씪?곗? ??대㉧ ???寃뚯엫 猷⑦봽?먯꽌 泥섎━
    this.roomIndex = idx;
    const r = this.currentRoom;

    if (from === 'right') {
      this.player.x = r.spawnX;
      this.player.y = r.spawnY;
    } else {
      this.player.x = ROOM_W - TILE * 3;
      this.player.y = FLOOR_Y;
    }
    Projectiles.clear();
    this.player.onRoomTransition();  // ?쒕툕?쒖뒪???쇨큵 ?뺣━
    HUD.hideBoss();
    this._bossHudActive = false;
    Camera.snap(this.player.x, this.player.y);
  }

  // ?? 諛??꾪솚 ??대㉧ 媛먯궛 (?꾨젅?꾨떦 1?? ?????????????
  tickTransition(dt) {
    if (!this.transitioning) return;
    this._transitionTimer -= dt;
    if (this._transitionTimer <= 0) {
      this._transitionTimer = 0;
      this.transitioning = false;
    }
  }

  // ?? 蹂댁뒪 HUD ?숆린??(pull-based, ?꾨젅?꾨떦 1?? ???????
  _syncBossHUD() {
    const room = this.currentRoom;
    if (!room.isBoss) {
      if (this._bossHudActive) { HUD.hideBoss(); this._bossHudActive = false; }
      return;
    }
    const boss = room.entities[0];
    if (!boss) return;
    if (boss._fighting && !boss.isDead) {
      if (!this._bossHudActive) { HUD.showBoss(boss.displayName, boss.maxHp); this._bossHudActive = true; }
      HUD.updateBossHp(boss.hp);
    } else if (boss.isDead && this._bossHudActive) {
      HUD.hideBoss();
      this._bossHudActive = false;
    }
  }

  // ?? ?낅젰 泥섎━ (?꾨젅?꾨떦 1?? 臾쇰━ 猷⑦봽 諛뽰뿉???몄텧) ??
  processInput() {
      if (this.transitioning || !this.player || this.player.isDead) return;
      if (DEBUG_MODE) {
        if (Input.isJust('F1')) {
          GameManager.unlockOxygen();
          GameManager._showDebugToast('Oxygen unlocked');
        }
        if (Input.isJust('F2')) {
          GameManager.unlockHeat();
          GameManager._showDebugToast('Heat combat unlocked');
        }
        if (Input.isJust('F3')) {
          GameManager.unlockSmoke();
          GameManager._showDebugToast('Smoke unlocked');
        }
        if (Input.isJust('F4')) {
          this.player.oxygenSys.addStack(this.player.oxygenSys.MAX_STACKS);
          GameManager._showDebugToast('Oxygen refilled');
        }
        if (Input.isJust('F8')) {
          this.player.heatSys.addHeat(this.player.heatSys.maxValue);
          GameManager._showDebugToast('Heat refilled');
        }
        if (Input.isJust('F6')) {
          this.player.heal(this.player.MAX_HP);
          GameManager._showDebugToast('HP restored');
        }
        if (Input.isJust('F7')) {
          this.player.activateTemporaryWaterForm(5);
          GameManager._showDebugToast('Temporary WATER form activated (5s)');
        }
      }
      this.player.processInput(this.currentRoom.entities);
    }

  // ?? 臾쇰━ ?ㅽ뀦 (?꾩궛湲??ㅽ뀦 ?섎쭔??諛섎났 ?몄텧) ?????????
  update() {
    if (this.transitioning || !this.player || this.player.isDead) return;
    const r  = this.currentRoom;
    const tiles = r.allTiles();
    const entities = r.entities;

    this.player.physicsUpdate(DT, tiles, entities);

    r.update(this.player);
    Projectiles.update(tiles, entities, this.player);

    this._checkTransition();
    Camera.follow(this.player.x, this.player.y);
    updateDmgNumbers();
    updateVfx();
    this._syncBossHUD();
  }

  // ?? 洹몃━湲????????????????????????????????????????
  draw(ctx) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 960, 576);

    this.currentRoom.draw(ctx);
    Projectiles.draw(ctx);
    if (this.player) this.player.draw(ctx);
    drawVfx(ctx);
    drawDmgNumbers(ctx);

    if (this.transitioning) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, 960, 576);
    }

    if (this.player) HUD.draw(ctx, this.player);

    // 諛?踰덊샇
    ctx.save();
    ctx.resetTransform();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px monospace';
    const cl = this.currentRoom.cleared ? ' [CLEARED]' : '';
    ctx.fillText(`ROOM ${this.roomIndex + 1} / ${this.rooms.length}${cl}   DEATH ${GameManager.deathCount}`, 16, 576 - 8);
    ctx.restore();
  }
}

// ?? Room?먯꽌 ?몄텧?섎뒗 Game 李몄“ (world.js蹂대떎 ??濡쒕뱶) ??
// world.js??Room._clear()?먯꽌 Game.onRoomCleared(this) ?몄텧
const Game = {
  canvas:   null,
  ctx:      null,
  _last:    0,
  _running: false,
  _state:   'intro',   // 'intro' | 'playing' | 'ending'
  _endingTimer: 0,       // BossFinal ?щ쭩 ???붾뵫源뚯????⑥? ?쒓컙(珥?

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    Input.init(this.canvas);

    document.getElementById('overlay-btn').addEventListener('click', () => {
      if (this._state === 'intro') {
        this.hideOverlay();
        this.startScene();
        return;
      }
      this.hideOverlay();
      if (this._state === 'ending') this.resetFull();
    });

    this.showIntroOverlay();
  },

  startScene() {
    const rooms = buildRoomSequence();
    GameState = new SceneState(rooms);
    Camera.rw  = ROOM_W;
    Camera.rh  = ROOM_H;
    Camera.snap(GameState.player.x, GameState.player.y);
    this._state   = 'playing';
    this._running = true;
    this._last    = performance.now();
    requestAnimationFrame(t => this._loop(t));
  },

  resetScene() {
    if (!this._running) return;
    // ?닿툑 ?곹깭???좎?, ?대━??湲곕줉? 珥덇린??(??由щ줈?쒖? ?숈씪)
    GameManager.clearedRooms = [];
    Projectiles.clear();
    DmgNumbers.length = 0;
    Vfx.length = 0;
    HUD.hideBoss();

    const rooms = buildRoomSequence();
    GameState = new SceneState(rooms);
    Camera.snap(GameState.player.x, GameState.player.y);
    this._state = 'playing';
  },

  resetFull() {
    GameManager.hasDash       = false;
    GameManager.hasAxeUpgrade = false;
    GameManager.hasShield     = false;
    GameManager.hasOxygen     = false;
    GameManager.hasHeat       = false;
    GameManager.hasSmoke      = false;
    GameManager.deathCount    = 0;
    GameManager.clearedRooms  = [];
    GameManager.rewardToast   = null;
    this.resetScene();
  },

  showEnding() {
    this._state = 'ending';
    this.showOverlay('Inhwa\n\nYou faced every broken self.\nDeaths: ' + GameManager.deathCount, 'Restart');
  },


  onRoomCleared(room) { GameManager.onRoomCleared(room); },  // room.onCleared 肄쒕갚?먯꽌 ?몄텧

  showIntroOverlay() {
    const overlay = document.getElementById('overlay');
    overlay.classList.add('intro-mode');
    this.showOverlay('', 'Start');
  },

  showOverlay(text, btn) {
    const overlay = document.getElementById('overlay');
    document.getElementById('overlay-text').textContent = text;
    document.getElementById('overlay-btn').textContent  = btn;
    overlay.classList.remove('hidden');
    if (text) overlay.classList.remove('intro-mode');
  },
  hideOverlay() {
    const overlay = document.getElementById('overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('intro-mode');
  },

  _loop(t) {
    if (!this._running) return;
    const dt = Math.min((t - this._last) / 1000, 0.1);
    this._last = t;
    GameManager.updateRewardToast(dt);

    if (GameState) GameState.tickTransition(dt);

    // ?낅젰: ?꾨젅?꾨떦 1??(臾쇰━ 猷⑦봽 ?꾩뿉 泥섎━)
    if (GameState && this._state === 'playing') GameState.processInput();
    Input.flush();

    // 臾쇰━ ?ㅽ뀦 (怨좎젙 1/60s, steps >= 2?щ룄 ?낅젰? ?꾩뿉???대? 泥섎━??
    PhysicsAccum.update(dt);
    for (let i = 0; i < PhysicsAccum.steps; i++) {
      if (GameState && this._state === 'playing') GameState.update();
    }

    // ?뚮젅?댁뼱 ?щ쭩 由ъ뀑 (臾쇰━ 猷⑦봽 ?꾨즺 ??泥섎━???ㅽ깮 ?덉쟾 蹂댁옣)
    if (GameManager._pendingReset) {
      GameManager._pendingReset = false;
      this.resetScene();
    }

    // ?붾뵫 移댁슫?몃떎??(BossFinal ?щ쭩 肄쒕갚?먯꽌 _endingTimer ?ㅼ젙)
    if (this._endingTimer > 0) {
      this._endingTimer -= dt;
      if (this._endingTimer <= 0) {
        this._endingTimer = 0;
        this.showEnding();
      }
    }

    // ?뚮뜑
    if (GameState) GameState.draw(this.ctx);

    requestAnimationFrame(t2 => this._loop(t2));
  },
};

// ?? ?뷀듃由ы룷?명듃 ?????????????????????????????????????
window.addEventListener('DOMContentLoaded', () => Game.init());




