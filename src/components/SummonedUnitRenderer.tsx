'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, MeshBasicMaterial, AdditiveBlending, MathUtils } from '@/utils/three-exports';
import { World } from '@/ecs/World';

interface SummonedUnitRendererProps {
  entityId: number;
  world: World;
  position: Vector3;
  ownerId: string;
  playerNumber?: number;
  health: number;
  maxHealth: number;
  isDead?: boolean;
  isElite?: boolean;
  color?: Color;
  lastDamageTime?: number; // Timestamp when unit was last damaged
}

export default function SummonedUnitRenderer({
  entityId,
  world,
  position,
  ownerId,
  playerNumber,
  health,
  maxHealth,
  isDead = false,
  isElite = false,
  color,
  lastDamageTime
}: SummonedUnitRendererProps) {
  // Debug logging for elite units
  useEffect(() => {
    if (isElite) {
      //console.log(`👑 Elite unit rendered for ${ownerId}: health=${health}/${maxHealth}, position=(${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    }
  }, [isElite, ownerId, health, maxHealth, position]);
  const groupRef = useRef<Group>(null);
  const healthBarRef = useRef<Mesh>(null);
  const healthBarMaterialRef = useRef<MeshBasicMaterial>(null);

  // Unit dimensions (simple and small to maintain framerate)
  const unitHeight = 1.2;
  const unitBaseRadius = 0.3;

  // Elite units are 1.15x larger
  const eliteScale = isElite ? 1.15 : 1.0;

  // Player-based colors: Player 1 = Red, Player 2 = Blue
  const ownerColor = useMemo(() => {
    // Use playerNumber if available, otherwise extract from ownerId for backward compatibility
    let effectivePlayerNumber = playerNumber || 1; // Default to player 1

    if (!playerNumber) {
      // Fallback: Extract player number from ownerId (e.g., "player1" -> 1, "player2" -> 2)
      const playerMatch = ownerId.match(/player(\d+)/);
      if (playerMatch) {
        effectivePlayerNumber = parseInt(playerMatch[1]);
      }
    }

    // Debug logging
    console.log(`SummonedUnitRenderer: ownerId = "${ownerId}", playerNumber = ${playerNumber}, effectivePlayerNumber = ${effectivePlayerNumber}`);

    // Player 1 = Red, Player 2 = Blue
    if (effectivePlayerNumber === 1) {
      console.log(`SummonedUnitRenderer: using RED color for player ${effectivePlayerNumber}`);
      return new Color(0xFF4444); // Red
    } else {
      console.log(`SummonedUnitRenderer: using BLUE color for player ${effectivePlayerNumber}`);
      return new Color(0x4444FF); // Blue
    }
  }, [ownerId, playerNumber]);

  const unitColor = color || ownerColor;

  // Calculate health-based opacity
  const healthPercentage = Math.max(0, health / maxHealth);
  const opacity = isDead ? 0.3 : Math.max(0.5, healthPercentage);

  // Damage flash effect - intensify color briefly when damaged
  const damageFlashDuration = 0.2; // 200ms flash
  const baseColor = isDead ? new Color(0x666666) : unitColor;
  const currentDamageColorRef = useRef<Color>(baseColor.clone());

  // Update current damage color ref when baseColor changes
  useEffect(() => {
    currentDamageColorRef.current = baseColor.clone();
  }, [baseColor]);

  // Handle animations and health bar updates
  useFrame((state) => {
    if (!groupRef.current || isDead) return;

    const time = state.clock.elapsedTime;
    const deltaTime = state.clock.getDelta();

    // Damage flash effect
    let damageColor = baseColor.clone();
    if (lastDamageTime && time - lastDamageTime < damageFlashDuration) {
      // Intensify color during flash (make it brighter and more saturated)
      damageColor.multiplyScalar(1.5);
      damageColor.addScalar(0.2); // Add some white to make it brighter
    }
    currentDamageColorRef.current = damageColor;

    // Gentle floating motion
    groupRef.current.position.y = position.y + Math.sin(time * 2) * 0.05;

    // Gentle rotation for crystal-like appearance
    groupRef.current.rotation.y += deltaTime * 0.5;

    // Update health bar scale and color every frame
    const healthPercentage = Math.max(0, Math.min(1, health / maxHealth));

    // Update health bar fill scale and position
    if (healthBarRef.current) {
      healthBarRef.current.scale.x = healthPercentage;
      healthBarRef.current.position.x = -(0.85 * (1 - healthPercentage)) / 2;
    }

    // Update health bar color based on percentage
    if (healthBarMaterialRef.current) {
      if (healthPercentage > 0.5) {
        healthBarMaterialRef.current.color.setHex(0x00ff00); // Green
      } else if (healthPercentage > 0.25) {
        healthBarMaterialRef.current.color.setHex(0xffff00); // Yellow
      } else {
        healthBarMaterialRef.current.color.setHex(0xff0000); // Red
      }
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]} scale={[eliteScale, eliteScale, eliteScale]}>
      {/* Main Body - Crystal-like Octahedron */}
      <mesh
        position={[0, unitHeight * 0.725, 0]}
        castShadow
        receiveShadow
      >
        <octahedronGeometry args={[unitBaseRadius * 1.25, 0]} />
        <meshStandardMaterial
          color={currentDamageColorRef.current}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Head - Crystal-like Octahedron */}
      <mesh
        position={[0, unitHeight * 1, 0]}
        castShadow
      >
        <octahedronGeometry args={[unitBaseRadius * 0.6, 0]} />
        <meshStandardMaterial
          color={currentDamageColorRef.current.clone().multiplyScalar(1.2)}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Shoulders - Crystal spheres */}
      {[-1, 1].map((side) => (
        <mesh
          key={`shoulder-${side}`}
          position={[side * unitBaseRadius * 1.2, unitHeight * 0.9, 0]}
          castShadow
        >
          <sphereGeometry args={[unitBaseRadius * 0.4, 8, 8]} />
          <meshStandardMaterial
            color={currentDamageColorRef.current.clone().multiplyScalar(1.1)}
            metalness={0.7}
            roughness={0.3}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}


      {/* Energy Arms - Crystal cylinders */}
      {[-1, 1].map((side) => (
        <mesh
          key={`arm-${side}`}
          position={[side * unitBaseRadius * 1.4, unitHeight * 0.7, side * unitBaseRadius * 0.1]}
          rotation={[0, 0, side * 0.3]}
          castShadow
        >
          <cylinderGeometry args={[unitBaseRadius * 0.25, unitBaseRadius * 0.15, unitHeight * 0.3, 6]} />
          <meshStandardMaterial
            color={currentDamageColorRef.current.clone().multiplyScalar(0.9)}
            metalness={0.6}
            roughness={0.4}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}



      {/* Energy Aura - Crystal glow effect */}
      <mesh position={[0, unitHeight * 0.75, 0]}>
        <sphereGeometry args={[unitBaseRadius * 1.675, 8, 8]} />
        <meshBasicMaterial
          color={currentDamageColorRef.current}
          transparent
          opacity={opacity * 0.3}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Health Bar */}
      {!isDead && (
        <group position={[0, unitHeight + 0.8, 0]}>
          {/* Health Bar Background */}
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.85, 0.15]} />
            <meshBasicMaterial color={0x333333} transparent opacity={0.8} />
          </mesh>

          {/* Health Bar Fill */}
          <mesh
            ref={healthBarRef}
            position={[-(0.85 * (1 - healthPercentage)) / 2, 0.01, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[healthPercentage, 1, 1]}
          >
            <planeGeometry args={[0.85, 0.12]} />
            <meshBasicMaterial
              ref={healthBarMaterialRef}
              color={healthPercentage > 0.5 ? 0x00ff00 : healthPercentage > 0.25 ? 0xffff00 : 0xff0000}
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      )}

      {/* Death Effect */}
      {isDead && (
        <group>
          {/* Simple death particles */}
          <mesh position={[0, unitHeight * 0.4, 0]}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial
              color={0x666666}
              transparent
              opacity={0.1}
              wireframe
            />
          </mesh>
        </group>
      )}


    </group>
  );
}
