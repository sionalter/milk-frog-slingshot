import './style.css';
import { drawFrog } from './game/art';
import { AudioManager } from './game/audio';
import { Game } from './game/Game';
import { LEVELS } from './game/levels';
import type { BirdType, GameCallbacks, GameResult } from './game/types';
import { clamp, formatScore, starPath, TAU } from './game/utils';

const SAVE_KEY = 'milk-frog-slingshot-save-v1';

interface SaveData {
  best: Record<number, number>;
  stars: Record<number, number>;
  unlocked: number;
  muted: boolean;
}

const SKILL_NAMES: Record<BirdType, string> = {
  cream: '奶力冲刺',
  matcha: '一分为三',
  strawberry: '奶泡爆裂',
};

const STARS_FOR_NOTE: Record<number, string> = {
  3: '完美！奶娃军团凯旋，连弹弓都在发光。',
  2: '漂亮！还有奶娃在弹弓上待命呢。',
  1: '惊险过关！下一关把角度再调稳一点。',
};

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function defaultSave(): SaveData {
  return { best: {}, stars: {}, unlocked: 0, muted: false };
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      best: typeof parsed.best === 'object' && parsed.best ? parsed.best : {},
      stars: typeof parsed.stars === 'object' && parsed.stars ? parsed.stars : {},
      unlocked: typeof parsed.unlocked === 'number' ? clamp(Math.floor(parsed.unlocked), 0, LEVELS.length - 1) : 0,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return defaultSave();
  }
}

const canvas = must<HTMLCanvasElement>('#game');
const stage = must<HTMLDivElement>('#stage');
const startScreen = must<HTMLDivElement>('#startScreen');
const pauseScreen = must<HTMLDivElement>('#pauseScreen');
const resultScreen = must<HTMLDivElement>('#resultScreen');
const startBtn = must<HTMLButtonElement>('#startBtn');
const levelStrip = must<HTMLDivElement>('#levelStrip');
const levelLabel = must<HTMLSpanElement>('#levelLabel');
const enemiesLeft = must<HTMLElement>('#enemiesLeft');
const objective = must<HTMLDivElement>('.objective');
const scoreEl = must<HTMLElement>('#score');
const scoreBox = must<HTMLDivElement>('.score-box');
const hintPill = must<HTMLDivElement>('#hintPill');
const toast = must<HTMLDivElement>('#toast');
const muteBtn = must<HTMLButtonElement>('#muteBtn');
const pauseBtn = must<HTMLButtonElement>('#pauseBtn');
const soundIcon = must<SVGElement>('.icon-sound');
const mutedIcon = must<SVGElement>('.icon-muted');
const resumeBtn = must<HTMLButtonElement>('#resumeBtn');
const pauseRetryBtn = must<HTMLButtonElement>('#pauseRetryBtn');
const pauseHomeBtn = must<HTMLButtonElement>('#pauseHomeBtn');
const retryBtn = must<HTMLButtonElement>('#retryBtn');
const nextBtn = must<HTMLButtonElement>('#nextBtn');
const homeBtn = must<HTMLButtonElement>('#homeBtn');
const resultEyebrow = must<HTMLDivElement>('#resultEyebrow');
const resultTitle = must<HTMLElement>('#resultTitle');
const resultStars = must<HTMLDivElement>('#resultStars');
const resultScore = must<HTMLElement>('#resultScore');
const bestScore = must<HTMLElement>('#bestScore');
const resultNote = must<HTMLElement>('#resultNote');
const mascot = must<HTMLCanvasElement>('#mascot');

const save = loadSave();
const audio = new AudioManager();
audio.setMuted(save.muted);

let currentIndex = 0;
let lastScore = -1;
let toastTimer = 0;
let mascotRaf = 0;
let hintBeforePause: { text: string; skill: boolean } | null = null;
let game: Game;

function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* storage can be unavailable in private or embedded contexts */
  }
}

function isOpen(element: HTMLElement): boolean {
  return !element.classList.contains('hidden');
}

function hideOverlay(element: HTMLElement): void {
  element.classList.add('hidden');
}

function setScore(value: number): void {
  const rounded = Math.round(value);
  scoreEl.textContent = formatScore(rounded);
  if (rounded !== lastScore) {
    lastScore = rounded;
    scoreBox.classList.remove('bump');
    void scoreBox.offsetWidth;
    scoreBox.classList.add('bump');
  }
}

