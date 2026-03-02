
import React, { useRef, useEffect } from 'react';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  GRAVITY, 
  MIN_JUMP_FORCE,
  MAX_JUMP_FORCE,
  JETPACK_THRUST,
  JETPACK_HORIZONTAL_THRUST,
  JETPACK_DOWN_THRUST,
  FUEL_CONSUMPTION,
  FUEL_REGEN_RATE,
  PLAYER_SPEED, 
  PLAYER_ACCEL,
  AIR_CONTROL,
  GROUND_FRICTION,
  EDGE_FRICTION_MULTIPLIER,
  BRAKE_FRICTION,
  CHUNK_SIZE, 
  BIOME_CONFIGS,
  AIR_RESISTANCE,
  WALL_WIDTH
} from '../constants';
import { Player, Platform, Coin, Enemy, BiomeType, GameState, Particle, Heart, Bullet, WeaponType, WeaponPickup, FuelPickup } from '../types';
import { LevelGenerator } from '../services/LevelGenerator';
import { sounds } from '../services/SoundService';

interface Props {
  onGameOver: (score: number) => void;
  onUpdate: (score: number, height: number, biome: string, fuel: number, health: number, weapon: string, charge: number, coinsInRun: number) => void;
  restartTrigger?: number;
  restoreTrigger?: number;
}

interface VisualState {
  hitFlash: number;
  invulnTimer: number;
}

