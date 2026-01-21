import React, { useMemo, useEffect } from 'react';
import { Color, BackSide, SphereGeometry } from '@/utils/three-exports';
import { shaderRegistry } from '@/utils/shaderRegistry';

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

  const precompiledMaterial = shaderRegistry.getShader('skyGradient');
  if (precompiledMaterial) {
    // Update uniforms for this theme
    precompiledMaterial.uniforms.topColor.value = topColor;
    precompiledMaterial.uniforms.middleColor.value = middleColor;
    precompiledMaterial.uniforms.bottomColor.value = bottomColor;
  }

  return precompiledMaterial;
};

/**
 * Custom sky component with themed gradient shader
 * Creates an immersive atmospheric backdrop for the game
 */
const CustomSky: React.FC<SkyProps> = ({ theme = 'purple' }) => {
  const shaderMaterial = useMemo(() => {
    const material = createSkyShader(theme);
    if (material) {
      material.needsUpdate = true;
    }
    return material;
  }, [theme]);

  // Memoize geometry for performance
  const skyGeometry = useMemo(() => new SphereGeometry(500, 32, 32), []);

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      skyGeometry.dispose();
    };
  }, [skyGeometry]);

  if (!shaderMaterial) return null;

  return (
    <mesh geometry={skyGeometry}>
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
};

export default CustomSky;
