// Optimized PVP Managers with Object Pooling
import React, { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';
import { CobraShotProjectile } from '@/components/projectiles/CobraShot';
import { pvpObjectPool } from '@/utils/PVPObjectPool';

// Define ViperStingProjectile interface for PVP collision detection
interface ViperStingProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<string>;
  opacity: number;
  fadeStartTime: number | null;
  isReturning: boolean;
  returnHitEnemies: Set<string>;
  casterId?: string; // For PVP: remember which player cast this projectile
  casterPosition?: Vector3; // For PVP: remember the caster's position for return
}

// Interfaces for PVP managers
interface PVPCobraShotManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerVenomed: (playerId: string, position: Vector3, casterId?: string) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
  damageNumberManager?: any; // Damage number manager for visual feedback
}

interface PVPBarrageManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerSlowed: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
  damageNumberManager?: any; // Damage number manager for visual feedback
}

interface PVPFrostNovaManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerFrozen: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
}

interface PVPViperStingManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerVenomed: (playerId: string, position: Vector3, casterId?: string) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
  onSoulStealCreated?: (enemyPosition: Vector3) => void; // Add callback for soul steal effects
  damageNumberManager?: any; // Damage number manager for visual feedback
}

interface PVPCrossentropyManagerProps {
  world: World;
  players: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  onPlayerHit: (playerId: string, damage: number) => void;
  onPlayerExplosion: (playerId: string, position: Vector3) => void;
  serverPlayerEntities: React.MutableRefObject<Map<string, number>>;
  localSocketId?: string;
  damageNumberManager?: any; // Damage number manager for visual feedback
}

/**
 * Optimized Cobra Shot Manager with Object Pooling
 */
export function OptimizedPVPCobraShotManager({
  world,
  players,
  onPlayerHit,
  onPlayerVenomed,
  serverPlayerEntities,
  localSocketId,
  damageNumberManager
}: PVPCobraShotManagerProps) {
  // Track processed hits to avoid duplicates
  const processedHits = useRef<Set<string>>(new Set());
  
  useFrame(() => {
    // Don't do collision detection if we don't know who the local player is
    if (!localSocketId) return;

    // Reset temporary objects for this frame
    pvpObjectPool.resetFrameTemporaries();

    // Get visual Cobra Shot projectiles from the CobraShotManager
    const { getGlobalCobraShotProjectiles } = require('@/components/projectiles/CobraShotManager');
    const cobraShotProjectiles = getGlobalCobraShotProjectiles();
    
    // Check each active Cobra Shot projectile for player hits
    cobraShotProjectiles.forEach((projectile: CobraShotProjectile) => {
      if (!projectile.active) return;
      
      const projectilePos = projectile.position;
      
      // Check collision with PVP players (only check players that are NOT the local player)
      players.forEach(player => {
        // Skip if this is the local player (they can't hit themselves)
        if (player.id === localSocketId) {
          return; // Don't hit yourself
        }
        
        // Use temporary Vector3 from pool instead of creating new one
        const playerPos = pvpObjectPool.getTempVector3(
          player.position.x, 
          player.position.y, 
          player.position.z
        );
        const distance = projectilePos.distanceTo(playerPos);
        
        if (distance <= 1.5) { // Hit radius
          // Convert player ID to number for hit tracking (consistent with CobraShotProjectile type)
          const playerIdNum = parseInt(player.id) || player.id.length; // Convert to number
          
          // Check if we haven't already hit this player
          if (!projectile.hitEnemies.has(playerIdNum)) {
            projectile.hitEnemies.add(playerIdNum);
            onPlayerHit(player.id, 29); // Cobra Shot damage

            // Create damage number for visual feedback (green for Cobra Shot)
            if (damageNumberManager && damageNumberManager.addDamageNumber) {
              const hitPosition = new Vector3(player.position.x, player.position.y + 1.5, player.position.z);
              damageNumberManager.addDamageNumber(
                29, // Cobra Shot damage
                false, // Not critical
                hitPosition,
                'cobra_shot' // Damage type for green styling
              );
            }

            // Apply venom effect at the HIT player's position (not the caster)
            // Use pooled Vector3 for the venom position
            const venomPosition = pvpObjectPool.acquireVector3(
              player.position.x, 
              player.position.y, 
              player.position.z
            );
            
            onPlayerVenomed(player.id, venomPosition, localSocketId);
            
            // Release the Vector3 back to pool after use
            // Note: onPlayerVenomed should clone the vector if it needs to store it
            pvpObjectPool.releaseVector3(venomPosition);
            
            // Mark projectile as inactive to stop further hits
            projectile.active = false;
            projectile.fadeStartTime = Date.now();
          }
        }
      });
    });
  });
  
  return null; // This is a logic-only component
}

