import React, { useRef } from 'react';
import { Vector3, Group, AdditiveBlending, DoubleSide } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { getCachedGeometry, coneTornado, sphereSparkSmall, sphereSparkMedium } from '@/utils/sharedGeometries';

interface WindShearTornadoEffectProps {
  getPlayerPosition: () => Vector3;
  startTime: number;
  duration: number;
  onComplete: () => void;
}

export default function WindShearTornadoEffect({
  getPlayerPosition,
  startTime,
  duration,
  onComplete
}: WindShearTornadoEffectProps) {
  const groupRef = useRef<Group>(null);
  const hasCompleted = useRef(false);

  // Initialize position on first render
  const initialPosition = getPlayerPosition();

  useFrame(() => {
    if (!groupRef.current || hasCompleted.current) return;

    const now = Date.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    if (progress >= 1) {
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onComplete();
      }
      return;
    }

    // Get current player position dynamically
    const playerPosition = getPlayerPosition();

    // Rotate the entire tornado effect
    const rotationSpeed =2; // Rotation speed
    groupRef.current.rotation.y += rotationSpeed;

    // Scale effect based on progress (grows slightly then fades)
    const scale = 0.6 + (progress * 0.4); // Grows from 0.8 to 1.2
    groupRef.current.scale.setScalar(scale);

    // Position the effect at the exact player position (follow player)
    groupRef.current.position.copy(playerPosition);
  });

  return (
    <group ref={groupRef} position={[initialPosition.x, initialPosition.y, initialPosition.z]}>
      {/* Main tornado cone - grey with some transparency - ROTATED RIGHT SIDE UP */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <primitive object={coneTornado} />
        <meshStandardMaterial
          color="#666666" // Grey color
          emissive="#444444"
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* FAST SPINNING OUTER RINGS - Multiple layers rotating at different heights */}
      {[...Array(3)].map((_, ringIndex) => {
        // Distribute rings vertically from bottom to top of tornado
        const heightOffset = (ringIndex - 0.5 ) * 0.8; // -0.8, 0, +0.8

        return (
          <mesh
            key={`fast-ring-${ringIndex}`}
            position={[0, heightOffset, 0]}
            rotation={[Math.PI / 2, 0, (Date.now() * 0.005) + (ringIndex * Math.PI / 3)]}
          >
            <primitive object={getCachedGeometry('torus', 0.625 + (ringIndex * 0.25), 0.07, 12, 24)} />
            <meshStandardMaterial
              color="#888888"
              emissive="#666666"
              emissiveIntensity={0.4}
              transparent
              opacity={0.7 - (ringIndex * 0.1)}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* FAST SPINNING PARTICLES AROUND THE TORNADO */}
      {[...Array(16)].map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const fastAngle = angle + (Date.now() * 0.0025); // Much faster rotation
        const radius = 0.75 + (Math.sin(Date.now() * 0.008 + i) * 0.2); // Pulsing radius
        const height = (Math.sin(Date.now() * 0.006 + i * 0.5) * 0.65); // Oscillating height

        return (
          <mesh
            key={`fast-particle-${i}`}
            position={[
              Math.sin(fastAngle) * radius,
              height + 1,
              Math.cos(fastAngle) * radius
            ]}
          >
            <primitive object={sphereSparkSmall} />
            <meshStandardMaterial
              color="#AAAAAA"
              emissive="#888888"
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}



      {/* Top swirling particles */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + (Date.now() * 0.003);
        const radius = 0.2;

        return (
          <mesh
            key={`top-${i}`}
            position={[
              Math.sin(angle) * radius,
              0.75, // Top of tornado
              Math.cos(angle) * radius
            ]}
          >
            <primitive object={sphereSparkMedium} />
            <meshStandardMaterial
              color="#AAAAAA"
              emissive="#888888"
              emissiveIntensity={0.6}
              transparent
              opacity={0.7}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}
