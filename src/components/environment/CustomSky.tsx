import React, { useMemo, useEffect } from 'react';
import { Color, BackSide, SphereGeometry } from '@/utils/three-exports';

interface SkyProps {}


/**
 * Creates a custom sky shader with tropical indigo lighter purple gradient
 */
const createSkyShader = () => {
  // Create tropical indigo lighter purple gradient colors
  // Top: darker deep indigo blue
  const topColor = new Color('#FC5656');
  // Middle: darker tropical blue-purple
  const middleColor = new Color('#FC5656');
  // Bottom: darker blue that blends with the sky
  const bottomColor = new Color('#9B97D8');
  
  return {
    uniforms: {
      topColor: { value: topColor },
      middleColor: { value: middleColor },
      bottomColor: { value: bottomColor },
      offset: { value: 25 },
      exponent: { value: 0.8 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 middleColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      
      varying vec3 vWorldPosition;
      
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float mixStrength = max(pow(max(h, 0.0), exponent), 0.0);
        vec3 color = mix(middleColor, topColor, mixStrength);
        color = mix(bottomColor, color, smoothstep(0.0, 1.0, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  };
};

/**
 * Custom sky component with tropical indigo lighter purple gradient shader
 * Creates an immersive atmospheric backdrop for the game
 */
const CustomSky: React.FC<SkyProps> = () => {
  const shaderParams = useMemo(() => {
    const skyShader = createSkyShader();
    return {
      uniforms: skyShader.uniforms,
      vertexShader: skyShader.vertexShader,
      fragmentShader: skyShader.fragmentShader,
      side: BackSide,
    };
  }, []);

  // Memoize geometry for performance
  const skyGeometry = useMemo(() => new SphereGeometry(500, 32, 32), []);

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      skyGeometry.dispose();
    };
  }, [skyGeometry]);

  return (
    <mesh geometry={skyGeometry}>
      <shaderMaterial attach="material" args={[shaderParams]} />
    </mesh>
  );
};

export default CustomSky;
