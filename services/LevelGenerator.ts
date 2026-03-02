
import { Platform, Coin, Enemy, BiomeType, Heart, WeaponPickup, WeaponType, FuelPickup } from '../types';
import { GAME_WIDTH, BIOME_CONFIGS, WALL_WIDTH } from '../constants';

export class LevelGenerator {
  static getBiomeAtHeight(height: number): BiomeType {
    const h = -height;
    if (h > BIOME_CONFIGS.SPACE.threshold) return BiomeType.SPACE;
    if (h > BIOME_CONFIGS.SKY.threshold) return BiomeType.SKY;
    if (h > BIOME_CONFIGS.ICE.threshold) return BiomeType.ICE;
    if (h > BIOME_CONFIGS.DESERT.threshold) return BiomeType.DESERT;
    return BiomeType.GRASSLAND;
  }

  static generateChunk(startY: number, endY: number): { 
    platforms: Platform[], 
    coins: Coin[], 
    enemies: Enemy[], 
    hearts: Heart[],
    pickups: WeaponPickup[],
    fuelPacks: FuelPickup[]
  } {
    const platforms: Platform[] = [];
    const coins: Coin[] = [];
    const enemies: Enemy[] = [];
    const hearts: Heart[] = [];
    const pickups: WeaponPickup[] = [];
    const fuelPacks: FuelPickup[] = [];

    let currentY = startY;
    const step = 175;
    const maxPlatformWidth = (GAME_WIDTH - (WALL_WIDTH * 2)) * 0.5;

    while (currentY > endY) {
      const biome = this.getBiomeAtHeight(currentY);
      const h = -currentY;
      
      const practiceMultiplier = Math.max(0.5, 1.5 - (h / 5000));
      const count = Math.random() > 0.6 ? 2 : 1;
      
      for (let i = 0; i < count; i++) {
        const baseWidth = 140 + Math.random() * 100;
        let width = Math.min(maxPlatformWidth, baseWidth * practiceMultiplier);
        
        if (h > 6000 && Math.random() > 0.6) width *= 0.75;

        const x = WALL_WIDTH + Math.random() * (GAME_WIDTH - WALL_WIDTH * 2 - width);
        
        const typeRand = Math.random();
        let type: Platform['type'] = 'standard';
        
        const speedMult = 1 + (h / 12000);
        const speed = (Math.random() - 0.5) * 8 * speedMult;

        if (typeRand > 0.90 && h > 1000) type = 'moving';
        else if (typeRand > 0.70 && h > 1500) type = 'one-way'; 
        else if (typeRand > 0.65 && h > 800) type = 'fragile';

        const platform: Platform = {
          x,
          y: currentY,
          width,
          height: 30,
          type,
          initialX: x,
          speed,
          deformationY: 0,
        };
        platforms.push(platform);

        // Position items slightly above the platform to ensure they are visible and reachable
        if (Math.random() > 0.45) coins.push({ x: x + width / 2 - 12, y: currentY - 65, width: 24, height: 24, collected: false, value: 250, floatOffset: Math.random() * Math.PI * 2 });
        if (Math.random() > 0.98) pickups.push({ x: x + width/2 - 15, y: currentY - 80, width: 30, height: 30, type: h > 12000 ? WeaponType.PLASMA : WeaponType.BLASTER, collected: false, floatOffset: Math.random() * Math.PI * 2 });
        if (Math.random() > 0.96) hearts.push({ x: x + Math.random() * (width - 24), y: currentY - 70, width: 28, height: 28, collected: false, floatOffset: Math.random() * Math.PI * 2 });
        if (Math.random() > 0.92) fuelPacks.push({ x: x + Math.random() * (width - 24), y: currentY - 70, width: 26, height: 26, collected: false, floatOffset: Math.random() * Math.PI * 2 });

        if (Math.random() > 0.82 && h > 600) {
          enemies.push({
            x: x + width / 2 - 20, y: currentY - 45, width: 42, height: 42,
            vx: (Math.random() - 0.5) * 5 * speedMult, vy: 0,
            type: (h > 10000) ? 'chaser' : 'patrol',
            biome, health: h > 20000 ? 100 : 50
          });
        }
      }
      currentY -= step + (Math.random() * 40);
    }

    return { platforms, coins, enemies, hearts, pickups, fuelPacks };
  }
}
