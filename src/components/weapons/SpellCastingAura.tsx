import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface SpellCastingAuraProps {
  parentRef: React.RefObject<Group>;
  isActive: boolean;
  onToggle?: (active: boolean) => void;
  hasCryoflame?: boolean;
}

const SpellCastingAura = forwardRef<{ toggle: () => void; isActive: boolean }, SpellCastingAuraProps>(({
  parentRef,
  isActive,
  onToggle,
  hasCryoflame = false
}, ref) => {
  const auraRef = useRef<Group>(null);
  const rotationSpeed = 0.12;
  const [internalActive, setInternalActive] = useState(false);
  const [currentOpacity, setCurrentOpacity] = useState(0);
  const fadeSpeed = 0.02; // How fast to fade in/out

  // Color schemes based on Cryoflame state
  const primaryColor = hasCryoflame ? "#1e40af" : "#FF4500"; // Deep cobalt blue or orange-red
  const primaryEmissive = hasCryoflame ? "#3b82f6" : "#FF6600"; // Lighter blue or brighter orange-red
  const secondaryColor = hasCryoflame ? "#3b82f6" : "#FFA500"; // Medium blue or orange
  const secondaryEmissive = hasCryoflame ? "#60a5fa" : "#FFA500"; // Light blue or orange
  const accentColor = hasCryoflame ? "#dbeafe" : "#FFD700"; // Very light blue or gold
  const accentEmissive = hasCryoflame ? "#bfdbfe" : "#FFD700"; // Light blue or gold
  const specialColor = hasCryoflame ? "#06d6a0" : "#FF6B35"; // Teal or fiery orange-red
  const specialEmissive = hasCryoflame ? "#059669" : "#FF4500"; // Dark teal or deep orange-red

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
    if (auraRef.current && parentRef.current) {
      const parentPosition = parentRef.current.position;
      auraRef.current.position.set(parentPosition.x, 0.002, parentPosition.z);
      auraRef.current.rotation.y += rotationSpeed * 0.01;

      // Smooth fade in/out animation
      const targetOpacity = internalActive ? 1 : 0;
      const opacityDiff = targetOpacity - currentOpacity;
      const newOpacity = currentOpacity + opacityDiff * fadeSpeed;
      setCurrentOpacity(Math.abs(opacityDiff) < 0.01 ? targetOpacity : newOpacity);
    }
  });

  if (!internalActive && currentOpacity <= 0) {
    return null;
  }

  return (
    <group ref={auraRef}>
      {/* Primary outer magic circle with intricate runes */}




      {/* Inner rotating runes */}
      <group position={[0, -0.6, 0]} scale={[1, 1, 1]}>
        {[0, Math.PI/2, Math.PI, Math.PI*3/2].map((rotation, i) => (
          <mesh key={`inner-${i}`} rotation={[-Math.PI / 2, 0, rotation + Date.now() * 0.0007]}>
            <ringGeometry args={[0.5, 0.6, 8]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentEmissive}
              emissiveIntensity={2.2}
              transparent
              opacity={0.85 * currentOpacity}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Central magic orb with pulsing effect */}
      <group position={[0, -0.55, 0]}>
        <mesh scale={[1, 0.1, 1]}>
          <cylinderGeometry args={[0.4, 0.2, 0.05, 32]} />
          <meshStandardMaterial
            color={specialColor}
            emissive={specialEmissive}
            emissiveIntensity={2.5 + Math.sin(Date.now() * 0.003) * 0.5}
            transparent
            opacity={0.9 * currentOpacity}
            depthWrite={false}
          />
        </mesh>
        {/* Inner smaller orb */}
        <mesh scale={[1, 0.08, 1]}>
          <cylinderGeometry args={[0.25, 0.15, 0.03, 24]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentEmissive}
            emissiveIntensity={3.0 + Math.cos(Date.now() * 0.004) * 0.3}
            transparent
            opacity={0.95 * currentOpacity}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Floating magical particles in complex orbit */}
      <group position={[0, -0.5, 0]}>
        {[0, Math.PI/3, Math.PI*2/3, Math.PI, Math.PI*4/3, Math.PI*5/3].map((angle, i) => (
          <group key={`particle-group-${i}`}>
            <mesh
              position={[
                Math.cos(angle + Date.now() * 0.001) * 0.9,
                Math.sin(Date.now() * 0.0008 + i) * 0.15,
                Math.sin(angle + Date.now() * 0.001) * 0.9
              ]}
              scale={[0.06, 0.06, 0.06]}
            >
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial
                color={secondaryColor}
                emissive={secondaryEmissive}
                emissiveIntensity={3}
                transparent
                opacity={0.9 * currentOpacity}
                depthWrite={false}
              />
            </mesh>
            {/* Secondary smaller particles */}
            <mesh
              position={[
                Math.cos(angle + Math.PI + Date.now() * 0.0012) * 1.1,
                Math.sin(Date.now() * 0.001 + i) * 0.1,
                Math.sin(angle + Math.PI + Date.now() * 0.0012) * 1.1
              ]}
              scale={[0.04, 0.04, 0.04]}
            >
              <sphereGeometry args={[1, 6, 6]} />
              <meshStandardMaterial
                color={accentColor}
                emissive={accentEmissive}
                emissiveIntensity={2.5}
                transparent
                opacity={0.8 * currentOpacity}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Additional decorative rune rings */}
      <group position={[0, -0.58, 0]} scale={[1, 1, 1]}>
        {[0, Math.PI/6, Math.PI/3, Math.PI/2, Math.PI*2/3, Math.PI*5/6, Math.PI, Math.PI*7/6, Math.PI*4/3, Math.PI*3/2, Math.PI*5/3, Math.PI*11/6].map((rotation, i) => (
          <mesh key={`decorative-${i}`} rotation={[-Math.PI / 2, 0, -rotation - Date.now() * 0.0004]}>
            <ringGeometry args={[0.65, 0.7, 6]} />
            <meshStandardMaterial
              color={specialColor}
              emissive={specialEmissive}
              emissiveIntensity={1.5}
              transparent
              opacity={0.6 * currentOpacity}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Rotating inner elements - Light Purple Theme - From CorruptedAura */}
      <group rotation={[0, 0, 0]} position={[0, -0.7, 0]} scale={[1, 1, 1]}>
        {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((rotation, i) => (
          <mesh key={`corrupted-${i}`} rotation={[-Math.PI / 2, 0, rotation + Date.now() * 0.0008]}>
            <ringGeometry args={[0.85, 1.0, 3]} />
            <meshStandardMaterial
              color={secondaryColor}
              emissive={secondaryEmissive}
              emissiveIntensity={2}
              transparent
              opacity={0.6 * currentOpacity}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Circle - Light Purple Theme - From CorruptedAura */}
      <mesh position={[0, -0.6, 0]} scale={[1, 1, 1]}>
        <cylinderGeometry args={[0.925, 0.5, -0.1, 32]} />
        <meshStandardMaterial
          color={primaryColor}
          emissive={primaryEmissive}
          emissiveIntensity={0.4}
          transparent
          opacity={0.45 * currentOpacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

SpellCastingAura.displayName = 'SpellCastingAura';

export default SpellCastingAura;
