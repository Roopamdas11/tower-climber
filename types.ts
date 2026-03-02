
export enum BiomeType {
  GRASSLAND = 'GRASSLAND',
  DESERT = 'DESERT',
  ICE = 'ICE',
  SKY = 'SKY',
  SPACE = 'SPACE'
}

export enum WeaponType {
  NONE = 'NONE',
  BLASTER = 'BLASTER',
  PLASMA = 'PLASMA'
}

export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bullet extends GameObject {
  vx: number;
  vy: number;
  active: boolean;
  color: string;
}

export interface Player extends GameObject {
  vx: number;
  vy: number;
  isJumping: boolean;
  score: number;
  maxHeight: number;
  facing: 'left' | 'right';
  animFrame: number;
  scaleX: number;
  scaleY: number;
  jetpackFuel: number;
  maxJetpackFuel: number;
  isJetpacking: boolean;
  isHoldingJump: boolean;
  jumpHoldTime: number;
  health: number;
  maxHealth: number;
  weapon: WeaponType;
  lastFired: number;
  jumpCharge: number;
  maxJumpCharge: number;
  isJetpackEnabled: boolean;
  coyoteTime: number;
  lastSafeY: number;
  lastSafeX: number;
}

export interface Platform extends GameObject {
  type: 'standard' | 'moving' | 'fragile' | 'one-way';
  initialX?: number;
  speed?: number;
  broken?: boolean;
  opacity?: number;
  deformationY?: number;
}

export interface Coin extends GameObject {
  collected: boolean;
  value: number;
  floatOffset: number;
}

export interface Heart extends GameObject {
  collected: boolean;
  floatOffset: number;
}

export interface FuelPickup extends GameObject {
  collected: boolean;
  floatOffset: number;
}

export interface WeaponPickup extends GameObject {
  type: WeaponType;
  collected: boolean;
  floatOffset: number;
}

export interface Enemy extends GameObject {
  vx: number;
  vy: number;
  type: 'patrol' | 'flyer' | 'chaser';
  biome: BiomeType;
  health: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  glow?: boolean;
}

export interface GameState {
  player: Player;
  platforms: Platform[];
  coins: Coin[];
  hearts: Heart[];
  fuelPacks: FuelPickup[];
  pickups: WeaponPickup[];
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  cameraY: number;
  screenShake: number;
  isGameOver: boolean;
  currentBiome: BiomeType;
  levelGeneratedUntil: number;
  lastPlatformY: number;
}
