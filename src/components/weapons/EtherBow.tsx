import React, { useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, CatmullRomCurve3, CubicBezierCurve3, Shape, DoubleSide } from '@/utils/three-exports';
import { WeaponSubclass } from '@/components/dragon/weapons';

interface EtherealBowProps {
  position: Vector3;
  direction: Vector3;
  chargeProgress: number;
  isCharging: boolean;
  onRelease: (finalProgress: number, isPerfectShot?: boolean) => void;
  currentSubclass?: WeaponSubclass;
  hasInstantPowershot?: boolean;
  isAbilityBowAnimation?: boolean;
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  isCloudkillCharging?: boolean;
  cloudkillChargeProgress?: number;
  isTempestRoundsActive?: boolean;
}

const EtherBowComponent = memo(function EtherealBow({
  chargeProgress,
  isCharging,
  onRelease,
  currentSubclass,
  hasInstantPowershot = false,
  isAbilityBowAnimation = false,
  isViperStingCharging = false,
  viperStingChargeProgress = 0,
  isBarrageCharging = false,
  barrageChargeProgress = 0,
  isCobraShotCharging = false,
  cobraShotChargeProgress = 0,
  isCloudkillCharging = false,
  cloudkillChargeProgress = 0,
  isTempestRoundsActive = false
}: EtherealBowProps) {
  // Debug logging for tempest rounds
  React.useEffect(() => {
    if (isTempestRoundsActive) {
      console.log('🌊 EtherBow: Tempest Rounds ACTIVE!');
    }
  }, [isTempestRoundsActive]);
  const bowRef = useRef<Group>(null);
  const maxDrawDistance = 1.35;
  const prevIsCharging = useRef(isCharging);
  const basePosition = [-0.9, 0.075, 0.75] as const;  // Match other weapons' base positioning
  
  // Perfect shot timing constants
  const perfectShotMinThreshold = 0.8; // 85% charge
  const perfectShotMaxThreshold = 0.98; // 95% charge
  const isPerfectShotWindow = chargeProgress >= perfectShotMinThreshold && chargeProgress <= perfectShotMaxThreshold;
  
  // Charge Release Logic - only trigger for actual bow charging, not ability animations
  useFrame(() => {
    // Only track charging state for actual bow charging, not ability animations
    const actualIsCharging = isCharging && !isAbilityBowAnimation && !isViperStingCharging && !isBarrageCharging && !isCobraShotCharging && !isCloudkillCharging && !isTempestRoundsActive;

    // Only trigger onRelease for actual bow charging, not ability animations
    if (prevIsCharging.current && !actualIsCharging && !isViperStingCharging && !isBarrageCharging && !isCobraShotCharging && !isCloudkillCharging && !isTempestRoundsActive) {
      // Use the chargeProgress prop instead of calculating our own
      // Check if this was a perfect shot using the same chargeProgress used for visuals
      const wasPerfectShot = chargeProgress >= perfectShotMinThreshold && chargeProgress <= perfectShotMaxThreshold;

      onRelease(chargeProgress, wasPerfectShot);
    }

    prevIsCharging.current = actualIsCharging;
  });

  // Rest of the curve creation functions remain the same
  const createBowCurve = () => {
    return new CatmullRomCurve3([
      new Vector3(-0.875, 0, 0),
      new Vector3(-0.85, 0.2, 0),
      new Vector3(-0.25, 0.5, 0),
      new Vector3(-0.4, 0.35, 0),
      new Vector3(0.4, 0.35, 0),
      new Vector3(0.25, 0.5, 0),
      new Vector3(0.85, 0.2, 0),
      new Vector3(0.875, 0, 0)
    ]);
  };

  const createStringCurve = (drawAmount: number) => {
    const pullback = drawAmount * maxDrawDistance;
    const curve = new CubicBezierCurve3(
      new Vector3(-0.8, 0, 0),
      new Vector3(0, 0, -pullback),
      new Vector3(0, 0, -pullback),
      new Vector3(0.8, 0, 0)
    );
    return curve;
  };

  // Create custom blade shape (similar to scythe blades)
  const createBladeShape = () => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    
    // Create thick back edge first
    shape.lineTo(0.4, -0.130);
    shape.bezierCurveTo(
      0.8, 0.22,    // control point 1
      1.33, 0.5,    // control point 2
      1.6, 0.515    // end point (tip)
    );
    
    // Create sharp edge
    shape.lineTo(1.125, 0.75);
    shape.bezierCurveTo(
      0.5, 0.2,
      0.225, 0.0,
      0.1, 0.7
    );
    shape.lineTo(0, 0);
    return shape;
  };

  const bladeExtrudeSettings = {
    steps: 1,
    depth: 0.03,
    bevelEnabled: false
  };

  return (
    <group 
      position={[0.6, 0.6, 0.875]}
      rotation={[-Math.PI/2.0 + (isCloudkillCharging ? (-Math.PI/1.7 + Math.PI/2.1) * cloudkillChargeProgress : 0), -Math.PI/2,  -Math.PI/2]}   // Reset base rotation
      scale={[0.875, 0.8, 0.8]}
    >
      <group
        ref={bowRef}
        position={[basePosition[0], basePosition[1], basePosition[2]]}
        rotation={[
          Math.PI, // (isCloudkillCharging ? Math.PI/10 * cloudkillChargeProgress : 0) for xbow->bow
          Math.PI/2,
          0
        ]}
      >
        {/* Bow body with dynamic color for instant powershot, charging, and perfect shot timing */}
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <tubeGeometry args={[createBowCurve(), 64, 0.035, 8, false]} />
          <meshStandardMaterial
            color={
              isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
              isTempestRoundsActive ? "#00FFFF" : // Bright teal for Tempest Rounds
              isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
              isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
              isCloudkillCharging ? `rgb(${Math.floor(0 + cloudkillChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(0)})` : // Green cloudkill colors
              currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
              currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
              "#C18C4B"
            }
            emissive={
              isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
              isTempestRoundsActive ? "#0088AA" : // Bright teal emissive for Tempest Rounds
              isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
              isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
              isCloudkillCharging ? `rgb(${Math.floor(0 + cloudkillChargeProgress * 170)}, ${Math.floor(170 + cloudkillChargeProgress * 85)}, ${Math.floor(0)})` : // Green cloudkill emissive
              currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
              currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
              "#C18C4B"
            }
            emissiveIntensity={
              isPerfectShotWindow ? 4.0 + Math.sin(Date.now() * 0.02) * 2.0 : // Pulsing effect during perfect window
              isTempestRoundsActive ? 3.0 : // High intensity for Tempest Rounds
              isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
              isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
              isCloudkillCharging ? 2.0 + cloudkillChargeProgress * 2.0 : // Cloudkill charging glow
              currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
              currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
              1.5
            }
            transparent
            opacity={0.8}
          />
        </mesh>

        {/* Bow string */}
        <mesh>
          <tubeGeometry args={[createStringCurve(isCobraShotCharging ? cobraShotChargeProgress : isBarrageCharging ? barrageChargeProgress : isViperStingCharging ? viperStingChargeProgress : isCloudkillCharging ? cloudkillChargeProgress : chargeProgress), 16, 0.02, 8, false]} />
          <meshStandardMaterial 
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Decorative wing elements */}
        <group>
          {/* Left wing */}
          <mesh position={[-0.4, 0, 0.475]} rotation={[Math.PI/2, 0, Math.PI/6]}>
            <boxGeometry args={[0.6, 0.02, 0.05]} />
            <meshStandardMaterial
              color={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isTempestRoundsActive ? "#00FFFF" : // Bright teal for Tempest Rounds
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
                isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissive={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isTempestRoundsActive ? "#0088AA" : // Bright teal emissive for Tempest Rounds
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
                isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissiveIntensity={
                isPerfectShotWindow ? 4.0 + Math.sin(Date.now() * 0.02) * 2.0 : // Pulsing effect during perfect window
                isTempestRoundsActive ? 3.0 : // High intensity for Tempest Rounds
                isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
                isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
                1.5
              }
              transparent
              opacity={0.8}
            />
          </mesh>

          {/* Right wing */}
          <mesh position={[0.4, 0, 0.475]} rotation={[Math.PI/2, 0, -Math.PI/6]}>
            <boxGeometry args={[0.6, 0.02, 0.05]} />
            <meshStandardMaterial
              color={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isTempestRoundsActive ? "#00FFFF" : // Bright teal for Tempest Rounds
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
                isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissive={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isTempestRoundsActive ? "#0088AA" : // Bright teal emissive for Tempest Rounds
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
                isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissiveIntensity={
                isPerfectShotWindow ? 4.0 + Math.sin(Date.now() * 0.02) * 2.0 : // Pulsing effect during perfect window
                isTempestRoundsActive ? 3.0 : // High intensity for Tempest Rounds
                isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
                isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
                1.5
              }
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>

        {/* Custom blade elements at bow ends */}
        <group>
          {/* Left blade */}
          <mesh position={[-1, 0, -0.2]} rotation={[Math.PI/2, 0, Math.PI/2]} scale={[0.4, -0.4, 0.4]}>
            <extrudeGeometry args={[createBladeShape(), bladeExtrudeSettings]} />
            <meshStandardMaterial
              color={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isTempestRoundsActive ? "#00FFFF" : // Bright teal for Tempest Rounds
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
                isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissive={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isTempestRoundsActive ? "#0088AA" : // Bright teal emissive for Tempest Rounds
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
                isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissiveIntensity={
                isPerfectShotWindow ? 4.0 + Math.sin(Date.now() * 0.02) * 2.0 : // Pulsing effect during perfect window
                isTempestRoundsActive ? 3.0 : // High intensity for Tempest Rounds
                isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
                isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
                1.5
              }
              metalness={0.8}
              roughness={0.1}
              transparent
              opacity={0.8}
              side={DoubleSide}
            />
          </mesh>

          {/* Right blade */}
          <mesh position={[1.0, 0, -0.2]} rotation={[Math.PI/2, 0, Math.PI/2]} scale={[0.4, 0.4, 0.4]}>
            <extrudeGeometry args={[createBladeShape(), bladeExtrudeSettings]} />
            <meshStandardMaterial
              color={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isTempestRoundsActive ? "#00FFFF" : // Bright teal for Tempest Rounds
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
                isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissive={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isTempestRoundsActive ? "#0088AA" : // Bright teal emissive for Tempest Rounds
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
                isViperStingCharging ? `rgb(${Math.floor(139 + viperStingChargeProgress * 116)}, ${Math.floor(63 + viperStingChargeProgress * 125)}, ${Math.floor(155 + viperStingChargeProgress * 97)})` : // Purple venom colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissiveIntensity={
                isPerfectShotWindow ? 4.0 + Math.sin(Date.now() * 0.02) * 2.0 : // Pulsing effect during perfect window
                isTempestRoundsActive ? 3.0 : // High intensity for Tempest Rounds
                isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
                isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
                1.5
              }
              metalness={0.8}
              roughness={0.1}
              transparent
              opacity={0.8}
              side={DoubleSide}
            />
          </mesh>
        </group>

        {/* Arrow  */}
        {(isCharging || isViperStingCharging || isBarrageCharging || isCobraShotCharging || isCloudkillCharging) && (
          <group
            position={[0, 0, 0.8 - (isCobraShotCharging ? cobraShotChargeProgress : isBarrageCharging ? barrageChargeProgress : isViperStingCharging ? viperStingChargeProgress : isCloudkillCharging ? cloudkillChargeProgress : chargeProgress) * maxDrawDistance]}
            rotation={[Math.PI/2, 0, 0]}
          >
            {/* Arrow shaft - increased length from 0.5 to 0.7 */}
            <mesh>
              <cylinderGeometry args={[0.015, 0.02, 0.9, 8]} />
              <meshStandardMaterial
                color={isCobraShotCharging ? "#00ff40" : isBarrageCharging ? "#ff8800" : isViperStingCharging ? "#A855C7" : isCloudkillCharging ? "#00ff00" : "#00ffff"}
                emissive={isCobraShotCharging ? "#00ff40" : isBarrageCharging ? "#ff8800" : isViperStingCharging ? "#A855C7" : isCloudkillCharging ? "#00ff00" : "#00ffff"}
                emissiveIntensity={3}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Arrow head - adjusted position for longer shaft */}
            <mesh position={[0, 0.35, 0]}>
              <coneGeometry args={[0.03, 0.175, 8]} />
              <meshStandardMaterial
                color={isCobraShotCharging ? "#00ff40" : isBarrageCharging ? "#ff8800" : isViperStingCharging ? "#A855C7" : isCloudkillCharging ? "#00ff00" : "#00ffff"}
                emissive={isCobraShotCharging ? "#00ff40" : isBarrageCharging ? "#ff8800" : isViperStingCharging ? "#A855C7" : isCloudkillCharging ? "#00ff00" : "#00ffff"}
                emissiveIntensity={3}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>
        )}

      </group>
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  return (
    prevProps.chargeProgress === nextProps.chargeProgress &&
    prevProps.isCharging === nextProps.isCharging &&
    prevProps.currentSubclass === nextProps.currentSubclass &&
    prevProps.hasInstantPowershot === nextProps.hasInstantPowershot &&
    prevProps.isAbilityBowAnimation === nextProps.isAbilityBowAnimation &&
    prevProps.isViperStingCharging === nextProps.isViperStingCharging &&
    prevProps.viperStingChargeProgress === nextProps.viperStingChargeProgress &&
    prevProps.isBarrageCharging === nextProps.isBarrageCharging &&
    prevProps.barrageChargeProgress === nextProps.barrageChargeProgress &&
    prevProps.isCobraShotCharging === nextProps.isCobraShotCharging &&
    prevProps.cobraShotChargeProgress === nextProps.cobraShotChargeProgress &&
    prevProps.isCloudkillCharging === nextProps.isCloudkillCharging &&
    prevProps.cloudkillChargeProgress === nextProps.cloudkillChargeProgress &&
    prevProps.isTempestRoundsActive === nextProps.isTempestRoundsActive &&
    (!prevProps.position || !nextProps.position || prevProps.position.equals(nextProps.position)) &&
    (!prevProps.direction || !nextProps.direction || prevProps.direction.equals(nextProps.direction))
  );
});

export default EtherBowComponent;
