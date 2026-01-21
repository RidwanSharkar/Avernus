import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';
import { shaderRegistry } from '@/utils/shaderRegistry';

interface CrossentropyBoltTrailProps {
  color: Color;
  size: number;
  mesh1Ref: React.RefObject<Mesh>;
  mesh2Ref: React.RefObject<Mesh>;
  mesh3Ref: React.RefObject<Mesh>;
  opacity?: number;
}

const CrossentropyBoltTrail: React.FC<CrossentropyBoltTrailProps> = ({
  color,
  size,
  mesh1Ref,
  mesh2Ref,
  mesh3Ref,
  opacity = 1
}) => {
  const particlesCount = 50;
  const particles1Ref = useRef<Points>(null);
  const particles2Ref = useRef<Points>(null);
  const particles3Ref = useRef<Points>(null);
  const positions1Ref = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const positions2Ref = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const positions3Ref = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const opacities1Ref = useRef<Float32Array>(new Float32Array(particlesCount));
  const opacities2Ref = useRef<Float32Array>(new Float32Array(particlesCount));
  const opacities3Ref = useRef<Float32Array>(new Float32Array(particlesCount));
  const scales1Ref = useRef<Float32Array>(new Float32Array(particlesCount));
  const scales2Ref = useRef<Float32Array>(new Float32Array(particlesCount));
  const scales3Ref = useRef<Float32Array>(new Float32Array(particlesCount));
  const isInitialized = useRef(false);
  
  // ref to store the last known positions for smoother updates
  const lastKnownPosition1 = useRef(new Vector3());
  const lastKnownPosition2 = useRef(new Vector3());
  const lastKnownPosition3 = useRef(new Vector3());
  
  // Control trail update frequency
  const minMovementDistance = 0.05; // Minimum distance before updating trail
  const updateTimer = useRef(0);
  const updateInterval = 0.016; // ~60fps max update rate

  // Initialize positions only once when meshes are available
  useEffect(() => {
    if (mesh1Ref.current && mesh2Ref.current && mesh3Ref.current && !isInitialized.current) {
      const { x: x1, y: y1, z: z1 } = mesh1Ref.current.position;
      const { x: x2, y: y2, z: z2 } = mesh2Ref.current.position;
      const { x: x3, y: y3, z: z3 } = mesh3Ref.current.position;
      lastKnownPosition1.current.set(x1, y1, z1);
      lastKnownPosition2.current.set(x2, y2, z2);
      lastKnownPosition3.current.set(x3, y3, z3);

      // Initialize all particles at the starting positions
      for (let i = 0; i < particlesCount; i++) {
        positions1Ref.current[i * 3] = x1;
        positions1Ref.current[i * 3 + 1] = y1;
        positions1Ref.current[i * 3 + 2] = z1;
        positions2Ref.current[i * 3] = x2;
        positions2Ref.current[i * 3 + 1] = y2;
        positions2Ref.current[i * 3 + 2] = z2;
        positions3Ref.current[i * 3] = x3;
        positions3Ref.current[i * 3 + 1] = y3;
        positions3Ref.current[i * 3 + 2] = z3;
        opacities1Ref.current[i] = 0;
        opacities2Ref.current[i] = 0;
        opacities3Ref.current[i] = 0;
        scales1Ref.current[i] = 0;
        scales2Ref.current[i] = 0;
        scales3Ref.current[i] = 0;
      }
      isInitialized.current = true;
    }
  }, [mesh1Ref, mesh2Ref, mesh3Ref]);

  useFrame((_, delta) => {
    if (!particles1Ref.current?.parent || !particles2Ref.current?.parent || !particles3Ref.current?.parent ||
        !mesh1Ref.current || !mesh2Ref.current || !mesh3Ref.current || !isInitialized.current) return;

    updateTimer.current += delta;
    
    // Only update at controlled intervals
    if (updateTimer.current < updateInterval) return;
    updateTimer.current = 0;

    const currentPos1 = mesh1Ref.current.position;
    const currentPos2 = mesh2Ref.current.position;
    const currentPos3 = mesh3Ref.current.position;

    // Calculate movement distances
    const distance1 = currentPos1.distanceTo(lastKnownPosition1.current);
    const distance2 = currentPos2.distanceTo(lastKnownPosition2.current);
    const distance3 = currentPos3.distanceTo(lastKnownPosition3.current);

    // Only update if there's meaningful movement
    if (distance1 > minMovementDistance || distance2 > minMovementDistance || distance3 > minMovementDistance) {
      lastKnownPosition1.current.copy(currentPos1);
      lastKnownPosition2.current.copy(currentPos2);
      lastKnownPosition3.current.copy(currentPos3);

      // Update particle positions for all three trails
      for (let i = particlesCount - 1; i > 0; i--) {
        positions1Ref.current[i * 3] = positions1Ref.current[(i - 1) * 3];
        positions1Ref.current[i * 3 + 1] = positions1Ref.current[(i - 1) * 3 + 1];
        positions1Ref.current[i * 3 + 2] = positions1Ref.current[(i - 1) * 3 + 2];
        positions2Ref.current[i * 3] = positions2Ref.current[(i - 1) * 3];
        positions2Ref.current[i * 3 + 1] = positions2Ref.current[(i - 1) * 3 + 1];
        positions2Ref.current[i * 3 + 2] = positions2Ref.current[(i - 1) * 3 + 2];
        positions3Ref.current[i * 3] = positions3Ref.current[(i - 1) * 3];
        positions3Ref.current[i * 3 + 1] = positions3Ref.current[(i - 1) * 3 + 1];
        positions3Ref.current[i * 3 + 2] = positions3Ref.current[(i - 1) * 3 + 2];
      }

      // Update lead particles
      positions1Ref.current[0] = currentPos1.x;
      positions1Ref.current[1] = currentPos1.y;
      positions1Ref.current[2] = currentPos1.z;
      positions2Ref.current[0] = currentPos2.x;
      positions2Ref.current[1] = currentPos2.y;
      positions2Ref.current[2] = currentPos2.z;
      positions3Ref.current[0] = currentPos3.x;
      positions3Ref.current[1] = currentPos3.y;
      positions3Ref.current[2] = currentPos3.z;

      // Update geometry attributes
      if (particles1Ref.current && particles2Ref.current && particles3Ref.current) {
        const geometry1 = particles1Ref.current.geometry;
        const geometry2 = particles2Ref.current.geometry;
        const geometry3 = particles3Ref.current.geometry;
        geometry1.attributes.position.needsUpdate = true;
        geometry2.attributes.position.needsUpdate = true;
        geometry3.attributes.position.needsUpdate = true;
      }
    }

    // Update opacities and scales with parent opacity
    for (let i = 0; i < particlesCount; i++) {
      opacities1Ref.current[i] = Math.pow((1 - i / particlesCount), 2) * 0.6 * opacity;
      opacities2Ref.current[i] = Math.pow((1 - i / particlesCount), 2) * 0.6 * opacity;
      opacities3Ref.current[i] = Math.pow((1 - i / particlesCount), 2) * 0.6 * opacity;
      scales1Ref.current[i] = size * 0.5 * Math.pow((1 - i / particlesCount), 0.5);
      scales2Ref.current[i] = size * 0.5 * Math.pow((1 - i / particlesCount), 0.5);
      scales3Ref.current[i] = size * 0.5 * Math.pow((1 - i / particlesCount), 0.5);
    }

    if (particles1Ref.current && particles2Ref.current && particles3Ref.current) {
      const geometry1 = particles1Ref.current.geometry;
      const geometry2 = particles2Ref.current.geometry;
      const geometry3 = particles3Ref.current.geometry;
      geometry1.attributes.opacity.needsUpdate = true;
      geometry1.attributes.scale.needsUpdate = true;
      geometry2.attributes.opacity.needsUpdate = true;
      geometry2.attributes.scale.needsUpdate = true;
      geometry3.attributes.opacity.needsUpdate = true;
      geometry3.attributes.scale.needsUpdate = true;
    }
  });

  const shaderStrings = useMemo(() => {
    return shaderRegistry.getShaderStrings('particleTrailCryo');
  }, []);

  return (
    <>
      <points ref={particles1Ref}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlesCount}
            array={positions1Ref.current}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-opacity"
            count={particlesCount}
            array={opacities1Ref.current}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-scale"
            count={particlesCount}
            array={scales1Ref.current}
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
            }}
          />
        )}
      </points>
      <points ref={particles2Ref}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlesCount}
            array={positions2Ref.current}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-opacity"
            count={particlesCount}
            array={opacities2Ref.current}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-scale"
            count={particlesCount}
            array={scales2Ref.current}
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
            }}
          />
        )}
      </points>
      <points ref={particles3Ref}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlesCount}
            array={positions3Ref.current}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-opacity"
            count={particlesCount}
            array={opacities3Ref.current}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-scale"
            count={particlesCount}
            array={scales3Ref.current}
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
            }}
          />
        )}
      </points>
    </>
  );
};

export default CrossentropyBoltTrail; 
