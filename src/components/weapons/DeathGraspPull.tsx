import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

interface DeathGraspPullProps {
  targetPlayerId: string;
  casterPosition: Vector3;
  isActive: boolean;
  onComplete: () => void;
  playerEntities: React.MutableRefObject<Map<string, number>>; // Map of playerId to ECS entity ID
  getEntityPosition: (entityId: number) => Vector3 | null;
  updateEntityPosition: (entityId: number, position: Vector3) => void;
}

const PULL_DISTANCE = 16.0; // How far to pull the player (reduced for shorter range)
const PULL_DURATION = 0.35; // Faster duration for more responsive feel
const MAX_PULL_BOUNDS = 25; // Maximum distance from origin

export default function DeathGraspPull({
  targetPlayerId,
  casterPosition,
  isActive,
  onComplete,
  playerEntities,
  getEntityPosition,
  updateEntityPosition
}: DeathGraspPullProps) {
  const startPosition = useRef<Vector3 | null>(null);
  const startTime = useRef<number | null>(null);
  const targetPosition = useRef<Vector3 | null>(null);
  const entityId = useRef<number | null>(null);

  useFrame(() => {
    if (!isActive) return;

    // Get the ECS entity ID for the target player
    if (!entityId.current) {
      entityId.current = playerEntities.current.get(targetPlayerId) || null;

      if (!entityId.current) {
        onComplete();
        return;
      }
    }

    // Initialize pull on first active frame
    if (!startTime.current && entityId.current) {
      startTime.current = Date.now();
      startPosition.current = getEntityPosition(entityId.current);

      // Safety check to ensure startPosition is set
      if (!startPosition.current) {
        onComplete();
        return;
      }

      // Now we know startPosition.current is not null, so we can safely use it
      const currentPos = startPosition.current;

      // Calculate target position - pull player towards caster (only X and Z, preserve Y)
      const startGroundPos = currentPos.clone();
      startGroundPos.y = 0; // Use ground level for calculations
      const casterGroundPos = casterPosition.clone();
      casterGroundPos.y = 0; // Use ground level for calculations

      const directionToCaster = casterGroundPos.clone()
        .sub(startGroundPos)
        .normalize();

      targetPosition.current = startGroundPos.clone()
        .add(directionToCaster.multiplyScalar(PULL_DISTANCE));

      // Ensure target position doesn't go beyond caster position
      const distanceToCaster = startGroundPos.distanceTo(casterGroundPos);
      if (PULL_DISTANCE >= distanceToCaster * 0.8) {
        // If pull would bring player too close to caster, reduce pull distance
        const safePullDistance = distanceToCaster * 0.6;
        const pullDirection = casterGroundPos.clone()
          .sub(startGroundPos)
          .normalize();
        targetPosition.current = startGroundPos.clone()
          .add(pullDirection.multiplyScalar(safePullDistance));
      }

      // Ensure target position stays at ground level
      targetPosition.current.y = 0;

      return;
    }

    const elapsed = (Date.now() - startTime.current!) / 1000;
    const progress = Math.min(elapsed / PULL_DURATION, 1);

    // Use ease-out quad for smoother pull effect
    const easeOutQuad = 1 - Math.pow(1 - progress, 2);

    // Safety checks
    if (!startPosition.current || !targetPosition.current || !entityId.current) {
      onComplete();
      startTime.current = null;
      startPosition.current = null;
      targetPosition.current = null;
      entityId.current = null;
      return;
    }

    // Calculate displacement (only for X and Z)
    // At this point in the code, both startPosition and targetPosition are guaranteed to be set
    // because we return early if they're null during initialization
    const startGroundPos = startPosition.current!.clone();
    startGroundPos.y = 0;

    const displacement = targetPosition.current!.clone()
      .sub(startGroundPos)
      .multiplyScalar(easeOutQuad);

    const newPosition = startGroundPos.clone().add(displacement);
    // Ensure Y stays at ground level
    newPosition.y = 0;

    // Bounds checking (only check X and Z distance)
    const distanceFromOrigin = Math.sqrt(newPosition.x * newPosition.x + newPosition.z * newPosition.z);
    if (distanceFromOrigin > MAX_PULL_BOUNDS) {
      // Cancel pull if it would move too far from origin
      onComplete();
      startTime.current = null;
      startPosition.current = null;
      targetPosition.current = null;
      entityId.current = null;
      return;
    }

    // Update entity position - preserve original Y
    const currentPosition = getEntityPosition(entityId.current);
    if (currentPosition) {
      const originalY = currentPosition.y;
      const finalPosition = new Vector3(newPosition.x, originalY, newPosition.z);

      // Log position updates every 10 frames to avoid spam
      const frameCount = Math.floor(progress * 60); // Assuming 60fps
      if (frameCount % 10 === 0) {
        // console.log(`🎣 DeathGraspPull: Moving entity ${entityId.current} to [${finalPosition.x.toFixed(1)}, ${finalPosition.z.toFixed(1)}] (${(progress * 100).toFixed(0)}% complete)`);
      }

      // Update ECS position
      updateEntityPosition(entityId.current, finalPosition);

      // CRITICAL FIX: Also broadcast the position change to synchronize with other clients
      // Use the multiplayer context to send position updates
      if (typeof window !== 'undefined' && (window as any).multiplayer) {
        const multiplayer = (window as any).multiplayer;
        if (multiplayer.broadcastPlayerEffect) {
          // Send a special effect that includes the forced position update
          multiplayer.broadcastPlayerEffect({
            type: 'deathgrasp_pull',
            targetPlayerId,
            position: finalPosition,
            casterId: (window as any).localSocketId
          });
        } 
      }
    }

    // Complete pull when finished
    if (progress === 1) {
      onComplete();
      startTime.current = null;
      startPosition.current = null;
      targetPosition.current = null;
      entityId.current = null;
    }
  });

  return null;
}