function setEnemies(count: number): void {
  enemiesLeft.textContent = String(count);
  objective.classList.remove('pulse');
  void objective.offsetWidth;
  objective.classList.add('pulse');
}

function setHint(text: string | null, skill = false): void {
  if (!text) {
    hintPill.classList.add('hidden');
    return;
  }
  hintPill.textContent = text;
  hintPill.classList.remove('hidden');
  hintPill.classList.toggle('skill', skill);
}

function showToast(text: string): void {
  toast.textContent = text;
  toast.classList.add('show');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = 0;
  }, 2800);
}

function updateMuteUI(): void {
  soundIcon.classList.toggle('hidden', save.muted);
  mutedIcon.classList.toggle('hidden', !save.muted);
  muteBtn.setAttribute('aria-label', save.muted ? '开启音效' : '静音');
  muteBtn.setAttribute('aria-pressed', String(save.muted));
}

function starsMarkup(count: number): string {
  let html = '';
  for (let i = 0; i < 3; i += 1) {
    html += `<i class="star${i < count ? ' on' : ''}"></i>`;
  }
  return html;
}

function updateStartButton(): void {
  const index = clamp(save.unlocked, 0, LEVELS.length - 1);
  const hasProgress = Object.keys(save.stars).length > 0;
  startBtn.textContent = hasProgress
    ? `继续游戏 · 第 ${LEVELS[index].id} 关`
    : '开始游戏';
}

function renderLevelStrip(): void {
  levelStrip.innerHTML = '';
  LEVELS.forEach((level, index) => {
    const locked = index > save.unlocked;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `level-card${locked ? ' locked' : ''}${index === currentIndex ? ' current' : ''}`;
    card.disabled = locked;
    if (!locked) {
      card.title = `第 ${level.id} 关 · ${level.name}｜最佳 ${
        save.best[index] ? formatScore(save.best[index]) : '暂无'
      }`;
    }
    card.innerHTML = `
      <span class="num">LEVEL ${level.id}</span>
      <span class="name">${locked ? '未解锁' : level.name}</span>
      <span class="stars">${starsMarkup(save.stars[index] ?? 0)}</span>
    `;
    card.addEventListener('click', () => {
      if (locked) return;
      beginLevel(index);
    });
    levelStrip.appendChild(card);
  });
}

function updateLevelLabel(index: number): void {
  const level = LEVELS[clamp(index, 0, LEVELS.length - 1)];
  levelLabel.textContent = `第 ${level.id} 关 · ${level.name}`;
}

const callbacks: GameCallbacks = {
  onScore: (value) => setScore(value),
  onBirds: (_remaining, current) => {
    if (current) setHint('拖拽奶娃 · 松手发射');
    else setHint(null);
  },
  onSkill: (available, type) => {
    if (available && type) setHint(`轻点画面 · ${SKILL_NAMES[type]}`, true);
    else setHint(null);
  },
  onEnemies: (remaining) => setEnemies(remaining),
  onLevelState: (state, result) => {
    if (state === 'playing') {
      hideOverlay(startScreen);
      hideOverlay(resultScreen);
      hideOverlay(pauseScreen);
      stage.classList.remove('menu-open');
      return;
    }
    if (state === 'won' && result) {
      const index = game.currentLevelIndex;
      save.best[index] = Math.max(save.best[index] ?? 0, result.score);
      save.stars[index] = Math.max(save.stars[index] ?? 0, result.stars);
      if (index < LEVELS.length - 1) {
        save.unlocked = Math.max(save.unlocked, index + 1);
      }
      persist();
      renderLevelStrip();
      showResult(true, result);
    } else if (state === 'lost' && result) {
      showResult(false, result);
    }
  },
  onToast: (text) => showToast(text),
};

game = new Game(canvas, audio, callbacks);
game.previewLevel(0);
updateLevelLabel(0);
renderLevelStrip();
updateStartButton();
updateMuteUI();

function beginLevel(index: number): void {
  currentIndex = clamp(index, 0, LEVELS.length - 1);
  audio.unlock();
  audio.play('click');
  hideOverlay(startScreen);
  hideOverlay(pauseScreen);
  hideOverlay(resultScreen);
  stage.classList.remove('menu-open');
  hideHintAndToast();
  game.setPaused(false);
  game.startLevel(currentIndex);
  game.setInteractive(true);
  updateLevelLabel(currentIndex);
  renderLevelStrip();
  updateStartButton();
  startBtn.blur();
}

