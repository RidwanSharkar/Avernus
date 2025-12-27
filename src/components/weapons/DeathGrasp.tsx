import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending, SphereGeometry, CylinderGeometry } from '@/utils/three-exports';
import AnimatedDeathGrasp from './AnimatedDeathGrasp';

interface DeathGraspProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  onComplete: () => void;
  onPullStart: () => void;
  // Add enemy/player data for collision detection
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  players?: Map<string, any>;
  localSocketId?: string;
}

export default function DeathGrasp({
  startPosition,
  targetPosition,
  onComplete,
  onPullStart,
  enemyData = [],
  players,
  localSocketId
}: DeathGraspProps) {
  const timeRef = useRef(0);
  const flickerRef = useRef(1);
  const duration = 1.2; // Total duration including pull
  const pullTriggered = useRef(false);
  const useAnimatedVersion = useRef(true); // Flag to use new animated version

  // Use useMemo for static geometries and materials
  const geometries = useMemo(() => ({
    particle: new SphereGeometry(0.15, 8, 8),
    tentacle: new CylinderGeometry(0.05, 0.05, 1, 8),
    impact: new SphereGeometry(0.2, 8, 8),
    core: new SphereGeometry(0.18, 8, 8)
  }), []);

  const materials = useMemo(() => ({
    spiral1: new MeshBasicMaterial({
      color: new Color("#6A0DAD"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    spiral2: new MeshBasicMaterial({
      color: new Color("#9370DB"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    spiral3: new MeshBasicMaterial({
      color: new Color("#8A2BE2"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    impact: new MeshBasicMaterial({
      color: new Color("#6A0DAD"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    core: new MeshBasicMaterial({
      color: new Color("#9370DB"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    })
  }), []);

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      geometries.particle.dispose();
      geometries.tentacle.dispose();
      geometries.impact.dispose();
      geometries.core.dispose();
      materials.spiral1.dispose();
      materials.spiral2.dispose();
      materials.spiral3.dispose();
      materials.impact.dispose();
      materials.core.dispose();
    };
  }, [geometries, materials]);

  // Pre-calculate 3 spiraling particle streams
  const spiralStreams = useMemo(() => {
    const direction = targetPosition.clone().sub(startPosition);
    const distance = direction.length();
    const segments = Math.ceil(distance * 4); // More segments for smoother spirals
    const streams = [[], [], []] as Array<Array<{position: Vector3, scale: number}>>;

    // Create normalized direction vector and perpendicular vectors for spiral calculation (cached in useMemo)
    const normalizedDirection = direction.clone().normalize();
    const up = new Vector3(0, 1, 0);
    const right = new Vector3();
    right.crossVectors(normalizedDirection, up).normalize();
    const forward = new Vector3();
    forward.crossVectors(right, normalizedDirection).normalize();

    // Spiral parameters
    const spiralRadius = 0.15; // Radius of the spiral
    const spiralTurns = 3; // Number of complete turns along the path

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
  }, [startPosition, targetPosition]);

  useFrame((_, delta) => {
    timeRef.current = Math.min(timeRef.current + delta, duration);
    flickerRef.current = Math.random() * 0.3 + 0.7;

    const progress = timeRef.current / duration;

    // Trigger pull at 40% of the animation
    if (progress > 0.4 && !pullTriggered.current) {
      pullTriggered.current = true;
      onPullStart();
    }

    // Update material opacities based on progress with individual spiral variations
    const baseOpacity = progress < 0.8 ? (1 - progress * 0.6) : (0.4 * (1 - (progress - 0.8) / 0.2));

    materials.spiral1.opacity = (baseOpacity * 0.9) * flickerRef.current;
    materials.spiral2.opacity = (baseOpacity * 0.85) * (flickerRef.current * 0.9 + 0.1);
    materials.spiral3.opacity = (baseOpacity * 0.8) * (flickerRef.current * 0.8 + 0.2);
    materials.impact.opacity = (baseOpacity * 0.7) * flickerRef.current;
    materials.core.opacity = (baseOpacity * 1.1) * flickerRef.current;

    // Complete the effect
    if (progress >= 1) {
      onComplete();
    }
  });

  // Handle hit callback for animated version
  const handleHit = (targetId: string, position: Vector3) => {
    // console.log(`🎯 DeathGrasp hit target ${targetId} at position:`, position);
    // The hit detection and damage is handled by the calling system
    // This is just for visual feedback
  };

  // Use the new animated version if enabled
  if (useAnimatedVersion.current) {
    return (
      <AnimatedDeathGrasp
        startPosition={startPosition}
        targetPosition={targetPosition}
        onHit={handleHit}
        onPullStart={onPullStart}
        onComplete={onComplete}
        enemyData={enemyData}
        players={players}
        localSocketId={localSocketId}
      />
    );
  }

  // Fallback to original static version (kept for compatibility)
  return (
    <group>
      {/* Three spiraling particle streams */}
      {spiralStreams.map((stream, streamIndex) => {
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

      {/* Impact effect at target - deep purple */}
      <mesh
        position={targetPosition.toArray()}
        geometry={geometries.impact}
        material={materials.impact}
        scale={[1.5, 1.5, 1.5]}
      />

      {/* Starting point core glow - deep purple */}
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

      {/* Dynamic lighting - deep purple theme */}
      <pointLight
        position={startPosition.toArray()}
        color="#6A0DAD"
        intensity={10 * (1 - timeRef.current / duration) * flickerRef.current}
        distance={4}
        decay={2}
      />

      <pointLight
        position={targetPosition.toArray()}
        color="#9370DB"
        intensity={8 * (1 - timeRef.current / duration) * flickerRef.current}
        distance={5}
        decay={2}
      />

      {/* Additional atmospheric lighting along the spiral path */}
      {spiralStreams[0] && spiralStreams[0].length > 0 && (
        <pointLight
          position={spiralStreams[0][Math.floor(spiralStreams[0].length / 2)]?.position.toArray() || [0, 0, 0]}
          color="#8A2BE2"
          intensity={4 * (1 - timeRef.current / duration) * flickerRef.current}
          distance={3}
          decay={2}
        />
      )}
    </group>
  );
}
