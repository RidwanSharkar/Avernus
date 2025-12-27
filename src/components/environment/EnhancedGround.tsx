import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, ShaderMaterial, CylinderGeometry, Color, RepeatWrapping, CanvasTexture } from '@/utils/three-exports';

interface EnhancedGroundProps {
  radius?: number;
  height?: number;
  level?: number;
}

/**
 * Enhanced ground with subtle textures, ambient occlusion, and level-based coloring
 * Provides depth and visual interest to the game environment
 */
const EnhancedGround: React.FC<EnhancedGroundProps> = ({
  radius = 29,
  height = 1,
  level = 1
}) => {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const timeRef = useRef(0);

  // Get level-based colors - Volcano theme with red and grey (darker)
  const getLevelColors = useMemo(() => {
    switch (level) {
      case 1: return { primary: '#2a2a2a', secondary: '#1a1a1a', accent: '#5a0000' };
      case 2: return { primary: '#3a3a3a', secondary: '#222222', accent: '#6a0000' };
      case 3: return { primary: '#404040', secondary: '#2a2a2a', accent: '#7a2222' };
      case 4: return { primary: '#4a4a4a', secondary: '#333333', accent: '#8a102e' };
      case 5: return { primary: '#505050', secondary: '#3a3a3a', accent: '#9a143c' };
      default: return { primary: '#2a2a2a', secondary: '#1a1a1a', accent: '#5a0000' };
    }
  }, [level]);

  const levelColors = getLevelColors;

  // Create procedural texture for ground detail
  const groundTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d')!;

    // Create base gradient
    const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, levelColors.primary);
    gradient.addColorStop(0.7, levelColors.secondary);
    gradient.addColorStop(1, levelColors.accent);

    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);

    // Add subtle noise pattern
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 2 + 0.5;
      const alpha = Math.random() * 0.3 + 0.1;

      context.fillStyle = `rgba(${Math.random() * 50 + 100}, ${Math.random() * 50 + 100}, ${Math.random() * 50 + 100}, ${alpha})`;
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }

    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(4, 4);

    return texture;
  }, [levelColors]);

  // Create normal map for subtle surface detail
  const normalTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;

    // Create normal map data (RGB = XYZ normals)
    const imageData = context.createImageData(256, 256);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Generate subtle height variations
      const x = (i / 4) % 256;
      const y = Math.floor((i / 4) / 256);

      // Simple noise for normal variation
      const noise1 = Math.sin(x * 0.1) * Math.cos(y * 0.1);
      const noise2 = Math.sin(x * 0.05 + Math.PI/4) * Math.cos(y * 0.05 + Math.PI/4);
      const combinedNoise = (noise1 + noise2) * 0.5;

      // Convert to normal map (slight variations around flat surface)
      const normalX = 128 + combinedNoise * 10;
      const normalY = 128 + combinedNoise * 5;
      const normalZ = 255 - Math.abs(combinedNoise) * 20;

      data[i] = Math.max(0, Math.min(255, normalX));     // R (X normal)
      data[i + 1] = Math.max(0, Math.min(255, normalY)); // G (Y normal)
      data[i + 2] = Math.max(0, Math.min(255, normalZ)); // B (Z normal)
      data[i + 3] = 255; // A
    }

    context.putImageData(imageData, 0, 0);

    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(8, 8);

    return texture;
  }, []);

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        colorMap: { value: groundTexture },
        normalMap: { value: normalTexture },
        primaryColor: { value: new Color(levelColors.primary) },
        secondaryColor: { value: new Color(levelColors.secondary) },
        accentColor: { value: new Color(levelColors.accent) }
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

        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;

        void main() {
          // Sample textures
          vec4 colorSample = texture2D(colorMap, vUv);
          vec3 normalSample = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;

          // Distance from center for ambient occlusion effect
          float distanceFromCenter = length(vPosition.xz) / 29.0;
          float ao = 1.0 - smoothstep(0.0, 1.0, distanceFromCenter) * 0.2;

          // Add subtle animation to break up static appearance
          float animation = sin(vPosition.x * 0.01 + time * 0.1) * sin(vPosition.z * 0.01 + time * 0.07) * 0.02 + 1.0;

          // Mix colors based on texture and animation
          vec3 finalColor = colorSample.rgb * animation * ao;

          // Add subtle rim lighting effect
          float rim = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0));
          rim = pow(rim, 3.0) * 0.1;

          finalColor += accentColor * rim;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });
  }, [groundTexture, normalTexture, levelColors]);

  const geometry = useMemo(() => new CylinderGeometry(radius, radius, height, 32, 1), [radius, height]);

  // Cleanup textures, geometries, and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      groundTexture.dispose();
      normalTexture.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [groundTexture, normalTexture, geometry, material]);

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
