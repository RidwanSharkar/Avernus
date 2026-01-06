import React, { useMemo, useEffect } from 'react';
import { Color, BackSide, SphereGeometry } from '@/utils/three-exports';

interface SkyProps {
  theme?: 'purple' | 'lightBlue' | 'lightGreen' | 'red';
}

// Define sky themes with their color schemes
const SKY_THEMES = {
  purple: {
    topColor: '#FC5656',
    middleColor: '#FC5656',
    bottomColor: '#AEA8FF'
  },
  lightBlue: {
    topColor: '#063053',
    middleColor: '#0D63A9',
    bottomColor: '#91E0FF'
  },
  lightGreen: {
    topColor: '#084508',
    middleColor: '#084508',
    bottomColor: '#B4F7B6'
  },
  red: {
    topColor: '#640E05',
    middleColor: '#B31706',
    bottomColor: '#FFD3CE'
  }
};

/**
 * Creates a custom sky shader with the specified theme colors
 */
const createSkyShader = (theme: keyof typeof SKY_THEMES = 'purple') => {
  const themeColors = SKY_THEMES[theme];
  // Create gradient colors based on theme
  const topColor = new Color(themeColors.topColor);
  const middleColor = new Color(themeColors.middleColor);
  const bottomColor = new Color(themeColors.bottomColor);
  
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
 * Custom sky component with themed gradient shader
 * Creates an immersive atmospheric backdrop for the game
 */
const CustomSky: React.FC<SkyProps> = ({ theme = 'purple' }) => {
  const shaderParams = useMemo(() => {
    const skyShader = createSkyShader(theme);
    return {
      uniforms: skyShader.uniforms,
      vertexShader: skyShader.vertexShader,
      fragmentShader: skyShader.fragmentShader,
      side: BackSide,
    };
  }, [theme]);

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
