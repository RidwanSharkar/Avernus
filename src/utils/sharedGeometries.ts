import {
  SphereGeometry,
  BoxGeometry,
  PlaneGeometry,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  RingGeometry,
} from './three-exports';

// Comprehensive shared geometries to prevent memory leaks
// All commonly used geometries should be defined here instead of inline JSX

export const sharedGeometries = {
  // Sphere geometries for various sizes
  sphereTiny: new SphereGeometry(0.05, 6, 6),
  sphereSmall: new SphereGeometry(0.08, 8, 8),
  sphereMedium: new SphereGeometry(0.15, 8, 8),
  sphereLarge: new SphereGeometry(0.2, 6, 6),
  sphereExtraLarge: new SphereGeometry(0.25, 32, 32),

  // High detail spheres for main projectiles
  sphereHighDetail: new SphereGeometry(0.25, 32, 32),

  // Variable size spheres (for effects that scale)
  sphereVariableSmall: new SphereGeometry(0.1, 8, 8),
  sphereVariableMedium: new SphereGeometry(0.4, 16, 16),
  sphereVariableLarge: new SphereGeometry(1.5, 16, 16),

  // Box geometries
  boxSmall: new BoxGeometry(0.6, 0.06, 0.12),

  // Plane geometries
  planeSmall: new PlaneGeometry(0.08, 0.12),
  planeMedium: new PlaneGeometry(0.2, 1.3),
  planeLarge: new PlaneGeometry(0.3, 0.3),

  // Cylinder geometries for beams and projectiles
  cylinderBeamThin: new CylinderGeometry(0.02, 0.03, 0.4, 8),
  cylinderBeamMedium: new CylinderGeometry(0.04, 0.05, 1.0, 12),
  cylinderBeamThick: new CylinderGeometry(0.04, 0.15, 2.5, 8),
  cylinderBeamLongThin: new CylinderGeometry(0.03, 0.03, 20, 8),
  cylinderBeamLongMedium: new CylinderGeometry(0.07, 0.07, 20, 8),
  cylinderBeamLongThick: new CylinderGeometry(0.09, 0.09, 20, 8),
  cylinderBeamExtraLong: new CylinderGeometry(0.12, 0.12, 20, 8),
  cylinderBeamVariableThin: new CylinderGeometry(0.025, 0.025, 20, 8),
  cylinderBeamVariableMedium: new CylinderGeometry(0.0625, 0.0625, 20, 8),
  cylinderBeamVariableThick: new CylinderGeometry(0.075, 0.075, 20, 8),

  // Cone geometries
  coneSmall: new ConeGeometry(0.08, 0.25, 8),
  coneMedium: new ConeGeometry(0.15, 0.6, 6),
  coneLarge: new ConeGeometry(0.365, 0.8, 6),
  coneTornado: new ConeGeometry(1.25, 2.5, 8, 1, true),

  // Torus geometries for rings
  torusRing: new TorusGeometry(1, 0.05, 16, 32),
  torusEnergyRing: new TorusGeometry(1, 0.08, 6, 16),

  // Specialized geometries
  sphereParticle: new SphereGeometry(0.02, 4, 4),
  sphereSparkTiny: new SphereGeometry(0.03, 6, 6),
  sphereSparkSmall: new SphereGeometry(0.05, 6, 6),
  sphereSparkMedium: new SphereGeometry(0.06, 6, 6),
  sphereSparkLarge: new SphereGeometry(0.08, 6, 6),

  // EntropicBolt specific geometries
  entropicEnergySphere: new SphereGeometry(1, 12, 12),
  entropicEnergyCore: new SphereGeometry(1, 8, 8),
  entropicEnergyTip: new ConeGeometry(0.08, 0.4, 4),

  // SummonTotemExplosion specific geometries
  totemExplosionSphere: new SphereGeometry(1, 32, 32),
  totemEnergySphere: new SphereGeometry(1, 24, 24),
  totemRing: new TorusGeometry(1, 0.045, 16, 32),

  // DeathEffect specific geometries
  deathMainSphere: new SphereGeometry(0.8, 16, 16),
  deathMistParticle: new SphereGeometry(0.1, 8, 8),
  deathRing: new SphereGeometry(0.3, 12, 12),
  deathGlowSphere: new SphereGeometry(1.2, 16, 16),
};

