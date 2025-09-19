import React, { useRef, useEffect } from 'react';
import SummonTotemManager, { setGlobalSummonTotemTrigger, SummonTotemManagerRef } from './SummonTotemManager';
import { Vector3 } from '@/utils/three-exports';

interface PVPSummonTotemManagerProps {
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
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
  playerId?: string; // Add player ID for healing
}

const PVPSummonTotemManager: React.FC<PVPSummonTotemManagerProps> = ({
  enemyData = [],
  onDamage,
  setActiveEffects,
  activeEffects = [],
  setDamageNumbers,
  nextDamageNumberId,
  onHealPlayer,
  playerId
}) => {
  const managerRef = React.useRef<SummonTotemManagerRef>(null);

  React.useEffect(() => {
    console.log('🎭 PVPSummonTotemManager: Setting up global trigger with enemyData:', enemyData.length, 'enemies');
    setGlobalSummonTotemTrigger((position, enemyDataParam, onDamageParam, setActiveEffectsParam, activeEffectsParam, setDamageNumbersParam, nextDamageNumberIdParam, onHealPlayerParam, casterId) => {
      console.log('🎭 PVPSummonTotemManager: Global trigger called at position:', position, 'with enemyDataParam:', enemyDataParam?.length || 0, 'enemies');
      console.log('🎭 PVPSummonTotemManager: Using enemyDataParam or fallback enemyData:', enemyDataParam ? enemyDataParam.length : enemyData.length, 'enemies');
      if (managerRef.current) {
        const finalEnemyData = enemyDataParam || enemyData;
        console.log('🎭 PVPSummonTotemManager: Final enemyData for totem:', finalEnemyData.map(e => ({ id: e.id, pos: e.position, health: e.health })));
        managerRef.current.createTotem(
          position,
          finalEnemyData,
          onDamageParam || onDamage,
          setActiveEffectsParam || setActiveEffects,
          activeEffectsParam || activeEffects,
          setDamageNumbersParam || setDamageNumbers,
          nextDamageNumberIdParam || nextDamageNumberId,
          onHealPlayerParam || onHealPlayer
        );
      }
    });

    return () => {
      setGlobalSummonTotemTrigger(() => {});
    };
  }, [enemyData, onDamage, setActiveEffects, activeEffects, setDamageNumbers, nextDamageNumberId, onHealPlayer, playerId]);

  return (
    <SummonTotemManager
      ref={managerRef}
      onTotemComplete={(totemId) => {
        console.log('🎭 PVP Summon Totem completed:', totemId);
      }}
    />
  );
};

export default PVPSummonTotemManager;
