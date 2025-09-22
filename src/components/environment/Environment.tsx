import React, { useMemo } from 'react';
import CustomSky from './CustomSky';
import Planet from './Planet';
import InstancedMountains from './InstancedMountains';
import Pillar from './Pillar';
import Pedestal from './Pedestal';
import EnhancedGround from './EnhancedGround';
import PillarCollision from './PillarCollision';
import DetailedTrees, { DetailedTree } from './DetailedTrees';
import TreeCollision from './TreeCollision';
import AtmosphericParticles from './AtmosphericParticles';
import SimpleBorderEffects from './SimpleBorderEffects';

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
  enableLargeTree = false
}) => {
  // Generate mountains once and memoize for performance
  const mountains = useMemo(() => generateMountains(), []);

  // Define pillar positions in triangle formation
  const pillarPositions: Array<[number, number, number]> = useMemo(() => [
    [0, 0, -5],        // Front pillar
    [-4.25, 0, 2.5],   // Left pillar
    [4.25, 0, 2.5]     // Right pillar
    
  ], []);

  // Define pedestal position
  const pedestalPosition: [number, number, number] = useMemo(() => [0, 0, 0], []);

  // Define tree positions for natural forest arrangement (reduced by half, removed inner trees)
  const treePositions: DetailedTree[] = useMemo(() => [
    // Outer ring trees (kept all - furthest from center, near map boundary)
    { position: new Vector3(18, 0, 10), scale: 1.65, height: 3.0, trunkRadius: 0.275, trunkColor: new Color(0xA3773D) },
  ], []);

  return (
    <group name="environment">
      {/* Custom sky with level-based colors */}
      {enableSky && <CustomSky />}

      {/* Enhanced ground with procedural textures */}
      <EnhancedGround level={level} />


      <Planet />

      <DetailedTrees trees={treePositions} />


      {/* Mountain border around the map */}
      {enableMountains && <InstancedMountains mountains={mountains} />}

      {/* Border effects - particles and glows around map perimeter */}
      {enableBorderEffects && (
        <SimpleBorderEffects
          radius={22}
          count={64}
          enableParticles={true}
          particleCount={100}
        />
      )}

      {/* Central Pedestal */}
      <Pedestal position={pedestalPosition} scale={0.4} level={level} />


      {/* Atmospheric particles around central area */}
      <AtmosphericParticles
        position={pedestalPosition}
        count={30}
        radius={8}
        color="#ffffff"
        speed={0.3}
        size={0.02}
      />

      {/* Three pillars in triangle formation */}
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
