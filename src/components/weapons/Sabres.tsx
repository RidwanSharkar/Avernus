import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Shape } from '@/utils/three-exports';

// Cache blade shapes outside component to prevent recreation on every render
const createCachedBladeShape = (() => {
  let cachedShape: Shape | null = null;
  return () => {
    if (!cachedShape) {
      cachedShape = new Shape();

      // Start at center
      cachedShape.moveTo(0, 0);

      // Ornate guard shape
      cachedShape.lineTo(-0.15, 0.1);
      cachedShape.lineTo(-0.2, 0);  // Deeper notch
      cachedShape.lineTo(-0.2, -0.05);
      cachedShape.lineTo(0, 0);

      // Mirror for right side of guard
      cachedShape.lineTo(0.15, 0.1);
      cachedShape.lineTo(0.2, 0);   // Deeper notch
      cachedShape.lineTo(0.3, 0.0);
      cachedShape.lineTo(0, 0);

      // Elegant curved blade shape
      cachedShape.lineTo(0, 0.05);
      // Graceful curve up
      cachedShape.quadraticCurveTo(0.3, 0.15, 0.5, 0.2);
      cachedShape.quadraticCurveTo(0.7, 0.25, 0.9, 0.15);
      // Sharp elegant tip
      cachedShape.quadraticCurveTo(1.0, 0.1, 1.1, 0);
      // Sweeping bottom curve with notch
      cachedShape.quadraticCurveTo(1.0, -0.0, 0.8, -0.1);
      // Distinctive notch
      cachedShape.lineTo(0.7, -0.15);
      cachedShape.lineTo(0.65, -0.1);
      // Continue curve to handle
      cachedShape.quadraticCurveTo(0.4, -0.08, 0.2, -0.05);
      cachedShape.quadraticCurveTo(0.4, -0.02, 0, 0);
    }
    return cachedShape;
  };
})();

const createCachedInnerBladeShape = (() => {
  let cachedShape: Shape | null = null;
  return () => {
    if (!cachedShape) {
      cachedShape = new Shape();

      // Start at center
      cachedShape.moveTo(0, 0);

      // Ornate guard shape (slightly smaller)
      cachedShape.lineTo(-0.13, 0.08);
      cachedShape.lineTo(-0.18, 0);
      cachedShape.lineTo(-0.08, -0.04);
      cachedShape.lineTo(0, 0);

      // Mirror for right side
      cachedShape.lineTo(0.13, 0.08);
      cachedShape.lineTo(0.18, 0);
      cachedShape.lineTo(0.08, 0.04);
      cachedShape.lineTo(0, 0);

      // Elegant curved blade shape (slightly smaller)
      cachedShape.lineTo(0, 0.04);
      // Graceful curve up
      cachedShape.quadraticCurveTo(0.28, 0.13, 0.48, 0.18);
      cachedShape.quadraticCurveTo(0.68, 0.23, 0.88, 0.13);
      // Sharp elegant tip
      cachedShape.quadraticCurveTo(0.98, 0.08, 1.08, 0);
      // Sweeping bottom curve with notch
      cachedShape.quadraticCurveTo(0.98, 0.04, 0.78, -0.08);
      // Distinctive notch
      cachedShape.lineTo(0.68, -0.14);
      cachedShape.lineTo(0.7, -0.08);
      // Continue curve to handle
      cachedShape.quadraticCurveTo(0.38, -0.04, 0, -0.04);
      cachedShape.quadraticCurveTo(0.08, -0.04, 0, -0.04);
    }
    return cachedShape;
  };
})();

const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

// Cleanup utility for Three.js resources
const disposeThreeJSResources = (object: any) => {
  if (!object) return;

  // Dispose geometry
  if (object.geometry) {
    object.geometry.dispose();
  }

  // Dispose material
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((material: any) => {
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        material.dispose();
      });
    } else {
      if (object.material.map) object.material.map.dispose();
      if (object.material.normalMap) object.material.normalMap.dispose();
      if (object.material.roughnessMap) object.material.roughnessMap.dispose();
      if (object.material.metalnessMap) object.material.metalnessMap.dispose();
      if (object.material.emissiveMap) object.material.emissiveMap.dispose();
      object.material.dispose();
    }
  }

  // Recursively dispose children
  if (object.children) {
    object.children.forEach((child: any) => disposeThreeJSResources(child));
  }
};

