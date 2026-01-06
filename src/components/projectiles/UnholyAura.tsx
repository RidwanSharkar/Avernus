import { useRef } from 'react';
import { Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { getCachedGeometry } from '@/utils/sharedGeometries';

export default function UnholyAura() {
  const auraRef = useRef<Group>(null);
  const rotationSpeed = 0.12;

  useFrame(() => {
    if (auraRef.current) {
      // Position the aura relative to the parent totem (at the base level)
      // Totem base is at y=0.3 in local space, totem positioned at y=-0.80
      // So base is effectively at y=-0.5, we want aura slightly below that
      auraRef.current.position.set(0, -0.925, 0);
      auraRef.current.rotation.y += rotationSpeed * 0.008;
    }
  });

  return (
    <group ref={auraRef} scale={0.7}>
      {/* Outer corrupted circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <primitive object={getCachedGeometry('ring', 1.0, 1.2, 64)} />
        <meshStandardMaterial
          color="#0099ff"
          emissive="#0099ff"
          emissiveIntensity={1.5}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>

      {/* Spinning rune marks */}
      <group position={[0, 0.02, 0]}>
        {[...Array(8)].map((_, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, (i / 8) * Math.PI * 2 + Date.now() * 0.001]}
            position={[0, 0, 0]}
          >
            <primitive object={getCachedGeometry('plane', 0.2, 1.3)} />
            <meshStandardMaterial
              color="#0099ff"
              emissive="#0099ff"
              emissiveIntensity={2}
              transparent
              opacity={0.4 + Math.sin(Date.now() * 0.003 + i) * 0.2}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Inner pulsing sigils */}
      <group position={[0, 0.03, 0]}>
        {[...Array(5)].map((_, i) => {
          const angle = (i / 5) * Math.PI * 2;
          const radius = 0.6;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle + Date.now() * 0.001) * radius,
                0,
                Math.sin(angle + Date.now() * 0.001) * radius
              ]}
              rotation={[-Math.PI / 2, 0, angle + Math.PI / 2]}
            >
              <primitive object={getCachedGeometry('plane', 0.3, 0.3)} />
              <meshStandardMaterial
                color="#0088cc"
                emissive="#0099ff"
                emissiveIntensity={2}
                transparent
                opacity={0.3 + Math.sin(Date.now() * 0.002 + i * 0.5) * 0.2}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* Corrupted energy streams */}
      <group position={[0, 0.01, 0]}>
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const radius = 0.9 + Math.sin(Date.now() * 0.002 + i) * 0.1;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
              ]}
              rotation={[-Math.PI / 2, 0, angle + Date.now() * 0.0015]}
            >
              <primitive object={getCachedGeometry('plane', 0.1, 0.4)} />
              <meshStandardMaterial
                color="#002244"
                emissive="#0099ff"
                emissiveIntensity={3}
                transparent
                opacity={0.2 + Math.sin(Date.now() * 0.004 + i) * 0.1}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* Center dark core */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={getCachedGeometry('ring', 0.1, 0.5, 32)} />
        <meshStandardMaterial
          color="#001122"
          emissive="#0099ff"
          emissiveIntensity={1.5}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>

      {/* Ambient glow */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={getCachedGeometry('ring', 1.0, 1.1, 64, 1)} />
        <meshStandardMaterial
          color="#0099ff"
          emissive="#0099ff"
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
