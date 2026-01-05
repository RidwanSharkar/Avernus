// Projectile system for handling projectile movement and collisions
import { Vector3, Color, SphereGeometry, MeshStandardMaterial, Mesh } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Health } from '@/ecs/components/Health';
import { Renderer } from '@/ecs/components/Renderer';
import { Collider, CollisionLayer } from '@/ecs/components/Collider';
import { Enemy } from '@/ecs/components/Enemy';
import { World } from '@/ecs/World';
import { ObjectPool } from '@/utils/ObjectPool';

import { WeaponSubclass } from '@/components/dragon/weapons';
import { CombatSystem } from './CombatSystem';
import CrossentropyBolt from '@/components/projectiles/CrossentropyBolt';

export class ProjectileSystem extends System {
  public readonly requiredComponents = [Transform, Projectile];
  private world: World;
  private combatSystem: CombatSystem | null = null;
  private projectilesToDestroy: number[] = [];
  

  
  // Object pools for performance (keeping vector pool for calculations)
  private vector3Pool: ObjectPool<Vector3>;
  
  // Reusable objects to reduce allocations
  private tempVector = new Vector3();
  private tempVector2 = new Vector3();

  constructor(world: World) {
    super();
    this.world = world;
    this.priority = 20; // Run after movement
    

    
    // Initialize vector pool for calculations
    this.vector3Pool = new ObjectPool(
      () => new Vector3(),
      (vector) => vector.set(0, 0, 0),
      100
    );
  }

  public setCombatSystem(combatSystem: CombatSystem): void {
    this.combatSystem = combatSystem;
  }

  public update(entities: Entity[], deltaTime: number): void {
    this.projectilesToDestroy.length = 0;

    for (const entity of entities) {
      const transform = entity.getComponent(Transform)!;
      const projectile = entity.getComponent(Projectile)!;

      if (!transform.enabled || !projectile.enabled) {
        continue;
      }

      // Update projectile
      projectile.update(deltaTime);

      // Check if projectile has expired
      if (projectile.isExpired()) {
        this.projectilesToDestroy.push(entity.id);
        continue;
      }

      // Move projectile
      this.moveProjectile(transform, projectile, deltaTime);

      // Update homing direction if projectile is homing
      this.updateHomingDirection(entity, projectile, deltaTime);

      // Arrow orientation is set once at creation - no need to update every frame
      // this.updateArrowOrientation(entity, projectile);

      // Check collisions
      this.checkCollisions(entity, transform, projectile);

      // Check world boundaries
      this.checkWorldBounds(entity, transform);
    }

    // Destroy expired projectiles
    for (const entityId of this.projectilesToDestroy) {
      this.world.destroyEntity(entityId);
    }
  }

  private moveProjectile(transform: Transform, projectile: Projectile, deltaTime: number): void {
    // Use temp vector to avoid allocations
    this.tempVector.copy(projectile.velocity).multiplyScalar(deltaTime);

    // Update position
    transform.translate(this.tempVector.x, this.tempVector.y, this.tempVector.z);
    transform.matrixNeedsUpdate = true;
  }

