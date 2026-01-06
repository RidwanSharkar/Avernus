import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, AdditiveBlending } from '@/utils/three-exports';
import { cylinderBeamThick, coneMedium, sphereSmall, sphereMedium, sphereLarge, getCachedGeometry } from '@/utils/sharedGeometries';

interface ViperStingProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<string>;
  opacity: number;
  fadeStartTime: number | null;
  isReturning: boolean;
  returnHitEnemies: Set<string>;
}

interface ViperStingProps {
  projectilePool: React.MutableRefObject<ViperStingProjectile[]>;
}

const ViperStingProjectileVisual: React.FC<{ projectile: ViperStingProjectile }> = ({ projectile }) => {
  const groupRef = useRef<Group>(null);
  const TRAIL_COUNT = 8;

  useFrame(() => {
    if (!groupRef.current) return;

    // Update position
    groupRef.current.position.copy(projectile.position);

    // Calculate rotation based on direction (similar to ThrowSpear)
    const lookDirection = projectile.direction.clone().normalize();
    const rotationY = Math.atan2(lookDirection.x, lookDirection.z);
    const rotationX = Math.atan2(-lookDirection.y, Math.sqrt(lookDirection.x * lookDirection.x + lookDirection.z * lookDirection.z));
    
    // Apply rotation
    groupRef.current.rotation.set(rotationX, rotationY, 0);
  });

  if (!projectile.active) return null;

  return (
    <group ref={groupRef}>
      {/* Main projectile body - sleek venomous arrow */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <primitive object={cylinderBeamThick} />
        <meshStandardMaterial
          color="#8B3F9B" // Dark purple venom color
          emissive="#5A2B5F"
          emissiveIntensity={1.2}
          transparent
          opacity={projectile.opacity}
        />
      </mesh>

      {/* Arrowhead */}
      <mesh position={[0, 0, 1.25]} rotation={[Math.PI / 2, 0, 0]}>
        <primitive object={coneMedium} />
        <meshStandardMaterial
          color="#A855C7"
          emissive="#7E3A9F"
          emissiveIntensity={1.5}
          transparent
          opacity={projectile.opacity}
        />
      </mesh>

      {/* Spinning venom energy rings around the projectile - ThrowSpear style */}
      {[...Array(2)].map((_, i) => (
        <group key={`ring-${i}`} position={[0, 0, 0.3 - i * 0.4] as [number, number, number]}>
          <mesh
            rotation={[0, 0, Date.now() * 0.01 + i * Math.PI / 3]}
          >
            <torusGeometry args={[0.15 + i * 0.05, 0.02, 6, 12]} />
            <meshStandardMaterial
              color="#A855C7" // Medium purple
              emissive="#A855C7"
              emissiveIntensity={1.5 + 1}
              transparent
              opacity={projectile.opacity * 0.7}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Venom energy core */}
      <mesh>
        <primitive object={sphereSmall} />
        <meshStandardMaterial
          color="#C084FC"
          emissive="#A855C7"
          emissiveIntensity={3}
          transparent
          opacity={projectile.opacity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Venom trail effects - ThrowSpear style with purple colors */}
      {[...Array(TRAIL_COUNT)].map((_, index) => {
        const trailOpacity = projectile.opacity * (1 - index / TRAIL_COUNT) * 0.6;
        const trailScale = 1 - (index / TRAIL_COUNT) * 0.5;
        
        // Position trails behind the projectile tip in the projectile's local coordinate system
        // The projectile's forward direction is along the positive Z axis in its local space
        const trailOffset: [number, number, number] = [0, 0, -(index + 1) * 0.8]; // Behind the projectile along Z axis
        
        return (
          <group
            key={`trail-${index}`}
            position={trailOffset}
          >
            {/* Venom energy trail */}
            <mesh scale={[trailScale, trailScale, trailScale]}>
              <primitive object={sphereMedium} />
              <meshStandardMaterial
                color="#A855C7" // Medium purple
                emissive="#A855C7"
                emissiveIntensity={4 + 2}
                transparent
                opacity={trailOpacity}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {/* Outer venom glow */}
            <mesh scale={[trailScale * 1.5, trailScale * 1.5, trailScale * 1.5]}>
              <primitive object={sphereLarge} />
              <meshStandardMaterial
                color="#C084FC" // Light purple
                emissive="#C084FC"
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

      {/* Point light for glow effect */}
      <pointLight
        color="#A855C7"
        intensity={2 * projectile.opacity}
        distance={4}
        decay={2}
      />
    </group>
  );
};

export default function ViperSting({ projectilePool }: ViperStingProps) {
  return (
    <>
      {projectilePool.current
        .filter(projectile => projectile.active)
        .map(projectile => (
          <ViperStingProjectileVisual
            key={`viper-sting-${projectile.id}`}
            projectile={projectile}
          />
        ))}
    </>
  );
}
