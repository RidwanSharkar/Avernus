import React, { useEffect, useRef } from 'react';
import { World } from '@/ecs/World';
// UNUSED FOR PVP
// Import the detailed instanced enemy renderer that preserves original models
import DetailedInstancedEnemyRenderer from '@/components/enemies/DetailedInstancedEnemyRenderer';

// Cleanup utility for Three.js resources
const disposeThreeJSResources = (object: any) => {
  if (!object) return;

  // Dispose geometry
  if (object.geometry) {
    object.geometry.dispose();
  }

  // Dispose material
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((material: any) => {
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        material.dispose();
      });
    } else {
      if (object.material.map) object.material.map.dispose();
      if (object.material.normalMap) object.material.normalMap.dispose();
      if (object.material.roughnessMap) object.material.roughnessMap.dispose();
      if (object.material.metalnessMap) object.material.metalnessMap.dispose();
      if (object.material.emissiveMap) object.material.emissiveMap.dispose();
      object.material.dispose();
    }
  }

  // Recursively dispose children
  if (object.children) {
    object.children.forEach((child: any) => disposeThreeJSResources(child));
  }
};

interface UnifiedEnemyManagerProps {
  world: World;
}

export default function UnifiedEnemyManager({ world }: UnifiedEnemyManagerProps) {
  const rendererRef = useRef<any>(null);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Dispose of enemy renderer resources
      if (rendererRef.current) {
        disposeThreeJSResources(rendererRef.current);
      }
    };
  }, []);

  return (
    <group ref={rendererRef}>
      <DetailedInstancedEnemyRenderer
        world={world}
        maxInstances={5} // Adjust based on your game's needs
      />
    </group>
  );
}