const GameCanvas: React.FC<Props> = ({ onGameOver, onUpdate, restartTrigger, restoreTrigger }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualRef = useRef<VisualState>({ hitFlash: 0, invulnTimer: 0 });
  const coinsInRun = useRef(0);

  // Touch state
  const touchRef = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    active: false,
    zone: 'none' as 'action' | 'command' | 'none',
    tapTriggered: false
  });

  const stateRef = useRef<GameState>({
    player: {
      x: GAME_WIDTH / 2 - 20, y: GAME_HEIGHT - 100, width: 40, height: 40,
      vx: 0, vy: 0, isJumping: false, score: 0, maxHeight: 0, facing: 'right',
      animFrame: 0, scaleX: 1, scaleY: 1, jetpackFuel: 100, maxJetpackFuel: 100,
      isJetpacking: false, isHoldingJump: false, jumpHoldTime: 0,
      health: 100, maxHealth: 100, weapon: WeaponType.NONE, lastFired: 0,
      jumpCharge: 0, maxJumpCharge: 100, isJetpackEnabled: false,
      coyoteTime: 0, lastSafeX: GAME_WIDTH / 2 - 20, lastSafeY: GAME_HEIGHT - 100
    },
    platforms: [{ x: WALL_WIDTH, y: GAME_HEIGHT - 40, width: GAME_WIDTH - WALL_WIDTH * 2, height: 40, type: 'standard', deformationY: 0 }],
    coins: [], hearts: [], fuelPacks: [], pickups: [], enemies: [], bullets: [], particles: [],
    cameraY: 0, screenShake: 0, isGameOver: false, currentBiome: BiomeType.GRASSLAND,
    levelGeneratedUntil: GAME_HEIGHT - 40, lastPlatformY: GAME_HEIGHT - 40
  });

  useEffect(() => {
    if (restoreTrigger) {
      const p = stateRef.current.player;
      p.x = p.lastSafeX;
      p.y = p.lastSafeY - 20;
      p.vx = 0; p.vy = 0;
      p.health = 100; p.isJumping = false;
      stateRef.current.screenShake = 15;
      createParticles(p.x + p.width/2, p.y + p.height/2, '#00e5ff', 30, true);
      sounds.heart();
    }
  }, [restoreTrigger]);

  useEffect(() => {
    const state = stateRef.current;
    state.player = {
      ...state.player,
      x: GAME_WIDTH / 2 - 20, y: GAME_HEIGHT - 100, vx: 0, vy: 0, score: 0, 
      maxHeight: 0, jetpackFuel: 100, health: 100, weapon: WeaponType.NONE,
      jumpCharge: 0, isJetpackEnabled: false, isJetpacking: false,
      coyoteTime: 0, lastSafeX: GAME_WIDTH / 2 - 20, lastSafeY: GAME_HEIGHT - 100
    };
    state.cameraY = 0; 
    state.platforms = [{ x: WALL_WIDTH, y: GAME_HEIGHT - 40, width: GAME_WIDTH - WALL_WIDTH * 2, height: 40, type: 'standard', deformationY: 0 }];
    state.coins = []; state.hearts = []; state.fuelPacks = []; state.enemies = []; state.bullets = []; state.particles = []; state.pickups = [];
    state.levelGeneratedUntil = GAME_HEIGHT - 40;
    coinsInRun.current = 0;
    visualRef.current = { hitFlash: 0, invulnTimer: 0 };
  }, [restartTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const clientY = touch.clientY - rect.top;
      const clientX = touch.clientX - rect.left;
      
      const isCommandZone = clientY > rect.height * 0.75;
      
      touchRef.current = {
        startX: clientX,
        startY: clientY,
        currentX: clientX,
        currentY: clientY,
        active: true,
        zone: isCommandZone ? 'command' : 'action',
        tapTriggered: !isCommandZone // Immediate tap action if in action zone
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchRef.current.active) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      touchRef.current.currentX = touch.clientX - rect.left;
      touchRef.current.currentY = touch.clientY - rect.top;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchRef.current.active = false;
      touchRef.current.zone = 'none';
      touchRef.current.tapTriggered = false;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const createParticles = (x: number, y: number, color: string, count: number = 5, glow: boolean = false) => {
    for (let i = 0; i < count; i++) {
      stateRef.current.particles.push({
        x, y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
        life: 0, maxLife: 15 + Math.random() * 30, color, size: 2 + Math.random() * 4, glow
      });
    }
  };

  const checkCollision = (rect1: {x:number, y:number, width:number, height:number}, rect2: {x:number, y:number, width:number, height:number}, buffer: number = 0) => {
    return rect1.x < rect2.x + rect2.width + buffer &&
           rect1.x + rect1.width > rect2.x - buffer &&
           rect1.y < rect2.y + rect2.height + buffer &&
           rect1.y + rect1.height > rect2.y - buffer;
  };

  const update = () => {
    const state = stateRef.current;
    const player = state.player;
    const visual = visualRef.current;
    const touch = touchRef.current;

    if (visual.hitFlash > 0) visual.hitFlash -= 0.1;
    if (visual.invulnTimer > 0) visual.invulnTimer -= 1;

    // Movement states derived from touch
    let moveLeft = false;
    let moveRight = false;
    let moveDown = false;
    let actionTap = false;
    let actionHeld = false;

    if (touch.active) {
      if (touch.zone === 'command') {
        const dx = touch.currentX - touch.startX;
        const dy = touch.currentY - touch.startY;
        
        if (dx < -30) moveLeft = true;
        if (dx > 30) moveRight = true;
        if (dy > 30) moveDown = true;
      } else if (touch.zone === 'action') {
        actionHeld = true;
        if (touch.tapTriggered) {
          actionTap = true;
          touch.tapTriggered = false; // Single fire for tap
        }
      }
    }

    if (!player.isJumping) {
      player.jetpackFuel = Math.min(100, player.jetpackFuel + FUEL_REGEN_RATE);
      const nearEdgeLeft = Math.abs(player.x - state.platforms.find(p => !p.broken && player.x + player.width > p.x && player.x < p.x + p.width && Math.abs(player.y + player.height - p.y) < 5)?.x || 0) < 20;
      const nearEdgeRight = Math.abs(player.x + player.width - (state.platforms.find(p => !p.broken && player.x + player.width > p.x && player.x < p.x + p.width && Math.abs(player.y + player.height - p.y) < 5)?.x || 0 + (state.platforms.find(p => !p.broken && player.x + player.width > p.x && player.x < p.x + p.width && Math.abs(player.y + player.height - p.y) < 5)?.width || 0))) < 20;
      const baseFriction = moveDown ? BRAKE_FRICTION : GROUND_FRICTION;
      const appliedFriction = (nearEdgeLeft || nearEdgeRight) ? baseFriction * EDGE_FRICTION_MULTIPLIER : baseFriction;

      if (moveLeft) { player.vx = Math.max(player.vx - PLAYER_ACCEL, -PLAYER_SPEED); player.facing = 'left'; }
      else if (moveRight) { player.vx = Math.min(player.vx + PLAYER_ACCEL, PLAYER_SPEED); player.facing = 'right'; }
      else { player.vx *= appliedFriction; }

      // Jump charging logic from touch drag
      if (moveDown) {
        // Build charge based on drag distance in bottom zone
        const dragDist = touch.currentY - touch.startY;
        const maxDrag = 200;
        player.jumpCharge = Math.min(player.maxJumpCharge, (dragDist / maxDrag) * player.maxJumpCharge);
      } else if (player.jumpCharge > 10) {
        // Trigger powerful jump on release (or when moving stops being down)
        const powerRatio = player.jumpCharge / player.maxJumpCharge;
        player.vy = MIN_JUMP_FORCE + (MAX_JUMP_FORCE - MIN_JUMP_FORCE) * powerRatio;
        player.isJumping = true; player.isJetpackEnabled = false; player.jumpCharge = 0; player.scaleX = 0.8; player.scaleY = 1.2;
        sounds.jump(); sounds.startBGM(); createParticles(player.x + player.width/2, player.y + player.height, '#fff', 15);
      } else {
        player.jumpCharge = Math.max(0, player.jumpCharge - 2.5);
      }

      // Quick tap jump (Upper zone)
      if (actionTap) {
        player.vy = MIN_JUMP_FORCE;
        player.isJumping = true; player.isJetpackEnabled = false; player.jumpCharge = 0; player.scaleX = 0.8; player.scaleY = 1.2;
        sounds.jump(); sounds.startBGM(); createParticles(player.x + player.width/2, player.y + player.height, '#fff', 10);
      }
    } else {
      // Jetpack activation mid-air
      if (actionTap && player.jetpackFuel > 0) {
        player.isJetpackEnabled = true;
      }

      if (player.isJetpackEnabled && player.jetpackFuel > 0) {
        if (actionHeld) {
          player.isJetpacking = true; 
          player.jetpackFuel -= FUEL_CONSUMPTION;
          player.vy -= JETPACK_THRUST;
          
          if (moveLeft) player.vx = Math.max(player.vx - JETPACK_HORIZONTAL_THRUST, -PLAYER_SPEED * 0.8);
          if (moveRight) player.vx = Math.min(player.vx + JETPACK_HORIZONTAL_THRUST, PLAYER_SPEED * 0.8);
          if (moveDown) player.vy += JETPACK_DOWN_THRUST;
          
          if (Math.random() > 0.4) {
            createParticles(player.x + player.width/2, player.y + player.height, '#ff9100', 2, true);
            if (Math.random() > 0.8) sounds.jetpack();
          }
          state.screenShake = Math.max(state.screenShake, 1.5);
        } else {
          player.isJetpacking = false;
        }
      } else {
        player.isJetpacking = false; 
        player.isJetpackEnabled = false;
        if (moveLeft) player.vx = Math.max(player.vx - PLAYER_ACCEL * AIR_CONTROL, -PLAYER_SPEED);
        if (moveRight) player.vx = Math.min(player.vx + PLAYER_ACCEL * AIR_CONTROL, PLAYER_SPEED);
      }
    }

    player.vy += GRAVITY;
    player.vx *= (player.isJumping ? AIR_RESISTANCE : 1);
    player.x += player.vx;
    player.y += player.vy;

    if (player.x < WALL_WIDTH) { player.x = WALL_WIDTH; player.vx = Math.abs(player.vx) * 0.7 + 1; sounds.wallBounce(); state.screenShake = 2; }
    if (player.x + player.width > GAME_WIDTH - WALL_WIDTH) { player.x = GAME_WIDTH - WALL_WIDTH - player.width; player.vx = -Math.abs(player.vx) * 0.7 - 1; sounds.wallBounce(); state.screenShake = 2; }

    state.platforms.forEach(p => {
      if (p.broken) return;
      if (p.deformationY) p.deformationY *= 0.85;
      if (p.type === 'moving' && p.speed) { p.x += p.speed; if (p.x < WALL_WIDTH || p.x + p.width > GAME_WIDTH - WALL_WIDTH) p.speed *= -1; }
      
      const isOneWay = p.type === 'one-way';
      const playerFeetY = player.y + player.height;

      if (!isOneWay) {
        if (player.vy < 0 && checkCollision(player, p)) {
          if (player.y < p.y + p.height && player.y > p.y + p.height - 15) {
             player.y = p.y + p.height; player.vy *= -0.15; p.deformationY = 6;
          }
        }
      }

      if (player.vy >= 0) {
        if (playerFeetY >= p.y && playerFeetY <= p.y + p.height/2 + player.vy + 5) {
          if (player.x + player.width > p.x && player.x < p.x + p.width) {
            if (p.type === 'fragile') { p.opacity = (p.opacity || 1) - 0.12; if (p.opacity <= 0) p.broken = true; }
            if (!p.broken) {
              if (player.isJumping) { player.scaleX = 1.2; player.scaleY = 0.8; sounds.land(); p.deformationY = 12; }
              player.y = p.y - player.height; player.vy = 0; player.isJumping = false; player.isJetpackEnabled = false; state.lastPlatformY = p.y;
              if (p.type === 'standard') { player.lastSafeX = p.x + p.width/2 - player.width/2; player.lastSafeY = p.y; }
            }
          }
        }
      }
    });

    const itemBuffer = 15;
    state.coins.forEach(c => { 
      if (!c.collected && checkCollision(player, c, itemBuffer)) { 
        c.collected = true; player.score += 250; coinsInRun.current += 1; sounds.coin(); 
        createParticles(c.x + 12, c.y + 12, '#ffd700', 8);
      } 
    });
    state.hearts.forEach(h => { 
      if (!h.collected && checkCollision(player, h, itemBuffer)) { 
        h.collected = true; player.health = Math.min(100, player.health + 25); sounds.heart(); 
        createParticles(h.x + 15, h.y + 15, '#ff5252', 12);
      } 
    });
    state.fuelPacks.forEach(f => { 
      if (!f.collected && checkCollision(player, f, itemBuffer)) { 
        f.collected = true; player.jetpackFuel = Math.min(100, player.jetpackFuel + 60); sounds.coin(); 
        createParticles(f.x + 13, f.y + 13, '#4fc3f7', 10);
      } 
    });
    state.pickups.forEach(w => { 
      if (!w.collected && checkCollision(player, w, itemBuffer)) { 
        w.collected = true; player.weapon = w.type; 
        createParticles(w.x + 15, w.y + 15, '#ffffff', 15);
      } 
    });

    state.enemies.forEach(e => {
      e.x += e.vx; e.x = Math.max(WALL_WIDTH, Math.min(GAME_WIDTH - WALL_WIDTH - e.width, e.x));
      if (checkCollision(player, e)) {
        if (player.vy > 0 && player.y + player.height < e.y + e.height / 2) { 
          player.vy = -18; e.y = 10000; sounds.stomp(); player.score += 500; 
        } else if (visual.invulnTimer <= 0) {
          player.health -= 35; visual.hitFlash = 1.0; visual.invulnTimer = 60; player.vy = -14; player.vx = player.x < e.x ? -15 : 15;
          sounds.hurt(); state.screenShake = 12; if (player.health <= 0) onGameOver(player.score);
        }
      }
    });

    const targetCameraY = -player.y + GAME_HEIGHT * 0.65;
    state.cameraY += (Math.max(0, targetCameraY) - state.cameraY) * 0.12;
    const ch = Math.max(0, Math.floor((-player.y + (GAME_HEIGHT - 100)) / 10));
    if (ch > player.maxHeight) { player.score += (ch - player.maxHeight) * 50; player.maxHeight = ch; }
    state.particles = state.particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.life++; return p.life < p.maxLife; });

    if (player.y < state.levelGeneratedUntil + 2500) {
      const chunk = LevelGenerator.generateChunk(state.levelGeneratedUntil, state.levelGeneratedUntil - CHUNK_SIZE);
      state.platforms.push(...chunk.platforms); state.coins.push(...chunk.coins); state.hearts.push(...chunk.hearts); state.enemies.push(...chunk.enemies); state.pickups.push(...chunk.pickups); state.fuelPacks.push(...chunk.fuelPacks);
      state.levelGeneratedUntil -= CHUNK_SIZE;
    }
    state.currentBiome = LevelGenerator.getBiomeAtHeight(player.y);
    onUpdate(player.score, player.maxHeight, state.currentBiome, player.jetpackFuel, player.health, player.weapon, player.jumpCharge, coinsInRun.current);
    
    player.scaleX += (1 - player.scaleX) * 0.15;
    player.scaleY += (1 - player.scaleY) * 0.15;
    if (state.screenShake > 0) state.screenShake *= 0.85;
    if (player.y > -state.cameraY + GAME_HEIGHT + 200) onGameOver(player.score);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const draw = () => {
      const state = stateRef.current;
      const visual = visualRef.current;
      const config = BIOME_CONFIGS[state.currentBiome];
      const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      config.bgColor.forEach((color, i) => bgGrad.addColorStop(i / (config.bgColor.length - 1), color));
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      ctx.save();
      ctx.translate((Math.random()-0.5)*state.screenShake, state.cameraY + (Math.random()-0.5)*state.screenShake);

      ctx.fillStyle = '#080808'; ctx.fillRect(0, -5000000, WALL_WIDTH, 10000000);
      ctx.fillRect(GAME_WIDTH - WALL_WIDTH, -5000000, WALL_WIDTH, 10000000);

      state.platforms.forEach(p => {
        if (p.broken) return;
        ctx.save(); ctx.globalAlpha = p.opacity || 1; 
        if (p.type !== 'one-way') {
           ctx.fillStyle = p.type === 'moving' ? '#1976d2' : p.type === 'fragile' ? '#ef5350' : config.platformColor;
           const defY = p.deformationY || 0;
           ctx.beginPath(); ctx.roundRect(p.x, p.y + defY, p.width, p.height, 8); ctx.fill();
           ctx.fillStyle = config.grassColor; ctx.fillRect(p.x, p.y + defY, p.width, 10);
        } else {
           ctx.fillStyle = '#1b5e20'; ctx.fillRect(p.x, p.y, p.width, 12);
        }
        ctx.restore();
      });

      state.coins.forEach(c => { 
        if (!c.collected) { 
          ctx.fillStyle = '#ffd700'; 
          ctx.beginPath(); 
          ctx.arc(c.x+12, c.y+12+Math.sin(Date.now()/150)*8, 11, 0, Math.PI*2); 
          ctx.fill(); 
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        } 
      });
      state.hearts.forEach(h => { if (!h.collected) { ctx.font = '30px serif'; ctx.fillText('❤️', h.x+15, h.y+20+Math.sin(Date.now()/200)*10); } });
      state.fuelPacks.forEach(f => { if (!f.collected) { ctx.font = '30px serif'; ctx.fillText('⚡', f.x+15, f.y+20+Math.sin(Date.now()/180)*10); } });
      state.enemies.forEach(e => { ctx.font = '40px serif'; ctx.fillText(config.enemyEmoji, e.x, e.y+35); });
      state.particles.forEach(p => { ctx.globalAlpha = 1 - (p.life/p.maxLife); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; });
      
      const p = state.player;
      ctx.save();
      ctx.translate(p.x + p.width/2, p.y + p.height/2);
      ctx.scale(p.scaleX, p.scaleY);
      if (p.isJetpacking) { 
        ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.moveTo(-15, 20); ctx.lineTo(0, 45 + Math.random()*25); ctx.lineTo(15, 20); ctx.fill(); 
      }
      const cr = p.jumpCharge / p.maxJumpCharge;
      
      ctx.fillStyle = visual.hitFlash > 0 ? `rgba(255,255,255,${visual.hitFlash})` : `rgb(${33 + 120*cr}, ${150 + 80*cr}, ${243 + 12*cr})`; 
      ctx.beginPath(); ctx.roundRect(-p.width/2, -p.height/2, p.width, p.height, 12); ctx.fill();
      
      ctx.fillStyle = 'white'; const ex = p.facing === 'right' ? 12 : -12;
      ctx.beginPath(); ctx.arc(ex, -8, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(ex + (p.facing === 'right' ? 4 : -4), -8, 3.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      ctx.restore();
      update();
      animationFrameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [restartTrigger]);

  return <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="w-full h-full" />;
};

export default GameCanvas;