// Utility function to get or create variable-sized geometries
// This is for cases where we need dynamic sizing but want to reuse geometries when possible
const geometryCache = new Map<string, any>();

export function getCachedGeometry(type: string, ...args: any[]) {
  const key = `${type}_${args.join('_')}`;

  if (!geometryCache.has(key)) {
    switch (type) {
      case 'sphere':
        geometryCache.set(key, new SphereGeometry(args[0], args[1], args[2]));
        break;
      case 'cylinder':
        geometryCache.set(key, new CylinderGeometry(args[0], args[1], args[2], args[3]));
        break;
      case 'cone':
        geometryCache.set(key, new ConeGeometry(args[0], args[1], args[2]));
        break;
      case 'box':
        geometryCache.set(key, new BoxGeometry(args[0], args[1], args[2]));
        break;
      case 'plane':
        geometryCache.set(key, new PlaneGeometry(args[0], args[1]));
        break;
      case 'torus':
        geometryCache.set(key, new TorusGeometry(args[0], args[1], args[2], args[3]));
        break;
      case 'ring':
        geometryCache.set(key, new RingGeometry(args[0], args[1], args[2], args[3] || 1));
        break;
      default:
        throw new Error(`Unknown geometry type: ${type}`);
    }
  }

  return geometryCache.get(key);
}

// Cleanup function to dispose of cached geometries when needed
export function disposeCachedGeometries() {
  geometryCache.forEach(geometry => {
    if (geometry.dispose) {
      geometry.dispose();
    }
  });
  geometryCache.clear();
}

// Export individual geometries for convenience
export const {
  sphereTiny,
  sphereSmall,
  sphereMedium,
  sphereLarge,
  sphereExtraLarge,
  sphereHighDetail,
  sphereVariableSmall,
  sphereVariableMedium,
  sphereVariableLarge,
  boxSmall,
  planeSmall,
  planeMedium,
  planeLarge,
  cylinderBeamThin,
  cylinderBeamMedium,
  cylinderBeamThick,
  cylinderBeamLongThin,
  cylinderBeamLongMedium,
  cylinderBeamLongThick,
  cylinderBeamExtraLong,
  cylinderBeamVariableThin,
  cylinderBeamVariableMedium,
  cylinderBeamVariableThick,
  coneSmall,
  coneMedium,
  coneLarge,
  coneTornado,
  torusRing,
  torusEnergyRing,
  sphereParticle,
  sphereSparkTiny,
  sphereSparkSmall,
  sphereSparkMedium,
  sphereSparkLarge,
  entropicEnergySphere,
  entropicEnergyCore,
  entropicEnergyTip,
  totemExplosionSphere,
  totemEnergySphere,
  totemRing,
  deathMainSphere,
  deathMistParticle,
  deathRing,
  deathGlowSphere,
} = sharedGeometries;

// Enhanced cleanup utility that only disposes non-shared geometries
export const disposeThreeJSResources = (object: any, skipSharedGeometries = true) => {
  if (!object) return;

  // Dispose geometry (but skip shared geometries)
  if (object.geometry && object.geometry.dispose) {
    // Check if this is a shared geometry by checking if it exists in our shared geometries
    const isSharedGeometry = Object.values(sharedGeometries).includes(object.geometry) ||
                           Array.from(geometryCache.values()).includes(object.geometry);

    if (!skipSharedGeometries || !isSharedGeometry) {
      object.geometry.dispose();
    }
  }

  // Dispose material
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((material: any) => {
        disposeMaterial(material);
      });
    } else {
      disposeMaterial(object.material);
    }
  }

  // Recursively dispose children
  if (object.children) {
    object.children.forEach((child: any) => disposeThreeJSResources(child, skipSharedGeometries));
  }
};

// Helper function to dispose materials properly
const disposeMaterial = (material: any) => {
  if (!material || !material.dispose) return;

  // Dispose textures
  if (material.map) material.map.dispose();
  if (material.normalMap) material.normalMap.dispose();
  if (material.roughnessMap) material.roughnessMap.dispose();
  if (material.metalnessMap) material.metalnessMap.dispose();
  if (material.emissiveMap) material.emissiveMap.dispose();
  if (material.aoMap) material.aoMap.dispose();
  if (material.alphaMap) material.alphaMap.dispose();
  if (material.bumpMap) material.bumpMap.dispose();
  if (material.displacementMap) material.displacementMap.dispose();

  // Dispose the material itself
  material.dispose();
};
