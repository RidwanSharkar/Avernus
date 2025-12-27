import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface CorruptedAuraProps {
  parentRef: React.RefObject<Group>;
  isActive: boolean;
  onToggle?: (active: boolean) => void;
}

const CorruptedAura = forwardRef<{ toggle: () => void; isActive: boolean }, CorruptedAuraProps>(({
  parentRef,
  isActive,
  onToggle
}, ref) => {
  const auraRef = useRef<Group>(null);
  const rotationSpeed = 0.15;
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
    if (auraRef.current && parentRef.current && internalActive) {
      const parentPosition = parentRef.current.position;
      auraRef.current.position.set(parentPosition.x, 0.001, parentPosition.z);
      auraRef.current.rotation.y += rotationSpeed * 0.008;
    }
  });

  if (!internalActive) {
    return null;
  }

  return (
    <group ref={auraRef}>
      {/* Rotating inner elements - Light Purple Theme, 1.5x scale */}
      <group rotation={[0, 0, 0]} position={[0, -0.7, 0]} scale={[1, 1, 1]}>
        {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((rotation, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, rotation + Date.now() * 0.0008]}>
            <ringGeometry args={[0.85, 1.0, 3]} />
            <meshStandardMaterial
              color="#cc3333"
              emissive="#cc3333"
              emissiveIntensity={2}
              transparent
              opacity={0.6}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Circle - Light Purple Theme, 1.5x scale */}
      <mesh position={[0, 0.-0.6, 0]} scale={[1, 1, 1]}>
        <cylinderGeometry args={[0.925, 0.5, -0.1, 32]} />
        <meshStandardMaterial
          color="#ff8888"
          emissive="#cc3333"
          emissiveIntensity={0.65}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

CorruptedAura.displayName = 'CorruptedAura';

export default CorruptedAura;
