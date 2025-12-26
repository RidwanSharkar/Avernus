import React, { useRef, useMemo, useEffect } from 'react';
import { Group, MeshStandardMaterial, CylinderGeometry, ConeGeometry, PlaneGeometry, SphereGeometry } from 'three';

interface TotemModelProps {
  isAttacking: boolean;
}

export default function TotemModel({ isAttacking }: TotemModelProps) {
  const totemRef = useRef<Group>(null);

  // Create geometries with useMemo for performance
  const geometries = useMemo(() => ({
    tower: new CylinderGeometry(0.6, 0.8, 4, 8),
    spike: new ConeGeometry(0.2, 0.8, 4),
    rune: new PlaneGeometry(0.2, 0.2),
    crown: new ConeGeometry(0.15, 1.2, 4),
    eye: new SphereGeometry(0.45, 32, 32),
    base: new CylinderGeometry(1, 1.2, 0.6, 8),
    lightning: new SphereGeometry(0.1, 16, 16)
  }), []);

  // Create materials with useMemo for performance
  const materials = useMemo(() => ({
    bone: new MeshStandardMaterial({
      color: "#A0C8E0",
      roughness: 0.3,
      metalness: 0.7
    }),
    spikes: new MeshStandardMaterial({
      color: "#8BB8D0",
      roughness: 0.3,
      metalness: 0.7
    }),
    runes: new MeshStandardMaterial({
      color: "#0099ff",
      emissive: "#0099ff",
      transparent: true,
      opacity: 0.9
    }),
    crown: new MeshStandardMaterial({
      color: "#B8D8F0",
      roughness: 0.2,
      metalness: 0.8
    })
  }), []);

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Dispose geometries
      geometries.tower.dispose();
      geometries.spike.dispose();
      geometries.rune.dispose();
      geometries.crown.dispose();
      geometries.eye.dispose();
      geometries.base.dispose();
      geometries.lightning.dispose();
      // Dispose materials
      materials.bone.dispose();
      materials.spikes.dispose();
      materials.runes.dispose();
      materials.crown.dispose();
    };
  }, [geometries, materials]);

  return (
    <group ref={totemRef} scale={0.3} position={[0, -0.80, 0]}>
      {/* Main tower structure */}
      <mesh position={[0, 1.75, 0]} geometry={geometries.tower} material={materials.bone} />

   
      {/* Glowing rune circles */}
      {[1.25, 2.25, 3.25].map((height, i) => (
        <group key={i} position={[0, height, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.75, 0.075, 16, 32]} />
            <meshStandardMaterial
              color="#0099ff"
              emissive="#0099ff"
              transparent
              opacity={0.9}
              emissiveIntensity={isAttacking ? 3 : 1}
            />
          </mesh>
          {/* Floating rune symbols */}
          {[...Array(4)].map((_, j) => (
            <mesh
              key={j}
              position={[
                Math.cos((Math.PI * 2 * j) / 4) * 0.7,
                Math.sin(Date.now() * 0.001 + j) * 0.1,
                Math.sin((Math.PI * 2 * j) / 4) * 0.7
              ]}
              geometry={geometries.rune}
            >
              <meshStandardMaterial
                color="#0099ff"
                emissive="#0099ff"
                transparent
                opacity={0.8}
                emissiveIntensity={isAttacking ? 4 : 2}
                side={2}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Top crown structure */}
      <group position={[0, 3.75, 0]}>
  

        {/* Central eye */}
        <mesh position={[0, 0.35, 0]} geometry={geometries.eye}>
          <meshStandardMaterial
            color="#0099ff"
            emissive="#0099ff"
            transparent
            opacity={0.9}
            emissiveIntensity={isAttacking ? 5 : 3}
          />
        </mesh>
      </group>

      {/* Base structure */}
      <mesh position={[0, 0.1, 0]} geometry={geometries.base} material={materials.bone} />

    </group>
  );
}
