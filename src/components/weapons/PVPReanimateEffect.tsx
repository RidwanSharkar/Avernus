import React, { useState, useCallback } from 'react';
import { Vector3 } from 'three';
import { useFrame, RootState } from '@react-three/fiber';

interface PVPReanimateEffectProps {
  position: Vector3;
  onComplete: () => void;
}

const PVPReanimateEffect: React.FC<PVPReanimateEffectProps> = React.memo(({ position, onComplete }) => {
  const [time, setTime] = useState(0);
  const duration = 1.5;

  useFrame((_, delta) => {
    setTime(prev => {
      const newTime = prev + delta;
      if (newTime >= duration) {
        // Defer the onComplete callback to avoid setState during render
        setTimeout(() => onComplete(), 0);
      }
      return newTime;
    });
  });

  const progress = time / duration;
  const opacity = Math.sin(progress * Math.PI);
  const scale = 1 + progress * 2;

  return (
    <group position={position.toArray()}>
      {/* Rising healing rings */}
      {[...Array(3)].map((_, i) => (
        <mesh
          key={`ring-${i}`}
          position={[0, progress * 2 + i * 0.5, 0]}
          rotation={[Math.PI / 2, 0, time * 2]}
        >
          <torusGeometry args={[0.8 - i * 0.2, 0.05, 16, 32]} />
          <meshStandardMaterial
            color="#ffaa00"
            emissive="#ff8800"
            emissiveIntensity={1.5}
            transparent
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
          emissiveIntensity={2}
          transparent
          opacity={opacity * 0.3}
        />
      </mesh>

      {/* Healing particles */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 0.75 + progress;
        const yOffset = progress * 2;

        return (
          <mesh
            key={`particle-${i}`}
            position={[
              Math.cos(angle + time * 2) * radius/1.1,
              yOffset + Math.sin(time * 3 + i) * 0.5,
              Math.sin(angle + time * 2) * radius/1.1
            ]}
          >
            <sphereGeometry args={[0.095, 8, 8]} />
            <meshStandardMaterial
              color="#ffaa00"
              emissive="#ff8800"
              emissiveIntensity={2.5}
              transparent
              opacity={opacity * 0.8}
            />
          </mesh>
        );
      })}

      {/* Light source */}
      <pointLight
        color="#ff8800"
        intensity={2 * opacity}
        distance={5}
        decay={2}
      />
    </group>
  );
});

PVPReanimateEffect.displayName = 'PVPReanimateEffect';

export default PVPReanimateEffect;