  private updateHomingDirection(projectileEntity: Entity, projectile: Projectile, deltaTime: number): void {
    // Skip if not homing
    if (!projectile.targetEntityId || projectile.homingStrength <= 0) {
      return;
    }

    // Get target entity
    const targetEntity = this.world.getEntity(projectile.targetEntityId);
    if (!targetEntity) {
      // Target no longer exists, disable homing
      projectile.disableHoming();
      return;
    }

    // Get target position
    const targetTransform = targetEntity.getComponent(Transform);
    if (!targetTransform) {
      projectile.disableHoming();
      return;
    }

    // Get projectile position
    const projectileTransform = projectileEntity.getComponent(Transform);
    if (!projectileTransform) {
      return;
    }

    // Check if this is a tower projectile for special handling
    const isTowerProjectile = (projectileEntity as any).isTowerProjectile === true;

    // Calculate direction to target
    const currentPosition = projectileTransform.position;
    const targetPosition = targetTransform.position;

    this.tempVector.copy(targetPosition).sub(currentPosition);
    const distanceToTarget = this.tempVector.length();

    // For tower projectiles, use more aggressive homing even at close range
    const minDistanceThreshold = isTowerProjectile ? 0.05 : 0.1; // Closer threshold for towers

    // If very close to target and not a tower projectile, maintain current direction
    if (distanceToTarget < minDistanceThreshold && !isTowerProjectile) {
      return;
    }

    // Normalize target direction
    this.tempVector.normalize();

    // Get current velocity direction
    const currentDirection = projectile.velocity.clone().normalize();

    // For tower projectiles, use more direct approach when very close
    if (isTowerProjectile && distanceToTarget < 0.3) {
      // Direct approach: immediately adjust towards target
      const desiredDirection = this.tempVector.clone();
      const angle = currentDirection.angleTo(desiredDirection);

      // For tower projectiles, allow much more aggressive turning when close
      const maxTurnThisFrame = projectile.maxTurnRate * deltaTime * 2; // Double the turn rate when close
      const turnAngle = Math.min(angle, maxTurnThisFrame);

      if (turnAngle > 0.001) {
        const rotationAxis = new Vector3();
        rotationAxis.crossVectors(currentDirection, desiredDirection).normalize();

        const newDirection = currentDirection.clone();
        newDirection.applyAxisAngle(rotationAxis, turnAngle);

        projectile.velocity.copy(newDirection).multiplyScalar(projectile.speed);
      }
    } else {
      // Standard homing logic with enhanced strength for tower projectiles
      const homingStrength = isTowerProjectile ? Math.min(projectile.homingStrength + 0.1, 1.0) : projectile.homingStrength;

      // Calculate desired direction (interpolate between current and target direction)
      const desiredDirection = new Vector3();
      desiredDirection.lerpVectors(currentDirection, this.tempVector, homingStrength);

      // Calculate angle between current and desired direction
      const angle = currentDirection.angleTo(desiredDirection);

      // Limit turn rate (more aggressive for tower projectiles)
      const maxTurnThisFrame = projectile.maxTurnRate * deltaTime;
      const turnAngle = Math.min(angle, maxTurnThisFrame);

      // If we need to turn
      if (turnAngle > 0.001) { // Small threshold to avoid jitter
        // Calculate rotation axis
        const rotationAxis = new Vector3();
        rotationAxis.crossVectors(currentDirection, desiredDirection).normalize();

        // Create rotation quaternion
        const cosHalfAngle = Math.cos(turnAngle / 2);
        const sinHalfAngle = Math.sin(turnAngle / 2);

        // Apply rotation to current direction
        const newDirection = currentDirection.clone();
        newDirection.applyAxisAngle(rotationAxis, turnAngle);

        // Update velocity while maintaining speed
        projectile.velocity.copy(newDirection).multiplyScalar(projectile.speed);
      }
    }
  }



  private checkCollisions(projectileEntity: Entity, transform: Transform, projectile: Projectile): void {
    const projectilePos = transform.position;

    // Skip barrage and viper sting projectiles in PVP mode - they should only be handled by specialized PVP managers
    const renderer = projectileEntity.getComponent(Renderer);
    if (renderer?.mesh?.userData?.isBarrageArrow || renderer?.mesh?.userData?.projectileType === 'viper_sting') {
      // In PVP mode, these projectiles are handled by the specialized PVP managers
      // Skip ECS collision detection to prevent duplicate damage and self-targeting
      return;
    }

    // Get all entities that could be hit - specifically look for enemies with colliders
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);

    // Early exit if no targets
    if (potentialTargets.length === 0) return;

