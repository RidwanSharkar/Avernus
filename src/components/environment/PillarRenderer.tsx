'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, CylinderGeometry, SphereGeometry, MeshStandardMaterial, PointLight } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Pillar } from '@/ecs/components/Pillar';

interface PillarRendererProps {
  entityId: number;
  world: World;
  position: Vector3;
  ownerId: string;
  pillarIndex: number;
  playerIndex?: number;
  health: number;
  maxHealth: number;
  isDead?: boolean;
  color?: Color;
  camera?: any;
}

export default function PillarRenderer({
  entityId,
  world,
  position,
  ownerId,
  pillarIndex,
  playerIndex = 0,
  health,
  maxHealth,
  isDead = false,
  color,
  camera
}: PillarRendererProps) {
  const groupRef = useRef<Group>(null);
  const healthBarRef = useRef<Group>(null);
  const energySphereRef = useRef<Mesh>(null);

  // Default colors for different players
  const playerColors = useMemo(() => [
    new Color("#4FC3F7"), // Blue - Elite color (Player 1)
    new Color("#FF4646"), // Orange/Red Fire theme (Player 2)
  ], []);

  // Use playerIndex to get consistent color for all pillars of the same player
  // Player 1 (index 0) = blue, Player 2 (index 1) = red
  const pillarColor = color || playerColors[playerIndex % playerColors.length];

  // Health bar dimensions
  const healthBarWidth = 2;
  const healthBarHeight = 0.2;
  const healthBarY = 3.25; // Above the pillar

  // Create geometries and materials only once using useMemo
  const { pillarGeometries, materials } = useMemo(() => {
    // Base geometry
    const baseGeometry = new CylinderGeometry(2, 2.2, 1, 8);

    // Main column geometry
    const columnGeometry = new CylinderGeometry(1.5, 1.5, 8, 8);

    // Top geometry (decorative cap)
    const topGeometry = new CylinderGeometry(2.2, 2, 1, 8);

    // Shared material for all parts
    const stoneMaterial = new MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.7,
      metalness: 0.2,
    });

    // Add sphere geometry for the orb
    const orbGeometry = new SphereGeometry(1, 32, 32);

    // Add glowing material for the orb with player color
    const orbMaterial = new MeshStandardMaterial({
      color: pillarColor,
      emissive: pillarColor,
      metalness: 1,
      roughness: 0.2,
    });

    // Energy sphere surrounding the pillar (only for owned pillars)
    const energySphereGeometry = new SphereGeometry(1, 16, 16);
    const energySphereMaterial = new MeshStandardMaterial({
      color: pillarColor,
      emissive: pillarColor.clone().multiplyScalar(0.3),
      transparent: true,
      opacity: 0.125,
      metalness: 0.8,
      roughness: 0.2,
    });

    return {
      pillarGeometries: {
        base: baseGeometry,
        column: columnGeometry,
        top: topGeometry,
        orb: orbGeometry,
        energySphere: energySphereGeometry,
      },
      materials: {
        stone: stoneMaterial,
        orb: orbMaterial,
        energySphere: energySphereMaterial,
      }
    };
  }, [pillarColor]);

  // rotation animation for the orb
  const [rotation, setRotation] = React.useState(0);

  React.useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      setRotation(prev => (prev + 0.02) % (Math.PI * 2));
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // cleanup
  React.useEffect(() => {
    return () => {
      Object.values(pillarGeometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [pillarGeometries, materials]);

  useFrame((state, delta) => {
    // Update health bar to always face camera
    if (healthBarRef.current && camera) {
      healthBarRef.current.lookAt(camera.position);
    }

    // Pulse the energy sphere
    if (energySphereRef.current && ownerId) {
      const time = state.clock.getElapsedTime();
      const pulseScale = 1 + Math.sin(time * 2) * 0.05; // Subtle pulsing
      energySphereRef.current.scale.setScalar(pulseScale);
    }
  });

  if (isDead) {
    return null; // Don't render destroyed pillars
  }

  const healthPercent = Math.max(0, Math.min(1, health / maxHealth));

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Pillar Visual */}
      <group scale={[0.325, 0.325, 0.325]}>
        {/* Base */}
        <mesh
          geometry={pillarGeometries.base}
          material={materials.stone}
          position={[0, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Main column */}
        <mesh
          geometry={pillarGeometries.column}
          material={materials.stone}
          position={[0, 0.25, 0]}
          castShadow
          receiveShadow
        />

        {/* Top */}
        <mesh
          geometry={pillarGeometries.top}
          material={materials.stone}
          position={[0, 3, 0]}
          castShadow
          receiveShadow
        />

        {/* Floating orb */}
        <mesh
          geometry={pillarGeometries.orb}
          material={materials.orb}
          position={[0, 5, 0]}
          rotation={[rotation, rotation, 0]}
        >
          <pointLight color={pillarColor} intensity={0.25} distance={5} />
        </mesh>
      </group>

      {/* Energy Sphere surrounding owned pillars */}
      {ownerId && (
        <mesh
          ref={energySphereRef}
          geometry={pillarGeometries.energySphere}
          material={materials.energySphere}
          position={[0, 1.65, 0]}
          scale={[1, 1, 1]}
        >
          <pointLight
            color={pillarColor}
            intensity={3.5}
            distance={12}
            decay={1.5}
          />
        </mesh>
      )}

      {/* Health Bar */}
      <group ref={healthBarRef} position={[0, healthBarY, 0]}>
        {/* Background */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[healthBarWidth, healthBarHeight]} />
          <meshBasicMaterial color="#333333" transparent opacity={0.8} />
        </mesh>

        {/* Health fill */}
        <mesh position={[-(healthBarWidth * (1 - healthPercent)) / 2, 0, 0.01]}>
          <planeGeometry args={[healthBarWidth * healthPercent, healthBarHeight * 0.8]} />
          <meshBasicMaterial
            color={healthPercent > 0.6 ? "#00ff00" : healthPercent > 0.3 ? "#ffff00" : "#ff0000"}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Border */}
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[healthBarWidth, healthBarHeight]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
        </mesh>
      </group>
    </group>
  );
}
