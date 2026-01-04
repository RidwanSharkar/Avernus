'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, OctahedronGeometry, SphereGeometry, CylinderGeometry, AdditiveBlending, MathUtils } from '@/utils/three-exports';
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
  const healthBarRef = useRef<Group>(null);
  const healthBarFillRef = useRef<Mesh>(null);
  const healthBarGlowRef = useRef<Mesh>(null);

  // Unit dimensions (simple and small to maintain framerate)
  const unitHeight = 1.2;
  const unitBaseRadius = 0.3;

  // Health bar dimensions (scaled down for units)
  const healthBarWidth = 0.85;
  const healthBarHeight = 0.12;
  const healthBarY = unitHeight + 0.8; // Above the unit
  const healthBarBorderWidth = 0.02;

  // Memoized geometries to prevent recreation every frame
  const geometries = useMemo(() => ({
    body: new OctahedronGeometry(unitBaseRadius * 1.25, 0),
    head: new OctahedronGeometry(unitBaseRadius * 0.6, 0),
    shoulder: new SphereGeometry(unitBaseRadius * 0.4, 8, 8),
    arm: new CylinderGeometry(unitBaseRadius * 0.25, unitBaseRadius * 0.15, unitHeight * 0.3, 6),
    energyAura: new SphereGeometry(unitBaseRadius * 1.675, 8, 8),
    healthBarBg: new PlaneGeometry(healthBarWidth, healthBarHeight),
    healthBarFill: new PlaneGeometry(healthBarWidth, healthBarHeight * 0.75),
    healthBarGlow: new PlaneGeometry(healthBarWidth + healthBarBorderWidth * 2, healthBarHeight + healthBarBorderWidth * 2),
    healthBarBorder: new PlaneGeometry(healthBarWidth + healthBarBorderWidth * 2, healthBarHeight + healthBarBorderWidth * 2),
    healthBarShadow: new PlaneGeometry(healthBarWidth * 0.98, healthBarHeight * 0.7),
    healthBarHighlight: new PlaneGeometry(healthBarWidth * 0.98, healthBarHeight * 0.15),
    healthBarHighlightTop: new PlaneGeometry(healthBarWidth * 0.98, healthBarHeight * 0.15),
    healthBarOuterHighlight: new PlaneGeometry(healthBarWidth + healthBarBorderWidth * 2, healthBarHeight + healthBarBorderWidth * 2),
    deathEffect: new SphereGeometry(1, 6, 4),
  }), []);

  // Memoized materials to prevent recreation every frame
  const healthBarMaterials = useMemo(() => ({
    fill: new MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      vertexColors: true
    }),
    glow: new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
    }),
    background: new MeshBasicMaterial({
      color: "#2a2a2a",
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
    border: new MeshBasicMaterial({
      color: "#1a1a1a",
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
    shadow: new MeshBasicMaterial({
      color: "#1a1a1a",
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
    highlight: new MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
    borderHighlight: new MeshBasicMaterial({
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  }), []);

  // Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      // Dispose geometries
      Object.values(geometries).forEach(geometry => {
        geometry.dispose();
      });
      // Dispose materials
      Object.values(healthBarMaterials).forEach(material => {
        material.dispose();
      });
    };
  }, [geometries, healthBarMaterials]);

  // Smooth health interpolation state
  const lerpState = useRef({
    currentHealth: health,
    lastHealth: health
  });

  // Sync lerpState when health prop changes significantly (e.g., on mount with different value)
  useEffect(() => {
    const healthDiff = Math.abs(health - lerpState.current.currentHealth);
    // If health differs significantly, sync immediately (handles initial mount with wrong value)
    if (healthDiff > maxHealth * 0.1) {
      lerpState.current.currentHealth = health;
      lerpState.current.lastHealth = health;
    }
  }, [health, maxHealth]);

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

    // Player 1 = Light Blue, Player 2 = Fire Red
    if (effectivePlayerNumber === 1) {
      console.log(`SummonedUnitRenderer: using LIGHT BLUE color for player ${effectivePlayerNumber}`);
      return new Color(0x4444FF); // Light Blue
    } else {
      console.log(`SummonedUnitRenderer: using FIRE RED color for player ${effectivePlayerNumber}`);
      return new Color(0xFF4444); // Fire Red
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

    // Smoothly interpolate health changes
    const lerpSpeed = 8;
    const healthDiff = health - lerpState.current.currentHealth;

    // Handle large jumps (like respawn or massive damage) without lerping
    if (Math.abs(healthDiff) > maxHealth * 0.3) {
      lerpState.current.currentHealth = health;
    } else {
      lerpState.current.currentHealth += (health - lerpState.current.currentHealth) * Math.min(1, deltaTime * lerpSpeed);
    }

    // Update health bar to always face camera
    if (healthBarRef.current && state.camera) {
      healthBarRef.current.lookAt(state.camera.position);
    }

    // Update health bar visuals
    const currentHealthPercent = Math.max(0, Math.min(1, lerpState.current.currentHealth / maxHealth));

    if (healthBarFillRef.current) {
      // Update health bar scale - ensure it's always set correctly
      // Use setScalar to ensure y and z scales remain 1
      healthBarFillRef.current.scale.set(currentHealthPercent, 1, 1);
      // Position to align left when scaling
      healthBarFillRef.current.position.x = -(healthBarWidth * (1 - currentHealthPercent)) / 2;

      // Update color based on health with smooth transitions
      const material = healthBarFillRef.current.material as MeshBasicMaterial;
      let targetColor: Color;

      if (currentHealthPercent > 0.6) {
        // High health: Use player color with slight green tint
        targetColor = unitColor.clone().lerp(new Color(0x00ff88), 0.3);
      } else if (currentHealthPercent > 0.3) {
        // Medium health: Blend player color with yellow
        const t = (currentHealthPercent - 0.3) / 0.3;
        targetColor = unitColor.clone().lerp(new Color(0xffff00), 0.5 - t * 0.3);
      } else {
        // Low health: Blend player color with red, with pulsing effect
        const t = currentHealthPercent / 0.3;
        const pulseIntensity = 0.3 + Math.sin(time * 4) * 0.2;
        targetColor = unitColor.clone().lerp(new Color(0xff4444), 0.6 - t * 0.3);
        targetColor.multiplyScalar(1 + pulseIntensity);
      }

      // Smooth color transition
      material.color.lerp(targetColor, deltaTime * 5);

      // Adjust opacity for glow effect that intensifies with health
      const glowIntensity = 0.85 + currentHealthPercent * 0.15;
      material.opacity = glowIntensity;
    }

    // Update glow effect behind health bar
    if (healthBarGlowRef.current) {
      const glowMaterial = healthBarGlowRef.current.material as MeshBasicMaterial;
      const glowIntensity = currentHealthPercent * 0.4;
      const glowColor = unitColor.clone().multiplyScalar(glowIntensity);
      glowMaterial.color.copy(glowColor);
      glowMaterial.opacity = glowIntensity * 0.6;

      // Pulse glow when health is low
      if (currentHealthPercent < 0.3) {
        const pulse = 0.3 + Math.sin(time * 5) * 0.2;
        glowMaterial.opacity = pulse * 0.6;
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
        geometry={geometries.body}
      >
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
        geometry={geometries.head}
      >
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
          geometry={geometries.shoulder}
        >
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
          geometry={geometries.arm}
        >
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
      <mesh position={[0, unitHeight * 0.75, 0]} geometry={geometries.energyAura}>
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
        <group ref={healthBarRef} position={[0, healthBarY, 0]}>
          {/* Outer glow effect (behind everything) */}
          <mesh ref={healthBarGlowRef} position={[0, 0, -0.01]} geometry={geometries.healthBarGlow}>
            <meshBasicMaterial
              color={unitColor}
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </mesh>

          {/* Outer border (dark) */}
          <mesh position={[0, 0, 0.001]} geometry={geometries.healthBarBorder}>
            <meshBasicMaterial
              color="#1a1a1a"
              transparent
              opacity={0.9}
              depthWrite={false}
            />
          </mesh>

          {/* Background (slightly rounded appearance) */}
          <mesh position={[0, 0, 0.002]} geometry={geometries.healthBarBg}>
            <meshBasicMaterial
              attach="material"
              color="#2a2a2a"
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>

          {/* Inner shadow/depth effect */}
          <mesh position={[0, 0, 0.003]} geometry={geometries.healthBarShadow}>
            <meshBasicMaterial
              attach="material"
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
            geometry={geometries.healthBarFill}
            material={healthBarMaterials.fill}
          />

          {/* Top highlight for depth */}
          <mesh position={[0, healthBarHeight * 0.25, 0.005]} geometry={geometries.healthBarHighlight}>
            <meshBasicMaterial
              attach="material"
              color="#ffffff"
              transparent
              opacity={0.2}
              depthWrite={false}
            />
          </mesh>

          {/* Outer border highlight */}
          <mesh position={[0, 0, 0.006]} geometry={geometries.healthBarOuterHighlight}>
            <meshBasicMaterial
              attach="material"
              color={unitColor}
              transparent
              opacity={0.4}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* Death Effect */}
      {isDead && (
        <group>
          {/* Simple death particles */}
          <mesh position={[0, unitHeight * 0.4, 0]} geometry={geometries.deathEffect}>
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
