import React from 'react';
import { World } from '@/ecs/World';

// Import the detailed instanced enemy renderer that preserves original models
import DetailedInstancedEnemyRenderer from '@/components/enemies/DetailedInstancedEnemyRenderer';

interface UnifiedEnemyManagerProps {
  world: World;
}

export default function UnifiedEnemyManager({ world }: UnifiedEnemyManagerProps) {
  return (
    <DetailedInstancedEnemyRenderer 
      world={world} 
      maxInstances={200} // Adjust based on your game's needs
    />
  );
}
