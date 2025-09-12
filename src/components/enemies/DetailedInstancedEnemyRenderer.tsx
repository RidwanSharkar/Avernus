import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Entity } from '@/ecs/Entity';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';

// Import original renderers - we'll use them directly but more efficiently
import EliteRenderer from './EliteRenderer';


interface DetailedInstancedEnemyRendererProps {
  world: World;
  maxInstances?: number;
}

export default function DetailedInstancedEnemyRenderer({ 
  world, 
  maxInstances = 200 
}: DetailedInstancedEnemyRendererProps) {
  // Store entity IDs for each enemy type - optimized single query approach
  const enemyEntitiesRef = useRef<{
    boss: number[];
    elite: number[];
    grunt: number[];
  }>({
    boss: [],
    elite: [],
    grunt: []
  });

  useFrame(() => {
    if (!world) return;

    const currentTime = performance.now();
    const frameStart = performance.now();
    
    // SINGLE QUERY FOR ALL ENEMIES - This is the key optimization!
    const allEnemyEntities = world.queryEntities([Enemy, Transform]);
    
    // Separate enemies by type in a single pass
    const bossIds: number[] = [];
    const eliteIds: number[] = [];
    const gruntIds: number[] = [];

    for (const entity of allEnemyEntities) {
      const enemy = entity.getComponent(Enemy);
      if (!enemy) continue;

      switch (enemy.type) {
        case EnemyType.BOSS:
          bossIds.push(entity.id);
          break;
        case EnemyType.ELITE:
          eliteIds.push(entity.id);
          break;
        case EnemyType.GRUNT:
          gruntIds.push(entity.id);
          break;
      }
    }

    // Update the ref with new entity IDs
    enemyEntitiesRef.current = {
      boss: bossIds,
      elite: eliteIds,
      grunt: gruntIds
    };

    // Performance logging (only log every 60 frames to avoid spam)
    if (Math.floor(currentTime / 16.67) % 60 === 0) {
      const frameTime = performance.now() - frameStart;
      const totalEnemies = bossIds.length + eliteIds.length + gruntIds.length;
      if (totalEnemies > 0) {
        // console.log(`🎭 Original Models: ${totalEnemies} enemies (${bossIds.length} bosses, ${eliteIds.length} elites, ${gruntIds.length} grunts) rendered in ${frameTime.toFixed(2)}ms`);
      }
    }
  });

  return (
    <>

      {/* Elite Enemies - Using original EliteRenderer */}
      {enemyEntitiesRef.current.elite.map(entityId => {
        const entity = world.getEntity(entityId);
        if (!entity) return null;

        const transform = entity.getComponent(Transform);
        if (!transform) return null;

        return (
          <EliteRenderer
            key={entityId}
            entityId={entityId}
            position={transform.position}
            world={world}
          />
        );
      })}

    </>
  );
}
