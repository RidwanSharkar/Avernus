import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Color, DoubleSide, AdditiveBlending } from '@/utils/three-exports';
import { WeaponType, WeaponSubclass } from './weapons';
import React from 'react';

export interface DashChargeStatus {
  isAvailable: boolean;
  cooldownRemaining: number;
}

interface ChargedOrbitalsProps {
  parentRef: React.RefObject<Group>;
  dashCharges: Array<DashChargeStatus>;
  weaponType: WeaponType;
  weaponSubclass?: WeaponSubclass;
  isCorruptedAuraActive?: boolean;
}

const ChargedOrbitals = React.memo(({ parentRef, dashCharges, weaponType, weaponSubclass, isCorruptedAuraActive }: ChargedOrbitalsProps) => {
  const orbitalsRef = useRef<Group>(null);
  
  const getOrbitalColor = () => {
    // Check for corrupted aura on Runeblade first
    if (isCorruptedAuraActive && weaponType === WeaponType.RUNEBLADE) {
      return '#FF4444';
    }

    if (weaponSubclass) {
      switch (weaponSubclass) {
        // Scythe subclasses
        case WeaponSubclass.CHAOS:
          return '#7ADEFF';
        case WeaponSubclass.ABYSSAL:
          return '#17CE54';
        
        // Sword subclasses
        case WeaponSubclass.DIVINITY:
          return '#FFDA32';
        case WeaponSubclass.VENGEANCE:
          return '#4682B4';
        
        // Sabres subclasses
        case WeaponSubclass.FROST:
          return '#F27663';
        case WeaponSubclass.ASSASSIN:
          return '#FF544E';
        
        // Runeblade subclasses
        case WeaponSubclass.ARCANE:
          return '#00FF66';
        case WeaponSubclass.NATURE:
          return '#00AA44';

        // Bow subclasses
        case WeaponSubclass.ELEMENTAL:
          return '#FFC278';
        case WeaponSubclass.VENOM:
          return '#17CC93';
      }
    }
    
    // Fallback to weapon type colors
    switch (weaponType) {
      case WeaponType.SCYTHE:
        return '#17CE54';
      case WeaponType.SWORD:
        return '#87CEEB';
      case WeaponType.SABRES:
        return '#FF544E';
      case WeaponType.RUNEBLADE:
        return '#00FF88';
      case WeaponType.BOW:
        return '#3A905E';
    }
  };

  useFrame(({ clock }) => {
    if (!orbitalsRef.current || !parentRef.current) return;
    
    const time = clock.getElapsedTime();
      
    // Position orbitals around the parent in a normal circular orbit
    orbitalsRef.current.children.forEach((orbital, index) => {
      const angle = (index / dashCharges.length) * Math.PI * 2 + time * 1;
      const radius = 0.7; // Fixed radius for circular orbit
      const height = -0.2; // Fixed height above parent
      
      orbital.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      
      // Add some rotation to each orbital
      orbital.rotation.x = time * 2 + index;
      orbital.rotation.y = time * 1.5 + index * 0.7;
    });

    // Position the entire orbital group relative to parent
    orbitalsRef.current.position.copy(parentRef.current.position);
    });

      

  return (
    <group ref={orbitalsRef}>
      {dashCharges.map((charge, index) => {
        const isAvailable = charge.isAvailable;
        const activeColor = getOrbitalColor();
        const inactiveColor = '#333333';
        
        return (
          <group key={index}>
            <mesh>
              <sphereGeometry args={[0.115, 8, 8]} />
              <meshStandardMaterial
                color={new Color(isAvailable ? activeColor : inactiveColor)}
                emissive={new Color(isAvailable ? activeColor : inactiveColor)}
                emissiveIntensity={isAvailable ? 0.3 : 0.1}
                transparent
                opacity={isAvailable ? 0.8 : 0.4}
              />
            </mesh>

            <mesh>
              <sphereGeometry args={[0.115*1.225, 8, 8]} />
              <meshStandardMaterial
                color={isAvailable ? activeColor : "#333333"}
                emissive={isAvailable ? activeColor : "#333333"}
                emissiveIntensity={isAvailable ? .5 : 0.1}
                transparent
                opacity={isAvailable ? 0.4 : 0.15}
                depthWrite={false}
                side={DoubleSide}
                blending={AdditiveBlending}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});

ChargedOrbitals.displayName = 'ChargedOrbitals';

export default ChargedOrbitals;
