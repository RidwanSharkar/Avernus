'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, AdditiveBlending } from '@/utils/three-exports';

export interface CobraShotProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<number>;
  opacity: number;
  fadeStartTime: number | null;
}

interface CobraShotProps {
  projectilePool: CobraShotProjectile[];
}

const CobraShotProjectileVisual: React.FC<{ projectile: CobraShotProjectile }> = ({ projectile }) => {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    // Update position but keep it at ground level (Y=0)
    groupRef.current.position.set(projectile.position.x, 0, projectile.position.z);

    // Calculate rotation based on direction (only Y rotation to stay parallel to ground)
    const lookDirection = projectile.direction.clone().normalize();
    const rotationY = Math.atan2(lookDirection.x, lookDirection.z);

    // Apply rotation - keep X and Z rotation at 0 to stay parallel to ground
    groupRef.current.rotation.set(0, rotationY, 0);
  });

  if (!projectile.active) return null;

  return (
    <group ref={groupRef}>
      {/* Main projectile body - sleek cobra arrow */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.15, 2.5, 8]} />
        <meshStandardMaterial
          color="#00ff40" // Bright green cobra color
          emissive="#00aa20"
          emissiveIntensity={1.2}
          transparent
          opacity={projectile.opacity}
        />
      </mesh>

      {/* Arrowhead */}
      <mesh position={[0, 0, 1.25]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.365, 0.8, 6]} />
        <meshStandardMaterial
          color="#00aa20"
          emissive="#00ff40"
          emissiveIntensity={1.5}
          transparent
          opacity={projectile.opacity}
        />
      </mesh>

      {/* Spinning venom energy rings around the projectile */}
      {[...Array(2)].map((_, i) => (
        <group key={`ring-${i}`} position={[0, 0, 0.3 - i * 0.4] as [number, number, number]}>
          <mesh
            rotation={[0, 0, Date.now() * 0.01 + i * Math.PI / 3]}
          >
            <torusGeometry args={[0.15 + i * 0.05, 0.02, 6, 12]} />
            <meshStandardMaterial
              color="#00aa20" // Medium green
              emissive="#00aa20"
              emissiveIntensity={1.5 + 1}
              transparent
              opacity={projectile.opacity * 0.7}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Cobra energy core */}
      <mesh>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial
          color="#00ff60"
          emissive="#00aa20"
          emissiveIntensity={3}
          transparent
          opacity={projectile.opacity}
          blending={2} // AdditiveBlending
          depthWrite={false}
        />
      </mesh>

      {/* Cobra trail effects */}
      {[...Array(8)].map((_, index) => {
        const trailOpacity = projectile.opacity * (1 - index / 8) * 0.6;
        const trailScale = 1 - (index / 8) * 0.5;

        // Position trails behind the projectile tip along the Z axis
        const trailOffset: [number, number, number] = [0, 0, -(index + 1) * 0.8];

        return (
          <group
            key={`trail-${index}`}
            position={trailOffset}
          >
            {/* Cobra energy trail */}
            <mesh scale={[trailScale, trailScale, trailScale]}>
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshStandardMaterial
                color="#00aa20" // Medium green
                emissive="#00aa20"
                emissiveIntensity={4 + 2}
                transparent
                opacity={trailOpacity}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {/* Outer cobra glow */}
            <mesh scale={[trailScale * 1.5, trailScale * 1.5, trailScale * 1.5]}>
              <sphereGeometry args={[0.2, 6, 6]} />
              <meshStandardMaterial
                color="#00ff60" // Light green
                emissive="#00ff60"
                emissiveIntensity={2 + 1}
                transparent
                opacity={trailOpacity * 0.5}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* Point light for green glow effect */}
      <pointLight
        color="#00ff40"
        intensity={2 * projectile.opacity}
        distance={4}
        decay={2}
      />
    </group>
  );
};

export default function CobraShot({ projectilePool }: CobraShotProps) {
  return (
    <>
      {projectilePool.map(projectile => (
        <CobraShotProjectileVisual key={projectile.id} projectile={projectile} />
      ))}
    </>
  );
}
