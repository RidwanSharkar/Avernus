import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, ConeGeometry, MeshBasicMaterial, RingGeometry, AdditiveBlending, DoubleSide } from 'three';
import { Enemy } from '@/contexts/MultiplayerContext';

interface CloudkillArrowProps {
  targetId: string;
  initialTargetPosition: Vector3;
  onImpact: (damage: number) => void;
  onComplete: () => void;
  playerPosition: Vector3;
  enemyData: Enemy[];
  onHit?: (targetId: string, damage: number, isCritical: boolean, position: Vector3) => void;
  players?: Array<{ id: string; position: { x: number; y: number; z: number }; health?: number }>; // For PVP mode
}

const DAMAGE_RADIUS = 1.5; // Smaller radius for arrows compared to meteors
const IMPACT_DURATION = 1.0;
const ARROW_SPEED = 26.5;
const ARROW_DAMAGE = 75;
const WARNING_RING_SEGMENTS = 6;
const ARROW_COUNT = 3; // 3 arrows per Cloudkill cast

// Reusable geometries and materials
const arrowGeometry = new ConeGeometry(0.1, 0.8, 8); // Arrow shape
const arrowMaterial = new MeshBasicMaterial({ color: "#00ff00" }); // Green arrows

// Trail effect constants
const TRAIL_SEGMENTS = 22; 

// Warning indicators scaled for arrows
const warningRingGeometry = new RingGeometry((DAMAGE_RADIUS - 0.2), DAMAGE_RADIUS, WARNING_RING_SEGMENTS);
const pulsingRingGeometry = new RingGeometry((DAMAGE_RADIUS - 0.4), (DAMAGE_RADIUS - 0.2), WARNING_RING_SEGMENTS);
const outerGlowGeometry = new RingGeometry((DAMAGE_RADIUS - 0.1), DAMAGE_RADIUS, WARNING_RING_SEGMENTS);

// Reusable vectors to avoid allocations
const tempPlayerGroundPos = new Vector3();
const tempTargetGroundPos = new Vector3();

