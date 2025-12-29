import React, { useMemo, useRef, useEffect } from 'react';
import { CircleGeometry, RingGeometry, CylinderGeometry, MeshStandardMaterial, PointLight, Color, Mesh } from '../../utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface RuneCircleProps {
  position?: [number, number, number];
  scale?: number;
  level?: number;
  hasCryoflame?: boolean; // Changes color from red to blue like ScytheAimer
}

const RuneCircle: React.FC<RuneCircleProps> = ({
  position = [0, 0, 0],
  scale = 1,
  level = 1,
  hasCryoflame = false
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Group>(null);
  const innerRingRef = useRef<THREE.Group>(null);
  const centerOrbRef = useRef<THREE.Mesh>(null);
  const expandingRingRef = useRef<THREE.Mesh>(null);

  // Animation state
  const rotationRef = useRef(0);
  const pulsePhaseRef = useRef(0);
  const expandPhaseRef = useRef(0);

  // Create geometries and materials only once using useMemo
  const { geometries, materials } = useMemo(() => {
    // Scale factor to match ScytheAimer dimensions (ScytheAimer uses pixels, we need world units)
    // ScytheAimer outer radius = 22.5, scaled down for 3D world
    const scaleFactor = 0.4;

    // Base colors like ScytheAimer
    const baseColor = hasCryoflame ? '#00bfff' : '#ff4444'; // Deep Sky Blue or Red
    const glowColor = hasCryoflame ? '#4df7ff' : '#ff8888'; // Lighter variants for glow

    // Create dashed ring geometries (like SVG strokeDasharray)
    const createDashedRingGeometry = (innerRadius: number, outerRadius: number, dashLength: number, gapLength: number, segments: number = 32) => {
      const geometries: THREE.RingGeometry[] = [];
      const circumference = 2 * Math.PI * ((innerRadius + outerRadius) / 2);
      const totalDashGap = dashLength + gapLength;
      const numDashes = Math.floor(circumference / totalDashGap);

      for (let i = 0; i < numDashes; i++) {
        const startAngle = (i * totalDashGap / circumference) * 2 * Math.PI;
        const endAngle = startAngle + (dashLength / circumference) * 2 * Math.PI;
        const thetaLength = endAngle - startAngle;

        geometries.push(new RingGeometry(innerRadius, outerRadius, 8, 1, startAngle, thetaLength));
      }

      return geometries;
    };

    // Outer spell circle - dashed pattern like SVG strokeDasharray="8 6"
    const outerRingGeometries = createDashedRingGeometry(20.5 * scaleFactor, 22.5 * scaleFactor, 8, 6);

    // Inner spell circle - different pattern like SVG strokeDasharray="4 3"
    const innerRingGeometries = createDashedRingGeometry(11.5 * scaleFactor, 12.5 * scaleFactor, 4, 3);

    // Expanding ring - single solid geometry for smooth expansion effect
    const expandingRingGeometry = new RingGeometry(20.5 * scaleFactor, 22.5 * scaleFactor, 32);

    // Center orb geometry
    const centerOrbGeometry = new CircleGeometry(1.2 * scaleFactor, 16);

    // Cardinal direction markers (4 lines pointing outward) - thin cylinders
    const markerGeometry = new CylinderGeometry(0.05, 0.05, 1.0, 8); // Thin vertical lines

    // Arcane runes/dots (6 small circles around inner ring) - small spheres
    const runeGeometry = new CircleGeometry(0.15, 8);

    // Materials
    const outerRingMaterial = new MeshStandardMaterial({
      color: new Color(baseColor),
      transparent: true,
      opacity: 0.7,
      emissive: new Color(glowColor),
      emissiveIntensity: 0.4,
      side: 2, // DoubleSide for visibility from both sides
    });

    const innerRingMaterial = new MeshStandardMaterial({
      color: new Color(baseColor),
      transparent: true,
      opacity: 0.65,
      emissive: new Color(glowColor),
      emissiveIntensity: 0.3,
      side: 2,
    });

    const centerOrbMaterial = new MeshStandardMaterial({
      color: new Color(baseColor),
      transparent: true,
      opacity: 0.8,
      emissive: new Color(glowColor),
      emissiveIntensity: 0.6,
    });

    const markerMaterial = new MeshStandardMaterial({
      color: new Color(baseColor),
      transparent: true,
      opacity: 0.8,
      emissive: new Color(glowColor),
      emissiveIntensity: 0.5,
    });

    const runeMaterial = new MeshStandardMaterial({
      color: new Color(baseColor),
      transparent: true,
      opacity: 0.9,
      emissive: new Color(glowColor),
      emissiveIntensity: 0.6,
    });

    // Expanding ring material (separate instance for independent animation)
    const expandingRingMaterial = new MeshStandardMaterial({
      color: new Color(baseColor),
      transparent: true,
      opacity: 0.4,
      emissive: new Color(glowColor),
      emissiveIntensity: 0.3,
      side: 2,
    });

    return {
      geometries: {
        outerRing: outerRingGeometries,
        innerRing: innerRingGeometries,
        expandingRing: expandingRingGeometry,
        centerOrb: centerOrbGeometry,
        marker: markerGeometry,
        rune: runeGeometry,
      },
      materials: {
        outerRing: outerRingMaterial,
        innerRing: innerRingMaterial,
        centerOrb: centerOrbMaterial,
        marker: markerMaterial,
        rune: runeMaterial,
        expandingRing: expandingRingMaterial,
      },
    };
  }, [hasCryoflame]);

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Continuous rotation (same as ScytheAimer)
    rotationRef.current += delta * 0.2 * 180 / Math.PI; // Convert to degrees
    rotationRef.current = rotationRef.current % 360;

    // Pulse animation (2 pulses per second like ScytheAimer)
    pulsePhaseRef.current += delta * 2;
    const pulseIntensity = Math.sin(pulsePhaseRef.current * Math.PI * 2) * 0.5 + 0.5; // 0 to 1

    // Expanding ring animation (slower, more dramatic)
    expandPhaseRef.current += delta * 0.1;
    const expandIntensity = Math.sin(expandPhaseRef.current * Math.PI * 2) * 0.5 + 0.5; // 0 to 1

    // Apply rotation to rings
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = (rotationRef.current * Math.PI) / 180;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = (-rotationRef.current * 1.6 * Math.PI) / 180; // Counter-rotate faster
    }

    // Animate emissive intensities for pulsing effect
    if (materials.outerRing) {
      materials.outerRing.emissiveIntensity = 0.4 + pulseIntensity * 0.6;
    }
    if (materials.innerRing) {
      materials.innerRing.emissiveIntensity = 0.3 + pulseIntensity * 0.7;
    }
    if (materials.centerOrb) {
      materials.centerOrb.emissiveIntensity = 0.6 + pulseIntensity * 1.4;
    }
    if (materials.marker) {
      materials.marker.emissiveIntensity = 0.5 + pulseIntensity * 1.0;
    }
    if (materials.rune) {
      materials.rune.emissiveIntensity = 0.6 + pulseIntensity * 1.2;
    }

    // Scale animation for center orb (grows and shrinks)
    if (centerOrbRef.current) {
      const scaleMultiplier = 1 + pulseIntensity * 0.4;
      centerOrbRef.current.scale.setScalar(scaleMultiplier);
    }

    // Expanding ring effect (grows and fades)
    if (expandingRingRef.current && expandingRingRef.current.material) {
      const expandScale = 1 + expandIntensity * 0.8;
      expandingRingRef.current.scale.setScalar(expandScale);
      (expandingRingRef.current.material as THREE.MeshStandardMaterial).opacity = (1 - expandIntensity) * 0.4;
    }
  });

  // Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      // Handle both single geometries and arrays of geometries
      Object.entries(geometries).forEach(([key, geometry]) => {
        if (Array.isArray(geometry)) {
          geometry.forEach(geom => geom.dispose());
        } else {
          geometry.dispose();
        }
      });
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [geometries, materials]);

  // Scale factor for positioning (matches geometry creation)
  const scaleFactor = 0.4;

  return (
    <group ref={groupRef} position={position} scale={[scale, scale, scale]}>
      {/* Expanding outer ring - pulses and grows */}
      <mesh
        ref={expandingRingRef}
        geometry={geometries.expandingRing}
        material={materials.expandingRing}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      />

      {/* Rotating outer spell circle with dashed segments and cardinal markers */}
      <group ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        {geometries.outerRing.map((geometry, i) => (
          <mesh
            key={`outer-dash-${i}`}
            geometry={geometry}
            material={materials.outerRing}
          />
        ))}

        {/* Cardinal direction markers (4 lines pointing outward from inner to outer ring) */}
        {[0, 90, 180, 270].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          // Position markers at the midpoint between inner (18) and outer (22.5) radius
          const innerRadius = 18 * scaleFactor;
          const outerRadius = 24.5 * scaleFactor;
          const midpointRadius = (innerRadius + outerRadius) / 2;
          const x = Math.cos(rad) * midpointRadius;
          const z = Math.sin(rad) * midpointRadius;
          const length = (outerRadius - innerRadius);

          return (
            <mesh
              key={`marker-${i}`}
              geometry={geometries.marker}
              material={materials.marker}
              position={[x, 0.005, z]} // Relative to the group position
              rotation={[0, rad, Math.PI / 2]} // Rotate to be flat on ground and point outward along the radius
              scale={[1, length, 1]}
            />
          );
        })}
      </group>

      {/* Counter-rotating inner spell circle with dashed segments */}
      <group ref={innerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        {geometries.innerRing.map((geometry, i) => (
          <mesh
            key={`inner-dash-${i}`}
            geometry={geometry}
            material={materials.innerRing}
          />
        ))}
      </group>

      {/* Six small arcane runes/dots around inner circle */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        // Position at inner ring radius (12.5 scaled)
        const radius = 12.5 * scaleFactor;
        const x = Math.cos(rad) * radius;
        const z = Math.sin(rad) * radius;

        return (
          <mesh
            key={`rune-${i}`}
            geometry={geometries.rune}
            material={materials.rune}
            position={[x, 0.035, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        );
      })}

      {/* Center spell focus - pulsing orb */}
      <mesh
        ref={centerOrbRef}
        geometry={geometries.centerOrb}
        material={materials.centerOrb}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
      />

      {/* Central point light for atmosphere */}
      <pointLight
        position={[0, 1, 0]}
        color={hasCryoflame ? 0x00bfff : 0xff4444}
        intensity={1.2}
        distance={15}
        decay={2}
      />
    </group>
  );
};

export default React.memo(RuneCircle);