function hideHintAndToast(): void {
  setHint(null);
  toast.classList.remove('show');
  if (toastTimer) {
    window.clearTimeout(toastTimer);
    toastTimer = 0;
  }
}

function showResult(win: boolean, result: GameResult): void {
  hideOverlay(startScreen);
  hideOverlay(pauseScreen);
  resultScreen.classList.remove('hidden');
  stage.classList.add('menu-open');
  game.setInteractive(false);
  game.setPaused(true);
  hideHintAndToast();

  resultEyebrow.textContent = win ? 'LEVEL CLEAR' : 'TRY AGAIN';
  resultTitle.textContent = win ? '关卡通过！' : '差一点点！';
  resultStars.classList.remove('hidden');
  const starEls = resultStars.querySelectorAll<HTMLElement>('.star');
  starEls.forEach((el, i) => el.classList.toggle('on', win && i < result.stars));
  resultScore.textContent = formatScore(result.score);
  const best = save.best[game.currentLevelIndex] ?? 0;
  bestScore.textContent = best > 0 ? `最佳 ${formatScore(best)}` : '最佳 暂无';
  const isLast = game.currentLevelIndex >= LEVELS.length - 1;
  resultNote.textContent = win
    ? isLast
      ? '全部关卡通关！奶娃守护了整片草地。'
      : STARS_FOR_NOTE[result.stars] ?? ''
    : '黑糖蛙还在偷笑，换个角度再试试。';
  nextBtn.classList.toggle('hidden', !win || isLast);
  retryBtn.textContent = win ? '重玩' : '再来一次';
  if (win) audio.play('star');
}

function openMenu(): void {
  hideOverlay(pauseScreen);
  hideOverlay(resultScreen);
  startScreen.classList.remove('hidden');
  stage.classList.add('menu-open');
  game.setPaused(false);
  game.previewLevel(currentIndex);
  game.setInteractive(false);
  hideHintAndToast();
  updateLevelLabel(currentIndex);
  renderLevelStrip();
  updateStartButton();
  startMascot();
  audio.play('click');
}

function openPause(): void {
  if (isOpen(pauseScreen) || isOpen(startScreen) || isOpen(resultScreen)) return;
  if (game.currentPhase === 'won' || game.currentPhase === 'lost') return;
  hintBeforePause = hintPill.classList.contains('hidden')
    ? null
    : {
        text: hintPill.textContent ?? '',
        skill: hintPill.classList.contains('skill'),
      };
  game.setPaused(true);
  game.setInteractive(false);
  pauseScreen.classList.remove('hidden');
  hideHintAndToast();
  audio.play('click');
}

function closePause(): void {
  hideOverlay(pauseScreen);
  game.setPaused(false);
  game.setInteractive(true);
  if (hintBeforePause) setHint(hintBeforePause.text, hintBeforePause.skill);
  hintBeforePause = null;
  audio.play('click');
}

startBtn.addEventListener('click', () => {
  const index = clamp(save.unlocked, 0, LEVELS.length - 1);
  beginLevel(index);
});

resumeBtn.addEventListener('click', closePause);
pauseRetryBtn.addEventListener('click', () => {
  hideOverlay(pauseScreen);
  game.setPaused(false);
  beginLevel(currentIndex);
});
pauseHomeBtn.addEventListener('click', () => {
  hideOverlay(pauseScreen);
  game.setPaused(false);
  openMenu();
});

retryBtn.addEventListener('click', () => beginLevel(currentIndex));
nextBtn.addEventListener('click', () => {
  if (currentIndex < LEVELS.length - 1) beginLevel(currentIndex + 1);
});
homeBtn.addEventListener('click', () => openMenu());
pauseBtn.addEventListener('click', openPause);

