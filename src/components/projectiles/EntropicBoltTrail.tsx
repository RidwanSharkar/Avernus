import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Group, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';
import { shaderRegistry } from '@/utils/shaderRegistry';

interface EntropicBoltTrailProps {
  color: Color;
  size: number;
  meshRef: React.RefObject<Mesh | Group>;
  opacity?: number;
  isCryoflame?: boolean;
}

const EntropicBoltTrail: React.FC<EntropicBoltTrailProps> = ({
  color,
  size,
  meshRef,
  opacity = 1,
  isCryoflame = false
}) => {
  const particlesCount = 28; // Fewer particles than CrossentropyBoltTrail for simpler effect
  const particlesRef = useRef<Points>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const opacitiesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const scalesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const isInitialized = useRef(false);
  
  // ref to store the last known position for smoother updates
  const lastKnownPosition = useRef(new Vector3());
  
  // Control trail update frequency
  const minMovementDistance = 0.08; // Slightly larger than CrossentropyBoltTrail
  const updateTimer = useRef(0);
  const updateInterval = 0.02; // Slightly slower update rate

  // Initialize positions only once when mesh is available
  useEffect(() => {
    if (meshRef.current && !isInitialized.current) {
      // Get world position to handle coordinate space correctly
      const worldPosition = new Vector3();
      meshRef.current.getWorldPosition(worldPosition);
      const { x, y, z } = worldPosition;
      lastKnownPosition.current.set(x, y, z);
      
      // Initialize all particles at the starting position
      for (let i = 0; i < particlesCount; i++) {
        positionsRef.current[i * 3] = x;
        positionsRef.current[i * 3 + 1] = y;
        positionsRef.current[i * 3 + 2] = z;
        opacitiesRef.current[i] = 0;
        scalesRef.current[i] = 0;
      }
      isInitialized.current = true;
    }
  }, [meshRef]);

  useFrame((_, delta) => {
    if (!particlesRef.current?.parent || !meshRef.current || !isInitialized.current) return;

    updateTimer.current += delta;
    
    // Only update at controlled intervals
    if (updateTimer.current < updateInterval) return;
    updateTimer.current = 0;

    // Get world position to handle coordinate space correctly
    const worldPosition = new Vector3();
    meshRef.current.getWorldPosition(worldPosition);
    
    // Calculate movement distance
    const distance = worldPosition.distanceTo(lastKnownPosition.current);
    
    // Only update if there's meaningful movement
    if (distance > minMovementDistance) {
      lastKnownPosition.current.copy(worldPosition);

      // Update particle positions by shifting them backward
      for (let i = particlesCount - 1; i > 0; i--) {
        positionsRef.current[i * 3] = positionsRef.current[(i - 1) * 3];
        positionsRef.current[i * 3 + 1] = positionsRef.current[(i - 1) * 3 + 1];
        positionsRef.current[i * 3 + 2] = positionsRef.current[(i - 1) * 3 + 2];
      }

      // Update lead particle
      positionsRef.current[0] = worldPosition.x;
      positionsRef.current[1] = worldPosition.y;
      positionsRef.current[2] = worldPosition.z;

      // Update geometry attributes
      if (particlesRef.current) {
        const geometry = particlesRef.current.geometry;
        geometry.attributes.position.needsUpdate = true;
      }
    }

    // Update opacities and scales with parent opacity
    for (let i = 0; i < particlesCount; i++) {
      opacitiesRef.current[i] = Math.pow((1 - i / particlesCount), 2) * 0.7 * opacity;
      scalesRef.current[i] = size * 0.6 * Math.pow((1 - i / particlesCount), 0.6);
    }

    if (particlesRef.current) {
      const geometry = particlesRef.current.geometry;
      geometry.attributes.opacity.needsUpdate = true;
      geometry.attributes.scale.needsUpdate = true;
    }
  });

  const shaderStrings = useMemo(() => {
    return shaderRegistry.getShaderStrings('particleTrail');
  }, []);

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={positionsRef.current}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={particlesCount}
          array={opacitiesRef.current}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-scale"
          count={particlesCount}
          array={scalesRef.current}
          itemSize={1}
        />
      </bufferGeometry>
      {shaderStrings && (
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={shaderStrings.vertexShader}
          fragmentShader={shaderStrings.fragmentShader}
          uniforms={{
            uColor: { value: color },
            uIsCryoflame: { value: isCryoflame },
          }}
        />
      )}
    </points>
  );
};

export default EntropicBoltTrail;
