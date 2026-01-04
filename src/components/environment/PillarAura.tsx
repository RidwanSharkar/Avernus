import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Group, Vector3, Color } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface PillarAuraProps {
  parentRef: React.RefObject<Group>;
  isActive: boolean;
  onToggle?: (active: boolean) => void;
  pillarColor: Color; // Three.js Color object for the pillar
}

const PillarAura = forwardRef<{ toggle: () => void; isActive: boolean }, PillarAuraProps>(({
  parentRef,
  isActive,
  onToggle,
  pillarColor
}, ref) => {
  const auraRef = useRef<Group>(null);
  const rotationSpeed = 0.08; // Slower rotation for pillars
  const [internalActive, setInternalActive] = useState(false);

  // Sync with external isActive prop
  useEffect(() => {
    setInternalActive(isActive);
  }, [isActive]);

  const toggle = () => {
    const newState = !internalActive;
    setInternalActive(newState);
    onToggle?.(newState);
  };

  // Expose toggle and isActive through the forwarded ref
  useImperativeHandle(ref, () => ({
    toggle,
    isActive: internalActive
  }));

  useFrame(() => {
    if (auraRef.current && internalActive) {
      // Rotate the aura continuously
      auraRef.current.rotation.y += rotationSpeed * 0.008;
    }
  });

  if (!internalActive) {
    return null;
  }

  return (
    <group ref={auraRef}>
      {/* Rotating inner elements - Player color theme */}
      <group rotation={[0, 0, 0]} position={[0, 0.05, 0]} scale={[1.1, 1.1, 1.1]}>
        {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((rotation, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, rotation]}>
            <ringGeometry args={[0.7, 0.85, 4]} />
            <meshStandardMaterial
              color={pillarColor}
              emissive={pillarColor}
              emissiveIntensity={.2}
              transparent
              opacity={0.6}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Circle base - Player color theme */}
      <mesh position={[0, 0, 0]} scale={[1.175, 1.175, 1.175]}>
        <cylinderGeometry args={[0.75, 0.5, -0.05, 16]} />
        <meshStandardMaterial
          color={pillarColor}
          emissive={pillarColor}
          emissiveIntensity={0.5}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>

      {/* Player-colored light effect */}
      <pointLight
        color={pillarColor}
        intensity={1}
        distance={10}
        decay={1.5}
        position={[0, 0.5, 0]}
      />
    </group>
  );
});

PillarAura.displayName = 'PillarAura';

export default PillarAura;
