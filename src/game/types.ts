export type Material = 'wood' | 'glass' | 'stone';

export type BirdType = 'cream' | 'matcha' | 'strawberry';

export interface BlockDef {
  x: number;
  y: number;
  w: number;
  h: number;
  material: Material;
  angle?: number;
}

export interface EnemyDef {
  x: number;
  y: number;
  r?: number;
}

export interface LevelDef {
  id: number;
  name: string;
  tagline: string;
  ammo: BirdType[];
  blocks: BlockDef[];
  enemies: EnemyDef[];
  star2: number;
  star3: number;
  accent: string;
}

export type BodyKind = 'block' | 'enemy' | 'bird' | 'ground';

export interface BodyMeta {
  kind: BodyKind;
  material?: Material;
  w?: number;
  h?: number;
  r?: number;
  hp?: number;
  maxHp?: number;
  flash?: number;
  seed?: number;
  birdType?: BirdType;
  skillUsed?: boolean;
  clone?: boolean;
  dead?: boolean;
}

export interface BirdRuntime {
  type: BirdType;
  clone: boolean;
  age: number;
  idle: number;
  trail: { x: number; y: number }[];
}

export interface GameResult {
  stars: number;
  score: number;
  unused: number;
}

export interface GameCallbacks {
  onScore(score: number): void;
  onBirds(remaining: number, current: BirdType | null): void;
  onSkill(available: boolean, type: BirdType | null): void;
  onEnemies(remaining: number): void;
  onLevelState(state: 'playing' | 'won' | 'lost', result?: GameResult): void;
  onToast(text: string): void;
}
