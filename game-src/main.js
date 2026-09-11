import Phaser from 'phaser';
import { BootScene, FightScene } from './GameScene.js';
import { GAME_HEIGHT, GAME_WIDTH } from './gameData.js';
import { renderSkillCooldown } from './SkillCooldown.js';
import { installTouchGestureGuard } from './TouchGestureGuard.js';

class UIController {
  constructor() {
    this.game = null;
    this.touchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.screens = [...document.querySelectorAll('.screen')];
    this.intro = document.querySelector('#intro-screen');
    this.title = document.querySelector('#title-screen');
    this.select = document.querySelector('#select-screen');
    this.stageCard = document.querySelector('#stage-card');
    this.shop = document.querySelector('#shop-screen');
    this.result = document.querySelector('#result-screen');
    this.pause = document.querySelector('#pause-screen');
    this.dialogue = document.querySelector('#dialogue-overlay');
    this.dialoguePortraitFrame = document.querySelector('.dialogue-portrait-frame');
    this.dialoguePortrait = document.querySelector('#dialogue-portrait');
    this.dialogueSpeaker = document.querySelector('#dialogue-speaker');
    this.dialogueText = document.querySelector('#dialogue-text');
    this.dialogueProgress = document.querySelector('#dialogue-progress');
    this.dialogueNext = document.querySelector('#dialogue-next');
    this.touchControls = document.querySelector('#touch-controls');
    this.skillButton = document.querySelector('#touch-controls [data-action="skill"]');
    this.topActions = document.querySelector('#top-actions');
    this.dialogueLines = [];
    this.dialogueIndex = 0;
    this.dialogueOptions = null;
    this.introTimers = [];
    this.bind();
    this.playIntro();
  }

