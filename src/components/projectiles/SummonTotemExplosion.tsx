import React, { useRef, useState, useEffect } from 'react';
import { Vector3, AdditiveBlending, Group } from '@/utils/three-exports';
import { totemExplosionSphere, totemEnergySphere, totemRing, sphereSparkSmall, disposeThreeJSResources } from '@/utils/sharedGeometries';

interface SummonTotemExplosionProps {
  position: Vector3;
  explosionStartTime: number | null;
  onComplete?: () => void;
}

const IMPACT_DURATION = 0.2; // Exact duration from original

export default function SummonTotemExplosion({
  position,
  explosionStartTime,
  onComplete
}: SummonTotemExplosionProps) {
  const startTime = useRef(explosionStartTime || Date.now());
  const [, forceUpdate] = useState({}); // Force updates to animate
  const groupRef = useRef<Group>(null);

  useEffect(() => {
    // Animation timer - exact same timing as original
    const interval = setInterval(() => {
      forceUpdate({});

      // Check if we should clean up - exact same condition as original
      const elapsed = (Date.now() - startTime.current) / 1000;
      if (elapsed > IMPACT_DURATION) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 16); // ~60fps

    // Cleanup timer after explosion duration
    const timer = setTimeout(() => {
      clearInterval(interval);
      if (onComplete) onComplete();
    }, IMPACT_DURATION * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      // Dispose of Three.js resources
      if (groupRef.current) {
        disposeThreeJSResources(groupRef.current);
      }
    };
  }, [onComplete]);

  // Calculate fade based on elapsed time - exact same calculation as original
  const elapsed = (Date.now() - startTime.current) / 1000;
  const duration = IMPACT_DURATION;
  const fade = Math.max(0, 1 - (elapsed / duration));

  if (fade <= 0) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Core explosion sphere - Exact same as original */}
      <mesh scale={[0.35 * (1 + elapsed * 2), 0.35 * (1 + elapsed * 2), 0.35 * (1 + elapsed * 2)]} geometry={totemExplosionSphere}>
        <meshStandardMaterial
          color="#0099ff"
          emissive="#0088cc"
          emissiveIntensity={0.5 * fade}
          transparent
          opacity={0.8 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Inner energy sphere - Exact same as original */}
      <mesh scale={[0.25 * (1 + elapsed * 3), 0.25 * (1 + elapsed * 3), 0.25 * (1 + elapsed * 3)]} geometry={totemEnergySphere}>
        <meshStandardMaterial
          color="#0077aa"
          emissive="#cceeff"
          emissiveIntensity={0.5 * fade}
          transparent
          opacity={0.9 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Expanding rings - Exact same as original */}
      {[0.45, 0.65, 0.85].map((baseSize, i) => {
        const scale = baseSize * (1 + elapsed * 3);
        return (
          <mesh key={i} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]} scale={[scale, scale, scale]}>
            <primitive object={totemRing} />
            <meshStandardMaterial
              color="#0099ff"
              emissive="#0088cc"
              emissiveIntensity={1 * fade}
              transparent
              opacity={0.6 * fade * (1 - i * 0.2)}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Particle sparks - Exact same as original */}
      {[...Array(4)].map((_, i) => {
        const angle = (i / 4) * Math.PI * 2;
        const radius = 0.5 * (1 + elapsed * 2);
        return (
          <mesh
            key={`spark-${i}`}
            position={[
              Math.sin(angle) * radius,
              Math.cos(angle) * radius,
              0
            ]}
          >
            <primitive object={sphereSparkSmall} />
            <meshStandardMaterial
              color="#0077aa"
              emissive="#cceeff"
              emissiveIntensity={2 * fade}
              transparent
              opacity={0.8 * fade}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Point lights - Exact same as original */}
      <pointLight
        color="#0099ff"
        intensity={1 * fade}
        distance={4}
        decay={2}
      />
      <pointLight
        color="#0077aa"
        intensity={1 * fade}
        distance={6}
        decay={1}
      />
    </group>
  );
}
