'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import CobraShot, { CobraShotProjectile } from './CobraShot';
import CobraShotBeam from './CobraShotBeam';
import VenomEffect from './VenomEffect';
import VenomEffectManager, { addGlobalVenomousEnemy } from './VenomEffectManager';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Health } from '@/ecs/components/Health';
import { Transform } from '@/ecs/components/Transform';
import { CombatSystem } from '@/systems/CombatSystem';

interface VenomEffectInstance {
  id: number;
  position: Vector3;
  startTime: number;
}

interface CobraShotBeamInstance {
  id: number;
  position: Vector3;
  direction: Vector3;
  startTime: number;
}

interface CobraShotManagerProps {
  world: World;
}

// Global function to trigger cobra shot from ControlSystem
let globalCobraShotTrigger: ((position: Vector3, direction: Vector3) => void) | null = null;
let globalCobraShotProjectilePool: (() => CobraShotProjectile[]) | null = null;

export function triggerGlobalCobraShot(position: Vector3, direction: Vector3): void {
  if (globalCobraShotTrigger) {
    globalCobraShotTrigger(position, direction);
  }
}

export function getGlobalCobraShotProjectiles(): CobraShotProjectile[] {
  if (globalCobraShotProjectilePool) {
    return globalCobraShotProjectilePool();
  }
  return [];
}

