import React, { useMemo, useRef, useEffect } from 'react';
import { Points, Vector3, Color, BufferGeometry, PointsMaterial, BufferAttribute } from '@/utils/three-exports';

interface StarFieldProps {
  count?: number;
  radius?: number;
  brightness?: number;
}

/**
 * Memory-efficient star field using Points
 * Renders thousands of stars as points for optimal performance
 */
const StarField: React.FC<StarFieldProps> = ({
  count = 1500,
  radius = 350,
  brightness = 0.8
}) => {
  const pointsRef = useRef<Points>(null);

  // Generate star positions and properties once
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Random spherical distribution with depth variation
      const theta = Math.random() * Math.PI * 2; // azimuthal angle (0 to 2π)
      const phi = Math.acos(2 * Math.random() - 1); // polar angle (0 to π) - uniform distribution

      // Vary distance from camera for depth (70% to 130% of base radius)
      const starRadius = radius * (1 + Math.random() * 0.6);

      const x = starRadius * Math.sin(phi) * Math.cos(theta);
      const y = starRadius * Math.sin(phi) * Math.sin(theta);
      const z = starRadius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Distance-based size variation for depth
      const distanceRatio = starRadius / radius; // 0.7 to 1.3


      // Random brightness variation with slight distance-based adjustment
      const starBrightness = brightness * (0.3 + Math.random() * 0.7) * (0.8 + distanceRatio * 0.4);
      colors[i * 3] = starBrightness;
      colors[i * 3 + 1] = starBrightness;
      colors[i * 3 + 2] = starBrightness;
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('color', new BufferAttribute(colors, 3));

    const mat = new PointsMaterial({
      size: 1.375,
      sizeAttenuation: true,
      transparent: true,
      opacity: brightness,
      vertexColors: true
    });

    return { geometry: geo, material: mat };
  }, [count, radius, brightness]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geometry) {
        geometry.dispose();
      }
      if (material) {
        material.dispose();
      }
    };
  }, [geometry, material]);

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false} // Stars should always be visible regardless of camera
    />
  );
};

export default StarField;