  bind() {
    this.removeTouchGestureGuard = installTouchGestureGuard(document.querySelector('#game-root'));
    document.querySelector('#skip-intro')?.addEventListener('click', () => this.finishIntro());
    document.querySelector('#start-button')?.addEventListener('click', () => this.showOnly(this.select));
    document.querySelector('.back-title')?.addEventListener('click', () => this.showOnly(this.title));
    document.querySelectorAll('.fighter-card').forEach((card) => card.addEventListener('click', () => this.startRun(card.dataset.fighter)));
    document.querySelector('#pause-button')?.addEventListener('click', () => window.friendFightersPause?.());
    document.querySelector('#resume-button')?.addEventListener('click', () => window.friendFightersResume?.());
    document.querySelector('#retry-button')?.addEventListener('click', () => window.friendFightersRetry?.());
    document.querySelector('#home-button')?.addEventListener('click', () => this.returnHome());
    document.querySelectorAll('[data-item]').forEach((button) => {
      button.addEventListener('click', () => window.friendFightersChooseItem?.(button.dataset.item));
      ['pointerenter', 'pointerdown', 'focus'].forEach((type) => button.addEventListener(type, () => this.pointAtShopItem(button)));
    });
    window.addEventListener('resize', () => {
      if (this.shop.classList.contains('active')) this.pointAtShopItem(this.shop.querySelector('.pointed') || this.shop.querySelector('[data-item]'));
    });
    this.dialogueNext?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.advanceDialogue();
    });
    window.addEventListener('keydown', (event) => {
      if (this.dialogue?.classList.contains('active') && ['Enter', ' ', 'j', 'J'].includes(event.key)) {
        event.preventDefault();
        this.advanceDialogue();
      }
      if (event.key === 'Escape' && document.querySelector('#top-actions')?.classList.contains('visible')) {
        if (this.pause.classList.contains('active')) window.friendFightersResume?.();
        else window.friendFightersPause?.();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.topActions.classList.contains('visible') && !this.dialogue.classList.contains('active')) window.friendFightersPause?.();
    });
    window.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  playIntro() {
    this.showOnly(this.intro);
    requestAnimationFrame(() => this.intro.classList.add('playing'));
    const caption = document.querySelector('#intro-caption');
    const beats = [
      [0, '小马国 · 黄昏'],
      [1700, '一道粉色裂隙撕开了天空'],
      [3500, '草莓熊博士闯入王城'],
      [5350, '小马公主被掳往国轩之窟'],
      [7050, '小宇与阿鼎踏上救援之路'],
    ];
    beats.forEach(([delay, text]) => this.introTimers.push(window.setTimeout(() => { if (caption) caption.textContent = text; }, delay)));
    this.introTimers.push(window.setTimeout(() => this.finishIntro(), 8300));
  }

  finishIntro() {
    this.introTimers.forEach((timer) => window.clearTimeout(timer));
    this.introTimers = [];
    this.intro.classList.remove('playing');
    this.showOnly(this.title);
  }

  showOnly(target) {
    this.screens.forEach((screen) => screen.classList.remove('active'));
    target?.classList.add('active');
  }

  startRun(heroId) {
    this.screens.forEach((screen) => screen.classList.remove('active'));
    this.setGameplayVisible(false);
    const payload = { heroId, mapIndex: 0, carry: {} };
    if (window.friendFightersStart) window.friendFightersStart(payload);
    else window.__friendFightersPendingRun = payload;
  }

  setGame(game) {
    this.game = game;
  }

  setGameplayVisible(visible) {
    this.topActions.classList.toggle('visible', visible);
    this.touchControls.classList.toggle('visible', visible && this.touchDevice);
  }

  setSkillCooldown(remainingMs, totalMs) {
    renderSkillCooldown(this.skillButton, remainingMs, totalMs);
  }

  showStage(index, title, subtitle) {
    const small = this.stageCard.querySelector('small');
    const heading = this.stageCard.querySelector('h2');
    const copy = this.stageCard.querySelector('p');
    small.textContent = `MAP ${String(index).padStart(2, '0')} · PVE`;
    heading.textContent = title;
    copy.textContent = subtitle;
    this.stageCard.classList.remove('show');
    void this.stageCard.offsetWidth;
    this.stageCard.classList.add('show');
    window.setTimeout(() => this.stageCard.classList.remove('show'), 2800);
  }

  showDialogue(lines, options) {
    this.dialogueLines = lines;
    this.dialogueOptions = options;
    this.dialogueIndex = 0;
    this.setGameplayVisible(false);
    this.dialogue.classList.add('active');
    this.dialogue.setAttribute('aria-hidden', 'false');
    this.renderDialogueLine();
  }

  renderDialogueLine() {
    const line = this.dialogueLines[this.dialogueIndex];
    if (!line) return;
    const heroName = this.dialogueOptions.hero.name;
    const speaker = line.speaker.replace('{hero}', heroName);
    this.dialogueSpeaker.textContent = speaker;
    this.dialogueText.textContent = line.text.replace('{hero}', heroName);
    this.dialogueProgress.textContent = `${String(this.dialogueIndex + 1).padStart(2, '0')} / ${String(this.dialogueLines.length).padStart(2, '0')}`;
    const portraits = {
      hero: this.dialogueOptions.hero.portrait,
      princess: './assets/princess.png',
      'boss-c': './assets/portraits/boss-c.png',
      'boss-d': './assets/portraits/boss-d.png',
      merchant: './assets/shop-v1/quan-seated.webp',
    };
    this.dialoguePortrait.src = portraits[line.portrait] || this.dialogueOptions.hero.portrait;
    this.dialoguePortrait.alt = speaker;
    const portraitType = line.portrait === 'hero' ? `hero-${this.dialogueOptions.hero.texture === 'hero-b-actions' ? 'b' : 'a'}` : line.portrait;
    this.dialoguePortrait.className = `dialogue-portrait portrait-${portraitType}`;
    this.dialoguePortraitFrame.classList.toggle('hero', line.portrait === 'hero');
    this.dialoguePortraitFrame.classList.toggle('narrator', speaker === '旁白');
  }

  advanceDialogue() {
    if (!this.dialogue.classList.contains('active')) return;
    this.dialogueIndex += 1;
    if (this.dialogueIndex < this.dialogueLines.length) {
      this.renderDialogueLine();
      return;
    }
    this.dialogue.classList.remove('active');
    this.dialogue.setAttribute('aria-hidden', 'true');
    this.setGameplayVisible(true);
    const complete = this.dialogueOptions?.onComplete;
    this.dialogueOptions = null;
    complete?.();
  }

  showShop() {
    this.setGameplayVisible(false);
    document.querySelectorAll('[data-item]').forEach((button) => { button.disabled = false; button.classList.remove('chosen'); });
    this.showOnly(this.shop);
    this.pointAtShopItem(this.shop.querySelector('[data-item]'));
  }

  pointAtShopItem(button) {
    if (!button || button.disabled) return;
    const hand = this.shop.querySelector('#shop-hand');
    const parent = this.shop.querySelector('.shop-cloth').getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    hand.style.left = `${rect.left - parent.left + rect.width * 0.52}px`;
    hand.style.top = `${rect.top - parent.top + rect.height * 0.38}px`;
    this.shop.querySelectorAll('[data-item]').forEach((item) => item.classList.toggle('pointed', item === button));
  }

  hideShop(item) {
    const chosen = this.shop.querySelector(`[data-item="${item}"]`);
    chosen?.classList.add('chosen');
    document.querySelectorAll('[data-item]').forEach((button) => { button.disabled = true; });
    window.setTimeout(() => {
      this.shop.classList.remove('active');
      this.setGameplayVisible(true);
    }, 330);
  }

  setPaused(paused) {
    this.pause.classList.toggle('active', paused);
    this.setGameplayVisible(!paused);
  }

  showResult(success, title, copy) {
    this.setGameplayVisible(false);
    document.querySelector('#result-kicker').textContent = success ? 'MISSION COMPLETE' : 'MISSION FAILED';
    document.querySelector('#result-title').textContent = title;
    document.querySelector('#result-copy').textContent = copy;
    this.showOnly(this.result);
  }

  hideResults() {
    this.result.classList.remove('active');
    this.setGameplayVisible(false);
  }

  returnHome() {
    this.result.classList.remove('active');
    this.pause.classList.remove('active');
    this.dialogue.classList.remove('active');
    this.setGameplayVisible(false);
    if (this.game) {
      this.game.scene.stop('FightScene');
      this.game.scene.start('BootScene');
    }
    this.showOnly(this.title);
  }
}

const ui = new UIController();
window.friendFightersUI = ui;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#08090d',
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    activePointers: 8,
    touch: { capture: true },
    keyboard: { capture: [65, 68, 87, 74, 75, 76, 27] },
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
      fps: 120,
    },
  },
  fps: {
    target: 60,
    min: 30,
    smoothStep: true,
  },
  scene: [BootScene, FightScene],
};

const game = new Phaser.Game(config);
ui.setGame(game);
