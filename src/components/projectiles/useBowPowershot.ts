import { useState, useCallback, useRef } from 'react';
import { Vector3 } from 'three';
import { WeaponSubclass } from '@/components/dragon/weapons';

export interface BowPowershotEffect {
  id: number;
  position: Vector3;
  direction: Vector3;
  subclass: WeaponSubclass;
  isElementalShotsUnlocked: boolean;
  isPerfectShot: boolean;
  chargeProgress: number;
  startTime: number;
}

// Global state for bow powershot effects
let globalActiveEffects: BowPowershotEffect[] = [];
let globalNextEffectId = 1;
let globalSetActiveEffects: ((effects: BowPowershotEffect[]) => void) | null = null;

// Global functions to manage effects
export const createGlobalPowershotEffect = (
  position: Vector3,
  direction: Vector3,
  subclass: WeaponSubclass,
  isPerfectShot: boolean = false,
  isElementalShotsUnlocked: boolean = true,
  chargeProgress: number = 0
): number => {
  const effectId = globalNextEffectId++;

  const newEffect: BowPowershotEffect = {
    id: effectId,
    position: position.clone(),
    direction: direction.clone().normalize(),
    subclass,
    isElementalShotsUnlocked,
    isPerfectShot,
    chargeProgress,
    startTime: Date.now()
  };

  globalActiveEffects = [...globalActiveEffects, newEffect];
  
  if (globalSetActiveEffects) {
    globalSetActiveEffects(globalActiveEffects);
  }
  
  return effectId;
};

export const removeGlobalPowershotEffect = (effectId: number): void => {
  globalActiveEffects = globalActiveEffects.filter(effect => effect.id !== effectId);
  
  if (globalSetActiveEffects) {
    globalSetActiveEffects(globalActiveEffects);
  }
};

export const useBowPowershot = () => {
  const [activeEffects, setActiveEffects] = useState<BowPowershotEffect[]>(globalActiveEffects);
  
  // Register this component's setter as the global one
  globalSetActiveEffects = setActiveEffects;

  const createPowershotEffect = useCallback((
    position: Vector3,
    direction: Vector3,
    subclass: WeaponSubclass,
    isPerfectShot: boolean = false,
    isElementalShotsUnlocked: boolean = true,
    chargeProgress: number = 0
  ) => {
    return createGlobalPowershotEffect(position, direction, subclass, isPerfectShot, isElementalShotsUnlocked, chargeProgress);
  }, []);

  const removeEffect = useCallback((effectId: number) => {
    removeGlobalPowershotEffect(effectId);
  }, []);

  const clearAllEffects = useCallback(() => {
    globalActiveEffects = [];
    setActiveEffects([]);
  }, []);

  return {
    activeEffects,
    createPowershotEffect,
    removeEffect,
    clearAllEffects
  };
};
