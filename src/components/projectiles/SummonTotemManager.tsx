import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import SummonedTotem from './SummonedTotem';

interface SummonTotemData {
  id: number;
  startTime: number;
  isActive: boolean;
  position: Vector3;
  onComplete: () => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void;
  setActiveEffects?: (callback: (prev: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => void;
  activeEffects?: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  onHealPlayer?: (healAmount: number) => void;
  casterId?: string;
  localSocketId?: string;
  onCreateExplosion?: (targetId: string, position: Vector3) => void;
}

interface SummonTotemManagerProps {
  onTotemComplete?: (totemId: number) => void;
  players?: Map<string, any>; // Real-time players data
  localSocketId?: string; // Local player ID to exclude from targets
}

export interface SummonTotemManagerRef {
  createTotem: (
    position: Vector3,
    enemyData?: Array<{ id: string; position: Vector3; health: number }>,
    onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void,
    setActiveEffects?: (callback: (prev: Array<{
      id: number;
      type: string;
      position: Vector3;
      direction: Vector3;
      duration?: number;
      startTime?: number;
      summonId?: number;
      targetId?: string;
    }>) => Array<{
      id: number;
      type: string;
      position: Vector3;
      direction: Vector3;
      duration?: number;
      startTime?: number;
      summonId?: number;
      targetId?: string;
    }>) => void,
    activeEffects?: Array<{
      id: number;
      type: string;
      position: Vector3;
      direction: Vector3;
      duration?: number;
      startTime?: number;
      summonId?: number;
      targetId?: string;
    }>,
    setDamageNumbers?: (callback: (prev: Array<{
      id: number;
      damage: number;
      position: Vector3;
      isCritical: boolean;
      isSummon?: boolean;
    }>) => Array<{
      id: number;
      damage: number;
      position: Vector3;
      isCritical: boolean;
      isSummon?: boolean;
    }>) => void,
    nextDamageNumberId?: { current: number },
    onHealPlayer?: (healAmount: number) => void,
    casterId?: string,
    localSocketId?: string,
    onCreateExplosion?: (targetId: string, position: Vector3) => void
  ) => number;
}

const SummonTotemManager = forwardRef<SummonTotemManagerRef, SummonTotemManagerProps>(({ onTotemComplete, players, localSocketId }, ref) => {
  const [activeTotems, setActiveTotems] = useState<SummonTotemData[]>([]);
  const totemIdCounter = useRef(0);

  useImperativeHandle(ref, () => ({
    createTotem
  }));

  const createTotem = useCallback((
    position: Vector3,
    enemyData: Array<{ id: string; position: Vector3; health: number }> = [],
    onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void,
    setActiveEffects?: (callback: (prev: Array<{
      id: number;
      type: string;
      position: Vector3;
      direction: Vector3;
      duration?: number;
      startTime?: number;
      summonId?: number;
      targetId?: string;
    }>) => Array<{
      id: number;
      type: string;
      position: Vector3;
      direction: Vector3;
      duration?: number;
      startTime?: number;
      summonId?: number;
      targetId?: string;
    }>) => void,
    activeEffects?: Array<{
      id: number;
      type: string;
      position: Vector3;
      direction: Vector3;
      duration?: number;
      startTime?: number;
      summonId?: number;
      targetId?: string;
    }>,
    setDamageNumbers?: (callback: (prev: Array<{
      id: number;
      damage: number;
      position: Vector3;
      isCritical: boolean;
      isSummon?: boolean;
    }>) => Array<{
      id: number;
      damage: number;
      position: Vector3;
      isCritical: boolean;
      isSummon?: boolean;
    }>) => void,
    nextDamageNumberId?: { current: number },
    onHealPlayer?: (healAmount: number) => void,
    casterId?: string,
    localSocketId?: string,
    onCreateExplosion?: (targetId: string, position: Vector3) => void
  ) => {
    const totemId = totemIdCounter.current++;
    const startTime = Date.now();

    const handleTotemComplete = () => {
      setActiveTotems(prev => prev.filter(totem => totem.id !== totemId));
      onTotemComplete?.(totemId);
    };

    const newTotem: SummonTotemData = {
      id: totemId,
      startTime,
      isActive: true,
      position: position.clone(),
      onComplete: handleTotemComplete,
      enemyData,
      onDamage,
      setActiveEffects,
      activeEffects: activeEffects || [],
      setDamageNumbers,
      nextDamageNumberId,
      onHealPlayer,
      casterId: casterId,
      localSocketId,
      onCreateExplosion
    };

    setActiveTotems(prev => [...prev, newTotem]);

    // Auto-complete after totem duration (8 seconds)
    setTimeout(() => {
      handleTotemComplete();
    }, 8000);

    return totemId;
  }, [onTotemComplete]);

  // Update totems each frame
  useFrame(() => {
    // Active totems are managed by their own timeouts
  });

  return (
    <>
      {activeTotems.map(totem => (
        <SummonedTotem
          key={totem.id}
          position={totem.position}
          players={players}
          localSocketId={totem.localSocketId}
          enemyData={totem.enemyData}
          onDamage={totem.onDamage}
          onComplete={totem.onComplete}
          setActiveEffects={totem.setActiveEffects}
          activeEffects={totem.activeEffects}
          setDamageNumbers={totem.setDamageNumbers}
          nextDamageNumberId={totem.nextDamageNumberId}
          onHealPlayer={totem.onHealPlayer}
          casterId={totem.casterId}
          onCreateExplosion={totem.onCreateExplosion}
        />
      ))}
    </>
  );
});

SummonTotemManager.displayName = 'SummonTotemManager';

export default SummonTotemManager;

let globalSummonTotemTriggerCallback: ((position: Vector3, enemyData?: Array<{ id: string; position: Vector3; health: number }>, onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void, setActiveEffects?: (callback: (prev: Array<{
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration?: number;
  startTime?: number;
  summonId?: number;
  targetId?: string;
}>) => Array<{
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration?: number;
  startTime?: number;
  summonId?: number;
  targetId?: string;
}>) => void, activeEffects?: Array<{
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration?: number;
  startTime?: number;
  summonId?: number;
  targetId?: string;
}>, setDamageNumbers?: (callback: (prev: Array<{
  id: number;
  damage: number;
  position: Vector3;
  isCritical: boolean;
  isSummon?: boolean;
}>) => Array<{
  id: number;
  damage: number;
  position: Vector3;
  isCritical: boolean;
  isSummon?: boolean;
}>) => void, nextDamageNumberId?: { current: number }, onHealPlayer?: (healAmount: number) => void, casterId?: string) => void) | null = null;

export const setGlobalSummonTotemTrigger = (callback: (position: Vector3, enemyData?: Array<{ id: string; position: Vector3; health: number }>, onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void, setActiveEffects?: (callback: (prev: Array<{
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration?: number;
  startTime?: number;
  summonId?: number;
  targetId?: string;
}>) => Array<{
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration?: number;
  startTime?: number;
  summonId?: number;
  targetId?: string;
}>) => void, activeEffects?: Array<{
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration?: number;
  startTime?: number;
  summonId?: number;
  targetId?: string;
}>, setDamageNumbers?: (callback: (prev: Array<{
  id: number;
  damage: number;
  position: Vector3;
  isCritical: boolean;
  isSummon?: boolean;
}>) => Array<{
  id: number;
  damage: number;
  position: Vector3;
  isCritical: boolean;
  isSummon?: boolean;
}>) => void, nextDamageNumberId?: { current: number }, onHealPlayer?: (healAmount: number) => void, casterId?: string) => void) => {
  globalSummonTotemTriggerCallback = callback;
};

export const triggerGlobalSummonTotem = (
  position: Vector3,
  enemyData?: Array<{ id: string; position: Vector3; health: number }>,
  onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void,
  setActiveEffects?: (callback: (prev: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => void,
  activeEffects?: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>,
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => void,
  nextDamageNumberId?: { current: number },
  onHealPlayer?: (healAmount: number) => void,
  casterId?: string
) => {
  if (globalSummonTotemTriggerCallback) {
    globalSummonTotemTriggerCallback(
      position,
      enemyData,
      onDamage,
      setActiveEffects,
      activeEffects,
      setDamageNumbers,
      nextDamageNumberId,
      onHealPlayer,
      casterId
    );
  }
};

export const createSummonTotem = (
  position: Vector3,
  enemyData?: Array<{ id: string; position: Vector3; health: number }>,
  onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void,
  setActiveEffects?: (callback: (prev: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => void,
  activeEffects?: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>,
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => void,
  nextDamageNumberId?: { current: number },
  onHealPlayer?: (healAmount: number) => void,
  casterId?: string
): number | null => {
  // This function can be called from external systems to create totems
  // The actual implementation will be handled by the manager component

  // For now, return a dummy ID - the actual creation is handled by the component
  return Date.now();
};

// Expose the trigger function globally for remote ability handling
if (typeof window !== 'undefined') {
  (window as any).triggerGlobalSummonTotem = triggerGlobalSummonTotem;
}
