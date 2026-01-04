import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group, AdditiveBlending, Color, SphereGeometry } from 'three';
import { MeshStandardMaterial } from '@/utils/three-exports';

interface ElementalVortexProps {
  parentRef: React.RefObject<Group>;
  towerColor: Color;
}

// Shared geometry to prevent memory leaks
const sharedVortexGeometry = new SphereGeometry(0.15, 8, 8);

const createVortexPiece = (towerColor: Color) => (
  <group>
    {/* Mist-like particle similar to ReaperMistEffect */}
    <mesh geometry={sharedVortexGeometry}>
      <meshStandardMaterial
        color={towerColor}
        emissive={towerColor}
        emissiveIntensity={0.35}
        transparent
        opacity={0.7}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  </group>
);

function ElementalVortex({ parentRef, towerColor }: ElementalVortexProps) {
  const vortexPiecesRef = useRef<(Group | null)[]>([]);
  const pieceCount = 25; // More particles for denser effect
  const baseRadius = 1.15; // Larger radius
  const groupRef = useRef<Group>(null);

  // CRITICAL FIX: Don't dispose shared geometry! It's used by all ElementalVortex instances
  // The shared geometry will be disposed when the module unloads or app closes
  
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    vortexPiecesRef.current.forEach((piece, i) => {
      if (!piece) return;
      
      const time = clock.getElapsedTime();
      const heightOffset = ((i / pieceCount) * 1.5 - 0.175); // Taller vortex
      const radiusMultiplier = 0.8 - (heightOffset * 0.425); // Gentler taper
      
      // More complex spiral motion like mist particles
      const spiralAngle = (i / pieceCount) * Math.PI * 6 + time * 1.5;
      const floatAngle = time * 2 + i * 0.5;
      const radius = baseRadius * radiusMultiplier + Math.sin(floatAngle) * 0.2;
      
      const x = Math.cos(spiralAngle) * radius;
      const z = Math.sin(spiralAngle) * radius;
      const y = heightOffset + Math.sin(time * 2 + i) * 0.3 + 0.3; // Start from ground level, swirl up around Elite
      
      piece.position.set(x, y, z);
      
      // Gentle rotation like mist particles
      piece.rotation.y = spiralAngle + Math.PI / 2;
      piece.rotation.x = Math.sin(time + i) * 0.2;
      piece.rotation.z = Math.cos(time * 0.8 + i) * 0.2;
      
              // Fade particles as they rise (like mist)
        const meshChild = piece.children[0] as Mesh;
        if (meshChild && meshChild.material) {
          const material = meshChild.material as MeshStandardMaterial;
          const fadeProgress = heightOffset / 1.5;
          material.opacity = Math.max(0.2, 0.8 * (1 - fadeProgress)); // More visible
          
          // Scale particles down as they rise
          const scale = 1 - fadeProgress * 0.3; // Less scaling
          piece.scale.setScalar(scale);
        }
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: pieceCount }).map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) vortexPiecesRef.current[i] = el;
          }}
        >
          {createVortexPiece(towerColor)}
        </group>
      ))}
      
      <pointLight
        color={towerColor}
        intensity={12}
        distance={12}
        decay={1.2}
        position={[0, 0.5, 0]}
      />
    </group>
  );
}

export default ElementalVortex;