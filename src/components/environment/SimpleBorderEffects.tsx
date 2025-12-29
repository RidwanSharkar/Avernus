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
  Group
} from '@/utils/three-exports';

interface SimpleBorderEffectsProps {
  radius?: number;
  count?: number;
  enableParticles?: boolean;
  particleCount?: number;
}

/**
 * Ultra-performance border effects using simple geometries and particles
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
  const groupRef = useRef<Group>(null);
  
  // CRITICAL: Cache Matrix4 to prevent memory leak from creating new ones every frame
  const matrixRef = useRef<Matrix4>(new Matrix4());

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

  // Geometries
  const particleGeometry = useMemo(() => new PlaneGeometry(0.05, 0.05), []);
  const glowGeometry = useMemo(() => new BoxGeometry(0.0625, 1.5, 0.0625), []); // 3D pillars visible from all angles

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      particleGeometry.dispose();
      glowGeometry.dispose();
      particleMaterial.dispose();
      glowMaterial.dispose();
    };
  }, [particleGeometry, glowGeometry, particleMaterial, glowMaterial]);

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
  }, [particlePositions, glowPositions]);

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
    </group>
  );
};

export default SimpleBorderEffects;
