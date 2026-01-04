import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, BufferGeometry, BufferAttribute, AdditiveBlending } from '@/utils/three-exports';

interface AtmosphericParticlesProps {
  position: [number, number, number];
  count?: number;
  radius?: number;
  color?: string;
  speed?: number;
  size?: number;
}

/**
 * Creates subtle floating particles around key environmental elements
 * Provides magical atmosphere without performance impact
 */
const AtmosphericParticles: React.FC<AtmosphericParticlesProps> = ({
  position = [0, 0, 0],
  count = 50,
  radius = 3,
  color = '#ffffff',
  speed = 0.5,
  size = 0.02
}) => {
  const pointsRef = useRef<any>(null);
  const timeRef = useRef(0);

  // Generate particle positions in a spherical distribution
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const particleColor = new Color(color);

    for (let i = 0; i < count; i++) {
      // Random spherical distribution
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      const r = radius * (0.5 + Math.random() * 0.5); // Vary radius slightly

      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Slight color variation
      const variation = 0.8 + Math.random() * 0.4;
      colors[i * 3] = particleColor.r * variation;
      colors[i * 3 + 1] = particleColor.g * variation;
      colors[i * 3 + 2] = particleColor.b * variation;
    }

    return { positions, colors };
  }, [count, radius, color]);

  const geometry = useMemo(() => {
    const geom = new BufferGeometry();
    geom.setAttribute('position', new BufferAttribute(positions, 3));
    geom.setAttribute('color', new BufferAttribute(colors, 3));
    return geom;
  }, [positions, colors]);

  // Animate particles with gentle floating motion
  useFrame((state, delta) => {
    if (pointsRef.current) {
      timeRef.current += delta * speed;

      const positions = pointsRef.current.geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const originalX = geometry.attributes.position.array[i3];
        const originalY = geometry.attributes.position.array[i3 + 1];
        const originalZ = geometry.attributes.position.array[i3 + 2];

        // Gentle floating motion
        positions[i3] = originalX + Math.sin(timeRef.current + i) * 0.1;
        positions[i3 + 1] = originalY + Math.cos(timeRef.current * 0.7 + i * 0.5) * 0.1;
        positions[i3 + 2] = originalZ + Math.sin(timeRef.current * 0.5 + i * 0.7) * 0.1;
      }

      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.rotation.y += delta * 0.1; // Slow rotation
    }
  });

  // Cleanup geometry on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <group position={position}>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          size={size*1.25}
          vertexColors
          transparent
          opacity={0.75}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
};

export default AtmosphericParticles;
