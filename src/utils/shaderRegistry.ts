import { ShaderMaterial, Color, Vector3 } from './three-exports';

// Shader registry for precompiled shaders to improve performance
class ShaderRegistry {
  private static instance: ShaderRegistry;
  private compiledShaders: Map<string, ShaderMaterial> = new Map();

  private constructor() {
    this.precompileShaders();
  }

  static getInstance(): ShaderRegistry {
    if (!ShaderRegistry.instance) {
      ShaderRegistry.instance = new ShaderRegistry();
    }
    return ShaderRegistry.instance;
  }

  private precompileShaders(): void {
    // Precompile particle trail shaders
    this.compiledShaders.set('particleTrail', this.createParticleTrailShader());
    this.compiledShaders.set('particleTrailCryo', this.createParticleTrailCryoShader());

    // Precompile environment shaders
    this.compiledShaders.set('volcanicEruption', this.createVolcanicEruptionShader());
    this.compiledShaders.set('groundSplash', this.createGroundSplashShader());
    this.compiledShaders.set('perimeterCloud', this.createPerimeterCloudShader());
    this.compiledShaders.set('skyGradient', this.createSkyGradientShader());
    this.compiledShaders.set('enhancedGround', this.createEnhancedGroundShader());
  }

  // Particle trail shaders (used by EntropicBoltTrail, TowerProjectileTrail, CrossentropyBoltTrail)
  private createParticleTrailShader(): ShaderMaterial {
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: 1, // AdditiveBlending
      vertexShader: `
        attribute float opacity;
        attribute float scale;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = scale * 18.0 * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        uniform vec3 uColor;
        uniform bool uIsCryoflame;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float strength = smoothstep(0.5, 0.1, d);
          vec3 glowColor;
          float emissiveMultiplier = 1.0;
          if (uIsCryoflame) {
            // For Cryoflame: mix with a deep navy blue for a rich blue effect and increase emissive intensity
            glowColor = mix(uColor, vec3(0.2, 0.4, 0.8), 0.4);
            emissiveMultiplier = 2.25;
          } else {
            // For normal Entropic: mix with orange for fire effect
            glowColor = mix(uColor, vec3(1.0, 0.4, 0.0), 0.4);
            emissiveMultiplier = 2.0;
          }
          gl_FragColor = vec4(glowColor * emissiveMultiplier, vOpacity * strength);
        }
      `,
      uniforms: {
        uColor: { value: new Color(1, 1, 1) }, // Default to white to ensure visibility
        uIsCryoflame: { value: false },
      },
    });
  }

  private createParticleTrailCryoShader(): ShaderMaterial {
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: 1, // AdditiveBlending
      vertexShader: `
        attribute float opacity;
        attribute float scale;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = scale * 20.0 * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        uniform vec3 uColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float strength = smoothstep(0.5, 0.1, d);
          vec3 glowColor = mix(uColor, vec3(1.0, 0.6, 0.0), 0.4);
          gl_FragColor = vec4(glowColor, vOpacity * strength);
        }
      `,
      uniforms: {
        uColor: { value: new Color(1, 1, 1) }, // Default to white
      },
    });
  }

  // Volcanic eruption shaders
  private createVolcanicEruptionShader(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.5 },
        uEruptionTime: { value: 0 },
        uDuration: { value: 1 },
        uEruptionOrigin: { value: new Vector3(0, 0, 0) },
        uEruptionDirection: { value: new Vector3(0, 1, 0) },
        uScale: { value: 1 },
        uSpread: { value: 1 },
        uDistance: { value: 1 },
        uSpeed: { value: 1 },
        uRotationSpeed: { value: 1 },
        uRotationOffset: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uSize;
        uniform float uEruptionTime;
        uniform float uDuration;
        uniform vec3 uEruptionOrigin;
        uniform vec3 uEruptionDirection;
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
          float eruptionProgress = clamp(uEruptionTime / uDuration, 0.0, 1.0);
          float particleDelay = aParticleIndex * 0.03 * (2.0 - uSpeed);
          float particleProgress = clamp((uEruptionTime - particleDelay) / (uDuration * 0.8), 0.0, 1.0);
          float speed = (0.6 + aRandom * 0.8) * uSpeed;
          float arcHeight = sin(particleProgress * 3.14159) * (0.3 + aRandom * 0.5) * uDistance;
          float outwardDist = particleProgress * speed * uDistance;
          float spreadAngle = aRandom * uSpread;
          float spreadRotation = aParticleIndex * 2.39996 + aRandom * 1.5;
          vec3 perpendicular1 = normalize(cross(uEruptionDirection, vec3(0.0, 1.0, 0.0)));
          if (length(perpendicular1) < 0.1) perpendicular1 = normalize(cross(uEruptionDirection, vec3(1.0, 0.0, 0.0)));
          vec3 perpendicular2 = normalize(cross(uEruptionDirection, perpendicular1));
          vec3 spreadOffset = (perpendicular1 * cos(spreadRotation) + perpendicular2 * sin(spreadRotation))
                             * spreadAngle * outwardDist * (0.35 + uScale * 0.5);
          float rotationAngle = (uEruptionTime * uRotationSpeed + aRandom * uRotationOffset) * particleProgress;
          float cosRot = cos(rotationAngle);
          float sinRot = sin(rotationAngle);
          vec3 rotatedSpread = spreadOffset;
          rotatedSpread.x = spreadOffset.x * cosRot - spreadOffset.z * sinRot;
          rotatedSpread.z = spreadOffset.x * sinRot + spreadOffset.z * cosRot;
          vec3 eruptionPos = uEruptionOrigin
                            + uEruptionDirection * outwardDist
                            + uEruptionDirection * arcHeight * 0.25
                            + rotatedSpread;
          float fadeIn = smoothstep(0.0, 0.15, particleProgress);
          float fadeOut = 1.0 - smoothstep(0.5, 1.0, particleProgress);
          vAlpha = fadeIn * fadeOut * (0.2 + aRandom * 0.3) * min(uScale, 0.85);
          vHeat = 1.0 - particleProgress * 0.5;
          if (particleProgress <= 0.0) {
            vAlpha = 0.0;
          }
          vec4 mvPosition = modelViewMatrix * vec4(eruptionPos, 1.0);
          gl_PointSize = uSize * uScale * (1.0 + arcHeight * 1.5) * (300.0 / -mvPosition.z) * (1.0 - particleProgress * 0.4);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vHeat;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          vec3 hotCore = vec3(0.7, 1.0, 0.8);
          vec3 brightGreen = vec3(0.2, 1.0, 0.3);
          vec3 deepGreen = vec3(0.0, 0.8, 0.1);
          vec3 color = mix(deepGreen, brightGreen, vHeat);
          float core = 1.0 - smoothstep(0.0, 0.125, dist);
          color = mix(color, hotCore, core * vHeat * 0.3);
          gl_FragColor = vec4(color, alpha * vAlpha);
        }
      `,
      transparent: true,
      blending: 1, // AdditiveBlending
      depthWrite: false,
    });
  }

  private createGroundSplashShader(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSplashTime: { value: 0 },
        uDuration: { value: 1 },
        uOrigin: { value: new Vector3(0, 0, 0) },
        uScale: { value: 1 },
        uMaxRadius: { value: 1 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uSplashTime;
        uniform float uDuration;
        uniform vec3 uOrigin;
        uniform float uScale;
        uniform float uMaxRadius;

        attribute vec2 aUV;

        varying vec2 vUV;
        varying float vAlpha;
        varying float vDist;

        void main() {
          vUV = aUV;
          float progress = clamp(uSplashTime / uDuration, 0.0, 1.0);
          float currentRadius = progress * uMaxRadius;
          float theta = aUV.x * 3.14159 * 2.0;
          float phi = aUV.y * 3.14159 / 2.0;
          vec3 spherePos = vec3(
            sin(phi) * cos(theta) * currentRadius,
            cos(phi) * currentRadius,
            sin(phi) * sin(theta) * currentRadius
          );
          vec3 worldPos = uOrigin + spherePos;
          vDist = length(aUV - vec2(0.5));
          float fadeIn = smoothstep(0.0, 0.2, progress);
          float fadeOut = 1.0 - smoothstep(0.6, 1.0, progress);
          float distanceFalloff = 1.0 - smoothstep(0.7, 1.0, vDist);
          vAlpha = fadeIn * fadeOut * distanceFalloff * uScale;
          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec2 vUV;
        varying float vAlpha;
        varying float vDist;

        void main() {
          float surfaceRing = 1.0 - smoothstep(0.85, 1.0, vDist);
          float innerGlow = smoothstep(0.2, 0.4, vDist) * (1.0 - smoothstep(0.6, 0.8, vDist));
          float heightEffect = vUV.y;
          vec3 hotCore = vec3(0.7, 1.0, 0.8);
          vec3 brightGreen = vec3(0.2, 1.0, 0.3);
          vec3 deepGreen = vec3(0.0, 0.8, 0.1);
          vec3 color = mix(deepGreen, brightGreen, surfaceRing);
          color = mix(color, hotCore, innerGlow * 0.5 + heightEffect * 0.3);
          float variation = sin(vUV.x * 15.0 + vUV.y * 15.0) * 0.1 + 0.9;
          color *= variation;
          float expansionFade = 1.0 - smoothstep(0.5, 1.0, vDist);
          gl_FragColor = vec4(color, vAlpha * (surfaceRing * 0.4 + innerGlow * 0.2) * expansionFade);
        }
      `,
      transparent: true,
      blending: 1, // AdditiveBlending
      depthWrite: false,
      side: 2, // DoubleSide
    });
  }

  // Perimeter cloud shader
  private createPerimeterCloudShader(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2 },
        uCloudTime: { value: 0 },
        uDuration: { value: 1 },
        uCloudOrigin: { value: new Vector3(0, 0, 0) },
        uCloudDirection: { value: new Vector3(0, 1, 0) },
        uScale: { value: 1 },
        uSpread: { value: 1 },
        uHeight: { value: 1 },
        uSpeed: { value: 1 },
        uRotationSpeed: { value: 1 },
        uRotationOffset: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uSize;
        uniform float uCloudTime;
        uniform float uDuration;
        uniform vec3 uCloudOrigin;
        uniform vec3 uCloudDirection;
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
          float cloudProgress = clamp(uCloudTime / uDuration, 0.0, 1.0);
          float particleDelay = aParticleIndex * 0.05 * (2.0 - uSpeed);
          float particleProgress = clamp((uCloudTime - particleDelay) / (uDuration * 0.9), 0.0, 1.0);
          float speed = (0.3 + aRandom * 0.4) * uSpeed;
          float arcHeight = sin(particleProgress * 1.5708) * (0.4 + aRandom * 0.3) * uHeight;
          float upwardDist = particleProgress * speed * uHeight;
          float spreadAngle = aRandom * uSpread;
          float spreadRotation = aParticleIndex * 3.8833 + aRandom * 2.0;
          vec3 perpendicular1 = normalize(cross(uCloudDirection, vec3(0.0, 1.0, 0.0)));
          if (length(perpendicular1) < 0.1) perpendicular1 = normalize(cross(uCloudDirection, vec3(1.0, 0.0, 0.0)));
          vec3 perpendicular2 = normalize(cross(uCloudDirection, perpendicular1));
          vec3 spreadOffset = (perpendicular1 * cos(spreadRotation) + perpendicular2 * sin(spreadRotation))
                             * spreadAngle * (upwardDist + 1.0) * (0.5 + uScale * 0.3);
          float rotationAngle = (uCloudTime * uRotationSpeed + aRandom * uRotationOffset) * particleProgress * 0.3;
          float cosRot = cos(rotationAngle);
          float sinRot = sin(rotationAngle);
          vec3 rotatedSpread = spreadOffset;
          rotatedSpread.x = spreadOffset.x * cosRot - spreadOffset.z * sinRot;
          rotatedSpread.z = spreadOffset.x * sinRot + spreadOffset.z * cosRot;
          vec3 cloudPos = uCloudOrigin
                         + uCloudDirection * upwardDist
                         + uCloudDirection * arcHeight * 0.15
                         + rotatedSpread;
          float fadeIn = smoothstep(0.0, 0.2, particleProgress);
          float fadeOut = 1.0 - smoothstep(0.4, 1.0, particleProgress);
          vAlpha = fadeIn * fadeOut * (0.03 + aRandom * 0.04) * min(uScale, 0.3);
          vHeat = 0.7 + aRandom * 0.3;
          if (particleProgress <= 0.0) {
            vAlpha = 0.0;
          }
          vec4 mvPosition = modelViewMatrix * vec4(cloudPos, 1.0);
          gl_PointSize = uSize * uScale * (1.0 + arcHeight * 0.8) * (400.0 / -mvPosition.z) * (0.8 + particleProgress * 0.4);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vHeat;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          vec3 deepRed = vec3(0.8, 0.1, 0.1);
          vec3 brightRed = vec3(1.0, 0.3, 0.2);
          vec3 hotCore = vec3(1.0, 0.6, 0.4);
          vec3 color = mix(deepRed, brightRed, vHeat);
          float core = 1.0 - smoothstep(0.0, 0.2, dist);
          color = mix(color, hotCore, core * vHeat * 0.4);
          gl_FragColor = vec4(color, alpha * vAlpha);
        }
      `,
      transparent: true,
      blending: 1, // AdditiveBlending
      depthWrite: false,
    });
  }

  // Sky gradient shader
  private createSkyGradientShader(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        topColor: { value: new Color() },
        middleColor: { value: new Color() },
        bottomColor: { value: new Color() },
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
      side: 1, // BackSide
    });
  }

  // Enhanced ground shader (complete implementation with all visual effects)
  private createEnhancedGroundShader(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        colorMap: { value: null },
        normalMap: { value: null },
        primaryColor: { value: new Color() },
        secondaryColor: { value: new Color() },
        accentColor: { value: new Color() },
        lavaColor: { value: new Color() },
        lavaGlowColor: { value: new Color() },
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
      `,
    });
  }

  // Get a cloned instance of a precompiled shader
  getShader(name: string): ShaderMaterial | null {
    const shader = this.compiledShaders.get(name);
    if (!shader) return null;

    // Clone the shader to avoid sharing uniforms between instances
    return shader.clone();
  }

  // Create a fresh shader material with specific uniforms
  createShaderWithUniforms(name: string, uniforms: Record<string, any>): ShaderMaterial | null {
    const baseShader = this.compiledShaders.get(name);
    if (!baseShader) return null;

    // Create a new shader material with the base shader properties
    const material = new ShaderMaterial({
      uniforms: { ...baseShader.uniforms, ...uniforms },
      vertexShader: baseShader.vertexShader,
      fragmentShader: baseShader.fragmentShader,
      transparent: baseShader.transparent,
      depthWrite: baseShader.depthWrite,
      blending: baseShader.blending,
      side: baseShader.side,
    });

    return material;
  }

  // Get shader strings for JSX shaderMaterial component
  getShaderStrings(name: string): { vertexShader: string; fragmentShader: string } | null {
    const shader = this.compiledShaders.get(name);
    if (!shader) return null;

    return {
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
    };
  }

  // Get all available shader names
  getAvailableShaders(): string[] {
    return Array.from(this.compiledShaders.keys());
  }

  // Dispose of all shaders (call on app cleanup)
  dispose(): void {
    this.compiledShaders.forEach(shader => {
      shader.dispose();
    });
    this.compiledShaders.clear();
  }
}

// Export singleton instance
export const shaderRegistry = ShaderRegistry.getInstance();