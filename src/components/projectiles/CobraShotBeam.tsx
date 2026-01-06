'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, AdditiveBlending } from '@/utils/three-exports';

interface CobraShotBeamProps {
  position: Vector3;
  direction: Vector3;
  onComplete: () => void;
  isReturning?: boolean;
}

const CobraShotBeam: React.FC<CobraShotBeamProps> = ({ 
  position, 
  direction, 
  onComplete,
  isReturning = false
}) => {
  const groupRef = useRef<Group>(null);
  const startTimeRef = useRef(Date.now());
  const duration = 175; // Slightly longer than bow powershot for cobra effect
  const fadeStartTime = useRef<number | null>(null);
  
  // Green cobra theme colors
  const colors = {
    core: "#00ff40",      // Bright green
    emissive: "#00aa20",   // Medium green
    outer: "#00ff60"       // Light green
  };
  
  useFrame(() => {
    const elapsed = Date.now() - startTimeRef.current;
    
    if (elapsed >= duration && !fadeStartTime.current) {
      fadeStartTime.current = Date.now();
    }
    
    // Handle fade out
    if (fadeStartTime.current) {
      const fadeElapsed = Date.now() - fadeStartTime.current;
      const fadeDuration = 150; // Slightly longer fade for cobra effect
      
      if (fadeElapsed >= fadeDuration) {
        onComplete();
        return;
      }
    }
  });

  const fadeProgress = fadeStartTime.current 
    ? Math.max(0, 1 - (Date.now() - fadeStartTime.current) / 400)
    : 1;

  return (
    <group ref={groupRef} position={position.toArray()}>
      {/* Main beam trail - very thin like firebeam but 1/4 diameter */}
      <group
        rotation={[
          0,
          Math.atan2(direction.x, direction.z),
          0
        ]}
      >
        {/* Core beam - ultra thin with cobra glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
          <cylinderGeometry args={[0.045, 0.045, 20, 8]} />
          <meshStandardMaterial
            color={colors.core}
            emissive={colors.emissive}
            emissiveIntensity={16 * fadeProgress}
            transparent
            opacity={0.98 * fadeProgress}
          />
        </mesh>

        {/* Inner glow - cobra aura */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
          <cylinderGeometry args={[0.08, 0.08, 20, 8]} />
          <meshStandardMaterial
            color={colors.emissive}
            emissive={colors.emissive}
            emissiveIntensity={12 * fadeProgress}
            transparent
            opacity={0.8 * fadeProgress}
          />
        </mesh>

        {/* Outer glow - toxic mist */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
          <cylinderGeometry args={[0.12, 0.12, 20, 8]} />
          <meshStandardMaterial
            color={colors.outer}
            emissive={colors.core}
            emissiveIntensity={8 * fadeProgress}
            transparent
            opacity={0.6 * fadeProgress}
          />
        </mesh>

        {/* Cobra ring/swirl effects that last longer */}
        {[...Array(7)].map((_, i) => {
          const ringProgress = Math.min(1, (Date.now() - startTimeRef.current) / 800); // Slower fade for cobra rings
          const ringFade = fadeStartTime.current
            ? Math.max(0, 1 - (Date.now() - fadeStartTime.current) / 600) // Longer fade for rings
            : 1;

          const offset = i * 2.8;
          const scale = 1 - (i * 0.08);

          return (
            <group key={`ring-${i}`} position={[0, 0, offset]}>
              {/* Cobra smoke ring effect */}
              <mesh
                rotation={[0, Date.now() * 0.0025 + i, 0]}
                scale={[scale, scale, scale]}
              >
                <torusGeometry args={[0.35, 0.07, 6, 12]} />
                <meshStandardMaterial
                  color={colors.outer}
                  emissive={colors.emissive}
                  emissiveIntensity={2.5 * ringFade}
                  transparent
                  opacity={0.45 * ringFade * (1 - ringProgress * 0.4)}
                  blending={AdditiveBlending}
                />
              </mesh>

              {/* Secondary cobra swirl */}
              <mesh
                rotation={[Math.PI/2, Date.now() * -0.0035 + i, 0]}
                scale={[scale * 0.75, scale * 0.75, scale * 0.75]}
              >
                <torusGeometry args={[0.28, 0.05, 6, 12]} />
                <meshStandardMaterial
                  color={colors.core}
                  emissive={colors.emissive}
                  emissiveIntensity={1.8 * ringFade}
                  transparent
                  opacity={0.35 * ringFade * (1 - ringProgress * 0.25)}
                  blending={AdditiveBlending}
                />
              </mesh>
            </group>
          );
        })}

        {/* Cobra energy particles */}
        {[...Array(12)].map((_, i) => {
          const particleProgress = Math.min(1, (Date.now() - startTimeRef.current) / (duration * 0.9));
          const particlePosition = particleProgress * 20 - 10;
          const particleOffset = Math.sin(particleProgress * Math.PI * 6 + i) * 0.5;
          const particleOpacity = fadeProgress * (1 - particleProgress) * 0.6;
          
          return (
            <mesh
              key={`particle-${i}`}
              position={[particleOffset, 0, particlePosition]}
              scale={[0.3, 0.3, 0.3]}
            >
              <sphereGeometry args={[0.08, 6, 6]} />
              <meshStandardMaterial
                color={colors.outer}
                emissive={colors.outer}
                emissiveIntensity={10 * fadeProgress}
                transparent
                opacity={particleOpacity}
                blending={2} // AdditiveBlending
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* Point light for cobra beam glow */}
      <pointLight
        color={colors.core}
        intensity={8 * fadeProgress}
        distance={8}
        decay={1}
      />
    </group>
  );
};

export default CobraShotBeam;
