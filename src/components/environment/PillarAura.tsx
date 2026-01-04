import { useRef, useImperativeHandle, forwardRef, useState, useEffect, useMemo } from 'react';
import { Group, Vector3, Color, RingGeometry, CylinderGeometry } from '@/utils/three-exports';
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

  // CRITICAL FIX: Memoize geometries to prevent recreation every frame
  const geometries = useMemo(() => ({
    ring: new RingGeometry(0.7, 0.85, 4),
    cylinder: new CylinderGeometry(0.75, 0.5, -0.05, 16),
  }), []);

  // Cleanup geometries on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(geometries).forEach(geometry => geometry.dispose());
    };
  }, [geometries]);

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
          <mesh key={i} rotation={[-Math.PI / 2, 0, rotation]} geometry={geometries.ring}>
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
      <mesh position={[0, 0, 0]} scale={[1.175, 1.175, 1.175]} geometry={geometries.cylinder}>
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
