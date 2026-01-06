import { useRef, useEffect, useState } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame, useThree } from '@react-three/fiber';
import React from 'react';

// Cleanup utility for Three.js resources
const disposeThreeJSResources = (object: any) => {
  if (!object) return;

  // Dispose geometry
  if (object.geometry) {
    object.geometry.dispose();
  }

  // Dispose material
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((material: any) => {
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        material.dispose();
      });
    } else {
      if (object.material.map) object.material.map.dispose();
      if (object.material.normalMap) object.material.normalMap.dispose();
      if (object.material.roughnessMap) object.material.roughnessMap.dispose();
      if (object.material.metalnessMap) object.material.metalnessMap.dispose();
      if (object.material.emissiveMap) object.material.emissiveMap.dispose();
      object.material.dispose();
    }
  }

  // Recursively dispose children
  if (object.children) {
    object.children.forEach((child: any) => disposeThreeJSResources(child));
  }
};

import DragonUnit from './DragonUnit';
import { DashChargeStatus } from './ChargedOrbitals';
import ViperStingManager, { triggerGlobalViperSting } from '../projectiles/ViperStingManager';
import GhostTrail from './GhostTrail';
import { WeaponType, WeaponSubclass } from './weapons';
import { World } from '@/ecs/World';
import { Movement } from '@/ecs/components/Movement';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Enemy } from '@/ecs/components/Enemy';
import { CombatSystem } from '@/systems/CombatSystem';
import { ReanimateRef } from '../weapons/Reanimate';

interface DragonRendererProps {
  entityId: number;
  position: Vector3;
  realTimePositionRef?: React.RefObject<Vector3>;
  world: World;
  onMeshReady?: (mesh: Group) => void;
  currentWeapon?: WeaponType;
  currentSubclass?: WeaponSubclass;
  isCharging?: boolean;
  chargeProgress?: number;
  chargeDirection?: Vector3;
  isSwinging?: boolean;
  purchasedItems?: string[];
  isSpinning?: boolean;
  onBowRelease?: (finalProgress: number, isPerfectShot?: boolean) => void;
  onScytheSwingComplete?: () => void;
  onSwordSwingComplete?: () => void;
  onSabresSwingComplete?: () => void;
  onRunebladeSwingComplete?: () => void;
  onBackstabComplete?: () => void;
  onSunderComplete?: () => void;
  swordComboStep?: 1 | 2 | 3;
  isSkyfalling?: boolean;
  isBackstabbing?: boolean;
  isSundering?: boolean;
  isSwordCharging?: boolean;
  isDeflecting?: boolean;
  isSmiting?: boolean;
  isColossusStriking?: boolean;
  isDeathGrasping?: boolean;
  isWraithStriking?: boolean;
  isCorruptedAuraActive?: boolean;
  hasCryoflame?: boolean;
  isDead?: boolean;
  onSmiteComplete?: () => void;
  onColossusStrikeComplete?: () => void;
  onDeathGraspComplete?: () => void;
  onWraithStrikeComplete?: () => void;
  onCorruptedAuraToggle?: (active: boolean) => void;
  onChargeComplete?: () => void;
  onDeflectComplete?: () => void;
  rotation?: { x: number; y: number; z: number }; // Add rotation prop for multiplayer
  isLocalPlayer?: boolean; // Flag to distinguish local player from other players
  isStealthing?: boolean; // Whether the local player is currently in stealth mode
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  isCloudkillCharging?: boolean;
  cloudkillChargeProgress?: number;
  isTempestRoundsActive?: boolean;
  reanimateRef?: React.RefObject<ReanimateRef>;
  // Damage number management
  onDamageNumbersReady?: (setDamageNumbers: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSmite?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSmite?: boolean;
  }>) => void, nextDamageNumberId: { current: number }) => void;
  // PVP-specific props
  targetPlayerData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
  }>;
  rageSpent?: number;
  combatSystem?: any; 
}

