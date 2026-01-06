'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, SphereGeometry, OctahedronGeometry, BoxGeometry, RingGeometry, CylinderGeometry, MeshBasicMaterial, AdditiveBlending, MathUtils } from '@/utils/three-exports';

// Shared geometries to prevent memory leaks - these persist across component instances
const sharedGeometries = {
  explosionParticle: new SphereGeometry(0.1, 8, 6),
  explosionFlash: new SphereGeometry(0.2, 16, 12),
  debugBox: new BoxGeometry(1, 1, 1),
  shockwaveRing: new RingGeometry(0.8, 1.2, 16),
  spiritCrystal: new OctahedronGeometry(0.3, 0),
  spiritParticle: new OctahedronGeometry(0.1, 0),
  spiritTrail: new CylinderGeometry(0.05, 0.1, 1, 8),
};

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

  // Use shared geometries to prevent memory leaks

  // Memoized materials - these need to be disposed since they're created per instance
  const materials = useMemo(() => ({
    debugBox: new MeshBasicMaterial({ color: "red" }),
    explosionFlash: new MeshBasicMaterial({
      color: playerColor,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
    }),
    explosionParticle: new MeshBasicMaterial({
      color: playerColor,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
    }),
    shockwaveRing: new MeshBasicMaterial({
      color: playerColor,
      transparent: true,
      opacity: 0.4,
      blending: AdditiveBlending,
      side: 2, // DoubleSide
    }),
    spiritCrystal: new MeshBasicMaterial({
      color: spiritColor,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
    }),
    spiritParticle: new MeshBasicMaterial({
      color: spiritColor,
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
    }),
    spiritTrail: new MeshBasicMaterial({
      color: spiritColor,
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
    }),
  }), [playerColor, spiritColor]);

  useEffect(() => {
    // Cleanup materials on unmount (geometries are shared and persist)
    return () => {
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [materials]);

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
        //console.log('💀 SummonedUnitDeathEffect completed');
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
      {/* DEBUG: Bright colored box to verify rendering */}
      <mesh position={[0, 2, 0]} geometry={sharedGeometries.debugBox} material={materials.debugBox} />

      {/* Explosion Phase */}
      {phase === 'explosion' && (
        <group>
          {/* Core explosion flash */}
          <mesh geometry={sharedGeometries.explosionFlash} material={materials.explosionFlash} />

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
                geometry={sharedGeometries.explosionParticle}
                material={materials.explosionParticle}
              />
            );
          })}

          {/* Shockwave ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]} geometry={sharedGeometries.shockwaveRing} material={materials.shockwaveRing} />
        </group>
      )}

      {/* Spirit Phase */}
      {phase === 'spirit' && (
        <group>
          {/* Main spirit crystal */}
          <mesh geometry={sharedGeometries.spiritCrystal} material={materials.spiritCrystal} />

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
                geometry={sharedGeometries.spiritParticle}
                material={materials.spiritParticle}
              />
            );
          })}

          {/* Spirit trail effect */}
          <mesh position={[0, -0.5, 0]} geometry={sharedGeometries.spiritTrail} material={materials.spiritTrail} />
        </group>
      )}
    </group>
  );
}
