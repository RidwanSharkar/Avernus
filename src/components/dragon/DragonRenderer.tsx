import { useRef, useEffect, useState } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame, useThree } from '@react-three/fiber';
import React from 'react';

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
  world: World;
  onMeshReady?: (mesh: Group) => void;
  currentWeapon?: WeaponType;
  currentSubclass?: WeaponSubclass;
  isCharging?: boolean;
  chargeProgress?: number;
  isSwinging?: boolean;
  isSpinning?: boolean;
  onBowRelease?: (finalProgress: number, isPerfectShot?: boolean) => void;
  onScytheSwingComplete?: () => void;
  onSwordSwingComplete?: () => void;
  onSabresSwingComplete?: () => void;
  onBackstabComplete?: () => void;
  onSunderComplete?: () => void;
  swordComboStep?: 1 | 2 | 3;
  isSkyfalling?: boolean;
  isBackstabbing?: boolean;
  isSundering?: boolean;
  isDivineStorming?: boolean;
  isSwordCharging?: boolean;
  isDeflecting?: boolean;
  onChargeComplete?: () => void;
  onDeflectComplete?: () => void;
  rotation?: { x: number; y: number; z: number }; // Add rotation prop for multiplayer
  isLocalPlayer?: boolean; // Flag to distinguish local player from other players
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  reanimateRef?: React.RefObject<ReanimateRef>;
}

export default function DragonRenderer({ 
  entityId, 
  position, 
  world,
  onMeshReady,
  currentWeapon = WeaponType.BOW,
  currentSubclass = WeaponSubclass.ELEMENTAL,
  isCharging = false,
  chargeProgress = 0,
  isSwinging = false,
  isSpinning = false,
  isDeflecting = false,
  onBowRelease = () => {},
  onScytheSwingComplete = () => {},
  onSwordSwingComplete = () => {},
  onSabresSwingComplete = () => {},
  onBackstabComplete = () => {},
  onSunderComplete = () => {},
  swordComboStep = 1,
  isSkyfalling = false,
  isBackstabbing = false,
  isSundering = false,
  isDivineStorming = false,
  isSwordCharging = false,
  onChargeComplete = () => {},
  onDeflectComplete = () => {},
  rotation,
  isLocalPlayer = true,
  isViperStingCharging = false,
  viperStingChargeProgress = 0,
  isBarrageCharging = false,
  barrageChargeProgress = 0,
  isCobraShotCharging = false,
  cobraShotChargeProgress = 0,
  reanimateRef
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
  const [chargeDirection, setChargeDirection] = useState<Vector3 | undefined>(undefined);
  const [damageNumbers, setDamageNumbers] = useState<Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
  }>>([]);
  const nextDamageNumberId = useRef(0);
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
        setChargeDirection(direction);

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
            setChargeDirection(movement.chargeDirection.clone());
          } else {
            setChargeDirection(undefined);
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
  
  // Handle sword damage through combat system
  const handleSwordHit = (targetId: string, damage: number) => {
    const targetEntity = world.getEntity(parseInt(targetId));
    const playerEntityObj = world.getEntity(entityId);
    
    if (targetEntity && playerEntityObj) {
      // Use combat system to deal damage (this will handle damage numbers automatically)
      const combatSystem = world.getSystem(CombatSystem);
      if (combatSystem) {
        combatSystem.queueDamage(targetEntity, damage, playerEntityObj, 'sword');

      }
    }
  };

  
  return (
    <>
      <group ref={groupRef}>
        <DragonUnit
          position={new Vector3(0, 0, 0)} // Position is handled by the parent group
          movementDirection={movementDirection.current}
          isDashing={isDashing.current}
          entityId={entityId}
          dashCharges={dashCharges}
          chargeDirection={chargeDirection}
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
          onBackstabComplete={onBackstabComplete}
          onSunderComplete={onSunderComplete}
          swordComboStep={swordComboStep}
          isSkyfalling={isSkyfalling}
          isBackstabbing={isBackstabbing}
          isSundering={isSundering}
          isDivineStorming={isDivineStorming}
          isSwordCharging={isSwordCharging}
          isDeflecting={isDeflecting}
          onChargeComplete={onChargeComplete}
          onDeflectComplete={onDeflectComplete}
          enemyData={enemyData}
          onHit={handleSwordHit}
          setDamageNumbers={setDamageNumbers}
          nextDamageNumberId={nextDamageNumberId}
          playerPosition={position}
          playerRotation={currentRotation}
          isViperStingCharging={isViperStingCharging}
          viperStingChargeProgress={viperStingChargeProgress}
          isBarrageCharging={isBarrageCharging}
          barrageChargeProgress={barrageChargeProgress}
          isCobraShotCharging={isCobraShotCharging}
          cobraShotChargeProgress={cobraShotChargeProgress}
          reanimateRef={reanimateRef}
          setActiveEffects={setActiveEffects}
        />
      </group>
      
      {/* GHOST TRAIL - Rendered outside dragon group to avoid inheriting transformations */}
      <GhostTrail 
        parentRef={groupRef} 
        weaponType={currentWeapon} 
        weaponSubclass={currentSubclass} 
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
        />
      )}
    </>
  );
}
