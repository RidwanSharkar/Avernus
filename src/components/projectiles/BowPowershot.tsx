import React, { useRef } from 'react';
import { AdditiveBlending } from '@/utils/three-exports';

import { Vector3, Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { WeaponSubclass } from '@/components/dragon/weapons';

interface BowPowershotProps {
  position: Vector3;
  direction: Vector3;
  onComplete: () => void;
  subclass: WeaponSubclass;
  isElementalShotsUnlocked?: boolean;
  isPerfectShot?: boolean;
}

const BowPowershot: React.FC<BowPowershotProps> = ({ 
  position, 
  direction, 
  onComplete, 
  subclass,
  isElementalShotsUnlocked = true,
  isPerfectShot = false
}) => {
  const groupRef = useRef<Group>(null);
  const startTimeRef = useRef(Date.now());
  const duration = isPerfectShot ? 200 : 166; // Perfect shots last slightly longer
  const fadeStartTime = useRef<number | null>(null);
  
  // Determine colors based on subclass and unlock status
  const getColors = () => {
    if (subclass === WeaponSubclass.VENOM) {
      return {
        core: "#00ff40",
        emissive: "#00aa20",
        outer: "#00ff60"
      };
    } else if (subclass === WeaponSubclass.ELEMENTAL) {
      // Use the prop to determine if elemental shots are unlocked
      
      if (isElementalShotsUnlocked) {
        // Fire themed (red/orange)
        return {
          core: "#ff4400",
          emissive: "#cc0000", 
          outer: "#ff6600"
        };
      } else {
        // Blue themed
        return {
          core: "#0066ff",
          emissive: "#0044cc",
          outer: "#0088ff"
        };
      }
    }
    
    // Default fallback
    return {
      core: "#ffffff",
      emissive: "#cccccc",
      outer: "#ffffff"
    };
  };

  const colors = getColors();
  
  useFrame(() => {
    const elapsed = Date.now() - startTimeRef.current;
    
    if (elapsed >= duration && !fadeStartTime.current) {
      fadeStartTime.current = Date.now();
    }
    
    // Handle fade out
    if (fadeStartTime.current) {
      const fadeElapsed = Date.now() - fadeStartTime.current;
      const fadeDuration = 300; // 0.3 second fade
      
      if (fadeElapsed >= fadeDuration) {
        onComplete();
        return;
      }
    }
  });

  const fadeProgress = fadeStartTime.current 
    ? Math.max(0, 1 - (Date.now() - fadeStartTime.current) / 300)
    : 1;

  return (
    <group ref={groupRef} position={position.toArray()}>
      {/* Main beam trail - very thin like firebeam but 1/4 diameter */}
      <group
        rotation={[
          -Math.asin(direction.y / direction.length()), // Pitch (vertical angle) // was 0
          Math.atan2(direction.x, direction.z), // Yaw (horizontal angle)
          0
        ]}
      >
        {/* Core beam - ultra thin, enhanced for perfect shots */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
          <cylinderGeometry args={[isPerfectShot ? 0.035 : 0.025, isPerfectShot ? 0.035 : 0.025, 20, 8]} />
          <meshStandardMaterial
            color={colors.core}
            emissive={colors.emissive}
            emissiveIntensity={(isPerfectShot ? 15 : 12) * fadeProgress}
            transparent
            opacity={0.95 * fadeProgress}
          />
        </mesh>

        {/* Inner glow - enhanced for perfect shots */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
          <cylinderGeometry args={[isPerfectShot ? 0.08 : 0.0625, isPerfectShot ? 0.08 : 0.0625, 20, 8]} />
          <meshStandardMaterial
            color={colors.core}
            emissive={colors.emissive}
            emissiveIntensity={(isPerfectShot ? 10 : 8) * fadeProgress}
            transparent
            opacity={0.7 * fadeProgress}
          />
        </mesh>

        {/* Outer glow - enhanced for perfect shots */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
          <cylinderGeometry args={[isPerfectShot ? 0.095 : 0.075, isPerfectShot ? 0.095 : 0.075, 20, 8]} />
          <meshStandardMaterial
            color={colors.outer}
            emissive={colors.emissive}
            emissiveIntensity={(isPerfectShot ? 6 : 4) * fadeProgress}
            transparent
            opacity={0.5 * fadeProgress}
          />
        </mesh>

        {/* Ring/swirl effects that last longer - more rings for perfect shots */}
        {[...Array(isPerfectShot ? 8 : 6)].map((_, i) => {
          const ringProgress = Math.min(1, (Date.now() - startTimeRef.current) / 800); // Slower fade for rings
          const ringFade = fadeStartTime.current 
            ? Math.max(0, 1 - (Date.now() - fadeStartTime.current) / 600) // Longer fade for rings
            : 1;
          
          const offset = i * 3;
          const scale = 1 - (i * 0.1);
          
          return (
            <group key={`ring-${i}`} position={[0, 0, offset]}>
              {/* Smoke ring effect */}
              <mesh
                rotation={[0, Date.now() * 0.002 + i, 0]}
                scale={[scale, scale, scale]}
              >
                <torusGeometry args={[0.4, 0.08, 6, 12]} />
                <meshStandardMaterial
                  color={colors.outer}
                  emissive={colors.emissive}
                  emissiveIntensity={2 * ringFade}
                  transparent
                  opacity={0.4 * ringFade * (1 - ringProgress * 0.5)}
                  blending={AdditiveBlending}
                />
              </mesh>
              
              {/* Secondary swirl */}
              <mesh
                rotation={[Math.PI/2, Date.now() * -0.003 + i, 0]}
                scale={[scale * 0.7, scale * 0.7, scale * 0.7]}
              >
                <torusGeometry args={[0.3, 0.06, 6, 12]} />
                <meshStandardMaterial
                  color={colors.core}
                  emissive={colors.emissive}
                  emissiveIntensity={1.5 * ringFade}
                  transparent
                  opacity={0.3 * ringFade * (1 - ringProgress * 0.3)}
                  blending={AdditiveBlending}
                />
              </mesh>
            </group>
          );
        })}

        {/* Point light for illumination - brighter for perfect shots */}
        <pointLight
          color={colors.core}
          intensity={(isPerfectShot ? 20 : 15) * fadeProgress}
          distance={isPerfectShot ? 10 : 8}
          decay={2}
          position={[0, 0, 10]}
        />

        {/* Additional perfect shot effects */}
        {isPerfectShot && (
          <>
            {/* Lightning-like crackling effect around perfect shots */}
            {[...Array(4)].map((_, i) => {
              const angle = (i / 4) * Math.PI * 2;
              const radius = 0.15;
              return (
                <group key={`lightning-${i}`} position={[
                  Math.sin(angle + Date.now() * 0.01) * radius,
                  Math.cos(angle + Date.now() * 0.01) * radius,
                  10 + Math.sin(Date.now() * 0.005 + i) * 2
                ]}>
                  <mesh>
                    <sphereGeometry args={[0.02, 4, 4]} />
                    <meshStandardMaterial
                      color="#ffffff"
                      emissive="#ffffff"
                      emissiveIntensity={8 * fadeProgress}
                      transparent
                      opacity={0.8 * fadeProgress}
                      blending={AdditiveBlending}
                    />
                  </mesh>
                </group>
              );
            })}
            
            {/* Perfect shot aura */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
              <cylinderGeometry args={[0.12, 0.12, 20, 8]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={2 * fadeProgress}
                transparent
                opacity={0.3 * fadeProgress}
                blending={AdditiveBlending}
              />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
};

export default BowPowershot;