export default function DragonRenderer({
  entityId,
  position,
  realTimePositionRef,
  world,
  onMeshReady,
  currentWeapon = WeaponType.BOW,
  currentSubclass = WeaponSubclass.ELEMENTAL,
  isCharging = false,
  chargeProgress = 0,
  chargeDirection,
  isSwinging = false,
  isSpinning = false,
  isDeflecting = false,
  isDead = false,
  isSmiting = false,
  isColossusStriking = false,
  isDeathGrasping = false,
  isWraithStriking = false,
  isCorruptedAuraActive = false,
  hasCryoflame = false,
  onSmiteComplete = () => {},
  onColossusStrikeComplete = () => {},
  onDeathGraspComplete = () => {},
  onWraithStrikeComplete = () => {},
  onCorruptedAuraToggle = () => {},
  onBowRelease = () => {},
  onScytheSwingComplete = () => {},
  onSwordSwingComplete = () => {},
  onSabresSwingComplete = () => {},
  onRunebladeSwingComplete = () => {},
  onBackstabComplete = () => {},
  onSunderComplete = () => {},
  swordComboStep = 1,
  isSkyfalling = false,
  isBackstabbing = false,
  isSundering = false,
  isSwordCharging = false,
  onChargeComplete = () => {},
  onDeflectComplete = () => {},
  rotation,
  isLocalPlayer = true,
  isStealthing = false,
  isViperStingCharging = false,
  viperStingChargeProgress = 0,
  isBarrageCharging = false,
  barrageChargeProgress = 0,
  isCobraShotCharging = false,
  cobraShotChargeProgress = 0,
  isCloudkillCharging = false,
  cloudkillChargeProgress = 0,
  isTempestRoundsActive = false,
  reanimateRef,
  targetPlayerData,
  rageSpent,
  onDamageNumbersReady,
  combatSystem,
  purchasedItems = []
}: DragonRendererProps) {
  const mountRef = useRef(false);
  if (!mountRef.current) {
    mountRef.current = true;
  }
  const { camera } = useThree();
  const groupRef = useRef<Group>(null);
  const movementDirection = useRef(new Vector3(0, 0, 0));
  const lastPosition = useRef(position ? position.clone() : new Vector3(0, 0.5, 0));
  const isDashing = useRef(false);
  const [currentRotation, setCurrentRotation] = useState(new Vector3(0, 0, 0));
  const lastFacingDirection = useRef(new Vector3(0, 0, -1)); // Default facing forward
  const [enemyData, setEnemyData] = useState<Array<{
    id: string;
    position: Vector3;
    health: number;
  }>>([]);
  const [dashCharges, setDashCharges] = useState<Array<DashChargeStatus>>([
    { isAvailable: true, cooldownRemaining: 0 },
    { isAvailable: true, cooldownRemaining: 0 },
    { isAvailable: true, cooldownRemaining: 0 }
  ]);
  // Use chargeDirection from props, with fallback to local state for backward compatibility
  const [localChargeDirection, setLocalChargeDirection] = useState<Vector3 | undefined>(undefined);
  const effectiveChargeDirection = chargeDirection || localChargeDirection;
  const [damageNumbers, setDamageNumbers] = useState<Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
  }>>([]);
  const nextDamageNumberId = useRef(0);

  // Notify parent when damage number functions are ready
  useEffect(() => {
    if (onDamageNumbersReady) {
      onDamageNumbersReady(setDamageNumbers, nextDamageNumberId);
    }
  }, [onDamageNumbersReady]);
  const lastChargeState = useRef(false);
  const [activeEffects, setActiveEffects] = useState<Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>>([]);

  // Real-time position ref for charge trail particles
  // Use the passed ref if available (for local player), otherwise create our own (for remote players)
  const internalRealTimePositionRef = useRef<Vector3>(position ? position.clone() : new Vector3(0, 0.5, 0));
  const effectiveRealTimePositionRef = realTimePositionRef || internalRealTimePositionRef;

  // Calculate movement direction based on position changes
  useFrame(() => {
    if (groupRef.current) {
      // Check if charge state changed from false to true
      if (isSwordCharging && !lastChargeState.current) {
        // Charge just started - calculate direction from camera
        const direction = new Vector3();
        camera.getWorldDirection(direction);
        direction.y = 0; // Keep movement horizontal
        direction.normalize();
        setLocalChargeDirection(direction);

      }
      lastChargeState.current = isSwordCharging;
      
      // Clean up expired active effects
      const now = Date.now();
      setActiveEffects(prev => prev.filter(effect => {
        if (effect.startTime && effect.duration) {
          return (now - effect.startTime) < (effect.duration * 1000);
        }
        return true; // Keep effects without expiration
      }));
      
      // Update position
      if (position) {
        groupRef.current.position.copy(position);
      }
      
      // Get dash state from Movement component
      const entity = world.getEntity(entityId);
      if (entity) {
        // Debug: Check what components are actually on this entity (reduced logging)
        if (Math.random() < 0.01) { // Only log 1% of the time to reduce spam
          const allComponents = entity.getAllComponents();
          const componentNames = entity.getComponentNames();
          
        }
        
        const movement = entity.getComponent(Movement);
        // Reduced logging for Movement component type check
        
        // Check if it's a Movement component by checking for specific methods
        const isMovementComponent = movement && (
          typeof movement.getDashChargeStatus === 'function' ||
          (movement as any).componentType === 'Movement' ||
          movement.constructor.name === 'Movement'
        );
        
        if (isMovementComponent) {
          isDashing.current = movement.isDashing;
          
          // Update dash charges state
          if (typeof movement.getDashChargeStatus === 'function') {
            const currentChargeStatus = movement.getDashChargeStatus();
            setDashCharges(currentChargeStatus);
          } else {

          }
          
          // Update charge direction if charging
          if (movement.isCharging) {
            setLocalChargeDirection(movement.chargeDirection.clone());
          } else {
            setLocalChargeDirection(undefined);
          }
        }
      }
      
      // Calculate movement direction for tail animation
      if (position) {
        const currentMovement = position.clone().sub(lastPosition.current);
        if (currentMovement.length() > 0.001) {
          movementDirection.current.copy(currentMovement.normalize());
        } else {
          movementDirection.current.set(0, 0, 0);
        }
        lastPosition.current.copy(position);
      }
      
      // Rotate dragon based on whether it's the local player or other players
      if (isLocalPlayer && camera) {
        // Local player: face camera direction for visual orientation
        const cameraDirection = new Vector3();
        camera.getWorldDirection(cameraDirection);
        
        // Calculate the angle to face the camera direction
        const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
        groupRef.current.rotation.y = angle;
        
        // For weapons (like deflect shield), use movement direction if moving, otherwise last facing direction
        const entity = world.getEntity(entityId);
        let weaponRotation = new Vector3(0, angle, 0); // Default to camera direction

        if (entity) {
          // Update real-time position ref for charge trail particles
          const transform = entity.getComponent(Transform);
          if (transform && transform.position && effectiveRealTimePositionRef.current) {
            effectiveRealTimePositionRef.current.copy(transform.position);
          }

          const movement = entity.getComponent(Movement);
          if (movement && movement.inputStrength > 0.1) {
            // Player is actively moving - use movement direction for weapons
            const moveDir = movement.moveDirection;
            if (moveDir.length() > 0.1) {
              const moveAngle = Math.atan2(moveDir.x, moveDir.z);
              weaponRotation = new Vector3(0, moveAngle, 0);
              // Update last facing direction when moving
              lastFacingDirection.current.set(moveDir.x, 0, moveDir.z).normalize();
            }
          } else {
            // Not moving - use last facing direction for weapons
            const lastFacingAngle = Math.atan2(lastFacingDirection.current.x, lastFacingDirection.current.z);
            weaponRotation = new Vector3(0, lastFacingAngle, 0);
          }
        }
        
        setCurrentRotation(weaponRotation);
      } else if (!isLocalPlayer && rotation) {
        // Other players: use their actual rotation from server
        groupRef.current.rotation.set(rotation.x, rotation.y, rotation.z);
        setCurrentRotation(new Vector3(rotation.x, rotation.y, rotation.z));
      }
      
      // Update enemy data for sword collision detection
      // Always update enemy data when sword is equipped to ensure fresh data
      if (currentWeapon === WeaponType.SWORD) {
        const enemies = world.queryEntities([Transform, Health, Enemy]);
        const enemyDataArray = enemies.map(enemy => {
          const transform = enemy.getComponent(Transform)!;
          const health = enemy.getComponent(Health)!;
          return {
            id: enemy.id.toString(),
            position: transform.getWorldPosition(),
            health: health.currentHealth
          };
        }).filter(enemy => enemy.health > 0);
        
        // Always update enemy data to ensure collision detection has fresh positions
        setEnemyData(enemyDataArray);
        
        // Debug logging for collision detection
        if (isSwinging && enemyDataArray.length > 0) {

        }
      }
    }
  });

  useEffect(() => {
    if (groupRef.current && onMeshReady) {
      onMeshReady(groupRef.current);
    }
  }, [onMeshReady]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Dispose of all Three.js resources in the dragon group
      if (groupRef.current) {
        disposeThreeJSResources(groupRef.current);
      }

      // Clear all state arrays to prevent memory leaks
      setEnemyData([]);
      setDashCharges([
        { isAvailable: true, cooldownRemaining: 0 },
        { isAvailable: true, cooldownRemaining: 0 },
        { isAvailable: true, cooldownRemaining: 0 }
      ]);
      setActiveEffects([]);
    };
  }, []);
  
  // Handle sword damage through combat system
  const handleSwordHit = (targetId: string, damage: number) => {
    const targetEntity = world.getEntity(parseInt(targetId));
    const playerEntityObj = world.getEntity(entityId);
    
    if (targetEntity && playerEntityObj) {
      // Use combat system to deal damage (this will handle damage numbers automatically)
      const combatSystem = world.getSystem(CombatSystem);
      if (combatSystem) {
        combatSystem.queueDamage(targetEntity, damage, playerEntityObj, 'sword', playerEntityObj?.userData?.playerId);

      }
    }
  };

  
  return (
    <>
      <group ref={groupRef}>
        {/* Death effect - make dragon semi-transparent when dead */}
        {isDead && (
          <pointLight
            color="#ff4444"
            intensity={0.5}
            distance={3}
            decay={2}
          />
        )}
        <DragonUnit
          position={new Vector3(0, 0, 0)} // Position is handled by the parent group
          movementDirection={movementDirection.current}
          isDashing={isDashing.current}
          entityId={entityId}
          dashCharges={dashCharges}
          chargeDirection={effectiveChargeDirection}
          currentWeapon={currentWeapon}
          currentSubclass={currentSubclass}
          isCharging={isCharging}
          chargeProgress={chargeProgress}
          isSwinging={isSwinging}
          isSpinning={isSpinning}
          onBowRelease={onBowRelease}
          onScytheSwingComplete={onScytheSwingComplete}
          onSwordSwingComplete={onSwordSwingComplete}
          onSabresSwingComplete={onSabresSwingComplete}
          onRunebladeSwingComplete={onRunebladeSwingComplete}
          onBackstabComplete={onBackstabComplete}
          onSunderComplete={onSunderComplete}
          swordComboStep={swordComboStep}
          isSkyfalling={isSkyfalling}
          isBackstabbing={isBackstabbing}
          isSundering={isSundering}
          isSwordCharging={isSwordCharging}
          isDeflecting={isDeflecting}
          isSmiting={isSmiting}
          isColossusStriking={isColossusStriking}
          isDeathGrasping={isDeathGrasping}
          isWraithStriking={isWraithStriking}
          isCorruptedAuraActive={isCorruptedAuraActive}
          hasCryoflame={hasCryoflame}
          onSmiteComplete={onSmiteComplete}
          onColossusStrikeComplete={onColossusStrikeComplete}
          onDeathGraspComplete={onDeathGraspComplete}
          onWraithStrikeComplete={onWraithStrikeComplete}
          onCorruptedAuraToggle={onCorruptedAuraToggle}
          onChargeComplete={onChargeComplete}
          onDeflectComplete={onDeflectComplete}
          enemyData={enemyData}
          onHit={handleSwordHit}
          setDamageNumbers={setDamageNumbers}
          nextDamageNumberId={nextDamageNumberId}
          playerPosition={position}
          playerRotation={currentRotation}
          realTimePositionRef={effectiveRealTimePositionRef}
          isViperStingCharging={isViperStingCharging}
          viperStingChargeProgress={viperStingChargeProgress}
          isBarrageCharging={isBarrageCharging}
          barrageChargeProgress={barrageChargeProgress}
          isCobraShotCharging={isCobraShotCharging}
          cobraShotChargeProgress={cobraShotChargeProgress}
          isCloudkillCharging={isCloudkillCharging}
          cloudkillChargeProgress={cloudkillChargeProgress}
          isTempestRoundsActive={isTempestRoundsActive}
          reanimateRef={reanimateRef}
          setActiveEffects={setActiveEffects}
          targetPlayerData={targetPlayerData}
          rageSpent={rageSpent}
          combatSystem={combatSystem}
          purchasedItems={purchasedItems}
        />
      </group>
      
      {/* GHOST TRAIL - Rendered outside dragon group to avoid inheriting transformations */}
      <GhostTrail
        parentRef={groupRef}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
        targetPosition={effectiveRealTimePositionRef.current || undefined}
        isStealthing={isStealthing}
      />
      
      {/* VIPER STING MANAGER - Only for local player with bow */}
      {isLocalPlayer && currentWeapon === WeaponType.BOW && (
        <ViperStingManager
          parentRef={groupRef}
          enemyData={enemyData}
          onHit={handleSwordHit}
          setDamageNumbers={setDamageNumbers}
          nextDamageNumberId={nextDamageNumberId}
          onHealthChange={(deltaHealth) => {
            // Handle healing from soul steal

            // Could integrate with health system here
          }}
          charges={dashCharges.map((charge, index) => ({
            id: index + 1,
            available: charge.isAvailable,
            cooldownStartTime: charge.cooldownRemaining > 0 ? Date.now() - (15000 - charge.cooldownRemaining * 1000) : null
          }))}
          setCharges={(newCharges) => {
            // Convert back to DashChargeStatus format
            if (typeof newCharges === 'function') {
              setDashCharges(prev => {
                const converted = newCharges(prev.map((charge, index) => ({
                  id: index + 1,
                  available: charge.isAvailable,
                  cooldownStartTime: charge.cooldownRemaining > 0 ? Date.now() - (15000 - charge.cooldownRemaining * 1000) : null
                })));
                
                return converted.map((charge, index) => ({
                  isAvailable: charge.available,
                  cooldownRemaining: charge.cooldownStartTime ? Math.max(0, (15000 - (Date.now() - charge.cooldownStartTime)) / 1000) : 0
                }));
              });
            } else {
              setDashCharges(newCharges.map((charge) => ({
                isAvailable: charge.available,
                cooldownRemaining: charge.cooldownStartTime ? Math.max(0, (15000 - (Date.now() - charge.cooldownStartTime)) / 1000) : 0
              })));
            }
          }}
          localSocketId="local-player" // For single-player mode, use a fixed ID
        />
      )}
    </>
  );
}
