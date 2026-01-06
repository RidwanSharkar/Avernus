'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, SphereGeometry, TorusGeometry, MeshStandardMaterial, AdditiveBlending, Group } from '@/utils/three-exports';

// Shared geometries to prevent memory leaks
const sharedGeometries = {
  outerSphere: new SphereGeometry(1, 32, 32),
  innerSphere: new SphereGeometry(1, 24, 24),
  ring1: new TorusGeometry(1, 0.045, 16, 32),
  ring2: new TorusGeometry(1, 0.045, 16, 32),
  ring3: new TorusGeometry(1, 0.045, 16, 32),
  spark: new SphereGeometry(0.05, 8, 8),
};

interface SummonTotemEffectProps {
  id: number;
  position: Vector3;
  startTime?: number;
  duration?: number;
}

export default function SummonTotemEffect({
  id,
  position,
  startTime,
  duration = 0.2
}: SummonTotemEffectProps) {
  const groupRef = useRef<Group>(null);
  const materialRefs = useRef({});

  // Memoized materials - only create once and update properties in useFrame
  const materials = useMemo(() => ({
    outerSphere: new MeshStandardMaterial({
      color: "#0099ff",
      emissive: "#0088cc",
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    innerSphere: new MeshStandardMaterial({
      color: "#0077aa",
      emissive: "#cceeff",
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    ring1: new MeshStandardMaterial({
      color: "#0099ff",
      emissive: "#0088cc",
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    ring2: new MeshStandardMaterial({
      color: "#0099ff",
      emissive: "#0088cc",
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    ring3: new MeshStandardMaterial({
      color: "#0099ff",
      emissive: "#0088cc",
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    spark: new MeshStandardMaterial({
      color: "#0077aa",
      emissive: "#cceeff",
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  }), []);

  // Cleanup materials on unmount (geometries are shared)
  useEffect(() => {
    return () => {
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [materials]);

  // Update material properties and scaling in useFrame
  useFrame(() => {
    const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
    const fade = Math.max(0, 1 - (elapsed / duration));

    // Update material properties
    materials.outerSphere.emissiveIntensity = 0.5 * fade;
    materials.outerSphere.opacity = 0.8 * fade;
    materials.innerSphere.emissiveIntensity = 0.5 * fade;
    materials.innerSphere.opacity = 0.9 * fade;
    materials.ring1.emissiveIntensity = 1 * fade;
    materials.ring1.opacity = 0.6 * fade;
    materials.ring2.emissiveIntensity = 1 * fade;
    materials.ring2.opacity = 0.6 * fade * 0.8;
    materials.ring3.emissiveIntensity = 1 * fade;
    materials.ring3.opacity = 0.6 * fade * 0.6;
    materials.spark.emissiveIntensity = 2 * fade;
    materials.spark.opacity = 0.8 * fade;

    // Update scaling via group transforms
    if (groupRef.current) {
      const outerScale = 0.35 * (1 + elapsed * 2);
      const innerScale = 0.25 * (1 + elapsed * 3);
      const ring1Scale = 0.45 * (1 + elapsed * 3);
      const ring2Scale = 0.65 * (1 + elapsed * 3);
      const ring3Scale = 0.85 * (1 + elapsed * 3);

      // Apply scaling to child meshes
      const children = groupRef.current.children;
      if (children[0]) children[0].scale.setScalar(outerScale); // outer sphere
      if (children[1]) children[1].scale.setScalar(innerScale); // inner sphere
      if (children[2]) children[2].scale.setScalar(ring1Scale); // ring1
      if (children[3]) children[3].scale.setScalar(ring2Scale); // ring2
      if (children[4]) children[4].scale.setScalar(ring3Scale); // ring3
    }
  });

  // Generate random spark positions
  const sparks = useMemo(() => {
    return Array(8).fill(null).map((_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 0.5;
      return {
        x: Math.sin(angle) * radius,
        z: Math.cos(angle) * radius,
        y: Math.random() * 0.5,
      };
    });
  }, []);

  return (
    <group ref={groupRef} position={position.toArray()}>
      {/* Outer expanding sphere */}
      <mesh geometry={sharedGeometries.outerSphere} material={materials.outerSphere} />

      {/* Inner expanding sphere */}
      <mesh geometry={sharedGeometries.innerSphere} material={materials.innerSphere} />

      {/* Expanding rings */}
      <mesh geometry={sharedGeometries.ring1} material={materials.ring1} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]} />
      <mesh geometry={sharedGeometries.ring2} material={materials.ring2} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]} />
      <mesh geometry={sharedGeometries.ring3} material={materials.ring3} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]} />

      {/* Spark particles */}
      {sparks.map((spark, i) => (
        <mesh
          key={`spark-${i}`}
          position={[spark.x, spark.y, spark.z]}
          geometry={sharedGeometries.spark}
          material={materials.spark}
        />
      ))}
    </group>
  );
}
