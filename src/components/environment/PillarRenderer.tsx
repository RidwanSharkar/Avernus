'use client';

import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, CylinderGeometry, SphereGeometry, MeshStandardMaterial, PointLight, PlaneGeometry, MeshBasicMaterial } from '@/utils/three-exports';
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
  const healthBarFillRef = useRef<Mesh>(null);
  const healthBarGlowRef = useRef<Mesh>(null);
  
  // Smooth health interpolation state
  const lerpState = useRef({
    currentHealth: health,
    lastHealth: health
  });

  // Default colors for different players
  const playerColors = useMemo(() => [
    new Color("#4FC3F7"), // Blue - Elite color (Player 1)
    new Color("#FF4646"), // Orange/Red Fire theme (Player 2)
  ], []);

  // Use playerIndex to get consistent color for all pillars of the same player
  // Player 1 (index 0) = blue, Player 2 (index 1) = red
  const pillarColor = color || playerColors[playerIndex % playerColors.length];

  // Health bar dimensions
  const healthBarWidth = 2.4;
  const healthBarHeight = 0.18;
  const healthBarY = 3.25; // Above the pillar
  const healthBarBorderWidth = 0.04;

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
    // Smoothly interpolate health changes
    const lerpSpeed = 8;
    const healthDiff = health - lerpState.current.currentHealth;
    
    // Handle large jumps (like respawn or massive damage) without lerping
    if (Math.abs(healthDiff) > maxHealth * 0.3) {
      lerpState.current.currentHealth = health;
    } else {
      lerpState.current.currentHealth += (health - lerpState.current.currentHealth) * Math.min(1, delta * lerpSpeed);
    }
    
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
    
    // Update health bar visuals
    const currentHealthPercent = Math.max(0, Math.min(1, lerpState.current.currentHealth / maxHealth));
    
    if (healthBarFillRef.current) {
      // Update health bar scale
      healthBarFillRef.current.scale.x = currentHealthPercent;
      // Position to align left when scaling
      healthBarFillRef.current.position.x = -(healthBarWidth * (1 - currentHealthPercent)) / 2;
      
      // Update color based on health with smooth transitions
      const material = healthBarFillRef.current.material as MeshBasicMaterial;
      let targetColor: Color;
      
      if (currentHealthPercent > 0.6) {
        // High health: Use player color with slight green tint
        targetColor = pillarColor.clone().lerp(new Color(0x00ff88), 0.3);
      } else if (currentHealthPercent > 0.3) {
        // Medium health: Blend player color with yellow
        const t = (currentHealthPercent - 0.3) / 0.3;
        targetColor = pillarColor.clone().lerp(new Color(0xffff00), 0.5 - t * 0.3);
      } else {
        // Low health: Blend player color with red, with pulsing effect
        const t = currentHealthPercent / 0.3;
        const pulseIntensity = 0.3 + Math.sin(state.clock.getElapsedTime() * 4) * 0.2;
        targetColor = pillarColor.clone().lerp(new Color(0xff4444), 0.6 - t * 0.3);
        targetColor.multiplyScalar(1 + pulseIntensity);
      }
      
      // Smooth color transition
      material.color.lerp(targetColor, delta * 5);
      
      // Adjust opacity for glow effect that intensifies with health
      const glowIntensity = 0.85 + currentHealthPercent * 0.15;
      material.opacity = glowIntensity;
    }
    
    // Update glow effect behind health bar
    if (healthBarGlowRef.current) {
      const glowMaterial = healthBarGlowRef.current.material as MeshBasicMaterial;
      const glowIntensity = currentHealthPercent * 0.4;
      const glowColor = pillarColor.clone().multiplyScalar(glowIntensity);
      glowMaterial.color.copy(glowColor);
      glowMaterial.opacity = glowIntensity * 0.6;
      
      // Pulse glow when health is low
      if (currentHealthPercent < 0.3) {
        const pulse = 0.3 + Math.sin(state.clock.getElapsedTime() * 5) * 0.2;
        glowMaterial.opacity = pulse * 0.6;
      }
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
        {/* Outer glow effect (behind everything) */}
        <mesh ref={healthBarGlowRef} position={[0, 0, -0.01]}>
          <planeGeometry args={[healthBarWidth + healthBarBorderWidth * 2, healthBarHeight + healthBarBorderWidth * 2]} />
          <meshBasicMaterial 
            color={pillarColor} 
            transparent 
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
        
        {/* Outer border (dark) */}
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[healthBarWidth + healthBarBorderWidth * 2, healthBarHeight + healthBarBorderWidth * 2]} />
          <meshBasicMaterial 
            color="#1a1a1a" 
            transparent 
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
        
        {/* Background (slightly rounded appearance) */}
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[healthBarWidth, healthBarHeight]} />
          <meshBasicMaterial 
            color="#2a2a2a" 
            transparent 
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
        
        {/* Inner shadow/depth effect */}
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[healthBarWidth * 0.98, healthBarHeight * 0.7]} />
          <meshBasicMaterial 
            color="#1a1a1a" 
            transparent 
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>

        {/* Health fill with glow */}
        <mesh 
          ref={healthBarFillRef}
          position={[0, 0, 0.004]}
        >
          <planeGeometry args={[healthBarWidth, healthBarHeight * 0.75]} />
          <meshBasicMaterial
            color={pillarColor.clone().lerp(new Color(0x00ff88), 0.3)}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
        
        {/* Top highlight for depth */}
        <mesh position={[0, healthBarHeight * 0.25, 0.005]}>
          <planeGeometry args={[healthBarWidth * 0.98, healthBarHeight * 0.15]} />
          <meshBasicMaterial 
            color="#ffffff" 
            transparent 
            opacity={0.2}
            depthWrite={false}
          />
        </mesh>

        {/* Outer border highlight */}
        <mesh position={[0, 0, 0.006]}>
          <planeGeometry args={[healthBarWidth + healthBarBorderWidth * 2, healthBarHeight + healthBarBorderWidth * 2]} />
          <meshBasicMaterial 
            color={pillarColor} 
            transparent 
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
