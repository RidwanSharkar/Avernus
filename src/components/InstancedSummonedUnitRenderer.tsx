'use client';
// UNUSED-FOR TEST
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  Matrix4,
  Vector3,
  Color,
  CylinderGeometry,
  SphereGeometry,
  BoxGeometry,
  PlaneGeometry,
  OctahedronGeometry,
  TorusGeometry,
  ConeGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  AdditiveBlending
} from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { SummonedUnit } from '@/ecs/components/SummonedUnit';

// Shared geometries - based on SummonedUnitRenderer model for crystal-like appearance
const sharedGeometries = {
  // Main Body - Crystal-like Octahedron (larger than head)
  body: new OctahedronGeometry(0.375, 0), // unitBaseRadius * 1.25
  // Head - Crystal-like Octahedron
  head: new OctahedronGeometry(0.18, 0), // unitBaseRadius * 0.6
  // Shoulders - Crystal spheres
  shoulder: new SphereGeometry(0.12, 8, 8), // unitBaseRadius * 0.4
  // Shoulder Rings - Energy rings
  shoulderRing: new TorusGeometry(0.18, 0.01, 6, 12), // unitBaseRadius * 0.5, unitBaseRadius * 0.03
  // Energy Arms - Crystal cylinders
  arm: new CylinderGeometry(0.075, 0.06, 0.36, 6), // unitBaseRadius * 0.25, unitBaseRadius * 0.15, unitHeight * 0.3
  // Energy Tendrils - Orbiting crystal spikes (8 tendrils per unit)
  energyTendril: new ConeGeometry(0.024, 0.09, 4), // unitBaseRadius * 0.08, unitBaseRadius * 0.3
  // Energy Aura - Crystal glow effect
  energyAura: new SphereGeometry(0.525, 8, 8), // unitBaseRadius * 1.75
  // Health Bar components (scaled for units)
  healthBarBg: new PlaneGeometry(0.85, 0.12),
  healthBarFill: new PlaneGeometry(0.85, 0.09),
  // Death Effect
  deathEffect: new SphereGeometry(1, 6, 4),
  // Crystal Target Indicator
  targetIndicator: new TorusGeometry(0.36, 0.015, 8, 16) // unitBaseRadius * 1.2, unitBaseRadius * 0.05
};

// Shared materials - matching SummonedUnitRenderer crystal-like materials
const sharedMaterials = {
  // Main Body - Crystal-like with moderate metalness
  body: new MeshStandardMaterial({
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    vertexColors: true
  }),
  // Head - Brighter crystal-like material
  head: new MeshStandardMaterial({
    metalness: 0.8,
    roughness: 0.2,
    transparent: true,
    vertexColors: true
  }),
  // Shoulders - Crystal spheres
  shoulder: new MeshStandardMaterial({
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    vertexColors: true
  }),
  // Shoulder Rings - Energy rings with high metalness
  shoulderRing: new MeshStandardMaterial({
    metalness: 0.8,
    roughness: 0.2,
    transparent: true,
    vertexColors: true
  }),
  // Energy Arms - Crystal cylinders with energy appearance
  arm: new MeshStandardMaterial({
    metalness: 0.6,
    roughness: 0.4,
    transparent: true,
    vertexColors: true
  }),
  // Energy Tendrils - High metalness crystal spikes
  energyTendril: new MeshStandardMaterial({
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    vertexColors: true
  }),
  // Energy Aura - Glowing crystal effect
  energyAura: new MeshBasicMaterial({
    transparent: true,
    opacity: 0.3,
    vertexColors: true,
    depthWrite: false,
    blending: AdditiveBlending
  }),
  // Health Bar components (pillar-style)
  healthBarBg: new MeshBasicMaterial({
    color: "#2a2a2a",
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  }),
  healthBarFill: new MeshBasicMaterial({
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    vertexColors: true
  }),
  // Death Effect
  deathEffect: new MeshBasicMaterial({
    color: 0x666666,
    transparent: true,
    opacity: 0.1,
    wireframe: true
  }),
  // Crystal Target Indicator - Enhanced glow
  targetIndicator: new MeshBasicMaterial({
    transparent: true,
    opacity: 0.4,
    vertexColors: true,
    depthWrite: false,
    blending: AdditiveBlending
  })
};

