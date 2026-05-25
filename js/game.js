'use strict';
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??// game.js  ?? GameManager, HUD, ??愿由? 硫붿씤 猷⑦봽
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
// ?? HUD ???????????????????????????????????????????????
const DEBUG_MODE = false; // Set to true for local debug/test builds.
window.NAEHWA_DEBUG_MODE = DEBUG_MODE;
const HUD_PANEL_HEIGHT = 96;
const GAMEPLAY_HEIGHT = 576 - HUD_PANEL_HEIGHT;
const WORLD_RENDER_SCALE = 0.88;

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

  _getPhaseThresholdRatios(player) {
    if (player && typeof player.getPhaseThresholdRatios === 'function')
      return player.getPhaseThresholdRatios();
    return [0.3, 0.6];
  },

  _drawPlayerHpBar(ctx, player) {
    const s = Camera.toScreen(player.x, player.y - player.height - 16);
    const barW = 56;
    const barH = 6;
    const x = Math.round(s.x - barW / 2);
    const y = Math.min(Math.round(s.y), GAMEPLAY_HEIGHT - 14);
    const ratio = clamp(player.hp / player.MAX_HP, 0, 1);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#11161f';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = this._phaseBarColors[player.phase] || '#50d070';
    ctx.fillRect(x, y, Math.round(barW * ratio), barH);

    const thresholds = this._getPhaseThresholdRatios(player);
    ctx.strokeStyle = 'rgba(215, 232, 255, 0.72)';
    ctx.lineWidth = 1;
    for (const threshold of thresholds) {
      const tx = Math.round(x + barW * threshold) + 0.5;
      ctx.beginPath();
      ctx.moveTo(tx, y - 1);
      ctx.lineTo(tx, y + barH + 1);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeRect(x + 0.5, y + 0.5, barW - 1, barH - 1);
  },

  _drawCompactStatus(ctx, player, W) {
    const form = player.getCurrentCombatForm();
    const formLabel = form === TEMP_COMBAT_FORM.WATER
      ? 'WATER'
      : (this._phaseLabels[form] || this._phaseLabels[player.phase] || 'NORMAL');
    const panelX = 14;
    const panelY = 14;
    const panelW = 204;
    const panelH = 74;
    const heatRatio = player.heatSys && player.heatSys.maxValue > 0
      ? clamp(player.heatSys.value / player.heatSys.maxValue, 0, 1)
      : 0;
    const smokeEnabled = GameManager.hasSmoke || (player.smokeSys && player.smokeSys.enabled);
    const smokeRatio = smokeEnabled && player.smokeSys.maxValue > 0
      ? clamp(player.smokeSys.value / player.smokeSys.maxValue, 0, 1)
      : 0;

    ctx.fillStyle = 'rgba(7, 10, 18, 0.62)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = 'rgba(120, 144, 190, 0.28)';
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#d8e4ff';
    ctx.fillText(`FORM ${formLabel}`, panelX + 10, panelY + 16);
    ctx.fillStyle = player.axeSys.hasAxe ? '#dcb16d' : '#768193';
    ctx.fillText(`AXE ${player.axeSys.hasAxe ? 'READY' : 'LOST'}`, panelX + 118, panelY + 16);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#ffca92';
    ctx.fillText(`HEAT ${Math.round(player.heatSys.value)} / ${Math.round(player.heatSys.maxValue)}`, panelX + 10, panelY + 34);
    ctx.fillStyle = '#111';
    ctx.fillRect(panelX + 10, panelY + 40, panelW - 20, 8);
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(panelX + 10, panelY + 40, Math.round((panelW - 20) * heatRatio), 8);
    ctx.strokeStyle = 'rgba(255, 167, 82, 0.45)';
    ctx.strokeRect(panelX + 10.5, panelY + 40.5, panelW - 21, 7);

    ctx.fillStyle = '#c7cad8';
    const smokeLabel = smokeEnabled
      ? `SMOKE ${Math.round(player.smokeSys.value)} / ${Math.round(player.smokeSys.maxValue)}`
      : 'SMOKE LOCKED';
    ctx.fillText(smokeLabel, panelX + 10, panelY + 58);
    ctx.fillStyle = '#111';
    ctx.fillRect(panelX + 10, panelY + 64, panelW - 20, 6);
    ctx.fillStyle = smokeEnabled ? '#8a90b8' : '#2a3040';
    ctx.fillRect(panelX + 10, panelY + 64, Math.round((panelW - 20) * smokeRatio), 6);
    ctx.strokeStyle = 'rgba(169, 177, 208, 0.32)';
    ctx.strokeRect(panelX + 10.5, panelY + 64.5, panelW - 21, 5);
  },

  _drawOxygenPips(ctx, player, x, y) {
    for (let i = 0; i < player.oxygenSys.MAX_STACKS; i++) {
      const cx = x + i * 20;
      ctx.beginPath();
      ctx.arc(cx, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < player.oxygenSys.stacks ? '#20d8ff' : '#1a2433';
      ctx.fill();
      ctx.strokeStyle = i < player.oxygenSys.stacks ? '#8cefff' : '#41546d';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },

  _getSkillCostLabel(player, slotId) {
    switch (slotId) {
      case 'dash': return 'NO COST';
      case 'channel': return `HEAT ${player.oxygenSys.getHeatToOxygenConversionCost()}`;
      case 'burst': return `O2 ${player.oxygenSys.BURST_OXYGEN_COST}`;
      case 'heatMode': return 'HEAT/s';
      case 'smoke': return `SMOKE ${player.smokeSys.SMOKE_RELEASE_COST}`;
      case 'heal': return `O2 ${player.SKILL3_OXYGEN_COST}`;
      default: return '';
    }
  },

  _getSkillSlotState(player, slotId) {
    switch (slotId) {
      case 'dash': {
        if (!player.dashUnlocked) return { label: 'LOCKED', accent: '#687589', ratio: 0 };
        const cdRatio = clamp(player.dashSys.getCdRatio(), 0, 1);
        if (player.dashSys.isDashing()) return { label: 'ACTIVE', accent: '#76dcff', ratio: 1 };
        if (cdRatio > 0) {
          const remain = Math.max((player.dashSys._cdTimer || 0), 0);
          return { label: `${remain.toFixed(1)}s`, accent: '#5a8fb5', ratio: 1 - cdRatio };
        }
        return { label: 'READY', accent: '#76dcff', ratio: 1 };
      }
      case 'channel': {
        if (!player.oxygenSys.enabled) return { label: 'LOCKED', accent: '#687589', ratio: 0 };
        if (player.oxygenSys.isChanneling()) {
          return {
            label: `${Math.round(player.oxygenSys.getChannelRatio() * 100)}%`,
            accent: '#20e8ff',
            ratio: player.oxygenSys.getChannelRatio(),
          };
        }
        return { label: 'HOLD', accent: '#58b9d2', ratio: 1 };
      }
      case 'burst': {
        if (!player.oxygenSys.enabled) return { label: 'LOCKED', accent: '#687589', ratio: 0 };
        if (player.oxygenSys.isBursting()) return { label: 'ACTIVE', accent: '#7de8ff', ratio: 1 };
        if (player.oxygenSys.stacks < player.oxygenSys.BURST_OXYGEN_COST) return { label: 'O2 LOW', accent: '#6e8698', ratio: 0.2 };
        return { label: 'READY', accent: '#88f0ff', ratio: 1 };
      }
      case 'heatMode': {
        if (!player.heatSys.combatUnlocked) return { label: 'LOCKED', accent: '#687589', ratio: 0 };
        if (player.heatSys.isFormHeatModeActive()) return { label: 'MODE ON', accent: '#ffb168', ratio: 1 };
        if (player.heatSys.value <= 0) return { label: 'HEAT LOW', accent: '#7f6d60', ratio: 0.12 };
        return { label: 'MODE OFF', accent: '#cf9156', ratio: clamp(player.heatSys.value / Math.max(player.heatSys.maxValue, 1), 0, 1) };
      }
      case 'smoke': {
        if (!player.smokeSys.enabled) return { label: 'LOCKED', accent: '#687589', ratio: 0 };
        const status = player.getSmokeReleaseStatus();
        const cdRatio = clamp(1 - player.smokeSys.getReleaseCdRatio(), 0, 1);
        if (status === 'READY') return { label: status, accent: '#dfe9ff', ratio: 1 };
        if (status === 'SMOKE LOW') return { label: status, accent: '#7f8ea0', ratio: clamp(player.smokeSys.value / Math.max(player.smokeSys.SMOKE_RELEASE_COST, 1), 0, 1) };
        return { label: status, accent: '#9ab4ca', ratio: cdRatio };
      }
      case 'heal': {
        if (!player.oxygenSys.enabled) return { label: 'LOCKED', accent: '#687589', ratio: 0 };
        if (player._skill3Cooldown > 0) {
          const duration = Math.max(player.getSkill3CooldownDuration(), 0.01);
          return {
            label: `${player._skill3Cooldown.toFixed(1)}s`,
            accent: '#78a7c7',
            ratio: 1 - clamp(player._skill3Cooldown / duration, 0, 1),
          };
        }
        if (player.hp >= player.MAX_HP) return { label: 'HP MAX', accent: '#9ebfd6', ratio: 1 };
        if (player.oxygenSys.stacks < player.SKILL3_OXYGEN_COST) return { label: 'O2 LOW', accent: '#6e8698', ratio: 0.2 };
        return { label: 'READY', accent: '#7ce8ff', ratio: 1 };
      }
      default:
        return { label: 'READY', accent: '#ffffff', ratio: 1 };
    }
  },

  _drawSkillSlot(ctx, slot, x, y, w, h) {
    const fillRatio = clamp(slot.state.ratio ?? 0, 0, 1);
    ctx.fillStyle = 'rgba(6, 10, 18, 0.86)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = slot.state.accent;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(x, y + h * (1 - fillRatio), w, h * fillRatio);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(164, 188, 222, 0.28)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#d6e2ff';
    ctx.fillText(slot.key, x + 8, y + 14);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#a8b7cf';
    ctx.fillText(slot.label, x + 8, y + 28);
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = slot.state.accent;
    ctx.fillText(slot.state.label, x + 8, y + 40);
    ctx.font = '9px monospace';
    ctx.fillStyle = '#8ea4bd';
    ctx.fillText(slot.cost, x + 8, y + h - 7);
  },

  _drawBottomSkillBar(ctx, player, W, gameplayHeight, panelHeight) {
    const slots = [
      { id: 'dash', key: 'SHIFT', label: 'DASH' },
      { id: 'channel', key: 'Q', label: 'CHANNEL' },
      { id: 'burst', key: 'W', label: 'BURST' },
      { id: 'heatMode', key: '1', label: 'HEAT MODE' },
      { id: 'smoke', key: '2', label: 'SMOKE' },
      { id: 'heal', key: '3', label: 'HEAL' },
    ].map(slot => ({
      ...slot,
      state: this._getSkillSlotState(player, slot.id),
      cost: this._getSkillCostLabel(player, slot.id),
    }));

    const slotW = 74;
    const slotH = 54;
    const gap = 8;
    const totalW = slotW * slots.length + gap * (slots.length - 1);
    const oxygenAreaW = 128;
    const groupGap = 18;
    const contentW = oxygenAreaW + groupGap + totalW;
    const contentX = Math.round((W - contentW) / 2);
    const panelX = contentX + oxygenAreaW + groupGap;
    const panelY = gameplayHeight + Math.round((panelHeight - slotH) / 2);

    ctx.fillStyle = 'rgba(5, 8, 15, 0.9)';
    ctx.fillRect(0, gameplayHeight, W, panelHeight);
    ctx.strokeStyle = 'rgba(120, 144, 190, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, gameplayHeight + 0.5);
    ctx.lineTo(W, gameplayHeight + 0.5);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(contentX - 14, panelY - 8, contentW + 28, slotH + 16);
    ctx.strokeStyle = 'rgba(120, 144, 190, 0.16)';
    ctx.strokeRect(contentX - 13.5, panelY - 7.5, contentW + 27, slotH + 15);

    const oxygenX = contentX + 38;
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#9bbfe4';
    ctx.fillText('O2', contentX + 4, panelY + 23);
    this._drawOxygenPips(ctx, player, oxygenX, panelY + 20);

    for (let i = 0; i < slots.length; i++) {
      this._drawSkillSlot(ctx, slots[i], panelX + i * (slotW + gap), panelY, slotW, slotH);
    }
  },
  
  draw(ctx, player) {
    const W = 960, H = 576;
    ctx.save();
    ctx.resetTransform();
    this._drawPlayerHpBar(ctx, player);
    this._drawCompactStatus(ctx, player, W);
    this._drawBottomSkillBar(ctx, player, W, GAMEPLAY_HEIGHT, HUD_PANEL_HEIGHT);

      // ?? 蹂댁뒪 HP 諛??????????????????????????????????
      if (this._bossVisible) {
      const bw = 500, bh = 18;
        const bx = (W - bw) / 2, by = GAMEPLAY_HEIGHT - 30;
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

const RecoverySystem = {
  MAX_LEVEL: 5,

  getRecoveryLevel(deathCount = 0) {
    return Math.max(0, Math.min(Math.floor(deathCount || 0), this.MAX_LEVEL));
  },

  getRecoveryConfig(level = 0) {
      const clampedLevel = this.getRecoveryLevel(level);
      const maxHpBonusByLevel = [0, 100, 200, 275, 350, 425];
      return {
        level: clampedLevel,
      maxHpBonus: maxHpBonusByLevel[clampedLevel] ?? 0,
        startHeat: 0,
        startOxygen: 0,
        qHeatCost: 20,
      skill3Cooldown: 8,
      waterDuration: 5,
      waterSmokeReductionPerSecond: 8,
      heatMaxValue: 150,
    };
  },

  applyRecoveryModifiers(player, level = 0) {
    if (!player) return null;
    const config = this.getRecoveryConfig(level);
    player.setRecoveryConfig(config);
    player.hp = player.MAX_HP;
    player._checkPhase?.();

    return config;
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
  recoveryLevel:  0,
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
  getRecoveryLevel() {
    this.recoveryLevel = RecoverySystem.getRecoveryLevel(this.deathCount);
    return this.recoveryLevel;
  },
  getRecoveryConfig(level = this.getRecoveryLevel()) {
    return RecoverySystem.getRecoveryConfig(level);
  },
  applyRecoveryModifiers(player) {
    return RecoverySystem.applyRecoveryModifiers(player, this.getRecoveryLevel());
  },
  applyUnlocks(player) {
      player.setRecoveryConfig(this.getRecoveryConfig());
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
    this.applyRecoveryModifiers(player);
  },
  onPlayerDeath() {
    this.deathCount++;
    this.recoveryLevel = this.getRecoveryLevel();
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

    // 諛?1: Ember + MirrorShard + Ember + Golem  (x쨌1.5)
    const r1 = this.rooms[0];
    [new Ember(560, FLOOR_Y), new MirrorShard(1080, FLOOR_Y), new Ember(1560, FLOOR_Y), new Golem(2140, FLOOR_Y)]
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
    const bossFightLocked = typeof r.isBossFightLocked === 'function'
      ? r.isBossFightLocked()
      : (r.isBoss && r.fightStarted && !r.cleared);

    if (r.cleared && p.x >= ROOM_W - TILE * 2 && this.roomIndex < this.rooms.length - 1) {
      this._goToRoom(this.roomIndex + 1, 'right');
    } else if (!bossFightLocked && p.x <= TILE * 2 && this.roomIndex > 0) {
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

  // Test-only debug helpers for fast boss verification.
  _debugGoToRoom(idx, from = 'right') {
    const clamped = clamp(idx, 0, this.rooms.length - 1) | 0;
    if (clamped === this.roomIndex) {
      this.player.x = this.currentRoom.spawnX;
      this.player.y = this.currentRoom.spawnY;
      this.player.onRoomTransition();
      Projectiles.clear();
      Camera.snap(this.player.x, this.player.y);
      return;
    }
    this._goToRoom(clamped, from);
  }

  // Test-only debug helper: makes the current boss one hit from death.
  _debugSetCurrentBossHpToOne() {
    const room = this.currentRoom;
    if (!room || !room.isBoss) return false;
    const boss = room.entities[0];
    if (!boss || boss.isDead) return false;
    boss.hp = Math.min(boss.hp, 1);
    this._syncBossHUD();
    return true;
  }

  // Test-only debug helper: unlocks every boss reward path for fast validation.
  _debugUnlockAllBossRewards() {
    GameManager.unlockOxygen();
    GameManager.unlockHeat();
    GameManager.unlockSmoke();
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
          const waterDuration = this.player.getTemporaryWaterFormDuration();
          this.player.activateTemporaryWaterForm(waterDuration);
          GameManager._showDebugToast(`Temporary WATER form activated (${waterDuration}s)`);
        }
        // Test-only debug shortcuts for rapid boss verification.
        if (Input.isJust('F9')) {
          this._debugGoToRoom(this.roomIndex + 1, 'right');
          GameManager._showDebugToast(`Moved to room ${this.roomIndex + 1}`);
          return;
        }
        if (Input.isJust('F10')) {
          if (this._debugSetCurrentBossHpToOne()) {
            GameManager._showDebugToast('Current boss HP set to 1');
          } else {
            GameManager._showDebugToast('No living boss in this room');
          }
          return;
        }
        if (Input.isJust('F11')) {
          this._debugUnlockAllBossRewards();
          GameManager._showDebugToast('All boss rewards unlocked');
          return;
        }
        if (Input.isJust('F12')) {
          this._debugGoToRoom(this.rooms.length - 1, 'right');
          GameManager._showDebugToast('Moved to Final Boss room');
          return;
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

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 960, GAMEPLAY_HEIGHT);
    ctx.clip();

    this.currentRoom.draw(ctx);
    Projectiles.draw(ctx);
    if (this.player) this.player.draw(ctx);
    drawVfx(ctx);
    drawDmgNumbers(ctx);

    if (this.transitioning) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, 960, GAMEPLAY_HEIGHT);
    }
    ctx.restore();

    if (this.player) HUD.draw(ctx, this.player);

    // 諛?踰덊샇
    ctx.save();
    ctx.resetTransform();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px monospace';
    const cl = this.currentRoom.cleared ? ' [CLEARED]' : '';
    ctx.fillText(`ROOM ${this.roomIndex + 1} / ${this.rooms.length}${cl}   DEATH ${GameManager.deathCount}`, 16, GAMEPLAY_HEIGHT + HUD_PANEL_HEIGHT - 10);
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
  _state:   'intro',   // 'intro' | 'playing' | 'gameover' | 'clear'
  _endingTimer: 0,       // BossFinal ?щ쭩 ???붾뵫源뚯????⑥? ?쒓컙(珥?

  _configureViewport() {
    Camera.scale = WORLD_RENDER_SCALE;
    Camera.vw = 960 / WORLD_RENDER_SCALE;
    Camera.vh = GAMEPLAY_HEIGHT / WORLD_RENDER_SCALE;
  },

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    Input.init(this.canvas);

    document.getElementById('overlay-btn').addEventListener('click', () => {
      this._confirmOverlayAction();
    });
    window.addEventListener('keydown', (e) => {
      if (this._state === 'playing') return;
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      this._confirmOverlayAction();
    });

    this.showIntroOverlay();
  },

  startScene() {
    const rooms = buildRoomSequence();
    GameState = new SceneState(rooms);
    Camera.rw  = ROOM_W;
    Camera.rh  = ROOM_H;
    this._configureViewport();
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
    this._configureViewport();
    Camera.snap(GameState.player.x, GameState.player.y);
    this._state = 'playing';
    this._endingTimer = 0;
    this.hideOverlay();
  },

  resetFull() {
    GameManager.hasDash       = false;
    GameManager.hasAxeUpgrade = false;
    GameManager.hasShield     = false;
    GameManager.hasOxygen     = false;
    GameManager.hasHeat       = false;
    GameManager.hasSmoke      = false;
    GameManager.deathCount    = 0;
    GameManager.recoveryLevel = 0;
    GameManager.clearedRooms  = [];
    GameManager.rewardToast   = null;
    this.resetScene();
  },

  _formatRecoverySummary(level = GameManager.getRecoveryLevel()) {
    const config = GameManager.getRecoveryConfig(level);
    const lines = [];
    if (config.maxHpBonus > 0) lines.push(`MAX HP +${config.maxHpBonus}`);
    return lines.length > 0 ? lines.join('\n') : 'NO BONUS';
  },

  showGameOver() {
    this._state = 'gameover';
    const deathCount = GameManager.deathCount;
    const recoveryLevel = GameManager.getRecoveryLevel();
    const nextRecovery = this._formatRecoverySummary(recoveryLevel);
    this.showOverlay(
      `DEFEATED\n\nDEATH COUNT  ${deathCount}\nRECOVERY LEVEL  ${recoveryLevel}\n\nNEXT ATTEMPT\n${nextRecovery}\n\nPRESS ENTER OR SPACE`,
      'Retry'
    );
  },

  showClear() {
    this._state = 'clear';
    const deathCount = GameManager.deathCount;
    const recoveryLevel = GameManager.getRecoveryLevel();
    this.showOverlay(
      `CLEAR\n\nTOTAL DEATH COUNT  ${deathCount}\nFINAL RECOVERY LEVEL  ${recoveryLevel}\n\nPRESS ENTER OR SPACE`,
      'Restart'
    );
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

  _confirmOverlayAction() {
    if (this._state === 'intro') {
      this.hideOverlay();
      this.startScene();
      return;
    }
    if (this._state === 'gameover') {
      this.resetScene();
      return;
    }
    if (this._state === 'clear') {
      this.hideOverlay();
      this.resetFull();
    }
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
    if (GameManager._pendingReset && this._state === 'playing') {
      GameManager._pendingReset = false;
      this.showGameOver();
    }

    // ?붾뵫 移댁슫?몃떎??(BossFinal ?щ쭩 肄쒕갚?먯꽌 _endingTimer ?ㅼ젙)
    if (this._endingTimer > 0 && this._state === 'playing') {
      this._endingTimer -= dt;
      if (this._endingTimer <= 0) {
        this._endingTimer = 0;
        this.showClear();
      }
    }

    // ?뚮뜑
    if (GameState) GameState.draw(this.ctx);

    requestAnimationFrame(t2 => this._loop(t2));
  },
};

// ?? ?뷀듃由ы룷?명듃 ?????????????????????????????????????
window.addEventListener('DOMContentLoaded', () => Game.init());




