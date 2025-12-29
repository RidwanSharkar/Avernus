import React, { useMemo } from 'react';
import { CylinderGeometry, MeshStandardMaterial, PointLight } from '../../utils/three-exports';

interface PedestalProps {
  position?: [number, number, number];
  scale?: number;
  level?: number;
}

const Pedestal: React.FC<PedestalProps> = ({
  position = [0, 0, 0],
  scale = 1,
  level = 1
}) => {
  // Create geometries and materials only once using useMemo
  const { pedestalGeometry, material } = useMemo(() => {
    // Create a larger base geometry similar to the pillar base but bigger
    // Using a slightly tapered cylinder for a more imposing look
    const baseGeometry = new CylinderGeometry(8.5, 4.5, 2.5, 12);

    // Add some detail with a smaller top ring
    const topRingGeometry = new CylinderGeometry(9, 4.2, 0.3, 12);

    // Stone material similar to pillar
    const stoneMaterial = new MeshStandardMaterial({
      color: '#e8e8e8',
      roughness: 0.8,
      metalness: 0.1,
    });

    return {
      pedestalGeometry: {
        base: baseGeometry,
        topRing: topRingGeometry,
      },
      material: stoneMaterial,
    };
  }, []);

  // Cleanup geometries and materials on unmount
  React.useEffect(() => {
    return () => {
      Object.values(pedestalGeometry).forEach(geometry => geometry.dispose());
      material.dispose();
    };
  }, [pedestalGeometry, material]);

  return (
    <group position={position} scale={[scale/1.25, scale/1.25, scale/1.25]}>
      {/* Main base */}
      <mesh
        geometry={pedestalGeometry.base}
        material={material}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      />
      
      {/* Top decorative ring */}
      <mesh
        geometry={pedestalGeometry.topRing}
        material={material}
        position={[0, 0.6, 0]}
        castShadow
        receiveShadow
      />
      
      {/* Central point light */}
      <pointLight
        position={[0, 2.5, 0]}
        color={0x7D5DE5}
        intensity={0.4}
        distance={8}
        decay={2}
      />
    </group>
  );
};

export default React.memo(Pedestal);