const createArrowImpactEffect = (position: Vector3, startTime: number, onComplete: () => void) => {
  const elapsed = (Date.now() - startTime) / 1000;
  const fade = Math.max(0, 1 - (elapsed / IMPACT_DURATION));

  if (fade <= 0) {
    onComplete();
    return null;
  }

  return (
    <group position={position}>
      {/* Core explosion sphere */}
      <mesh>
        <sphereGeometry args={[0.5 * (1 + elapsed), 16, 16]} />
        <meshStandardMaterial
          color="#00ff00"
          emissive="#00aa00"
          emissiveIntensity={2 * fade}
          transparent
          opacity={1.5 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Inner energy sphere */}
      <mesh>
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshStandardMaterial
          color="#88ff88"
          emissive="#ffffff"
          emissiveIntensity={2 * fade}
          transparent
          opacity={1.6 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Expanding rings */}
      {[1.2, 1.4, 1.6].map((size, i) => (
        <mesh key={i} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}>
          <torusGeometry args={[size * (1 + elapsed * 1.5), 0.15, 3, 16]} />
          <meshStandardMaterial
            color="#00ff00"
            emissive="#00aa00"
            emissiveIntensity={0.7 * fade}
            transparent
            opacity={0.8 * fade * (1 - i * 0.15)}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Dynamic lights with fade */}
      <pointLight
        color="#00ff00"
        intensity={0.6 * fade}
        distance={6 * (1 + elapsed)}
        decay={2}
      />
      <pointLight
        color="#88ff88"
        intensity={0.6 * fade}
        distance={8}
        decay={1}
      />
    </group>
  );
};

// Improved Trail effect component for Cloudkill arrows (comet-like)
const CloudkillTrail = ({ 
  positions, 
  opacity = 1 
}: { 
  positions: Vector3[]; 
  opacity?: number; 
}) => {
  // Don't render if we don't have enough positions
  if (positions.length < 2) return null;

  return (
    <group>
      {positions.map((position, index) => {
        // Calculate alpha based on position in trail (older = less opaque)
        const normalizedIndex = index / Math.max(1, positions.length - 1);
        const alpha = normalizedIndex * opacity * 0.8;
        
        // Calculate size based on position in trail (older = smaller)
        const size = 0.1 + (normalizedIndex * 0.08);
        
        // Skip very faint trail segments
        if (alpha < 0.1) return null;
        
        return (
          <mesh key={`trail-${index}`} position={[position.x, position.y, position.z]}>
            <sphereGeometry args={[size, 8, 8]} />
            <meshBasicMaterial
              color="#00ff00"
              transparent
              opacity={alpha}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      
      {/* Additional bright core particles for the most recent positions */}
      {positions.length > 2 && positions.slice(-Math.min(6, positions.length)).map((position, index, array) => {
        const normalizedIndex = index / Math.max(1, array.length - 1);
        const alpha = normalizedIndex * opacity * 1.2;
        const size = 0.02 + (normalizedIndex * 0.04);
        
        return (
          <mesh key={`core-${index}`} position={[position.x, position.y, position.z]}>
            <sphereGeometry args={[size, 6, 6]} />
            <meshBasicMaterial
              color="#88ff88"
              transparent
              opacity={alpha}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export default function CloudkillArrow({
  targetId,
  initialTargetPosition,
  onImpact,
  onComplete,
  playerPosition,
  enemyData,
  onHit,
  players = []
}: CloudkillArrowProps) {
  const arrowGroupRef = useRef<Group>(null);

  // State for tracking current target position
  const [currentTargetPosition, setCurrentTargetPosition] = useState(initialTargetPosition);

  // Store the original indicated position (where the warning ring was shown)
  // This is separate from currentTargetPosition for homing arrows
  const originalIndicatedPosition = useRef(initialTargetPosition.clone());

  // Chaotic movement variables (similar to EntropicBolt)
  const timeElapsed = useRef(0);
  const randomSeed = useRef(Math.random() * 1000);
  const chaoticOffset = useRef(new Vector3());

  // Trail tracking
  const trailPositions = useRef<Vector3[]>([]);
  const maxTrailLength = TRAIL_SEGMENTS;

  // useMemo for initial calculations
  const [, startPos] = React.useMemo(() => {
    const initTarget = new Vector3(initialTargetPosition.x, -3, initialTargetPosition.z);
    const start = new Vector3(initialTargetPosition.x, 50 + Math.random() * 20, initialTargetPosition.z); // Random height variation
    return [initTarget, start];
  }, [initialTargetPosition]);

  // State management
  const [state, setState] = useState({
    impactOccurred: false,
    showArrow: false,
    impactStartTime: null as number | null,
    warningStartTime: Date.now()
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setState(prev => ({ ...prev, showArrow: true }));
    }, 200); // 0.2 second delay for warning

    return () => clearTimeout(timer);
  }, []);

  useFrame((_, delta) => {
    timeElapsed.current += delta;

    // No target tracking needed - arrows fall straight to initial position

    if (!arrowGroupRef.current || !state.showArrow || state.impactOccurred) {
      if (state.impactOccurred && !state.impactStartTime) {
        setState(prev => ({ ...prev, impactStartTime: Date.now() }));
      }
      return;
    }

    const currentPos = arrowGroupRef.current.position;
    const currentTargetGroundPos = new Vector3(currentTargetPosition.x, -3, currentTargetPosition.z);
    const distanceToTarget = currentPos.distanceTo(currentTargetGroundPos);

    if (distanceToTarget < DAMAGE_RADIUS) {
      setState(prev => ({ ...prev, impactOccurred: true, impactStartTime: Date.now() }));

      // CRITICAL FIX: For damage calculation, check player positions at impact time, not at cast time
      // Always use original indicated position for damage area check (no homing behavior)
      const damagePosition = new Vector3(originalIndicatedPosition.current.x, 0, originalIndicatedPosition.current.z);

      if (onHit) {
        // Damage enemies within radius of the damage position
        enemyData.forEach(enemy => {
          // Only damage living enemies
          if (enemy.health <= 0) return;

          const enemyPos = new Vector3(enemy.position.x, 0, enemy.position.z);
          const distance = enemyPos.distanceTo(damagePosition);
          
          if (distance <= DAMAGE_RADIUS) {
            onHit(enemy.id, ARROW_DAMAGE, false, damagePosition);
          }
        });

        // Damage players within radius of the damage position (at impact time)
        // CRITICAL FIX: Only damage players who are still in the original indicated area at impact time
        // Exclude the original target if they're no longer in the area
        players.forEach(player => {
          if (!player.position) return;

          const playerPos = new Vector3(player.position.x, 0, player.position.z);

          // Always check against original indicated position (no homing behavior)
          const checkPosition = new Vector3(originalIndicatedPosition.current.x, 0, originalIndicatedPosition.current.z);

          const distance = playerPos.distanceTo(checkPosition);

          if (distance <= DAMAGE_RADIUS) {
            // Only damage if player is actually in the area at impact time
            onHit(player.id, ARROW_DAMAGE, false, checkPosition);
          }
        });
      }

      // Also check if local player is in damage radius (at impact time)
      // CRITICAL FIX: For local player, check against original indicated position (no homing behavior)
      tempPlayerGroundPos.set(playerPosition.x, 0, playerPosition.z);

      // Always check against original indicated position (no homing behavior)
      const localPlayerCheckPosition = new Vector3(originalIndicatedPosition.current.x, 0, originalIndicatedPosition.current.z);

      tempTargetGroundPos.set(localPlayerCheckPosition.x, 0, localPlayerCheckPosition.z);

      if (tempPlayerGroundPos.distanceTo(tempTargetGroundPos) <= DAMAGE_RADIUS) {
        onImpact(ARROW_DAMAGE);
      }
      return;
    }

    // Calculate base trajectory towards initial target position (no homing)
    const directionToTarget = currentTargetGroundPos.clone().sub(currentPos).normalize();
    const speed = ARROW_SPEED * delta;

    // Always fall straight down to initial target position (no homing behavior)
    const baseDirection = directionToTarget.clone();

    // Add localized chaotic movement for comet-like effect (much more subtle)
    const time = timeElapsed.current;
    const seed = randomSeed.current;
    
    // Reduced amplitude chaotic movement - more localized and comet-like
    const chaoticX = Math.sin(time * 4 + seed) * 0.08 * Math.sin(time * 2 + seed * 0.3) * 0.6;
    const chaoticY = Math.cos(time * 3 + seed * 1.2) * 0.06 * Math.sin(time * 2.5 + seed * 0.6) * 0.4;
    const chaoticZ = Math.sin(time * 3.5 + seed * 1.8) * 0.05 * Math.cos(time * 2.2 + seed * 0.9) * 0.5;
    
    // Very minimal jitter that decreases with distance
    const jitterIntensity = Math.max(0.02, (distanceToTarget / 80)) * 0.03;
    const jitterX = (Math.random() - 0.5) * jitterIntensity;
    const jitterY = (Math.random() - 0.5) * jitterIntensity;
    const jitterZ = (Math.random() - 0.5) * jitterIntensity;

    // Combine chaotic movement with jitter
    chaoticOffset.current.set(
      chaoticX + jitterX,
      chaoticY + jitterY,
      chaoticZ + jitterZ
    );

    // Apply base movement
    const idealPosition = currentPos.clone().addScaledVector(baseDirection, speed);
    
    // Add chaotic offset to the ideal position
    const finalPosition = idealPosition.add(chaoticOffset.current);
    currentPos.copy(finalPosition);

    // Update trail positions more frequently for better comet effect
    if (trailPositions.current.length >= maxTrailLength) {
      trailPositions.current.shift(); // Remove oldest position
    }
    
    // Store world position for trail (not relative to group)
    const worldPosition = finalPosition.clone();
    trailPositions.current.push(worldPosition);
  });

  const getPulsingScale = useCallback((): [number, number, number] => {
    const scale = 1 + Math.sin(Date.now() * 0.008) * 0.15;
    return [scale, scale, 1] as [number, number, number];
  }, []);

  const warningElapsed = (Date.now() - state.warningStartTime) / 1000;
  const showWarning = !state.impactOccurred; // Show warning until impact occurs

  return (
     <>
      {/* Warning indicators */}
      {showWarning && (
        <group position={[originalIndicatedPosition.current.x, 0.1, originalIndicatedPosition.current.z]}>
          {/* Warning rings using shared geometries */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <primitive object={warningRingGeometry} />
            <meshBasicMaterial color="#00aa00" transparent opacity={0.5} side={DoubleSide} />
          </mesh>

          {/* Pulsing inner ring */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            scale={getPulsingScale()}
          >
            <primitive object={pulsingRingGeometry} />
            <meshBasicMaterial
              color="#00ff00"
              transparent
              opacity={0.5 + Math.sin(Date.now() * 0.005) * 0.3}
              side={DoubleSide}
            />
          </mesh>

          {/* Rotating outer glow ring */}
          <mesh
            rotation={[-Math.PI / 2, Date.now() * 0.004, 0]}
          >
            <primitive object={outerGlowGeometry} />
            <meshBasicMaterial
              color="#00cc00"
              transparent
              opacity={0.3}
              side={DoubleSide}
            />
          </mesh>

          {/* Rising particles */}
          {[...Array(8)].map((_, i) => (
            <mesh
              key={i}
              position={[
                Math.sin(Date.now() * 0.0015 + i) * (DAMAGE_RADIUS - 0.3),
                Math.sin(Date.now() * 0.0025 + i) * 0.3,
                Math.cos(Date.now() * 0.0015 + i) * (DAMAGE_RADIUS - 0.3)
              ]}
            >
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshBasicMaterial
                color="#00ff00"
                transparent
                opacity={0.4 + Math.sin(Date.now() * 0.006 + i) * 0.3}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Trail effect - rendered separately in world space */}
      {state.showArrow && trailPositions.current.length > 2 && (
        <CloudkillTrail
          positions={trailPositions.current}
          opacity={1.0}
        />
      )}

      {/* Arrow projectile */}
      {state.showArrow && (
        <group ref={arrowGroupRef} position={startPos}>
          <mesh rotation={[Math.PI, 0, 0]}> {/* Point downwards */}
            <primitive object={arrowGeometry} />
            <primitive object={arrowMaterial} />
            <pointLight color="#00ff00" intensity={3} distance={6} />
          </mesh>
        </group>
      )}

      {/* Add impact effect */}
      {state.impactStartTime && createArrowImpactEffect(
        arrowGroupRef.current?.position || new Vector3(currentTargetPosition.x, 0, currentTargetPosition.z),
        state.impactStartTime,
        onComplete
      )}
    </>
  );
}