/**
 * Optimized Barrage Manager with Object Pooling
 */
export function OptimizedPVPBarrageManager({
  world,
  players,
  onPlayerHit,
  onPlayerSlowed,
  serverPlayerEntities,
  localSocketId,
  damageNumberManager
}: PVPBarrageManagerProps) {
  const hitTracker = useRef<Set<string>>(new Set());
  
  useFrame(() => {
    // Don't do collision detection if we don't know who the local player is
    if (!localSocketId) return;

    if (!world) return;

    // Reset temporary objects for this frame
    pvpObjectPool.resetFrameTemporaries();
    
    // Get all projectile entities from the world
    const allEntities = world.getAllEntities();
    const projectileEntities = allEntities.filter(entity => 
      entity.hasComponent(Projectile) && entity.hasComponent(Transform) && entity.hasComponent(Renderer)
    );
    
    // Check each Barrage projectile for player hits
    projectileEntities.forEach(projectileEntity => {
      const renderer = projectileEntity.getComponent(Renderer);
      const transform = projectileEntity.getComponent(Transform);
      const projectile = projectileEntity.getComponent(Projectile);
      
      // Only check Barrage arrows
      if (!renderer?.mesh?.userData?.isBarrageArrow || !transform || !projectile) return;
      
      const projectilePos = transform.position;
      
      // Check collision with PVP players (only check players that are NOT the projectile owner)
      players.forEach(player => {
        // Skip if this is the projectile owner (they can't hit themselves)
        // Check both the socket ID and the entity ID mapping
        if (player.id === localSocketId) {
          return; // Don't hit yourself (socket ID check)
        }

        // Additional safety check: skip if this player's entity ID matches the projectile owner
        const playerEntityId = serverPlayerEntities.current.get(player.id);
        if (playerEntityId && playerEntityId === projectile.owner) {
          return; // Don't hit the projectile owner (entity ID check)
        }

        // Use temporary Vector3 from pool
        const playerPos = pvpObjectPool.getTempVector3(
          player.position.x,
          player.position.y,
          player.position.z
        );
        const distance = projectilePos.distanceTo(playerPos);

        if (distance <= 1.25) { // Hit radius
          // Create unique hit key using pooled method
          const hitKey = pvpObjectPool.createHitKey(projectileEntity.id, player.id);

          // Check if we haven't already hit this player with this projectile
          if (playerEntityId && !projectile.hasHitTarget(playerEntityId) && !hitTracker.current.has(hitKey)) {
            projectile.addHitTarget(playerEntityId);
            hitTracker.current.add(hitKey);
            
            onPlayerHit(player.id, 30); // Barrage damage

            // Create damage number for visual feedback (blue for Barrage)
            if (damageNumberManager && damageNumberManager.addDamageNumber) {
              const hitPosition = new Vector3(player.position.x, player.position.y + 1.5, player.position.z);
              damageNumberManager.addDamageNumber(
                30, // Barrage damage
                false, // Not critical
                hitPosition,
                'barrage' // Damage type for blue styling
              );
            }

            // Apply slow effect at the HIT player's position (50% speed reduction for 5 seconds)
            // Use pooled Vector3 for the slow position
            const slowPosition = pvpObjectPool.acquireVector3(
              player.position.x, 
              player.position.y, 
              player.position.z
            );
            
            onPlayerSlowed(player.id, slowPosition);
            
            // Release the Vector3 back to pool
            pvpObjectPool.releaseVector3(slowPosition);
            
            // Clean up hit tracker after a delay to prevent memory leaks
            setTimeout(() => {
              hitTracker.current.delete(hitKey);
            }, 10000); // Clean up after 10 seconds
          }
        }
      });
    });
  });
  
  return null; // This is a logic-only component
}

