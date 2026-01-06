'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, SphereGeometry, OctahedronGeometry, AdditiveBlending, MathUtils } from '@/utils/three-exports';

interface SummonedUnitDeathEffectProps {
  position: Vector3;
  playerNumber: number; // 1 for blue, 2 for red
  onComplete?: () => void; // Callback when effect finishes
}

export default function SummonedUnitDeathEffect({
  position,
  playerNumber,
  onComplete
}: SummonedUnitDeathEffectProps) {
  const groupRef = useRef<Group>(null);
  const [isActive, setIsActive] = useState(true);
  const [phase, setPhase] = useState<'explosion' | 'spirit'>('explosion');

  // Animation state
  const explosionStartTime = useRef(Date.now() / 1000);
  const spiritStartTime = useRef(0);
  const explosionDuration = 0.8; // 0.8 seconds
  const spiritDuration = 2.5; // 2.5 seconds total spirit flight

  // Player colors
  const playerColor = playerNumber === 1 ? new Color(0x4444FF) : new Color(0xFF4444); // Blue for P1, Red for P2
  const spiritColor = playerColor.clone().multiplyScalar(1.5); // Brighter for spirit

  // Geometries
  const explosionGeometry = new SphereGeometry(0.1, 8, 6);
  const spiritGeometry = new OctahedronGeometry(0.3, 0);

  useEffect(() => {
    // Cleanup geometries on unmount
    return () => {
      explosionGeometry.dispose();
      spiritGeometry.dispose();
    };
  }, []);

  useFrame((state) => {
    if (!groupRef.current || !isActive) return;

    const currentTime = state.clock.elapsedTime;
    const elapsed = currentTime - explosionStartTime.current;

    if (phase === 'explosion') {
      // Explosion phase (first 0.8 seconds)
      if (elapsed >= explosionDuration) {
        setPhase('spirit');
        spiritStartTime.current = currentTime;
        return;
      }

      const explosionProgress = elapsed / explosionDuration;

      // Scale and fade explosion particles
      const scale = MathUtils.lerp(0.5, 3.0, explosionProgress);
      const opacity = Math.max(0, 1 - explosionProgress);

      // Update explosion group
      if (groupRef.current.children[0]) { // Explosion particles group
        groupRef.current.children[0].scale.setScalar(scale);
        groupRef.current.children[0].traverse((child) => {
          if (child instanceof Mesh && child.material) {
            (child.material as any).opacity = opacity;
          }
        });
      }

    } else if (phase === 'spirit') {
      // Spirit phase (remaining time)
      const spiritElapsed = currentTime - spiritStartTime.current;
      const spiritProgress = spiritElapsed / spiritDuration;

      if (spiritProgress >= 1.0) {
        // Effect complete
        setIsActive(false);
        onComplete?.();
        return;
      }

      // Spirit floats upward with gentle rotation and scaling
      const spiritY = MathUtils.lerp(position.y, position.y + 8, spiritProgress);
      const spiritScale = MathUtils.lerp(1.0, 0.3, spiritProgress);
      const spiritOpacity = Math.max(0, 1 - spiritProgress * 0.7);

      // Update spirit position and appearance
      if (groupRef.current.children[1]) { // Spirit group
        const spiritGroup = groupRef.current.children[1] as Group;
        spiritGroup.position.set(position.x, spiritY, position.z);
        spiritGroup.scale.setScalar(spiritScale);

        // Gentle rotation
        spiritGroup.rotation.y += 0.02;
        spiritGroup.rotation.x += 0.01;

        // Update opacity
        spiritGroup.traverse((child) => {
          if (child instanceof Mesh && child.material) {
            (child.material as any).opacity = spiritOpacity;
          }
        });
      }
    }
  });

  if (!isActive) return null;

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Explosion Phase */}
      {phase === 'explosion' && (
        <group>
          {/* Core explosion flash */}
          <mesh>
            <sphereGeometry args={[0.2, 16, 12]} />
            <meshBasicMaterial
              color={playerColor}
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
            />
          </mesh>

          {/* Explosion particles */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 0.5 + Math.random() * 0.5;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = Math.random() * 0.5;

            return (
              <mesh
                key={`explosion-particle-${i}`}
                position={[x, y, z]}
                geometry={explosionGeometry}
              >
                <meshBasicMaterial
                  color={playerColor}
                  transparent
                  opacity={0.8}
                  blending={AdditiveBlending}
                />
              </mesh>
            );
          })}

          {/* Shockwave ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.8, 1.2, 16]} />
            <meshBasicMaterial
              color={playerColor}
              transparent
              opacity={0.4}
              blending={AdditiveBlending}
              side={2} // DoubleSide
            />
          </mesh>
        </group>
      )}

      {/* Spirit Phase */}
      {phase === 'spirit' && (
        <group>
          {/* Main spirit crystal */}
          <mesh geometry={spiritGeometry}>
            <meshBasicMaterial
              color={spiritColor}
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
            />
          </mesh>

          {/* Spirit aura particles */}
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 0.8;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            return (
              <mesh
                key={`spirit-particle-${i}`}
                position={[x, 0, z]}
                scale={[0.2, 0.2, 0.2]}
              >
                <octahedronGeometry args={[0.1, 0]} />
                <meshBasicMaterial
                  color={spiritColor}
                  transparent
                  opacity={0.6}
                  blending={AdditiveBlending}
                />
              </mesh>
            );
          })}

          {/* Spirit trail effect */}
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.05, 0.1, 1, 8]} />
            <meshBasicMaterial
              color={spiritColor}
              transparent
              opacity={0.3}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
