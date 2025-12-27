import React, { useEffect, useRef } from 'react';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Collider, ColliderType, CollisionLayer } from '@/ecs/components/Collider';
import { Entity } from '@/ecs/Entity';

interface PillarCollisionProps {
  world: World;
  positions: Array<[number, number, number]>;
}

/**
 * Creates invisible collision entities for pillars in the ECS world
 * This ensures players and projectiles cannot pass through pillars
 */
const PillarCollision: React.FC<PillarCollisionProps> = ({ world, positions }) => {
  const collisionEntitiesRef = useRef<Entity[]>([]);

  useEffect(() => {
    // Create collision entities for each pillar position
    const entities: Entity[] = [];

    positions.forEach((position) => {
      // Create entity for pillar collision
      const entity = world.createEntity();

      // Add Transform component at pillar position
      const transform = world.createComponent(Transform);
      transform.setPosition(position[0], position[1] + 1, position[2]); // Slightly elevated for pillar center
      entity.addComponent(transform);

      // Add Collider component - cylinder shape to match pillar
      const collider = world.createComponent(Collider);
      collider.type = ColliderType.CYLINDER;
      collider.radius = 0.8; // Slightly larger than visual pillar for easier collision (increased from 0.7 for better projectile hit detection)
      collider.height = 5; // Height to cover the pillar structure (pillar scale is 0.35, total height ~8.5, so 8.5 * 0.35 = ~3)
      collider.layer = CollisionLayer.ENVIRONMENT;
      collider.isStatic = true; // Pillars don't move
      collider.isTrigger = false; // Solid collision, blocks movement
      collider.setOffset(0, 0, 0); // No offset needed
      entity.addComponent(collider);

      // Notify world that entity is ready
      world.notifyEntityAdded(entity);
      entities.push(entity);
    });

    collisionEntitiesRef.current = entities;

    // Cleanup function
    return () => {
      entities.forEach(entity => {
        if (world.getEntity(entity.id)) {
          world.destroyEntity(entity.id);
        }
      });
      collisionEntitiesRef.current = [];
    };
  }, [world, positions]);

  // This component doesn't render anything visual
  return null;
};

export default PillarCollision;
