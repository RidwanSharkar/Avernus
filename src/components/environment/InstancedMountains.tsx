import React, { useMemo, useRef, useEffect } from 'react';
import { MeshStandardMaterial, InstancedMesh, Matrix4 } from '@/utils/three-exports';
import { MountainData, createPeakGeometry, createMountainBaseVariants } from '@/utils/MountainGenerator';

interface InstancedMountainsProps {
  mountains: MountainData[];
}

/**
 * High-performance mountain renderer with jagged, natural-looking bases
 * Creates a natural mountain border around the game world with unique rock formations
 */
const InstancedMountains: React.FC<InstancedMountainsProps> = ({ mountains }) => {
  const baseRefs = useRef<(InstancedMesh | null)[]>([]);

  // Create varied peak geometries for natural snowtop variation
  const peakGeometries = useMemo(() => {
    return mountains.map((_, index) => createPeakGeometry(index));
  }, [mountains]);

  // Create 4 pre-generated jagged base geometry variants
  const baseGeometryVariants = useMemo(() => {
    return createMountainBaseVariants();
  }, []);

  // Memoize materials for better performance
  const baseMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#8B7355", // Brown-gray mountain color
    roughness: 0.9, // Higher roughness for more natural rock texture
    metalness: 0.05, // Lower metalness for natural stone
    bumpScale: 0.1, // Subtle bump mapping for surface detail
  }), []);

  const peakMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#f0f0f0", // Light gray-white for snow peaks
    roughness: 0.3,
    metalness: 0.0,
  }), []);

  // Cleanup materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      baseMaterial.dispose();
      peakMaterial.dispose();
    };
  }, [baseMaterial, peakMaterial]);

  // Set up instanced matrices for each geometry variant
  useEffect(() => {
    const matrix = new Matrix4();
    
    // Group mountains by geometry variant
    const mountainsByVariant: { mountain: MountainData; originalIndex: number }[][] = baseGeometryVariants.map(() => []);
    
    mountains.forEach((mountain, index) => {
      const variantIndex = index % baseGeometryVariants.length;
      mountainsByVariant[variantIndex].push({ mountain, originalIndex: index });
    });
    
    // Set matrices for each variant
    mountainsByVariant.forEach((variantMountains, variantIndex) => {
      const ref = baseRefs.current[variantIndex];
      if (!ref) return;
      
      variantMountains.forEach(({ mountain }, instanceIndex) => {
        matrix.makeTranslation(
          mountain.position.x,
          mountain.position.y,
          mountain.position.z
        );
        const scaleMatrix = new Matrix4().makeScale(
          mountain.scale,
          mountain.scale,
          mountain.scale
        );
        matrix.multiply(scaleMatrix);
        ref.setMatrixAt(instanceIndex, matrix);
      });
      
      ref.instanceMatrix.needsUpdate = true;
    });
  }, [mountains, baseGeometryVariants]);

  return (
    <group>
      {/* Instanced mountain bases with geometry variants */}
      {baseGeometryVariants.map((geometry, variantIndex) => {
        const mountainsForThisVariant = mountains.filter((_, index) => index % baseGeometryVariants.length === variantIndex);
        
        return (
          <instancedMesh
            key={`base-variant-${variantIndex}`}
            args={[geometry, baseMaterial, mountainsForThisVariant.length]}
            ref={(ref) => {
              baseRefs.current[variantIndex] = ref;
            }}
            castShadow
            receiveShadow
          />
        );
      })}

      {/* Individual peak meshes with varied geometries */}
      {mountains.map((mountain, index) => (
        <mesh
          key={`peak-${index}`}
          geometry={peakGeometries[index]}
          material={peakMaterial}
          position={[
            mountain.position.x,
            mountain.position.y + (14 * mountain.scale),
            mountain.position.z
          ]}
          scale={[
            mountain.scale * 0.915,
            mountain.scale ,
            mountain.scale * 0.9
          ]}
          castShadow
        />
      ))}
    </group>
  );
};

export default InstancedMountains;