interface SabresProps {
  isSwinging: boolean;
  onSwingComplete: () => void;
  onLeftSwingStart: () => void;
  onRightSwingStart: () => void;
  isCharging?: boolean;
  isSkyfalling?: boolean;
  isBackstabbing?: boolean;
  isSundering?: boolean;
  onBackstabComplete?: () => void;
  onSunderComplete?: () => void;
  subclass?: string;
}

export default function Sabres({ 
  isSwinging, 
  onSwingComplete, 
  onLeftSwingStart, 
  onRightSwingStart,
  isCharging = false,
  isSkyfalling = false,
  isBackstabbing = false,
  isSundering = false,
  onBackstabComplete = () => {},
  onSunderComplete = () => {},
  subclass = 'FROST'
}: SabresProps) {
  
  // Debug: Log when backstab animation is received
  React.useEffect(() => {
    if (isBackstabbing) {
      // console.log('🗡️ DEBUG: Sabres component received isBackstabbing:', isBackstabbing);
    }
  }, [isBackstabbing]);
  // Refs and states for the left sabre
  const leftSabreRef = useRef<Group>(null);
  const leftSwingProgress = useRef(0);

  // Refs and states for the right sabre
  const rightSabreRef = useRef<Group>(null);
  const rightSwingProgress = useRef(0);

  const leftBasePosition = [-0.75, 0.75, 0.65] as const;
  const rightBasePosition = [0.75, 0.75, 0.65] as const;

  // Ref for tracking right swing delay
  const rightSwingDelay = useRef(0);

  // Ref to track swing completion
  const isSwingComplete = useRef(false);

  // Ref for left swing delay
  const leftSwingDelay = useRef(0);
  
  // Backstab animation state
  const backstabProgress = useRef(0);
  const backstabPhase = useRef<'none' | 'windup' | 'thrust' | 'recover'>('none');
  const backstabAnimationComplete = useRef(false);
  // Store the horizontal rotation values from windup to maintain during thrust
  const backstabHorizontalRotation = useRef({
    left: { x: 0, y: 0, z: 0 },
    right: { x: 0, y: 0, z: 0 }
  });
  
  // Flourish animation state 
  const sunderProgress = useRef(0);
  const sunderPhase = useRef<'none' | 'windup' | 'whirlwind' | 'recover'>('none');
  const sunderAnimationComplete = useRef(false);
  // Store the horizontal rotation values from windup to maintain during thrust
  const sunderHorizontalRotation = useRef({
    left: { x: 0, y: 0, z: 0 },
    right: { x: 0, y: 0, z: 0 }
  });
  
  // Skyfall animation state
  const skyfallAnimationComplete = useRef(false);

  // Reset backstab animation when isBackstabbing becomes false
  useEffect(() => {
    if (!isBackstabbing) {
      backstabAnimationComplete.current = false;
      backstabPhase.current = 'none';
      backstabProgress.current = 0;
    }
  }, [isBackstabbing]);

  // Reset sunder animation when isSundering becomes false
  useEffect(() => {
    if (!isSundering) {
      sunderAnimationComplete.current = false;
      sunderPhase.current = 'none';
      sunderProgress.current = 0;
    }
  }, [isSundering]);

  // Reset skyfall animation when isSkyfalling becomes false
  useEffect(() => {
    if (!isSkyfalling) {
      skyfallAnimationComplete.current = false;
    }
  }, [isSkyfalling]);

  useFrame((_, delta) => {
    if (leftSabreRef.current && rightSabreRef.current) {
      if (isSkyfalling && !skyfallAnimationComplete.current) {
        // SKYFALL ANIMATION - Sheathing animation for PVP visibility
        const leftSheathPosition = [-0.8, -0.2, 0.5];
        const rightSheathPosition = [0.8, -0.2, 0.5];
        
        // Smoothly move to sheathed positions
        leftSabreRef.current.position.x += (leftSheathPosition[0] - leftSabreRef.current.position.x) * 0.3;
        leftSabreRef.current.position.y += (leftSheathPosition[1] - leftSabreRef.current.position.y) * 0.3;
        leftSabreRef.current.position.z += (leftSheathPosition[2] - leftSabreRef.current.position.z) * 0.3;
        
        rightSabreRef.current.position.x += (rightSheathPosition[0] - rightSabreRef.current.position.x) * 0.3;
        rightSabreRef.current.position.y += (rightSheathPosition[1] - rightSabreRef.current.position.y) * 0.3;
        rightSabreRef.current.position.z += (rightSheathPosition[2] - rightSabreRef.current.position.z) * 0.3;
        
        // Full rotation plus a bit more to point downward
        leftSabreRef.current.rotation.x = lerp(leftSabreRef.current.rotation.x * 1.05, Math.PI * 0.37, 0.3);
        leftSabreRef.current.rotation.z = lerp(leftSabreRef.current.rotation.z, Math.PI * 1.65, 0.20);
        
        rightSabreRef.current.rotation.x = lerp(rightSabreRef.current.rotation.x * 1.05, Math.PI * 0.37, 0.3);
        rightSabreRef.current.rotation.z = lerp(rightSabreRef.current.rotation.z, -Math.PI * 1.65, 0.2);

        // Reset swing states when using Skyfall
        leftSwingProgress.current = 0;
        rightSwingProgress.current = 0;
        leftSwingDelay.current = 0;
        rightSwingDelay.current = 0;
        isSwingComplete.current = false;
        // Reset backstab states when using Skyfall
        backstabProgress.current = 0;
        backstabPhase.current = 'none';
        // Reset sunder states when using Skyfall
        sunderProgress.current = 0;
        sunderPhase.current = 'none';
        


      } else if (isBackstabbing && !backstabAnimationComplete.current) {
        // BACKSTAB ANIMATION - Single stab motion starting from slash end position
        if (backstabPhase.current === 'none') {
          backstabPhase.current = 'windup';
          backstabProgress.current = 0;
          
          // Set initial positions to slash end positions (horizontal forward stance)
          // These are the positions at the end of a slash (swingPhase = 1)
          const leftSlashEndX = leftBasePosition[0] + Math.sin(Math.PI) * 1.2 - 0.45; // ≈ -1.25
          const leftSlashEndY = leftBasePosition[1] + (Math.sin(Math.PI * 2) * -0.25); // ≈ 0.75
          const leftSlashEndZ = leftBasePosition[2] + (Math.sin(Math.PI) * 1.1); // ≈ 0.65
          
          const rightSlashEndX = rightBasePosition[0] - Math.sin(Math.PI) * 1.2 + 0.45; // ≈ 1.25
          const rightSlashEndY = rightBasePosition[1] + (Math.sin(Math.PI * 2) * -0.25); // ≈ 0.75
          const rightSlashEndZ = rightBasePosition[2] + (Math.sin(Math.PI) * 1.1); // ≈ 0.65
          
          // These are the rotations when swingPhase approaches 1 (near end of slash)
          const slashPhase = 0.95; // Near end of slash for horizontal blade position
          const leftHorizontalRotX = Math.sin(slashPhase * Math.PI) * (Math.PI * 0.5);
          const leftHorizontalRotY = Math.sin(slashPhase * Math.PI) * (Math.PI * 0.5);
          const leftHorizontalRotZ = Math.sin(slashPhase * Math.PI) * (Math.PI * -0.1);
          
          const rightHorizontalRotX = Math.sin(slashPhase * Math.PI) * (Math.PI * 0.5);
          const rightHorizontalRotY = -Math.sin(slashPhase * Math.PI) * (Math.PI * 0.5);
          const rightHorizontalRotZ = Math.sin(slashPhase * Math.PI) * (Math.PI * 0.1);
          
          // Position sabres at horizontal forward stance (slash end position)
          leftSabreRef.current.position.set(leftSlashEndX, leftSlashEndY, leftSlashEndZ);
          rightSabreRef.current.position.set(rightSlashEndX, rightSlashEndY, rightSlashEndZ);
          leftSabreRef.current.rotation.set(leftHorizontalRotX, leftHorizontalRotY, leftHorizontalRotZ);
          rightSabreRef.current.rotation.set(rightHorizontalRotX, rightHorizontalRotY, rightHorizontalRotZ);
        }
        
        backstabProgress.current += delta * 1; // Animation speed
        
        if (backstabPhase.current === 'windup') {
          // Brief windup phase - pull sabres back slightly while maintaining horizontal rotation
          const windupProgress = Math.min(backstabProgress.current / 0.125, 1); // 0.15 second windup
          const windupEase = Math.sin(windupProgress * Math.PI * 0.15); // Smooth ease in
          
          // Pull both sabres back slightly from their horizontal position
          const windupOffset = windupEase * 0.125;
          
          leftSabreRef.current.position.z = leftSabreRef.current.position.z - windupOffset;
          rightSabreRef.current.position.z = rightSabreRef.current.position.z - windupOffset;
          
          // Maintain horizontal rotations during windup (blades stay parallel to ground)
          const slashPhase = 0.225;
          const leftRotX = Math.sin(slashPhase * Math.PI) * (Math.PI * 0.5 + Math.PI/4);
          const leftRotY = Math.sin(slashPhase * Math.PI) * (Math.PI * 0.3) - Math.PI/1.75;
          const leftRotZ = Math.sin(slashPhase * Math.PI) * (Math.PI * -0.1);
          
          const rightRotX = Math.sin(slashPhase * Math.PI) * (Math.PI * 0.5 + Math.PI/4);
          const rightRotY = -Math.sin(slashPhase * Math.PI) * (Math.PI * 0.3) + Math.PI/1.75;
          const rightRotZ = Math.sin(slashPhase * Math.PI) * (Math.PI * 0.1);
          
          // Apply rotations
          leftSabreRef.current.rotation.x = leftRotX;
          leftSabreRef.current.rotation.y = leftRotY;
          leftSabreRef.current.rotation.z = leftRotZ;
          
          rightSabreRef.current.rotation.x = rightRotX;
          rightSabreRef.current.rotation.y = rightRotY;
          rightSabreRef.current.rotation.z = rightRotZ;
          
          // Store these horizontal rotation values for the thrust phase
          backstabHorizontalRotation.current = {
            left: { x: leftRotX, y: leftRotY, z: leftRotZ },
            right: { x: rightRotX, y: rightRotY, z: rightRotZ }
          };
          
          if (windupProgress >= 1) {
            backstabPhase.current = 'thrust';
            backstabProgress.current = 0;
          }
        } else if (backstabPhase.current === 'thrust') {
          // Thrust phase - both sabres thrust forward simultaneously while maintaining horizontal rotation
          const thrustProgress = Math.min(backstabProgress.current / 0.15, 1); // 0.25 second thrust
          const thrustEase = Math.sin(thrustProgress * Math.PI * 0.175); // Smooth acceleration
          
          // Fast forward thrust motion from windup position
          const thrustOffset = thrustEase; // Strong forward motion
          
          // Both sabres thrust forward together
          leftSabreRef.current.position.z += thrustOffset;
          rightSabreRef.current.position.z += thrustOffset;
          
          // Slight convergence for stabbing motion
          const convergence = thrustEase * 0.325;
          leftSabreRef.current.position.x += convergence;
          rightSabreRef.current.position.x -= convergence;
          
          // Maintain the exact same horizontal rotations from windup (blades stay parallel to ground)
          leftSabreRef.current.rotation.x = backstabHorizontalRotation.current.left.x;
          leftSabreRef.current.rotation.y = backstabHorizontalRotation.current.left.y;
          leftSabreRef.current.rotation.z = backstabHorizontalRotation.current.left.z;
          
          rightSabreRef.current.rotation.x = backstabHorizontalRotation.current.right.x;
          rightSabreRef.current.rotation.y = backstabHorizontalRotation.current.right.y;
          rightSabreRef.current.rotation.z = backstabHorizontalRotation.current.right.z;
          
          if (thrustProgress >= 0.85) {
            backstabPhase.current = 'recover';
            backstabProgress.current = 0;
          }
        } else if (backstabPhase.current === 'recover') {
          // Recovery phase - return to base position
          const recoverProgress = Math.min(backstabProgress.current / 0.2, 1); // 0.2 second recovery
          const recoverEase = 1 - Math.pow(1 - recoverProgress,0.175); // Ease out curve
          
          // Smooth return to base positions
          leftSabreRef.current.position.x = lerp(leftSabreRef.current.position.x, leftBasePosition[0], recoverEase);
          leftSabreRef.current.position.y = lerp(leftSabreRef.current.position.y, leftBasePosition[1], recoverEase);
          leftSabreRef.current.position.z = lerp(leftSabreRef.current.position.z, leftBasePosition[2], recoverEase);
          
          rightSabreRef.current.position.x = lerp(rightSabreRef.current.position.x, rightBasePosition[0], recoverEase);
          rightSabreRef.current.position.y = lerp(rightSabreRef.current.position.y, rightBasePosition[1], recoverEase);
          rightSabreRef.current.position.z = lerp(rightSabreRef.current.position.z, rightBasePosition[2], recoverEase);
          
          // Reset rotations smoothly
          leftSabreRef.current.rotation.x = lerp(leftSabreRef.current.rotation.x, 0, recoverEase);
          leftSabreRef.current.rotation.y = lerp(leftSabreRef.current.rotation.y, 0, recoverEase);
          leftSabreRef.current.rotation.z = lerp(leftSabreRef.current.rotation.z, 0, recoverEase);
          
          rightSabreRef.current.rotation.x = lerp(rightSabreRef.current.rotation.x, 0, recoverEase);
          rightSabreRef.current.rotation.y = lerp(rightSabreRef.current.rotation.y, 0, recoverEase);
          rightSabreRef.current.rotation.z = lerp(rightSabreRef.current.rotation.z, 0, recoverEase);
          
          if (recoverProgress >= 1) {
            // Backstab animation complete - mark as finished
            backstabPhase.current = 'none';
            backstabProgress.current = 0;
            backstabAnimationComplete.current = true;
            onBackstabComplete();
          }
        }

      } else if (isSundering && !sunderAnimationComplete.current) {
        // SUNDER ANIMATION - Whirlwind effect with both sabres spinning around player
        if (sunderPhase.current === 'none') {
          sunderPhase.current = 'windup';
          sunderProgress.current = 0;
          
          // Start with sabres in extended position for whirlwind
          // Position them at opposite sides, extended outward
          const whirlwindRadius = 1.5; // Distance from center
          const whirlwindHeight = 0.75; // Height above ground
          
          // Left sabre starts at left side, extended
          leftSabreRef.current.position.set(-whirlwindRadius, whirlwindHeight, 0);
          // Right sabre starts at right side, extended  
          rightSabreRef.current.position.set(whirlwindRadius, whirlwindHeight, 0);
          
          // Both sabres point outward horizontally for whirlwind effect
          leftSabreRef.current.rotation.set(1, Math.PI * 0.5, 0); // Point left
          rightSabreRef.current.rotation.set(1, -Math.PI * 0.5, 0); // Point right
        }
        
        sunderProgress.current += delta *2 ; // Animation speed (slower for dramatic effect)
        
        if (sunderPhase.current === 'windup') {
          // Brief windup phase - pull sabres back slightly
          const windupProgress = Math.min(sunderProgress.current / 0.15, 1); // 0.2 second windup
          const windupEase = Math.sin(windupProgress * Math.PI * 0.5); // Smooth ease in
          
          // Pull sabres back slightly from extended position
          const pullback = windupEase * 0.5;
          leftSabreRef.current.position.x += pullback;
          rightSabreRef.current.position.x -= pullback;
          
          if (windupProgress >= 1) {
            sunderPhase.current = 'whirlwind';
            sunderProgress.current = 0;
          }
        } else if (sunderPhase.current === 'whirlwind') {
          // Main whirlwind phase - both sabres spin around player in full rotation
          const whirlwindProgress = Math.min(sunderProgress.current / 1, 1); // 0.8 second whirlwind
          const whirlwindEase = 1 - Math.pow(1 - whirlwindProgress, 2); // Ease out for dramatic finish
          
          // Calculate rotation angle (full 360 degrees)
          const rotationAngle = whirlwindEase * Math.PI * 4; // Full rotation
          
          // Whirlwind radius and height
          const whirlwindRadius = 1.2;
          const whirlwindHeight = 0.75;
          
          // Left sabre orbits counter-clockwise
          const leftAngle = rotationAngle;
          const leftX = Math.cos(leftAngle) * whirlwindRadius;
          const leftZ = Math.sin(leftAngle) * whirlwindRadius;
          
          leftSabreRef.current.position.set(leftX, whirlwindHeight, leftZ);
          
          // Right sabre orbits clockwise (opposite direction for whirlwind effect)
          const rightAngle = -rotationAngle;
          const rightX = Math.cos(rightAngle) * whirlwindRadius;
          const rightZ = Math.sin(rightAngle) * whirlwindRadius;
          
          rightSabreRef.current.position.set(rightX, whirlwindHeight, rightZ);
          
          // Rotate sabres to always point outward from center (tangential to circle)
          // Left sabre rotation (tangent to circle)
          const leftTangentAngle = leftAngle + Math.PI * 0.5; // Perpendicular to radius
          leftSabreRef.current.rotation.set(0, leftTangentAngle, 0);
          
          // Right sabre rotation (tangent to circle)
          const rightTangentAngle = rightAngle - Math.PI * 0.5; // Perpendicular to radius
          rightSabreRef.current.rotation.set(0, rightTangentAngle, 0);
          
          // Add slight vertical tilt for more dynamic look
          const tiltAmount = Math.sin(rotationAngle * 2) * 0.1; // Oscillating tilt
          leftSabreRef.current.rotation.x = tiltAmount;
          rightSabreRef.current.rotation.x = -tiltAmount;
          
          if (whirlwindProgress >= 1) {
            sunderPhase.current = 'recover';
            sunderProgress.current = 0;
          }
        } else if (sunderPhase.current === 'recover') {
          // Recovery phase - return to base position
          const recoverProgress = Math.min(sunderProgress.current / 0.3, 1); // 0.3 second recovery
          const recoverEase = 1 - Math.pow(1 - recoverProgress, 3); // Smooth ease out
          
          // Smooth return to base positions
          leftSabreRef.current.position.x = lerp(leftSabreRef.current.position.x, leftBasePosition[0], recoverEase);
          leftSabreRef.current.position.y = lerp(leftSabreRef.current.position.y, leftBasePosition[1], recoverEase);
          leftSabreRef.current.position.z = lerp(leftSabreRef.current.position.z, leftBasePosition[2], recoverEase);
          
          rightSabreRef.current.position.x = lerp(rightSabreRef.current.position.x, rightBasePosition[0], recoverEase);
          rightSabreRef.current.position.y = lerp(rightSabreRef.current.position.y, rightBasePosition[1], recoverEase);
          rightSabreRef.current.position.z = lerp(rightSabreRef.current.position.z, rightBasePosition[2], recoverEase);
          
          // Reset rotations smoothly
          leftSabreRef.current.rotation.x = lerp(leftSabreRef.current.rotation.x, 0, recoverEase);
          leftSabreRef.current.rotation.y = lerp(leftSabreRef.current.rotation.y, 0, recoverEase);
          leftSabreRef.current.rotation.z = lerp(leftSabreRef.current.rotation.z, 0, recoverEase);
          
          rightSabreRef.current.rotation.x = lerp(rightSabreRef.current.rotation.x, 0, recoverEase);
          rightSabreRef.current.rotation.y = lerp(rightSabreRef.current.rotation.y, 0, recoverEase);
          rightSabreRef.current.rotation.z = lerp(rightSabreRef.current.rotation.z, 0, recoverEase);
          
          if (recoverProgress >= 1) {
            // Sunder animation complete - mark as finished
            sunderPhase.current = 'none';
            sunderProgress.current = 0;
            sunderAnimationComplete.current = true;
            onSunderComplete();
          }
        }

      } else if (isSwinging) {
        // Reset isSwingComplete when starting a new swing
        if (leftSwingProgress.current === 0 && rightSwingProgress.current === 0) {
          isSwingComplete.current = false;
        }
        
        // Handle left sabre swing with delayHHHHHHHHHHHH
        if (leftSabreRef.current) {
          if (leftSwingDelay.current < 0.115) {  // 0.15 seconds delay
            leftSwingDelay.current += delta;
          } else {
            if (leftSwingProgress.current === 0) {
              onLeftSwingStart();
            }
            leftSwingProgress.current += delta * 12;

            const swingPhase = Math.min(leftSwingProgress.current / Math.PI, 1);

            // Adjusted left sabre movement to swing towards front center
            const pivotX = leftBasePosition[0] + Math.sin(swingPhase * Math.PI) * 1.2 - 0.45;
            const pivotY = leftBasePosition[1] + (Math.sin(swingPhase * Math.PI * 2) * -0.25);
            const pivotZ = leftBasePosition[2] + (Math.sin(swingPhase * Math.PI) * 1.75);

            leftSabreRef.current.position.set(pivotX, pivotY, pivotZ);

            // Left sabre specific rotations
            const leftRotationX = Math.sin(swingPhase * Math.PI) * (Math.PI * 0.65);
            const leftRotationY = Math.sin(swingPhase * Math.PI) * (Math.PI * 0.3);
            const leftRotationZ = Math.sin(swingPhase * Math.PI) * (Math.PI * -0.1);

            leftSabreRef.current.rotation.set(leftRotationX, leftRotationY, leftRotationZ);

            if (leftSwingProgress.current >= Math.PI) {
              leftSwingProgress.current = 0;
              leftSwingDelay.current = 0;
              leftSabreRef.current.rotation.set(0, 0, 0);
              leftSabreRef.current.position.set(...leftBasePosition);
            }
          }
        }
        
        // Handle right sabre swing (starts immediately)
        if (rightSabreRef.current) {
          if (rightSwingProgress.current === 0) {
            onRightSwingStart();
          }
          rightSwingProgress.current += delta * 12;

          const swingPhase = Math.min(rightSwingProgress.current / Math.PI, 1);

          // Adjusted right sabre movement to mirror left sabre
          const pivotX = rightBasePosition[0] - Math.sin(swingPhase * Math.PI) * 1.2 + 0.45;
          const pivotY = rightBasePosition[1] + (Math.sin(swingPhase * Math.PI * 2) * -0.25);
          const pivotZ = rightBasePosition[2] + (Math.sin(swingPhase * Math.PI) * 1.75);

          rightSabreRef.current.position.set(pivotX, pivotY, pivotZ);

          // Right sabre specific rotations
          const rightRotationX = Math.sin(swingPhase * Math.PI) * (Math.PI * 0.5);
          const rightRotationY = -Math.sin(swingPhase * Math.PI) * (Math.PI * 0.3);
          const rightRotationZ = Math.sin(swingPhase * Math.PI) * (Math.PI * 0.2);

          rightSabreRef.current.rotation.set(rightRotationX, rightRotationY, rightRotationZ);

          if (rightSwingProgress.current >= Math.PI) {
            rightSwingProgress.current = 0;
            rightSwingDelay.current = 0;
            rightSabreRef.current.rotation.set(0, 0, 0);
            rightSabreRef.current.position.set(...rightBasePosition);
            isSwingComplete.current = true;
            onSwingComplete();
          }
        }
      } else {
        // Return to original combat positions
        leftSabreRef.current.position.x += (leftBasePosition[0] - leftSabreRef.current.position.x) * 0.20;
        leftSabreRef.current.position.y += (leftBasePosition[1] - leftSabreRef.current.position.y) * 0.20;
        leftSabreRef.current.position.z += (leftBasePosition[2] - leftSabreRef.current.position.z) * 0.20;
        
        rightSabreRef.current.position.x += (rightBasePosition[0] - rightSabreRef.current.position.x) * 0.20;
        rightSabreRef.current.position.y += (rightBasePosition[1] - rightSabreRef.current.position.y) * 0.20;
        rightSabreRef.current.position.z += (rightBasePosition[2] - rightSabreRef.current.position.z) * 0.20;
        
        // Reset all rotations
        leftSabreRef.current.rotation.x *= 0.85;
        leftSabreRef.current.rotation.y *= 0.85;
        leftSabreRef.current.rotation.z *= 0.85;
        
        rightSabreRef.current.rotation.x *= 0.85;
        rightSabreRef.current.rotation.y *= 0.85;
        rightSabreRef.current.rotation.z *= 0.85;

        // Reset swing states when idle
        if (!isSwinging) {
          leftSwingProgress.current = 0;
          rightSwingProgress.current = 0;
          leftSwingDelay.current = 0;
          rightSwingDelay.current = 0;
          isSwingComplete.current = false;
        }
        
        // Reset backstab states when idle
        if (!isBackstabbing) {
          backstabProgress.current = 0;
          backstabPhase.current = 'none';
        }
        
        // Reset sunder states when idle
        if (!isSundering) {
          sunderProgress.current = 0;
          sunderPhase.current = 'none';
        }
      }
    }
  });

  // Cache blade shapes to prevent recreation on every render
  const bladeShape = useMemo(() => createCachedBladeShape(), []);
  const innerBladeShape = useMemo(() => createCachedInnerBladeShape(), []);

  // Cache extrude settings to prevent recreation on every render
  const bladeExtrudeSettings = useMemo(() => ({
    steps: 2,
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.01,
    bevelSegments: 3,
  }), []);

  const innerBladeExtrudeSettings = useMemo(() => ({
    ...bladeExtrudeSettings,
    depth: 0.025,
    bevelThickness: 0.003,
    bevelSize: 0.004,
    bevelOffset: 0,
  }), [bladeExtrudeSettings]);

  // Cache geometry args to prevent recreation on every render (prevents memory leaks)
  const bladeGeometryArgs = useMemo(() => [bladeShape, bladeExtrudeSettings] as [Shape, typeof bladeExtrudeSettings], [bladeShape, bladeExtrudeSettings]);
  const innerBladeGeometryArgs = useMemo(() => [innerBladeShape, {
    ...innerBladeExtrudeSettings,
    depth: 0.06
  }] as [Shape, typeof innerBladeExtrudeSettings & { depth: number }], [innerBladeShape, innerBladeExtrudeSettings]);

  // Get colors based on subclass
  const getBladeColors = () => {
    switch (subclass) {
      case 'FROST':
        return {
          primary: '#ff0000',
          emissive: '#ff2200',
          secondary: '#cc0000',
          secondaryEmissive: '#ff0000'
        };
      case 'ASSASSIN':
        return {
          primary: '#8b0000',
          emissive: '#ff0000',
          secondary: '#4b0000',
          secondaryEmissive: '#cc0000'
        };
      default:
        return {
          primary: '#ff0000',
          emissive: '#ff2200',
          secondary: '#cc0000',
          secondaryEmissive: '#ff0000'
        };
    }
  };

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Dispose of all Three.js resources in the sabre groups
      if (leftSabreRef.current) {
        disposeThreeJSResources(leftSabreRef.current);
      }
      if (rightSabreRef.current) {
        disposeThreeJSResources(rightSabreRef.current);
      }
    };
  }, []);

  const colors = getBladeColors();

  return (
    <group 
      position={[0, -0.6, 0.4]} 
      rotation={[-0.4, 0, 0]}
      scale={[0.775, 0.775, 0.7]}
    >
      {/* Left Sabre */}
      <group 
        ref={leftSabreRef} 
        position={[leftBasePosition[0], leftBasePosition[1], leftBasePosition[2]]}
        rotation={[0, 0, Math.PI]}
        scale={[1, 1, 0.875]}
      >
        {/* Handle */}
        <group position={[0.2, -0.125, 0]} rotation={[0, 0, -Math.PI]}>
          <mesh>
            <cylinderGeometry args={[0.015, 0.02, 0.45, 12]} />
            <meshStandardMaterial color="#2a3b4c" roughness={0.7} />
          </mesh>
          
          {/* Handle wrappings */}
          {[...Array(4)].map((_, i) => (
            <mesh key={i} position={[0, 0.175 - i * 0.065, 0]}>
              <torusGeometry args={[0.0225, 0.004, 8, 16]} />
              <meshStandardMaterial color="#1a2b3c" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
        
        {/* Blade */}
        <group position={[0.2, 0.3, 0.0]} rotation={[0, Math.PI / 2, Math.PI / 2]}>
          {/* Base blade */}
          <mesh>
            <extrudeGeometry args={bladeGeometryArgs} />
            <meshStandardMaterial
              color={colors.primary}
              emissive={colors.emissive}
              emissiveIntensity={3}
              metalness={0.9}
              roughness={0.2}
              opacity={0.9}
              transparent
            />
          </mesh>

          {/* Outer ethereal glow */}
          <mesh position={[0, 0, -0.02]}>
            <extrudeGeometry args={innerBladeGeometryArgs} />
            <meshStandardMaterial
              color={colors.secondary}
              emissive={colors.secondaryEmissive}
              emissiveIntensity={8}
              metalness={0.7}
              roughness={0.1}
              opacity={0.4}
              transparent
            />
          </mesh>
          
        </group>
      </group>

      {/* Right Sabre */}
      <group 
        ref={rightSabreRef} 
        position={[rightBasePosition[0], rightBasePosition[1], rightBasePosition[2]]}
        rotation={[0, 0, Math.PI]}
        scale={[1, 1, 0.875]}
      >
        {/* Handle */}
        <group position={[-0.2, -0.125, 0]} rotation={[0, 0, -Math.PI]}>
          <mesh>
            <cylinderGeometry args={[0.015, 0.02, 0.45, 12]} />
            <meshStandardMaterial color="#2a3b4c" roughness={0.7} />
          </mesh>
          
          {/* Handle wrappings */}
          {[...Array(4)].map((_, i) => (
            <mesh key={i} position={[0, 0.175 - i * 0.065, 0]}>
              <torusGeometry args={[0.0225, 0.004, 8, 16]} />
              <meshStandardMaterial color="#1a2b3c" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
        
        {/* Blade */}
        <group position={[-0.2, 0.3, 0.]} rotation={[0, Math.PI / 2, Math.PI / 2]}>
          {/* Base blade */}
          <mesh>
            <extrudeGeometry args={bladeGeometryArgs} />
            <meshStandardMaterial
              color={colors.primary}
              emissive={colors.emissive}
              emissiveIntensity={2}
              metalness={0.9}
              roughness={0.2}
              opacity={0.9}
              transparent
            />
          </mesh>

          {/* Outer ethereal glow */}
          <mesh position={[0, 0, -0.02]}>
            <extrudeGeometry args={innerBladeGeometryArgs} />
            <meshStandardMaterial
              color={colors.secondary}
              emissive={colors.secondaryEmissive}
              emissiveIntensity={3.5}
              metalness={0.7}
              roughness={0.1}
              opacity={0.4}
              transparent
            />
          </mesh>
          

        </group>
      </group>
    </group>
  );
}
