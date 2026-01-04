import React, { useRef, useState, useEffect } from 'react';
import { Vector3, AdditiveBlending } from '@/utils/three-exports';

interface CrossentropyExplosionProps {
  position: Vector3;
  chargeTime?: number;
  explosionStartTime: number | null;
  onComplete?: () => void;
}

const IMPACT_DURATION = 0.5; // Slightly longer than the original for more dramatic effect

export default function CrossentropyExplosion({ 
  position, 
  chargeTime = 1,
  explosionStartTime,
  onComplete 
}: CrossentropyExplosionProps) {
  const startTime = useRef(explosionStartTime || Date.now());
  const [, forceUpdate] = useState({}); // Force updates to animate
  const normalizedCharge = Math.min(chargeTime / 4, 1.0);
  const scale = 0.5 + (normalizedCharge * 1.0); // Increased base scale for more impact
  const intensity = 2.5 + (normalizedCharge * 4); // Higher intensity for Crossentropy
  const sparkCount = 10; // Reduced sparks while maintaining boldness
  
  useEffect(() => {
    // Animation timer
    const interval = setInterval(() => {
      forceUpdate({});
      
      // Check if we should clean up
      const elapsed = (Date.now() - startTime.current) / 1000;
      if (elapsed > IMPACT_DURATION) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 16); // ~60fps
    
    // Cleanup timer after explosion duration
    const timer = setTimeout(() => {
      clearInterval(interval);
      if (onComplete) onComplete();
    }, IMPACT_DURATION * 1000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onComplete]);

  // Calculate fade based on elapsed time
  const elapsed = (Date.now() - startTime.current) / 1000;
  const duration = IMPACT_DURATION;
  const fade = Math.max(0, 1 - (elapsed / duration));
  
  if (fade <= 0) return null;

  // More dynamic effect - faster expansion for initial impact
  const expansionRate = 4 + (elapsed < 0.15 ? 10 : 0); // Faster initial expansion

  return (
    <group position={position}>
      {/* Core explosion sphere - Deep orange fiery for Crossentropy */}
      <mesh>
        <sphereGeometry args={[0.4 * scale * (1 + elapsed * expansionRate), 32, 32]} />
        <meshStandardMaterial
          color="#FF4500" // Deep orange
          emissive="#FF6600"
          emissiveIntensity={intensity * fade * 0.6}
          transparent
          opacity={0.85 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      
      {/* Inner energy sphere - Brighter orange */}
      <mesh>
        <sphereGeometry args={[0.5 * scale * (1 + elapsed * (expansionRate + 1)), 24, 24]} />
        <meshStandardMaterial
          color="#FF6600" // Fire orange
          emissive="#FFA500" // Bright orange
          emissiveIntensity={intensity * 0.6 * fade}
          transparent
          opacity={0.9 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Outer energy sphere - Bright orange */}
      <mesh>
        <sphereGeometry args={[0.6 * scale * (1 + elapsed * (expansionRate + 2)), 16, 16]} />
        <meshStandardMaterial
          color="#FFA500" // Bright orange
          emissive="#FFD700" // Gold
          emissiveIntensity={intensity * 0.4 * fade}
          transparent
          opacity={0.7 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Multiple expanding rings with orange fiery theme */}
      {[0.5, 0.7, 0.85, 1.0, 1.2, 1.4].map((ringSize, i) => (
        <mesh key={i} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}>
          <torusGeometry args={[ringSize * scale * (1 + elapsed * (expansionRate + 2)), 0.08 * scale, 16, 32]} />
          <meshStandardMaterial
            color="#FF4500"
            emissive="#FF6600"
            emissiveIntensity={intensity * fade * 0.4}
            transparent
            opacity={0.8 * fade * (1 - i * 0.12)}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Particle sparks - purple/magenta theme with more dynamic positioning */}
      {[...Array(sparkCount)].map((_, i) => {
        const angle = (i / sparkCount) * Math.PI * 2;
        const randomOffset = Math.random() * 0.4;
        const radius = scale * (1 + elapsed * (expansionRate - 0.5)) * (1 + randomOffset);
        const yOffset = (Math.random() - 0.5) * 0.6; // More vertical variation
        const zOffset = (Math.random() - 0.5) * 0.4; // Add depth variation
        
        return (
          <mesh
            key={`spark-${i}`}
            position={[
              Math.sin(angle) * radius,
              Math.cos(angle) * radius + yOffset,
              zOffset
            ]}
          >
            <sphereGeometry args={[0.1 * scale, 8, 8]} />
            <meshStandardMaterial
              color="#FFA500" // Bright orange sparks
              emissive="#FFD700" // Gold emissive emissive
              emissiveIntensity={intensity * 1.5 * fade}
              transparent
              opacity={0.95 * fade}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Secondary smaller sparks for more detail */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / (sparkCount * 2)) * Math.PI * 2 + Math.random() * 0.5;
        const randomOffset = Math.random() * 0.3;
        const radius = scale * 0.7 * (1 + elapsed * (expansionRate + 1)) * (1 + randomOffset);
        const yOffset = (Math.random() - 0.5) * 0.4;
        const zOffset = (Math.random() - 0.5) * 0.3;
        
        return (
          <mesh
            key={`small-spark-${i}`}
            position={[
              Math.sin(angle) * radius,
              Math.cos(angle) * radius + yOffset,
              zOffset
            ]}
          >
            <sphereGeometry args={[0.05 * scale, 6, 6]} />
            <meshStandardMaterial
              color="#FF6600" // Fire orange
              emissive="#FFA500" // Bright orange
              emissiveIntensity={intensity * 1.8 * fade}
              transparent
              opacity={0.9 * fade}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Dynamic lights - orange fiery theme */}
      <pointLight
        color="#FF4500" // Deep orange
        intensity={intensity * 4 * fade}
        distance={6 * scale}
        decay={1.8}
      />
      <pointLight
        color="#FFA500" // Bright orange
        intensity={intensity * 2 * fade}
        distance={9 * scale}
        decay={1.5}
      />
      
      {/* Additional bright flash at the beginning - more intense for Crossentropy */}
      {elapsed < 0.15 && (
        <pointLight
          color="#FFD700" // Gold
          intensity={intensity * 8 * (1 - elapsed * 6.67)} // Fade over 0.15 seconds
          distance={4 * scale}
          decay={1}
        />
      )}

      {/* Ambient glow effect */}
      <pointLight
        color="#FF6600" // Fire orange
        intensity={intensity * 1.2 * fade}
        distance={12 * scale}
        decay={2}
      />
    </group>
  );
}