/**
 * Optimized Frost Nova Manager with Object Pooling
 */
export function OptimizedPVPFrostNovaManager({ 
  world, 
  players, 
  onPlayerHit, 
  onPlayerFrozen, 
  serverPlayerEntities, 
  localSocketId 
}: PVPFrostNovaManagerProps) {
  const frostNovaHitTracker = useRef<Set<string>>(new Set());
  const lastUpdateTime = useRef(0);
  
  useFrame(() => {
    // Don't do collision detection if we don't know who the local player is
    if (!localSocketId) return;

    if (!world) return;

    // Throttle updates to avoid excessive checking
    const now = Date.now();
    if (now - lastUpdateTime.current < 50) return; // Update every 50ms
    lastUpdateTime.current = now;
    
    // Reset temporary objects for this frame
    pvpObjectPool.resetFrameTemporaries();
    
    // Get active frost nova effects from the FrostNovaManager
    const { getActiveFrostNovas } = require('@/components/weapons/FrostNovaManager');
    const activeFrostNovas = getActiveFrostNovas ? getActiveFrostNovas() : [];
    
    // Check each active frost nova for player hits
    activeFrostNovas.forEach((frostNova: any) => {
      // Check collision with PVP players (only check players that are NOT the local player)
      players.forEach(player => {
        // Skip if this is the local player (they can't hit themselves)
        if (player.id === localSocketId) {
          return; // Don't hit yourself
        }
        
        // Use temporary Vector3 from pool
        const playerPos = pvpObjectPool.getTempVector3(
          player.position.x, 
          player.position.y, 
          player.position.z
        );
        const frostNovaPos = frostNova.position;
        const distance = frostNovaPos.distanceTo(playerPos);
        const frostNovaRadius = 6.0; // Same radius as ControlSystem
        
        if (distance <= frostNovaRadius) {
          // Create unique hit key using pooled method
          const hitKey = pvpObjectPool.createHitKey(frostNova.id, player.id);
          
          // Check if we haven't already hit this player with this frost nova
          if (!frostNovaHitTracker.current.has(hitKey)) {
            frostNovaHitTracker.current.add(hitKey);
            
            onPlayerHit(player.id, 50); // FrostNova damage
            
            // Apply freeze effect at the HIT player's position
            // Use pooled Vector3 for the freeze position
            const freezePosition = pvpObjectPool.acquireVector3(
              player.position.x, 
              player.position.y, 
              player.position.z
            );
            
            onPlayerFrozen(player.id, freezePosition);
            
            // Release the Vector3 back to pool
            pvpObjectPool.releaseVector3(freezePosition);
            
            // Clean up hit tracker after a delay to prevent memory leaks
            setTimeout(() => {
              frostNovaHitTracker.current.delete(hitKey);
            }, 7000); // Clean up after 7 seconds
          }
        }
      });
    });
  });
  
  return null; // This is a logic-only component
}

/**
 * Hook for optimized effect management with object pooling
 */
