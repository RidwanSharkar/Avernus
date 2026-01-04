// Physics system for handling movement physics
import { Vector3 } from '@/utils/three-exports';
import { PhysicsSystem as BasePhysicsSystem } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';

export class PhysicsSystem extends BasePhysicsSystem {
  public readonly requiredComponents = [Transform, Movement];

  constructor() {
    super();
    this.priority = 15; // Run after control system but before rendering
  }

  public update(entities: Entity[], deltaTime: number): void {
    // This runs every frame for variable timestep updates
    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      const movement = entity.getComponent(Movement);

      // Skip if required components are missing
      if (!transform || !movement) {
        continue;
      }

      if (!transform.enabled || !movement.enabled || !movement.canMove) {
        continue;
      }

      // Update debuff states (frozen, slowed, etc.)
      if (typeof movement.updateDebuffs === 'function') {
        movement.updateDebuffs();
      } else {
        // console.warn('⚠️ Movement component missing updateDebuffs method:', movement);
      }

      this.updateMovement(transform, movement, deltaTime);
    }
  }

  public fixedUpdate(entities: Entity[], fixedDeltaTime: number): void {
    // This runs at fixed timestep for physics
    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      const movement = entity.getComponent(Movement);

      // Skip if required components are missing
      if (!transform || !movement) {
        continue;
      }

      if (!transform.enabled || !movement.enabled || !movement.canMove) {
        continue;
      }

      this.applyPhysics(transform, movement, fixedDeltaTime);
    }
  }

  private updateMovement(transform: Transform, movement: Movement, deltaTime: number): void {
    // Update position based on velocity
    const deltaPosition = movement.velocity.clone().multiplyScalar(deltaTime);
    
    // Calculate potential new position
    const currentPosition = transform.position.clone();
    const potentialPosition = currentPosition.clone().add(deltaPosition);
    
    // Apply map boundary constraints with smooth sliding (radius of 29 units from origin)
    const MAP_RADIUS = 29;
    
    // Only check horizontal distance (ignore Y for boundary)
    const horizontalPosition = new Vector3(potentialPosition.x, 0, potentialPosition.z);
    const distanceFromCenter = horizontalPosition.length();
    
    // Check for pillar and tree collisions
    const pillarCollision = this.checkPillarCollision(potentialPosition);
    const treeCollision = this.checkTreeCollision(potentialPosition);

    if (distanceFromCenter >= MAP_RADIUS) {
      // If we hit the boundary, calculate tangent movement for smooth sliding
      const currentHorizontalPos = new Vector3(currentPosition.x, 0, currentPosition.z);
      const toCenter = currentHorizontalPos.clone().normalize();

      // Create tangent vector (perpendicular to radius)
      const tangent = new Vector3(-toCenter.z, 0, toCenter.x);

      // Project our horizontal movement onto the tangent
      const horizontalMovement = new Vector3(deltaPosition.x, 0, deltaPosition.z);
      const tangentMovement = tangent.multiplyScalar(horizontalMovement.dot(tangent));

      // Apply the tangential movement while keeping distance to center constant
      const newHorizontalPosition = currentHorizontalPos.add(tangentMovement);
      newHorizontalPosition.normalize().multiplyScalar(MAP_RADIUS);

      // Update position with tangent movement and preserve Y movement
      transform.setPosition(
        newHorizontalPosition.x,
        currentPosition.y + deltaPosition.y, // Allow vertical movement (jumping, falling)
        newHorizontalPosition.z
      );
    } else if (pillarCollision.hasCollision) {
      // Handle pillar collision with smooth sliding
      const slidePosition = this.calculatePillarSliding(currentPosition, deltaPosition, pillarCollision);
      transform.setPosition(slidePosition.x, slidePosition.y, slidePosition.z);

      // Reduce velocity in the direction of the pillar to prevent bouncing
      const velocityNormalComponent = movement.velocity.clone().projectOnVector(pillarCollision.normal);
      movement.velocity.sub(velocityNormalComponent.multiplyScalar(0.5));
    } else if (treeCollision.hasCollision) {
      // Handle tree collision with smooth sliding
      const slidePosition = this.calculateTreeSliding(currentPosition, deltaPosition, treeCollision);
      transform.setPosition(slidePosition.x, slidePosition.y, slidePosition.z);

      // Reduce velocity in the direction of the tree to prevent bouncing
      const velocityNormalComponent = movement.velocity.clone().projectOnVector(treeCollision.normal);
      movement.velocity.sub(velocityNormalComponent.multiplyScalar(0.5));
    } else {
      // If within bounds and no collision, move normally
      transform.translate(deltaPosition.x, deltaPosition.y, deltaPosition.z);
    }

    // Mark transform matrix as needing update
    transform.matrixNeedsUpdate = true;
  }

  // Define pillar positions (same as in Environment.tsx)
  private readonly PILLAR_POSITIONS = [
    new Vector3(-6, 0, 0),        // Left pillar
    new Vector3(6, 0, 0)          // Right pillar
  ];
  private readonly PILLAR_RADIUS = 0.7; // Same as PillarCollision.tsx

  // Define tree positions (same as in Environment.tsx - reduced by half)
  private readonly TREE_POSITIONS = [
    // Middle ring trees (selectively kept)
    new Vector3(15, 0, 5), new Vector3(-15, 0, 5), new Vector3(5, 0, 15),
    // Outer ring trees (kept all - furthest from center)
    new Vector3(20, 0, 10), new Vector3(-20, 0, 10), new Vector3(20, 0, -10), new Vector3(-20, 0, -10),
    new Vector3(10, 0, 20), new Vector3(-10, 0, 20), new Vector3(10, 0, -20), new Vector3(-10, 0, -20),
    // Additional scattered tree (kept one for natural look)
    new Vector3(12, 0, 12)
  ];
  private readonly TREE_RADIUS = 0.3; // Roughly half the pillar diameter

  private checkPillarCollision(position: Vector3): { hasCollision: boolean; normal: Vector3; pillarCenter: Vector3 } {
    for (const pillarPos of this.PILLAR_POSITIONS) {
      // Only check horizontal distance (ignore Y)
      const horizontalPos = new Vector3(position.x, 0, position.z);
      const pillarHorizontal = new Vector3(pillarPos.x, 0, pillarPos.z);
      const distance = horizontalPos.distanceTo(pillarHorizontal);

      if (distance < this.PILLAR_RADIUS) {
        // Calculate normal vector pointing away from pillar center
        const normal = horizontalPos.clone().sub(pillarHorizontal).normalize();
        // Handle case where player is exactly at pillar center
        if (normal.length() === 0) {
          normal.set(1, 0, 0); // Default direction
        }
        return {
          hasCollision: true,
          normal: normal,
          pillarCenter: pillarPos.clone()
        };
      }
    }

    return { hasCollision: false, normal: new Vector3(), pillarCenter: new Vector3() };
  }

  private checkTreeCollision(position: Vector3): { hasCollision: boolean; normal: Vector3; treeCenter: Vector3 } {
    for (const treePos of this.TREE_POSITIONS) {
      // Only check horizontal distance (ignore Y)
      const horizontalPos = new Vector3(position.x, 0, position.z);
      const treeHorizontal = new Vector3(treePos.x, 0, treePos.z);
      const distance = horizontalPos.distanceTo(treeHorizontal);

      if (distance < this.TREE_RADIUS) {
        // Calculate normal vector pointing away from tree center
        const normal = horizontalPos.clone().sub(treeHorizontal).normalize();
        // Handle case where player is exactly at tree center
        if (normal.length() === 0) {
          normal.set(1, 0, 0); // Default direction
        }
        return {
          hasCollision: true,
          normal: normal,
          treeCenter: treePos.clone()
        };
      }
    }

    return { hasCollision: false, normal: new Vector3(), treeCenter: new Vector3() };
  }

  private calculatePillarSliding(currentPosition: Vector3, deltaPosition: Vector3, collision: { normal: Vector3; pillarCenter: Vector3 }): Vector3 {
    // Calculate the tangent vector (perpendicular to normal in XZ plane)
    const tangent = new Vector3(-collision.normal.z, 0, collision.normal.x);

    // Project the movement vector onto the tangent for sliding
    const tangentMovement = deltaPosition.clone().projectOnVector(tangent);

    // Calculate the new position with sliding movement
    const slidePosition = currentPosition.clone().add(tangentMovement);

    // Ensure we maintain minimum distance from pillar center
    const pillarHorizontal = new Vector3(collision.pillarCenter.x, 0, collision.pillarCenter.z);
    const slideHorizontal = new Vector3(slidePosition.x, 0, slidePosition.z);
    const distanceAfterSlide = slideHorizontal.distanceTo(pillarHorizontal);

    if (distanceAfterSlide < this.PILLAR_RADIUS) {
      // Push the position to maintain minimum distance
      const pushDirection = slideHorizontal.clone().sub(pillarHorizontal).normalize();
      if (pushDirection.length() === 0) {
        pushDirection.set(1, 0, 0); // Default direction
      }
      const correctedHorizontal = pillarHorizontal.clone().add(pushDirection.multiplyScalar(this.PILLAR_RADIUS));
      slidePosition.x = correctedHorizontal.x;
      slidePosition.z = correctedHorizontal.z;
    }

    return slidePosition;
  }

  private calculateTreeSliding(currentPosition: Vector3, deltaPosition: Vector3, collision: { normal: Vector3; treeCenter: Vector3 }): Vector3 {
    // Calculate the tangent vector (perpendicular to normal in XZ plane)
    const tangent = new Vector3(-collision.normal.z, 0, collision.normal.x);

    // Project the movement vector onto the tangent for sliding
    const tangentMovement = deltaPosition.clone().projectOnVector(tangent);

    // Calculate the new position with sliding movement
    const slidePosition = currentPosition.clone().add(tangentMovement);

    // Ensure we maintain minimum distance from tree center
    const treeHorizontal = new Vector3(collision.treeCenter.x, 0, collision.treeCenter.z);
    const slideHorizontal = new Vector3(slidePosition.x, 0, slidePosition.z);
    const distanceAfterSlide = slideHorizontal.distanceTo(treeHorizontal);

    if (distanceAfterSlide < this.TREE_RADIUS) {
      // Push the position to maintain minimum distance
      const pushDirection = slideHorizontal.clone().sub(treeHorizontal).normalize();
      if (pushDirection.length() === 0) {
        pushDirection.set(1, 0, 0); // Default direction
      }
      const correctedHorizontal = treeHorizontal.clone().add(pushDirection.multiplyScalar(this.TREE_RADIUS));
      slidePosition.x = correctedHorizontal.x;
      slidePosition.z = correctedHorizontal.z;
    }

    return slidePosition;
  }

  private applyPhysics(transform: Transform, movement: Movement, deltaTime: number): void {
    // Apply gravity (only affects Y velocity)
    movement.applyGravity(deltaTime);

    // Handle horizontal movement directly for immediate response
    if (movement.inputStrength > 0) {
      // Use effective max speed which accounts for frozen/slowed states
      const effectiveMaxSpeed = movement.getEffectiveMaxSpeed();
      
      // Direct velocity setting for responsive movement
      const targetVelocity = movement.moveDirection.clone();
      targetVelocity.multiplyScalar(effectiveMaxSpeed * movement.inputStrength);
      
      // Set horizontal velocity directly (preserve Y velocity for gravity/jumping)
      movement.velocity.x = targetVelocity.x;
      movement.velocity.z = targetVelocity.z;
    } else {
      // No input - stop horizontal movement immediately for responsive controls
      movement.velocity.x = 0;
      movement.velocity.z = 0;
    }

    // Apply any additional forces (like knockback, wind, etc.)
    movement.velocity.add(movement.acceleration.clone().multiplyScalar(deltaTime));

    // Reset acceleration for next frame
    movement.acceleration.set(0, 0, 0);

    // Simple ground check (Y = 0 is ground level, account for sphere radius)
    const sphereRadius = 0.5; // Player sphere radius
    const groundLevel = sphereRadius; // Sphere center should be at radius height above ground
    
    if (transform.position.y <= groundLevel && movement.velocity.y <= 0) {
      transform.position.y = groundLevel;
      movement.velocity.y = 0;
      movement.isGrounded = true;
    } else {
      movement.isGrounded = false;
    }
  }
}
