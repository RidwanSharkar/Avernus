'use client';

import React, { useMemo, useEffect } from 'react';
import { Vector3, SphereGeometry, TorusGeometry, MeshStandardMaterial, AdditiveBlending } from '@/utils/three-exports';

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
  const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
  const fade = Math.max(0, 1 - (elapsed / duration));

  // Memoized geometries and materials to prevent recreation
  const geometries = useMemo(() => ({
    outerSphere: new SphereGeometry(0.35 * (1 + elapsed * 2), 32, 32),
    innerSphere: new SphereGeometry(0.25 * (1 + elapsed * 3), 24, 24),
    ring1: new TorusGeometry(0.45 * (1 + elapsed * 3), 0.045, 16, 32),
    ring2: new TorusGeometry(0.65 * (1 + elapsed * 3), 0.045, 16, 32),
    ring3: new TorusGeometry(0.85 * (1 + elapsed * 3), 0.045, 16, 32),
    spark: new SphereGeometry(0.05, 8, 8),
  }), [elapsed]);

  const materials = useMemo(() => ({
    outerSphere: new MeshStandardMaterial({
      color: "#0099ff",
      emissive: "#0088cc",
      emissiveIntensity: 0.5 * fade,
      transparent: true,
      opacity: 0.8 * fade,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    innerSphere: new MeshStandardMaterial({
      color: "#0077aa",
      emissive: "#cceeff",
      emissiveIntensity: 0.5 * fade,
      transparent: true,
      opacity: 0.9 * fade,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    ring1: new MeshStandardMaterial({
      color: "#0099ff",
      emissive: "#0088cc",
      emissiveIntensity: 1 * fade,
      transparent: true,
      opacity: 0.6 * fade,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    ring2: new MeshStandardMaterial({
      color: "#0099ff",
      emissive: "#0088cc",
      emissiveIntensity: 1 * fade,
      transparent: true,
      opacity: 0.6 * fade * 0.8,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    ring3: new MeshStandardMaterial({
      color: "#0099ff",
      emissive: "#0088cc",
      emissiveIntensity: 1 * fade,
      transparent: true,
      opacity: 0.6 * fade * 0.6,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    spark: new MeshStandardMaterial({
      color: "#0077aa",
      emissive: "#cceeff",
      emissiveIntensity: 2 * fade,
      transparent: true,
      opacity: 0.8 * fade,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  }), [fade]);

  // Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      Object.values(geometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [geometries, materials]);

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
    <group position={position.toArray()}>
      {/* Outer expanding sphere */}
      <mesh geometry={geometries.outerSphere} material={materials.outerSphere} />

      {/* Inner expanding sphere */}
      <mesh geometry={geometries.innerSphere} material={materials.innerSphere} />

      {/* Expanding rings */}
      <mesh geometry={geometries.ring1} material={materials.ring1} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]} />
      <mesh geometry={geometries.ring2} material={materials.ring2} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]} />
      <mesh geometry={geometries.ring3} material={materials.ring3} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]} />

      {/* Spark particles */}
      {sparks.map((spark, i) => (
        <mesh
          key={`spark-${i}`}
          position={[spark.x, spark.y, spark.z]}
          geometry={geometries.spark}
          material={materials.spark}
        />
      ))}
    </group>
  );
}
