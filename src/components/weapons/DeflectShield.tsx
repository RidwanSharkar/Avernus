import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3, Color, AdditiveBlending, DoubleSide } from '@/utils/three-exports';

interface DeflectShieldProps {
  isActive: boolean;
  duration: number;
  onComplete?: () => void;
  playerPosition?: Vector3;
  playerRotation?: Vector3;
  dragonGroupRef?: React.RefObject<Group>; // Reference to the dragon's group for real-time position
}

export default function DeflectShield({ 
  isActive, 
  duration, 
  onComplete,
  playerPosition = new Vector3(0, 0, 0),
  playerRotation = new Vector3(0, 0, 0),
  dragonGroupRef
}: DeflectShieldProps) {
  const shieldRef = useRef<Group>(null);
  const startTime = useRef<number | null>(null);
  const animationProgress = useRef(0);

  // Reset when shield becomes active
  useEffect(() => {
    if (isActive) {
      startTime.current = Date.now();
      animationProgress.current = 0;
    } else {
      startTime.current = null;
      animationProgress.current = 0;
    }
  }, [isActive]);

  useFrame((_, delta) => {
    if (!shieldRef.current || !isActive || !startTime.current) return;

    const elapsed = (Date.now() - startTime.current) / 1000;
    const progress = Math.min(elapsed / duration, 1);
    animationProgress.current = progress;

    // Get real-time position and rotation from dragon group if available
    let currentPosition = playerPosition;
    let currentRotation = playerRotation;
    
    if (dragonGroupRef?.current) {
      // Use the dragon's actual current position and rotation
      currentPosition = dragonGroupRef.current.position;
      currentRotation = new Vector3(
        dragonGroupRef.current.rotation.x,
        dragonGroupRef.current.rotation.y,
        dragonGroupRef.current.rotation.z
      );
    }

    // Position shield in front of player using REAL-TIME position and rotation
    // Calculate forward direction based on current rotation (Y rotation only for horizontal facing)
    const forwardDirection = new Vector3(
      Math.sin(currentRotation.y), // X component
      0,                          // Y component (keep level)
      Math.cos(currentRotation.y - 0.75) // FRONT is Z+
    );
    
    // Position shield 2.5 units in front of player using REAL-TIME position
    const shieldPosition = currentPosition.clone().add(forwardDirection.multiplyScalar(2.5));
    shieldPosition.y += 0.25; // Raise shield to player center height
    
    shieldRef.current.position.copy(shieldPosition);
    
    // Rotate shield to face same direction as player using REAL-TIME rotation
    shieldRef.current.rotation.set(
      currentRotation.x,
      currentRotation.y,
      currentRotation.z
    );

    // Animate shield appearance and disappearance - KEEP CONSISTENT SIZE
    let opacity = 1;
    
    if (progress < 0.1) {
      // Fade in quickly - only change opacity, not scale
      const fadeProgress = progress / 0.1;
      opacity = fadeProgress;
    } else if (progress > 0.9) {
      // Fade out quickly - only change opacity, not scale
      const fadeProgress = (progress - 0.9) / 0.1;
      opacity = 1 - fadeProgress;
    }

    // Scale is now set in JSX, no need to set it here
    
    // Update material opacity for all children
    shieldRef.current.traverse((child: any) => {
      if (child.material) {
        child.material.opacity = opacity;
      }
    });

    // Pulsing effect
    const pulseIntensity = 1 + Math.sin(elapsed * 8) * 0.3;
    shieldRef.current.traverse((child: any) => {
      if (child.material && child.material.emissiveIntensity !== undefined) {
        child.material.emissiveIntensity = pulseIntensity;
      }
    });

    // Complete when duration is reached
    if (progress >= 1) {
      onComplete?.();
    }
  });

  if (!isActive) return null;

  return (
    <group ref={shieldRef} scale={0.275}>
      {/* Main shield disc */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3, 3, 0.1, 32]} />
        <meshStandardMaterial
          color={new Color(0xFFD700)}
          emissive={new Color(0xFFA500)}
          emissiveIntensity={1.5}
          transparent
          opacity={0.7}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Inner glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.05, 32]} />
        <meshStandardMaterial
          color={new Color(0xFFFFFF)}
          emissive={new Color(0xFFD700)}
          emissiveIntensity={2}
          transparent
          opacity={0.5}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Outer energy ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.5, 3.5, 0.02, 32]} />
        <meshStandardMaterial
          color={new Color(0xFFA500)}
          emissive={new Color(0xFF6F00)}
          emissiveIntensity={1}
          transparent
          opacity={0.3}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Central star pattern */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        {[...Array(8)].map((_, i) => (
          <mesh 
            key={i} 
            position={[
              Math.cos(i * Math.PI / 4) * 1.5,
              Math.sin(i * Math.PI / 4) * 1.5,
              0.05
            ]}
            rotation={[0, 0, i * Math.PI / 4]}
          >
            <boxGeometry args={[0.8, 0.1, 0.05]} />
            <meshStandardMaterial
              color={new Color(0xFFFFFF)}
              emissive={new Color(0xFFD700)}
              emissiveIntensity={3}
              transparent
              opacity={0.8}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* Divine cross in center */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        {/* Vertical beam */}
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry args={[0.15, 2.5, 0.05]} />
          <meshStandardMaterial
            color={new Color(0xFFFFFF)}
            emissive={new Color(0xFFD700)}
            emissiveIntensity={4}
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
          />
        </mesh>
        
        {/* Horizontal beam */}
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry args={[2.5, 0.15, 0.05]} />
          <meshStandardMaterial
            color={new Color(0xFFFFFF)}
            emissive={new Color(0xFFD700)}
            emissiveIntensity={4}
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Particle effects around the shield */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        {[...Array(12)].map((_, i) => (
          <mesh 
            key={`particle-${i}`}
            position={[
              Math.cos(i * Math.PI / 6) * (3.8 + Math.sin(Date.now() * 0.005 + i) * 0.3),
              Math.sin(i * Math.PI / 6) * (3.8 + Math.sin(Date.now() * 0.005 + i) * 0.3),
              Math.sin(Date.now() * 0.003 + i) * 0.2
            ]}
          >
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial
              color={new Color(0xFFD700)}
              emissive={new Color(0xFFA500)}
              emissiveIntensity={2}
              transparent
              opacity={0.6}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* Point light for illumination */}
      <pointLight 
        color={new Color(0xFFD700)}
        intensity={2}
        distance={8}
        decay={2}
      />
    </group>
  );
}
