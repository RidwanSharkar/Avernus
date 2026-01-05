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

// Volcanic eruption vertex shader - for dramatic green eruptions
const volcanicEruptionVertexShader = `
  uniform float uTime;
  uniform float uSize;
  uniform float uEruptionTime;
  uniform float uDuration;
  uniform vec3 uEruptionOrigin;
  uniform vec3 uEruptionDirection;
  // Variation uniforms
  uniform float uScale;
  uniform float uSpread;
  uniform float uDistance;
  uniform float uSpeed;
  uniform float uRotationSpeed;
  uniform float uRotationOffset;

  attribute float aRandom;
  attribute float aParticleIndex;

  varying float vAlpha;
  varying float vHeat;

  void main() {
    // Eruption lifetime based on duration
    float eruptionProgress = clamp(uEruptionTime / uDuration, 0.0, 1.0);

    // Each particle has slightly different timing based on index
    float particleDelay = aParticleIndex * 0.03 * (2.0 - uSpeed);
    float particleProgress = clamp((uEruptionTime - particleDelay) / (uDuration * 0.8), 0.0, 1.0);

    // Ejection speed varies per particle, scaled by eruption speed
    float speed = (0.6 + aRandom * 0.8) * uSpeed;

    // Calculate arc trajectory - height varies with distance
    float arcHeight = sin(particleProgress * 3.14159) * (0.3 + aRandom * 0.5) * uDistance;
    float outwardDist = particleProgress * speed * uDistance;

    // Spread particles in a cone - spread angle varies per eruption
    float spreadAngle = aRandom * uSpread;
    float spreadRotation = aParticleIndex * 2.39996 + aRandom * 1.5; // Golden angle + randomness

    vec3 perpendicular1 = normalize(cross(uEruptionDirection, vec3(0.0, 1.0, 0.0)));
    if (length(perpendicular1) < 0.1) perpendicular1 = normalize(cross(uEruptionDirection, vec3(1.0, 0.0, 0.0)));
    vec3 perpendicular2 = normalize(cross(uEruptionDirection, perpendicular1));

    // Wider spread for larger eruptions
    vec3 spreadOffset = (perpendicular1 * cos(spreadRotation) + perpendicular2 * sin(spreadRotation))
                       * spreadAngle * outwardDist * (0.35 + uScale * 0.5);

    // Apply rotation to the spread offset for swirling motion
    float rotationAngle = (uEruptionTime * uRotationSpeed + aRandom * uRotationOffset) * particleProgress;
    float cosRot = cos(rotationAngle);
    float sinRot = sin(rotationAngle);

    // Rotate spread offset around the eruption direction
    vec3 rotatedSpread = spreadOffset;
    rotatedSpread.x = spreadOffset.x * cosRot - spreadOffset.z * sinRot;
    rotatedSpread.z = spreadOffset.x * sinRot + spreadOffset.z * cosRot;

    // Final position: origin + outward movement + arc + rotated spread
    vec3 eruptionPos = uEruptionOrigin
                  + uEruptionDirection * outwardDist
                  + uEruptionDirection * arcHeight * 0.25
                  + rotatedSpread;

    // Alpha: fade in quickly, sustain, fade out (reduced intensity)
    float fadeIn = smoothstep(0.0, 0.15, particleProgress);
    float fadeOut = 1.0 - smoothstep(0.5, 1.0, particleProgress);
    vAlpha = fadeIn * fadeOut * (0.2 + aRandom * 0.3) * min(uScale, 0.85);

    // Heat: hotter at beginning, cooler as it travels
    vHeat = 1.0 - particleProgress * 0.5;

    // Hide particles before their time
    if (particleProgress <= 0.0) {
      vAlpha = 0.0;
    }

    vec4 mvPosition = modelViewMatrix * vec4(eruptionPos, 1.0);
    // Size varies with scale and arc height
    gl_PointSize = uSize * uScale * (1.0 + arcHeight * 1.5) * (300.0 / -mvPosition.z) * (1.0 - particleProgress * 0.4);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Volcanic eruption fragment shader - green plasma colors
const volcanicEruptionFragmentShader = `
  varying float vAlpha;
  varying float vHeat;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

    // Color gradient - green plasma theme
    vec3 hotCore = vec3(0.7, 1.0, 0.8);        // Bright green-white core
    vec3 brightGreen = vec3(0.2, 1.0, 0.3);    // Bright green
    vec3 deepGreen = vec3(0.0, 0.8, 0.1);      // Deep green

    // Blend from deep green to bright green based on heat
    vec3 color = mix(deepGreen, brightGreen, vHeat);

    // Hot core at center of particle (reduced emissive intensity)
    float core = 1.0 - smoothstep(0.0, 0.125, dist);
    color = mix(color, hotCore, core * vHeat * 0.3);

    gl_FragColor = vec4(color, alpha * vAlpha);
  }