muteBtn.addEventListener('click', () => {
  save.muted = !save.muted;
  audio.unlock();
  audio.setMuted(save.muted);
  if (!save.muted) audio.play('click');
  updateMuteUI();
  persist();
});

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  const onButton = target?.tagName === 'BUTTON';
  if (event.code === 'Space') {
    if (onButton) return;
    event.preventDefault();
    game.useSkill();
    return;
  }
  if (event.key === 'Escape' || event.code === 'KeyP') {
    if (isOpen(startScreen) || isOpen(resultScreen)) return;
    if (isOpen(pauseScreen)) closePause();
    else openPause();
    return;
  }
  if (event.code === 'KeyR') {
    if (isOpen(startScreen) || isOpen(resultScreen) || isOpen(pauseScreen)) return;
    beginLevel(currentIndex);
    return;
  }
  if (event.code === 'KeyM') {
    muteBtn.click();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !isOpen(startScreen) && !isOpen(resultScreen) && !isOpen(pauseScreen)) {
    openPause();
  }
});

function drawMascotDrop(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.5);
  ctx.bezierCurveTo(x + s * 0.95, y - s * 0.1, x + s * 0.75, y + s * 0.95, x, y + s);
  ctx.bezierCurveTo(x - s * 0.75, y + s * 0.95, x - s * 0.95, y - s * 0.1, x, y - s * 1.5);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawMascotFrame(now: number): void {
  if (!isOpen(startScreen)) {
    mascotRaf = 0;
    return;
  }
  const ctx = mascot.getContext('2d');
  if (!ctx) return;
  const time = now / 1000;
  ctx.clearRect(0, 0, mascot.width, mascot.height);

  const halo = ctx.createRadialGradient(310, 160, 18, 310, 160, 220);
  halo.addColorStop(0, 'rgba(255, 249, 224, 0.9)');
  halo.addColorStop(0.55, 'rgba(255, 246, 210, 0.35)');
  halo.addColorStop(1, 'rgba(255, 246, 210, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, mascot.width, mascot.height);

  ctx.fillStyle = 'rgba(96, 68, 42, 0.13)';
  for (const [x, y, rx] of [
    [310, 280, 55],
    [186, 278, 38],
    [438, 280, 38],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, 10, 0, 0, TAU);
    ctx.fill();
  }

  const bobMain = Math.sin(time * 1.7) * 5;
  const bobLeft = Math.sin(time * 1.7 + 1.5) * 4;
  const bobRight = Math.sin(time * 1.7 + 3.2) * 4;
  const blink = (time % 4.4) > 4.2;

  drawFrog(ctx, {
    x: 186,
    y: 210 + bobLeft,
    r: 44,
    type: 'matcha',
    expression: 'happy',
    lookX: 0.6,
    lookY: -0.1,
    blink: ((time + 2.1) % 4.9) > 4.7,
  });
  drawFrog(ctx, {
    x: 438,
    y: 212 + bobRight,
    r: 44,
    type: 'strawberry',
    expression: 'happy',
    lookX: -0.6,
    lookY: -0.1,
    blink: ((time + 1.2) % 5.2) > 5.0,
  });
  drawFrog(ctx, {
    x: 310,
    y: 170 + bobMain,
    r: 72,
    type: 'cream',
    expression: 'happy',
    lookX: 0.18,
    lookY: -0.08,
    blink,
  });

  for (let i = 0; i < 7; i += 1) {
    const phase = i * 1.37 + time * 0.8;
    const px = 90 + ((i * 83) % 460) + Math.sin(phase) * 14;
    const py = 62 + ((i * 47) % 190) + Math.cos(phase * 0.8) * 10;
    drawMascotDrop(
      ctx,
      px,
      py,
      4 + (i % 3) * 2.4,
      i % 3 === 0 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 247, 223, 0.7)',
    );
  }

  for (let i = 0; i < 4; i += 1) {
    const phase = time * 0.9 + i * 1.9;
    const px = 150 + Math.sin(phase) * 160;
    const py = 100 + Math.cos(phase * 1.2) * 60;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(phase);
    ctx.globalAlpha = 0.45 + Math.sin(phase * 2) * 0.2;
    starPath(ctx, 0, 0, 5 + (i % 2) * 2, 2.2);
    ctx.fillStyle = '#F8C859';
    ctx.fill();
    ctx.restore();
  }

  mascotRaf = requestAnimationFrame(drawMascotFrame);
}

function startMascot(): void {
  if (!mascotRaf) mascotRaf = requestAnimationFrame(drawMascotFrame);
}

startMascot();

(window as unknown as { __milkFrogGame?: Game }).__milkFrogGame = game;
