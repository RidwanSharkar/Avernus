import { useRef, useMemo } from 'react';
import { Group, Vector3 } from 'three';
import React from 'react';
import BonePlate from './BonePlate';
import BoneWings from './BoneWings';
import AscendantBoneWings from './AscendantBoneWings';
import { DragonHorns } from './DragonHorns';
import ChargedOrbitals, { DashChargeStatus } from './ChargedOrbitals';
import BoneAura from './BoneAura';
import { WeaponType, WeaponSubclass } from './weapons';
import DraconicWingJets from './DraconicWingJets';
import EtherealBow from '../weapons/EtherBow';
import Scythe from '../weapons/Scythe';
import Sword from '../weapons/Sword';
import Sabres from '../weapons/Sabres';
import Runeblade from '../weapons/Runeblade';
import Reanimate, { ReanimateRef } from '../weapons/Reanimate';
import BoneTail from './BoneTail';
import ArchmageCrest from './ArchmageCrest';

interface DragonUnitProps {
  position?: Vector3;
  movementDirection?: Vector3;
  isDashing?: boolean;
  entityId?: number; // Player's entity ID
  dashCharges?: Array<DashChargeStatus>;
  chargeDirection?: Vector3;
  currentWeapon?: WeaponType;
  currentSubclass?: WeaponSubclass;
  isCharging?: boolean;
  chargeProgress?: number;
  isSwinging?: boolean;
  isSpinning?: boolean;
  purchasedItems?: string[]; // Purchased cosmetic items
  onBowRelease?: (finalProgress: number, isPerfectShot?: boolean) => void;
  onScytheSwingComplete?: () => void;
  onSwordSwingComplete?: () => void;
  onSabresSwingComplete?: () => void;
  onRunebladeSwingComplete?: () => void;
  onSabresLeftSwingStart?: () => void;
  onSabresRightSwingStart?: () => void;
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
  onSmiteComplete?: () => void;
  onColossusStrikeComplete?: () => void;
  onDeathGraspComplete?: () => void;
  onWraithStrikeComplete?: () => void;
  onCorruptedAuraToggle?: (active: boolean) => void;
  onChargeComplete?: () => void;
  onDeflectComplete?: () => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  onHit?: (targetId: string, damage: number) => void;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  playerPosition?: Vector3;
  playerRotation?: Vector3;
  realTimePositionRef?: React.RefObject<Vector3>;
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  isCloudkillCharging?: boolean;
  cloudkillChargeProgress?: number;
  // Reanimate ability props
  reanimateRef?: React.RefObject<ReanimateRef>;
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
  // PVP-specific props
  targetPlayerData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
  }>;
  rageSpent?: number;
  collectedBones?: number;
  isWingJetsActive?: boolean;
  combatSystem?: any; // CombatSystem for  Strike damage numbers
}

