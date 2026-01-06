import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Group, Vector3, AdditiveBlending } from 'three';
import { useFrame } from '@react-three/fiber';
import TotemModel from './TotemModel';
import UnholyAura from './UnholyAura';
import { calculateDamage } from '@/core/DamageCalculator';
import { WeaponType } from '@/components/dragon/weapons';

interface SummonProps {
  position: Vector3;
  players?: Map<string, any>; // Real-time players data
  localSocketId?: string; // Local player ID to exclude from targets
  enemyData?: Array<{ // Fallback for NPCs or static enemies
    id: string;
    position: Vector3;
    health: number;
  }>;
  onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void;
  onComplete?: () => void;
  onStartCooldown?: () => void;
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
  onHealPlayer?: (healAmount: number) => void; // Callback for healing the caster
  casterId?: string; // ID of the player who cast the totem
  onCreateExplosion?: (targetId: string, position: Vector3) => void; // Callback to create explosion locally
}

export default function SummonedTotem({
  position,
  players,
  localSocketId,
  enemyData = [],
  onDamage,
  onComplete,
  onStartCooldown,
  setActiveEffects,
  activeEffects = [],
  setDamageNumbers,
  nextDamageNumberId,
  onHealPlayer,
  casterId,
  onCreateExplosion
}: SummonProps) {

  const groupRef = useRef<Group>(null);
  const [currentTarget, setCurrentTarget] = useState<{ id: string; position: Vector3; health: number } | null>(null);

  const constants = useRef({
    lastAttackTime: 0,
    startTime: Date.now(),
    hasTriggeredCleanup: false,
    mountId: Date.now(),
    ATTACK_COOLDOWN: 500, // 0.5 seconds
    RANGE: 6, // 5 units range for PVP targeting
    DURATION: 8000, // 8 seconds
    BASE_DAMAGE: 20, // Same as scythe basic attack damage
    EFFECT_DURATION: 225,
    // Removed TARGET_SWITCH_INTERVAL - continuously check for targets
    HEAL_INTERVAL: 1000, // Heal every 1 second
    HEAL_AMOUNT: 20, // 20 HP per second
    lastHealTime: Date.now()
  }).current;

  const calculateDistance = useCallback((pos1: Vector3, pos2: Vector3) => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, []);

  // Get current enemy data from players and static enemyData
  const getCurrentEnemyData = useCallback((): Array<{ id: string; position: Vector3; health: number }> => {
    let currentEnemies: Array<{ id: string; position: Vector3; health: number }> = [...enemyData];

    // Add real-time player positions
    if (players) {
      const allPlayerIds = Array.from(players.keys());

      const playerEnemies = Array.from(players.entries())
        .filter(([playerId]) => !casterId || playerId !== casterId) // Exclude the caster of the totem (if casterId is defined)
        .map(([playerId, playerData]) => ({
          id: playerId,
          position: new Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
          health: playerData.health
        }));

      currentEnemies = [...currentEnemies, ...playerEnemies];
    }

    return currentEnemies;
  }, [players, casterId, enemyData]);

  // Log initial enemy data
  const initialEnemyData = getCurrentEnemyData();

  // Log PVP player detection
  const pvpPlayers = initialEnemyData.filter(e => !e.id.startsWith('enemy-'));
  const npcs = initialEnemyData.filter(e => e.id.startsWith('enemy-'));

  const findNewTarget = useCallback((excludeCurrentTarget: boolean = false): { id: string; position: Vector3; health: number } | null => {
    if (!groupRef.current) {
      return null;
    }

    const currentEnemyData = getCurrentEnemyData();
    if (!currentEnemyData.length) {
      return null;
    }

    // Get the totem's world position
    const totemWorldPosition = new Vector3();
    groupRef.current.getWorldPosition(totemWorldPosition);

    let closestDistance = constants.RANGE;
    let closestTarget: { id: string; position: Vector3; health: number } | null = null;

    for (let i = 0; i < currentEnemyData.length; i++) {
      const enemy = currentEnemyData[i];

      if (enemy.health <= 0) {
        // Skip dead enemies
        continue;
      }

      // In PVP mode, only target enemy players (not NPCs)
      // Enemy players have socket IDs, NPCs have IDs starting with 'enemy-'
      if (enemy.id.startsWith('enemy-')) {
        // Skip enemy NPCs in PVP mode
        continue;
      }

      if (excludeCurrentTarget && currentTarget && enemy.id === currentTarget.id) {
        continue;
      }

      const distance = calculateDistance(
        enemy.position,
        totemWorldPosition
      );

      if (distance <= closestDistance) {
        closestDistance = distance;
        closestTarget = enemy;
      }
    }

    return closestTarget;
  }, [getCurrentEnemyData, calculateDistance, currentTarget, constants.RANGE]);

  const handleAttack = useCallback((target: { id: string; position: Vector3; health: number }) => {
    if (!target || target.health <= 0 || !onDamage || !nextDamageNumberId || !setDamageNumbers || !setActiveEffects) {

      return;
    }

    // CRITICAL FIX: Get the current/real-time enemy position from current enemy data at the moment of attack
    const currentEnemyData = getCurrentEnemyData();
    const currentEnemy = currentEnemyData.find(e => e.id === target.id && e.health > 0);
    if (!currentEnemy) {
      return;
    }

    // Calculate damage using the same system as scythe basic attacks
    const damageResult = calculateDamage(constants.BASE_DAMAGE, WeaponType.SCYTHE);

    // Use the enemy's current real-time position for damage numbers and effects (not cached target position)
    const currentWorldImpactPosition = currentEnemy.position.clone().setY(1.5);



    // CRITICAL: Prevent attacking the caster
    if (casterId && target.id === casterId) {
      return;
    }

    // Call the damage callback to route damage to server
    onDamage(target.id, damageResult.damage, currentWorldImpactPosition, damageResult.isCritical);

    const effectId = Date.now();

    // Create explosion locally for the caster to see
    if (onCreateExplosion) {
      onCreateExplosion(target.id, currentWorldImpactPosition);
    }

    // Broadcast explosion effect to all players so they can see the visual effect
    // Don't send position - let clients track the target player's current position
    if (typeof window !== 'undefined' && (window as any).multiplayer?.broadcastPlayerEffect) {
      (window as any).multiplayer.broadcastPlayerEffect({
        type: 'totem_explosion',
        targetPlayerId: target.id
      });
    }

    // Add damage number locally for immediate visual feedback (attributed to summoner)
    setDamageNumbers(prev => [...prev, {
      id: nextDamageNumberId.current++,
      damage: damageResult.damage,
      position: currentWorldImpactPosition.clone(),
      isCritical: damageResult.isCritical,
      isSummon: true // Mark as summon damage for proper attribution
    }]);
  }, [constants, onDamage, setActiveEffects, setDamageNumbers, nextDamageNumberId, getCurrentEnemyData, casterId]);

  const handleHealing = useCallback(() => {
    if (!onHealPlayer) {
      return;
    }

    const now = Date.now();
    if (now - constants.lastHealTime >= constants.HEAL_INTERVAL) {
      onHealPlayer(constants.HEAL_AMOUNT);
      constants.lastHealTime = now;
    }
  }, [constants, onHealPlayer]);

  useFrame(() => {
    const now = Date.now();

    // Check if totem duration is over
    if (now - constants.startTime > constants.DURATION) {
      if (!constants.hasTriggeredCleanup) {
        constants.hasTriggeredCleanup = true;
        onComplete?.();
        onStartCooldown?.();
      }
      return;
    }

    // Handle healing every second
    handleHealing();

    // Check attack cooldown
    if (now - constants.lastAttackTime < constants.ATTACK_COOLDOWN) {
      return;
    }


    // Continuously check for the closest enemy in range
    const closestEnemy = findNewTarget();

    // Attack if we have a valid target in range
    if (closestEnemy && closestEnemy.health > 0) {
      const currentTotemPosition = new Vector3();
      if (groupRef.current) {
        groupRef.current.getWorldPosition(currentTotemPosition);
      }
      const distance = calculateDistance(closestEnemy.position, currentTotemPosition);
      setCurrentTarget(closestEnemy);
      handleAttack(closestEnemy);
      constants.lastAttackTime = now;
    } else {
      // No enemy in range, clear current target
      if (currentTarget) {
        setCurrentTarget(null);
      }
    }
  });

  useEffect(() => {
    const currentMountId = constants.mountId;

    return () => {
      setActiveEffects?.(prev =>
        prev.filter(effect =>
          effect.type !== 'summonExplosion' ||
          effect.summonId !== currentMountId
        )
      );
    };
  }, [setActiveEffects, constants.mountId]);

  return (
    <group ref={groupRef} position={position.toArray()}>
      <TotemModel isAttacking={!!currentTarget} />
      <UnholyAura />

    </group>
  );
}
