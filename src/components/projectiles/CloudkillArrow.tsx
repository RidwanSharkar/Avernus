import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
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
  // Add callback to get real-time player positions at impact time
  getCurrentPlayerPositions?: () => Array<{ id: string; position: { x: number; y: number; z: number }; health?: number }>;
  localSocketId?: string; // To identify the local player for onImpact callback
}

const DAMAGE_RADIUS = 1.5; // Smaller radius for arrows compared to meteors
const IMPACT_DURATION = 1.0;
const ARROW_SPEED = 26.5;
const ARROW_DAMAGE = 75;
const WARNING_RING_SEGMENTS = 6;
const ARROW_COUNT = 3; // 3 arrows per Cloudkill cast

// Trail effect constants
const TRAIL_SEGMENTS = 20;



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
  players = [],
  getCurrentPlayerPositions,
  localSocketId
}: CloudkillArrowProps) {
  const arrowGroupRef = useRef<Group>(null);

  // Create geometries and materials with useMemo for proper disposal
  const geometries = useMemo(() => ({
    arrow: new ConeGeometry(0.1, 0.8, 8),
    warningRing: new RingGeometry((DAMAGE_RADIUS - 0.2), DAMAGE_RADIUS, WARNING_RING_SEGMENTS),
    pulsingRing: new RingGeometry((DAMAGE_RADIUS - 0.4), (DAMAGE_RADIUS - 0.2), WARNING_RING_SEGMENTS),
    outerGlow: new RingGeometry((DAMAGE_RADIUS - 0.1), DAMAGE_RADIUS, WARNING_RING_SEGMENTS)
  }), []);

  const materials = useMemo(() => ({
    arrow: new MeshBasicMaterial({ color: "#00ff00" })
  }), []);

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      geometries.arrow.dispose();
      geometries.warningRing.dispose();
      geometries.pulsingRing.dispose();
      geometries.outerGlow.dispose();
      materials.arrow.dispose();
    };
  }, [geometries, materials]);

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
    }, 100); // 0.2 second delay for warning

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
      // Position damage numbers above ground level for visibility
      const damagePosition = new Vector3(originalIndicatedPosition.current.x, 2.5, originalIndicatedPosition.current.z);

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
        // CRITICAL FIX: Get real-time player positions at impact time, not stale snapshot
        const realTimePlayerPositions = getCurrentPlayerPositions ? getCurrentPlayerPositions() : players;
        
        realTimePlayerPositions.forEach(player => {
          if (!player.position) return;

          // Use the real-time player position at impact time
          const currentPlayerPos = new Vector3(player.position.x, player.position.y, player.position.z);

          // Always check against original indicated position (no homing behavior)
          const impactAreaCenter = new Vector3(originalIndicatedPosition.current.x, 0, originalIndicatedPosition.current.z);

          const distanceFromImpactArea = currentPlayerPos.distanceTo(impactAreaCenter);

          // Only damage if player is currently within the damage radius at impact time
          if (distanceFromImpactArea <= DAMAGE_RADIUS) {
            // Position damage numbers at player height for visibility (like other abilities)
            const damagePosition = new Vector3(player.position.x, player.position.y + 1.5, player.position.z);
            onHit(player.id, ARROW_DAMAGE, false, damagePosition);
          }
        });
      }

      // Also check if local player is in damage radius (at impact time)
      // CRITICAL FIX: Use real-time position data instead of stale playerPosition prop
      if (getCurrentPlayerPositions && localSocketId) {
        // Find the local player in the real-time positions
        const realTimePositions = getCurrentPlayerPositions();
        const localPlayer = realTimePositions.find(player => player.id === localSocketId);
        
        if (localPlayer && localPlayer.position) {
          // Use the real-time local player position at impact time
          const localPlayerCurrentPos = new Vector3(localPlayer.position.x, 0, localPlayer.position.z);
          const localPlayerImpactAreaCenter = new Vector3(originalIndicatedPosition.current.x, 0, originalIndicatedPosition.current.z);
          
          const localPlayerDistanceFromImpact = localPlayerCurrentPos.distanceTo(localPlayerImpactAreaCenter);
          
          // Only trigger onImpact if local player is currently within the damage radius at impact time
          if (localPlayerDistanceFromImpact <= DAMAGE_RADIUS) {
            onImpact(ARROW_DAMAGE);
          }
        }
      } else {
        // Fallback to the old method only if getCurrentPlayerPositions is not available
        const localPlayerCurrentPos = new Vector3(playerPosition.x, 0, playerPosition.z);
        const localPlayerImpactAreaCenter = new Vector3(originalIndicatedPosition.current.x, 0, originalIndicatedPosition.current.z);
        
        const localPlayerDistanceFromImpact = localPlayerCurrentPos.distanceTo(localPlayerImpactAreaCenter);
        
        if (localPlayerDistanceFromImpact <= DAMAGE_RADIUS) {
          onImpact(ARROW_DAMAGE);
        }
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
          {/* Warning rings using component geometries */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometries.warningRing}>
            <meshBasicMaterial color="#00aa00" transparent opacity={0.5} side={DoubleSide} />
          </mesh>

          {/* Pulsing inner ring */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            scale={getPulsingScale()}
            geometry={geometries.pulsingRing}
          >
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
            geometry={geometries.outerGlow}
          >
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
          <mesh rotation={[Math.PI, 0, 0]} geometry={geometries.arrow} material={materials.arrow}>
            <pointLight color="#00ff00" intensity={3} distance={6} />
          </mesh>
        </group>
      )}

    </>
  );
}
