import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Line, Vector3, BufferGeometry, LineBasicMaterial, AdditiveBlending, BufferAttribute } from '@/utils/three-exports';

interface ChargedArrowTrailProps {
  color: string;
  size: number;
  arrowHeadRef: React.RefObject<Mesh>;
  arrowShaftRef: React.RefObject<Mesh>;
  opacity?: number;
}

function ChargedArrowTrail({ 
  color, 
  size, 
  arrowHeadRef, 
  arrowShaftRef, 
  opacity = 1 
}: ChargedArrowTrailProps) {
  const trailRef = useRef<Line>(null);
  const trailPositions = useRef<Vector3[]>([]);
  const maxTrailLength = 75;
  const initialized = useRef(false);
  
  // Create trail geometry
  const trailGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(maxTrailLength * 3);
    const colors = new Float32Array(maxTrailLength * 3);
    const indices = [];
    
    // Initialize positions and colors
    for (let i = 0; i < maxTrailLength; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      // Gradient from bright orange to transparent
      const alpha = 1 - (i / maxTrailLength);
      colors[i * 3] = 1.0; // R
      colors[i * 3 + 1] = 0.6 * alpha; // G
      colors[i * 3 + 2] = 0.0; // B
    }
    
    // Create line indices
    for (let i = 0; i < maxTrailLength - 1; i++) {
      indices.push(i, i + 1);
    }
    
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    
    return geometry;
  }, [maxTrailLength]);
  
  const trailMaterial = useMemo(() => {
    return new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: opacity * 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
      linewidth: 3
    });
  }, [opacity]);

  // Cleanup geometry and material on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      trailGeometry.dispose();
      trailMaterial.dispose();
    };
  }, [trailGeometry, trailMaterial]);

  useFrame(() => {
    if (!arrowHeadRef.current || !trailRef.current) return;
    
    // Get current arrow world position (not local position)
    const currentPos = new Vector3();
    arrowHeadRef.current.getWorldPosition(currentPos);
    
    // Only start tracking if arrow has moved from origin (0,0,0)
    // This prevents the trail line from appearing from world center
    if (currentPos.lengthSq() < 0.01) return; // Skip if still at/near origin
    
    // Initialize trail with current position to avoid line from origin
    if (!initialized.current) {
      // Fill initial trail with current position
      for (let i = 0; i < maxTrailLength; i++) {
        trailPositions.current.push(currentPos.clone());
      }
      initialized.current = true;
      
      // Also initialize the geometry positions to current position
      const positions = trailGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < maxTrailLength; i++) {
        positions[i * 3] = currentPos.x;
        positions[i * 3 + 1] = currentPos.y;
        positions[i * 3 + 2] = currentPos.z;
      }
      trailGeometry.attributes.position.needsUpdate = true;
      return; // Skip first frame to avoid any artifacts
    }
    
    // Add current position to trail
    trailPositions.current.unshift(currentPos);
    
    // Limit trail length
    if (trailPositions.current.length > maxTrailLength) {
      trailPositions.current.pop();
    }
    
    // Update trail geometry positions
    const positions = trailGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < trailPositions.current.length; i++) {
      const pos = trailPositions.current[i];
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
    }
    
    trailGeometry.attributes.position.needsUpdate = true;
  });

  return (
    <group name="charged-arrow-trail">
      {/* Main trail line */}
      <primitive ref={trailRef} object={new Line(trailGeometry, trailMaterial)} />
      
      {/* Additional particle effects */}
      {trailPositions.current.slice(0, 5).map((pos, index) => (
        <mesh key={index} position={pos}>
          <sphereGeometry args={[size*2 * (0.3 - index * 0.05), 8, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2 - index * 0.3}
            transparent
            opacity={(opacity * (1 - index * 0.2))}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
      
      {/* Sparks effect */}
      {trailPositions.current.slice(0, 3).map((pos, index) => (
        <group key={`spark-${index}`} position={pos}>
          {[0, 1, 2].map((sparkIndex) => (
            <mesh 
              key={sparkIndex}
              position={[
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
              ]}
            >
              <sphereGeometry args={[0.02, 4, 4]} />
              <meshStandardMaterial
                color="#ffcc00"
                emissive="#ff8800"
                emissiveIntensity={3}
                transparent
                opacity={opacity * (1 - index * 0.3)}
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default ChargedArrowTrail;
