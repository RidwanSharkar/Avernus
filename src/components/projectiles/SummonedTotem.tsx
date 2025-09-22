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
  casterId
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

    const updates = {
      damageNumber: {
        id: nextDamageNumberId.current++,
        damage: damageResult.damage,
        position: currentWorldImpactPosition.clone(),
        isCritical: damageResult.isCritical,
        isSummon: true // Mark as summon damage for proper attribution
      },
      effect: {
        id: effectId,
        type: 'summonExplosion',
        position: currentWorldImpactPosition.clone(), // Use current real-time position for explosion
        direction: new Vector3(),
        duration: constants.EFFECT_DURATION / 1000,
        startTime: Date.now(),
        summonId: constants.mountId,
        targetId: target.id
      }
    };

    // Add damage number locally for immediate visual feedback (attributed to summoner)
    setDamageNumbers(prev => [...prev, updates.damageNumber]);
    setActiveEffects(prev => [
      ...prev.filter(effect =>
        effect.type !== 'summonExplosion' ||
        (effect.startTime && Date.now() - effect.startTime < constants.EFFECT_DURATION)
      ),
      updates.effect
    ]);

    requestAnimationFrame(() => {
      const cleanupTime = Date.now();
      if (cleanupTime - updates.effect.startTime >= constants.EFFECT_DURATION + 150) {
        setActiveEffects(prev => prev.filter(effect => effect.id !== effectId));
      }
    });
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

      {/* Render active effects */}
      {activeEffects.map(effect => {
        if (effect.type === 'summonExplosion') {
          const elapsed = effect.startTime ? (Date.now() - effect.startTime) / 1000 : 0;
          const duration = effect.duration || 0.2;
          const fade = Math.max(0, 1 - (elapsed / duration));

          // Effect position is now stored as absolute world position
          const effectWorldPosition = effect.position;

          return (
            <group key={effect.id} position={effectWorldPosition.toArray()}>
              <mesh>
                <sphereGeometry args={[0.35 * (1 + elapsed * 2), 32, 32]} />
                <meshStandardMaterial
                  color="#0099ff"
                  emissive="#0088cc"
                  emissiveIntensity={0.5 * fade}
                  transparent
                  opacity={0.8 * fade}
                  depthWrite={false}
                  blending={AdditiveBlending}
                />
              </mesh>

              <mesh>
                <sphereGeometry args={[0.25 * (1 + elapsed * 3), 24, 24]} />
                <meshStandardMaterial
                  color="#0077aa"
                  emissive="#cceeff"
                  emissiveIntensity={0.5 * fade}
                  transparent
                  opacity={0.9 * fade}
                  depthWrite={false}
                  blending={AdditiveBlending}
                />
              </mesh>

              {[0.45, 0.65, 0.85].map((size, i) => (
                <mesh key={i} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}>
                  <torusGeometry args={[size * (1 + elapsed * 3), 0.045, 16, 32]} />
                  <meshStandardMaterial
                    color="#0099ff"
                    emissive="#0088cc"
                    emissiveIntensity={1 * fade}
                    transparent
                    opacity={0.6 * fade * (1 - i * 0.2)}
                    depthWrite={false}
                    blending={AdditiveBlending}
                  />
                </mesh>
              ))}

              {[...Array(4)].map((_, i) => {
                const angle = (i / 4) * Math.PI * 2;
                const radius = 0.5 * (1 + elapsed * 2);
                return (
                  <mesh
                    key={`spark-${i}`}
                    position={[
                      Math.sin(angle) * radius,
                      Math.cos(angle) * radius,
                      0
                    ]}
                  >
                    <sphereGeometry args={[0.05, 8, 8]} />
                    <meshStandardMaterial
                      color="#0077aa"
                      emissive="#cceeff"
                      emissiveIntensity={2 * fade}
                      transparent
                      opacity={0.8 * fade}
                      depthWrite={false}
                      blending={AdditiveBlending}
                    />
                  </mesh>
                );
              })}

              <pointLight
                color="#0099ff"
                intensity={1 * fade}
                distance={4}
                decay={2}
              />
              <pointLight
                color="#0077aa"
                intensity={1 * fade}
                distance={6}
                decay={1}
              />
            </group>
          );
        }
        return null;
      })}
    </group>
  );
}
