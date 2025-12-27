import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Euler, AdditiveBlending, IcosahedronGeometry, MeshStandardMaterial } from 'three';
import { WeaponType, WeaponSubclass } from './weapons';

interface WingJetProps {
  isActive: boolean;
  collectedBones: number;
  isLeftWing: boolean;
  parentRef: React.RefObject<Group>;
  weaponType: WeaponType;
  weaponSubclass?: WeaponSubclass;
}

const DraconicWingJets: React.FC<WingJetProps> = ({
  isActive,
  collectedBones,
  isLeftWing,
  weaponType,
  weaponSubclass
}) => {
  const jetGroupRef = useRef<Group>(null);
  const [jetParticles, setJetParticles] = useState(() =>
    Array(20).fill(null).map((_, i) => ({
      id: i,
      position: new Vector3(0, 0, 0),
      velocity: new Vector3(0, 0, 0),
      scale: Math.random() * 0.12 + 0.08,
      life: Math.random(),
      maxLife: Math.random() * 0.6 + 0.5
    }))
  );

  // Create shared geometry once - CRITICAL: prevents memory leak from inline JSX geometries
  const particleGeometry = useMemo(() => new IcosahedronGeometry(0.8, 0), []);

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      particleGeometry.dispose();
    };
  }, [particleGeometry]);

  // Get color based on weapon type/subclass (matching GhostTrail)
  const getJetColor = () => {
    if (weaponSubclass) {
      switch (weaponSubclass) {
        // Scythe subclasses
        case WeaponSubclass.CHAOS:
          return { main: '#3EB0FC', emissive: '#87CEEB', particle: '#E0F6FF' }; // Keep original chaos color
        case WeaponSubclass.ABYSSAL:
          return { main: '#17CE54', emissive: '#4A90E2', particle: '#A5F3FC' }; // Purple for abyssal

        // Sword subclasses
        case WeaponSubclass.DIVINITY:
          return { main: '#3FD3FC', emissive: '#87CEEB', particle: '#E0F6FF' }; // Light blue for divinity
        case WeaponSubclass.VENGEANCE:
          return { main: '#4682B4', emissive: '#5F9EA0', particle: '#B0E0E6' }; // Steel blue for vengeance

        // Sabres subclasses
        case WeaponSubclass.FROST:
          return { main: '#FF544E', emissive: '#FF6B6B', particle: '#FFB3B3' }; // Keep original frost color
        case WeaponSubclass.ASSASSIN:
          return { main: '#FF544E', emissive: '#FF6B6B', particle: '#FFB3B3' }; // Dark purple for assassin

        // Runeblade subclasses
        case WeaponSubclass.ARCANE:
          return { main: '#8783D1', emissive: '#A890F0', particle: '#D4C4F7' }; // Bright green for arcane
        case WeaponSubclass.NATURE:
          return { main: '#00FF88', emissive: '#32CD32', particle: '#90EE90' }; // Darker green for nature

        // Bow subclasses
        case WeaponSubclass.ELEMENTAL:
          return { main: '#17CE54', emissive: '#00CED1', particle: '#AFEEEE' }; // Keep original elemental color
        case WeaponSubclass.VENOM:
          return { main: '#17CC93', emissive: '#20B2AA', particle: '#87CEEB' }; // Green/purple for venom
      }
    }

    // Fallback to weapon type colors
    switch (weaponType) {
      case WeaponType.SCYTHE:
        return { main: '#17CE54', emissive: '#00CED1', particle: '#AFEEEE' }; // 39ff14
      case WeaponType.SWORD:
        return { main: '#6DFF9E', emissive: '#87CEEB', particle: '#E0F6FF' }; // Light blue for sword
      case WeaponType.SABRES:
        return { main: '#FF544E', emissive: '#FF6B6B', particle: '#FFB3B3' }; //78DFFF
      case WeaponType.RUNEBLADE:
        return { main: '#00FF88', emissive: '#32CD32', particle: '#90EE90' }; // Green for runeblade
      case WeaponType.BOW:
        return { main: '#3A905E', emissive: '#228B22', particle: '#32CD32' }; //D09A1D try
    }

    return { main: '#4A90E2', emissive: '#87CEEB', particle: '#E0F6FF' }; // Default
  };

  const colors = getJetColor();

  // Wing bone positions (expanded for wider particle distribution)
  const wingBonePositions = [
    // Main central arm bone
    {
      pos: new Vector3(isLeftWing ? -0.3 : 0.3, 0.275, 0),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 5 : Math.PI / 5),
      scale: 1.2
    },
    // Upper wing membrane positions (for wider spread)
    {
      pos: new Vector3(isLeftWing ? -0.5 : 0.5, 0.45, 0.1),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 3.5 : Math.PI / 3.5),
      scale: 1.0
    },
    {
      pos: new Vector3(isLeftWing ? -0.65 : 0.65, 0.6, 0.15),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 2.5 : Math.PI / 2.5),
      scale: 0.9
    },
    // Wing tip area
    {
      pos: new Vector3(isLeftWing ? -0.85 : 0.85, 0.72, 0.2),
      rot: new Euler(0.1, 0, isLeftWing ? -Math.PI / 2.2 : Math.PI / 2.2),
      scale: 0.8
    },
    // Lower wing membrane
    {
      pos: new Vector3(isLeftWing ? -0.4 : 0.4, 0.15, 0.05),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 6 : Math.PI / 6),
      scale: 1.0
    },
    // Additional spread points
    {
      pos: new Vector3(isLeftWing ? -0.6 : 0.6, 0.35, 0.08),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 4 : Math.PI / 4),
      scale: 0.9
    }
  ];

  useFrame((_, delta) => {
    if (!isActive || !jetGroupRef.current) return;

    // Animate jet particles
    setJetParticles(prev => prev.map(particle => {
      // Update particle life
      particle.life -= delta * 2;

      // Reset particle if it died
      if (particle.life <= 0) {
        const boneIndex = Math.floor(Math.random() * Math.min(wingBonePositions.length, Math.max(1, collectedBones || 1)));
        const bone = wingBonePositions[boneIndex];

        // Start from bone position with some randomization for wider spread
        particle.position.copy(bone.pos);

        // Add random offset to create wider diameter emanation
        // Spread increases with collected bones for more impressive effect
        const baseSpread = 0.12;
        const spreadRadius = baseSpread + (collectedBones * 0.03); // Wider spread with more bones
        const randomAngle = Math.random() * Math.PI * 2;
        const randomRadius = Math.random() * spreadRadius;

        particle.position.x += Math.cos(randomAngle) * randomRadius;
        particle.position.y += Math.sin(randomAngle) * randomRadius * 0.5; // Less vertical spread
        particle.position.z += (Math.random() - 0.5) * 0.1; // Small Z variation

        // Jet direction based on bone rotation and wing side
        const jetDirection = new Vector3(
          isLeftWing ? -1 : 1, // Outward from body
          -0.3, // Slightly downward
          -0.8  // Backward thrust
        ).normalize();

        particle.velocity.copy(jetDirection).multiplyScalar(2 + Math.random() * 3);
        particle.life = particle.maxLife;
      } else {
        // Move particle
        particle.position.add(particle.velocity.clone().multiplyScalar(delta));

        // Add some turbulence
        particle.velocity.x += (Math.random() - 0.5) * 0.02;
        particle.velocity.y += (Math.random() - 0.5) * 0.02;
      }

      return particle;
    }));

    // Rotate the entire jet group for dynamic effect
    jetGroupRef.current.rotation.z += delta * 0;
  });

  if (!isActive) return null;

  return (
    <group
      ref={jetGroupRef}
      position={new Vector3(0, 0, 0)}
    >

      {/* Jet particles */}
      <group>
        {jetParticles.map(particle => (
          <mesh
            key={particle.id}
            position={particle.position.toArray()}
            scale={[particle.scale, particle.scale, particle.scale]}
            geometry={particleGeometry}
          >
            <meshStandardMaterial
              color={colors.particle}
              emissive={colors.main}
              emissiveIntensity={0.5}
              transparent
              opacity={particle.life / particle.maxLife * 0.75}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

    </group>
  );
};

export default DraconicWingJets;
