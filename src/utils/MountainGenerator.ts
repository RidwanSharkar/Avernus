import { Vector3, ConeGeometry } from '@/utils/three-exports';

export interface MountainData {
  position: Vector3;
  scale: number;
}

/**
 * Generates mountain positions around the hexagonal map perimeter
 * Creates a natural mountain border with controlled randomness
 */
export const generateMountains = (): MountainData[] => {
  const mountains: MountainData[] = [];
  const numberOfMountains = 22;
  const radius = 46;
  
  // Create evenly spaced mountains around the perimeter
  for (let i = 0; i < numberOfMountains; i++) {
    const angle = (i / numberOfMountains) * Math.PI * 2;
    
    // Controlled randomness for natural variation
    const randomRadius = radius + (Math.random() * 4 - 2); // Varies radius by ±2 units
    const x = Math.cos(angle) * randomRadius;
    const z = Math.sin(angle) * randomRadius;
    const scale = 0.75 + Math.random() * 0.4; // More consistent scaling

    // Primary mountain ring
    mountains.push({
      position: new Vector3(x, 0, z),
      scale: scale,
    });

    // Second row of mountains slightly offset for depth
    const innerRadius = radius - 12;
    const offsetAngle = angle + (Math.PI / numberOfMountains);
    const innerX = Math.cos(offsetAngle) * innerRadius;
    const innerZ = Math.sin(offsetAngle) * innerRadius;

    mountains.push({
      position: new Vector3(innerX, 0, innerZ),
      scale: scale * 0.9,
    });
  }

  return mountains;
};

/**
 * Creates varied peak geometries for natural snowtop variation
 * Uses deterministic randomness based on index for consistent results
 */
export const createPeakGeometry = (index: number): ConeGeometry => {
  // Use index as seed for consistent variation per mountain
  const seed = index * 0.618033988749; // Golden ratio for good distribution
  
  // Create detailed cone geometry with higher resolution
  const geometry = new ConeGeometry(5, 8, 16, 8);
  const positions = geometry.attributes.position.array as Float32Array;
  
  // Add natural variation to the peak shape with multiple noise layers
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    
    // Only modify vertices that are not at the very top or bottom
    if (y > -3.5 && y < 3.5) {
      // Create multiple layers of noise for more realistic terrain
      const noiseX1 = Math.sin(x * 0.5 + seed) * Math.cos(z * 0.3 + seed * 2);
      const noiseZ1 = Math.cos(x * 0.3 + seed * 3) * Math.sin(z * 0.5 + seed * 4);
      
      // Add finer detail noise
      const noiseX2 = Math.sin(x * 1.2 + seed * 5) * Math.cos(z * 0.8 + seed * 6) * 0.3;
      const noiseZ2 = Math.cos(x * 0.9 + seed * 7) * Math.sin(z * 1.1 + seed * 8) * 0.3;
      
      // Apply variation that's stronger at the snow line (middle of the peak)
      const heightFactor = 1 - Math.abs(y) / 2; // Stronger variation in middle
      const variation = 0.4 + Math.sin(seed * 10) * 0.3; // More dramatic variation
      
      positions[i] += (noiseX1 + noiseX2) * variation * heightFactor;
      positions[i + 2] += (noiseZ1 + noiseZ2) * variation * heightFactor;
      
      // Add subtle height variation for more natural ridges
      positions[i + 1] += Math.sin(x * 0.2 + z * 0.2 + seed) * 0.2 * heightFactor;
    }
  }
  
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals(); // Recompute normals for proper lighting
  
  return geometry;
};