export function useOptimizedPVPEffects() {
  const createOptimizedVenomEffect = useCallback((
    playerId: string, 
    position: Vector3, 
    duration: number = 6000
  ) => {
    // Use pooled effect data object
    const effectData = pvpObjectPool.acquireEffectData();
    effectData.id = Date.now();
    effectData.playerId = playerId;
    effectData.position.copy(position);
    effectData.startTime = Date.now();
    effectData.duration = duration;
    
    // Return cleanup function
    return () => {
      pvpObjectPool.releaseEffectData(effectData);
    };
  }, []);
  
  const createOptimizedDebuffEffect = useCallback((
    playerId: string, 
    debuffType: 'frozen' | 'slowed',
    position: Vector3, 
    duration: number = 5000
  ) => {
    // Use pooled effect data object
    const effectData = pvpObjectPool.acquireEffectData();
    effectData.id = Date.now();
    effectData.playerId = playerId;
    effectData.debuffType = debuffType;
    effectData.position.copy(position);
    effectData.startTime = Date.now();
    effectData.duration = duration;
    
    // Return cleanup function
    return () => {
      pvpObjectPool.releaseEffectData(effectData);
    };
  }, []);
  
  return {
    createOptimizedVenomEffect,
    createOptimizedDebuffEffect,
    getPoolStats: () => pvpObjectPool.getStats()
  };
}

/**
 * Optimized Viper Sting Manager with Object Pooling
 * Handles PVP collision detection for Viper Sting projectiles
 */
