import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  ShaderMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  AdditiveBlending,
  Color
} from '@/utils/three-exports';

// Perimeter cloud vertex shader - for atmospheric red clouds
const perimeterCloudVertexShader = `
  uniform float uTime;
  uniform float uSize;
  uniform float uCloudTime;
  uniform float uDuration;
  uniform vec3 uCloudOrigin;
  uniform vec3 uCloudDirection;
  // Cloud variation uniforms
  uniform float uScale;
  uniform float uSpread;
  uniform float uHeight;
  uniform float uSpeed;
  uniform float uRotationSpeed;
  uniform float uRotationOffset;

  attribute float aRandom;
  attribute float aParticleIndex;

  varying float vAlpha;
  varying float vHeat;

  void main() {
    // Cloud lifetime based on duration
    float cloudProgress = clamp(uCloudTime / uDuration, 0.0, 1.0);

    // Each particle has slightly different timing based on index
    float particleDelay = aParticleIndex * 0.05 * (2.0 - uSpeed);
    float particleProgress = clamp((uCloudTime - particleDelay) / (uDuration * 0.9), 0.0, 1.0);

    // Gentle upward drift speed varies per particle
    float speed = (0.3 + aRandom * 0.4) * uSpeed;

    // Calculate gentle arc trajectory - clouds rise slowly
    float arcHeight = sin(particleProgress * 1.5708) * (0.4 + aRandom * 0.3) * uHeight;
    float upwardDist = particleProgress * speed * uHeight;

    // Spread particles in a wider formation - clouds are diffuse
    float spreadAngle = aRandom * uSpread;
    float spreadRotation = aParticleIndex * 3.8833 + aRandom * 2.0; // Different angle distribution

    vec3 perpendicular1 = normalize(cross(uCloudDirection, vec3(0.0, 1.0, 0.0)));
    if (length(perpendicular1) < 0.1) perpendicular1 = normalize(cross(uCloudDirection, vec3(1.0, 0.0, 0.0)));
    vec3 perpendicular2 = normalize(cross(uCloudDirection, perpendicular1));

    // Wider, more diffuse spread for clouds
    vec3 spreadOffset = (perpendicular1 * cos(spreadRotation) + perpendicular2 * sin(spreadRotation))
                       * spreadAngle * (upwardDist + 1.0) * (0.5 + uScale * 0.3);

    // Apply gentle rotation to the spread offset
    float rotationAngle = (uCloudTime * uRotationSpeed + aRandom * uRotationOffset) * particleProgress * 0.3;
    float cosRot = cos(rotationAngle);
    float sinRot = sin(rotationAngle);

    // Rotate spread offset around the cloud direction
    vec3 rotatedSpread = spreadOffset;
    rotatedSpread.x = spreadOffset.x * cosRot - spreadOffset.z * sinRot;
    rotatedSpread.z = spreadOffset.x * sinRot + spreadOffset.z * cosRot;

    // Final position: origin + upward movement + gentle arc + rotated spread
    vec3 cloudPos = uCloudOrigin
                  + uCloudDirection * upwardDist
                  + uCloudDirection * arcHeight * 0.15
                  + rotatedSpread;

    // Alpha: very subtle, quick fade in/out for numerous clouds
    float fadeIn = smoothstep(0.0, 0.2, particleProgress);
    float fadeOut = 1.0 - smoothstep(0.4, 1.0, particleProgress);
    vAlpha = fadeIn * fadeOut * (0.03 + aRandom * 0.04) * min(uScale, 0.3);

    // Heat: subtle variation for atmospheric effect
    vHeat = 0.7 + aRandom * 0.3;

    // Hide particles before their time
    if (particleProgress <= 0.0) {
      vAlpha = 0.0;
    }

    vec4 mvPosition = modelViewMatrix * vec4(cloudPos, 1.0);
    // Size varies with scale and height
    gl_PointSize = uSize * uScale * (1.0 + arcHeight * 0.8) * (400.0 / -mvPosition.z) * (0.8 + particleProgress * 0.4);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Perimeter cloud fragment shader - red atmospheric colors
const perimeterCloudFragmentShader = `
  varying float vAlpha;
  varying float vHeat;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

    // Color gradient - red atmospheric theme
    vec3 deepRed = vec3(0.8, 0.1, 0.1);        // Deep red
    vec3 brightRed = vec3(1.0, 0.3, 0.2);      // Bright red-orange
    vec3 hotCore = vec3(1.0, 0.6, 0.4);        // Warm core

    // Blend from deep red to bright red based on heat
    vec3 color = mix(deepRed, brightRed, vHeat);

    // Warm core at center of particle
    float core = 1.0 - smoothstep(0.0, 0.2, dist);
    color = mix(color, hotCore, core * vHeat * 0.4);

    gl_FragColor = vec4(color, alpha * vAlpha);
  }