export default function DragonUnit({
  position = new Vector3(0, 0, 0),
  movementDirection = new Vector3(0, 0, 0),
  isDashing = false,
  entityId,
  dashCharges = [
    { isAvailable: true, cooldownRemaining: 0 },
    { isAvailable: true, cooldownRemaining: 0 },
    { isAvailable: true, cooldownRemaining: 0 }
  ],
  chargeDirection,
  currentWeapon = WeaponType.BOW,
  currentSubclass = WeaponSubclass.ELEMENTAL,
  isCharging = false,
  chargeProgress = 0,
  isSwinging = false,
  isSpinning = false,
  onBowRelease = () => {},
  onScytheSwingComplete = () => {},
  onSwordSwingComplete = () => {},
  onSabresSwingComplete = () => {},
  onRunebladeSwingComplete = () => {},
  onSabresLeftSwingStart = () => {},
  onSabresRightSwingStart = () => {},
  onBackstabComplete = () => {},
  onSunderComplete = () => {},
  swordComboStep = 1,
  isSkyfalling = false,
  isBackstabbing = false,
  isSundering = false,
  isSwordCharging = false,
  isDeflecting = false,
  isSmiting = false,
  isColossusStriking = false,
  isDeathGrasping = false,
  isWraithStriking = false,
  isCorruptedAuraActive = false,
  onSmiteComplete = () => {},
  onColossusStrikeComplete = () => {},
  onDeathGraspComplete = () => {},
  onWraithStrikeComplete = () => {},
  onCorruptedAuraToggle = () => {},
  onChargeComplete = () => {},
  onDeflectComplete = () => {},
  enemyData = [],
  onHit = () => {},
  setDamageNumbers = () => {},
  nextDamageNumberId = { current: 0 },
  playerPosition,
  playerRotation = new Vector3(0, 0, 0),
  realTimePositionRef,
  isViperStingCharging = false,
  viperStingChargeProgress = 0,
  isBarrageCharging = false,
  barrageChargeProgress = 0,
  isCobraShotCharging = false,
  cobraShotChargeProgress = 0,
  isCloudkillCharging = false,
  cloudkillChargeProgress = 0,
  reanimateRef,
  setActiveEffects = () => {},
  targetPlayerData,
  rageSpent,
  collectedBones = 0,
  isWingJetsActive = false,
  combatSystem,
  purchasedItems = []
}: DragonUnitProps) {
  
  const groupRef = useRef<Group>(null);

  // Weapon rendering logic
  const renderWeapon = () => {
    if (currentWeapon === WeaponType.BOW) {
      return (
        <EtherealBow
          position={position}
          direction={movementDirection}
          chargeProgress={chargeProgress}
          isCharging={isCharging}
          onRelease={onBowRelease}
          currentSubclass={currentSubclass}
          hasInstantPowershot={false}
          isAbilityBowAnimation={false}
          isViperStingCharging={isViperStingCharging}
          viperStingChargeProgress={viperStingChargeProgress}
          isBarrageCharging={isBarrageCharging}
          barrageChargeProgress={barrageChargeProgress}
          isCobraShotCharging={isCobraShotCharging}
          cobraShotChargeProgress={cobraShotChargeProgress}
          isCloudkillCharging={isCloudkillCharging}
          cloudkillChargeProgress={cloudkillChargeProgress}
        />
      );
    } else if (currentWeapon === WeaponType.SCYTHE) {
      return (
        <Scythe
          parentRef={groupRef}
          currentSubclass={currentSubclass}
          level={1}
          isEmpowered={false}
          isSpinning={isSpinning}
        />
      );
    } else if (currentWeapon === WeaponType.SWORD) {
      return (
        <Sword
          isSwinging={isSwinging}
          isSmiting={false}
          isColossusStriking={isColossusStriking}
          isOathstriking={false}
          isCharging={isSwordCharging}
          isDeflecting={isDeflecting}
          chargeDirectionProp={chargeDirection}
          onSwingComplete={onSwordSwingComplete}
          onSmiteComplete={() => {}}
          onColossusStrikeComplete={onColossusStrikeComplete}
          onOathstrikeComplete={() => {}}
          onChargeComplete={onChargeComplete}
          onDeflectComplete={onDeflectComplete}
          hasChainLightning={false}
          comboStep={swordComboStep}
          currentSubclass={currentSubclass}
          enemyData={enemyData}
          onHit={onHit}
          setDamageNumbers={setDamageNumbers}
          nextDamageNumberId={nextDamageNumberId}
          setActiveEffects={setActiveEffects}
          playerPosition={playerPosition}
          playerRotation={playerRotation}
          dragonGroupRef={groupRef}
          playerEntityId={entityId}
          realTimePositionRef={realTimePositionRef}


        />
      );
    } else if (currentWeapon === WeaponType.SABRES) {
      return (
        <Sabres
          isSwinging={isSwinging}
          onSwingComplete={onSabresSwingComplete || (() => {})}
          onLeftSwingStart={onSabresLeftSwingStart || (() => {})}
          onRightSwingStart={onSabresRightSwingStart || (() => {})}
          isCharging={isCharging}
          isSkyfalling={isSkyfalling}
          isBackstabbing={isBackstabbing}
          isSundering={isSundering}
          onBackstabComplete={onBackstabComplete}
          onSunderComplete={onSunderComplete}
          subclass={currentSubclass}
        />
      );
    } else if (currentWeapon === WeaponType.RUNEBLADE) {
      return (
        <Runeblade
          isSwinging={isSwinging}
          isSmiting={isSmiting}
          isDeathGrasping={isDeathGrasping}
          isWraithStriking={isWraithStriking}
          isCorruptedAuraActive={isCorruptedAuraActive}
          isOathstriking={false}
          isCharging={isSwordCharging}
          isDeflecting={isDeflecting}
          chargeDirectionProp={chargeDirection}
          onSwingComplete={onRunebladeSwingComplete}
          onSmiteComplete={onSmiteComplete}
          onDeathGraspComplete={onDeathGraspComplete}
          onWraithStrikeComplete={onWraithStrikeComplete}
          onCorruptedAuraToggle={onCorruptedAuraToggle}
          onOathstrikeComplete={() => {}}
          onChargeComplete={onChargeComplete}
          onDeflectComplete={onDeflectComplete}
          hasChainLightning={false}
          comboStep={swordComboStep}
          currentSubclass={currentSubclass}
          enemyData={enemyData}
          onHit={onHit}
          setDamageNumbers={setDamageNumbers}
          nextDamageNumberId={nextDamageNumberId}
          setActiveEffects={setActiveEffects}
          playerPosition={playerPosition}
          playerRotation={playerRotation}
          dragonGroupRef={groupRef}
          playerEntityId={entityId}
        />
      );
    }
    return null;
  };

  // Memoize components for performance optimization
  const bonePlate = useMemo(() => (
    <group scale={[0.95, 0.7, 0.95]} position={[0, 0.04, -0.015]} rotation={[0.4, 0, 0]}>
      <BonePlate />
    </group>
  ), []);

  const boneTail = useMemo(() => (
    <group scale={[0.85, 0.85, 0.85]} position={[0, 0.05, +0.1]}>
      <BoneTail movementDirection={movementDirection} isDashing={isDashing} />
    </group>
  ), [movementDirection, isDashing]);

  const leftHorn = useMemo(() => (
    <group scale={[0.235, 0.335, 0.235]} position={[-0.05, 0.215, 0.35]} rotation={[+0.15, 0, -5]}>
      <DragonHorns isLeft={true} />
    </group>
  ), []);

  const rightHorn = useMemo(() => (
    <group scale={[0.235, 0.335, 0.235]} position={[0.05, 0.215, 0.35]} rotation={[+0.15, 0, 5]}>
      <DragonHorns isLeft={false} />
    </group>
  ), []);

  const hasAscendantWings = purchasedItems.includes('ascendant_wings');

  const wings = useMemo(() => (
    <group position={[0, 0.2, -0.15]}>
      {/* Left Wing */}
      <group rotation={[0, Math.PI / 5.5, 0]}>
        {hasAscendantWings ? (
          <AscendantBoneWings
            isLeftWing={true}
            parentRef={groupRef}
            isDashing={isDashing}
          />
        ) : (
          <BoneWings
            isLeftWing={true}
            parentRef={groupRef}
            isDashing={isDashing}
          />
        )}
      </group>

      {/* Right Wing */}
      <group rotation={[0, -Math.PI / 5.5, 0]}>
        {hasAscendantWings ? (
          <AscendantBoneWings
            isLeftWing={false}
            parentRef={groupRef}
            isDashing={isDashing}
          />
        ) : (
          <BoneWings
            isLeftWing={false}
            parentRef={groupRef}
            isDashing={isDashing}
          />
        )}
      </group>
    </group>
  ), [isDashing, hasAscendantWings]);

  return (
    <group ref={groupRef} position={[position.x, position.y + 0.2, position.z]}>

      {/* BONE PLATE (TORSO) */}
      {bonePlate}


      {/* WINGS */}
      {wings}

      {/* DRACONIC WING JETS */}
      <DraconicWingJets
        isActive={isWingJetsActive || isDashing || collectedBones > 0}
        collectedBones={collectedBones}
        isLeftWing={true}
        parentRef={groupRef}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
      />
      <DraconicWingJets
        isActive={isWingJetsActive || isDashing || collectedBones > 0}
        collectedBones={collectedBones}
        isLeftWing={false}
        parentRef={groupRef}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
      />

      {/* CREST */}
      <ArchmageCrest
        position={[0, 0.5, 0.15]}
        scale={-0.625}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
        isCorruptedAuraActive={isCorruptedAuraActive}
      />





      {/* CHARGED ORBITALS */}
      <ChargedOrbitals
        parentRef={groupRef}
        dashCharges={dashCharges}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
        isCorruptedAuraActive={isCorruptedAuraActive}
      />

      {/* BONE AURA */}
      <BoneAura 
        parentRef={groupRef}
      />

      {/* WEAPON */}
      {renderWeapon()}

    {/* ======================================================== */}


      {/* REANIMATE ABILITY */}
      {currentWeapon === WeaponType.SCYTHE && (
        <Reanimate
          parentRef={groupRef}
          ref={reanimateRef}
        />
      )}

    </group>
  );
}