export function OptimizedPVPViperStingManager({
  world: ecsWorld,
  players,
  onPlayerHit,
  onPlayerVenomed,
  serverPlayerEntities,
  localSocketId,
  onSoulStealCreated,
  damageNumberManager
}: PVPViperStingManagerProps) {
  // Track processed hits to avoid duplicates
  const processedHits = useRef<Set<string>>(new Set());

  useFrame(() => {
    // Don't do collision detection if we don't know who the local player is
    if (!localSocketId) return;

    // Reset temporary objects for this frame
    pvpObjectPool.resetFrameTemporaries();

    // Get visual Viper Sting projectiles from the ViperStingManager
    const { getGlobalViperStingProjectiles } = require('@/components/projectiles/ViperStingManager');
    const viperStingProjectiles = getGlobalViperStingProjectiles();

    // Check each active Viper Sting projectile for player hits
    viperStingProjectiles.forEach((projectile: ViperStingProjectile) => {
      if (!projectile.active) return;

      const projectilePos = projectile.position;

      // CRITICAL FIX: Handle projectile lifecycle in PVP mode
      // Since enemyData is empty in PVP, we need to manage return phase transition here
      if (!projectile.isReturning) {
        // Check if projectile has reached max distance and should return
        const distanceTraveled = projectile.position.distanceTo(projectile.startPosition);
        if (distanceTraveled >= projectile.maxDistance && !projectile.fadeStartTime) {
          projectile.isReturning = true;
          // Initialize return direction - will be updated dynamically below
        }
      }

      // Handle dynamic return direction toward current player position
      if (projectile.isReturning) {
        // Get current player position for dynamic return
        const localPlayerEntity = serverPlayerEntities.current.get(localSocketId);
        if (localPlayerEntity) {
          const playerWorldEntity = ecsWorld.getEntity(localPlayerEntity);
          if (playerWorldEntity) {
            const transform = playerWorldEntity.getComponent(Transform);
            if (transform) {
              const currentPlayerPosition = transform.position.clone();
              currentPlayerPosition.y += 0; // Match chest level

              const distanceToPlayer = projectile.position.distanceTo(currentPlayerPosition);

              if (distanceToPlayer > 1.5 && !projectile.fadeStartTime) {
                // Update direction toward current player position (dynamic following)
                projectile.direction = new Vector3().subVectors(currentPlayerPosition, projectile.position).normalize();
              } else if (distanceToPlayer <= 1.5 && !projectile.fadeStartTime) {
                // Start fading when projectile reaches player
                projectile.fadeStartTime = Date.now();
              }
            }
          }
        }
      }
      
      // Only log when actually returning for debugging
      if (projectile.isReturning && projectile.returnHitEnemies.size === 0) {
        //console.log('🔄 Viper Sting entering return phase:', projectile.id);
      }

      // Handle projectile movement and return phase collision detection
      if (!projectile.isReturning) {
        // Forward movement - handled by useViperSting hook
        // CRITICAL FIX: Only check collisions after projectile has moved away from player
        const distanceFromStart = projectile.position.distanceTo(projectile.startPosition);
        if (distanceFromStart < 2.0) {
          // Projectile hasn't moved far enough from start position - skip collision detection
          // This prevents self-damage when projectile is first created
          return;
        }

        // Collision detection for forward phase
        players.forEach(player => {
          // Skip if this is the local player (they can't hit themselves)
          if (player.id === localSocketId) {
            return; // Don't hit yourself
          }

          // Use temporary Vector3 from pool instead of creating new one
          const playerPos = pvpObjectPool.getTempVector3(
            player.position.x,
            player.position.y,
            player.position.z
          );
          const distance = projectilePos.distanceTo(playerPos);

          if (distance <= 1.3) { // Hit radius (same as ViperSting hook)
            if (player.id === localSocketId) {

              return; // Skip self-damage (this is redundant but kept for debugging)
            }

            // Check if we haven't already hit this player with this projectile
            if (!projectile.hitEnemies.has(player.id)) {
              projectile.hitEnemies.add(player.id);



              // Apply damage - Viper Sting damage is 61
              onPlayerHit(player.id, 61);

              // Create damage number for visual feedback
              if (damageNumberManager && damageNumberManager.addDamageNumber) {
                const hitPosition = new Vector3(player.position.x, player.position.y + 1.5, player.position.z);
                damageNumberManager.addDamageNumber(
                  61, // Viper Sting damage
                  false, // Not critical
                  hitPosition,
                  'viper_sting' // Damage type for light purple styling
                );
              }

              // Create soul steal effect at the hit player's position (only for the caster)
              if (onSoulStealCreated) {
                const hitPosition = new Vector3(player.position.x, player.position.y, player.position.z);
                onSoulStealCreated(hitPosition);

                // Schedule healing when soul steal reaches the caster (after 1.25 seconds)
                setTimeout(() => {
                  // Heal the local player (caster) when soul reaches them
                  const multiplayerContext = (window as any).multiplayerContext;
                  if (multiplayerContext && multiplayerContext.broadcastPlayerHealing && multiplayerContext.players) {
                    // Get current player position for healing visual
                    const players = Array.from(multiplayerContext.players.values()) as any[];
                    const localPlayer = players.find((p: any) => p.id === localSocketId);
                    if (localPlayer && localPlayer.position) {
                      const healingPosition = {
                        x: localPlayer.position.x,
                        y: localPlayer.position.y + 1.5,
                        z: localPlayer.position.z
                      };

                      // Broadcast healing to all players (this will create damage numbers via handlePlayerHealing)
                      multiplayerContext.broadcastPlayerHealing(20, 'viper_sting', healingPosition);


                    }
                  }
                }, 1750); // Match soul steal effect duration
              }
            }
          }
        });
      } else {
        // Return phase - handle movement and collision detection with dynamic targeting

        // Find the current position of the caster
        let returnTargetPosition: Vector3;
        const casterPlayer = players.find(p => p.id === projectile.casterId);
        if (casterPlayer) {
          returnTargetPosition = new Vector3(
            casterPlayer.position.x,
            casterPlayer.position.y,
            casterPlayer.position.z
          );
        } else {
          // Fallback if caster not found
          returnTargetPosition = projectile.casterPosition || projectile.startPosition;
        }

        const distanceToPlayer = projectile.position.distanceTo(returnTargetPosition);

        if (distanceToPlayer > 1.5 && !projectile.fadeStartTime) {
          // Move projectile back toward player (simulate the movement from useViperSting)
          projectile.position.add(
            projectile.direction.clone().multiplyScalar(0.525) // PROJECTILE_RETURN_SPEED from useViperSting
          );

          // This prevents self-damage during the final return phase
          if (distanceToPlayer < 2.0) {
            return; // Too close to player, skip collision detection
          }

          // Check for enemy collisions during return phase
          players.forEach(player => {
            // Skip if this is the local player (they can't hit themselves)
            if (player.id === localSocketId) {
              return; // Don't hit yourself
            }

            // Use temporary Vector3 from pool instead of creating new one
            const playerPos = pvpObjectPool.getTempVector3(
              player.position.x,
              player.position.y,
              player.position.z
            );
            const distance = projectilePos.distanceTo(playerPos);

            if (distance <= 1.3) { // Hit radius (same as ViperSting hook)
              if (player.id === localSocketId) {
                return; // Skip self-damage 
              }

              // Check if we haven't already hit this player during return phase
              if (!projectile.returnHitEnemies.has(player.id)) {
                projectile.returnHitEnemies.add(player.id);

   

                // Apply damage - Viper Sting damage is 61
                onPlayerHit(player.id, 61);

                // Create damage number for visual feedback
                if (damageNumberManager && damageNumberManager.addDamageNumber) {
                  const hitPosition = new Vector3(player.position.x, player.position.y + 1.5, player.position.z);
                  damageNumberManager.addDamageNumber(
                    61, // Viper Sting damage
                    false, // Not critical
                    hitPosition,
                    'viper_sting' // Damage type for light purple styling
                  );
                }

                // Create soul steal effect at the hit player's position (only for the caster)
                if (onSoulStealCreated) {
                  const hitPosition = new Vector3(player.position.x, player.position.y, player.position.z);
                  onSoulStealCreated(hitPosition);

                  // Schedule healing when soul steal reaches the caster (after 1.25 seconds)
                  setTimeout(() => {
                    // Heal the local player (caster) when soul reaches them
                    const multiplayerContext = (window as any).multiplayerContext;
                    if (multiplayerContext && multiplayerContext.broadcastPlayerHealing && multiplayerContext.players) {
                      // Get current player position for healing visual
                      const players = Array.from(multiplayerContext.players.values()) as any[];
                      const localPlayer = players.find((p: any) => p.id === localSocketId);
                      if (localPlayer && localPlayer.position) {
                        const healingPosition = {
                          x: localPlayer.position.x,
                          y: localPlayer.position.y + 1.5,
                          z: localPlayer.position.z
                        };

                        // Broadcast healing to all players (this will create damage numbers via handlePlayerHealing)
                        multiplayerContext.broadcastPlayerHealing(20, 'viper_sting', healingPosition);

 
                      }
                    }
                  }, 1250); // Match soul steal effect duration
                }
              }
            }
          });
        } else if (!projectile.fadeStartTime) {
          // Start fading when projectile reaches player
          projectile.fadeStartTime = Date.now();
        }
      }

      // Handle fading for projectiles that have reached their fade start time
      if (projectile.fadeStartTime) {
        const fadeElapsed = Date.now() - projectile.fadeStartTime;
        const fadeProgress = fadeElapsed / 350; // FADE_DURATION from useViperSting
        projectile.opacity = Math.max(0, 1 - fadeProgress);

        if (fadeProgress >= 1) {
          projectile.active = false;
        }
      }
    });

    // Clear processed hits for next frame
    processedHits.current.clear();
  });

  return null; // This is a logic-only component
}

