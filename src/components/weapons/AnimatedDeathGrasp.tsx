import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending, SphereGeometry, CylinderGeometry } from '@/utils/three-exports';

interface AnimatedDeathGraspProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  onHit: (targetId: string, position: Vector3) => void;
  onPullStart: () => void;
  onComplete: () => void;
  // Enemy/player data for collision detection
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  players?: Map<string, any>;
  localSocketId?: string;
}

export default function AnimatedDeathGrasp({
  startPosition,
  targetPosition,
  onHit,
  onPullStart,
  onComplete,
  enemyData = [],
  players,
  localSocketId
}: AnimatedDeathGraspProps) {
  const timeRef = useRef(0);
  const flickerRef = useRef(1);
  const phaseRef = useRef<'forward' | 'return' | 'complete'>('forward');
  const hitTargetRef = useRef<{ id: string; position: Vector3 } | null>(null);
  const pullTriggered = useRef(false);
  
  // Animation timing
  const forwardDuration = 0.6; // Forward projectile phase
  const returnDuration = 0.6;  // Return phase with enemy
  const totalDuration = forwardDuration + returnDuration;

  // Calculate direction and distance
  const direction = useMemo(() => {
    return targetPosition.clone().sub(startPosition).normalize();
  }, [startPosition, targetPosition]);

  const maxRange = useMemo(() => {
    return startPosition.distanceTo(targetPosition);
  }, [startPosition, targetPosition]);

  // Use useMemo for static geometries and materials
  const geometries = useMemo(() => ({
    particle: new SphereGeometry(0.15, 8, 8),
    impact: new SphereGeometry(0.2, 8, 8),
    core: new SphereGeometry(0.18, 8, 8),
    chain: new CylinderGeometry(0.02, 0.02, 1, 6)
  }), []);

  const materials = useMemo(() => ({
    spiral1: new MeshBasicMaterial({
      color: new Color("#cc3333"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    spiral2: new MeshBasicMaterial({
      color: new Color("#ff4444"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    spiral3: new MeshBasicMaterial({
      color: new Color("#ff6666"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    impact: new MeshBasicMaterial({
      color: new Color("#cc3333"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    core: new MeshBasicMaterial({
      color: new Color("#ff4444"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    chain: new MeshBasicMaterial({
      color: new Color("#8B0000"),
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending
    })
  }), []);

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      geometries.particle.dispose();
      geometries.impact.dispose();
      geometries.core.dispose();
      geometries.chain.dispose();
      materials.spiral1.dispose();
      materials.spiral2.dispose();
      materials.spiral3.dispose();
      materials.impact.dispose();
      materials.core.dispose();
      materials.chain.dispose();
    };
  }, [geometries, materials]);

  // Pre-calculate spiraling particle streams for forward phase
  const forwardSpiralStreams = useMemo(() => {
    const segments = Math.ceil(maxRange * 4); // More segments for smoother spirals
    const streams = [[], [], []] as Array<Array<{position: Vector3, scale: number}>>;

    // Create normalized direction vector and perpendicular vectors for spiral calculation (cached in useMemo)
    const up = new Vector3(0, 1, 0);
    const right = new Vector3();
    right.crossVectors(direction, up).normalize();
    const forward = new Vector3();
    forward.crossVectors(right, direction).normalize();

    // Spiral parameters
    const spiralRadius = 0.15;
    const spiralTurns = 3;

    for (let streamIndex = 0; streamIndex < 3; streamIndex++) {
      const phaseOffset = (streamIndex * Math.PI * 2) / 3; // 120 degrees apart

      for (let i = 0; i < segments; i++) {
        const progress = i / segments;
        const basePos = startPosition.clone().lerp(targetPosition, progress);

        // Calculate spiral position
        const spiralAngle = progress * spiralTurns * Math.PI * 2 + phaseOffset;
        const currentRadius = spiralRadius * (1 - progress * 0.3); // Taper towards target

        // Create spiral offset
        const spiralOffset = right.clone().multiplyScalar(Math.cos(spiralAngle) * currentRadius)
          .add(forward.clone().multiplyScalar(Math.sin(spiralAngle) * currentRadius));

        const spiralPos = basePos.clone().add(spiralOffset);

        // Add some organic variation
        const variation = 0.02;
        spiralPos.x += (Math.random() - 0.5) * variation;
        spiralPos.y += (Math.random() - 0.5) * variation;
        spiralPos.z += (Math.random() - 0.5) * variation;

        // Scale particles - larger at start, smaller towards target
        const scale = 1.2 - progress * 0.8 + Math.sin(progress * Math.PI * 6) * 0.1;

        streams[streamIndex].push({
          position: spiralPos,
          scale: Math.max(0.3, scale)
        });
      }
    }

    return streams;
  }, [startPosition, targetPosition, direction, maxRange]);

  // Current projectile position for forward phase
  const currentProjectilePosition = useRef(startPosition.clone());
  const currentReturnPosition = useRef(targetPosition.clone());

  useFrame((_, delta) => {
    timeRef.current = Math.min(timeRef.current + delta, totalDuration);
    flickerRef.current = Math.random() * 0.3 + 0.7;

    const totalProgress = timeRef.current / totalDuration;

    if (phaseRef.current === 'forward') {
      const forwardProgress = Math.min(timeRef.current / forwardDuration, 1);
      
      // Update current projectile position
      currentProjectilePosition.current = startPosition.clone().lerp(targetPosition, forwardProgress);

      // Check for hits during forward phase
      if (forwardProgress < 0.9 && !hitTargetRef.current) {
        checkForHits(currentProjectilePosition.current);
      }

      // Transition to return phase when forward phase completes or target is hit
      if (forwardProgress >= 1.0 || hitTargetRef.current) {
        if (!pullTriggered.current) {
          pullTriggered.current = true;
          onPullStart();
          
          // If we hit a target, use its position; otherwise use the target position
          if (hitTargetRef.current) {
            currentReturnPosition.current = hitTargetRef.current.position.clone();
          } else {
            currentReturnPosition.current = targetPosition.clone();
          }
        }
        
        phaseRef.current = 'return';
        // Reset time for return phase
        timeRef.current = 0;
      }
    } else if (phaseRef.current === 'return') {
      const returnProgress = Math.min(timeRef.current / returnDuration, 1);
      
      // Update return position - move from hit position back to start
      currentReturnPosition.current = (hitTargetRef.current?.position || targetPosition)
        .clone()
        .lerp(startPosition, returnProgress);

      // Complete when return phase finishes
      if (returnProgress >= 1.0) {
        phaseRef.current = 'complete';
        onComplete();
      }
    }

    // Update material opacities based on phase and progress
    let baseOpacity = 1.0;
    if (phaseRef.current === 'forward') {
      const forwardProgress = Math.min(timeRef.current / forwardDuration, 1);
      baseOpacity = 1.0 - forwardProgress * 0.3; // Slight fade during forward
    } else if (phaseRef.current === 'return') {
      const returnProgress = Math.min(timeRef.current / returnDuration, 1);
      baseOpacity = 0.7 * (1 - returnProgress * 0.8); // Fade out during return
    } else {
      baseOpacity = 0; // Fully faded when complete
    }

    materials.spiral1.opacity = (baseOpacity * 0.9) * flickerRef.current;
    materials.spiral2.opacity = (baseOpacity * 0.85) * (flickerRef.current * 0.9 + 0.1);
    materials.spiral3.opacity = (baseOpacity * 0.8) * (flickerRef.current * 0.8 + 0.2);
    materials.impact.opacity = (baseOpacity * 0.7) * flickerRef.current;
    materials.core.opacity = (baseOpacity * 1.1) * flickerRef.current;
    materials.chain.opacity = (baseOpacity * 0.6) * flickerRef.current;
  });

  const checkForHits = (currentPos: Vector3) => {
    // Check collision with enemies
    if (enemyData && enemyData.length > 0) {
      for (const enemy of enemyData) {
        if (enemy.health <= 0) continue;

        const distance = currentPos.distanceTo(enemy.position);
        if (distance <= 2.5) { // Collision radius
          hitTargetRef.current = { id: enemy.id, position: enemy.position.clone() };
          onHit(enemy.id, enemy.position.clone());
          return;
        }
      }
    }

    // Check collision with players in PVP mode
    if (players && localSocketId) {
      players.forEach((player: any, playerId: string) => {
        if (playerId === localSocketId || player.health <= 0) return;

        const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
        const distance = currentPos.distanceTo(playerPos);
        if (distance <= 2.5) { // Collision radius
          hitTargetRef.current = { id: playerId, position: playerPos.clone() };
          onHit(playerId, playerPos.clone());
          return;
        }
      });
    }
  };

  // Calculate visible spiral streams based on current phase and progress
  const getVisibleSpiralStreams = () => {
    if (phaseRef.current === 'forward') {
      const forwardProgress = Math.min(timeRef.current / forwardDuration, 1);
      // Show progressive spiral streams during forward phase
      return forwardSpiralStreams.map(stream => 
        stream.slice(0, Math.floor(stream.length * forwardProgress))
      );
    } else if (phaseRef.current === 'return') {
      const returnProgress = Math.min(timeRef.current / returnDuration, 1);
      // Show reverse spiral streams during return phase
      return forwardSpiralStreams.map(stream => {
        const reverseStream = [...stream].reverse();
        return reverseStream.slice(0, Math.floor(reverseStream.length * returnProgress));
      });
    }
    return [[], [], []]; // No streams when complete
  };

  const visibleStreams = getVisibleSpiralStreams();

  return (
    <group>
      {/* Animated spiraling particle streams */}
      {visibleStreams.map((stream, streamIndex) => {
        const materials_array = [materials.spiral1, materials.spiral2, materials.spiral3];
        const currentMaterial = materials_array[streamIndex];

        return (
          <group key={`stream-${streamIndex}`}>
            {stream.map((particle, particleIndex) => (
              <mesh
                key={`particle-${streamIndex}-${particleIndex}`}
                position={particle.position.toArray()}
                geometry={geometries.particle}
                material={currentMaterial}
                scale={[particle.scale, particle.scale, particle.scale]}
              />
            ))}
          </group>
        );
      })}

      {/* Impact effect at current position */}
      {phaseRef.current === 'forward' && (
        <mesh
          position={currentProjectilePosition.current.toArray()}
          geometry={geometries.impact}
          material={materials.impact}
          scale={[1.5, 1.5, 1.5]}
        />
      )}

      {/* Return effect during return phase */}
      {phaseRef.current === 'return' && hitTargetRef.current && (
        <>
          {/* Chain connecting hit target to current return position */}
          <mesh
            position={[
              (hitTargetRef.current.position.x + currentReturnPosition.current.x) / 2,
              (hitTargetRef.current.position.y + currentReturnPosition.current.y) / 2,
              (hitTargetRef.current.position.z + currentReturnPosition.current.z) / 2
            ]}
            geometry={geometries.chain}
            material={materials.chain}
            scale={[
              1,
              hitTargetRef.current.position.distanceTo(currentReturnPosition.current),
              1
            ]}
            rotation={[
              Math.PI / 2,
              Math.atan2(
                hitTargetRef.current.position.x - currentReturnPosition.current.x,
                hitTargetRef.current.position.z - currentReturnPosition.current.z
              ),
              0
            ]}
          />
          
          {/* Glowing effect at return position */}
          <mesh
            position={currentReturnPosition.current.toArray()}
            geometry={geometries.core}
            material={materials.core}
            scale={[1.3, 1.3, 1.3]}
          />
        </>
      )}

      {/* Starting point core glow */}
      <mesh
        position={startPosition.toArray()}
        geometry={geometries.core}
        material={materials.core}
        scale={[1.3, 1.3, 1.3]}
      />

      {/* Additional pulsing core at start */}
      <mesh
        position={startPosition.toArray()}
        geometry={geometries.particle}
        material={materials.spiral1}
        scale={[
          2 + Math.sin(timeRef.current * 8) * 0.5,
          2 + Math.sin(timeRef.current * 8) * 0.5,
          2 + Math.sin(timeRef.current * 8) * 0.5
        ]}
      />

      {/* Dynamic lighting */}
      <pointLight
        position={startPosition.toArray()}
        color="#cc3333"
        intensity={10 * (phaseRef.current !== 'complete' ? 1 : 0) * flickerRef.current}
        distance={4}
        decay={2}
      />

      {phaseRef.current === 'forward' && (
        <pointLight
          position={currentProjectilePosition.current.toArray()}
          color="#ff4444"
          intensity={8 * flickerRef.current}
          distance={5}
          decay={2}
        />
      )}

      {phaseRef.current === 'return' && (
        <pointLight
          position={currentReturnPosition.current.toArray()}
          color="#ff6666"
          intensity={6 * flickerRef.current}
          distance={4}
          decay={2}
        />
      )}
    </group>
  );
}
