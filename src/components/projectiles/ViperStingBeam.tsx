import React, { useRef } from 'react';
import { Vector3, Group, AdditiveBlending } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { getCachedGeometry, sphereSparkTiny, sphereSparkSmall } from '@/utils/sharedGeometries';

interface ViperStingBeamProps {
  position: Vector3;
  direction: Vector3;
  onComplete: () => void;
  isReturning?: boolean;
}

const ViperStingBeam: React.FC<ViperStingBeamProps> = ({ 
  position, 
  direction, 
  onComplete,
  isReturning = false
}) => {
  const groupRef = useRef<Group>(null);
  const startTimeRef = useRef(Date.now());
  const duration = 200; // Slightly longer than bow powershot
  const fadeStartTime = useRef<number | null>(null);
  
  // Purple venom theme colors
  const colors = {
    core: "#8B3F9B",      // Dark purple
    emissive: "#A855C7",   // Medium purple
    outer: "#C084FC"       // Light purple
  };
  
  useFrame(() => {
    const elapsed = Date.now() - startTimeRef.current;
    
    if (elapsed >= duration && !fadeStartTime.current) {
      fadeStartTime.current = Date.now();
    }
    
    // Handle fade out
    if (fadeStartTime.current) {
      const fadeElapsed = Date.now() - fadeStartTime.current;
      const fadeDuration = 250; // Slightly longer fade for venom effect
      
      if (fadeElapsed >= fadeDuration) {
        onComplete();
        return;
      }
    }
  });

  const fadeProgress = fadeStartTime.current 
    ? Math.max(0, 1 - (Date.now() - fadeStartTime.current) / 350)
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
        {/* Core beam - ultra thin with venom glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
          <primitive object={getCachedGeometry('cylinder', 0.03, 0.03, 20, 8)} />
          <meshStandardMaterial
            color={colors.core}
            emissive={colors.emissive}
            emissiveIntensity={14 * fadeProgress}
            transparent
            opacity={0.95 * fadeProgress}
          />
        </mesh>

        {/* Inner glow - venomous aura */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
          <primitive object={getCachedGeometry('cylinder', 0.07, 0.07, 20, 8)} />
          <meshStandardMaterial
            color={colors.emissive}
            emissive={colors.emissive}
            emissiveIntensity={9 * fadeProgress}
            transparent
            opacity={0.7 * fadeProgress}
          />
        </mesh>

        {/* Outer glow - toxic mist */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
          <primitive object={getCachedGeometry('cylinder', 0.09, 0.09, 20, 8)} />
          <meshStandardMaterial
            color={colors.outer}
            emissive={colors.core}
            emissiveIntensity={5 * fadeProgress}
            transparent
            opacity={0.5 * fadeProgress}
          />
        </mesh>

        {/* Venom ring/swirl effects that last longer */}
        {[...Array(7)].map((_, i) => {
          const ringProgress = Math.min(1, (Date.now() - startTimeRef.current) / 900); // Slower fade for venom rings
          const ringFade = fadeStartTime.current 
            ? Math.max(0, 1 - (Date.now() - fadeStartTime.current) / 700) // Longer fade for rings
            : 1;
          
          const offset = i * 2.8;
          const scale = 1 - (i * 0.08);
          
          return (
            <group key={`ring-${i}`} position={[0, 0, offset]}>
              {/* Venom smoke ring effect */}
              <mesh
                rotation={[0, Date.now() * 0.0025 + i, 0]}
                scale={[scale, scale, scale]}
              >
                <primitive object={getCachedGeometry('torus', 0.35, 0.07, 6, 12)} />
                <meshStandardMaterial
                  color={colors.outer}
                  emissive={colors.emissive}
                  emissiveIntensity={2.5 * ringFade}
                  transparent
                  opacity={0.45 * ringFade * (1 - ringProgress * 0.4)}
                  blending={AdditiveBlending}
                />
              </mesh>
              
              {/* Secondary venom swirl */}
              <mesh
                rotation={[Math.PI/2, Date.now() * -0.0035 + i, 0]}
                scale={[scale * 0.75, scale * 0.75, scale * 0.75]}
              >
                <primitive object={getCachedGeometry('torus', 0.28, 0.05, 6, 12)} />
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

        {/* Venom particles floating around the beam */}
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const radius = 0.12;
          const floatOffset = Math.sin(Date.now() * 0.003 + i) * 0.05;
          return (
            <group key={`venom-particle-${i}`} position={[
              Math.sin(angle + Date.now() * 0.002) * radius,
              Math.cos(angle + Date.now() * 0.002) * radius + floatOffset,
              8 + Math.sin(Date.now() * 0.004 + i) * 3
            ]}>
              <mesh>
                <primitive object={sphereSparkTiny} />
                <meshStandardMaterial
                  color={colors.outer}
                  emissive={colors.outer}
                  emissiveIntensity={6 * fadeProgress}
                  transparent
                  opacity={0.7 * fadeProgress}
                  blending={AdditiveBlending}
                />
              </mesh>
            </group>
          );
        })}

        {/* Point light for illumination - purple venom glow */}
        <pointLight
          color={colors.emissive}
          intensity={18 * fadeProgress}
          distance={9}
          decay={2}
          position={[0, 0, 10]}
        />

        {/* Additional returning shot effects */}
        {isReturning && (
          <>
            {/* Soul energy crackling effect for returning shots */}
            {[...Array(5)].map((_, i) => {
              const angle = (i / 5) * Math.PI * 2;
              const radius = 0.18;
              return (
                <group key={`soul-energy-${i}`} position={[
                  Math.sin(angle + Date.now() * 0.012) * radius,
                  Math.cos(angle + Date.now() * 0.012) * radius,
                  10 + Math.sin(Date.now() * 0.006 + i) * 2.5
                ]}>
                  <mesh>
                    <primitive object={sphereSparkSmall} />
                    <meshStandardMaterial
                      color="#E879F9"
                      emissive="#E879F9"
                      emissiveIntensity={10 * fadeProgress}
                      transparent
                      opacity={0.9 * fadeProgress}
                      blending={AdditiveBlending}
                    />
                  </mesh>
                </group>
              );
            })}
            
            {/* Soul steal aura for returning shots */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
              <primitive object={getCachedGeometry('cylinder', 0.15, 0.15, 20, 8)} />
              <meshStandardMaterial
                color="#E879F9"
                emissive="#E879F9"
                emissiveIntensity={3 * fadeProgress}
                transparent
                opacity={0.4 * fadeProgress}
                blending={AdditiveBlending}
              />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
};

export default ViperStingBeam;