export default function CobraShotManager({ world }: CobraShotManagerProps) {
  const projectilePool = useRef<CobraShotProjectile[]>([]);
  const venomEffects = useRef<VenomEffectInstance[]>([]);
  const beamEffects = useRef<CobraShotBeamInstance[]>([]);
  const lastShotTime = useRef(0);
  const nextProjectileId = useRef(0);
  const nextVenomEffectId = useRef(0);
  const nextBeamEffectId = useRef(0);
  
  const POOL_SIZE = 3;
  const PROJECTILE_SPEED = 1.0; // Increased speed for better hit detection
  const DAMAGE = 29; // Base damage
  const MAX_DISTANCE = 25; // Longer range than Viper Sting since it doesn't return
  const FADE_DURATION = 1000;
  const VENOM_DURATION = 6; // 6 seconds venom debuff
  const VENOM_DAMAGE_PER_SECOND = 17; // 17 damage per second

  // Initialize projectile pool
  useEffect(() => {
    projectilePool.current = Array(POOL_SIZE).fill(null).map((_, index) => ({
      id: index,
      position: new Vector3(),
      direction: new Vector3(),
      startPosition: new Vector3(),
      maxDistance: MAX_DISTANCE,
      active: false,
      startTime: 0,
      hitEnemies: new Set(),
      opacity: 1,
      fadeStartTime: null
    }));
  }, []);

  const getInactiveProjectile = useCallback(() => {
    return projectilePool.current.find(p => !p.active);
  }, []);

  const shootCobraShot = useCallback((position: Vector3, direction: Vector3) => {
    
    const projectile = getInactiveProjectile();
    if (!projectile) {
      // console.log('🐍 No available Cobra Shot projectiles in pool');
      return;
    }

    const now = Date.now();

    // Set up projectile
    projectile.position.copy(position);
    projectile.direction.copy(direction).normalize();
    projectile.startPosition.copy(position);
    projectile.active = true;
    projectile.startTime = now;
    projectile.hitEnemies.clear();
    projectile.opacity = 1;
    projectile.fadeStartTime = null;


    // Create beam effect for visual impact
    createBeamEffect(position, direction);
  }, [getInactiveProjectile]);

  // Set up global trigger and projectile pool access
  useEffect(() => {
    globalCobraShotTrigger = shootCobraShot;
    globalCobraShotProjectilePool = () => projectilePool.current;
    return () => {
      globalCobraShotTrigger = null;
      globalCobraShotProjectilePool = null;
    };
  }, [shootCobraShot]);

  const createVenomEffect = useCallback((position: Vector3) => {
    const effect: VenomEffectInstance = {
      id: nextVenomEffectId.current++,
      position: position.clone(),
      startTime: Date.now()
    };
    venomEffects.current.push(effect);
  }, []);

  const removeVenomEffect = useCallback((id: number) => {
    venomEffects.current = venomEffects.current.filter(effect => effect.id !== id);
  }, []);

  const createBeamEffect = useCallback((position: Vector3, direction: Vector3) => {
    const beam: CobraShotBeamInstance = {
      id: nextBeamEffectId.current++,
      position: position.clone(),
      direction: direction.clone(),
      startTime: Date.now()
    };
    beamEffects.current.push(beam);
  }, []);

  const removeBeamEffect = useCallback((id: number) => {
    beamEffects.current = beamEffects.current.filter(beam => beam.id !== id);
  }, []);

  // Update projectiles and handle collisions
  useFrame(() => {
    const currentTime = Date.now();
    const deltaTime = 1/60; // Assume 60fps for consistent movement

    projectilePool.current.forEach(projectile => {
      if (!projectile.active) return;

      const elapsed = currentTime - projectile.startTime;
      
      // Move projectile
      const movement = projectile.direction.clone().multiplyScalar(PROJECTILE_SPEED);
      projectile.position.add(movement);

      // Check distance traveled
      const distanceTraveled = projectile.position.distanceTo(projectile.startPosition);
      
      
      // Start fading when approaching max distance
      if (distanceTraveled > MAX_DISTANCE * 0.8 && !projectile.fadeStartTime) {
        projectile.fadeStartTime = currentTime;
      }

      // Handle fading
      if (projectile.fadeStartTime) {
        const fadeElapsed = currentTime - projectile.fadeStartTime;
        projectile.opacity = Math.max(0, 1 - (fadeElapsed / FADE_DURATION));
        
        if (projectile.opacity <= 0 || distanceTraveled > MAX_DISTANCE) {
          projectile.active = false;
          projectile.opacity = 1;
          projectile.fadeStartTime = null;
          return;
        }
      }

      // Check collisions with enemies
      const allEntities = world.getAllEntities();
      allEntities.forEach(entity => {
        if (projectile.hitEnemies.has(entity.id)) return;

        const enemy = entity.getComponent(Enemy);
        const health = entity.getComponent(Health);
        const transform = entity.getComponent(Transform);

        if (!enemy || !health || !transform || health.isDead) return;

        const distance = projectile.position.distanceTo(transform.position);
        if (distance <= 1.25) { // Increased hit radius for better collision detection
          projectile.hitEnemies.add(entity.id);
          
          // Deal damage through combat system
          const combatSystem = world.getSystem(CombatSystem);
          if (combatSystem) {
            combatSystem.queueDamage(entity, DAMAGE, undefined, 'cobra_shot');
          }

          // Apply venom debuff
          const currentGameTime = Date.now() / 1000;
          enemy.applyVenom(VENOM_DURATION, VENOM_DAMAGE_PER_SECOND, currentGameTime);

          // Create persistent venom effect on enemy using global manager
          addGlobalVenomousEnemy(entity.id.toString(), transform.position);

          // Create one-time venom effect at hit location
          createVenomEffect(transform.position);

          // Deactivate projectile after hit (one-way projectile)
          projectile.active = false;
          projectile.opacity = 1;
          projectile.fadeStartTime = null;
        }
      });
    });

    // Update venom effects on enemies and deal damage
    const allEntities = world.getAllEntities();
    const combatSystem = world.getSystem(CombatSystem);
    
    allEntities.forEach(entity => {
      const enemy = entity.getComponent(Enemy);
      const health = entity.getComponent(Health);
      const transform = entity.getComponent(Transform);

      if (!enemy || !health || !transform || health.isDead) return;

      const venomStatus = enemy.updateVenomStatus(currentTime / 1000);
      if (venomStatus.shouldDealDamage && combatSystem) {
          // Deal venom damage
          combatSystem.queueDamage(entity, venomStatus.damage, undefined, 'cobra_shot');
        
        // Create venom effect animation every second (one-time pulse effect)
        createVenomEffect(transform.position);
      }
    });
  });

  return (
    <>
      <CobraShot projectilePool={projectilePool.current} />
      
      {/* Persistent venom effects on enemies */}
      <VenomEffectManager world={world} />
      
      {/* One-time venom pulse effects */}
      {venomEffects.current.map(effect => (
        <VenomEffect
          key={effect.id}
          position={effect.position}
          onComplete={() => removeVenomEffect(effect.id)}
        />
      ))}
      
      {/* Beam effects */}
      {beamEffects.current.map(beam => (
        <CobraShotBeam
          key={beam.id}
          position={beam.position}
          direction={beam.direction}
          onComplete={() => removeBeamEffect(beam.id)}
        />
      ))}
    </>
  );
}
