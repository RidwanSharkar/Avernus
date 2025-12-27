import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Vector3, Color } from 'three';
import { Group, MeshBasicMaterial } from '@/utils/three-exports';
import { WeaponType, WeaponSubclass } from './weapons';
import React from 'react';

interface GhostTrailProps {
  parentRef: React.RefObject<Group>;
  weaponType: WeaponType;
  weaponSubclass?: WeaponSubclass;
  targetPosition?: Vector3; // Optional for multiplayer - if provided, use this instead of parentRef position
  isStealthing?: boolean; // Whether the local player is currently in stealth mode
}

const GhostTrail = React.memo(({ parentRef, weaponType, weaponSubclass, targetPosition, isStealthing = false }: GhostTrailProps) => {
  const trailsRef = useRef<Mesh[]>([]);
  const positions = useRef<Vector3[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const trailCount = 22;
  
  useEffect(() => {
    // Initialize with target position if provided, otherwise use parent's position
    let initialPos: Vector3;
    if (targetPosition) {
      initialPos = targetPosition.clone();
      positions.current = Array(trailCount).fill(0).map(() => initialPos.clone());
      setIsInitialized(true);
    } else if (parentRef.current) {
      initialPos = parentRef.current.position.clone();
      positions.current = Array(trailCount).fill(0).map(() => initialPos.clone());
      setIsInitialized(true);
    }
  }, [parentRef, targetPosition, trailCount]);

  const getTrailColor = () => {
    // If player is stealthing, use dark grey for all trails
    if (isStealthing) {
      return '#333333'; // Dark grey color for stealth mode
    }

    if (weaponSubclass) {
      switch (weaponSubclass) {
        // Scythe subclasses
        case WeaponSubclass.CHAOS:
          return '#0095FF'; // Keep original chaos color
        case WeaponSubclass.ABYSSAL:
          return '#17CE54'; // Purple for abyssal
        
        // Sword subclasses
        case WeaponSubclass.DIVINITY:
          return '#00C8FF'; // Light blue for divinity
        case WeaponSubclass.VENGEANCE:
          return '#4682B4'; // Steel blue for vengeance
        
        // Sabres subclasses
        case WeaponSubclass.FROST:
          return '#FF544E'; // Keep original frost color
        case WeaponSubclass.ASSASSIN:
          return '#FF544E'; // Dark purple for assassin
        
        
        // Runeblade subclasses
        case WeaponSubclass.ARCANE:
          return '#8783D1'; // Bright green for arcane
        case WeaponSubclass.NATURE:
          return '#00FF88'; // Darker green for nature

        // Bow subclasses
        case WeaponSubclass.ELEMENTAL:
          return '#13B549'; // Keep original elemental color
        case WeaponSubclass.VENOM:
          return '#17CC93'; // Green/purple for venom 17CE54
      }
    }
    
    // Fallback to weapon type colors
    switch (weaponType) {
      case WeaponType.SCYTHE:
        return '#17CE54'; // 39ff14
      case WeaponType.SWORD:
        return '#6DFF9E'; // Light blue for sword
      case WeaponType.SABRES:
        return '#FF544E'; //78DFFF
      case WeaponType.RUNEBLADE:
        return '#00FF88'; // Green for runeblade
      case WeaponType.BOW:
        return '#3A905E'; //D09A1D try
    }
  };

  useFrame(() => {
    if (!isInitialized) return;
    
    // Use targetPosition if provided (for multiplayer), otherwise use parentRef position
    let newPos: Vector3;
    if (targetPosition && targetPosition.clone) {
      newPos = targetPosition.clone();
    } else if (parentRef.current && parentRef.current.position && parentRef.current.position.clone) {
      newPos = parentRef.current.position.clone();
    } else {
      return;
    }
    
    // Adjust height to match bone plate position (lower the trail)
    newPos.y += 0.3;

    // Update position history
    positions.current.unshift(newPos);
    positions.current = positions.current.slice(0, trailCount);

    // Update trail meshes
    trailsRef.current.forEach((trail, i) => {
      if (trail && positions.current[i]) {
        trail.position.copy(positions.current[i]);
        
        // Scale and opacity based on trail position
        const scale = 1 - (i / trailCount) * 0.6;
        trail.scale.setScalar(scale);
        
        if (trail.material && trail.material instanceof MeshBasicMaterial) {
          trail.material.opacity = (1 - i / trailCount) * 0.2;
        }
      }
    });
  });

  // Only render trails after initialization
  if (!isInitialized) return null;

  return (
    <>
      {Array.from({ length: trailCount }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) trailsRef.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.475, 16, 16]} />
          <meshBasicMaterial
            color={new Color(getTrailColor())}
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
});

GhostTrail.displayName = 'GhostTrail';

export default GhostTrail;
