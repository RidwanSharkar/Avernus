'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, MeshBasicMaterial, AdditiveBlending, MathUtils } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Tower } from '@/ecs/components/Tower';

interface TowerRendererProps {
  entityId: number;
  world: World;
  position: Vector3;
  ownerId: string;
  towerIndex: number;
  health: number;
  maxHealth: number;
  isDead?: boolean;
  color?: Color;
  camera?: any;
}

export default function TowerRenderer({
  entityId,
  world,
  position,
  ownerId,
  towerIndex,
  health,
  maxHealth,
  isDead = false,
  color,
  camera
}: TowerRendererProps) {
  const groupRef = useRef<Group>(null);
  const healthBarRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const isAttackingRef = useRef(false);

  // Default colors for different players
  const playerColors = useMemo(() => [
    new Color("#4FC3F7"), // Blue - Elite color (Player 1)
    new Color("#FF8C00"), // Orange/Red Fire theme (Player 2)
    new Color("#FF8A8A"), // Light Red (Player 3)
    new Color("#FFB3B3"), // Light Red (Player 4)
    new Color("#FFD6D6")  // Light Red (Player 5)
  ], []);

  const towerColor = color || playerColors[towerIndex % playerColors.length];

  // Calculate health-based opacity and color
  const healthPercentage = Math.max(0, health / maxHealth);
  const opacity = isDead ? 0.3 : Math.max(0.5, healthPercentage);

  // Get tower range from component
  let towerRange = 12; // Default range
  if (world && entityId) {
    const entity = world.getEntity(entityId);
    if (entity) {
      const towerComponent = entity.getComponent(Tower);
      if (towerComponent) {
        towerRange = towerComponent.attackRange;
      }
    }
  }

  // Convert player color to hex for material colors
  const colorHex = towerColor.getHex();
  const emissiveHex = towerColor.clone().multiplyScalar(0.3).getHex();

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (groupRef.current) {
      // Update position from props
      groupRef.current.position.copy(position);

      // Check if tower is attacking (has target)
      const entity = world.getEntity(entityId);
      if (entity) {
        const tower = entity.getComponent(Tower);
        // Show attack animation when tower has a current target
        isAttackingRef.current = tower ? tower.currentTarget != null : false;
      } else {
        isAttackingRef.current = false;
      }

      // Handle targeting rotation
      if (isAttackingRef.current && entity) {
        const tower = entity.getComponent(Tower);
        if (tower && tower.currentTarget) {
          const targetEntity = world.getEntity(tower.currentTarget);
          if (targetEntity) {
            const targetTransform = targetEntity.getComponent(Transform);
            if (targetTransform) {
              const direction = new Vector3();
              direction.copy(targetTransform.position);
              direction.sub(position);
              direction.y = 0;
              direction.normalize();

              const angle = Math.atan2(direction.x, direction.z);
              groupRef.current.rotation.y = angle;
            }
          }
        }
      }

      // Gentle floating animation
      groupRef.current.position.y += Math.sin(timeRef.current * 2) * 0.1;

      // Only rotate when not attacking
      if (!isAttackingRef.current) {
        groupRef.current.rotation.y += delta * 0.5;
      }

      // Update and show health bar
      if (healthBarRef.current && camera) {
        healthBarRef.current.lookAt(camera.position);

        // Update health bar scale and color
        const healthBarFill = healthBarRef.current.children[1] as Mesh; // Second child is the fill
        if (healthBarFill) {
          // Update scale based on health percentage
          healthBarFill.scale.x = healthPercentage;

          // Position health bar to align left when scaling
          healthBarFill.position.x = -(2.0 * (1 - healthPercentage)) / 2;

          // Update color based on health percentage
          const material = healthBarFill.material as MeshBasicMaterial;
          if (healthPercentage > 0.6) {
            material.color.setHex(0x00ff00); // Green
          } else if (healthPercentage > 0.3) {
            material.color.setHex(0xffff00); // Yellow
          } else {
            material.color.setHex(0xff0000); // Red
          }
        }
      }

      // Attack animation for "arms" (energy tendrils)
      const leftArm = groupRef.current.getObjectByName('LeftArm') as Mesh;
      if (leftArm) {
        if (isAttackingRef.current) {
          // Raise left arm for casting
          const targetRotation = -Math.PI / 3;
          const currentRotation = leftArm.rotation.x;
          const lerpFactor = 8 * delta;

          leftArm.rotation.x = MathUtils.lerp(currentRotation, targetRotation, lerpFactor);
          leftArm.rotation.z = MathUtils.lerp(leftArm.rotation.z, 0.2, lerpFactor);
        } else {
          // Return to neutral position
          const currentRotation = leftArm.rotation.x;
          const currentZ = leftArm.rotation.z;
          const lerpFactor = 6 * delta;

          leftArm.rotation.x = MathUtils.lerp(currentRotation, 0, lerpFactor);
          leftArm.rotation.z = MathUtils.lerp(currentZ, 0, lerpFactor);
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main body - crystal structure adapted for tower */}
      <mesh position={[0, 2.3, 0]}>
        <octahedronGeometry args={[0.92, 0]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.3}
          transparent
          opacity={0.9 * opacity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 3.105, 0]}>
        <octahedronGeometry args={[0.46, 0]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.4}
          transparent
          opacity={0.85 * opacity}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Left Shoulder */}
      <mesh position={[-0.805, 2.7025, 0]}>
        <sphereGeometry args={[0.37375, 16, 16]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.3}
          transparent
          opacity={0.85 * opacity}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Left Shoulder Ring */}
      <mesh position={[-0.805, 2.7025, 0]} rotation={[Math.PI / 2, -Math.PI / 4, 0]}>
        <torusGeometry args={[0.46, 0.0575, 8, 16]} />
        <meshStandardMaterial
          color={towerColor.clone().multiplyScalar(1.2).getHex()}
          emissive={towerColor.clone().multiplyScalar(0.6).getHex()}
          emissiveIntensity={0.5}
          transparent
          opacity={0.9 * opacity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Left Arm - animated for attacks */}
      <mesh
        name="LeftArm"
        position={[-0.805, 2.3, 0]}
        rotation={[0, 0, 0]}
      >
        <cylinderGeometry args={[0.1725, 0.1725, 1.15, 6]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.2}
          transparent
          opacity={0.675 * opacity}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Right Shoulder */}
      <mesh position={[0.805, 2.7025, 0]}>
        <sphereGeometry args={[0.37375, 16, 16]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.3}
          transparent
          opacity={0.85 * opacity}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Right Shoulder Ring */}
      <mesh position={[0.805, 2.7025, 0]} rotation={[Math.PI / 2,  Math.PI / 4, 0]}>
        <torusGeometry args={[0.46, 0.0575, 8, 16]} />
        <meshStandardMaterial
          color={towerColor.clone().multiplyScalar(1.2).getHex()}
          emissive={towerColor.clone().multiplyScalar(0.6).getHex()}
          emissiveIntensity={0.5}
          transparent
          opacity={0.9 * opacity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Right Arm - stays down */}
      <mesh position={[0.805, 2.3, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.1725, 0.1725, 1.15, 6]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.2}
          transparent
          opacity={0.675 * opacity}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Energy aura effect */}
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[1.6675, 16, 16]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.1}
          transparent
          opacity={0.4 * opacity}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Constant elemental vortex - adapted for tower */}
      

      {/* Attack animation - energy spikes when attacking */}
      {isAttackingRef.current && (
        <>
          <mesh position={[0, 2.53, 1.725]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.115, 0.92, 6]} />
            <meshStandardMaterial
              color={towerColor.clone().multiplyScalar(1.5).getHex()}
              emissive={towerColor.clone().multiplyScalar(0.8).getHex()}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          <mesh position={[0.575, 2.53, 1.495]} rotation={[Math.PI / 2, 0, Math.PI / 6]}>
            <coneGeometry args={[0.092, 0.69, 6]} />
            <meshStandardMaterial
              color={towerColor.clone().multiplyScalar(1.5).getHex()}
              emissive={towerColor.clone().multiplyScalar(0.8).getHex()}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          <mesh position={[-0.575, 2.53, 1.495]} rotation={[Math.PI / 2, 0, -Math.PI / 6]}>
            <coneGeometry args={[0.092, 0.69, 6]} />
            <meshStandardMaterial
              color={towerColor.clone().multiplyScalar(1.5).getHex()}
              emissive={towerColor.clone().multiplyScalar(0.8).getHex()}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        </>
      )}

      ELEMENTAL VORTEX

      {/* Energy tendrils orbital rings */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + timeRef.current * 1.2;
        const radius = 0.92;
        const x = Math.cos(angle) * radius;
        const y = 2.875 + Math.sin(angle) * radius;
        const z = Math.cos(timeRef.current * 1.5 + i) * 0.2;

        return (
          <group
            key={`horizontal-${i}`}
            position={[x, y, z]}
            rotation={[
              Math.PI/2,
              angle + Math.PI ,
              -Math.PI/2
            ]}
          >
            <mesh>
              <coneGeometry args={[0.08625, 0.345, 6]} />
              <meshStandardMaterial
                color={colorHex}
                emissive={emissiveHex}
                emissiveIntensity={0.8}
                transparent
                opacity={opacity}
              />
            </mesh>
          </group>
        );
      })}

      {/* Vertical Energy tendrils */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + timeRef.current * 1.2 + Math.PI / 8;
        const radius = 0.92;
        const x = Math.cos(angle) * radius;
        const y = 2.875 + Math.sin(angle) * radius;
        const z = Math.cos(timeRef.current * 1.5 + i) * 0.2;

        return (
          <group
            key={`vertical-${i}`}
            position={[x, y, z]}
            rotation={[
              Math.PI / 2,
              angle,
              0
            ]}
          >
            <mesh>
            <coneGeometry args={[0.08625, 0.345, 6]} />
              <meshStandardMaterial
                color={towerColor.clone().multiplyScalar(0.8).getHex()}
                emissive={towerColor.clone().multiplyScalar(0.4).getHex()}
                emissiveIntensity={0.8}
                transparent
                opacity={opacity}
              />
            </mesh>
          </group>
        );
      })}

      {/* Point light for glow effect */}
      <pointLight
        color={colorHex}
        position={[0, 1.725, 0]}
        intensity={0.5}
        distance={3.45}
        decay={2}
      />


      {/* Health Bar - Always visible for towers */}
      <group ref={healthBarRef}>
        {/* Health bar background */}
        <mesh position={[0, 4.5, 0]}>
          <planeGeometry args={[2.0, 0.15]} />
          <meshBasicMaterial
            color={0x333333}
            transparent
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>

        {/* Health bar fill */}
        <mesh position={[0, 4.5, 0.001]}>
          <planeGeometry args={[2.0, 0.15]} />
          <meshBasicMaterial
            color={
              healthPercentage > 0.6 ? 0x00ff00 :
              healthPercentage > 0.3 ? 0xffff00 : 0xff0000
            }
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Death Effect */}
      {isDead && (
        <group>
          <mesh position={[0, 2.3, 0]}>
            <sphereGeometry args={[2.3, 8, 8]} />
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
