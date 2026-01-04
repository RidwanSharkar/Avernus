import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  MeshBasicMaterial,
  PlaneGeometry,
  CircleGeometry,
  BoxGeometry,
  ConeGeometry,
  Matrix4,
  Vector3,
  Group,
  Euler,
  Quaternion
} from '@/utils/three-exports';

interface SimpleBorderEffectsProps {
  radius?: number;
  count?: number;
  enableParticles?: boolean;
  particleCount?: number;
}

/**
 * Ultra-performance circular gate effects with spinning pillars and curved archways
 * Perfect for maintaining 120+ FPS while adding atmospheric elements
 */
const SimpleBorderEffects: React.FC<SimpleBorderEffectsProps> = ({
  radius = 25,
  count = 64,
  enableParticles = true,
  particleCount = 100
}) => {
  const particleRef = useRef<InstancedMesh>(null);
  const glowRef = useRef<InstancedMesh>(null);
  const coneRef = useRef<InstancedMesh>(null);
  const archwayRef = useRef<InstancedMesh>(null);
  const middlePolesRef = useRef<InstancedMesh>(null);
  const groupRef = useRef<Group>(null);

  // CRITICAL: Cache Matrix4 to prevent memory leak from creating new ones every frame
  const matrixRef = useRef<Matrix4>(new Matrix4());
  const quaternionRef = useRef<Quaternion>(new Quaternion());

  // Generate particle positions in a ring around the border
  const particlePositions = useMemo(() => {
    const positions: Vector3[] = [];
    const angleStep = (Math.PI * 2) / particleCount;

    for (let i = 0; i < particleCount; i++) {
      const angle = i * angleStep;
      const distance = radius + (Math.random() - 0.5) * 3; // Slight variation
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = Math.random() * 2; // Random height

      positions.push(new Vector3(x, y, z));
    }

    return positions;
  }, [radius, particleCount]);

  // Generate glow positions (fewer, larger)
  const glowPositions = useMemo(() => {
    const positions: Vector3[] = [];
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      positions.push(new Vector3(x, 0.75, z)); // Position pillars so they sit on ground (half height + ground offset)
    }

    return positions;
  }, [radius, count]);

  // Generate archway segments between poles
  const archwayData = useMemo(() => {
    const segments: { position: Vector3; rotation: Euler }[] = [];
    const angleStep = (Math.PI * 2) / count;
    const segmentsPerArch = 8; // Number of segments per archway

    for (let i = 0; i < count; i++) {
      const startAngle = i * angleStep;
      const endAngle = ((i + 1) % count) * angleStep;

      // Calculate arch parameters
      const archRadius = radius;
      const archHeight = 2.5; // Height of the arch peak

      for (let j = 0; j < segmentsPerArch; j++) {
        // Create segments that connect between points
        const t1 = j / segmentsPerArch;
        const t2 = (j + 1) / segmentsPerArch;

        // Calculate positions for start and end of this segment
        const angle1 = startAngle + (endAngle - startAngle) * t1;
        const angle2 = startAngle + (endAngle - startAngle) * t2;

        // Calculate base positions along the circle
        const x1 = Math.cos(angle1) * archRadius;
        const z1 = Math.sin(angle1) * archRadius;
        const x2 = Math.cos(angle2) * archRadius;
        const z2 = Math.sin(angle2) * archRadius;

        // Create parabolic arch heights
        const archProgress1 = Math.sin(t1 * Math.PI);
        const archProgress2 = Math.sin(t2 * Math.PI);
        const y1 = archProgress1 * archHeight;
        const y2 = archProgress2 * archHeight;

        // Position segment at the midpoint angle along the circle (not the straight-line midpoint)
        const midAngle = (angle1 + angle2) / 2;
        const midX = Math.cos(midAngle) * archRadius;
        const midZ = Math.sin(midAngle) * archRadius;
        const midT = (t1 + t2) / 2;
        const midArchProgress = Math.sin(midT * Math.PI);
        const midY = midArchProgress * archHeight;

        // Calculate direction vector for rotation
        const dirX = x2 - x1;
        const dirZ = z2 - z1;
        const segmentAngle = Math.atan2(dirZ, dirX);

        // Calculate rotation to align with the curve direction
        const rotation = new Euler(0, segmentAngle, 0);

        segments.push({
          position: new Vector3(midX, midY, midZ),
          rotation: rotation
        });
      }
    }

    return segments;
  }, [radius, count]);

  // Generate middle poles at the highest points of archways (2 per archway segment)
  const middlePolesPositions = useMemo(() => {
    const positions: Vector3[] = [];
    const angleStep = (Math.PI * 2) / count;
    const archHeight = 2.5; // Height of the arch peak

    for (let i = 0; i < count; i++) {
      const startAngle = i * angleStep;
      const endAngle = ((i + 1) % count) * angleStep;

      // Position 2 poles at the highest middle nodes (very close together at t = 0.45 and t = 0.55)
      for (let poleIndex = 0; poleIndex < 2; poleIndex++) {
        const t = 0.45 + poleIndex * 0.1; // t = 0.45 and t = 0.55 (very close together)
        const angle = startAngle + (endAngle - startAngle) * t;
        
        // Calculate position along the circle
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // Calculate height at this position on the archway (parabolic curve)
        const archProgress = Math.sin(t * Math.PI);
        const y = archProgress * archHeight - 1.5; // Reduced base offset to lower the poles slightly

        positions.push(new Vector3(x, y, z));
      }
    }

    return positions;
  }, [radius, count]);

  // Materials
  const particleMaterial = useMemo(() => new MeshBasicMaterial({
    color: 0xF40000,
    transparent: true,
    opacity: 0.7,
    alphaTest: 0.1,
  }), []);

  const glowMaterial = useMemo(() => new MeshBasicMaterial({
    color: 0xF74F4F, // Light purple
    transparent: true,
    opacity: 0.4,
    alphaTest: 0.1,
  }), []);

  const archwayMaterial = useMemo(() => new MeshBasicMaterial({
    color: 0xE63946, // Darker red for archways
    transparent: true,
    opacity: 0.6,
    alphaTest: 0.1,
  }), []);

  const middlePolesMaterial = useMemo(() => new MeshBasicMaterial({
    color: 0xF74F4F, // Red to match the theme
    transparent: true,
    opacity: 0.4, // Same intensity as regular poles
    alphaTest: 0.1,
  }), []);

  const coneMaterial = useMemo(() => new MeshBasicMaterial({
    color: 0xF74F4F, // Match the pillar color
    transparent: true,
    opacity: 0.4,
    alphaTest: 0.1,
  }), []);

  // Geometries
  const particleGeometry = useMemo(() => new PlaneGeometry(0.05, 0.05), []);
  const glowGeometry = useMemo(() => new BoxGeometry(0.0725, 1.5, 0.0725), []); // 3D pillars visible from all angles
  const coneGeometry = useMemo(() => new ConeGeometry(0.1, 0.35, 8), []); // Small cone on top of pillars
  const middlePolesGeometry = useMemo(() => new BoxGeometry(0.0725, 2.35, 0.0725), []); // Taller poles for middle positions
  const archwayGeometry = useMemo(() => new BoxGeometry(0.07, 0.15, 0.07), []); // Thicker segments for archways

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      particleGeometry.dispose();
      glowGeometry.dispose();
      coneGeometry.dispose();
      middlePolesGeometry.dispose();
      archwayGeometry.dispose();
      particleMaterial.dispose();
      glowMaterial.dispose();
      coneMaterial.dispose();
      archwayMaterial.dispose();
      middlePolesMaterial.dispose();
    };
  }, [particleGeometry, glowGeometry, coneGeometry, middlePolesGeometry, archwayGeometry, particleMaterial, glowMaterial, coneMaterial, archwayMaterial, middlePolesMaterial]);

  // Update instanced matrices
  useEffect(() => {
    const matrix = matrixRef.current;

    // Update particle instances
    if (particleRef.current) {
      particlePositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y, position.z);
        particleRef.current?.setMatrixAt(i, matrix);
      });
      particleRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update glow instances
    if (glowRef.current) {
      glowPositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y, position.z);
        glowRef.current?.setMatrixAt(i, matrix);
      });
      glowRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update cone instances (positioned on top of pillars)
    if (coneRef.current) {
      glowPositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y + 1.5 - 0.55, position.z); // Top of pillar + half cone height
        coneRef.current?.setMatrixAt(i, matrix);
      });
      coneRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update archway instances
    if (archwayRef.current) {
      archwayData.forEach((segment, i) => {
        matrix.makeRotationFromEuler(segment.rotation);
        matrix.setPosition(segment.position);
        archwayRef.current?.setMatrixAt(i, matrix);
      });
      archwayRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update middle poles instances
    if (middlePolesRef.current) {
      middlePolesPositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y, position.z);
        middlePolesRef.current?.setMatrixAt(i, matrix);
      });
      middlePolesRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [particlePositions, glowPositions, archwayData, middlePolesPositions, count]);

  // Animate particles
  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();

    // Gentle rotation
    groupRef.current.rotation.y = time * 0.065;

    // Update particle positions for floating animation
    if (particleRef.current) {
      const matrix = matrixRef.current;
      particlePositions.forEach((position, i) => {
        const floatOffset = Math.sin(time * 2 + i * 0.1) * 0.2;
        matrix.makeTranslation(
          position.x,
          position.y + floatOffset,
          position.z
        );
        particleRef.current?.setMatrixAt(i, matrix);
      });
      particleRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (!enableParticles) return null;

  return (
    <group ref={groupRef} name="simple-border-effects">
      {/* Floating particles */}
      <instancedMesh
        ref={particleRef}
        args={[particleGeometry, particleMaterial, particleCount]}
        frustumCulled={false}
      />

      {/* 3D pillar effects */}
      <instancedMesh
        ref={glowRef}
        args={[glowGeometry, glowMaterial, count]}
        frustumCulled={false}
      />

      {/* Cone caps on top of pillars */}
      <instancedMesh
        ref={coneRef}
        args={[coneGeometry, coneMaterial, count]}
        frustumCulled={false}
      />

      {/* Middle poles at highest archway points */}
      <instancedMesh
        ref={middlePolesRef}
        args={[middlePolesGeometry, middlePolesMaterial, middlePolesPositions.length]}
        frustumCulled={false}
      />

      {/* Curved archway segments */}
      <instancedMesh
        ref={archwayRef}
        args={[archwayGeometry, archwayMaterial, archwayData.length]}
        frustumCulled={false}
      />
    </group>
  );
};

export default SimpleBorderEffects;
