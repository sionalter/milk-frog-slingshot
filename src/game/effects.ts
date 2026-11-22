import { rand, TAU } from './utils';

export type ParticleShape = 'rect' | 'circle' | 'drop' | 'star' | 'shard';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  shape: ParticleShape;
  gravity: number;
  drag: number;
}

export interface Ring {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  rise: number;
}

export interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export type BurstKind = 'wood' | 'glass' | 'stone' | 'milk' | 'choco' | 'gold' | 'matcha';

const BURST_COLORS: Record<BurstKind, string[]> = {
  wood: ['#E0AD6D', '#C58A4A', '#9A6332', '#F0CE94'],
  glass: ['#DFFBF7', '#B6ECE7', '#FFFFFF', '#7FCEC7'],
  stone: ['#D7D0C4', '#B0A79A', '#8F8679', '#EFE9DE'],
  milk: ['#FFFDF5', '#FFF4DD', '#F6E4C3', '#FFFFFF'],
  choco: ['#A37B62', '#7C5742', '#5C3D2D', '#D6B49A'],
  gold: ['#FFE28A', '#F7BE3E', '#FFF6CD', '#EEA623'],
  matcha: ['#E3F2C7', '#C3DE9E', '#A8CB7D', '#F7FBEA'],
};

export class Effects {
  particles: Particle[] = [];
  rings: Ring[] = [];
  texts: FloatText[] = [];
  smoke: SmokePuff[] = [];

  reset(): void {
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    this.smoke.length = 0;
  }

  burst(x: number, y: number, kind: BurstKind, power = 1): void {
    const colors = BURST_COLORS[kind];
    const count = Math.round((kind === 'glass' ? 14 : 10) * Math.min(1.8, power));
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(1.2, 5.2) * Math.min(1.7, power);
      const shape: ParticleShape =
        kind === 'glass' ? 'shard' : kind === 'milk' ? 'drop' : kind === 'gold' ? 'star' : 'rect';
      this.particles.push({
        x: x + rand(-8, 8),
        y: y + rand(-8, 8),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(0.4, 2.4),
        life: rand(26, 52),
        maxLife: 52,
        size: kind === 'stone' ? rand(2.4, 5.4) : rand(2, 5),
        rot: rand(0, TAU),
        vr: rand(-0.24, 0.24),
        color: colors[Math.floor(rand(0, colors.length))],
        shape,
        gravity: kind === 'glass' ? 0.17 : 0.22,
        drag: 0.994,
      });
    }
    if (this.particles.length > 460) {
      this.particles.splice(0, this.particles.length - 460);
    }
  }

  milkSplash(x: number, y: number, power = 1): void {
    this.burst(x, y, 'milk', power);
    this.ring(x, y, 10, 58 * power, 24, 'rgba(255, 251, 238, 0.7)', 4);
  }

  dust(x: number, y: number, amount = 4): void {
    for (let i = 0; i < amount; i += 1) {
      this.smoke.push({
        x: x + rand(-14, 14),
        y: y + rand(-4, 4),
        vx: rand(-0.8, 0.8),
        vy: rand(-1.2, -0.3),
        radius: rand(4, 10),
        life: rand(20, 38),
        maxLife: 38,
        color: 'rgba(201, 187, 160, 0.5)',
      });
    }
  }

  ring(
    x: number,
    y: number,
    startRadius: number,
    maxRadius: number,
    life: number,
    color: string,
    width = 5,
  ): void {
    this.rings.push({ x, y, radius: startRadius, maxRadius, life, maxLife: life, color, width });
  }

  text(x: number, y: number, text: string, color = '#FFF9E8', size = 24): void {
    this.texts.push({
      x,
      y,
      text,
      color,
      life: 66,
      maxLife: 66,
      size,
      rise: 0.55,
    });
  }

  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.rot += p.vr;
      p.life -= 1;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.smoke.length - 1; i >= 0; i -= 1) {
      const s = this.smoke[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.98;
      s.vy *= 0.98;
      s.radius += 0.34;
      s.life -= 1;
      if (s.life <= 0) this.smoke.splice(i, 1);
    }

    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const r = this.rings[i];
      const t = 1 - r.life / r.maxLife;
      r.radius = r.maxRadius * (0.18 + 0.82 * (1 - Math.pow(1 - t, 2)));
      r.life -= 1;
      if (r.life <= 0) this.rings.splice(i, 1);
    }

    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const t = this.texts[i];
      t.y -= t.rise;
      t.rise *= 0.992;
      t.life -= 1;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const s of this.smoke) {
      const t = s.life / s.maxLife;
      ctx.globalAlpha = t * 0.55;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * (1.6 - t * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const p of this.particles) {
      const alpha = Math.min(1, p.life / (p.maxLife * 0.55));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle' || p.shape === 'drop') {
        ctx.beginPath();
        if (p.shape === 'drop') {
          ctx.moveTo(0, -p.size * 1.6);
          ctx.quadraticCurveTo(p.size * 1.05, p.size * 0.2, 0, p.size * 1.25);
          ctx.quadraticCurveTo(-p.size * 1.05, p.size * 0.2, 0, -p.size * 1.6);
        } else {
          ctx.arc(0, 0, p.size, 0, TAU);
        }
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const rad = i % 2 === 0 ? p.size * 1.7 : p.size * 0.72;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'shard') {
        ctx.beginPath();
        ctx.moveTo(-p.size, p.size * 0.7);
        ctx.lineTo(p.size * 0.9, 0);
        ctx.lineTo(-p.size * 0.4, -p.size);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (const r of this.rings) {
      ctx.globalAlpha = Math.min(1, r.life / (r.maxLife * 0.7)) * 0.75;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (0.4 + r.life / r.maxLife);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const t of this.texts) {
      const alpha = Math.min(1, t.life / (t.maxLife * 0.5));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${t.size}px "Baloo 2", "Comic Sans MS", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(4, t.size * 0.18);
      ctx.strokeStyle = 'rgba(66, 44, 27, 0.78)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }
}
