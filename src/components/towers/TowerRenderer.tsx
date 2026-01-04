'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3, Color, Group, Mesh, MeshBasicMaterial, AdditiveBlending, MathUtils } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Tower } from '@/ecs/components/Tower';
import ElementalVortex from '../enemies/ElementalVortex';

interface TowerRendererProps {
  entityId: number;
  world: World;
  position: Vector3;
  ownerId: string;
  ownerName: string;
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
  ownerName,
  towerIndex,
  health,
  maxHealth,
  isDead = false,
  color,
  camera
}: TowerRendererProps) {
  const groupRef = useRef<Group>(null);
  const healthBarRef = useRef<Group>(null);
  const healthBarFillRef = useRef<Mesh>(null);
  const timeRef = useRef(0);
  const isAttackingRef = useRef(false);
  const lastPositionRef = useRef(new Vector3());

  // Refs for orbital tendrils to prevent recreation every render
  const horizontalTendrilsRef = useRef<Group[]>([]);
  const verticalTendrilsRef = useRef<Group[]>([]);

  // Cached entity data to avoid repeated lookups
  const cachedEntityData = useRef({
    tower: null as any,
    lastEntityId: -1,
    lastTowerRange: 12
  });

  // Default colors for different players
  const playerColors = useMemo(() => [
    new Color("#4FC3F7"), // Blue - Elite color (Player 1)
    new Color("#FF6B6B"), // Brighter Red - matches pillar color (Player 2)
  ], []);

  const towerColor = color || playerColors[towerIndex % playerColors.length];

  // Calculate health-based opacity and color
  const healthPercentage = Math.max(0, health / maxHealth);
  const opacity = isDead ? 0.3 : Math.max(0.5, healthPercentage);

  // Get tower range from component (cached for performance)
  const towerRange = useMemo(() => {
    if (world && entityId && cachedEntityData.current.lastEntityId !== entityId) {
      const entity = world.getEntity(entityId);
      if (entity) {
        const towerComponent = entity.getComponent(Tower);
        if (towerComponent) {
          cachedEntityData.current.lastTowerRange = towerComponent.attackRange;
          cachedEntityData.current.lastEntityId = entityId;
          return towerComponent.attackRange;
        }
      }
    }
    return cachedEntityData.current.lastTowerRange;
  }, [world, entityId]);

  // Convert player color to hex for material colors
  const colorHex = towerColor.getHex();
  const emissiveHex = towerColor.clone().multiplyScalar(0.3).getHex();

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (groupRef.current) {
      // Only update position if it has changed
      if (!lastPositionRef.current.equals(position)) {
        groupRef.current.position.copy(position);
        lastPositionRef.current.copy(position);
      }

      // Check if tower is attacking (has target) - cached for performance
      const entity = world.getEntity(entityId);
      if (entity) {
        const tower = entity.getComponent(Tower);
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
      groupRef.current.position.y = position.y + Math.sin(timeRef.current * 2) * 0.1;

      // Only rotate when not attacking
      if (!isAttackingRef.current) {
        groupRef.current.rotation.y += delta * 0.5;
      }

      // Update health bar efficiently using cached ref
      if (healthBarRef.current && camera) {
        healthBarRef.current.lookAt(camera.position);

        // Use cached health bar fill ref instead of searching children
        if (healthBarFillRef.current) {
          // Update scale based on health percentage
          healthBarFillRef.current.scale.x = healthPercentage;

          // Position health bar to align left when scaling (using new width 2.4)
          healthBarFillRef.current.position.x = -(2.4 * (1 - healthPercentage)) / 2;

          // Update color based on health percentage
          const material = healthBarFillRef.current.material as MeshBasicMaterial;
          if (healthPercentage > 0.6) {
            material.color.setHex(0x00ff00); // Green
          } else if (healthPercentage > 0.3) {
            material.color.setHex(0xffff00); // Yellow
          } else {
            material.color.setHex(0xff0000); // Red
          }
        }
      }

      // Update orbital tendrils positions
      const radius = 0.92;
      const baseY = 2.875;

      // Horizontal tendrils
      horizontalTendrilsRef.current.forEach((tendril, i) => {
        if (tendril) {
          const angle = (i / 8) * Math.PI * 2 + timeRef.current * 1.2;
          const x = Math.cos(angle) * radius;
          const y = baseY + Math.sin(angle) * radius;
          const z = Math.cos(timeRef.current * 1.5 + i) * 0.2;

          tendril.position.set(x, y, z);
          tendril.rotation.set(Math.PI/2, angle + Math.PI, -Math.PI/2);
        }
      });

      // Vertical tendrils
      verticalTendrilsRef.current.forEach((tendril, i) => {
        if (tendril) {
          const angle = (i / 8) * Math.PI * 2 + timeRef.current * 1.2 + Math.PI / 8;
          const x = Math.cos(angle) * radius;
          const y = baseY + Math.sin(angle) * radius;
          const z = Math.cos(timeRef.current * 1.5 + i) * 0.2;

          tendril.position.set(x, y, z);
          tendril.rotation.set(Math.PI / 2, angle, 0);
        }
      });

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
      <ElementalVortex parentRef={groupRef} towerColor={towerColor} />

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

      {/* Energy tendrils orbital rings - Static refs for performance */}
      {[...Array(8)].map((_, i) => (
        <group
          key={`horizontal-${i}`}
          ref={el => {
            if (el && horizontalTendrilsRef.current[i] !== el) {
              horizontalTendrilsRef.current[i] = el;
            }
          }}
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
      ))}

      {/* Vertical Energy tendrils - Static refs for performance */}
      {[...Array(8)].map((_, i) => (
        <group
          key={`vertical-${i}`}
          ref={el => {
            if (el && verticalTendrilsRef.current[i] !== el) {
              verticalTendrilsRef.current[i] = el;
            }
          }}
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
      ))}

      {/* Point light for glow effect */}
      <pointLight
        color={colorHex}
        position={[0, 1.725, 0]}
        intensity={0.5}
        distance={3.45}
        decay={2}
      />


      {/* Detailed Health Bar with Nameplate - Always visible for towers */}
      <group ref={healthBarRef}>
        {/* Player Name in Panel */}
        <Html
          position={[0, 5.65, 0]}
          center
          transform={false}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            width: '80px',
            height: '25px',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(26, 26, 26, 0.95)',
            border: '0px solid rgba(68, 68, 68, 0.8)',
            borderRadius: '0px',
            padding: '4px 4px',
            boxSizing: 'border-box'
          }}>
            <div style={{
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.9)',
              lineHeight: '1.2'
            }}>
              {ownerName}
            </div>
          </div>
        </Html>

        {/* Health bar background - metallic style */}
        <mesh position={[0, 4.8, -0.01]}>
          <planeGeometry args={[2.4, 0.28]} />
          <meshBasicMaterial
            color={0x3c3c46}
            transparent
            opacity={0.95}
            depthWrite={true}
          />
        </mesh>

        {/* Health bar fill */}
        <mesh ref={healthBarFillRef} position={[0, 4.8, 0]}>
          <planeGeometry args={[2.4, 0.28]} />
          <meshBasicMaterial
            color={
              healthPercentage > 0.6 ? 0x00ff00 :
              healthPercentage > 0.3 ? 0xffff00 : 0xff0000
            }
            transparent
            opacity={0.95}
            depthWrite={true}
          />
        </mesh>

        {/* Health bar border - metallic style similar to GameUI */}
        <mesh position={[0, 4.8, 0.01]}>
          <planeGeometry args={[2.4, 0.28]} />
          <meshBasicMaterial
            color={0xc8c8dc}
            transparent
            opacity={0.5}
            depthWrite={true}
            wireframe
          />
        </mesh>

        {/* Health bar border highlight - top edge */}
        <mesh position={[0, 4.8 + 0.14, 0.02]}>
          <planeGeometry args={[2.4, 0.01]} />
          <meshBasicMaterial
            color={0xffffff}
            transparent
            opacity={0.3}
            depthWrite={true}
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
