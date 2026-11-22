import type { BirdType, Material } from './types';
import {
  GROUND_Y,
  SLING_BACK_TIP,
  SLING_FRONT_TIP,
  SLING_X,
  WORLD_WIDTH,
} from './constants';
import { mulberry32, roundRectPath, starPath, TAU } from './utils';

export type FrogLook = BirdType | 'choco';

interface FrogPalette {
  body: string;
  shade: string;
  belly: string;
  line: string;
  blush: string;
  accent: string;
}

const FROG_PALETTES: Record<FrogLook, FrogPalette> = {
  cream: {
    body: '#FFF8E9',
    shade: '#F1DFC0',
    belly: '#FFFDF6',
    line: '#5C4533',
    blush: '#F5A69E',
    accent: '#63B7A0',
  },
  matcha: {
    body: '#E6F2CC',
    shade: '#C8DFA2',
    belly: '#F7FBEB',
    line: '#4C6540',
    blush: '#F0A39A',
    accent: '#74AD4E',
  },
  strawberry: {
    body: '#FFE7ED',
    shade: '#F5C8D7',
    belly: '#FFF8FB',
    line: '#7A4A58',
    blush: '#F38BA2',
    accent: '#EF6F91',
  },
  choco: {
    body: '#8E6954',
    shade: '#74503F',
    belly: '#A67D64',
    line: '#3D281F',
    blush: '#BB8374',
    accent: '#5C3B2B',
  },
};

export interface FrogOptions {
  x: number;
  y: number;
  r: number;
  type?: FrogLook;
  enemy?: boolean;
  expression?: 'normal' | 'happy' | 'determined' | 'angry' | 'hurt';
  blink?: boolean;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  lookX?: number;
  lookY?: number;
  shadow?: boolean;
  flash?: number;
  alpha?: number;
}

type BabyLook = Exclude<FrogLook, 'choco'>;

interface BabyPalette {
  body: string;
  shade: string;
  belly: string;
  line: string;
  hand: string;
}

const BABY_PALETTES: Record<BabyLook, BabyPalette> = {
  cream: {
    body: '#FFD83D',
    shade: '#EFB72A',
    belly: '#F4E6C6',
    line: '#7A5A22',
    hand: '#6C6250',
  },
  matcha: {
    body: '#D5EB8C',
    shade: '#B4CE66',
    belly: '#F5EDC9',
    line: '#5E6A32',
    hand: '#64644B',
  },
  strawberry: {
    body: '#FFC3D1',
    shade: '#EE9CB2',
    belly: '#FFF1E3',
    line: '#7A4B58',
    hand: '#766058',
  },
};

const BABY_EYE = '#77D858';
const BABY_EYE_DARK = '#3E4A2B';

function milkBabyBodyPath(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.moveTo(-r * 0.36, -r * 1.0);
  ctx.bezierCurveTo(-r * 0.62, -r * 1.04, -r * 0.76, -r * 0.82, -r * 0.8, -r * 0.56);
  ctx.bezierCurveTo(-r * 0.94, -r * 0.16, -r * 0.92, r * 0.34, -r * 0.76, r * 0.6);
  ctx.bezierCurveTo(-r * 0.6, r * 0.84, -r * 0.32, r * 0.9, 0, r * 0.9);
  ctx.bezierCurveTo(r * 0.32, r * 0.9, r * 0.6, r * 0.84, r * 0.76, r * 0.6);
  ctx.bezierCurveTo(r * 0.92, r * 0.34, r * 0.94, -r * 0.16, r * 0.8, -r * 0.56);
  ctx.bezierCurveTo(r * 0.76, -r * 0.82, r * 0.62, -r * 1.04, r * 0.36, -r * 1.0);
  ctx.closePath();
}

