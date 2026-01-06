import React, { useRef, useState, useEffect } from 'react';
import { AdditiveBlending } from '@/utils/three-exports';
import { sphereHighDetail, disposeThreeJSResources } from '@/utils/sharedGeometries';

import { Mesh, Vector3, Clock, Color } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import CrossentropyBoltTrail from './CrossentropyBoltTrail';

interface CrossentropyBoltProps {
  id: number;
  position: Vector3;
  direction: Vector3;
  onImpact?: (position?: Vector3, isEnemyCollision?: boolean) => void;
  checkCollisions?: (boltId: number, position: Vector3) => boolean;
}

export default function CrossentropyBolt({ id, position, direction, onImpact, checkCollisions }: CrossentropyBoltProps) {
  const fireball1Ref = useRef<Mesh>(null);
  const fireball2Ref = useRef<Mesh>(null);
  const fireball3Ref = useRef<Mesh>(null);
  const clock = useRef(new Clock());
  const startSpeed = 0.03;
  const maxSpeed = 2;
  const accelerationDistance = 20; // Distance over which to accelerate from start to max speed
  const maxRange = 20; // Maximum range before fading
  const lifespan = 3; // Fallback lifespan
  const currentPosition = useRef(position.clone());
  const startPosition = useRef(position.clone());
  const hasCollided = useRef(false);
  const hasExploded = useRef(false);
  const fadeStartTime = useRef<number | null>(null);
  const fadeDuration = 0.5; // 500ms fade duration
  const [opacity, setOpacity] = useState(1);
  const { scene } = useThree();
  const size = 0.25;
  const color = new Color('#FF4500');

  // Spiral parameters
  const spiralRadius = 0.4875;
  const spiralSpeed = 2.5; // rotations per second
  const time = useRef(0);

  // Collision detection is now handled by the ECS system
  // This component only handles visual representation

  useFrame((_, delta) => {
    if (!fireball1Ref.current || !fireball2Ref.current || !fireball3Ref.current) return;

    const currentTime = Date.now();

    // Handle fading
    if (fadeStartTime.current !== null) {
      const fadeElapsed = currentTime - fadeStartTime.current;
      const fadeProgress = Math.min(fadeElapsed / (fadeDuration * 1000), 1);
      const newOpacity = 1 - fadeProgress;
      
      setOpacity(newOpacity);
      
      if (fadeProgress >= 1) {
        // Fade complete, remove from scene
        fireball1Ref.current.removeFromParent();
        fireball2Ref.current.removeFromParent();
        fireball3Ref.current.removeFromParent();
        if (onImpact) {
          onImpact(); // Call without position to indicate fade completion
        }
        return;
      }
    }

    // Skip movement and collision if already collided
    if (hasCollided.current) return;

    // Check if exceeded lifespan
    if (clock.current.getElapsedTime() > lifespan && !hasExploded.current) {
      hasCollided.current = true;
      hasExploded.current = true;
      fadeStartTime.current = currentTime;
      // Lifespan exceeded without collision - no explosion, just fade
      return;
    }

    time.current += delta;

    // Calculate current speed based on distance traveled (accelerate from startSpeed to maxSpeed)
    const distanceTraveled = currentPosition.current.distanceTo(startPosition.current);
    const accelerationProgress = Math.min(distanceTraveled / accelerationDistance, 1);
    const currentSpeed = startSpeed + (maxSpeed - startSpeed) * accelerationProgress;

    // Update position based on direction and current speed
    const movement = direction.clone().multiplyScalar(currentSpeed * delta * 60);
    currentPosition.current.add(movement);
    if (distanceTraveled >= maxRange && !hasExploded.current) {
      hasCollided.current = true;
      hasExploded.current = true;
      fadeStartTime.current = currentTime;
      if (onImpact) {
        onImpact(currentPosition.current.clone(), false); // Impact at max range position (not enemy collision)
      }
      return;
    }

    // Check collisions each frame
    if (checkCollisions) {
      const currentPos = currentPosition.current.clone();

      // Check ground collision first - ground is at y = -0.5 (EnhancedGround position)
      const isGroundCollision = currentPos.y <= -0.5;

      const hitSomething = checkCollisions(id, currentPos);

      if (hitSomething && !hasExploded.current) {
        hasCollided.current = true;
        hasExploded.current = true;
        fadeStartTime.current = currentTime;
        if (onImpact) {
          // Only mark as enemy collision if it's not a ground collision
          onImpact(currentPos, !isGroundCollision);
        }
        return;
      }
    }
    
    // Calculate spiral positions for the three fireballs
    const spiralAngle = time.current * spiralSpeed * Math.PI * 2;
    const spiralOffset1 = new Vector3(
      Math.cos(spiralAngle) * spiralRadius,
      Math.sin(spiralAngle * 0.5) * spiralRadius * 0.3,
      0
    );
    const spiralOffset2 = new Vector3(
      Math.cos(spiralAngle + Math.PI) * spiralRadius,
      Math.sin((spiralAngle + Math.PI) * 0.5) * spiralRadius * 0.3,
      0
    );
    const spiralOffset3 = new Vector3(
      Math.cos(spiralAngle + (2 * Math.PI / 3)) * spiralRadius,
      Math.sin((spiralAngle + (2 * Math.PI / 3)) * 0.5) * spiralRadius * 0.3,
      0
    );

    // Apply spiral offsets to the main direction
    const right = new Vector3();
    const up = new Vector3(0, 1, 0);
    right.crossVectors(direction, up).normalize();
    up.crossVectors(right, direction).normalize();

    const finalOffset1 = right.clone().multiplyScalar(spiralOffset1.x)
      .add(up.clone().multiplyScalar(spiralOffset1.y));
    const finalOffset2 = right.clone().multiplyScalar(spiralOffset2.x)
      .add(up.clone().multiplyScalar(spiralOffset2.y));
    const finalOffset3 = right.clone().multiplyScalar(spiralOffset3.x)
      .add(up.clone().multiplyScalar(spiralOffset3.y));

    fireball1Ref.current.position.copy(currentPosition.current.clone().add(finalOffset1));
    fireball2Ref.current.position.copy(currentPosition.current.clone().add(finalOffset2));
    fireball3Ref.current.position.copy(currentPosition.current.clone().add(finalOffset3));
  });

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Dispose of Three.js resources for all fireball meshes
      if (fireball1Ref.current) disposeThreeJSResources(fireball1Ref.current);
      if (fireball2Ref.current) disposeThreeJSResources(fireball2Ref.current);
      if (fireball3Ref.current) disposeThreeJSResources(fireball3Ref.current);
    };
  }, []);

  return (
    <group name="crossentropy-bolt-group">
      <mesh ref={fireball1Ref} position={currentPosition.current} scale={[size, size, size]}>
        <primitive object={sphereHighDetail} />
        <meshStandardMaterial
          color="#FF4500"
          emissive="#FF6600"
          emissiveIntensity={2 * opacity}
          transparent
          opacity={0.9 * opacity}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
        <pointLight color={color} intensity={5 * opacity} distance={12} />
      </mesh>
      <mesh ref={fireball2Ref} position={currentPosition.current} scale={[size, size, size]}>
        <primitive object={sphereHighDetail} />
        <meshStandardMaterial
          color="#FF4500"
          emissive="#FF6600"
          emissiveIntensity={2 * opacity}
          transparent
          opacity={0.9 * opacity}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
        <pointLight color={color} intensity={5 * opacity} distance={12} />
      </mesh>
      <mesh ref={fireball3Ref} position={currentPosition.current} scale={[size, size, size]}>
        <primitive object={sphereHighDetail} />
        <meshStandardMaterial
          color="#FF4500"
          emissive="#FF6600"
          emissiveIntensity={2 * opacity}
          transparent
          opacity={0.9 * opacity}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
        <pointLight color={color} intensity={5 * opacity} distance={12} />
      </mesh>
      <CrossentropyBoltTrail
        color={color}
        size={size * 0.875}
        mesh1Ref={fireball1Ref}
        mesh2Ref={fireball2Ref}
        mesh3Ref={fireball3Ref}
        opacity={opacity}
      />
      <pointLight color={color} intensity={8 * opacity} distance={4} decay={2} />
    </group>
  );
} 
