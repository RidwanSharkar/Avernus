import React, { useRef, useMemo, useEffect } from 'react';
import { Group, Vector3, SphereGeometry, PlaneGeometry, MeshBasicMaterial, AdditiveBlending } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface SummonedUnitSoulEffectProps {
  position: Vector3;
  playerNumber: number; // 1 for blue, 2 for red
  duration?: number; // Duration in seconds, defaults to auto-complete
  onComplete?: () => void;
}

export default function SummonedUnitSoulEffect({ position, playerNumber, duration, onComplete }: SummonedUnitSoulEffectProps) {
  const soulRef = useRef<Group>(null);
  const progressRef = useRef(0);
  const startPosition = useRef(position.clone());

  // Player colors - much brighter for visibility
  const playerColor = playerNumber === 1 ? '#ffffff' : '#ffffff'; // White for maximum visibility
  const emissiveColor = playerNumber === 1 ? '#ffffff' : '#ffffff'; // Pure white
  const particleColor = playerNumber === 1 ? '#ffffff' : '#ffffff';
  const wispColor = playerNumber === 1 ? '#ffffff' : '#ffffff';

  // Memoized geometries to prevent memory leaks - MASSIVE sizes for debugging visibility
  const geometries = useMemo(() => ({
    mainOrb: new SphereGeometry(.35, 16, 16), //  for visibility testing
    coreOrb: new SphereGeometry(0.5, 8, 8), // Proportionally larger
    particle: new SphereGeometry(0.15, 6, 6), // Larger particles
    wisp: new PlaneGeometry(0.25, 2.0), // Much larger wisps
  }), []);

  // Memoized materials to prevent memory leaks - using MeshBasicMaterial for better visibility
  const materials = useMemo(() => ({
    mainOrb: new MeshBasicMaterial({
      color: emissiveColor,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
    }),
    coreOrb: new MeshBasicMaterial({
      color: emissiveColor,
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending,
    }),
    particle: new MeshBasicMaterial({
      color: emissiveColor,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
    }),
    wisp: new MeshBasicMaterial({
      color: emissiveColor,
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
      side: 2, // DoubleSide
    }),
  }), [emissiveColor]);

  useEffect(() => {
    // Cleanup geometries and materials on unmount
    return () => {
      Object.values(geometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [geometries, materials]);

  useFrame((_, delta) => {
    if (!soulRef.current) return;

    const speed = duration ? (delta / duration) : (delta * 1.8);
    progressRef.current += speed;

    if (progressRef.current >= 1) {
      // Effect complete
      if (onComplete) {
        onComplete();
      }
      return;
    }

    // Move the soul upwards in a curved path with more pronounced drift
    const height = progressRef.current * 10; // Rise 10 units up (higher than HauntedSoulEffect's 8)
    const horizontalDrift = Math.sin(progressRef.current * Math.PI * 3) * 0; // More pronounced horizontal drift

    soulRef.current.position.set(
      startPosition.current.x + horizontalDrift,
      startPosition.current.y + height,
      startPosition.current.z
    );

    // Add pulsing scale to main orb for more visibility
    const pulseScale = 1.0 + Math.sin(progressRef.current * Math.PI * 4) * 0.2;
    if (soulRef.current.children[0]) {
      soulRef.current.children[0].scale.setScalar(pulseScale);
    }


  });

  return (
    <group ref={soulRef} position={[startPosition.current.x, startPosition.current.y, startPosition.current.z]}>
      {/* Main soul orb */}
      <mesh geometry={geometries.mainOrb} material={materials.mainOrb} />

      {/* Inner glowing core */}
      <mesh geometry={geometries.coreOrb} material={materials.coreOrb} />

      {/* Particle trail effect - more particles */}
      <group>
        {Array.from({ length: 10 }, (_, i) => { // Even more particles for better visibility
          const angle = (i / 10) * Math.PI * 2;
          const radius = 0.75; // Larger radius
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = (progressRef.current - i * 0.06) * 1; // Adjusted spacing and height

          if (y < 0) return null;

          return (
            <mesh key={i} position={[x, y, z]} geometry={geometries.particle} material={materials.particle} />
          );
        })}
      </group>

      {/* Spectral wisps - more dynamic */}
      {Array.from({ length: 6 }, (_, i) => { // More wisps for better visibility
        const angle = (i / 6) * Math.PI * 2 + progressRef.current * Math.PI * 2; // Faster rotation
        const radius = 0.7 + Math.sin(progressRef.current * Math.PI * 6) * 0.2; // Larger radius with more variation
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <mesh key={`wisp-${i}`} position={[x, progressRef.current * 8, z]} geometry={geometries.wisp} material={materials.wisp} />
        );
      })}
    </group>
  );
}
