
export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 800;
export const GRAVITY = 0.52;
export const MIN_JUMP_FORCE = -17; 
export const MAX_JUMP_FORCE = -31;
export const JETPACK_THRUST = 0.64; 
export const JETPACK_HORIZONTAL_THRUST = 0.32; 
export const JETPACK_DOWN_THRUST = 0.6;
export const FUEL_CONSUMPTION = 0.38;
export const FUEL_REGEN_RATE = 0.15; 
export const PLAYER_SPEED = 8.2; 
export const PLAYER_ACCEL = 0.75;
export const AIR_CONTROL = 0.4; 
export const GROUND_FRICTION = 0.82;
export const EDGE_FRICTION_MULTIPLIER = 0.65;
export const BRAKE_FRICTION = 0.55; 
export const AIR_RESISTANCE = 0.992;
export const CHUNK_SIZE = 2500;
export const TOWER_WIDTH = 550;
export const WALL_WIDTH = 70;

export const RESTORE_COST = 1000;
export const RESET_RECHARGE_MS = 30000;

export const BIOME_CONFIGS = {
  GRASSLAND: {
    bgColor: ['#1a2a6c', '#b21f1f', '#fdbb2d'],
    platformColor: '#3d2b1f',
    grassColor: '#43a047',
    enemyEmoji: '🐢',
    threshold: 0,
    particles: '#81c784'
  },
  DESERT: {
    bgColor: ['#e65100', '#ffb74d'],
    platformColor: '#5d4037',
    grassColor: '#ffd54f',
    enemyEmoji: '🦂',
    threshold: 5000,
    particles: '#ffcc80'
  },
  ICE: {
    bgColor: ['#00b4db', '#0083b0'],
    platformColor: '#37474f',
    grassColor: '#e1f5fe',
    enemyEmoji: '🐧',
    threshold: 12000,
    particles: '#ffffff'
  },
  SKY: {
    bgColor: ['#614385', '#516395'],
    platformColor: '#f5f5f5',
    grassColor: '#e3f2fd',
    enemyEmoji: '🦅',
    threshold: 22000,
    particles: '#b3e5fc'
  },
  SPACE: {
    bgColor: ['#0f0c29', '#302b63', '#24243e'],
    platformColor: '#1a237e',
    grassColor: '#000000',
    enemyEmoji: '👾',
    threshold: 35000,
    particles: '#ea80fc'
  }
};
