import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Group, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';

interface TowerProjectileTrailProps {
  team: 'Red' | 'Blue';
  size: number;
  position: Vector3;
  opacity?: number;
}

const TowerProjectileTrail: React.FC<TowerProjectileTrailProps> = ({
  team,
  size,
  position,
  opacity = 1
}) => {
  const particlesCount = 18; // Slightly fewer particles than EntropicBoltTrail for tower projectiles
  const particlesRef = useRef<Points>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const opacitiesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const scalesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const isInitialized = useRef(false);

  // ref to store the last known position for smoother updates
  const lastKnownPosition = useRef(new Vector3());

  // Control trail update frequency
  const minMovementDistance = 0.08;
  const updateTimer = useRef(0);
  const updateInterval = 0.025; // Slightly faster update rate than EntropicBoltTrail

  // Determine trail color based on team
  const trailColor = React.useMemo(() => {
    if (team === 'Blue') {
      // Blue team: Bright blue with energy tint
      return new Color(0.4, 0.7, 1.0);
    } else {
      // Red team: Bright red with energy tint
      return new Color(1.0, 0.3, 0.3);
    }
  }, [team]);

  // Initialize positions only once
  useEffect(() => {
    if (!isInitialized.current) {
      const { x, y, z } = position;
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
  }, [position, team]);

  useFrame((_, delta) => {
    if (!particlesRef.current?.parent || !isInitialized.current) return;

    updateTimer.current += delta;

    // Only update at controlled intervals
    if (updateTimer.current < updateInterval) return;
    updateTimer.current = 0;

    // Calculate movement distance
    const distance = position.distanceTo(lastKnownPosition.current);

    // Only update if there's meaningful movement
    if (distance > minMovementDistance) {
      lastKnownPosition.current.copy(position);

      // Update particle positions by shifting them backward
      for (let i = particlesCount - 1; i > 0; i--) {
        positionsRef.current[i * 3] = positionsRef.current[(i - 1) * 3];
        positionsRef.current[i * 3 + 1] = positionsRef.current[(i - 1) * 3 + 1];
        positionsRef.current[i * 3 + 2] = positionsRef.current[(i - 1) * 3 + 2];
      }

      // Update lead particle
      positionsRef.current[0] = position.x;
      positionsRef.current[1] = position.y;
      positionsRef.current[2] = position.z;

      // Update geometry attributes
      if (particlesRef.current) {
        const geometry = particlesRef.current.geometry;
        geometry.attributes.position.needsUpdate = true;
      }
    }

    // Update opacities and scales with parent opacity
    for (let i = 0; i < particlesCount; i++) {
      opacitiesRef.current[i] = Math.pow((1 - i / particlesCount), 2.2) * 0.8 * opacity;
      scalesRef.current[i] = size * 0.7 * Math.pow((1 - i / particlesCount), 0.7);
    }

    if (particlesRef.current) {
      const geometry = particlesRef.current.geometry;
      geometry.attributes.opacity.needsUpdate = true;
      geometry.attributes.scale.needsUpdate = true;
    }
  });

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
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        vertexShader={`
          attribute float opacity;
          attribute float scale;
          varying float vOpacity;
          void main() {
            vOpacity = opacity;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = scale * 20.0 * (300.0 / -mvPosition.z);
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          uniform vec3 uColor;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            float strength = smoothstep(0.5, 0.15, d);
            vec3 finalColor = uColor;
            gl_FragColor = vec4(finalColor, vOpacity * strength);
          }
        `}
        uniforms={{
          uColor: { value: trailColor },
        }}
      />
    </points>
  );
};

export default TowerProjectileTrail;
