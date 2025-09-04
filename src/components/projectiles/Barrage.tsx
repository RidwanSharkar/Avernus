import React from 'react';
import { Vector3, AdditiveBlending } from '@/utils/three-exports';

interface BarrageProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  damage: number;
  startTime: number;
  hasCollided: boolean;
  hitEnemies: Set<string>;
  opacity?: number;
  fadeStartTime?: number | null;
  distanceTraveled?: number;
}

interface BarrageProps {
  projectiles: BarrageProjectile[];
}

export default function Barrage({ projectiles }: BarrageProps) {
  return (
    <>
      {projectiles.map(projectile => {
        // Calculate distance-based fading (same logic as RegularArrow)
        const distanceTraveled = projectile.distanceTraveled || projectile.position.distanceTo(projectile.startPosition);
        const maxDistance = projectile.maxDistance || 25;
        const fadeStartDistance = maxDistance * 0.7; // Start fading at 70% of max distance
        const fadeProgress = Math.max(0, Math.min(1, (distanceTraveled - fadeStartDistance) / (maxDistance - fadeStartDistance)));
        const distanceOpacity = Math.max(0.1, 1 - fadeProgress); // Minimum opacity of 0.1
        
        // Combine distance-based opacity with any existing opacity
        const finalOpacity = (projectile.opacity !== undefined ? projectile.opacity : 1) * distanceOpacity;
        
        return (
          <group key={projectile.id}>
            <group
              position={projectile.position.toArray()}
              rotation={[
                0,
                Math.atan2(projectile.direction.x, projectile.direction.z),
                0
              ]}
            >
            {/* Base arrow - slightly smaller than regular bow arrows */}
            <mesh rotation={[Math.PI/2, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.1, 1.8, 6]} />
              <meshStandardMaterial
                color="#0088ff"
                emissive="#0088ff"
                emissiveIntensity={1.2 * finalOpacity}
                transparent
                opacity={finalOpacity}
              />
            </mesh>

            {/* Arrow Rings - fewer rings for barrage arrows */}
            {[...Array(2)].map((_, i) => ( 
              <mesh
                key={`barrage-ring-${i}`}
                position={[0, 0, -i * 0.4 + 0.4]}
                rotation={[Math.PI, 0, Date.now() * 0.004 + i * Math.PI / 2]}
              >
                <torusGeometry args={[0.1 + i * 0.03, 0.04, 6, 10]} />
                <meshStandardMaterial
                  color="#0088ff"
                  emissive="#0088ff"
                  emissiveIntensity={2.5 * finalOpacity}
                  transparent
                  opacity={(0.8 - i * 0.1) * finalOpacity}
                  blending={AdditiveBlending}
                />
              </mesh>
            ))}

            {/* Single light */}
            <pointLight 
              color="#0088ff" 
              intensity={2.5 * finalOpacity} 
              distance={4}
              decay={2}
            />
          </group>
        </group>
        );
      })}
    </>
  );
}
