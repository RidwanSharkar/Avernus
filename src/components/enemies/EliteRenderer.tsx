import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, MathUtils, AdditiveBlending, Color } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import ElementalVortex from './ElementalVortex';

interface EliteRendererProps {
  entityId: number;
  position: Vector3;
  world: World;
  onMeshReady?: (mesh: Group) => void;
}

export default function EliteRenderer({ 
  entityId, 
  position, 
  world,
  onMeshReady
}: EliteRendererProps) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const isAttackingRef = useRef(false);

  useFrame((_, delta) => {
    timeRef.current += delta;
    
    if (groupRef.current) {
      // Update position from ECS
      groupRef.current.position.copy(position);
      
      // Check if enemy is attacking (you can expand this logic based on your combat system)
      const entity = world.getEntity(entityId);
      if (entity) {
        const enemy = entity.getComponent(Enemy);
        if (enemy) {
          // Simple attack detection - you can enhance this based on your combat system
          const currentTime = Date.now() / 1000;
          const timeSinceLastAttack = currentTime - enemy.lastAttackTime;
          
          // Show attack animation if recently attacked OR do periodic demo attacks
          const isRecentlyAttacked = timeSinceLastAttack < 0.5;
          const isDemoAttacking = Math.sin(timeRef.current * 0.5) > 0.7; // Periodic demo attacks
          
          isAttackingRef.current = isRecentlyAttacked || isDemoAttacking;
        }
      }
      
      // Gentle floating animation
      groupRef.current.position.y += Math.sin(timeRef.current * 2) * 0.1;
      
      // Only rotate when not attacking (parent will handle facing target when attacking)
      if (!isAttackingRef.current) {
        groupRef.current.rotation.y += delta * 0.5;
      }
      
      // Left arm attack animation - similar to Death Knight
      const leftArm = groupRef.current.getObjectByName('LeftArm') as Mesh;
      if (leftArm) {
        if (isAttackingRef.current) {
          // Raise left arm for spell casting (similar to Death Knight Frost Strike)
          const targetRotation = -Math.PI / 3; // Raise arm up for casting
          const currentRotation = leftArm.rotation.x;
          const lerpFactor = 8 * delta; // Fast animation speed
          
          leftArm.rotation.x = MathUtils.lerp(currentRotation, targetRotation, lerpFactor);
          leftArm.rotation.z = MathUtils.lerp(leftArm.rotation.z, 0.2, lerpFactor); // Slight outward rotation
        } else {
          // Return to neutral position
          const currentRotation = leftArm.rotation.x;
          const currentZ = leftArm.rotation.z;
          const lerpFactor = 6 * delta; // Slightly slower return
          
          leftArm.rotation.x = MathUtils.lerp(currentRotation, 0, lerpFactor);
          leftArm.rotation.z = MathUtils.lerp(currentZ, 0, lerpFactor);
        }
      }
    }
  });

  useEffect(() => {
    if (groupRef.current && onMeshReady) {
      onMeshReady(groupRef.current);
    }
  }, [onMeshReady]);

  return (
    <group ref={groupRef}>
      {/* Main body - ice crystal structure */}
      <mesh position={[0, 2.0, 0]}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          color="#4FC3F7"
          emissive="#29B6F6"
          emissiveIntensity={0.3}
          transparent
          opacity={0.9}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.7, 0]}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color="#81D4FA"
          emissive="#4FC3F7"
          emissiveIntensity={0.4}
          transparent
          opacity={0.85}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Left Shoulder */}
      <mesh position={[-0.7, 2.35, 0]}>
        <sphereGeometry args={[0.325, 16, 16]} />
        <meshStandardMaterial
          color="#81D4FA"
          emissive="#4FC3F7"
          emissiveIntensity={0.3}
          transparent
          opacity={0.85}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Left Shoulder Ring */}
      <mesh position={[-0.7, 2.35, 0]} rotation={[Math.PI / 2, -Math.PI / 4, 0]}>
        <torusGeometry args={[0.4, 0.05, 8, 16]} />
        <meshStandardMaterial
          color="#E1F5FE"
          emissive="#B3E5FC"
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Left Arm - animated for attacks */}
      <mesh 
        name="LeftArm"
        position={[-0.7, 2.0, 0.2]} 
        rotation={[0, 0, 0]} // Default down position
      >
        <cylinderGeometry args={[0.15, 0.15, 1.0, 6]} />
        <meshStandardMaterial
          color="#4FC3F7"
          emissive="#29B6F6"
          emissiveIntensity={0.2}
          transparent
          opacity={0.675}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Right Shoulder */}
      <mesh position={[0.7, 2.35, 0]}>
        <sphereGeometry args={[0.325, 16, 16]} />
        <meshStandardMaterial
          color="#81D4FA"
          emissive="#4FC3F7"
          emissiveIntensity={0.3}
          transparent
          opacity={0.85}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Right Shoulder Ring */}
      <mesh position={[0.7, 2.35, 0]} rotation={[Math.PI / 2,  Math.PI / 4, 0]}>
        <torusGeometry args={[0.4, 0.05, 8, 16]} />
        <meshStandardMaterial
          color="#E1F5FE"
          emissive="#B3E5FC"
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Right Arm - stays down */}
      <mesh position={[0.7, 2.0, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1.0, 6]} />
        <meshStandardMaterial
          color="#4FC3F7"
          emissive="#29B6F6"
          emissiveIntensity={0.2}
          transparent
          opacity={0.675}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Water aura effect */}
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[1.35, 16, 16]} />
        <meshStandardMaterial
          color="#29B6F6"
          emissive="#0277BD"
          emissiveIntensity={0.1}
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Constant subtle elemental vortex - always visible */}
      <ElementalVortex parentRef={groupRef} towerColor={new Color("#4FC3F7")} />

      {/* Attack animation - ice spikes when attacking */}
      {isAttackingRef.current && (
        <>
          <mesh position={[0, 2.2, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.1, 0.8, 6]} />
            <meshStandardMaterial
              color="#E1F5FE"
              emissive="#81D4FA"
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          
          <mesh position={[0.5, 2.2, 1.3]} rotation={[Math.PI / 2, 0, Math.PI / 6]}>
            <coneGeometry args={[0.08, 0.6, 6]} />
            <meshStandardMaterial
              color="#E1F5FE"
              emissive="#81D4FA"
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          
          <mesh position={[-0.5, 2.2, 1.3]} rotation={[Math.PI / 2, 0, -Math.PI / 6]}>
            <coneGeometry args={[0.08, 0.6, 6]} />
            <meshStandardMaterial
              color="#E1F5FE"
              emissive="#81D4FA"
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        </>
      )}

      {/* Horizontal Icicle Orbital Ring (XZ plane) */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + timeRef.current * 1.2;
        const radius = 0.8;
        const x = Math.cos(angle) * radius;
        const y = 2.5 + Math.sin(angle) * radius; // Vertical orbital motion
        const z = Math.cos(timeRef.current * 1.5 + i) * 0.2; // Slight Z variation

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
              <coneGeometry args={[0.075, 0.3, 6]} />
              <meshStandardMaterial
                color="#CCFFFF"
                emissive="#CCFFFF"
                emissiveIntensity={0.8}
                transparent
                opacity={1.0}
              />
            </mesh>
          </group>
        );
      })}

      {/* Vertical Icicle Orbital Ring (XY plane) - Perpendicular to horizontal */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + timeRef.current * 1.2 + Math.PI / 8; // Slight offset
        const radius = 0.8;
        const x = Math.cos(angle) * radius;
        const y = 2.5 + Math.sin(angle) * radius; // Vertical orbital motion
        const z = Math.cos(timeRef.current * 1.5 + i) * 0.2; // Slight Z variation

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
            <coneGeometry args={[0.075, 0.3, 6]} />
              <meshStandardMaterial
                color="#AAEEFF"
                emissive="#AAEEFF"
                emissiveIntensity={0.8}
                transparent
                opacity={1.0}
              />
            </mesh>
          </group>
        );
      })}

      {/* Point light for glow effect */}
      <pointLight
        color="#4FC3F7"
        intensity={0.5}
        distance={3}
        decay={2}
      />
    </group>
  );
}
