'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, AdditiveBlending, MathUtils, OctahedronGeometry, SphereGeometry, ConeGeometry } from '@/utils/three-exports';

interface TowerProjectileProps {
  position: Vector3;
  direction: Vector3;
  entityId: number;
  ownerId?: string;
  opacity?: number;
}

// Shared geometries to prevent memory leaks
const sharedGeometries = {
  main: new OctahedronGeometry(0.2, 0),
  core: new OctahedronGeometry(0.12, 0),
  aura: new SphereGeometry(0.35, 12, 12),
  trail: new ConeGeometry(0.03, 0.15, 4),
  particle: new SphereGeometry(0.02, 6, 6)
};

export default function TowerProjectile({
  position,
  direction,
  entityId,
  ownerId,
  opacity = 1.0
}: TowerProjectileProps) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);

  // Cleanup geometries on unmount
  useEffect(() => {
    return () => {
      sharedGeometries.main.dispose();
      sharedGeometries.core.dispose();
      sharedGeometries.aura.dispose();
      sharedGeometries.trail.dispose();
      sharedGeometries.particle.dispose();
    };
  }, []);

  // Determine color based on owner ID - match tower colors exactly
  const projectileColor = useMemo(() => {
    if (!ownerId) {
      return new Color(0x888888); // Gray for unknown owner
    }

    // Use same colors as TowerRenderer for consistency
    const playerColors = [
      new Color("#4FC3F7"), // Blue - Elite color (Player 1)
      new Color("#FF8C00"), // Orange/Red Fire theme (Player 2)
      new Color("#FF8A8A"), // Light Red (Player 3)
      new Color("#FFB3B3"), // Light Red (Player 4)
      new Color("#FFD6D6")  // Light Red (Player 5)
    ];

    // Extract player number from ownerId (e.g., "player1" -> 0, "player2" -> 1)
    const playerMatch = ownerId.match(/player(\d+)/);
    let playerIndex = 0;
    if (playerMatch) {
      playerIndex = parseInt(playerMatch[1]) - 1; // Convert to 0-based index
    } else {
      // Fallback to hash for custom IDs
      const hash = ownerId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      playerIndex = Math.abs(hash) % playerColors.length;
    }

    return playerColors[playerIndex];
  }, [ownerId]);

  const emissiveColor = useMemo(() => 
    projectileColor.clone().multiplyScalar(0.6), [projectileColor]);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (groupRef.current) {
      // Update position
      groupRef.current.position.copy(position);

      // Calculate rotation to face movement direction
      if (direction.length() > 0) {
        const normalizedDirection = direction.clone().normalize();
        const angle = Math.atan2(normalizedDirection.x, normalizedDirection.z);
        groupRef.current.rotation.y = angle;
        
        // Tilt slightly based on vertical movement
        groupRef.current.rotation.x = -normalizedDirection.y * 0.5;
      }

      // Spinning animation for the energy core
      const coreSpinner = groupRef.current.getObjectByName('CoreSpinner') as Group;
      if (coreSpinner) {
        coreSpinner.rotation.z += delta * 8;
        coreSpinner.rotation.x += delta * 4;
      }

      // Pulsing glow effect
      const glowSphere = groupRef.current.getObjectByName('GlowSphere') as Mesh;
      if (glowSphere && glowSphere.material) {
        const material = glowSphere.material as any;
        material.emissiveIntensity = 0.3 + Math.sin(timeRef.current * 6) * 0.2;
      }

      // Trailing particles rotation
      const trailParticles = groupRef.current.getObjectByName('TrailParticles') as Group;
      if (trailParticles) {
        trailParticles.rotation.y += delta * 3;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main projectile body - crystalline energy shard */}
      <mesh geometry={sharedGeometries.main}>
        <meshStandardMaterial
          color={projectileColor}
          emissive={emissiveColor}
          emissiveIntensity={0.8}
          transparent
          opacity={opacity}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Energy core - spinning inner crystal */}
      <group name="CoreSpinner">
        <mesh geometry={sharedGeometries.core}>
          <meshStandardMaterial
            color={projectileColor.clone().multiplyScalar(1.5)}
            emissive={projectileColor.clone().multiplyScalar(0.8)}
            emissiveIntensity={1.2}
            transparent
            opacity={opacity * 0.9}
            metalness={1.0}
            roughness={0.0}
          />
        </mesh>
      </group>

      {/* Outer glow sphere */}
      <mesh name="GlowSphere" geometry={sharedGeometries.aura}>
        <meshStandardMaterial
          color={projectileColor}
          emissive={emissiveColor}
          emissiveIntensity={0.3}
          transparent
          opacity={opacity * 0.2}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Energy tendrils - 4 small spikes around the projectile */}
      {[...Array(4)].map((_, i) => {
        const angle = (i / 4) * Math.PI * 2;
        const radius = 0.25;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <mesh
            key={`tendril-${i}`}
            position={[x, 0, z]}
            rotation={[0, angle, 0]}
            geometry={sharedGeometries.trail}
          >
            <meshStandardMaterial
              color={projectileColor.clone().multiplyScalar(1.3)}
              emissive={emissiveColor}
              emissiveIntensity={0.6}
              transparent
              opacity={opacity * 0.8}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        );
      })}

      {/* Trailing particles */}
      <group name="TrailParticles">
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const radius = 0.15;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = -0.1 - (i * 0.05); // Trail behind

          return (
            <mesh
              key={`particle-${i}`}
              position={[x, y, z]}
              geometry={sharedGeometries.particle}
            >
              <meshStandardMaterial
                color={projectileColor}
                emissive={emissiveColor}
                emissiveIntensity={0.8}
                transparent
                opacity={opacity * (1 - i * 0.15)} // Fade out towards the back
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>
          );
        })}
      </group>

      {/* Point light for dynamic lighting */}
      <pointLight
        color={projectileColor}
        intensity={0.5}
        distance={2}
        decay={2}
      />
    </group>
  );
}