interface UnitInstanceData {
  entityId: number;
  position: Vector3;
  color: Color;
  health: number;
  maxHealth: number;
  isDead: boolean;
  ownerId: string;
  lastUpdateTime: number;
}

interface InstancedSummonedUnitRendererProps {
  world: World;
  maxUnits?: number;
  summonedUnits?: Map<string, any>; // Optional server-authoritative summoned units
}

export default function InstancedSummonedUnitRenderer({
  world,
  maxUnits = 100,
  summonedUnits
}: InstancedSummonedUnitRendererProps) {
  // Refs for instanced meshes - matching SummonedUnitRenderer crystal model
  const bodyMeshRef = useRef<InstancedMesh>(null); // Main Body - Crystal-like Octahedron
  const headMeshRef = useRef<InstancedMesh>(null); // Head - Crystal-like Octahedron
  const leftShoulderMeshRef = useRef<InstancedMesh>(null); // Left Shoulder - Crystal sphere
  const rightShoulderMeshRef = useRef<InstancedMesh>(null); // Right Shoulder - Crystal sphere
  const leftShoulderRingMeshRef = useRef<InstancedMesh>(null); // Left Shoulder Ring - Energy ring
  const rightShoulderRingMeshRef = useRef<InstancedMesh>(null); // Right Shoulder Ring - Energy ring
  const leftArmMeshRef = useRef<InstancedMesh>(null); // Left Energy Arm - Crystal cylinder
  const rightArmMeshRef = useRef<InstancedMesh>(null); // Right Energy Arm - Crystal cylinder
  const energyTendrilsMeshRef = useRef<InstancedMesh>(null); // Energy Tendrils - 8 orbiting crystal spikes
  const energyAuraMeshRef = useRef<InstancedMesh>(null); // Energy Aura - Crystal glow effect
  const healthBarBgMeshRef = useRef<InstancedMesh>(null); // Health Bar Background
  const healthBarFillMeshRef = useRef<InstancedMesh>(null); // Health Bar Fill
  const deathEffectMeshRef = useRef<InstancedMesh>(null); // Death Effect
  const targetIndicatorMeshRef = useRef<InstancedMesh>(null); // Crystal Target Indicator

  // Unit instance data
  const unitInstances = useRef<Map<number, UnitInstanceData>>(new Map());
  const tempObject = useRef(new Object3D());
  const tempMatrix = useRef(new Matrix4());
  const tempColor = useRef(new Color());

  // Player color cache - match tower colors
  const playerColors = useMemo(() => [
    new Color("#4FC3F7"), // Blue - Elite color (Player 1)
    new Color("#FF8C00"), // Orange/Red Fire theme (Player 2)
    new Color("#FF8A8A"), // Light Red (Player 3)
    new Color("#FFB3B3"), // Light Red (Player 4)
    new Color("#FFD6D6")  // Light Red (Player 5)
  ], []);

  // Generate consistent color based on ownerId - Player 1 = Light Blue, Player 2 = Fire Red
  const getPlayerColor = useMemo(() => (ownerId: string): Color => {
    // Extract player number from ownerId (e.g., "player1" -> 1, "player2" -> 2)
    const playerMatch = ownerId.match(/player(\d+)/);
    if (playerMatch) {
      const playerNumber = parseInt(playerMatch[1]);
      // Player 1 = index 0 (Light Blue), Player 2 = index 1 (Fire Red)
      const index = playerNumber - 1; // Convert to 0-based index
      if (index >= 0 && index < playerColors.length) {
        return playerColors[index];
      }
    }
    // Fallback to first color if parsing fails
    return playerColors[0];
  }, [playerColors]);

  // Update unit instances from world state or server data
  const updateUnitInstances = useMemo(() => {
    return () => {
      const newInstances = new Map<number, UnitInstanceData>();

      if (summonedUnits) {
        // Use server-authoritative summoned units
        let unitId = 0;
        for (const unit of Array.from(summonedUnits.values())) {
          // Filter out dead or inactive units
          if (!unit.isActive || unit.isDead) continue;

          const unitData: UnitInstanceData = {
            entityId: unitId++,
            position: new Vector3(unit.position.x, unit.position.y, unit.position.z),
            color: getPlayerColor(unit.ownerId),
            health: unit.health,
            maxHealth: unit.maxHealth,
            isDead: unit.isDead,
            ownerId: unit.ownerId,
            lastUpdateTime: Date.now() / 1000
          };

          newInstances.set(unitData.entityId, unitData);
        }
      } else {
        // Fall back to ECS query
        const entities = world.queryEntities([Transform, SummonedUnit, Health]);

        for (const entity of entities) {
          const transform = entity.getComponent(Transform);
          const unit = entity.getComponent(SummonedUnit);
          const health = entity.getComponent(Health);

          if (!transform || !unit || !health) continue;

          // Skip units that are inactive or marked for destruction
          if (!unit.isActive && (unit.isDead || health.isDead)) continue;

          const unitData: UnitInstanceData = {
            entityId: entity.id,
            position: transform.position.clone(),
            color: getPlayerColor(unit.ownerId),
            health: health.currentHealth,
            maxHealth: health.maxHealth,
            isDead: health.isDead || unit.isDead,
            ownerId: unit.ownerId,
            lastUpdateTime: Date.now() / 1000
          };

          newInstances.set(entity.id, unitData);
        }
      }

      unitInstances.current = newInstances;
      return newInstances.size;
    };
  }, [world, getPlayerColor, summonedUnits]);

  // Calculate damage color and opacity
  const getUnitAppearance = (unit: UnitInstanceData) => {
    const healthPercentage = Math.max(0, unit.health / unit.maxHealth);
    const opacity = unit.isDead ? 0.3 : Math.max(0.5, healthPercentage);
    const damageColor = unit.isDead
      ? new Color(0x666666)
      : unit.color.clone().lerp(new Color(0xFF0000), 1 - healthPercentage);

    return { damageColor, opacity, healthPercentage };
  };

  // Update instanced meshes
  const updateInstancedMeshes = () => {
    const instances = Array.from(unitInstances.current.values());
    const count = Math.min(instances.length, maxUnits);

    if (count === 0) return;

    let bodyCount = 0;
    let headCount = 0;
    let shoulderCount = 0;
    let shoulderRingCount = 0;
    let armCount = 0;
    let energyTendrilsCount = 0;
    let energyAuraCount = 0;
    let healthBarBgCount = 0;
    let healthBarFillCount = 0;
    let deathEffectCount = 0;
    let targetIndicatorCount = 0;

    for (let i = 0; i < count; i++) {
      const unit = instances[i];
      const { damageColor, opacity, healthPercentage } = getUnitAppearance(unit);

      // Reset temp object position
      tempObject.current.position.copy(unit.position);
      tempObject.current.rotation.set(0, 0, 0);

      // Main Body - Crystal-like Octahedron
      if (bodyMeshRef.current) {
        tempObject.current.position.y += 0.8625; // unitHeight * 0.725
        tempObject.current.updateMatrix();
        bodyMeshRef.current.setMatrixAt(bodyCount, tempObject.current.matrix);
        bodyMeshRef.current.setColorAt(bodyCount, damageColor);
        bodyCount++;
      }

      // Head - Crystal-like Octahedron
      if (headMeshRef.current) {
        tempObject.current.position.set(
          unit.position.x,
          unit.position.y + 1.2, // unitHeight * 1
          unit.position.z
        );
        tempObject.current.updateMatrix();
        headMeshRef.current.setMatrixAt(headCount, tempObject.current.matrix);
        headMeshRef.current.setColorAt(headCount, damageColor.clone().multiplyScalar(1.2));
        headCount++;
      }

      // Shoulders - Crystal spheres
      if (leftShoulderMeshRef.current && rightShoulderMeshRef.current) {
        // Left shoulder
        tempObject.current.position.set(
          unit.position.x - 0.36, // -side * unitBaseRadius * 1.2
          unit.position.y + 1.08, // unitHeight * 0.9
          unit.position.z
        );
        tempObject.current.updateMatrix();
        leftShoulderMeshRef.current.setMatrixAt(shoulderCount, tempObject.current.matrix);
        leftShoulderMeshRef.current.setColorAt(shoulderCount, damageColor.clone().multiplyScalar(1.1));

        // Right shoulder
        tempObject.current.position.set(
          unit.position.x + 0.36, // +side * unitBaseRadius * 1.2
          unit.position.y + 1.08, // unitHeight * 0.9
          unit.position.z
        );
        tempObject.current.updateMatrix();
        rightShoulderMeshRef.current.setMatrixAt(shoulderCount, tempObject.current.matrix);
        rightShoulderMeshRef.current.setColorAt(shoulderCount, damageColor.clone().multiplyScalar(1.1));
        shoulderCount++;
      }

      // Shoulder Rings - Energy rings
      if (leftShoulderRingMeshRef.current && rightShoulderRingMeshRef.current) {
        // Left shoulder ring
        tempObject.current.position.set(
          unit.position.x - 0.36, // -side * unitBaseRadius * 1.2
          unit.position.y + 1.08, // unitHeight * 0.9
          unit.position.z
        );
        tempObject.current.rotation.set(Math.PI / 2, -Math.PI / 4, 0);
        tempObject.current.updateMatrix();
        leftShoulderRingMeshRef.current.setMatrixAt(shoulderRingCount, tempObject.current.matrix);
        leftShoulderRingMeshRef.current.setColorAt(shoulderRingCount, damageColor.clone().multiplyScalar(1.3));

        // Right shoulder ring
        tempObject.current.position.set(
          unit.position.x + 0.36, // +side * unitBaseRadius * 1.2
          unit.position.y + 1.08, // unitHeight * 0.9
          unit.position.z
        );
        tempObject.current.rotation.set(Math.PI / 2, Math.PI / 4, 0);
        tempObject.current.updateMatrix();
        rightShoulderRingMeshRef.current.setMatrixAt(shoulderRingCount, tempObject.current.matrix);
        rightShoulderRingMeshRef.current.setColorAt(shoulderRingCount, damageColor.clone().multiplyScalar(1.3));
        shoulderRingCount++;
      }

      // Energy Arms - Crystal cylinders
      if (leftArmMeshRef.current && rightArmMeshRef.current) {
        // Left arm
        tempObject.current.position.set(
          unit.position.x - 0.42, // -side * unitBaseRadius * 1.4
          unit.position.y + 0.84, // unitHeight * 0.7
          unit.position.z - 0.03 // side * unitBaseRadius * 0.1
        );
        tempObject.current.rotation.set(0, 0, -0.3);
        tempObject.current.updateMatrix();
        leftArmMeshRef.current.setMatrixAt(armCount, tempObject.current.matrix);
        leftArmMeshRef.current.setColorAt(armCount, damageColor.clone().multiplyScalar(0.9));

        // Right arm
        tempObject.current.position.set(
          unit.position.x + 0.42, // +side * unitBaseRadius * 1.4
          unit.position.y + 0.84, // unitHeight * 0.7
          unit.position.z + 0.03 // -side * unitBaseRadius * 0.1
        );
        tempObject.current.rotation.set(0, 0, 0.3);
        tempObject.current.updateMatrix();
        rightArmMeshRef.current.setMatrixAt(armCount, tempObject.current.matrix);
        rightArmMeshRef.current.setColorAt(armCount, damageColor.clone().multiplyScalar(0.9));
        armCount++;
      }

      // Energy Tendrils - 8 orbiting crystal spikes
      if (energyTendrilsMeshRef.current) {
        const tendrilCount = 8;
        for (let t = 0; t < tendrilCount; t++) {
          const angle = (t / tendrilCount) * Math.PI * 2;
          const radius = 0.39; // unitBaseRadius * 1.35
          const height = 1.32; // unitHeight * 1.1

          tempObject.current.position.set(
            unit.position.x + Math.cos(angle) * radius,
            unit.position.y + height + Math.sin(angle) * radius * 0.3,
            unit.position.z + Math.sin(angle) * radius
          );
          tempObject.current.rotation.set(Math.PI / 2, angle + Math.PI, -Math.PI / 2);
          tempObject.current.updateMatrix();
          energyTendrilsMeshRef.current.setMatrixAt(energyTendrilsCount, tempObject.current.matrix);
          energyTendrilsMeshRef.current.setColorAt(energyTendrilsCount, damageColor.clone().multiplyScalar(1.2));
          energyTendrilsCount++;
        }
      }

      // Energy Aura - Crystal glow effect
      if (energyAuraMeshRef.current) {
        tempObject.current.position.set(
          unit.position.x,
          unit.position.y + 0.9, // unitHeight * 0.75
          unit.position.z
        );
        tempObject.current.rotation.set(0, 0, 0);
        tempObject.current.updateMatrix();
        energyAuraMeshRef.current.setMatrixAt(energyAuraCount, tempObject.current.matrix);
        energyAuraMeshRef.current.setColorAt(energyAuraCount, damageColor);
        energyAuraCount++;
      }

      // Health Bar (only if not dead)
      if (!unit.isDead && healthBarBgMeshRef.current && healthBarFillMeshRef.current) {
        // Background (pillar-style positioning)
        tempObject.current.position.set(
          unit.position.x,
          unit.position.y + 2.0, // unitHeight + 0.8
          unit.position.z
        );
        tempObject.current.rotation.set(0, 0, 0); // No rotation for top-down view
        tempObject.current.updateMatrix();
        healthBarBgMeshRef.current.setMatrixAt(healthBarBgCount, tempObject.current.matrix);

        // Fill (pillar-style with left alignment)
        tempObject.current.position.x = unit.position.x - (0.85 * (1 - healthPercentage)) / 2;
        tempObject.current.position.y = unit.position.y + 2.001; // slightly above background
        tempObject.current.position.z = unit.position.z;
        tempObject.current.scale.set(healthPercentage, 1, 1);
        tempObject.current.updateMatrix();
        healthBarFillMeshRef.current.setMatrixAt(healthBarFillCount, tempObject.current.matrix);

        // Health bar color based on percentage (pillar-style)
        let targetColor: Color;
        if (healthPercentage > 0.6) {
          // High health: Use player color with slight green tint
          targetColor = unit.color.clone().lerp(new Color(0x00ff88), 0.3);
        } else if (healthPercentage > 0.3) {
          // Medium health: Blend player color with yellow
          const t = (healthPercentage - 0.3) / 0.3;
          targetColor = unit.color.clone().lerp(new Color(0xffff00), 0.5 - t * 0.3);
        } else {
          // Low health: Blend player color with red
          const t = healthPercentage / 0.3;
          targetColor = unit.color.clone().lerp(new Color(0xff4444), 0.6 - t * 0.3);
        }

        healthBarFillMeshRef.current.setColorAt(healthBarFillCount, targetColor);

        healthBarBgCount++;
        healthBarFillCount++;
      }

      // Death Effect (only if dead)
      if (unit.isDead && deathEffectMeshRef.current) {
        tempObject.current.position.set(
          unit.position.x,
          unit.position.y + 0.6, // unitHeight * 0.4
          unit.position.z
        );
        tempObject.current.rotation.set(0, 0, 0);
        tempObject.current.updateMatrix();
        deathEffectMeshRef.current.setMatrixAt(deathEffectCount, tempObject.current.matrix);
        deathEffectCount++;
      }

      // Crystal Target Indicator (always visible)
      if (targetIndicatorMeshRef.current) {
        tempObject.current.position.set(
          unit.position.x,
          unit.position.y + 0.42, // unitHeight * 0.35
          unit.position.z
        );
        tempObject.current.rotation.set(-1.5, 0, 0); // Matches SummonedUnitRenderer
        tempObject.current.updateMatrix();
        targetIndicatorMeshRef.current.setMatrixAt(targetIndicatorCount, tempObject.current.matrix);
        targetIndicatorMeshRef.current.setColorAt(targetIndicatorCount, unit.color);
        targetIndicatorCount++;
      }
    }

    // Update instance counts - Crystal model
    if (bodyMeshRef.current) bodyMeshRef.current.count = bodyCount;
    if (headMeshRef.current) headMeshRef.current.count = headCount;
    if (leftShoulderMeshRef.current) leftShoulderMeshRef.current.count = shoulderCount;
    if (rightShoulderMeshRef.current) rightShoulderMeshRef.current.count = shoulderCount;
    if (leftShoulderRingMeshRef.current) leftShoulderRingMeshRef.current.count = shoulderRingCount;
    if (rightShoulderRingMeshRef.current) rightShoulderRingMeshRef.current.count = shoulderRingCount;
    if (leftArmMeshRef.current) leftArmMeshRef.current.count = armCount;
    if (rightArmMeshRef.current) rightArmMeshRef.current.count = armCount;
    if (energyTendrilsMeshRef.current) energyTendrilsMeshRef.current.count = energyTendrilsCount;
    if (energyAuraMeshRef.current) energyAuraMeshRef.current.count = energyAuraCount;
    if (healthBarBgMeshRef.current) healthBarBgMeshRef.current.count = healthBarBgCount;
    if (healthBarFillMeshRef.current) healthBarFillMeshRef.current.count = healthBarFillCount;
    if (deathEffectMeshRef.current) deathEffectMeshRef.current.count = deathEffectCount;
    if (targetIndicatorMeshRef.current) targetIndicatorMeshRef.current.count = targetIndicatorCount;

    // Mark instances as needing update - Crystal model
    if (bodyMeshRef.current) bodyMeshRef.current.instanceMatrix.needsUpdate = true;
    if (bodyMeshRef.current?.instanceColor) bodyMeshRef.current.instanceColor.needsUpdate = true;
    if (headMeshRef.current) headMeshRef.current.instanceMatrix.needsUpdate = true;
    if (headMeshRef.current?.instanceColor) headMeshRef.current.instanceColor.needsUpdate = true;
    if (leftShoulderMeshRef.current) leftShoulderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (leftShoulderMeshRef.current?.instanceColor) leftShoulderMeshRef.current.instanceColor.needsUpdate = true;
    if (rightShoulderMeshRef.current) rightShoulderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (rightShoulderMeshRef.current?.instanceColor) rightShoulderMeshRef.current.instanceColor.needsUpdate = true;
    if (leftShoulderRingMeshRef.current) leftShoulderRingMeshRef.current.instanceMatrix.needsUpdate = true;
    if (leftShoulderRingMeshRef.current?.instanceColor) leftShoulderRingMeshRef.current.instanceColor.needsUpdate = true;
    if (rightShoulderRingMeshRef.current) rightShoulderRingMeshRef.current.instanceMatrix.needsUpdate = true;
    if (rightShoulderRingMeshRef.current?.instanceColor) rightShoulderRingMeshRef.current.instanceColor.needsUpdate = true;
    if (leftArmMeshRef.current) leftArmMeshRef.current.instanceMatrix.needsUpdate = true;
    if (leftArmMeshRef.current?.instanceColor) leftArmMeshRef.current.instanceColor.needsUpdate = true;
    if (rightArmMeshRef.current) rightArmMeshRef.current.instanceMatrix.needsUpdate = true;
    if (rightArmMeshRef.current?.instanceColor) rightArmMeshRef.current.instanceColor.needsUpdate = true;
    if (energyTendrilsMeshRef.current) energyTendrilsMeshRef.current.instanceMatrix.needsUpdate = true;
    if (energyTendrilsMeshRef.current?.instanceColor) energyTendrilsMeshRef.current.instanceColor.needsUpdate = true;
    if (energyAuraMeshRef.current) energyAuraMeshRef.current.instanceMatrix.needsUpdate = true;
    if (energyAuraMeshRef.current?.instanceColor) energyAuraMeshRef.current.instanceColor.needsUpdate = true;
    if (healthBarBgMeshRef.current) healthBarBgMeshRef.current.instanceMatrix.needsUpdate = true;
    if (healthBarFillMeshRef.current) healthBarFillMeshRef.current.instanceMatrix.needsUpdate = true;
    if (healthBarFillMeshRef.current?.instanceColor) healthBarFillMeshRef.current.instanceColor.needsUpdate = true;
    if (deathEffectMeshRef.current) deathEffectMeshRef.current.instanceMatrix.needsUpdate = true;
    if (targetIndicatorMeshRef.current) targetIndicatorMeshRef.current.instanceMatrix.needsUpdate = true;
    if (targetIndicatorMeshRef.current?.instanceColor) targetIndicatorMeshRef.current.instanceColor.needsUpdate = true;
  };

  // Animation and updates
  useFrame((state) => {
    const currentTime = state.clock.elapsedTime;
    const deltaTime = state.clock.getDelta();

    // Update unit instances from world state
    updateUnitInstances();

    // Update instanced meshes
    updateInstancedMeshes();

    // Apply animations to instanced meshes
    const instances = Array.from(unitInstances.current.values());

    // Gentle floating and rotation animations for alive units
    for (let i = 0; i < instances.length; i++) {
      const unit = instances[i];
      if (unit.isDead) continue;

      // Calculate floating offset (gentle up/down motion)
      const floatOffset = Math.sin(currentTime * 2 + i * 0.1) * 0.05;

      // Update body position for floating
      if (bodyMeshRef.current && bodyMeshRef.current.count > i) {
        tempObject.current.position.copy(unit.position);
        tempObject.current.position.y += 0.8625 + floatOffset; // Base height + float
        tempObject.current.updateMatrix();
        bodyMeshRef.current.setMatrixAt(i, tempObject.current.matrix);
        bodyMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // Update head position and rotation
      if (headMeshRef.current && headMeshRef.current.count > i) {
        tempObject.current.position.set(
          unit.position.x,
          unit.position.y + 1.2 + floatOffset,
          unit.position.z
        );
        tempObject.current.rotation.set(0, currentTime * 0.5 + i * 0.1, 0); // Gentle rotation based on time
        tempObject.current.updateMatrix();
        headMeshRef.current.setMatrixAt(i, tempObject.current.matrix);
        headMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // Update shoulder positions with float
      if (leftShoulderMeshRef.current && leftShoulderMeshRef.current.count > i) {
        tempObject.current.position.set(
          unit.position.x - 0.36,
          unit.position.y + 1.08 + floatOffset,
          unit.position.z
        );
        tempObject.current.updateMatrix();
        leftShoulderMeshRef.current.setMatrixAt(i, tempObject.current.matrix);
        leftShoulderMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      if (rightShoulderMeshRef.current && rightShoulderMeshRef.current.count > i) {
        tempObject.current.position.set(
          unit.position.x + 0.36,
          unit.position.y + 1.08 + floatOffset,
          unit.position.z
        );
        tempObject.current.updateMatrix();
        rightShoulderMeshRef.current.setMatrixAt(i, tempObject.current.matrix);
        rightShoulderMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // Update shoulder rings with float
      if (leftShoulderRingMeshRef.current && leftShoulderRingMeshRef.current.count > i) {
        tempObject.current.position.set(
          unit.position.x - 0.36,
          unit.position.y + 1.08 + floatOffset,
          unit.position.z
        );
        tempObject.current.rotation.set(Math.PI / 2, -Math.PI / 4, 0);
        tempObject.current.updateMatrix();
        leftShoulderRingMeshRef.current.setMatrixAt(i, tempObject.current.matrix);
        leftShoulderRingMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      if (rightShoulderRingMeshRef.current && rightShoulderRingMeshRef.current.count > i) {
        tempObject.current.position.set(
          unit.position.x + 0.36,
          unit.position.y + 1.08 + floatOffset,
          unit.position.z
        );
        tempObject.current.rotation.set(Math.PI / 2, Math.PI / 4, 0);
        tempObject.current.updateMatrix();
        rightShoulderRingMeshRef.current.setMatrixAt(i, tempObject.current.matrix);
        rightShoulderRingMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // Update arm positions with float
      if (leftArmMeshRef.current && leftArmMeshRef.current.count > i) {
        tempObject.current.position.set(
          unit.position.x - 0.42,
          unit.position.y + 0.84 + floatOffset,
          unit.position.z - 0.03
        );
        tempObject.current.rotation.set(0, 0, -0.3);
        tempObject.current.updateMatrix();
        leftArmMeshRef.current.setMatrixAt(i, tempObject.current.matrix);
        leftArmMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      if (rightArmMeshRef.current && rightArmMeshRef.current.count > i) {
        tempObject.current.position.set(
          unit.position.x + 0.42,
          unit.position.y + 0.84 + floatOffset,
          unit.position.z + 0.03
        );
        tempObject.current.rotation.set(0, 0, 0.3);
        tempObject.current.updateMatrix();
        rightArmMeshRef.current.setMatrixAt(i, tempObject.current.matrix);
        rightArmMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // Update energy tendrils (orbiting animation)
      if (energyTendrilsMeshRef.current) {
        const tendrilCount = 8;
        for (let t = 0; t < tendrilCount; t++) {
          const angle = (t / tendrilCount) * Math.PI * 2 + currentTime * 0.5; // Add rotation over time
          const radius = 0.39;
          const height = 1.32;

          tempObject.current.position.set(
            unit.position.x + Math.cos(angle) * radius,
            unit.position.y + height + floatOffset + Math.sin(angle) * radius * 0.3,
            unit.position.z + Math.sin(angle) * radius
          );
          tempObject.current.rotation.set(Math.PI / 2, angle + Math.PI, -Math.PI / 2);
          tempObject.current.updateMatrix();
          energyTendrilsMeshRef.current.setMatrixAt(i * tendrilCount + t, tempObject.current.matrix);
        }
        energyTendrilsMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // Update energy aura position with float
      if (energyAuraMeshRef.current && energyAuraMeshRef.current.count > i) {
        tempObject.current.position.set(
          unit.position.x,
          unit.position.y + 0.9 + floatOffset,
          unit.position.z
        );
        tempObject.current.updateMatrix();
        energyAuraMeshRef.current.setMatrixAt(i, tempObject.current.matrix);
        energyAuraMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  // Initialize instanced meshes with proper setup
  useEffect(() => {
    // Materials are already configured with vertexColors: true above
    // This ensures proper instanced rendering
  }, []);

  return (
    <group>
      {/* Main Body - Crystal-like Octahedron */}
      <instancedMesh
        ref={bodyMeshRef}
        args={[sharedGeometries.body, sharedMaterials.body, maxUnits]}
        castShadow
        receiveShadow
      />

      {/* Head - Crystal-like Octahedron */}
      <instancedMesh
        ref={headMeshRef}
        args={[sharedGeometries.head, sharedMaterials.head, maxUnits]}
        castShadow
      />

      {/* Left Shoulder - Crystal sphere */}
      <instancedMesh
        ref={leftShoulderMeshRef}
        args={[sharedGeometries.shoulder, sharedMaterials.shoulder, maxUnits]}
        castShadow
      />

      {/* Right Shoulder - Crystal sphere */}
      <instancedMesh
        ref={rightShoulderMeshRef}
        args={[sharedGeometries.shoulder, sharedMaterials.shoulder, maxUnits]}
        castShadow
      />

      {/* Left Shoulder Ring - Energy ring */}
      <instancedMesh
        ref={leftShoulderRingMeshRef}
        args={[sharedGeometries.shoulderRing, sharedMaterials.shoulderRing, maxUnits]}
      />

      {/* Right Shoulder Ring - Energy ring */}
      <instancedMesh
        ref={rightShoulderRingMeshRef}
        args={[sharedGeometries.shoulderRing, sharedMaterials.shoulderRing, maxUnits]}
      />

      {/* Left Energy Arm - Crystal cylinder */}
      <instancedMesh
        ref={leftArmMeshRef}
        args={[sharedGeometries.arm, sharedMaterials.arm, maxUnits]}
        castShadow
      />

      {/* Right Energy Arm - Crystal cylinder */}
      <instancedMesh
        ref={rightArmMeshRef}
        args={[sharedGeometries.arm, sharedMaterials.arm, maxUnits]}
        castShadow
      />

      {/* Energy Tendrils - 8 orbiting crystal spikes */}
      <instancedMesh
        ref={energyTendrilsMeshRef}
        args={[sharedGeometries.energyTendril, sharedMaterials.energyTendril, maxUnits * 8]}
        castShadow
      />

      {/* Energy Aura - Crystal glow effect */}
      <instancedMesh
        ref={energyAuraMeshRef}
        args={[sharedGeometries.energyAura, sharedMaterials.energyAura, maxUnits]}
      />

      {/* Health Bar Background */}
      <instancedMesh
        ref={healthBarBgMeshRef}
        args={[sharedGeometries.healthBarBg, sharedMaterials.healthBarBg, maxUnits]}
      />

      {/* Health Bar Fill */}
      <instancedMesh
        ref={healthBarFillMeshRef}
        args={[sharedGeometries.healthBarFill, sharedMaterials.healthBarFill, maxUnits]}
      />

      {/* Death Effect */}
      <instancedMesh
        ref={deathEffectMeshRef}
        args={[sharedGeometries.deathEffect, sharedMaterials.deathEffect, maxUnits]}
      />

      {/* Crystal Target Indicator */}
      <instancedMesh
        ref={targetIndicatorMeshRef}
        args={[sharedGeometries.targetIndicator, sharedMaterials.targetIndicator, maxUnits]}
      />
    </group>
  );
}

