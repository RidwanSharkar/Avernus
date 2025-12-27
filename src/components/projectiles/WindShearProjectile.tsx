import React, { useState, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Shape, Group } from 'three';

interface WindShearProjectileData {
  id: number;
  position: Vector3;
  direction: Vector3;
  startTime: number;
  maxDistance: number;
  distanceTraveled: number;
  hitTargets: Set<string>; // Track what has been hit to prevent multiple hits
}

interface WindShearProjectileManagerProps {
  onProjectileHit?: (targetId: string, damage: number) => void;
  onPlayerHit?: (playerId: string) => void; // New callback for player hits (for Charge cooldown reduction)
  world?: any; // World instance for collision detection
  players?: Array<{ id: string; position: { x: number; y: number; z: number }; health: number }>;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  localSocketId?: string;
}

// React-based projectile manager (no global state)
export default function WindShearProjectileManager({
  onProjectileHit,
  onPlayerHit, // New callback for player hits
  world,
  players = [],
  enemyData = [],
  localSocketId
}: WindShearProjectileManagerProps) {
  const [activeProjectiles, setActiveProjectiles] = useState<WindShearProjectileData[]>([]);
  const projectileIdCounter = useRef(0);

  // Function to add new projectiles
  const addProjectile = useCallback((position: Vector3, direction: Vector3) => {
    const projectileId = projectileIdCounter.current++;
    
    
    const normalizedDirection = direction.clone().normalize();
    const projectileData: WindShearProjectileData = {
      id: projectileId,
      position: position.clone(),
      direction: normalizedDirection,
      startTime: Date.now(),
      maxDistance: 15, // 15 unit range as specified
      distanceTraveled: 0,
      hitTargets: new Set()
    };
    
    setActiveProjectiles(prev => {
      const newProjectiles = [...prev, projectileData];
      return newProjectiles;
    });
  }, []);

  useFrame((state, deltaTime) => {
    if (activeProjectiles.length === 0) return;

    const speed = 32.5; // Increased by 30%
    const currentTime = Date.now();
    const DAMAGE = 95; // Increased piercing damage as specified
    const HIT_RADIUS = 1.5; // Collision radius

    setActiveProjectiles(prev => {
      const updatedProjectiles: WindShearProjectileData[] = [];
      
      prev.forEach((projectile) => {
        // Update projectile position
        const movement = projectile.direction.clone().multiplyScalar(speed * deltaTime);
        projectile.position.add(movement);
        projectile.distanceTraveled += movement.length();

        // Check for collisions with enemies (PVE mode)
        if (enemyData && enemyData.length > 0) {
          for (const enemy of enemyData) {
            if (projectile.hitTargets.has(enemy.id) || enemy.health <= 0) continue;

            const distance = projectile.position.distanceTo(enemy.position);
            if (distance <= HIT_RADIUS) {
              projectile.hitTargets.add(enemy.id);
              
              // Call hit callback for damage processing
              if (onProjectileHit) {
                onProjectileHit(enemy.id, DAMAGE);
              }
              
              // Don't remove projectile immediately - piercing damage!
              break; // Only hit one target per frame
            }
          }
        }

        // Check for collisions with other players (PVP mode)
        if (players && players.length > 0 && localSocketId) {
          for (const player of players) {
            // Skip self and already hit targets
            if (player.id === localSocketId || projectile.hitTargets.has(player.id) || player.health <= 0) continue;

            const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
            const distance = projectile.position.distanceTo(playerPos);
            if (distance <= HIT_RADIUS) {
              projectile.hitTargets.add(player.id);

              // Call hit callback for damage processing
              if (onProjectileHit) {
                onProjectileHit(player.id, DAMAGE);
              }

              // Call player hit callback for Charge cooldown reduction
              if (onPlayerHit) {
                onPlayerHit(player.id);
              }

              // Don't remove projectile immediately - piercing damage!
              break; // Only hit one target per frame
            }
          }
        }

        // Check if projectile should be removed (exceeded max distance or lifetime)
        const lifetime = (currentTime - projectile.startTime) / 1000;
        
        // Debug log every 0.25 seconds to track projectile movement more frequently
        if (Math.floor(lifetime * 4) !== Math.floor((lifetime - deltaTime) * 4)) {
        }
        
        if (projectile.distanceTraveled < projectile.maxDistance && lifetime <= 3.0) {
          updatedProjectiles.push(projectile);
        }
      });

      return updatedProjectiles;
    });
  });

  // Expose the addProjectile function globally
  React.useEffect(() => {
    (window as any).triggerWindShearProjectile = addProjectile;
    return () => {
      delete (window as any).triggerWindShearProjectile;
    };
  }, [addProjectile]);

  return (
    <group name="wind-shear-projectile-manager">
      {activeProjectiles.map((projectileData) => (
        <WindShearProjectileVisual
          key={projectileData.id}
          position={projectileData.position}
          direction={projectileData.direction}
          opacity={1}
        />
      ))}
    </group>
  );
}

// Global function to trigger wind shear projectiles (called from ControlSystem)
export const triggerWindShearProjectile = (position: Vector3, direction: Vector3) => {
  if ((window as any).triggerWindShearProjectile) {
    (window as any).triggerWindShearProjectile(position, direction);
  }
};

