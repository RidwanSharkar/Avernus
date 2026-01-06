import React, { useState, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';
import { Enemy } from '@/ecs/components/Enemy';
import { Health } from '@/ecs/components/Health';
import { SpatialHash } from '@/utils/SpatialHash';
import { Vector3, Color, Box3 } from '@/utils/three-exports';

// Import individual projectile components
import CrossentropyBolt from '@/components/projectiles/CrossentropyBolt';
import EntropicBolt from '@/components/projectiles/EntropicBolt';
import ChargedArrow from '@/components/projectiles/ChargedArrow';
import RegularArrow from '@/components/projectiles/RegularArrow';
import Barrage from '@/components/projectiles/Barrage';
import TowerProjectile from '@/components/projectiles/TowerProjectile';
import ExplosionEffect from '@/components/projectiles/ExplosionEffect';
import CrossentropyExplosion from '@/components/projectiles/CrossentropyExplosion';

// Data interfaces for each projectile type
interface ProjectileData {
  id: number;
  position: Vector3;
  direction: Vector3;
  entityId: number;
  subclass?: any;
  level?: number;
  opacity?: number;
  ownerId?: string; // For tower projectiles
  isCryoflame?: boolean; // For Entropic Bolt Cryoflame mode
  projectileType?: string; // For projectile type differentiation (e.g., burst_arrow)
}

interface SwordProjectileData {
  id: number;
  position: Vector3;
  direction: Vector3;
  entityId: number;
}

interface ExplosionData {
  id: number;
  position: Vector3;
  color: Color;
  size: number;
  duration: number;
  type?: 'crossentropy' | 'generic'; // Add type to distinguish explosion types
  chargeTime?: number; // For crossentropy explosions
}

interface UnifiedProjectileManagerProps {
  world: World;
}

export default function UnifiedProjectileManager({ world }: UnifiedProjectileManagerProps) {
  // State for all projectile types
  const [projectileData, setProjectileData] = useState<{
    crossentropy: ProjectileData[];
    entropic: ProjectileData[];
    charged: ProjectileData[];
    regular: ProjectileData[];
    sword: SwordProjectileData[];
    barrage: ProjectileData[];
    tower: ProjectileData[];
  }>({
    crossentropy: [],
    entropic: [],
    charged: [],
    regular: [],
    sword: [],
    barrage: [],
    tower: []
  });

  const [explosions, setExplosions] = useState<ExplosionData[]>([]);

  // Counters for unique IDs
  const crossentropyIdCounter = useRef(0);
  const entropicIdCounter = useRef(0);
  const chargedIdCounter = useRef(0);
  const regularIdCounter = useRef(0);
  const swordIdCounter = useRef(0);
  const barrageIdCounter = useRef(0);
  const towerIdCounter = useRef(0);
  const explosionIdCounter = useRef(0);

  // Throttling
  const lastUpdateTime = useRef(0);

  // Spatial hash for optimized collision detection
  const spatialHashRef = useRef<SpatialHash | null>(null);

  // Initialize spatial hash
  useEffect(() => {
    spatialHashRef.current = new SpatialHash(8); // 8 unit cell size for good balance

    return () => {
      if (spatialHashRef.current) {
        spatialHashRef.current.clear();
      }
    };
  }, []);

  // Collision detection for EntropicBolt using spatial partitioning
  const checkEntropicBoltCollisions = (boltId: number, position: Vector3): boolean => {
    if (!world || !spatialHashRef.current) return false;

    // Check ground collision first - ground is at y = -0.5 (EnhancedGround position)
    if (position.y <= -0.125) {
      return true; // Hit the ground
    }

    // Use spatial hash to find nearby enemies
    const nearbyEntries = spatialHashRef.current.queryRadius(position, 2.0); // Slightly larger than hit radius

    for (const entry of nearbyEntries) {
      const enemy = entry.entity.getComponent(Enemy);
      const health = entry.entity.getComponent(Health);
      const transform = entry.entity.getComponent(Transform);

      // Skip if not an enemy or if dead
      if (!enemy || !health || !transform || health.isDead) continue;

      // Check collision distance (using 2D distance for better gameplay)
      const projectilePos2D = new Vector3(position.x, 0, position.z);
      const enemyPos2D = new Vector3(transform.position.x, 0, transform.position.z);
      const distance = projectilePos2D.distanceTo(enemyPos2D);

      if (distance <= 1.5) { // Hit radius for EntropicBolt
        return true; // Collision detected
      }
    }

    return false; // No collision
  };

  // Collision detection for CrossentropyBolt using spatial partitioning
  const checkCrossentropyBoltCollisions = (boltId: number, position: Vector3): boolean => {
    if (!world || !spatialHashRef.current) return false;

    // Check ground collision first - ground is at y = -0.5 (EnhancedGround position)
    if (position.y <= -0.25) {
      return true; // Hit the ground
    }

    // Use spatial hash to find nearby enemies
    const nearbyEntries = spatialHashRef.current.queryRadius(position, 2.1); // Slightly larger than hit radius

    for (const entry of nearbyEntries) {
      const enemy = entry.entity.getComponent(Enemy);
      const health = entry.entity.getComponent(Health);
      const transform = entry.entity.getComponent(Transform);

      // Skip if not an enemy or if dead
      if (!enemy || !health || !transform || health.isDead) continue;

      // Check collision distance (using 2D distance for better gameplay)
      const projectilePos2D = new Vector3(position.x, 0, position.z);
      const enemyPos2D = new Vector3(transform.position.x, 0, transform.position.z);
      const distance = projectilePos2D.distanceTo(enemyPos2D);

      if (distance <= 1.55) { // Hit radius for CrossentropyBolt (slightly larger than EntropicBolt)
        return true; // Collision detected
      }
    }

    return false; // No collision
  };

  useFrame((state) => {
    // Throttle updates to avoid excessive re-renders
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.016) return; // ~60fps
    lastUpdateTime.current = currentTime;

    if (!world || !spatialHashRef.current) return;

    // Update spatial hash with current enemy positions
    const allEnemyEntities = world.queryEntities([Transform, Enemy, Health]);
    for (const entity of allEnemyEntities) {
      const transform = entity.getComponent(Transform);
      const enemy = entity.getComponent(Enemy);
      const health = entity.getComponent(Health);

      if (!transform || !enemy || !health || health.isDead) {
        // Remove dead or invalid entities from spatial hash
        spatialHashRef.current.remove(entity);
        continue;
      }

      // Create bounding box for enemy (using a reasonable size)
      const enemySize = 2.0; // 2 unit radius for collision detection
      const bounds = new Box3(
        new Vector3(transform.position.x - enemySize, transform.position.y - enemySize, transform.position.z - enemySize),
        new Vector3(transform.position.x + enemySize, transform.position.y + enemySize, transform.position.z + enemySize)
      );

      spatialHashRef.current.insert(entity, bounds);
    }

    // SINGLE QUERY FOR ALL PROJECTILES - This is the key optimization!
    const allProjectileEntities = world.queryEntities([Transform, Projectile, Renderer]);
    
    // Separate projectiles by type in a single pass
    const newCrossentropy: ProjectileData[] = [];
    const newEntropic: ProjectileData[] = [];
    const newCharged: ProjectileData[] = [];
    const newRegular: ProjectileData[] = [];
    const newSword: SwordProjectileData[] = [];
    const newBarrage: ProjectileData[] = [];
    const newTower: ProjectileData[] = [];

    for (const entity of allProjectileEntities) {
      const renderer = entity.getComponent(Renderer);
      const transform = entity.getComponent(Transform);
      const projectile = entity.getComponent(Projectile);

      if (!renderer?.mesh || !transform || !projectile) continue;

      const userData = renderer.mesh.userData;
      const direction = userData.direction || projectile.velocity.clone().normalize();

      // Determine projectile type and update appropriate array
      if (userData.isTowerProjectile) {
        const existing = projectileData.tower.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newTower.push(existing);
        } else {
          newTower.push({
            id: towerIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            subclass: userData.subclass,
            level: userData.level,
            opacity: userData.opacity || 1.0,
            ownerId: userData.towerOwnerId
          });
        }
      } else if (userData.isCrossentropyBolt) {
        const existing = projectileData.crossentropy.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newCrossentropy.push(existing);
        } else {
          newCrossentropy.push({
            id: crossentropyIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id
          });
        }
      } else if (userData.isEntropicBolt) {
        const existing = projectileData.entropic.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newEntropic.push(existing);
        } else {
          newEntropic.push({
            id: entropicIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            isCryoflame: userData.isCryoflame || false
          });
        }
      } else if (userData.isChargedArrow) {
        const existing = projectileData.charged.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newCharged.push(existing);
        } else {
          newCharged.push({
            id: chargedIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            subclass: userData.subclass,
            level: userData.level,
            opacity: userData.opacity || 1.0
          });
        }
      } else if (userData.isBarrageArrow) {
        const existing = projectileData.barrage.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newBarrage.push(existing);
        } else {
          newBarrage.push({
            id: barrageIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            subclass: userData.subclass,
            level: userData.level,
            opacity: userData.opacity || 1.0
          });
        }
      } else if (userData.isRegularArrow || userData.projectileType === 'burst_arrow') {
        const existing = projectileData.regular.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newRegular.push(existing);
        } else {
          newRegular.push({
            id: regularIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            subclass: userData.subclass,
            level: userData.level,
            opacity: userData.opacity || 1.0,
            projectileType: userData.projectileType // Pass projectile type for color differentiation
          });
        }
      } else if (userData.projectileType === 'wind_shear') {
        // Wind shear projectiles are handled by WindShearProjectileManager, skip here
      } else if (userData.projectileType === 'sword_projectile') {
        const existing = projectileData.sword.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newSword.push(existing);
        } else {
          const newSwordData = {
            id: swordIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id
          };
          newSword.push(newSwordData);
        }
      }
    }

    // Check for explosion events
    const explosionEvents = world.getEvents?.('explosion') || [];
    const newExplosions = [...explosions];
    
    for (const event of explosionEvents) {
      const newExplosion: ExplosionData = {
        id: explosionIdCounter.current++,
        position: event.position.clone(),
        color: event.color || new Color('#00ff44'),
        size: event.size || 1,
        duration: event.duration || 2
      };
      newExplosions.push(newExplosion);
    }

    // Clear processed explosion events
    if (explosionEvents.length > 0) {
      world.clearEvents?.('explosion');
    }

    // Update state only if there are changes
    const hasProjectileChanges = (
      newCrossentropy.length !== projectileData.crossentropy.length ||
      newEntropic.length !== projectileData.entropic.length ||
      newCharged.length !== projectileData.charged.length ||
      newRegular.length !== projectileData.regular.length ||
      newSword.length !== projectileData.sword.length ||
      newBarrage.length !== projectileData.barrage.length ||
      newTower.length !== projectileData.tower.length ||
      newCrossentropy.some(p => !projectileData.crossentropy.find(existing => existing.entityId === p.entityId)) ||
      newEntropic.some(p => !projectileData.entropic.find(existing => existing.entityId === p.entityId)) ||
      newCharged.some(p => !projectileData.charged.find(existing => existing.entityId === p.entityId)) ||
      newRegular.some(p => !projectileData.regular.find(existing => existing.entityId === p.entityId)) ||
      newSword.some(p => !projectileData.sword.find(existing => existing.entityId === p.entityId)) ||
      newBarrage.some(p => !projectileData.barrage.find(existing => existing.entityId === p.entityId)) ||
      newTower.some(p => !projectileData.tower.find(existing => existing.entityId === p.entityId))
    );

    if (hasProjectileChanges) {
      setProjectileData({
        crossentropy: newCrossentropy,
        entropic: newEntropic,
        charged: newCharged,
        regular: newRegular,
        sword: newSword,
        barrage: newBarrage,
        tower: newTower
      });
    }

    if (newExplosions.length !== explosions.length) {
      setExplosions(newExplosions);
    }
  });

  const handleExplosionComplete = (explosionId: number) => {
    setExplosions(prev => prev.filter(explosion => explosion.id !== explosionId));
  };

  return (
    <>
      {/* Crossentropy Bolts */}
      {projectileData.crossentropy.map(bolt => (
        <CrossentropyBolt
          key={bolt.id}
          id={bolt.id}
          position={bolt.position}
          direction={bolt.direction}
          checkCollisions={checkCrossentropyBoltCollisions}
          onImpact={(impactPosition?: Vector3, isEnemyCollision?: boolean) => {

            // Only create Crossentropy explosion effect if it didn't collide with an enemy
            if (impactPosition && !isEnemyCollision) {
              const explosion = {
                id: explosionIdCounter.current++,
                position: impactPosition.clone(),
                color: new Color('#8B00FF'), // Purple/magenta explosion for Crossentropy
                size: 2.5, // Larger explosion than EntropicBolt
                duration: 1.0, // Duration for Crossentropy explosion
                type: 'crossentropy' as const,
                chargeTime: 1.0 // Default charge time, could be dynamic based on player charge
              };
              setExplosions(prev => [...prev, explosion]);
            }
          }}
        />
      ))}

      {/* Entropic Bolts */}
      {projectileData.entropic.map(bolt => (
        <EntropicBolt
          key={bolt.id}
          id={bolt.id}
          position={bolt.position}
          direction={bolt.direction}
          checkCollisions={checkEntropicBoltCollisions}
          isCryoflame={bolt.isCryoflame}
          onImpact={(impactPosition?: Vector3) => {
            // console.log(`⚡ EntropicBolt ${bolt.id} impact at position:`, impactPosition?.toArray());
          }}
        />
      ))}

      {/* Charged Arrows */}
      {projectileData.charged.map(arrow => (
        <ChargedArrow
          key={arrow.id}
          position={arrow.position}
          direction={arrow.direction}
          onImpact={() => {
            // console.log(`🏹 ChargedArrow ${arrow.id} impact`);
          }}
        />
      ))}

      {/* Regular Arrows */}
      {projectileData.regular.map(arrow => {
        // Get distance information from the ECS projectile component
        const projectileEntity = world?.getEntity(arrow.entityId);
        const projectile = projectileEntity?.getComponent(Projectile);
        const distanceTraveled = projectile?.distanceTraveled || 0;
        const maxDistance = projectile?.maxDistance || 25;
        
        return (
          <RegularArrow
            key={arrow.id}
            position={arrow.position}
            direction={arrow.direction}
            distanceTraveled={distanceTraveled}
            maxDistance={maxDistance}
            projectileType={arrow.projectileType}
            onImpact={() => {
              // console.log(`🏹 RegularArrow ${arrow.id} impact`);
            }}
          />
        );
      })}


      {/* Barrage Arrows */}
      <Barrage 
        projectiles={projectileData.barrage.map(arrow => {
          // Get distance information from the ECS projectile component
          const projectileEntity = world?.getEntity(arrow.entityId);
          const projectile = projectileEntity?.getComponent(Projectile);
          const distanceTraveled = projectile?.distanceTraveled || 0;
          const maxDistance = projectile?.maxDistance || 25;
          
          return {
            id: arrow.id,
            position: arrow.position,
            direction: arrow.direction,
            startPosition: arrow.position.clone(), // Use current position as start for visual purposes
            maxDistance: maxDistance,
            damage: 30,
            startTime: Date.now(),
            hasCollided: false, 
            hitEnemies: new Set(),
            opacity: arrow.opacity,
            distanceTraveled: distanceTraveled
          };
        })}
      />

      {/* Tower Projectiles */}
      {projectileData.tower.map(projectile => (
        <TowerProjectile
          key={projectile.id}
          position={projectile.position}
          direction={projectile.direction}
          entityId={projectile.entityId}
          ownerId={projectile.ownerId}
          opacity={projectile.opacity}
        />
      ))}

      {/* Explosions */}
      {explosions.map(explosion => {
        if (explosion.type === 'crossentropy') {
          return (
            <CrossentropyExplosion
              key={explosion.id}
              position={explosion.position}
              chargeTime={explosion.chargeTime || 0.75}
              explosionStartTime={Date.now()}
              onComplete={() => handleExplosionComplete(explosion.id)}
            />
          );
        } else {
          // Default to generic explosion for other types
          return (
            <ExplosionEffect
              key={explosion.id}
              position={explosion.position}
              color={explosion.color}
              size={explosion.size/2}
              duration={explosion.duration}
              onComplete={() => handleExplosionComplete(explosion.id)}
            />
          );
        }
      })}
    </>
  );
}