/**
 * Optimized Crossentropy Manager with Object Pooling
 */
export function OptimizedPVPCrossentropyManager({
  world,
  players,
  onPlayerHit,
  onPlayerExplosion,
  serverPlayerEntities,
  localSocketId,
  damageNumberManager
}: PVPCrossentropyManagerProps) {
  
  const hitTracker = useRef<Set<string>>(new Set());
  const lastUpdateTime = useRef(0);
  
  useFrame(() => {
    // Don't do collision detection if we don't know who the local player is
    if (!localSocketId) return;

    if (!world) return;

    // Throttle updates to avoid excessive checking
    const now = Date.now();
    if (now - lastUpdateTime.current < 16) return; // ~60fps
    lastUpdateTime.current = now;
    
    // Reset temporary objects for this frame
    pvpObjectPool.resetFrameTemporaries();
    
    // Get all Crossentropy bolt projectile entities
    const projectileEntities = world.queryEntities([Transform, Projectile, Renderer]);
    
    projectileEntities.forEach(projectileEntity => {
      const renderer = projectileEntity.getComponent(Renderer);
      const transform = projectileEntity.getComponent(Transform);
      const projectile = projectileEntity.getComponent(Projectile);
      
      // Check if this is a Crossentropy bolt
      if (!renderer?.mesh?.userData?.isCrossentropyBolt || !transform || !projectile) {
        return;
      }
      
      const projectilePos = transform.position;
      
      // Check collision with PVP players (only check players that are NOT the local player)
      players.forEach(player => {
        // Skip if this is the local player (they can't hit themselves)
        if (player.id === localSocketId) {
          return; // Don't hit yourself
        }

        // Additional safety check: skip if this player's entity ID matches the projectile owner
        const playerEntityId = serverPlayerEntities.current.get(player.id);
        if (playerEntityId && playerEntityId === projectile.owner) {
          return; // Don't hit the projectile owner (entity ID check)
        }

        // Use temporary Vector3 from pool
        const playerPos = pvpObjectPool.getTempVector3(
          player.position.x,
          player.position.y,
          player.position.z
        );
        const distance = projectilePos.distanceTo(playerPos);

        if (distance <= 1.5) { // Hit radius for Crossentropy bolt
          // Create unique hit key using pooled method
          const hitKey = pvpObjectPool.createHitKey(projectileEntity.id, player.id);

          // Check if we haven't already hit this player with this projectile
          if (playerEntityId && !projectile.hasHitTarget(playerEntityId) && !hitTracker.current.has(hitKey)) {
            projectile.addHitTarget(playerEntityId);
            hitTracker.current.add(hitKey);
            
            // Apply burning stacks for Crossentropy bolt
            let finalDamage = projectile.damage; // Use projectile's configured damage
            const controlSystemRef = (window as any).controlSystemRef;
            if (controlSystemRef && controlSystemRef.current) {
              const controlSystem = controlSystemRef.current;
              const currentTime = Date.now() / 1000;

              // Apply burning stack and get damage bonus (false = Crossentropy bolt)
              const { damageBonus } = controlSystem.applyBurningStack(playerEntityId, currentTime, false);

              // No PVP damage cap - allow full burning damage bonus
              finalDamage = projectile.damage + damageBonus;
              
            }
            
            onPlayerHit(player.id, finalDamage); // Crossentropy damage with burning bonus

            // Create damage number for visual feedback (orange for Crossentropy)
            if (damageNumberManager && damageNumberManager.addDamageNumber) {
              const hitPosition = new Vector3(player.position.x, player.position.y + 1.5, player.position.z);
              damageNumberManager.addDamageNumber(
                finalDamage, // Crossentropy damage with burning bonus
                false, // Not critical
                hitPosition,
                'crossentropy' // Damage type for orange styling
              );
            }

            // Trigger explosion effect at the HIT player's position
            // Use pooled Vector3 for the explosion position
            const explosionPosition = pvpObjectPool.acquireVector3(
              player.position.x, 
              player.position.y, 
              player.position.z
            );
            
            onPlayerExplosion(player.id, explosionPosition);
            
            // Release the Vector3 back to pool
            pvpObjectPool.releaseVector3(explosionPosition);
            
            // Clean up hit tracker after a delay to prevent memory leaks
            setTimeout(() => {
              hitTracker.current.delete(hitKey);
            }, 10000); // Clean up after 10 seconds
          }
        }
      });
    });
  });
  
  return null; // This is a logic-only component
}