// Individual Wind Shear projectile visual component
interface WindShearProjectileVisualProps {
  position: Vector3;
  direction: Vector3;
  opacity: number;
}

function WindShearProjectileVisual({ position, direction, opacity }: WindShearProjectileVisualProps) {
  const groupRef = useRef<Group>(null);

  // Update position and rotation every frame to ensure smooth movement
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
      
      // Reset rotation before applying new orientation
      groupRef.current.rotation.set( Math.PI/2,  Math.PI/2, Math.PI/2);
      
      // Orient sword to face movement direction (same as RegularArrow)
      const lookAtTarget = position.clone().add(direction.clone().normalize());
      groupRef.current.lookAt(lookAtTarget);
      
      // Apply a fixed rotation to align the sword blade with forward direction
      // Since the blade extends in +X direction and lookAt points +Z, rotate -90° around Y
      groupRef.current.rotateY(-Math.PI / 2);
      groupRef.current.rotateZ(-Math.PI / 2);
    }
  });

  // Sword blade shape creation (same as the sword component)
  const createBladeShape = () => {
    const shape = new Shape();

    // Start at center
    shape.moveTo(0, 0);

    // Left side guard (fixed symmetry)
    shape.lineTo(-0.25, 0.25);
    shape.lineTo(-0.15, -0.15);
    shape.lineTo(0, 0);

    // Right side guard (matches left exactly)
    shape.lineTo(0.175, 0.175);
    shape.lineTo(0.15, -0.15);
    shape.lineTo(0, 0);

    // Blade shape with symmetry
    shape.lineTo(0, 0.08);
    shape.lineTo(0.2, 0.2);
    shape.quadraticCurveTo(0.8, 0.15, 1.825, 0.18);
    shape.quadraticCurveTo(2.0, 0.15, 2.275, 0);

    shape.quadraticCurveTo(2.0, -0.15, 1.825, -0.18);
    shape.quadraticCurveTo(0.8, -0.15, 0.15, -0.3);
    shape.lineTo(0, -0.08);
    shape.lineTo(0, 0);

    return shape;
  };

  // Inner blade shape
  const createInnerBladeShape = () => {
    const shape = new Shape();
    shape.moveTo(0, 0);

    shape.lineTo(0, 0.06);
    shape.lineTo(0.15, 0.15);
    shape.quadraticCurveTo(1.2, 0.12, 1.75, 0.15);
    shape.quadraticCurveTo(2.0, 0.08, 2.15, 0);
    shape.quadraticCurveTo(2.0, -0.08, 1.75, -0.15);
    shape.quadraticCurveTo(1.2, -0.12, 0.15, -0.275);
    shape.lineTo(0, -0.05);
    shape.lineTo(0, 0);

    return shape;
  };

  const bladeExtrudeSettings = {
    steps: 2,
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.02,
    bevelOffset: 0.04,
    bevelSegments: 2
  };

  const innerBladeExtrudeSettings = {
    ...bladeExtrudeSettings,
    depth: 0.06,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelOffset: 0,
    bevelSegments: 6
  };

  return (
    <group
      ref={groupRef}
      position={[position.x, position.y, position.z]}
      // Remove static rotation - let useFrame handle dynamic rotation
    >


      {/* Sword model - larger scale for better visibility */}
      <group scale={[1.0, 1.0, 1.0]}>
        {/* Handle */}
        <group position={[0.5, -0.55, 0.5]} rotation={[0, 1, Math.PI]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.05, 1.0, 12]} />
            <meshStandardMaterial
              color="#2C1810"
              emissive="#8B4513"
              emissiveIntensity={0.3}
              metalness={0.2}
              roughness={0.8}
              transparent
              opacity={opacity}
            />
          </mesh>
        </group>

        {/* Blade */}
        <group position={[0.5, 0.55, 0.5]} rotation={[0, -Math.PI / 2, Math.PI / 2]}>
          <mesh>
            <extrudeGeometry args={[createBladeShape(), bladeExtrudeSettings]} />
            <meshStandardMaterial
              color="#1097B5"
              emissive="#00FFFF"
              emissiveIntensity={1.2}
              metalness={0.9}
              roughness={0.1}
              transparent
              opacity={opacity}
              toneMapped={false}
            />
          </mesh>

          {/* Inner blade glow */}
          <mesh>
            <extrudeGeometry args={[createInnerBladeShape(), innerBladeExtrudeSettings]} />
            <meshStandardMaterial
              color="#00FFFF"
              emissive="#00FFFF"
              emissiveIntensity={2.0}
              metalness={0.6}
              roughness={0.05}
              transparent
              opacity={0.95 * opacity}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* Hilt guard */}
        <group position={[0.5, -0.1, 0.5]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh>
            <boxGeometry args={[0.6, 0.06, 0.12]} />
            <meshStandardMaterial
              color="#FFD700"
              emissive="#FFD700"
              emissiveIntensity={0.8}
              metalness={0.9}
              roughness={0.1}
              transparent
              opacity={opacity}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

    </group>
  );
}
