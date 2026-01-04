// Movement system with WASD controls and physics
import { Camera, Vector3 } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity, Component } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Enemy } from '@/ecs/components/Enemy';
import { InputManager } from '@/core/InputManager';

export class MovementSystem extends System {
  public readonly requiredComponents = [Transform, Movement];
  private inputManager: InputManager;
  private camera: Camera | null = null;

  constructor(inputManager: InputManager) {
    super();
    this.inputManager = inputManager;
    this.priority = 10; // Run early in the update cycle, before collision system
  }

  public setCamera(camera: Camera): void {
    this.camera = camera;
  }

  public update(entities: Entity[], deltaTime: number): void {
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

      // Check if this is a frozen enemy - skip movement if frozen
      const enemy = entity.getComponent(Enemy);
      if (enemy && enemy.isFrozen) {
        continue; // Skip all movement for frozen enemies
      }

      // Handle input-based movement
      this.handleInput(entity, transform, movement);

      // Apply physics
      this.applyPhysics(transform, movement, deltaTime);

      // Update transform position
      this.updatePosition(transform, movement, deltaTime);
    }
  }

  private handleInput(entity: Entity, transform: Transform, movement: Movement): void {
    // Get input direction
    const inputDirection = new Vector3(0, 0, 0);
    let hasInput = false;

    // WASD movement
    if (this.inputManager.isKeyPressed('w')) {
      inputDirection.z -= 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('s')) {
      inputDirection.z += 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('a')) {
      inputDirection.x -= 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('d')) {
      inputDirection.x += 1;
      hasInput = true;
    }

    // Normalize diagonal movement
    if (inputDirection.length() > 0) {
      inputDirection.normalize();
    }

    // Convert input to world space based on camera orientation
    if (this.camera && hasInput) {
      const cameraDirection = new Vector3();
      this.camera.getWorldDirection(cameraDirection);
      
      // Get camera's right vector
      const cameraRight = new Vector3();
      cameraRight.crossVectors(cameraDirection, new Vector3(0, 1, 0)).normalize();
      
      // Get camera's forward vector (projected on XZ plane)
      const cameraForward = new Vector3();
      cameraForward.crossVectors(new Vector3(0, 1, 0), cameraRight).normalize();

      // Transform input direction to world space
      const worldDirection = new Vector3();
      worldDirection.addScaledVector(cameraRight, inputDirection.x);
      worldDirection.addScaledVector(cameraForward, -inputDirection.z);
      worldDirection.normalize();

      movement.setMoveDirection(worldDirection, 1.0);
    } else if (!hasInput) {
      movement.setMoveDirection(new Vector3(0, 0, 0), 0);
    }

    // Handle jumping
    if (this.inputManager.isKeyPressed(' ')) { // Spacebar
      movement.jump();
    }
  }

  private applyPhysics(transform: Transform, movement: Movement, deltaTime: number): void {
    // Apply gravity (only affects Y velocity)
    movement.applyGravity(deltaTime);

    // Handle knockback movement (takes priority over input)
    const currentTime = Date.now() / 1000; // Convert to seconds
    const knockbackResult = movement.updateKnockback(currentTime);

    if (knockbackResult.newPosition) {
      transform.position.copy(knockbackResult.newPosition);
    }

    if (movement.isKnockbacked) {
      // Skip input-based movement while being knockbacked
      return;
    }

    // Handle horizontal movement directly for immediate response
    if (movement.inputStrength > 0) {
      // Direct velocity setting for responsive movement
      const targetVelocity = movement.moveDirection.clone();
      targetVelocity.multiplyScalar(movement.maxSpeed * movement.inputStrength);
      
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

  private updatePosition(transform: Transform, movement: Movement, deltaTime: number): void {
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
    
    // Check for pillar collisions first
    const pillarCollision = this.checkPillarCollision(potentialPosition);
    
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
    } else {
      // If within bounds and no pillar collision, move normally
      transform.translate(deltaPosition.x, deltaPosition.y, deltaPosition.z);
    }

    // Mark transform matrix as needing update
    transform.matrixNeedsUpdate = true;
  }

  // Define pillar positions (same as in Environment.tsx)
  private readonly PILLAR_POSITIONS = [
    new Vector3(-6, 0, 0),        // Left pillar
    new Vector3(6, 0, 0)         // Right pillar
  ];
  private readonly PILLAR_RADIUS = 0.7; // Same as PillarCollision.tsx

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

  // Utility methods for external systems
  public getMovingEntities(entities: Entity[]): Entity[] {
    return entities.filter(entity => {
      const movement = entity.getComponent(Movement);
      return movement && movement.isMoving();
    });
  }

  public getGroundedEntities(entities: Entity[]): Entity[] {
    return entities.filter(entity => {
      const movement = entity.getComponent(Movement);
      return movement && movement.isGrounded;
    });
  }

  public stopEntity(entity: Entity): void {
    const movement = entity.getComponent(Movement);
    if (movement) {
      movement.stop();
    }
  }

  public addForceToEntity(entity: Entity, force: Vector3): void {
    const movement = entity.getComponent(Movement);
    if (movement) {
      movement.addForce(force);
    }
  }

  public addImpulseToEntity(entity: Entity, impulse: Vector3): void {
    const movement = entity.getComponent(Movement);
    if (movement) {
      movement.addImpulse(impulse);
    }
  }
}
