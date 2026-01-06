import React, { useRef, useEffect } from 'react';
import SummonTotemManager, { setGlobalSummonTotemTrigger, SummonTotemManagerRef } from './SummonTotemManager';
import { Vector3 } from '@/utils/three-exports';

interface PVPSummonTotemManagerProps {
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
  players?: Map<string, any>; // Add players map for real-time position updates
  localSocketId?: string; // Add local socket ID to exclude self
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
  onHealPlayerCallback?: (healAmount: number) => void; // Additional healing callback
  onCreateExplosion?: (targetId: string, position: Vector3) => void; // Callback to create explosion locally
}

const PVPSummonTotemManager: React.FC<PVPSummonTotemManagerProps> = ({
  enemyData = [],
  players,
  localSocketId,
  onDamage,
  setActiveEffects,
  activeEffects = [],
  setDamageNumbers,
  nextDamageNumberId,
  onHealPlayer,
  playerId,
  onHealPlayerCallback,
  onCreateExplosion
}) => {
  const managerRef = React.useRef<SummonTotemManagerRef>(null);

  // Use refs to access latest props in callback
  const playersRef = React.useRef(players);
  const enemyDataRef = React.useRef(enemyData);

  // Update refs when props change
  React.useEffect(() => {
    playersRef.current = players;
  }, [players]);

  React.useEffect(() => {
    enemyDataRef.current = enemyData;
  }, [enemyData]);

  React.useEffect(() => {
    setGlobalSummonTotemTrigger((position, enemyDataParam, onDamageParam, setActiveEffectsParam, activeEffectsParam, setDamageNumbersParam, nextDamageNumberIdParam, onHealPlayerParam, casterId) => {

      if (managerRef.current) {
        let finalEnemyData: Array<{ id: string; position: Vector3; health: number }> = [];

        // If enemyDataParam is provided, use it (for remote totems) but filter out the caster
        if (enemyDataParam && enemyDataParam.length > 0) {
          finalEnemyData = enemyDataParam.filter(enemy => enemy.id !== casterId);
        } else {
          // Otherwise, use the current enemyData prop directly (for remote totems when enemyDataParam is not provided)
          const currentPlayers = playersRef.current;

          if (currentPlayers) {
            finalEnemyData = Array.from(currentPlayers.entries())
              .filter(([playerId]) => playerId !== casterId) // Exclude the caster of the totem
              .map(([playerId, playerData]) => ({
                id: playerId,
                position: new Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
                health: playerData.health
              }));
          }

          // Also include any provided enemyData prop (NPCs)
          if (enemyData && enemyData.length > 0) {
            finalEnemyData = [...finalEnemyData, ...enemyData];
          }
        }

        // For remote totems, use the caster's ID as localSocketId so the totem excludes the caster
        // For local totems, use the actual local player's ID
        const effectiveLocalSocketId = enemyDataParam ? casterId : localSocketId;

        managerRef.current.createTotem(
          position,
          finalEnemyData,
          onDamageParam || onDamage,
          setActiveEffectsParam || setActiveEffects,
          activeEffectsParam || activeEffects,
          setDamageNumbersParam || setDamageNumbers,
          nextDamageNumberIdParam || nextDamageNumberId,
          onHealPlayerParam || (casterId && localSocketId && casterId !== localSocketId ? (() => {
            // Remote totems should not heal anyone locally - healing is handled by the server
          }) : onHealPlayer) || onHealPlayerCallback || ((healAmount: number) => {
            // Heal the local player - this should be handled by the parent component
          }),
          casterId,
          effectiveLocalSocketId,
          onCreateExplosion
        );
      }
    });

    return () => {
      setGlobalSummonTotemTrigger(() => {});
    };
  }, [onDamage, setActiveEffects, activeEffects, setDamageNumbers, nextDamageNumberId, onHealPlayer, onHealPlayerCallback, playerId, enemyData, players, localSocketId]);

  return (
    <SummonTotemManager
      ref={managerRef}
      onTotemComplete={(totemId) => {
      }}
      players={players}
      localSocketId={localSocketId}
    />
  );
};

export default PVPSummonTotemManager;
