import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, ShaderMaterial, CylinderGeometry, Color, RepeatWrapping, CanvasTexture } from '@/utils/three-exports';

// Texture caching system to prevent duplicate texture creation
const textureCache = new Map<string, CanvasTexture>();

// Shared normal texture - doesn't depend on level colors
let sharedNormalTexture: CanvasTexture | null = null;

// Seeded random function for deterministic texture generation
function seededRandom(seed: number): () => number {
  let currentSeed = seed;
  return () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
}

// Cached color objects to avoid recreating Color instances
const colorCache = new Map<string, Color>();

function getCachedColor(hex: string): Color {
  if (!colorCache.has(hex)) {
    colorCache.set(hex, new Color(hex));
  }
  return colorCache.get(hex)!;
}

interface EnhancedGroundProps {
  radius?: number;
  height?: number;
  level?: number;
}

/**
 * Enhanced purple volcanic ground with detailed textures, animated lava effects, and level-based coloring
 * Features:
 * - Dark volcanic rock base with procedural crack patterns
 * - Animated purple lava flows with pulsing glow effects (matching pedestal #7D5DE5)
 * - Enhanced normal mapping for surface roughness
 * - Volcanic fissures and glowing purple embers
 * - Maintains dark theme with bright purple lava accents
 */
const EnhancedGround: React.FC<EnhancedGroundProps> = ({
  radius = 29,
  height = 1,
  level = 1
}) => {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const timeRef = useRef(0);

  // Get level-based colors - Purple volcanic theme matching pedestal (#7D5DE5)
  const getLevelColors = useMemo(() => {
    switch (level) {
      case 1: return { 
        primary: '#1a1a1a',      // Dark volcanic rock
        secondary: '#0f0f0f',    // Darker rock
        accent: '#4a1a5a',       // Deep purple
        lava: '#7D5DE5',         // Pedestal purple (main lava color)
        lavaGlow: '#9D7DFF',     // Bright purple glow
        crack: '#2a1a3a'         // Dark purple crack color
      };
      case 2: return { 
        primary: '#222222', 
        secondary: '#151515', 
        accent: '#5a2a6a',
        lava: '#8D6DF5',
        lavaGlow: '#AD8DFF',
        crack: '#3a2a4a'
      };
      case 3: return { 
        primary: '#2a2a2a', 
        secondary: '#1a1a1a', 
        accent: '#6a3a7a',
        lava: '#9D7DFF',
        lavaGlow: '#BD9DFF',
        crack: '#4a3a5a'
      };
      case 4: return { 
        primary: '#333333', 
        secondary: '#222222', 
        accent: '#7a4a8a',
        lava: '#AD8DFF',
        lavaGlow: '#CDADFF',
        crack: '#5a4a6a'
      };
      case 5: return { 
        primary: '#3a3a3a', 
        secondary: '#2a2a2a', 
        accent: '#8a5a9a',
        lava: '#BD9DFF',
        lavaGlow: '#DDCDFF',
        crack: '#6a5a7a'
      };
      default: return { 
        primary: '#1a1a1a', 
        secondary: '#0f0f0f', 
        accent: '#4a1a5a',
        lava: '#7D5DE5',
        lavaGlow: '#9D7DFF',
        crack: '#2a1a3a'
      };
    }
  }, [level]);

  const levelColors = getLevelColors;

  // Create procedural texture for volcanic ground detail with caching
  const groundTexture = useMemo(() => {
    const cacheKey = `ground_${level}`;

    // Check if texture is already cached
    const cachedTexture = textureCache.get(cacheKey);
    if (cachedTexture) {
      return cachedTexture;
    }

    // Use seeded random for deterministic results per level
    const random = seededRandom(level * 1000); // Different seed per level

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext('2d')!;

    // Create base gradient (darker volcanic rock)
    const gradient = context.createRadialGradient(512, 512, 0, 512, 512, 512);
    gradient.addColorStop(0, levelColors.primary);
    gradient.addColorStop(0.6, levelColors.secondary);
    gradient.addColorStop(0.9, levelColors.crack);
    gradient.addColorStop(1, levelColors.accent);

    context.fillStyle = gradient;
    context.fillRect(0, 0, 1024, 1024);

    // Add volcanic rock texture with varied sizes (deterministic)
    for (let i = 0; i < 5000; i++) {
      const x = random() * 1024;
      const y = random() * 1024;
      const size = random() * 4 + 0.5;
      const brightness = random() * 30 + 10;
      const alpha = random() * 0.4 + 0.1;

      context.fillStyle = `rgba(${brightness}, ${brightness * 0.8}, ${brightness * 0.6}, ${alpha})`;
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }

    // Add crack patterns (volcanic fissures) - deterministic
    context.strokeStyle = levelColors.crack;
    context.lineWidth = 1.5;
    for (let i = 0; i < 150; i++) {
      const startX = random() * 1024;
      const startY = random() * 1024;
      const length = random() * 100 + 30;
      const angle = random() * Math.PI * 2;

      context.beginPath();
      context.moveTo(startX, startY);

      // Create jagged crack path
      let currentX = startX;
      let currentY = startY;
      for (let j = 0; j < 5; j++) {
        currentX += Math.cos(angle + (random() - 0.5) * 0.5) * (length / 5);
        currentY += Math.sin(angle + (random() - 0.5) * 0.5) * (length / 5);
        context.lineTo(currentX, currentY);
      }

      context.globalAlpha = 0.3 + random() * 0.3;
      context.stroke();
    }
    context.globalAlpha = 1.0;

    // Add lava flow patterns (glowing areas) - deterministic
    for (let i = 0; i < 80; i++) {
      const centerX = random() * 1024;
      const centerY = random() * 1024;
      const radius = random() * 40 + 10;

      const lavaGradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      lavaGradient.addColorStop(0, levelColors.lava);
      lavaGradient.addColorStop(0.5, levelColors.lavaGlow);
      lavaGradient.addColorStop(1, 'transparent');

      context.fillStyle = lavaGradient;
      context.globalAlpha = 0.15 + random() * 0.2;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1.0;

    // Add smaller glowing embers - deterministic
    for (let i = 0; i < 300; i++) {
      const x = random() * 1024;
      const y = random() * 1024;
      const size = random() * 3 + 1;
      const intensity = random() * 0.5 + 0.3;

      const emberGradient = context.createRadialGradient(x, y, 0, x, y, size);
      emberGradient.addColorStop(0, levelColors.lavaGlow);
      emberGradient.addColorStop(1, 'transparent');

      context.fillStyle = emberGradient;
      context.globalAlpha = intensity;
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1.0;

    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(4, 4);

    // Cache the texture for future use
    textureCache.set(cacheKey, texture);

    return texture;
  }, [levelColors, level]);

  // Create enhanced normal map for volcanic surface detail (shared across all instances)
  const normalTexture = useMemo(() => {
    // Return shared normal texture if it exists
    if (sharedNormalTexture) {
      return sharedNormalTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d')!;

    // Create normal map data (RGB = XYZ normals)
    const imageData = context.createImageData(512, 512);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % 512;
      const y = Math.floor((i / 4) / 512);

      // Multi-octave noise for more complex volcanic rock surface
      const noise1 = Math.sin(x * 0.15) * Math.cos(y * 0.15);
      const noise2 = Math.sin(x * 0.08 + Math.PI/4) * Math.cos(y * 0.08 + Math.PI/4);
      const noise3 = Math.sin(x * 0.03 + Math.PI/2) * Math.cos(y * 0.03 + Math.PI/2);
      const noise4 = Math.sin(x * 0.25) * Math.cos(y * 0.25) * 0.5;

      // Combine noises with different weights for volcanic texture
      const combinedNoise = (noise1 * 0.4 + noise2 * 0.3 + noise3 * 0.2 + noise4 * 0.1);

      // Add crack patterns (sharp variations)
      const crackPattern = Math.sin(x * 0.05) * Math.cos(y * 0.05) *
                          Math.sin(x * 0.12 + y * 0.08) * 0.3;

      // Add ridge patterns (volcanic flow lines)
      const ridgePattern = Math.abs(Math.sin(x * 0.02 + y * 0.03)) * 0.4;

      const finalNoise = combinedNoise + crackPattern + ridgePattern;

      // Convert to normal map with more dramatic variations for volcanic rock
      const normalX = 128 + finalNoise * 25;  // Increased for more dramatic surface
      const normalY = 128 + finalNoise * 15;
      const normalZ = 255 - Math.abs(finalNoise) * 30;

      data[i] = Math.max(0, Math.min(255, normalX));     // R (X normal)
      data[i + 1] = Math.max(0, Math.min(255, normalY)); // G (Y normal)
      data[i + 2] = Math.max(0, Math.min(255, normalZ)); // B (Z normal)
      data[i + 3] = 255; // A
    }

    context.putImageData(imageData, 0, 0);

    sharedNormalTexture = new CanvasTexture(canvas);
    sharedNormalTexture.wrapS = RepeatWrapping;
    sharedNormalTexture.wrapT = RepeatWrapping;
    sharedNormalTexture.repeat.set(8, 8);

    return sharedNormalTexture;
  }, []);

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        colorMap: { value: groundTexture },
        normalMap: { value: normalTexture },
        primaryColor: { value: getCachedColor(levelColors.primary) },
        secondaryColor: { value: getCachedColor(levelColors.secondary) },
        accentColor: { value: getCachedColor(levelColors.accent) },
        lavaColor: { value: getCachedColor(levelColors.lava) },
        lavaGlowColor: { value: getCachedColor(levelColors.lavaGlow) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;

        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform sampler2D colorMap;
        uniform sampler2D normalMap;
        uniform vec3 primaryColor;
        uniform vec3 secondaryColor;
        uniform vec3 accentColor;
        uniform vec3 lavaColor;
        uniform vec3 lavaGlowColor;

        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;

        // Simple noise function for procedural effects
        float noise(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // Fractal noise for more complex patterns
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          // Sample textures
          vec4 colorSample = texture2D(colorMap, vUv);
          vec3 normalSample = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;

          // Distance from center for ambient occlusion effect
          float distanceFromCenter = length(vPosition.xz) / 29.0;
          float ao = 1.0 - smoothstep(0.0, 1.0, distanceFromCenter) * 0.25;

          // Volcanic crack pattern detection (using noise)
          vec2 crackUV = vUv * 8.0;
          float crackPattern = fbm(crackUV + time * 0.05);
          float crackIntensity = smoothstep(0.6, 0.8, crackPattern);
          
          // Animated lava glow effect
          vec2 lavaUV = vUv * 3.0;
          float lavaNoise = fbm(lavaUV + vec2(time * 0.1, time * 0.08));
          float lavaFlow = sin(vPosition.x * 0.1 + time * 0.3) * sin(vPosition.z * 0.1 + time * 0.2) * 0.5 + 0.5;
          float lavaIntensity = smoothstep(0.4, 0.7, lavaNoise * lavaFlow);
          
          // Pulsing lava glow animation
          float pulse = sin(time * 2.0) * 0.3 + 0.7;
          float glowIntensity = lavaIntensity * pulse;

          // Base volcanic rock color with texture
          vec3 rockColor = colorSample.rgb;
          
          // Add crack glow (darker cracks with enhanced emissive intensity)
          rockColor = mix(rockColor, crackIntensity * accentColor * 0.3, crackIntensity * 0.2);
          
          // Add animated lava glow
          vec3 lavaGlow = mix(lavaColor, lavaGlowColor, glowIntensity);
          rockColor = mix(rockColor, lavaGlow, glowIntensity * 0.4);
          
          // Add subtle heat shimmer effect
          float heatDistortion = sin(vPosition.x * 0.2 + time * 0.5) * sin(vPosition.z * 0.2 + time * 0.4) * 0.02;
          rockColor += lavaGlow * heatDistortion * glowIntensity * 0.1;

          // Apply ambient occlusion
          vec3 finalColor = rockColor * ao;

          // Enhanced rim lighting for volcanic edges
          float rim = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0));
          rim = pow(rim, 2.5);
          
          // Rim glow from lava
          vec3 rimGlow = mix(accentColor, lavaGlowColor, glowIntensity);
          finalColor += rimGlow * rim * 0.15;

          // Add subtle surface variation animation
          float surfaceVariation = sin(vPosition.x * 0.015 + time * 0.08) * sin(vPosition.z * 0.015 + time * 0.06) * 0.03 + 1.0;
          finalColor *= surfaceVariation;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });
  }, [groundTexture, normalTexture, levelColors]);

  const geometry = useMemo(() => new CylinderGeometry(radius, radius, height, 32, 1), [radius, height]);

  // Cleanup textures, geometries, and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Only dispose geometry and material - textures may be shared
      geometry.dispose();
      material.dispose();

      // Dispose ground texture only if it's not cached (shouldn't happen with current implementation)
      if (groundTexture && !textureCache.has(`ground_${level}`)) {
        groundTexture.dispose();
      }

      // Never dispose shared normal texture - it's global
      // Canvas contexts will be cleaned up by garbage collector when textures are disposed
    };
  }, [groundTexture, level, geometry, material]);

  // Animate the shader
  useFrame((state, delta) => {
    timeRef.current += delta;
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = timeRef.current;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, -height/2, 0]}
      receiveShadow
    />
  );
};

export default EnhancedGround;