`;

// Interface for tracking active eruptions
interface VolcanicEruption {
  id: number;
  origin: Vector3;
  direction: Vector3;
  startTime: number;
  duration: number;
  // Variation parameters
  scale: number;        // Overall size multiplier (0.3 - 2.0)
  spread: number;       // Cone spread angle (0.1 - 0.8)
  distance: number;     // Travel distance multiplier (0.5 - 2.5)
  speed: number;        // Ejection speed multiplier (0.5 - 1.5)
  rotationSpeed: number; // Rotation speed multiplier (0.5 - 3.0)
  rotationOffset: number; // Rotation offset for variation (0 - 6.28)
}

interface VolcanicEruptionParticlesProps {
  eruption: VolcanicEruption;
  geometry: BufferGeometry;
}

const VolcanicEruptionParticles: React.FC<VolcanicEruptionParticlesProps> = ({ eruption, geometry }) => {
  const materialRef = useRef<ShaderMaterial>(null!);

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.5 },
        uEruptionTime: { value: 0 },
        uDuration: { value: eruption.duration },
        uEruptionOrigin: { value: eruption.origin },
        uEruptionDirection: { value: eruption.direction },
        // Variation uniforms
        uScale: { value: eruption.scale },
        uSpread: { value: eruption.spread },
        uDistance: { value: eruption.distance },
        uSpeed: { value: eruption.speed },
        uRotationSpeed: { value: eruption.rotationSpeed },
        uRotationOffset: { value: eruption.rotationOffset },
      },
      vertexShader: volcanicEruptionVertexShader,
      fragmentShader: volcanicEruptionFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
  }, [eruption.origin, eruption.direction, eruption.duration, eruption.scale, eruption.spread, eruption.distance, eruption.speed, eruption.rotationSpeed, eruption.rotationOffset]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      materialRef.current.uniforms.uEruptionTime.value = t - eruption.startTime;
    }
  });

  return (
    <points geometry={geometry}>
      <primitive object={material} attach="material" ref={materialRef} />
    </points>
  );
};

interface VolcanicEruptionSystemProps {
  groundRadius?: number;
}

const VolcanicEruptionSystem: React.FC<VolcanicEruptionSystemProps> = ({
  groundRadius = 29
}) => {
  const [activeEruptions, setActiveEruptions] = useState<VolcanicEruption[]>([]);
  const eruptionIdCounterRef = useRef(0);
  const lastEruptionTimeRef = useRef(0);

  // Spawn a new volcanic eruption at a random position on the ground
  const spawnEruption = useCallback((currentTime: number) => {
    // Random position within the ground radius (slightly inward to avoid edge)
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * (groundRadius * 0.8); // Stay within 80% of radius

    const origin = new Vector3(
      Math.cos(angle) * distance,
      0.1, // Slightly above ground to avoid clipping
      Math.sin(angle) * distance
    );

    // Direction is primarily upwards towards the sky with minimal random deviation
    const direction = new Vector3(
      (Math.random() - 0.5) * 0.15, // Small random horizontal deviation
      0.95 + Math.random() * 0.1,   // Mostly straight up
      (Math.random() - 0.5) * 0.15  // Small random horizontal deviation
    );
    direction.normalize();

    // Generate random variation parameters for dramatic volcanic eruptions
    const sizeRoll = Math.random();
    let scale: number;
    if (sizeRoll < 0.4) {
      // 40% small eruptions
      scale = 0.6 + Math.random() * 0.6; // 0.6 - 1.2
    } else if (sizeRoll < 0.8) {
      // 40% medium eruptions
      scale = 1.2 + Math.random() * 0.8; // 1.2 - 2.0
    } else {
      // 20% large dramatic eruptions
      scale = 2.0 + Math.random() * 0.8; // 2.0 - 2.8
    }

    // Spread varies - focused jets for upward eruptions
    const spreadRoll = Math.random();
    let spread: number;
    if (spreadRoll < 0.6) {
      spread = 0.1 + Math.random() * 0.15; // Focused upward jets
    } else if (spreadRoll < 0.9) {
      spread = 0.25 + Math.random() * 0.2; // Medium spread
    } else {
      spread = 0.45 + Math.random() * 0.2; // Occasional wider bursts
    }

    // Distance varies significantly - volcanic eruptions can be quite far-reaching
    const distanceRoll = Math.random();
    let eruptionDistance: number;
    if (distanceRoll < 0.2) {
      eruptionDistance = 0.5 + Math.random() * 0.5; // Short bursts
    } else if (distanceRoll < 0.6) {
      eruptionDistance = 1.0 + Math.random() * 0.8; // Medium reach
    } else {
      eruptionDistance = 1.8 + Math.random() * 1.7; // Long eruptions
    }

    // Speed affects how quickly the eruption travels - volcanic eruptions are fast
    const speed = 0.8 + Math.random() * 1.2; // 0.8 - 2.0

    // Rotation speed - some eruptions swirl faster than others
    const rotationRoll = Math.random();
    let rotationSpeed: number;
    if (rotationRoll < 0.3) {
      rotationSpeed = 0.5 + Math.random() * 2.0; // Slow rotation
    } else if (rotationRoll < 0.7) {
      rotationSpeed = 1.5 + Math.random() * 2.5; // Medium rotation
    } else {
      rotationSpeed = 3.0 + Math.random() * 3.0; // Fast spinning
    }

    // Rotation offset for initial variation
    const rotationOffset = Math.random() * Math.PI * 2; // 0 - 2π

    // Duration correlates with distance and scale - longer for bigger eruptions
    const baseDuration = 2.0 + Math.random() * 1.5;
    const duration = baseDuration * (0.7 + eruptionDistance * 0.3) * (0.8 + scale * 0.2);

    const newEruption: VolcanicEruption = {
      id: eruptionIdCounterRef.current++,
      origin,
      direction,
      startTime: currentTime,
      duration,
      scale,
      spread,
      distance: eruptionDistance,
      speed,
      rotationSpeed,
      rotationOffset,
    };

    setActiveEruptions(prev => [...prev, newEruption]);
  }, [groundRadius]);

  // Create eruption particle geometry (shared between all eruptions)
  const eruptionGeometry = useMemo(() => {
    const particleCount =17; // More particles for volcanic eruptions
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

    // Spawn new volcanic eruptions every 2.5 seconds (much more frequent)
    const timeSinceLastEruption = t - lastEruptionTimeRef.current;

    if (timeSinceLastEruption > 7.5 || lastEruptionTimeRef.current === 0) {
      // Spawn 1-3 eruptions at once for more dramatic effect
      const eruptionCount = 1 + Math.floor(Math.random() * 2); // 1-3 eruptions
      for (let i = 0; i < eruptionCount; i++) {
        setTimeout(() => spawnEruption(t + i * 0.3), i * 300);
      }
      lastEruptionTimeRef.current = t;
    }

    // Clean up expired eruptions
    setActiveEruptions(prev =>
      prev.filter(eruption => (t - eruption.startTime) < eruption.duration + 0.5)
    );
  });

  return (
    <group name="volcanic-eruptions">
      {activeEruptions.map(eruption => (
        <VolcanicEruptionParticles
          key={eruption.id}
          eruption={eruption}
          geometry={eruptionGeometry}
        />
      ))}
    </group>
  );
};

export default VolcanicEruptionSystem;