function drawMilkBaby(ctx: CanvasRenderingContext2D, options: FrogOptions): void {
  const {
    x,
    y,
    r,
    scaleX = 1,
    scaleY = 1,
    angle = 0,
    lookX = 0,
    lookY = 0,
    shadow = false,
    flash = 0,
    alpha = 1,
  } = options;
  const kind: BabyLook = options.type === 'matcha' || options.type === 'strawberry' ? options.type : 'cream';
  const palette = BABY_PALETTES[kind];
  const expression = options.expression ?? 'normal';
  const blink = options.blink ?? false;
  const lw = Math.max(1.6, r * 0.06);

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);

  if (shadow) {
    ctx.fillStyle = 'rgba(60, 40, 24, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, r * 1.52, r * 0.62, r * 0.15, 0, 0, TAU);
    ctx.fill();
  }

  ctx.rotate(angle);
  ctx.scale(scaleX, scaleY);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.strokeStyle = palette.line;
  ctx.lineWidth = r * 0.31;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.24, r * 0.62);
    ctx.quadraticCurveTo(side * r * 0.36, r * 1.08, side * r * 0.52, r * 1.46);
    ctx.stroke();
  }
  ctx.strokeStyle = palette.body;
  ctx.lineWidth = r * 0.24;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.24, r * 0.62);
    ctx.quadraticCurveTo(side * r * 0.36, r * 1.08, side * r * 0.52, r * 1.46);
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.55, r * 1.47);
    ctx.rotate(side * 0.08);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.2, r * 0.1, 0, 0, TAU);
    ctx.fillStyle = palette.body;
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = lw * 0.55;
    ctx.stroke();
    ctx.restore();
  }

  const bodyGradient = ctx.createRadialGradient(-r * 0.3, -r * 0.62, r * 0.08, 0, r * 0.05, r * 1.22);
  bodyGradient.addColorStop(0, palette.body);
  bodyGradient.addColorStop(0.62, palette.body);
  bodyGradient.addColorStop(1, palette.shade);
  milkBabyBodyPath(ctx, r);
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();

  ctx.save();
  milkBabyBodyPath(ctx, r);
  ctx.clip();
  const bellyGradient = ctx.createRadialGradient(0, r * 0.1, r * 0.05, 0, r * 0.42, r * 0.78);
  bellyGradient.addColorStop(0, palette.belly);
  bellyGradient.addColorStop(0.78, palette.belly);
  bellyGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.beginPath();
  ctx.ellipse(0, r * 0.38, r * 0.6, r * 0.58, 0, 0, TAU);
  ctx.fillStyle = bellyGradient;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = palette.line;
  ctx.lineWidth = r * 0.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.68, r * 0.05);
    ctx.quadraticCurveTo(side * r * 0.78, r * 0.34, side * r * 0.6, r * 0.54);
    ctx.stroke();
  }
  ctx.strokeStyle = palette.body;
  ctx.lineWidth = r * 0.15;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.68, r * 0.05);
    ctx.quadraticCurveTo(side * r * 0.78, r * 0.34, side * r * 0.6, r * 0.54);
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.57, r * 0.56);
    ctx.rotate(side * 0.26);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.155, r * 0.12, 0, 0, TAU);
    ctx.fillStyle = palette.hand;
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = lw * 0.55;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.07, -r * 0.02);
    ctx.lineTo(r * 0.02, -r * 0.035);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = lw * 0.4;
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.ellipse(-r * 0.34, -r * 0.54, r * 0.2, r * 0.1, -0.6, 0, Math.PI);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();

  const eyeY = -r * 0.6;
  const eyeX = r * 0.34;
  const eyeR = r * 0.225;

  for (const side of [-1, 1]) {
    const cx = side * eyeX;
    if (blink) {
      ctx.beginPath();
      ctx.arc(cx, eyeY, eyeR * 0.86, Math.PI * 1.12, Math.PI * 1.88);
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = lw * 1.25;
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    ctx.arc(cx, eyeY, eyeR, 0, TAU);
    ctx.fillStyle = BABY_EYE;
    ctx.fill();
    ctx.strokeStyle = BABY_EYE_DARK;
    ctx.lineWidth = lw * 0.55;
    ctx.stroke();

    const px = cx + lookX * eyeR * 0.34;
    const py = eyeY + lookY * eyeR * 0.34;
    ctx.beginPath();
    ctx.arc(px, py, eyeR * 0.47, 0, TAU);
    ctx.fillStyle = '#1D211B';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px - eyeR * 0.16, py - eyeR * 0.18, eyeR * 0.15, 0, TAU);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.93)';
    ctx.fill();

    if (expression === 'determined') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, eyeY, eyeR * 1.04, Math.PI * 1.03, Math.PI * 1.97);
      ctx.lineTo(cx + eyeR, eyeY - eyeR * 0.15);
      ctx.lineTo(cx - eyeR, eyeY - eyeR * 0.15);
      ctx.closePath();
      ctx.fillStyle = palette.body;
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.strokeStyle = palette.line;
  ctx.lineWidth = lw * 0.9;
  ctx.lineCap = 'round';
  if (expression === 'happy') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, -r * 0.22);
    ctx.quadraticCurveTo(0, -r * 0.06, r * 0.16, -r * 0.22);
    ctx.stroke();
  } else if (expression === 'determined') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.16);
    ctx.lineTo(r * 0.12, -r * 0.16);
    ctx.stroke();
  } else if (expression === 'hurt') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.14);
    ctx.lineTo(r * 0.12, -r * 0.24);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.18);
    ctx.quadraticCurveTo(0, -r * 0.08, r * 0.12, -r * 0.18);
    ctx.stroke();
  }

  if (flash > 0) {
    ctx.save();
    milkBabyBodyPath(ctx, r);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, flash * 0.65)})`;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

export function drawFrog(ctx: CanvasRenderingContext2D, options: FrogOptions): void {
  if (!options.enemy) {
    drawMilkBaby(ctx, options);
    return;
  }

  const {
    x,
    y,
    r,
    type = 'cream',
    enemy = false,
    angle = 0,
    scaleX = 1,
    scaleY = 1,
    lookX = 0,
    lookY = 0,
    shadow = false,
    flash = 0,
    alpha = 1,
  } = options;
  const look: FrogLook = enemy ? 'choco' : type;
  const palette = FROG_PALETTES[look];
  const expression = options.expression ?? (enemy ? 'angry' : 'normal');
  const blink = options.blink ?? false;
  const line = palette.line;
  const lw = Math.max(1.8, r * 0.072);

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);

  if (shadow) {
    ctx.save();
    ctx.fillStyle = 'rgba(60, 40, 24, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, r * 1.02, r * 0.92, r * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.rotate(angle);
  ctx.scale(scaleX, scaleY);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.fillStyle = palette.body;
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.54, r * 0.73);
    ctx.rotate(side * 0.24);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.29, r * 0.19, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.82, r * 0.24);
    ctx.rotate(side * -0.48);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.24, r * 0.15, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 0.43, -r * 0.58, r * 0.4, 0, TAU);
    ctx.fillStyle = palette.body;
    ctx.fill();
    ctx.stroke();
  }

  const bodyGradient = ctx.createRadialGradient(-r * 0.32, -r * 0.42, r * 0.1, 0, r * 0.08, r * 1.24);
  bodyGradient.addColorStop(0, palette.body);
  bodyGradient.addColorStop(0.7, palette.body);
  bodyGradient.addColorStop(1, palette.shade);
  ctx.beginPath();
  ctx.ellipse(0, r * 0.08, r * 1.0, r * 0.93, 0, 0, TAU);
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, r * 0.38, r * 0.58, r * 0.4, 0, 0, TAU);
  ctx.fillStyle = palette.belly;
  ctx.globalAlpha *= 0.72;
  ctx.fill();
  ctx.globalAlpha /= 0.72;

  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.38, r * 0.26, r * 0.15, -0.5, 0, Math.PI);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;

  if (look === 'cream' && !enemy) {
    ctx.save();
    ctx.translate(0, r * 0.68);
    ctx.fillStyle = palette.accent;
    ctx.strokeStyle = line;
    ctx.lineWidth = lw * 0.85;
    roundRectPath(ctx, -r * 0.66, -r * 0.08, r * 1.32, r * 0.16, r * 0.08);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.62, r * 0.0, r * 0.1, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.66, r * 0.01);
    ctx.quadraticCurveTo(r * 0.9, r * 0.1, r * 0.82, r * 0.36);
    ctx.lineTo(r * 0.62, r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.66, r * 0.03);
    ctx.quadraticCurveTo(r * 0.86, r * 0.22, r * 0.68, r * 0.4);
    ctx.lineTo(r * 0.53, r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (look === 'matcha' && !enemy) {
    ctx.save();
    ctx.strokeStyle = '#4C7A34';
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.94);
    ctx.quadraticCurveTo(r * 0.03, -r * 1.12, r * 0.1, -r * 1.23);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * r * 0.16, -r * 1.2);
      ctx.rotate(side * 0.55);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.22, r * 0.1, 0, 0, TAU);
      ctx.fillStyle = side === 1 ? '#8AC45E' : '#72AE4A';
      ctx.fill();
      ctx.strokeStyle = '#4C7A34';
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  if (look === 'strawberry' && !enemy) {
    ctx.save();
    ctx.translate(r * 0.5, -r * 0.98);
    ctx.rotate(-0.28);
    ctx.fillStyle = palette.accent;
    ctx.strokeStyle = line;
    ctx.lineWidth = lw * 0.85;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-r * 0.32, -r * 0.3, -r * 0.42, r * 0.02, 0, r * 0.08);
    ctx.bezierCurveTo(r * 0.42, r * 0.02, r * 0.32, -r * 0.3, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, r * 0.02);
    ctx.bezierCurveTo(-r * 0.36, r * 0.16, -r * 0.26, r * 0.34, 0, r * 0.16);
    ctx.bezierCurveTo(r * 0.26, r * 0.34, r * 0.36, r * 0.16, 0, r * 0.02);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, r * 0.02, r * 0.09, 0, TAU);
    ctx.fillStyle = '#FFD9E3';
    ctx.fill();
    ctx.restore();
  }

  if (enemy) {
    ctx.save();
    ctx.translate(-r * 0.55, r * 0.24);
    ctx.rotate(-0.32);
    ctx.fillStyle = '#F6E8CB';
    ctx.strokeStyle = 'rgba(61, 40, 31, 0.65)';
    ctx.lineWidth = lw * 0.5;
    roundRectPath(ctx, -r * 0.2, -r * 0.08, r * 0.4, r * 0.16, r * 0.07);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(110, 82, 60, 0.6)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * r * 0.08, 0, r * 0.02, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  const eyeY = -r * 0.6;
  const eyeX = r * 0.4;
  const eyeR = r * 0.265;

  for (const side of [-1, 1]) {
    const cx = side * eyeX;
    if (blink) {
      ctx.beginPath();
      ctx.arc(cx, eyeY, eyeR * 0.82, Math.PI * 1.12, Math.PI * 1.88);
      ctx.strokeStyle = line;
      ctx.lineWidth = lw * 0.95;
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    ctx.arc(cx, eyeY, eyeR, 0, TAU);
    ctx.fillStyle = '#FFFDF7';
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();

    const px = cx + lookX * r * 0.07;
    const py = eyeY + lookY * r * 0.07;
    ctx.beginPath();
    ctx.arc(px, py, r * (enemy ? 0.1 : 0.115), 0, TAU);
    ctx.fillStyle = '#38281F';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px - r * 0.035, py - r * 0.04, r * 0.038, 0, TAU);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();
  }

  if (expression === 'angry' || expression === 'determined') {
    const browLift = expression === 'angry' ? 0.1 : 0.14;
    ctx.strokeStyle = line;
    ctx.lineWidth = lw * 1.15;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.71, eyeY - r * (expression === 'angry' ? 0.26 : 0.24));
      ctx.lineTo(side * r * 0.16, eyeY - r * (expression === 'angry' ? 0.13 : browLift));
      ctx.stroke();
    }
  }

  ctx.strokeStyle = line;
  ctx.lineWidth = lw * 0.9;

  if (expression === 'happy') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.27, r * 0.15);
    ctx.quadraticCurveTo(0, r * 0.46, r * 0.27, r * 0.15);
    ctx.closePath();
    ctx.fillStyle = '#5B3D32';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.31, r * 0.13, r * 0.08, 0, 0, TAU);
    ctx.fillStyle = '#F08A96';
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(-r * 0.27, r * 0.15);
    ctx.quadraticCurveTo(0, r * 0.46, r * 0.27, r * 0.15);
    ctx.stroke();
  } else if (expression === 'angry') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.28, r * 0.26);
    ctx.quadraticCurveTo(0, r * 0.1, r * 0.28, r * 0.26);
    ctx.stroke();
    ctx.fillStyle = '#FFF9EC';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.2, r * 0.26);
      ctx.lineTo(side * r * 0.14, r * 0.38);
      ctx.lineTo(side * r * 0.08, r * 0.26);
      ctx.closePath();
      ctx.fill();
    }
  } else if (expression === 'hurt') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.13, r * 0.25);
    ctx.lineTo(r * 0.13, r * 0.25);
    ctx.stroke();
  } else if (expression === 'determined') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, r * 0.18);
    ctx.quadraticCurveTo(0, r * 0.3, r * 0.2, r * 0.18);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-r * 0.29, r * 0.13);
    ctx.quadraticCurveTo(0, r * 0.35, r * 0.29, r * 0.13);
    ctx.stroke();
  }

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 0.1, -r * 0.05, r * 0.024, 0, TAU);
    ctx.fillStyle = line;
    ctx.fill();
    ctx.save();
    ctx.translate(side * r * 0.6, r * 0.22);
    ctx.rotate(side * 0.16);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.15, r * 0.085, 0, 0, TAU);
    ctx.fillStyle = palette.blush;
    ctx.globalAlpha *= 0.6;
    ctx.fill();
    ctx.restore();
  }

  if (flash > 0) {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.08, r * 1.0, r * 0.93, 0, 0, TAU);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, flash * 0.65)})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FFFBF0';
  ctx.beginPath();
  ctx.ellipse(-42, 4, 40, 24, 0, 0, TAU);
  ctx.ellipse(2, -10, 50, 32, 0, 0, TAU);
  ctx.ellipse(48, 3, 38, 23, 0, 0, TAU);
  ctx.ellipse(6, 12, 60, 22, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(216, 213, 192, 0.28)';
  ctx.beginPath();
  ctx.ellipse(4, 22, 55, 12, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawBackground(ctx: CanvasRenderingContext2D, time: number, accent: string): void {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#A5DEEA');
  sky.addColorStop(0.52, '#CDEDE4');
  sky.addColorStop(1, '#F7F1D8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, GROUND_Y + 2);

  const sun = ctx.createRadialGradient(1070, 126, 8, 1070, 126, 150);
  sun.addColorStop(0, 'rgba(255, 249, 214, 0.95)');
  sun.addColorStop(0.35, 'rgba(255, 243, 190, 0.42)');
  sun.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(880, 0, 380, 330);
  ctx.beginPath();
  ctx.arc(1070, 126, 54, 0, TAU);
  ctx.fillStyle = '#FFF6C8';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(1052, 108, 20, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fill();

  const drift = time * 7;
  drawCloud(ctx, ((170 + drift * 0.5) % 1500) - 110, 118, 0.9, 0.78);
  drawCloud(ctx, ((560 + drift * 0.32) % 1600) - 130, 190, 0.62, 0.62);
  drawCloud(ctx, ((980 + drift * 0.42) % 1700) - 150, 78, 1.05, 0.66);
  drawCloud(ctx, ((1280 + drift * 0.24) % 1800) - 200, 238, 0.5, 0.45);

  ctx.strokeStyle = 'rgba(76, 104, 97, 0.4)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (const [bx, by, bs] of [
    [420, 150, 1],
    [476, 168, 0.8],
  ]) {
    ctx.beginPath();
    ctx.moveTo(bx - 11 * bs, by + 4 * bs);
    ctx.quadraticCurveTo(bx - 5 * bs, by - 4 * bs, bx, by);
    ctx.quadraticCurveTo(bx + 5 * bs, by - 4 * bs, bx + 11 * bs, by + 4 * bs);
    ctx.stroke();
  }

  const farHill = ctx.createLinearGradient(0, 380, 0, GROUND_Y);
  farHill.addColorStop(0, '#CBE4BC');
  farHill.addColorStop(1, '#A8D19A');
  ctx.fillStyle = farHill;
  ctx.beginPath();
  ctx.moveTo(0, 560);
  ctx.bezierCurveTo(150, 476, 300, 512, 440, 478);
  ctx.bezierCurveTo(600, 438, 720, 502, 850, 486);
  ctx.bezierCurveTo(1010, 466, 1140, 512, 1280, 470);
  ctx.lineTo(1280, GROUND_Y);
  ctx.lineTo(0, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(124, 174, 110, 0.42)';
  for (const [tx, ty, ts] of [
    [150, 512, 1.1],
    [330, 528, 0.8],
    [742, 494, 0.9],
    [1180, 510, 1.15],
  ]) {
    ctx.beginPath();
    ctx.arc(tx - 16 * ts, ty - 34 * ts, 26 * ts, 0, TAU);
    ctx.arc(tx + 16 * ts, ty - 38 * ts, 23 * ts, 0, TAU);
    ctx.arc(tx, ty - 56 * ts, 30 * ts, 0, TAU);
    ctx.fill();
    ctx.fillRect(tx - 5 * ts, ty - 30 * ts, 10 * ts, 34 * ts);
  }

  const nearHill = ctx.createLinearGradient(0, 470, 0, GROUND_Y);
  nearHill.addColorStop(0, '#9ACD8A');
  nearHill.addColorStop(1, '#7FBA75');
  ctx.fillStyle = nearHill;
  ctx.beginPath();
  ctx.moveTo(0, 600);
  ctx.bezierCurveTo(180, 542, 340, 586, 520, 552);
  ctx.bezierCurveTo(700, 518, 830, 574, 990, 552);
  ctx.bezierCurveTo(1120, 536, 1200, 566, 1280, 546);
  ctx.lineTo(1280, GROUND_Y);
  ctx.lineTo(0, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 249, 222, 0.18)';
  for (let i = 0; i < 7; i += 1) {
    const sx = 60 + i * 185;
    const sy = 360 + ((i * 53) % 110);
    ctx.beginPath();
    ctx.arc(sx, sy, 2.4, 0, TAU);
    ctx.fill();
  }

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(130, 220, 34, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawGround(ctx: CanvasRenderingContext2D, time: number, accent: string): void {
  const soil = ctx.createLinearGradient(0, GROUND_Y, 0, 720);
  soil.addColorStop(0, '#8A6749');
  soil.addColorStop(0.42, '#76553D');
  soil.addColorStop(1, '#5D4331');
  ctx.fillStyle = soil;
  ctx.fillRect(0, GROUND_Y + 10, WORLD_WIDTH, 720 - GROUND_Y);

  ctx.fillStyle = 'rgba(58, 39, 27, 0.22)';
  for (let i = 0; i < 26; i += 1) {
    const x = (i * 149 + 43) % WORLD_WIDTH;
    const y = GROUND_Y + 32 + ((i * 37) % 52);
    ctx.beginPath();
    ctx.ellipse(x, y, 5 + (i % 4) * 2, 2.6, (i % 5) * 0.3, 0, TAU);
    ctx.fill();
  }

  const grass = ctx.createLinearGradient(0, GROUND_Y - 6, 0, GROUND_Y + 26);
  grass.addColorStop(0, '#9AD787');
  grass.addColorStop(0.55, '#7CBB6D');
  grass.addColorStop(1, '#5E9D57');
  ctx.fillStyle = grass;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 1);
  for (let x = 0; x <= WORLD_WIDTH; x += 20) {
    const y = GROUND_Y + Math.sin(x * 0.021) * 2.2 + Math.sin(x * 0.049 + 1.3) * 1.4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD_WIDTH, GROUND_Y + 27);
  ctx.lineTo(0, GROUND_Y + 27);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 232, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= WORLD_WIDTH; x += 20) {
    const y = GROUND_Y + Math.sin(x * 0.021) * 2.2 + Math.sin(x * 0.049 + 1.3) * 1.4;
    if (x === 0) ctx.moveTo(x, y + 1);
    else ctx.lineTo(x, y + 1);
  }
  ctx.stroke();

  for (let i = 0; i < 54; i += 1) {
    const x = (i * 97 + 11) % WORLD_WIDTH;
    const sway = Math.sin(time * 1.4 + i * 0.8) * 2.4;
    const h = 6 + ((i * 13) % 9);
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(74, 128, 66, 0.95)' : 'rgba(92, 151, 79, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 1);
    ctx.quadraticCurveTo(x + sway, GROUND_Y - h * 0.5, x + sway * 1.8, GROUND_Y - h);
    ctx.stroke();
  }

  const flowerSpots = [
    [72, 0.2],
    [372, 1.1],
    [512, 2.3],
    [708, 0.8],
    [884, 1.7],
    [1218, 2.8],
  ];
  for (const [fx, phase] of flowerSpots) {
    const fy = GROUND_Y + 4;
    const sway = Math.sin(time * 1.2 + phase) * 2;
    ctx.strokeStyle = '#4E8C48';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, fy + 2);
    ctx.quadraticCurveTo(fx + sway, fy - 10, fx + sway * 1.4, fy - 19);
    ctx.stroke();
    const cx = fx + sway * 1.4;
    const cy = fy - 20;
    for (let p = 0; p < 5; p += 1) {
      const a = (p / 5) * TAU - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 5.4, cy + Math.sin(a) * 5.4, 4.3, 0, TAU);
      ctx.fillStyle = p % 2 === 0 ? accent : '#FFF7E2';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, TAU);
    ctx.fillStyle = '#F4B942';
    ctx.fill();
  }

  ctx.fillStyle = '#B7A58E';
  for (const [px, py, pr] of [
    [170, 674, 5],
    [458, 692, 4],
    [812, 678, 6],
    [1128, 700, 5],
  ]) {
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.66, 0.3, 0, TAU);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(101, GROUND_Y + 2);
  ctx.fillStyle = 'rgba(44, 31, 21, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 22, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFF9EA';
  ctx.strokeStyle = '#77553A';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.lineTo(13, 0);
  ctx.lineTo(10, -44);
  ctx.lineTo(-10, -44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, -44);
  ctx.lineTo(0, -56);
  ctx.lineTo(10, -44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#F5C96B';
  ctx.beginPath();
  ctx.arc(0, -27, 7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(119, 85, 58, 0.5)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#77553A';
  ctx.font = '700 6px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MILK', 0, -41);
  ctx.restore();
}

function drawLeatherWrap(ctx: CanvasRenderingContext2D, y: number): void {
  ctx.strokeStyle = '#4E3422';
  ctx.lineWidth = 4;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(SLING_X - 10, y + i * 6);
    ctx.lineTo(SLING_X + 10, y + i * 6 + 2);
    ctx.stroke();
  }
}

export function drawSlingBack(ctx: CanvasRenderingContext2D, pouch: { x: number; y: number } | null): void {
  ctx.save();
  ctx.fillStyle = 'rgba(48, 32, 20, 0.18)';
  ctx.beginPath();
  ctx.ellipse(SLING_X + 4, GROUND_Y + 7, 58, 12, 0, 0, TAU);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const stemTop = GROUND_Y - 96;

  ctx.strokeStyle = '#5A3A24';
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(SLING_X, GROUND_Y + 18);
  ctx.lineTo(SLING_X, stemTop);
  ctx.stroke();

  ctx.strokeStyle = '#8A5A38';
  ctx.lineWidth = 17;
  ctx.beginPath();
  ctx.moveTo(SLING_X, GROUND_Y + 16);
  ctx.lineTo(SLING_X, stemTop);
  ctx.stroke();

  ctx.strokeStyle = '#A97246';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(SLING_X - 5, GROUND_Y + 8);
  ctx.lineTo(SLING_X - 5, stemTop + 12);
  ctx.stroke();

  for (const tip of [SLING_BACK_TIP, SLING_FRONT_TIP]) {
    ctx.strokeStyle = '#5A3A24';
    ctx.lineWidth = 19;
    ctx.beginPath();
    ctx.moveTo(SLING_X, stemTop + 4);
    ctx.quadraticCurveTo(SLING_X + (tip.x - SLING_X) * 0.35, stemTop - 24, tip.x, tip.y);
    ctx.stroke();
    ctx.strokeStyle = '#8A5A38';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(SLING_X, stemTop + 2);
    ctx.quadraticCurveTo(SLING_X + (tip.x - SLING_X) * 0.35, stemTop - 26, tip.x, tip.y);
    ctx.stroke();
    ctx.fillStyle = '#6E472C';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#A97246';
    ctx.beginPath();
    ctx.arc(tip.x - 2, tip.y - 2, 3.4, 0, TAU);
    ctx.fill();
  }

  drawLeatherWrap(ctx, GROUND_Y - 58);
  drawLeatherWrap(ctx, GROUND_Y - 34);

  if (pouch) {
    ctx.strokeStyle = '#4B3222';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(SLING_BACK_TIP.x, SLING_BACK_TIP.y);
    ctx.lineTo(pouch.x - 10, pouch.y);
    ctx.stroke();
    ctx.strokeStyle = '#77503A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(SLING_BACK_TIP.x, SLING_BACK_TIP.y);
    ctx.lineTo(pouch.x - 10, pouch.y);
    ctx.stroke();

    ctx.save();
    ctx.translate(pouch.x, pouch.y);
    ctx.fillStyle = '#5D4030';
    ctx.strokeStyle = '#3E2A1E';
    ctx.lineWidth = 2;
    roundRectPath(ctx, -14, -13, 28, 30, 9);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(222, 184, 138, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, 8);
    ctx.lineTo(8, 8);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = '#5B3D2A';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const tip of [SLING_BACK_TIP, SLING_FRONT_TIP]) {
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.quadraticCurveTo(tip.x + 8, tip.y + 52, SLING_X + (tip.x - SLING_X) * 0.35, tip.y + 78);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function drawSlingFront(ctx: CanvasRenderingContext2D, pouch: { x: number; y: number } | null): void {
  if (!pouch) return;
  ctx.save();
  ctx.strokeStyle = '#4B3222';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(SLING_FRONT_TIP.x, SLING_FRONT_TIP.y);
  ctx.lineTo(pouch.x + 10, pouch.y + 1);
  ctx.stroke();
  ctx.strokeStyle = '#8B5E42';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(SLING_FRONT_TIP.x, SLING_FRONT_TIP.y);
  ctx.lineTo(pouch.x + 10, pouch.y + 1);
  ctx.stroke();
  ctx.restore();
}

interface MaterialStyle {
  fillA: string;
  fillB: string;
  line: string;
  detail: string;
}

const MATERIAL_STYLES: Record<Material, MaterialStyle> = {
  wood: {
    fillA: '#E9B978',
    fillB: '#CB8B4D',
    line: '#72502F',
    detail: 'rgba(118, 78, 39, 0.38)',
  },
  glass: {
    fillA: 'rgba(201, 246, 241, 0.6)',
    fillB: 'rgba(148, 219, 212, 0.46)',
    line: '#67B9B2',
    detail: 'rgba(255, 255, 255, 0.65)',
  },
  stone: {
    fillA: '#D3CDC2',
    fillB: '#A9A195',
    line: '#6F675C',
    detail: 'rgba(86, 78, 67, 0.32)',
  },
};

function drawCracks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  severity: number,
  color: string,
): void {
  const rand = mulberry32(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.1, Math.min(w, h) * 0.035);
  ctx.lineCap = 'round';
  const branches = severity === 2 ? 5 : 2;
  ctx.beginPath();
  for (let i = 0; i < branches; i += 1) {
    let cx = -w / 2 + rand() * w;
    let cy = i % 2 === 0 ? -h / 2 + 3 : h / 2 - 3;
    ctx.moveTo(cx, cy);
    const steps = 3 + (i % 2);
    for (let s = 0; s < steps; s += 1) {
      cx += (rand() - 0.5) * w * 0.26;
      cy += (i % 2 === 0 ? 1 : -1) * (h / steps) * (0.35 + rand() * 0.4);
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  material: Material,
  ratio: number,
  seed: number,
  flash = 0,
): void {
  const style = MATERIAL_STYLES[material];
  const rand = mulberry32(seed);
  const radius = Math.min(7, Math.min(w, h) * 0.24);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(58, 41, 26, 0.1)';
  roundRectPath(ctx, -w / 2 + 3, -h / 2 + 6, w, h, radius);
  ctx.fill();

  const gradient = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  gradient.addColorStop(0, style.fillA);
  gradient.addColorStop(1, style.fillB);
  roundRectPath(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = style.line;
  ctx.lineWidth = material === 'glass' ? 2.6 : 2.2;
  ctx.stroke();

  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.clip();

  if (material === 'wood') {
    const horizontal = w >= h;
    const long = horizontal ? w : h;
    const short = horizontal ? h : w;
    ctx.strokeStyle = style.detail;
    ctx.lineWidth = 1.6;
    const lines = Math.max(2, Math.floor(short / 12));
    for (let i = 1; i <= lines; i += 1) {
      const offset = -short / 2 + (short / (lines + 1)) * i + (rand() - 0.5) * 3;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(-long / 2 + 3, offset);
        ctx.quadraticCurveTo(0, offset + (rand() - 0.5) * 5, long / 2 - 3, offset + (rand() - 0.5) * 3);
      } else {
        ctx.moveTo(offset, -long / 2 + 3);
        ctx.quadraticCurveTo(offset + (rand() - 0.5) * 5, 0, offset + (rand() - 0.5) * 3, long / 2 - 3);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 247, 226, 0.24)';
    if (horizontal) ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, 3);
    else ctx.fillRect(-w / 2 + 2, -h / 2 + 2, 3, h - 4);
    ctx.fillStyle = 'rgba(96, 62, 32, 0.5)';
    for (const nx of [-w / 2 + 8, w / 2 - 8]) {
      for (const ny of [-h / 2 + 8, h / 2 - 8]) {
        if (Math.abs(nx) > w / 2 - 2 || Math.abs(ny) > h / 2 - 2) continue;
        ctx.beginPath();
        ctx.arc(nx, ny, 2.2, 0, TAU);
        ctx.fill();
      }
    }
  } else if (material === 'glass') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, h / 2);
    ctx.lineTo(w / 2 - 14, -h / 2);
    ctx.lineTo(w / 2 - 4, -h / 2);
    ctx.lineTo(-w / 2 + 16, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(w * 0.2, -h * 0.22, 4, 7, 0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, Math.max(2, radius - 3));
    ctx.stroke();
  } else {
    ctx.fillStyle = style.detail;
    for (let i = 0; i < 14; i += 1) {
      const px = -w / 2 + rand() * w;
      const py = -h / 2 + rand() * h;
      ctx.beginPath();
      ctx.arc(px, py, 1 + rand() * 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 251, 239, 0.32)';
    ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, 3);
  }

  if (ratio < 0.68) {
    drawCracks(
      ctx,
      w,
      h,
      seed,
      ratio < 0.32 ? 2 : 1,
      material === 'glass' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(48, 35, 24, 0.5)',
    );
  }

  if (ratio < 0.35) {
    ctx.fillStyle = material === 'glass' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(70, 45, 25, 0.11)';
    roundRectPath(ctx, -w / 2, -h / 2, w, h, radius);
    ctx.fill();
  }

  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.62, flash * 0.62)})`;
    roundRectPath(ctx, -w / 2, -h / 2, w, h, radius);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

export function drawSparkStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  rotation = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  starPath(ctx, 0, 0, radius, radius * 0.44);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
