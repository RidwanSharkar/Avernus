import React, { useImperativeHandle, forwardRef, useState, useCallback, useMemo, useRef } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame, RootState } from '@react-three/fiber';

interface ReanimateProps {
  parentRef: React.RefObject<Group>;
}

export interface ReanimateRef {
  triggerHealingEffect: () => void;
}

const HealingEffect: React.FC<{ position: Vector3; onComplete: () => void }> = React.memo(({ position, onComplete }) => {
  const timeRef = useRef(0);
  const duration = 1.5;

  useFrame((_: RootState, delta: number) => {
    timeRef.current += delta;
    if (timeRef.current >= duration) {
      onComplete();
    }
  });

  // Calculate values from ref
  const progress = Math.min(timeRef.current / duration, 1);
  const opacity = Math.sin(progress * Math.PI);
  const scale = 1 + progress * 2;

  // Pre-calculate shared material properties
  const ringMaterial = useMemo(() => ({
    color: "#ffaa00",
    emissive: "#ff8800",
    emissiveIntensity: 2,
    transparent: true
  }), []);

  const particleMaterial = useMemo(() => ({
    color: "#ffaa00",
    emissive: "#ff8800",
    emissiveIntensity: 2,
    transparent: true
  }), []);

  // Pre-generate arrays for iterations
  const rings = useMemo(() => [...Array(3)], []);
  const particles = useMemo(() => [...Array(12)], []);

  return (
    <group position={position.toArray()}>
      {/* Rising healing rings */}
      {rings.map((_, i) => (
        <mesh
          key={`ring-${i}`}
          position={[0, progress * 2 + i * 0.5, 0]}
          rotation={[Math.PI / 2, 0, timeRef.current * 2]}
        >
          <torusGeometry args={[0.8 - i * 0.2, 0.05, 16, 32]} />
          <meshStandardMaterial
            {...ringMaterial}
            opacity={opacity * (1 - i * 0.2)}
          />
        </mesh>
      ))}

      {/* Central healing glow */}
      <mesh scale={[scale, scale, scale]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color="#ffaa00"
          emissive="#ff8800"
          emissiveIntensity={3}
          transparent
          opacity={opacity * 0.3}
        />
      </mesh>

      {/* Healing particles */}
      {particles.map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 0.75 + progress;
        const yOffset = progress * 2;
        
        return (
          <mesh
            key={`particle-${i}`}
            position={[
              Math.cos(angle + timeRef.current * 2) * radius/1.1,
              yOffset + Math.sin(timeRef.current * 3 + i) * 0.5,
              Math.sin(angle + timeRef.current * 2) * radius/1.1
            ]}
          >
            <sphereGeometry args={[0.095, 8, 8]} />
            <meshStandardMaterial
              {...particleMaterial}
              opacity={opacity * 0.8}
            />
          </mesh>
        );
      })}

      {/* Light source */}
      <pointLight
        color="#ff8800"
        intensity={4 * opacity}
        distance={5}
        decay={2}
      />
    </group>
  );
});

HealingEffect.displayName = 'HealingEffect';

const Reanimate = forwardRef<ReanimateRef, ReanimateProps>(({ 
  parentRef,
}, ref) => {
  const [showHealingEffect, setShowHealingEffect] = useState(false);

  // Function to trigger the healing effect
  const triggerHealingEffect = useCallback(() => {
    setShowHealingEffect(true);
  }, []);

  useImperativeHandle(ref, () => ({
    triggerHealingEffect
  }));

  return showHealingEffect && parentRef.current ? (
    <HealingEffect
      position={parentRef.current.position.clone().add(new Vector3(0, 0, 0))}
      onComplete={() => setShowHealingEffect(false)}
    />
  ) : null;
});

Reanimate.displayName = 'Reanimate';

export default Reanimate;
