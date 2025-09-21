import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Group, Vector3, AdditiveBlending } from 'three';
import { useFrame } from '@react-three/fiber';
import TotemModel from './TotemModel';

interface SummonProps {
  position: Vector3;
  enemyData?: Array<{
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
  console.log('🎭 SummonedTotem: Component created with enemyData:', enemyData.length, 'enemies');
  console.log('🎭 SummonedTotem: enemyData details:', enemyData.map(e => ({ id: e.id, health: e.health, position: e.position })));

  // Log PVP player detection
  const pvpPlayers = enemyData.filter(e => !e.id.startsWith('enemy-'));
  const npcs = enemyData.filter(e => e.id.startsWith('enemy-'));
  console.log('🎭 SummonedTotem: PVP players detected:', pvpPlayers.length, 'NPCs detected:', npcs.length);
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
    DAMAGE: 25, // 25 damage per attack
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

  const findNewTarget = useCallback((excludeCurrentTarget: boolean = false): { id: string; position: Vector3; health: number } | null => {
    if (!groupRef.current || !enemyData.length) {
      console.log('🎭 SummonTotem: No groupRef or no enemyData', enemyData.length);
      return null;
    }

    // Get the totem's world position
    const totemWorldPosition = new Vector3();
    groupRef.current.getWorldPosition(totemWorldPosition);

    let closestDistance = constants.RANGE;
    let closestTarget: { id: string; position: Vector3; health: number } | null = null;

    for (let i = 0; i < enemyData.length; i++) {
      const enemy = enemyData[i];

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
  }, [enemyData, calculateDistance, currentTarget, constants.RANGE]);

  const handleAttack = useCallback((target: { id: string; position: Vector3; health: number }) => {
    if (!target || target.health <= 0 || !onDamage || !nextDamageNumberId || !setDamageNumbers || !setActiveEffects) {
      console.log('🎭 SummonTotem: Attack cancelled - missing requirements:', {
        hasTarget: !!target,
        targetHealth: target?.health,
        hasOnDamage: !!onDamage,
        hasNextId: !!nextDamageNumberId,
        hasSetDamageNumbers: !!setDamageNumbers,
        hasSetActiveEffects: !!setActiveEffects
      });
      return;
    }

    // Use the enemy's actual world position for damage numbers and effects
    const worldImpactPosition = target.position.clone().setY(1.5);

    // Check if enemy is still alive and in range
    const currentEnemy = enemyData.find(e => e.id === target.id && e.health > 0);
    if (!currentEnemy) {
      return;
    }

    onDamage(target.id, constants.DAMAGE, worldImpactPosition, false);

    const effectId = Date.now();

    const updates = {
      damageNumber: {
        id: nextDamageNumberId.current++,
        damage: constants.DAMAGE,
        position: worldImpactPosition.clone(),
        isCritical: false,
        isSummon: true
      },
      effect: {
        id: effectId,
        type: 'summonExplosion',
        position: worldImpactPosition.clone(), // Store absolute world position
        direction: new Vector3(),
        duration: constants.EFFECT_DURATION / 1000,
        startTime: Date.now(),
        summonId: constants.mountId,
        targetId: target.id
      }
    };

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
  }, [constants, onDamage, setActiveEffects, setDamageNumbers, nextDamageNumberId, enemyData]);

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
                  color="#8800ff"
                  emissive="#9933ff"
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
                  color="#aa66ff"
                  emissive="#ffffff"
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
                    color="#8800ff"
                    emissive="#9933ff"
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
                      color="#aa66ff"
                      emissive="#ffffff"
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
                color="#8800ff"
                intensity={1 * fade}
                distance={4}
                decay={2}
              />
              <pointLight
                color="#aa66ff"
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
