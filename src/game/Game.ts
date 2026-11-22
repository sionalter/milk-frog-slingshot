import Matter from 'matter-js';
import type { AudioManager } from './audio';
import { drawBackground, drawBlock, drawFrog, drawGround, drawSlingBack, drawSlingFront } from './art';
import {
  BIRD_RADIUS,
  GROUND_Y,
  LAUNCH_SCALE,
  MAX_PULL,
  SLING_ANCHOR_Y,
  SLING_X,
  STEP_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import { Effects } from './effects';
import { LEVELS } from './levels';
import type { BirdRuntime, BirdType, BodyMeta, GameCallbacks, Material } from './types';
import { clamp, rand, roundRectPath, TAU } from './utils';

const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;

type Phase = 'ready' | 'aiming' | 'flying' | 'settling' | 'ending' | 'won' | 'lost';

const MATERIAL_INFO: Record<
  Material,
  { hp: number; density: number; score: number; sound: 'wood' | 'glass' | 'stone'; vuln: number }
> = {
  wood: { hp: 108, density: 0.0018, score: 150, sound: 'wood', vuln: 1 },
  glass: { hp: 48, density: 0.0015, score: 100, sound: 'glass', vuln: 1.65 },
  stone: { hp: 235, density: 0.0032, score: 250, sound: 'stone', vuln: 0.58 },
};

const BIRD_SKILL_COLORS: Record<BirdType, string> = {
  cream: '#FFF4CF',
  matcha: '#E9F7C9',
  strawberry: '#FFE3EA',
};

interface AimState {
  pointerId: number;
  pullX: number;
  pullY: number;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audio: AudioManager;
  private callbacks: GameCallbacks;

  private engine: Matter.Engine;
  private world: Matter.Composite;
  private meta = new Map<Matter.Body, BodyMeta>();
  private blocks = new Set<Matter.Body>();
  private enemies = new Set<Matter.Body>();
  private birds = new Map<Matter.Body, BirdRuntime>();

  private previewEngine: Matter.Engine;
  private previewBody: Matter.Body;

  private effects = new Effects();
  private levelIndex = 0;
  private level = LEVELS[0];
  private phase: Phase = 'ready';
  private ammoQueue: BirdType[] = [];
  private currentBird: BirdType | null = null;
  private score = 0;

  private aim: AimState = { pointerId: -1, pullX: 0, pullY: 0 };
  private skillAvailable = false;
  private paused = false;
  private interactive = false;
  private pendingWin = false;
  private winTimer = 0;
  private settleTimer = 0;
  private loseTimer = 0;
  private shake = 0;
  private time = 0;
  private dpr = 1;
  private lastFrame = 0;
  private accumulator = 0;

  constructor(canvas: HTMLCanvasElement, audio: AudioManager, callbacks: GameCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.audio = audio;
    this.callbacks = callbacks;

    this.engine = Engine.create({ enableSleeping: true });
    this.engine.gravity.y = 1;
    this.engine.positionIterations = 8;
    this.engine.velocityIterations = 6;
    this.world = this.engine.world;

    this.previewEngine = Engine.create();
    this.previewBody = Bodies.circle(0, 0, BIRD_RADIUS, { density: 0.003, frictionAir: 0.01 });
    Composite.add(this.previewEngine.world, this.previewBody);

    Events.on(this.engine, 'collisionStart', this.handleCollision);
    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.startLoop();
  }

  get levelNumber(): number {
    return this.level.id;
  }

  get currentLevelIndex(): number {
    return this.levelIndex;
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  previewLevel(index = 0): void {
    this.buildLevel(clamp(index, 0, LEVELS.length - 1));
    this.callbacks.onScore(0);
    this.callbacks.onEnemies(this.enemies.size);
    this.interactive = false;
  }

  startLevel(index: number): void {
    this.buildLevel(clamp(index, 0, LEVELS.length - 1));
    this.interactive = true;
    this.callbacks.onScore(0);
    this.callbacks.onEnemies(this.enemies.size);
    this.callbacks.onLevelState('playing');
    this.callbacks.onToast(`第 ${this.level.id} 关 · ${this.level.name} — ${this.level.tagline}`);
  }

  setInteractive(value: boolean): void {
    this.interactive = value;
    if (!value) this.cancelAim();
  }

  setPaused(value: boolean): void {
    this.paused = value;
    if (value) this.cancelAim();
  }

  useSkill(): void {
    if (this.paused || !this.interactive || this.phase !== 'flying' || !this.skillAvailable) return;
    let primary: [Matter.Body, BirdRuntime] | null = null;
    for (const entry of this.birds) {
      if (!entry[1].clone && !this.meta.get(entry[0])?.skillUsed) {
        primary = entry;
        break;
      }
    }
    if (!primary) return;
    const [body, runtime] = primary;
    const meta = this.meta.get(body);
    if (!meta) return;
    meta.skillUsed = true;
    this.skillAvailable = false;
    this.callbacks.onSkill(false, null);

    const pos = body.position;
    const velocity = body.velocity;
    const type = runtime.type;

    if (type === 'cream') {
      const speed = Math.max(8, Body.getSpeed(body));
      const dir = speed > 0.4 ? { x: velocity.x / speed, y: velocity.y / speed } : { x: 1, y: -0.25 };
      const boost = Math.min(27, speed * 1.75 + 3);
      Body.setVelocity(body, { x: dir.x * boost, y: dir.y * boost - 1.4 });
      Sleeping.set(body, false);
      this.effects.ring(pos.x, pos.y, 8, 52, 20, 'rgba(255, 246, 214, 0.8)', 5);
      this.effects.burst(pos.x, pos.y, 'milk', 0.9);
      this.effects.text(pos.x, pos.y - 42, '奶力冲刺！', BIRD_SKILL_COLORS.cream, 24);
      this.audio.play('dash');
      this.shake = Math.max(this.shake, 4);
    } else if (type === 'matcha') {
      const speed = Math.max(6, Body.getSpeed(body));
      const baseAngle = Math.atan2(velocity.y, velocity.x);
      for (const side of [-1, 1]) {
        const angle = baseAngle + side * 0.2;
        const clone = Bodies.circle(pos.x + side * 14, pos.y + side * 3, 15, {
          density: 0.0052,
          frictionAir: 0.01,
          friction: 0.3,
          restitution: 0.35,
          label: 'bird',
        });
        Body.setVelocity(clone, {
          x: Math.cos(angle) * speed * 0.92,
          y: Math.sin(angle) * speed * 0.92,
        });
        Body.setAngularVelocity(clone, side * 0.18);
        Composite.add(this.world, clone);
        this.meta.set(clone, {
          kind: 'bird',
          r: 15,
          birdType: 'matcha',
          clone: true,
          skillUsed: true,
        });
        this.birds.set(clone, {
          type: 'matcha',
          clone: true,
          age: 0,
          idle: 0,
          trail: [],
        });
      }
      this.effects.burst(pos.x, pos.y, 'matcha', 1);
      this.effects.milkSplash(pos.x, pos.y, 0.65);
      this.effects.text(pos.x, pos.y - 44, '一分为三！', BIRD_SKILL_COLORS.matcha, 24);
      this.audio.play('split');
      this.shake = Math.max(this.shake, 3);
    } else {
      this.explode(pos.x, pos.y, 170);
      this.removeBird(body, false);
    }
  }

  private buildLevel(index: number): void {
    this.levelIndex = index;
    this.level = LEVELS[index];
    Composite.clear(this.world, false, true);
    this.meta.clear();
    this.blocks.clear();
    this.enemies.clear();
    this.birds.clear();
    this.effects.reset();
    this.phase = 'ready';
    this.aim = { pointerId: -1, pullX: 0, pullY: 0 };
    this.currentBird = null;
    this.ammoQueue = this.level.ammo.slice();
    this.score = 0;
    this.pendingWin = false;
    this.winTimer = 0;
    this.settleTimer = 0;
    this.loseTimer = 0;
    this.skillAvailable = false;
    this.shake = 0;

    const ground = Bodies.rectangle(WORLD_WIDTH / 2, GROUND_Y + 90, WORLD_WIDTH + 800, 180, {
      isStatic: true,
      friction: 0.95,
      restitution: 0,
      label: 'ground',
    });
    const leftWall = Bodies.rectangle(-40, 320, 80, 1000, { isStatic: true, label: 'wall' });
    const rightWall = Bodies.rectangle(WORLD_WIDTH + 40, 320, 80, 1000, { isStatic: true, label: 'wall' });
    Composite.add(this.world, [ground, leftWall, rightWall]);

    for (const def of this.level.blocks) {
      const info = MATERIAL_INFO[def.material];
      const areaScale = clamp(Math.sqrt((def.w * def.h) / 3200), 0.72, 1.5);
      const hp = info.hp * areaScale;
      const block = Bodies.rectangle(def.x, def.y, def.w, def.h, {
        chamfer: { radius: Math.min(5, Math.min(def.w, def.h) * 0.2) },
        density: info.density,
        friction: 0.68,
        frictionStatic: 0.9,
        restitution: 0.02,
        slop: 0.02,
        angle: def.angle ?? 0,
        label: 'block',
      });
      Composite.add(this.world, block);
      this.meta.set(block, {
        kind: 'block',
        material: def.material,
        w: def.w,
        h: def.h,
        hp,
        maxHp: hp,
        seed: Math.floor(rand(1, 999999)),
      });
      this.blocks.add(block);
    }

    for (const def of this.level.enemies) {
      const radius = def.r ?? 24;
      const hp = 70;
      const enemy = Bodies.circle(def.x, def.y, radius, {
        density: 0.0019,
        friction: 0.62,
        frictionStatic: 0.8,
        restitution: 0.08,
        slop: 0.02,
        label: 'enemy',
      });
      Composite.add(this.world, enemy);
      this.meta.set(enemy, {
        kind: 'enemy',
        r: radius,
        hp,
        maxHp: hp,
        seed: Math.floor(rand(1, 999999)),
      });
      this.enemies.add(enemy);
    }

    this.loadNextBird();
  }

  private loadNextBird(): void {
    this.currentBird = this.ammoQueue.shift() ?? null;
    this.phase = this.currentBird ? 'ready' : 'settling';
    this.skillAvailable = false;
    this.callbacks.onSkill(false, null);
    this.callbacks.onBirds(this.ammoQueue.length, this.currentBird);
  }

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private toWorld(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT,
    };
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.interactive || this.paused || this.pendingWin) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.audio.unlock();

    if (this.phase === 'flying') {
      this.useSkill();
      return;
    }

    if (this.phase !== 'ready' || !this.currentBird) return;
    const point = this.toWorld(event);
    const distanceFromSling = Math.hypot(point.x - SLING_X, point.y - SLING_ANCHOR_Y);
    if (distanceFromSling > 240 && point.x > 500) return;

    this.phase = 'aiming';
    this.aim = { pointerId: event.pointerId, pullX: 0, pullY: 0 };
    this.canvas.classList.add('aiming');
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture can fail on some embedded browsers */
    }
    this.updateAim(point);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.interactive || this.paused || this.phase !== 'aiming') return;
    if (event.pointerId !== this.aim.pointerId) return;
    this.updateAim(this.toWorld(event));
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.phase !== 'aiming' || event.pointerId !== this.aim.pointerId) return;
    if (!this.interactive || this.paused) {
      this.cancelAim();
      return;
    }
    const pull = Math.hypot(this.aim.pullX, this.aim.pullY);
    if (pull >= 16 && this.currentBird) this.launchBird();
    else this.cancelAim();
  };

  private updateAim(point: { x: number; y: number }): void {
    let dx = point.x - SLING_X;
    let dy = point.y - SLING_ANCHOR_Y;
    dx = Math.min(dx, 28);
    const distance = Math.hypot(dx, dy);
    if (distance > MAX_PULL) {
      const scale = MAX_PULL / distance;
      dx *= scale;
      dy *= scale;
    }
    this.aim.pullX = dx;
    this.aim.pullY = dy;
  }

  private cancelAim(): void {
    if (this.phase === 'aiming') {
      this.phase = this.currentBird ? 'ready' : 'settling';
    }
    this.aim = { pointerId: -1, pullX: 0, pullY: 0 };
    this.canvas.classList.remove('aiming');
  }

  private launchBird(): void {
    const type = this.currentBird;
    if (!type) return;
    const pullX = this.aim.pullX;
    const pullY = this.aim.pullY;
    const origin = {
      x: SLING_X + pullX,
      y: SLING_ANCHOR_Y + pullY,
    };
    const body = Bodies.circle(origin.x, origin.y, BIRD_RADIUS, {
      density: 0.003,
      frictionAir: 0.01,
      friction: 0.45,
      frictionStatic: 0.6,
      restitution: 0.3,
      slop: 0.02,
      label: 'bird',
    });
    const vx = -pullX * LAUNCH_SCALE;
    const vy = -pullY * LAUNCH_SCALE;
    Body.setVelocity(body, { x: vx, y: vy });
    Body.setAngularVelocity(body, clamp(vx * 0.006, -0.12, 0.12));
    Composite.add(this.world, body);
    this.meta.set(body, {
      kind: 'bird',
      r: BIRD_RADIUS,
      birdType: type,
      skillUsed: false,
      clone: false,
    });
    this.birds.set(body, {
      type,
      clone: false,
      age: 0,
      idle: 0,
      trail: [{ x: origin.x, y: origin.y }],
    });

    this.effects.milkSplash(origin.x, origin.y + 10, 0.6);
    this.effects.ring(origin.x, origin.y, 6, 30, 16, 'rgba(255, 249, 231, 0.55)', 3);
    this.audio.play('launch');

    this.currentBird = null;
    this.aim = { pointerId: -1, pullX: 0, pullY: 0 };
    this.canvas.classList.remove('aiming');
    this.phase = 'flying';
    this.skillAvailable = true;
    this.callbacks.onBirds(this.ammoQueue.length, null);
    this.callbacks.onSkill(true, type);
  }

  private simulateTrajectory(
    origin: { x: number; y: number },
    velocity: { x: number; y: number },
  ): { x: number; y: number }[] {
    const body = this.previewBody;
    Body.setPosition(body, origin);
    Body.setVelocity(body, velocity);
    Body.setAngularVelocity(body, 0);
    Body.setAngle(body, 0);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 96; i += 1) {
      Engine.update(this.previewEngine, STEP_MS);
      if (i % 4 === 0) points.push({ x: body.position.x, y: body.position.y });
      if (body.position.y > GROUND_Y - 8 || body.position.x > WORLD_WIDTH - 18) break;
    }
    return points;
  }

  private handleCollision = (event: Matter.IEventCollision<Matter.Engine>): void => {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      if (a.isStatic && b.isStatic) continue;
      const metaA = this.meta.get(a);
      const metaB = this.meta.get(b);
      if (!metaA && !metaB) continue;

      const speed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (speed < 1.3) continue;
      const supports = pair.collision.supports;
      const point = supports?.[0] ?? {
        x: (a.position.x + b.position.x) / 2,
        y: (a.position.y + b.position.y) / 2,
      };
      const involvesBird = metaA?.kind === 'bird' || metaB?.kind === 'bird';
      const material = metaA?.material ?? metaB?.material;

      if (speed > 4.2) {
        if (material && Math.random() < 0.7) {
          this.effects.burst(point.x, point.y, material, Math.min(1, speed / 14));
        } else if (involvesBird) {
          this.effects.dust(point.x, point.y, 2);
        }
        if (speed > 6.5) {
          this.shake = Math.max(this.shake, Math.min(9, speed * 0.38));
          this.audio.play('thud');
        }
      }

      this.applyDamage(a, metaA, b, metaB, speed);
      this.applyDamage(b, metaB, a, metaA, speed);
    }
  };

  private applyDamage(
    target: Matter.Body,
    targetMeta: BodyMeta | undefined,
    other: Matter.Body,
    otherMeta: BodyMeta | undefined,
    speed: number,
  ): void {
    if (!targetMeta || targetMeta.dead) return;
    if (targetMeta.kind !== 'block' && targetMeta.kind !== 'enemy') return;
    if (speed < 2.2) return;

    const otherMass = other.isStatic ? 2.2 : Math.min(12, other.mass);
    const fromBird = otherMeta?.kind === 'bird';
    let damage = 0;

    if (targetMeta.kind === 'enemy') {
      damage = Math.max(0, speed - 1.8) * otherMass * 2.6 * (fromBird ? 1.15 : 0.78);
    } else {
      const material = targetMeta.material ?? 'wood';
      let multiplier = fromBird ? 1.12 : 0.5;
      if (other.isStatic) multiplier = 0.22;
      if (otherMeta?.kind === 'enemy') multiplier = 0.45;
      damage =
        Math.max(0, speed - 2.4) * otherMass * 2.3 * multiplier * MATERIAL_INFO[material].vuln;
    }

    if (damage < 1) return;
    const pos = target.position;
    const destroyed = this.harm(target, targetMeta, damage);
    if (!destroyed && damage > 14) {
      if (targetMeta.kind === 'enemy') {
        this.audio.play('thud');
        this.effects.milkSplash(pos.x, pos.y, 0.35);
      } else if (targetMeta.material) {
        this.audio.play(MATERIAL_INFO[targetMeta.material].sound);
        this.effects.burst(
          pos.x,
          pos.y,
          targetMeta.material,
          Math.min(0.9, 0.35 + damage / 200),
        );
      }
    }
  }

  private harm(body: Matter.Body, meta: BodyMeta, damage: number): boolean {
    if (meta.dead || meta.hp === undefined) return false;
    meta.hp -= damage;
    meta.flash = 1;
    if (meta.hp > 0) return false;
    meta.dead = true;
    if (meta.kind === 'block') this.destroyBlock(body, meta);
    else if (meta.kind === 'enemy') this.destroyEnemy(body, meta);
    return true;
  }

  private wakeWorld(): void {
    for (const body of this.blocks) Sleeping.set(body, false);
    for (const body of this.enemies) Sleeping.set(body, false);
    for (const body of this.birds.keys()) Sleeping.set(body, false);
  }

  private destroyBlock(body: Matter.Body, meta: BodyMeta): void {
    const material = meta.material ?? 'wood';
    const info = MATERIAL_INFO[material];
    Composite.remove(this.world, body);
    this.blocks.delete(body);
    this.meta.delete(body);
    this.wakeWorld();
    this.score += info.score;
    this.callbacks.onScore(Math.round(this.score));
    const pos = body.position;
    this.effects.burst(pos.x, pos.y, material, 1.35);
    this.effects.dust(pos.x, pos.y, 4);
    this.effects.text(pos.x, pos.y - 14, `+${info.score}`, '#FFF6DD', 21);
    this.audio.play(info.sound);
    this.shake = Math.max(this.shake, material === 'stone' ? 5.5 : 3.2);
  }

  private destroyEnemy(body: Matter.Body, meta: BodyMeta): void {
    Composite.remove(this.world, body);
    this.enemies.delete(body);
    this.meta.delete(body);
    this.wakeWorld();
    const pos = body.position;
    this.score += 1000;
    this.callbacks.onScore(Math.round(this.score));
    this.callbacks.onEnemies(this.enemies.size);
    this.effects.burst(pos.x, pos.y, 'choco', 1.4);
    this.effects.burst(pos.x, pos.y, 'milk', 0.9);
    this.effects.burst(pos.x, pos.y, 'gold', 0.8);
    this.effects.ring(pos.x, pos.y, 8, 76, 26, 'rgba(255, 233, 156, 0.8)', 5);
    this.effects.text(pos.x, pos.y - 30, '+1000', '#FFE59B', 28);
    this.audio.play('pop');
    this.shake = Math.max(this.shake, 5);
    if (meta.hp !== undefined) meta.hp = 0;

    if (this.enemies.size === 0 && !this.pendingWin) {
      this.pendingWin = true;
      this.winTimer = 82;
      this.audio.play('star');
    }
  }

  private explode(x: number, y: number, radius: number): void {
    this.effects.ring(x, y, 18, radius * 1.2, 28, 'rgba(255, 252, 240, 0.92)', 11);
    this.effects.ring(x, y, 12, radius * 0.8, 18, 'rgba(255, 220, 146, 0.75)', 6);
    this.effects.milkSplash(x, y, 1.8);
    this.effects.burst(x, y, 'milk', 2.1);
    this.effects.burst(x, y, 'gold', 1.2);
    this.effects.text(x, y - 54, '奶泡爆裂！', BIRD_SKILL_COLORS.strawberry, 26);
    this.audio.play('explode');
    this.shake = Math.max(this.shake, 15);

    for (const [body, meta] of [...this.meta]) {
      if (meta.dead || (meta.kind !== 'block' && meta.kind !== 'enemy')) continue;
      const dx = body.position.x - x;
      const dy = body.position.y - y;
      const distance = Math.hypot(dx, dy);
      if (distance > radius + 28) continue;
      const falloff = clamp(1 - distance / radius, 0.18, 1);
      const nx = distance > 0.01 ? dx / distance : 1;
      const ny = distance > 0.01 ? dy / distance : -0.2;
      const push = 12 * falloff;
      Sleeping.set(body, false);
      Body.setVelocity(body, {
        x: body.velocity.x + nx * push,
        y: body.velocity.y + ny * push - 2.2 * falloff,
      });
      Body.setAngularVelocity(body, body.angularVelocity + rand(-0.22, 0.22) * falloff);
      const vulnerability =
        meta.kind === 'enemy'
          ? 1
          : meta.material === 'glass'
            ? 1.45
            : meta.material === 'stone'
              ? 0.72
              : 1;
      const damage = (meta.kind === 'enemy' ? 170 : 150) * falloff * vulnerability;
      this.harm(body, meta, damage);
    }
    this.wakeWorld();
  }

  private removeBird(body: Matter.Body, poof: boolean): void {
    const runtime = this.birds.get(body);
    const pos = body.position;
    Composite.remove(this.world, body);
    this.birds.delete(body);
    this.meta.delete(body);
    if (poof) {
      this.effects.dust(pos.x, pos.y, 3);
      this.effects.milkSplash(pos.x, pos.y, 0.35);
    }
    if (runtime && !runtime.clone && this.skillAvailable) {
      this.skillAvailable = false;
      this.callbacks.onSkill(false, null);
    }
  }

  private updateBirds(): void {
    for (const [body, runtime] of [...this.birds]) {
      runtime.age += 1;
      const speed = Body.getSpeed(body);
      if (speed < 1.35) runtime.idle += 1;
      else runtime.idle = 0;

      if (runtime.age % 3 === 0) {
        runtime.trail.push({ x: body.position.x, y: body.position.y });
        if (runtime.trail.length > 24) runtime.trail.shift();
      }

      const outOfBounds =
        body.position.y > WORLD_HEIGHT + 140 ||
        body.position.x < -110 ||
        body.position.x > WORLD_WIDTH + 130;
      const groundedAndSlow = body.position.y > GROUND_Y - 4 && speed < 2.2;
      if (outOfBounds || runtime.idle > 34 || runtime.age > 430 || (groundedAndSlow && runtime.idle > 20)) {
        this.removeBird(body, true);
      }
    }

    if (this.phase === 'flying' && this.birds.size === 0) {
      this.phase = 'settling';
      this.settleTimer = 42;
      this.callbacks.onSkill(false, null);
    }
  }

  private updateFlow(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;

    if (this.pendingWin) {
      this.winTimer -= 1;
      if (this.winTimer <= 0) {
        this.finishWin();
        return;
      }
    }

    if (this.phase === 'settling') {
      this.settleTimer -= 1;
      if (this.settleTimer <= 0) {
        if (this.enemies.size === 0) {
          if (!this.pendingWin) {
            this.pendingWin = true;
            this.winTimer = 24;
          }
        } else if (this.ammoQueue.length > 0) {
          this.loadNextBird();
        } else {
          this.phase = 'ending';
          this.loseTimer = 120;
        }
      }
    }

    if (this.phase === 'ending') {
      this.loseTimer -= 1;
      if (this.enemies.size === 0) {
        if (!this.pendingWin) {
          this.pendingWin = true;
          this.winTimer = 20;
        }
      } else if (this.loseTimer <= 0) {
        this.finishLose();
      }
    }
  }

  private finishWin(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.phase = 'won';
    this.skillAvailable = false;
    this.callbacks.onSkill(false, null);
    const unused = this.ammoQueue.length + (this.currentBird ? 1 : 0);
    const bonus = unused * 750;
    if (bonus > 0) {
      this.score += bonus;
      this.callbacks.onScore(Math.round(this.score));
      this.effects.text(WORLD_WIDTH / 2, 300, `剩余奶娃 +${bonus}`, '#FFE49A', 32);
    }
    const stars = this.score >= this.level.star3 ? 3 : this.score >= this.level.star2 ? 2 : 1;
    this.pendingWin = false;
    this.audio.play('win');
    this.callbacks.onLevelState('won', { stars, score: Math.round(this.score), unused });
  }

  private finishLose(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.phase = 'lost';
    this.pendingWin = false;
    this.skillAvailable = false;
    this.callbacks.onSkill(false, null);
    this.audio.play('lose');
    this.callbacks.onLevelState('lost', { stars: 0, score: Math.round(this.score), unused: 0 });
  }

  private resize = (): void => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(WORLD_WIDTH * this.dpr);
    this.canvas.height = Math.round(WORLD_HEIGHT * this.dpr);
  };

  private startLoop(): void {
    const frame = (now: number): void => {
      if (!this.lastFrame) this.lastFrame = now;
      const delta = Math.min(64, now - this.lastFrame);
      this.lastFrame = now;
      if (!this.paused) {
        this.accumulator += delta;
        let steps = 0;
        while (this.accumulator >= STEP_MS && steps < 4) {
          this.step();
          this.accumulator -= STEP_MS;
          steps += 1;
        }
      }
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private step(): void {
    this.time += STEP_MS / 1000;
    Engine.update(this.engine, STEP_MS);
    for (const meta of this.meta.values()) {
      if (meta.flash && meta.flash > 0) {
        meta.flash = Math.max(0, meta.flash - 0.075);
      }
    }
    this.effects.update();
    this.shake *= 0.9;
    if (this.shake < 0.08) this.shake = 0;
    this.updateBirds();
    this.updateFlow();
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawBackground(ctx, this.time, this.level.accent);
    drawGround(ctx, this.time, this.level.accent);

    ctx.save();
    if (this.shake > 0.1) {
      ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    }

    const held = this.phase === 'aiming' || this.phase === 'ready';
    const frogPos = {
      x: SLING_X + (this.phase === 'aiming' ? this.aim.pullX : 0),
      y: SLING_ANCHOR_Y + (this.phase === 'aiming' ? this.aim.pullY : 0),
    };
    const pouch = this.currentBird ? { x: frogPos.x, y: frogPos.y + 15 } : null;
    drawSlingBack(ctx, pouch);

    for (const body of this.blocks) {
      const meta = this.meta.get(body);
      if (!meta || meta.dead) continue;
      const ratio = meta.maxHp ? (meta.hp ?? 0) / meta.maxHp : 1;
      drawBlock(
        ctx,
        body.position.x,
        body.position.y,
        meta.w ?? 20,
        meta.h ?? 20,
        body.angle,
        meta.material ?? 'wood',
        ratio,
        meta.seed ?? 1,
        meta.flash ?? 0,
      );
    }

    const lookTarget = this.birds.size > 0 ? [...this.birds.keys()][0].position : null;
    for (const body of this.enemies) {
      const meta = this.meta.get(body);
      if (!meta || meta.dead) continue;
      const target = lookTarget ?? { x: SLING_X, y: SLING_ANCHOR_Y };
      const dx = target.x - body.position.x;
      const dy = target.y - body.position.y;
      const distance = Math.hypot(dx, dy) || 1;
      const blink = ((this.time + (body.id % 17) * 0.22) % 3.8) > 3.62;
      drawFrog(ctx, {
        x: body.position.x,
        y: body.position.y,
        r: meta.r ?? 24,
        enemy: true,
        angle: clamp(body.angle, -0.55, 0.55),
        expression: (meta.hp ?? 0) / (meta.maxHp ?? 1) < 0.35 ? 'hurt' : 'angry',
        blink,
        lookX: clamp(dx / distance, -1, 1) * 0.9,
        lookY: clamp(dy / distance, -1, 1) * 0.55,
        shadow: true,
        flash: meta.flash ?? 0,
      });
    }

    for (const [body, runtime] of this.birds) {
      const meta = this.meta.get(body);
      if (!meta) continue;
      for (let i = 0; i < runtime.trail.length; i += 1) {
        const point = runtime.trail[i];
        const t = i / runtime.trail.length;
        ctx.globalAlpha = 0.32 * t;
        ctx.fillStyle = runtime.type === 'matcha' ? '#DDF0BB' : runtime.type === 'strawberry' ? '#FFDCE5' : '#FFF8E6';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2 + t * 6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const speed = Body.getSpeed(body);
      if (speed > 7) {
        const vx = body.velocity.x / speed;
        const vy = body.velocity.y / speed;
        ctx.strokeStyle = 'rgba(255, 252, 238, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i += 1) {
          const offset = (i - 1) * 9;
          const bx = body.position.x - vx * 30 + -vy * offset;
          const by = body.position.y - vy * 30 + vx * offset;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - vx * (14 + i * 5), by - vy * (14 + i * 5));
          ctx.stroke();
        }
      }

      drawFrog(ctx, {
        x: body.position.x,
        y: body.position.y,
        r: meta.r ?? BIRD_RADIUS,
        type: runtime.type,
        angle: clamp(body.angle, -1.6, 1.6),
        expression: 'determined',
        lookX: clamp(body.velocity.x / 12, -1, 1),
        lookY: clamp(body.velocity.y / 12, -1, 1) * 0.6,
        blink: false,
        flash: meta.flash ?? 0,
      });
    }

    if (this.currentBird && held) {
      const power = Math.hypot(this.aim.pullX, this.aim.pullY) / MAX_PULL;
      const blink = ((this.time + 1.1) % 4.4) > 4.2;
      drawFrog(ctx, {
        x: frogPos.x,
        y: frogPos.y,
        r: BIRD_RADIUS,
        type: this.currentBird,
        expression: this.phase === 'aiming' ? 'determined' : 'normal',
        blink,
        lookX: clamp(0.8 - this.aim.pullX / 260, -0.4, 1),
        lookY: clamp(this.aim.pullY / 180, -0.55, 0.55),
        scaleX: 1 + power * 0.06,
        scaleY: 1 - power * 0.06,
        flash: 0,
      });
    }

    drawSlingFront(ctx, pouch);

    if (this.phase === 'aiming' && this.currentBird) {
      const origin = { x: frogPos.x, y: frogPos.y };
      const velocity = {
        x: -this.aim.pullX * LAUNCH_SCALE,
        y: -this.aim.pullY * LAUNCH_SCALE,
      };
      const points = this.simulateTrajectory(origin, velocity);
      const power = Math.hypot(this.aim.pullX, this.aim.pullY) / MAX_PULL;
      for (let i = 0; i < points.length; i += 1) {
        const t = i / points.length;
        ctx.globalAlpha = 0.95 * (1 - t * 0.5);
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, 5.2 - t * 2.2, 0, TAU);
        ctx.fillStyle = power > 0.82 ? '#FFD97A' : '#FFF8E5';
        ctx.fill();
        ctx.strokeStyle = 'rgba(105, 76, 47, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    this.effects.draw(ctx);
    ctx.restore();

    this.drawAmmoQueue(ctx);
  }

  private drawAmmoQueue(ctx: CanvasRenderingContext2D): void {
    if (this.ammoQueue.length === 0) return;
    const count = this.ammoQueue.length;
    const spacing = 27;
    const width = count * spacing + 40;
    const x = 20;
    const y = 650;
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = 'rgba(255, 250, 238, 0.62)';
    ctx.strokeStyle = 'rgba(92, 69, 51, 0.22)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, width, 56, 20);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7C6550';
    ctx.font = '800 11px "Baloo 2", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('待发射', x + 14, y + 10);
    for (let i = 0; i < count; i += 1) {
      const bob = Math.sin(this.time * 3 + i * 0.9) * 1.6;
      drawFrog(ctx, {
        x: x + 27 + i * spacing,
        y: y + 34 + bob,
        r: 11.5,
        type: this.ammoQueue[i],
        expression: 'normal',
        lookX: 0.7,
        lookY: 0,
      });
    }
    ctx.restore();
  }
}
