import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  MeshBasicMaterial,
  PlaneGeometry,
  CircleGeometry,
  BoxGeometry,
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
  const archwayRef = useRef<InstancedMesh>(null);
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
        // Create a smooth curve from start to end angle
        const t = j / (segmentsPerArch - 1);
        const currentAngle = startAngle + (endAngle - startAngle) * t;

        // Calculate position along the arch curve
        const baseX = Math.cos(currentAngle) * archRadius;
        const baseZ = Math.sin(currentAngle) * archRadius;

        // Create parabolic arch shape
        const archProgress = Math.sin(t * Math.PI); // Sine wave for smooth arch
        const y = archProgress * archHeight;

        // Calculate rotation to face outward from center
        const rotation = new Euler(0, currentAngle + Math.PI/2, 0);

        segments.push({
          position: new Vector3(baseX, y, baseZ),
          rotation: rotation
        });
      }
    }

    return segments;
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

  // Geometries
  const particleGeometry = useMemo(() => new PlaneGeometry(0.05, 0.05), []);
  const glowGeometry = useMemo(() => new BoxGeometry(0.0625, 1.5, 0.0625), []); // 3D pillars visible from all angles
  const archwayGeometry = useMemo(() => new BoxGeometry(0.08, 0.15, 0.08), []); // Thicker segments for archways

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      particleGeometry.dispose();
      glowGeometry.dispose();
      archwayGeometry.dispose();
      particleMaterial.dispose();
      glowMaterial.dispose();
      archwayMaterial.dispose();
    };
  }, [particleGeometry, glowGeometry, archwayGeometry, particleMaterial, glowMaterial, archwayMaterial]);

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

    // Update archway instances
    if (archwayRef.current) {
      archwayData.forEach((segment, i) => {
        matrix.makeRotationFromEuler(segment.rotation);
        matrix.setPosition(segment.position);
        archwayRef.current?.setMatrixAt(i, matrix);
      });
      archwayRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [particlePositions, glowPositions, archwayData]);

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
