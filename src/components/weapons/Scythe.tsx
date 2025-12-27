import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Shape } from '@/utils/three-exports';
import { DoubleSide } from '@/utils/three-exports';
import { WeaponSubclass } from '@/components/dragon/weapons';
import SpellCastingAura from './SpellCastingAura';

interface ScytheProps {
  parentRef: React.RefObject<Group>;
  currentSubclass?: WeaponSubclass;
  level?: number;
  isEmpowered?: boolean;
  isSpinning?: boolean;
  hasCryoflame?: boolean;
}

// Reusable ScytheModel component
function ScytheModel({ 
  scytheRef, 
  basePosition, 
  isEmpowered = false,
}: { 
  scytheRef: React.RefObject<Group>; 
  basePosition: readonly [number, number, number];
  isEmpowered?: boolean;
}) {
  // Create custom blade shape
  const createBladeShape = () => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    
    // Create thick back edge first
    shape.lineTo(0.4, -0.130);
    shape.bezierCurveTo(
      0.8, 0.22,    // control point 1
      1.33, 0.5,    // control point 2
      1.6, 0.515    // end point (tip)
    );
    
    // Create sharp edge
    shape.lineTo(1.125, 0.75);
    shape.bezierCurveTo(
      0.5, 0.2,
      0.225, 0.0,
      0.1, 0.7
    );
    shape.lineTo(0, 0);
    return shape;
  };

  const bladeExtradeSettings = {
    steps: 1,
    depth: 0.00010,
    bevelEnabled: true,
    bevelThickness: 0.030,
    bevelSize: 0.035,
    bevelSegments: 1,
    curveSegments: 16
  };

  return (
    <group 
      ref={scytheRef} 
      position={[basePosition[0], basePosition[1], basePosition[2]]}
      rotation={[0, 0, Math.PI]}
      scale={[0.65, 0.75, 0.65]}
    >
      {/* Handle */}
      <group position={[0, -0, 0]} rotation={[0, 0, Math.PI + 0.3]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 1.5, 12]} />
          <meshStandardMaterial color="#a86432" roughness={0.7} />
        </mesh>
        
        {/* Decorative wrappings handle */}
        {[...Array(7)].map((_, i) => (
          <mesh key={i} position={[0, 0.6 - i * 0.2, 0]} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.07, 0.01, 8, 16]} />
            <meshStandardMaterial color="#a86432" metalness={0.3} roughness={0.7} />
          </mesh>
        ))}
      </group>
      
      {/* Blade connector */}
      <group position={[-.0, 0., 0]} rotation={[Math.PI / 1, 0, Math.PI - 0.3]}>
        {/* Base connector */}
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
          <meshStandardMaterial color="#2c1810" roughness={0.6} />
        </mesh>

        {/* Rotating glow rings */}
        <group rotation-x={useFrame((state) => state.clock.getElapsedTime() * 2)}>
          <mesh position-y={0.55} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.14, 0.02, 16, 32]} />
            <meshStandardMaterial
              color={isEmpowered ? "#4169E1" : "#00BFFF"}
              emissive={isEmpowered ? "#1E90FF" : "#87CEEB"}
              emissiveIntensity={1.25}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>

        {/* Second ring rotating opposite direction */}
        <group rotation-x={useFrame((state) => -state.clock.getElapsedTime() * 2)}>
          <mesh position-y={-0.55} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.14, 0.02, 16, 32]} />
            <meshStandardMaterial
              color={isEmpowered ? "#4169E1" : "#00BFFF"}
              emissive={isEmpowered ? "#1E90FF" : "#87CEEB"}
              emissiveIntensity={1.25}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>


        {/* HANDLE RING 1 */}
        <group rotation-x={useFrame((state) => -state.clock.getElapsedTime() * 2)}>
          <mesh position-y={-0.4} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.075, 0.02, 16, 32]} />
            <meshStandardMaterial
              color={isEmpowered ? "#4169E1" : "#00BFFF"}
              emissive={isEmpowered ? "#1E90FF" : "#87CEEB"}
              emissiveIntensity={1}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>

        {/* HANDLE RING 2 */}
        <group rotation-x={useFrame((state) => -state.clock.getElapsedTime() * 2)}>
          <mesh position-y={-0.2} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.075, 0.02, 16, 32]} />
            <meshStandardMaterial
              color={isEmpowered ? "#4169E1" : "#00BFFF"}
              emissive={isEmpowered ? "#1E90FF" : "#87CEEB"}
              emissiveIntensity={1.25}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>

        {/* HANDLE RING 3 */}
        <group rotation-x={useFrame((state) => -state.clock.getElapsedTime() * 2)}>
          <mesh position-y={0.2} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.075, 0.02, 16, 32]} />
            <meshStandardMaterial
              color={isEmpowered ? "#4169E1" : "#00BFFF"}
              emissive={isEmpowered ? "#1E90FF" : "#87CEEB"}
              emissiveIntensity={1.25}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>

                {/* HANDLE RING 4 */}
                <group rotation-x={useFrame((state) => -state.clock.getElapsedTime() * 2)}>
          <mesh position-y={0.4} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.075, 0.02, 16, 32]} />
            <meshStandardMaterial
              color={isEmpowered ? "#4169E1" : "#00BFFF"}
              emissive={isEmpowered ? "#1E90FF" : "#87CEEB"}
              emissiveIntensity={1.25}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>

        {/* Static outer glow */}
        <mesh>
          <cylinderGeometry args={[0.13, 0.11, 0.32, 8]} />
          <meshStandardMaterial
            color={isEmpowered ? "#8A2BE2" : "#17CE54"}
            emissive={isEmpowered ? "#8A2BE2" : "#17CE54"}
            emissiveIntensity={1.5}
            transparent
            opacity={0.3}
          />
        </mesh>
      </group>
      
      {/* FIRST BLADE POSITION */}
      <group position={[0.375, 0.45, 0.65]} rotation={[0.2, -Math.PI / 3.6, Math.PI -0.4]} scale={[0.8, 0.45, 0.8]}>
        {/* Base blade */}
        <mesh>
          <extrudeGeometry args={[createBladeShape(), { ...bladeExtradeSettings, depth: 0.03 }]} />
          <meshStandardMaterial
            color={isEmpowered ? "#3FAEFC" : "#3FAEFC"}
            emissive={isEmpowered ? "#3FAEFC" : "#3FAEFC"}
            emissiveIntensity={1.0}
            metalness={0.8}
            roughness={0.1}
            opacity={1}
            transparent
            side={DoubleSide}
          />
        </mesh>
      </group>

      {/* SECOND BLADE POSITION (opposite side) */}
      <group position={[-0.375, -0.45, -0.65]} rotation={[0.2, Math.PI/14 - 1.1, -0.4]} scale={[0.8, 0.45, 0.8]}>
        {/* Second blade */}
        <mesh>
          <extrudeGeometry args={[createBladeShape(), { ...bladeExtradeSettings, depth: 0.03 }]} />
          <meshStandardMaterial
            color={isEmpowered ? "#3FAEFC" : "#3FAEFC"}
            emissive={isEmpowered ? "#3FAEFC" : "#3FAEFC"}
            emissiveIntensity={1.0}
            metalness={0.8}
            roughness={0.1}
            opacity={1}
            transparent
            side={DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function Scythe({
  parentRef,
  currentSubclass = WeaponSubclass.CHAOS,
  level = 1,
  isEmpowered = false,
  isSpinning = false,
  hasCryoflame = false
}: ScytheProps) {
  
  // Debug: Log when empowerment changes
  useEffect(() => {
    if (isEmpowered) {
      // console.log('[Scythe] Legion empowerment activated - showing green trails');
    }
  }, [isEmpowered]);

  // Debug: Log spinning state changes
  useEffect(() => {
    if (isSpinning) {
      // console.log('[Scythe] Spinning animation started');
    }
  }, [isSpinning]);

  // Single scythe ref
  const scytheRef = useRef<Group>(null);
  const spinTime = useRef(0);

  // Aura timing and state
  const [showAura, setShowAura] = useState(false);
  const [auraFadeStart, setAuraFadeStart] = useState(0);
  const leftClickStartTime = useRef(0);
  const lastLeftClickState = useRef(false);

  const basePosition = [-0.9, 0.65, 0.3] as const;

  useFrame((_, delta) => {
    if (!scytheRef.current) return;

    // Handle aura timing logic
    const currentTime = Date.now();

    if (isSpinning && !lastLeftClickState.current) {
      // Spinning just started (left click just started being held)
      leftClickStartTime.current = currentTime;
      setAuraFadeStart(0);
    } else if (!isSpinning && lastLeftClickState.current) {
      // Spinning just stopped (left click just released)
      if (showAura) {
        setAuraFadeStart(currentTime);
      }
    }

    lastLeftClickState.current = isSpinning;

    // Show aura if spinning for more than 1 second
    if (isSpinning && currentTime - leftClickStartTime.current > 1000 && !showAura) {
      setShowAura(true);
      setAuraFadeStart(0);
    }

    // Fade aura after 1 second of not spinning
    if (!isSpinning && showAura && auraFadeStart > 0 && currentTime - auraFadeStart > 1000) {
      setShowAura(false);
      setAuraFadeStart(0);
    }

    if (isSpinning) {
      // Continuously accumulate spin time for smooth rotation
      spinTime.current += delta;

      // Spin the scythe around its center
      const spinSpeed = 25; // Adjust speed as needed
      const currentRotation = spinTime.current * spinSpeed;

      // Position scythe in front of dragon for spinning
      scytheRef.current.position.set(0, 0.5, 1.2);

      // Rotate the scythe around its handle (Z-axis rotation for spinning)
      scytheRef.current.rotation.set(Math.PI/8, 0, currentRotation);
    } else {
      // Reset spin time when not spinning
      spinTime.current = 0;

      // Return to base position when not spinning
      const easeFactor = 0.85;
      scytheRef.current.rotation.x *= easeFactor;
      scytheRef.current.rotation.y *= easeFactor;
      scytheRef.current.rotation.z *= easeFactor;

      scytheRef.current.position.x += (basePosition[0] - scytheRef.current.position.x) * 0.14;
      scytheRef.current.position.y += (basePosition[1] - scytheRef.current.position.y) * 0.14;
      scytheRef.current.position.z += (basePosition[2] - scytheRef.current.position.z) * 0.025;
    }
  });

  // Single scythe only
  return (
    <>
      <ScytheModel scytheRef={scytheRef} basePosition={basePosition} isEmpowered={isEmpowered} />
      <SpellCastingAura parentRef={parentRef} isActive={showAura} hasCryoflame={hasCryoflame} />
    </>
  );
}