    for (const target of potentialTargets) {
      // Skip self and owner
      if (target.id === projectileEntity.id || target.id === projectile.owner) {
        // Debug logging for owner collision prevention
        if (target.id === projectile.owner) {
          // console.log(`🚫 Projectile ${projectileEntity.id} skipping owner ${projectile.owner} (target ${target.id})`);
        }
        continue;
      }

      // Skip if already hit and not piercing
      if (!projectile.canHitTarget(target.id)) {
        continue;
      }

      const targetTransform = target.getComponent(Transform)!;
      const targetHealth = target.getComponent(Health)!;
      const targetCollider = target.getComponent(Collider)!;
      
      // Skip if target is dead
      if (targetHealth.isDead) {
        continue;
      }

      // Check if projectile can hit this target (layer-based collision)
      // In PVP mode, projectiles can hit both ENEMY (remote players) and PLAYER (local player) layers
      if (targetCollider.layer !== CollisionLayer.ENEMY && targetCollider.layer !== CollisionLayer.PLAYER) {
        continue;
      }

      // Additional safety check: prevent projectiles from hitting their owner in PVP mode
      // This is a backup check in case the owner comparison above fails
      if (targetCollider.layer === CollisionLayer.PLAYER && target.id === projectile.owner) {
          // console.log(`🚫 Extra safety: Projectile ${projectileEntity.id} prevented from hitting owner ${projectile.owner} (PVP mode)`);
        continue;
      }

      // CRITICAL PVP FIX: Prevent Viper Sting projectiles from hitting the local player
      // In PVP, Viper Sting projectiles from remote players should not damage the local player
      // The local player always has CollisionLayer.PLAYER, while remote players have CollisionLayer.ENEMY
      if (targetCollider.layer === CollisionLayer.PLAYER && projectile.projectileType === 'viper_sting') {
        // This is a Viper Sting projectile hitting the local player - skip it
        // The OptimizedPVPViperStingManager will handle PVP damage separately
        continue;
      }

      const targetPos = targetTransform.getWorldPosition();

      // Use collider radius for more accurate collision detection
      const projectileRadius = 0.2; // Increased from 0.1 for more forgiving collision detection
      const targetRadius = targetCollider.radius;

      // Use squared distance for performance (avoid sqrt)
      const distanceSquared = projectilePos.distanceToSquared(targetPos);
      const collisionRadiusSquared = (projectileRadius + targetRadius) ** 2;
      
      if (distanceSquared <= collisionRadiusSquared) {
        this.handleHit(projectileEntity, target, projectile, targetHealth);
        
        // If not piercing, destroy projectile
        if (!projectile.piercing) {
          this.projectilesToDestroy.push(projectileEntity.id);
          break;
        }
      }
    }
  }

  private handleHit(
    projectileEntity: Entity, 
    target: Entity, 
    projectile: Projectile, 
    targetHealth: Health
  ): void {
    // Mark target as hit
    projectile.addHitTarget(target.id);

    // Deal damage through combat system if available, otherwise directly
    if (this.combatSystem) {
      // Check projectile type for special damage handling
      const renderer = projectileEntity.getComponent(Renderer);
      const isCrossentropyBolt = renderer?.mesh?.userData?.isCrossentropyBolt;
      const isEntropicBolt = renderer?.mesh?.userData?.isEntropicBolt;
      
      let damageType = 'projectile';
      if (isCrossentropyBolt) {
        damageType = 'crossentropy';
      } else if (isEntropicBolt) {
        damageType = 'entropic';
      }
      

      
      this.combatSystem.queueDamage(target, projectile.damage, projectileEntity, damageType, projectile.sourcePlayerId);
    } else {
      // Fallback to direct damage (pass entity for shield absorption)
      const currentTime = Date.now() / 1000;
      const damageDealt = targetHealth.takeDamage(projectile.damage, currentTime, target);
      
    }

    // Handle explosion if explosive
    if (projectile.explosionRadius > 0) {
      this.handleExplosion(projectileEntity, projectile);
    }
  }

  private handleExplosion(projectileEntity: Entity, projectile: Projectile): void {
    const projectileTransform = projectileEntity.getComponent(Transform)!;
    const explosionCenter = projectileTransform.position;

    // Emit explosion event for visual effects
    this.world.emitEvent('explosion', {
      position: explosionCenter.clone(),
      color: new Color('#00ff44'),
      size: projectile.explosionRadius,
      duration: 0.5
    });

    // Find all entities within explosion radius
    const potentialTargets = this.world.queryEntities([Transform, Health]);

    for (const target of potentialTargets) {
      if (target.id === projectile.owner) continue; // Don't damage owner

      const targetTransform = target.getComponent(Transform)!;
      const targetHealth = target.getComponent(Health)!;
      const distance = explosionCenter.distanceTo(targetTransform.position);

      if (distance <= projectile.explosionRadius) {
        // Calculate damage falloff based on distance
        const damageFalloff = 1 - (distance / projectile.explosionRadius);
        const explosionDamage = Math.floor(projectile.damage * damageFalloff);

        if (explosionDamage > 0) {
          const currentTime = Date.now() / 1000;
          targetHealth.takeDamage(explosionDamage, currentTime, target);
        }
      }
    }
  }

  private checkWorldBounds(entity: Entity, transform: Transform): void {
    const pos = transform.position;
    const maxDistance = 40; // Maximum distance from origin
    const maxDistanceSquared = maxDistance * maxDistance;

    // Check if projectile is too far from origin (using squared distance)
    if (pos.lengthSq() > maxDistanceSquared) {
      this.projectilesToDestroy.push(entity.id);
      return; // Early exit
    }

    // Check if projectile is below ground (simple ground check)
    if (pos.y < -10) {
      this.projectilesToDestroy.push(entity.id);
    }
  }

  // Utility method to create a ChargedArrow projectile for fully charged bow
  public createChargedArrowProjectile(
    world: World,
    position: Vector3,
    direction: Vector3,
    ownerId: number,
    config?: {
      speed?: number;
      damage?: number;
      lifetime?: number;
      piercing?: boolean;
      explosive?: boolean;
      explosionRadius?: number;
      subclass?: WeaponSubclass;
      level?: number;
      opacity?: number;
      sourcePlayerId?: string;
    }
  ): Entity {
    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component with charged arrow-specific settings
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 35; // Faster than regular arrows
    projectile.damage = config?.damage || 25; // Higher damage than regular arrows
    projectile.maxLifetime = config?.lifetime || 5; // Longer lifetime
    projectile.owner = ownerId;
    projectile.sourcePlayerId = config?.sourcePlayerId || 'unknown';
    projectile.setDirection(direction);

    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }
    
    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for ChargedArrow
    const renderer = world.createComponent(Renderer);
    
    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.15, 8, 8);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#ffaa00',
      emissive: '#ffaa00',
      emissiveIntensity: 3,
      transparent: true,
      opacity: 0.1 // Very low opacity since React component will handle visuals
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);
    
    // Mark this as a ChargedArrow for special handling
    placeholderMesh.userData.isChargedArrow = true;
    placeholderMesh.userData.direction = direction.clone();
    placeholderMesh.userData.subclass = config?.subclass;
    placeholderMesh.userData.level = config?.level;
    placeholderMesh.userData.opacity = config?.opacity || 1.0;
    
    renderer.mesh = placeholderMesh;
    projectileEntity.addComponent(renderer);

    // Add Collider component
    const collider = world.createComponent(Collider);
    collider.radius = 0.15;
    collider.layer = CollisionLayer.PROJECTILE;
    projectileEntity.addComponent(collider);

    return projectileEntity;
  }

  // Utility method to create a CrossentropyBolt projectile for scythe
  public createCrossentropyBoltProjectile(
    world: World,
    position: Vector3,
    direction: Vector3,
    ownerId: number,
    config?: {
      speed?: number;
      damage?: number;
      lifetime?: number;
      piercing?: boolean;
      explosive?: boolean;
      explosionRadius?: number;
      subclass?: WeaponSubclass;
      level?: number;
      opacity?: number;
    }
  ): Entity {
    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component with scythe-specific settings
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 20; // Slower than arrows
    projectile.damage = config?.damage || 30; // Higher damage than arrows
    projectile.maxLifetime = config?.lifetime || 1.75; // Longer lifetime
    projectile.owner = ownerId;
    projectile.setDirection(direction);
    
    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }
    
    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for CrossentropyBolt
    const renderer = world.createComponent(Renderer);
    
    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.28, 8, 8);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#00ff44',
      emissive: '#00ff44',
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0 // Very low opacity since React component will handle visuals
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);
    
    // Mark this as a CrossentropyBolt for special handling
    placeholderMesh.userData.isCrossentropyBolt = true;
    placeholderMesh.userData.projectileEntity = projectileEntity;
    placeholderMesh.userData.direction = direction.clone();
    
    renderer.mesh = placeholderMesh;
    
    // Set shadow casting with safety check
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(false);
    } else {
      // console.warn('⚠️ Renderer component missing setCastShadow method:', renderer);
    }
    
    projectileEntity.addComponent(renderer);

    
    // Notify systems that the entity is ready
    this.world.notifyEntityAdded(projectileEntity);
    
    return projectileEntity;
  }

  // Utility method to create an EntropicBolt projectile for scythe left click
  public createEntropicBoltProjectile(
    world: World,
    position: Vector3,
    direction: Vector3,
    ownerId: number,
    config?: {
      speed?: number;
      damage?: number;
      lifetime?: number;
      piercing?: boolean;
      explosive?: boolean;
      explosionRadius?: number;
      subclass?: WeaponSubclass;
      level?: number;
      opacity?: number;
      sourcePlayerId?: string;
      isCryoflame?: boolean;
    }
  ): Entity {
    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component with EntropicBolt-specific settings
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 20; // Faster than CrossentropyBolt
    projectile.damage = config?.damage || 20; // EntropicBolt damage
    projectile.maxLifetime = config?.lifetime ||1.75; // Shorter lifetime
    projectile.owner = ownerId;
    projectile.sourcePlayerId = config?.sourcePlayerId || 'unknown';
    projectile.setDirection(direction);
    
    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }
    
    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for EntropicBolt
    const renderer = world.createComponent(Renderer);
    
    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.15, 6, 6);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#00ff44',
      emissive: '#00ff44',
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0 // Very low opacity since React component will handle visuals
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);
    
    // Mark this as an EntropicBolt for special handling
    placeholderMesh.userData.isEntropicBolt = true;
    placeholderMesh.userData.projectileEntity = projectileEntity;
    placeholderMesh.userData.direction = direction.clone();
    placeholderMesh.userData.isCryoflame = config?.isCryoflame || false;
    
    renderer.mesh = placeholderMesh;
    
    // Set shadow casting with safety check
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(false);
    } else {
      // console.warn('⚠️ Renderer component missing setCastShadow method:', renderer);
    }
    
    projectileEntity.addComponent(renderer);


    // Notify systems that the entity is ready
    this.world.notifyEntityAdded(projectileEntity);
    
    return projectileEntity;
  }

  // Utility method to create a projectile
  public createProjectile(
    world: World,
    position: Vector3,
    direction: Vector3,
    ownerId: number,
    config?: {
      speed?: number;
      damage?: number;
      lifetime?: number;
      piercing?: boolean;
      explosive?: boolean;
      explosionRadius?: number;
      subclass?: WeaponSubclass;
      level?: number;
      opacity?: number;
      maxDistance?: number;
      projectileType?: string; // Add projectile type for special handling
      sourcePlayerId?: string; // Add source player ID for multiplayer team validation
    }
  ): Entity {
    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 20;
    projectile.damage = config?.damage || 5; // Set default damage to 5 as requested
    projectile.maxLifetime = config?.lifetime || 2;
    projectile.owner = ownerId;
    projectile.sourcePlayerId = config?.sourcePlayerId || 'unknown';
    projectile.projectileType = config?.projectileType || 'generic';
    projectile.setDirection(direction);
    projectile.setStartPosition(position);
    
    // Set max distance if specified (for bow arrows)
    if (config?.maxDistance !== undefined) {
      projectile.setMaxDistance(config.maxDistance);
    }
    
    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }
    
    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for RegularArrow
    const renderer = world.createComponent(Renderer);

    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.15, 8, 8);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#ffaa00',
      emissive: '#ffaa00',
      emissiveIntensity: 3,
      transparent: true,
      opacity: 0.1 // Very low opacity since React component will handle visuals
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);

    // Only mark as RegularArrow if it's actually a regular arrow or generic projectile
    // Don't mark special projectile types like wind_shear
    const projectileType = config?.projectileType || 'generic';
    if (projectileType === 'generic' || projectileType === 'regular_arrow') {
      placeholderMesh.userData.isRegularArrow = true;
    }

    placeholderMesh.userData.direction = direction.clone();
    placeholderMesh.userData.subclass = config?.subclass;
    placeholderMesh.userData.level = config?.level;
    placeholderMesh.userData.opacity = config?.opacity || 1.0;
    placeholderMesh.userData.projectileType = projectileType;
    
    renderer.mesh = placeholderMesh;
    
    // Set shadow casting with safety check
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(false); // Projectiles don't need to cast shadows
    } else {
      // console.warn('⚠️ Renderer component missing setCastShadow method:', renderer);
    }
    
    projectileEntity.addComponent(renderer);

    // Add Collider component
    const collider = world.createComponent(Collider);
    collider.radius = 0.15;
    collider.layer = CollisionLayer.PROJECTILE;
    projectileEntity.addComponent(collider);
    
    // Notify systems that the entity is ready (this will trigger RenderSystem.onEntityAdded)
    this.world.notifyEntityAdded(projectileEntity);
    
    return projectileEntity;
  }



  // Get pool statistics for debugging
  public getPoolStats(): { 
    vector3: number;
  } {
    return {
      vector3: this.vector3Pool.getPoolSize()
    };
  }

  // Dispose of all pools when system is destroyed
  public onDisable(): void {
    this.vector3Pool.clear();
  }
}
