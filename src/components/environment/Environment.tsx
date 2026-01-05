import React, { useMemo } from 'react';
import CustomSky from './CustomSky';
import Planet from './Planet';
import InstancedMountains from './InstancedMountains';
import Pillar from './Pillar';
import RuneCircle from './RuneCircle';
import EnhancedGround from './EnhancedGround';
import VolcanicEruptionSystem from './VolcanicEruption';
import PillarCollision from './PillarCollision';
import DetailedTrees, { DetailedTree } from './DetailedTrees';
import TreeCollision from './TreeCollision';
import AtmosphericParticles from './AtmosphericParticles';
import SimpleBorderEffects from './SimpleBorderEffects';
import CustomSkeleton from './CustomSkeleton';

import { generateMountains } from '@/utils/MountainGenerator';
import { World } from '@/ecs/World';
import { Vector3, Color, PerspectiveCamera } from '@/utils/three-exports';

interface EnvironmentProps {
  level?: number;
  enableMountains?: boolean;
  enablePlanet?: boolean;
  enableSky?: boolean;
  enableBorderEffects?: boolean; // Enable border particle and glow effects
  world?: World; // Optional world for collision system
  camera?: PerspectiveCamera; // Optional camera for LOD calculations
  enableLargeTree?: boolean; // Enable large tree rendering
  isPVP?: boolean; // Enable PVP-specific pillar positioning
  pvpPillarPositions?: Array<[number, number, number]>; // PVP pillar positions
  merchantRotation?: [number, number, number]; // Merchant rotation for interactions
  showMerchant?: boolean; // Whether to render the merchant (for performance optimization)
}

/**
 * Environment wrapper component that manages all environmental elements
 * Provides a complete atmospheric backdrop for the game world
 */
const Environment: React.FC<EnvironmentProps> = ({
  level = 1,
  enableMountains = true,
  enablePlanet = true,
  enableSky = true,
  enableBorderEffects = true,
  world,
  camera,
  enableLargeTree = false,
  isPVP = false,
  pvpPillarPositions,
  merchantRotation = [0, 0, 0],
  showMerchant = false
}) => {
  // Generate mountains once and memoize for performance
  const mountains = useMemo(() => generateMountains(), []);

  // Define pillar positions - use PVP positions if provided, otherwise default opposite sides
  const pillarPositions: Array<[number, number, number]> = useMemo(() => {
    if (isPVP && pvpPillarPositions) {
      return pvpPillarPositions;
    }
    // Default two pillars at opposite sides
    return [
      [-6, 0.0, 0],        // Left pillar (raised so base sits on ground)
      [6, 0.0, 0]          // Right pillar (raised so base sits on ground)
    ];
  }, [isPVP, pvpPillarPositions]);

  // Define pedestal position
  const pedestalPosition: [number, number, number] = useMemo(() => [0, 0, 0], []);

  // Define tree positions for natural forest arrangement (reduced by half, removed inner trees)
  const treePositions: DetailedTree[] = useMemo(() => [
    // Outer ring trees (kept all - furthest from center, near map boundary)
    { position: new Vector3(18, 0, 10), scale: 1.65, height: 3.0, trunkRadius: 0.275, trunkColor: new Color(0xA3773D) },
  ], []);

  // Define merchant position near the tree
  const merchantPosition: [number, number, number] = useMemo(() => [16, 0, 8], []);

  return (
    <group name="environment">
      {/* Custom sky with level-based colors */}
      {enableSky && <CustomSky />}

      {/* Enhanced ground with procedural textures */}
      <EnhancedGround level={level} />

      {/* Volcanic eruptions - periodic green flares from random ground locations */}
      <VolcanicEruptionSystem groundRadius={29} />

      <Planet />

      <DetailedTrees trees={treePositions} />

      {/* Merchant positioned near the tree edge - only render when player is nearby for performance */}
      {showMerchant && <CustomSkeleton position={merchantPosition} rotation={merchantRotation} />}

      {/* Mountain border around the map */}
      {enableMountains && <InstancedMountains mountains={mountains} />}

      {/* Border effects - particles and glows around map perimeter */}
      {enableBorderEffects && (
        <SimpleBorderEffects
          radius={24}
          count={48}
          enableParticles={true}
          particleCount={100}
        />
      )}

      {/* Central Rune Circle */}
      <RuneCircle position={pedestalPosition} scale={0.4} level={level} />


      {/* Atmospheric particles around central area */}
      <AtmosphericParticles
        position={pedestalPosition}
        count={30}
        radius={8}
        color="#ffffff"
        speed={0.3}
        size={0.02}
      />

      {/* Two pillars at opposite sides */}
      {pillarPositions.map((pillarPos, index) => (
        <group key={`pillar-group-${index}`}>
          <Pillar position={pillarPos} />
          {/* Particles around each pillar */}
        </group>
      ))}

      {/* Collision entities for pillars only (only if world is provided) */}
      {world && (
        <PillarCollision world={world} positions={pillarPositions} />
      )}

      {/* Collision entities for tree trunks (only if world is provided) */}
      {world && (
        <TreeCollision world={world} trees={treePositions} />
      )}
    </group>
  );
};

export default Environment;