`;

// Interface for tracking active perimeter clouds
interface PerimeterCloud {
  id: number;
  origin: Vector3;
  direction: Vector3;
  startTime: number;
  duration: number;
  // Cloud variation parameters
  scale: number;        // Overall size multiplier (0.5 - 1.8)
  spread: number;       // Cloud spread width (0.3 - 1.2)
  height: number;       // Cloud rise height multiplier (0.8 - 2.0)
  speed: number;        // Drift speed multiplier (0.3 - 0.8)
  rotationSpeed: number; // Gentle rotation speed (0.1 - 0.8)
  rotationOffset: number; // Rotation offset for variation (0 - 6.28)
}

interface PerimeterCloudParticlesProps {
  cloud: PerimeterCloud;
  geometry: BufferGeometry;
}

const PerimeterCloudParticles: React.FC<PerimeterCloudParticlesProps> = ({ cloud, geometry }) => {
  const materialRef = useRef<ShaderMaterial>(null!);

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2 },
        uCloudTime: { value: 0 },
        uDuration: { value: cloud.duration },
        uCloudOrigin: { value: cloud.origin },
        uCloudDirection: { value: cloud.direction },
        // Cloud variation uniforms
        uScale: { value: cloud.scale },
        uSpread: { value: cloud.spread },
        uHeight: { value: cloud.height },
        uSpeed: { value: cloud.speed },
        uRotationSpeed: { value: cloud.rotationSpeed },
        uRotationOffset: { value: cloud.rotationOffset },
      },
      vertexShader: perimeterCloudVertexShader,
      fragmentShader: perimeterCloudFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
  }, [cloud.origin, cloud.direction, cloud.duration, cloud.scale, cloud.spread, cloud.height, cloud.speed, cloud.rotationSpeed, cloud.rotationOffset]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      materialRef.current.uniforms.uCloudTime.value = t - cloud.startTime;
    }
  });

  return (
    <points geometry={geometry}>
      <primitive object={material} attach="material" ref={materialRef} />
    </points>
  );
};

interface PerimeterCloudSystemProps {
  radius: number; // Perimeter radius to spawn clouds around
}

const PerimeterCloudSystem: React.FC<PerimeterCloudSystemProps> = ({
  radius
}) => {
  const [activeClouds, setActiveClouds] = useState<PerimeterCloud[]>([]);
  const cloudIdCounterRef = useRef(0);
  const lastCloudTimeRef = useRef(0);

  // Spawn a new perimeter cloud at a random position around the perimeter
  const spawnCloud = useCallback((currentTime: number) => {
    // Random angle around the perimeter
    const angle = Math.random() * Math.PI * 2;

    // Position on the perimeter circle at slight random offset
    const perimeterOffset = (Math.random() - 0.5) * 2.0; // Small variation around radius
    const distance = radius + perimeterOffset;

    const origin = new Vector3(
      Math.cos(angle) * distance,
      0.2 + Math.random() * 0.3, // Low to ground level, slight variation
      Math.sin(angle) * distance
    );

    // Direction is mostly upward with some outward component
    const direction = new Vector3(
      Math.cos(angle) * 0.2, // Slight outward push
      0.85 + Math.random() * 0.15, // Mostly upward
      Math.sin(angle) * 0.2   // Slight outward push
    );
    direction.normalize();

    // Generate random variation parameters for atmospheric clouds
    const sizeRoll = Math.random();
    let scale: number;
    if (sizeRoll < 0.5) {
      // 50% small clouds
      scale = 0.5 + Math.random() * 0.5; // 0.5 - 1.0
    } else if (sizeRoll < 0.8) {
      // 30% medium clouds
      scale = 1.0 + Math.random() * 0.5; // 1.0 - 1.5
    } else {
      // 20% large dramatic clouds
      scale = 1.5 + Math.random() * 0.3; // 1.5 - 1.8
    }

    // Spread varies - clouds are generally diffuse
    const spreadRoll = Math.random();
    let spread: number;
    if (spreadRoll < 0.4) {
      spread = 0.3 + Math.random() * 0.3; // Compact clouds
    } else if (spreadRoll < 0.7) {
      spread = 0.6 + Math.random() * 0.3; // Medium spread
    } else {
      spread = 0.9 + Math.random() * 0.3; // Wide diffuse clouds
    }

    // Height varies - clouds rise to different levels
    const heightRoll = Math.random();
    let cloudHeight: number;
    if (heightRoll < 0.3) {
      cloudHeight = 0.8 + Math.random() * 0.4; // Low clouds
    } else if (heightRoll < 0.7) {
      cloudHeight = 1.2 + Math.random() * 0.5; // Medium height
    } else {
      cloudHeight = 1.7 + Math.random() * 0.3; // High clouds
    }

    // Speed affects how quickly the cloud drifts - clouds are slow
    const speed = 0.3 + Math.random() * 0.5; // 0.3 - 0.8

    // Gentle rotation speed
    const rotationSpeed = 0.1 + Math.random() * 0.7; // 0.1 - 0.8

    // Rotation offset for initial variation
    const rotationOffset = Math.random() * Math.PI * 2; // 0 - 2π

    // Duration correlates with height and scale - shorter for continuous popping effect
    const baseDuration = 3.0 + Math.random() * 2.0;
    const duration = baseDuration * (0.9 + cloudHeight * 0.1) * (0.95 + scale * 0.05);

    const newCloud: PerimeterCloud = {
      id: cloudIdCounterRef.current++,
      origin,
      direction,
      startTime: currentTime,
      duration,
      scale,
      spread,
      height: cloudHeight,
      speed,
      rotationSpeed,
      rotationOffset,
    };

    setActiveClouds(prev => [...prev, newCloud]);
  }, [radius]);

  // Create cloud particle geometry (shared between all clouds)
  const cloudGeometry = useMemo(() => {
    const particleCount = 17; // Fewer particles per cloud since they're numerous
    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount);
    const particleIndices = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Initial positions don't matter - shader will compute them
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      randoms[i] = Math.random();
      particleIndices[i] = i / particleCount;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new Float32BufferAttribute(randoms, 1));
    geometry.setAttribute('aParticleIndex', new Float32BufferAttribute(particleIndices, 1));

    return geometry;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Spawn new perimeter clouds very frequently for continuous coverage
    const timeSinceLastCloud = t - lastCloudTimeRef.current;

    if (timeSinceLastCloud > 0.25 + Math.random() * 1.0 || lastCloudTimeRef.current === 0) {
      // Spawn 3-6 clouds at once for dense coverage
      const cloudCount = 10 + Math.floor(Math.random() * 7); // 3-6 clouds
      for (let i = 0; i < cloudCount; i++) {
        setTimeout(() => spawnCloud(t + i * 0.1), i * 100);
      }
      lastCloudTimeRef.current = t;
    }

    // Clean up expired clouds
    setActiveClouds(prev =>
      prev.filter(cloud => (t - cloud.startTime) < cloud.duration + 1.0)
    );
  });

  return (
    <group name="perimeter-clouds">
      {activeClouds.map(cloud => (
        <PerimeterCloudParticles
          key={cloud.id}
          cloud={cloud}
          geometry={cloudGeometry}
        />
      ))}
    </group>
  );
};

export default PerimeterCloudSystem;
