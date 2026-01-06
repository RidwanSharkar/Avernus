import React, { useRef, useEffect } from 'react';
import { Vector3, Group, AdditiveBlending, DoubleSide } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { getCachedGeometry, sphereMedium } from '@/utils/sharedGeometries';

interface SoulStealEffectProps {
  id: number;
  startPosition: Vector3;
  targetPosition: Vector3;
  startTime: number;
  duration: number;
  getCurrentPlayerPosition: () => Vector3;
  onComplete: () => void;
}

export default function SoulStealEffect({
  id,
  startPosition,
  targetPosition,
  startTime,
  duration,
  getCurrentPlayerPosition,
  onComplete
}: SoulStealEffectProps) {
  const groupRef = useRef<Group>(null);
  const currentPosition = useRef(startPosition.clone());
  const hasCompleted = useRef(false);

  useFrame(() => {
    if (!groupRef.current || hasCompleted.current) return;

    const now = Date.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    if (progress >= 1) {
      // Effect has reached the player
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onComplete();
      }
      return;
    }

    // Get current player position for dynamic tracking
    const currentTarget = getCurrentPlayerPosition();

    // Smooth interpolation from start to current player position
    const newPosition = new Vector3().lerpVectors(startPosition, currentTarget, progress);

    currentPosition.current.copy(newPosition);
    groupRef.current.position.copy(newPosition);

    // Scale effect based on progress (starts small, grows, then shrinks)
    const scale = progress < 0.5 
      ? 0.5 + progress // Grow from 0.5 to 1.0
      : 1.5 - progress; // Shrink from 1.0 to 0.5
    groupRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef} position={startPosition}>
      {/* Core soul orb */}
      <mesh>
        <primitive object={getCachedGeometry('sphere', 0.15, 8, 8)} />
        <meshStandardMaterial
          color="#E879F9"
          emissive="#E879F9"
          emissiveIntensity={2}
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Outer glow */}
      <mesh>
        <primitive object={getCachedGeometry('sphere', 0.25, 8, 8)} />
        <meshStandardMaterial
          color="#C084FC"
          emissive="#C084FC"
          emissiveIntensity={1}
          transparent
          opacity={0.3}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Healing energy aura */}
      <mesh rotation={[Math.PI / 2, 0, Date.now() * 0.005]}>
        <primitive object={getCachedGeometry('ring', 0.1, 0.3, 8)} />
        <meshStandardMaterial
          color="#A855F7"
          emissive="#A855F7"
          emissiveIntensity={1.5}
          transparent
          opacity={0.4}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
