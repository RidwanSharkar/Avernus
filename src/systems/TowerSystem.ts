// Tower system for managing PVP tower AI, targeting, and shooting
import { Vector3 } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Tower } from '@/ecs/components/Tower';
import { SummonedUnit } from '@/ecs/components/SummonedUnit';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';
import { Collider, CollisionLayer } from '@/ecs/components/Collider';
import { World } from '@/ecs/World';
import { ProjectileSystem } from './ProjectileSystem';

export class TowerSystem extends System {
  public readonly requiredComponents = [Transform, Tower, Health];
  private world: World;
  private projectileSystem: ProjectileSystem | null = null;
  
  // Callback for broadcasting tower attacks in multiplayer
  private onTowerAttackCallback?: (towerOwnerId: string, targetPlayerId: string, position: Vector3, direction: Vector3) => void;
  
  // Player entity mapping for identifying tower owners vs enemies
  private serverPlayerEntities: Map<string, number> = new Map();
  private localSocketId: string | null = null;
  
  // Track stealth states for remote players
  private playerStealthStates: Map<string, boolean> = new Map();

  // Track player levels for damage scaling
  private playerLevels: Map<string, number> = new Map();

  // Reusable objects to reduce allocations
  private tempVector = new Vector3();
  private tempVector2 = new Vector3();

  constructor(world: World) {
    super();
    this.world = world;
    this.priority = 25; // Run after movement and projectiles
  }
  
  public setProjectileSystem(projectileSystem: ProjectileSystem): void {
    this.projectileSystem = projectileSystem;
  }
  
  public setTowerAttackCallback(callback: (towerOwnerId: string, targetPlayerId: string, position: Vector3, direction: Vector3) => void): void {
    this.onTowerAttackCallback = callback;
  }
  
  public setPlayerMapping(serverPlayerEntities: Map<string, number>, localSocketId: string): void {
    this.serverPlayerEntities = serverPlayerEntities;
    this.localSocketId = localSocketId;
  }

  public update(entities: Entity[], deltaTime: number): void {
    const currentTime = Date.now() / 1000; // Convert to seconds
    
    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      const tower = entity.getComponent(Tower);
      const health = entity.getComponent(Health);
      
      if (!transform || !tower || !health) continue;
      
      // Check if tower is dead
      if (health.isDead && !tower.isDead) {
        tower.die(currentTime);
        continue;
      }
      
      // Skip inactive or dead towers
      if (!tower.isActive || tower.isDead) continue;
      
      // Search for targets periodically
      if (tower.canSearchForTargets(currentTime)) {
        this.searchForTarget(entity, transform, tower, currentTime);
      }
      
      // Validate current target (check if still alive and in range)
      if (tower.currentTarget) {
        const targetEntity = this.world.getEntity(tower.currentTarget);
        if (!this.isValidTarget(targetEntity || null, transform, tower)) {
          tower.clearTarget();
        }
      }
      
      // Attack current target if possible
      if (tower.currentTarget && tower.canAttack(currentTime)) {
        this.attackTarget(entity, transform, tower, currentTime);
      }
    }
  }
  
  private searchForTarget(towerEntity: Entity, towerTransform: Transform, tower: Tower, currentTime: number): void {
    tower.updateTargetSearch(currentTime);

    // Get all potential targets (players that are not the tower owner)
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);

    // Debug logging for tower targeting


    let closestTarget: Entity | null = null;
    let closestDistance = Infinity;
    let validTargetCount = 0;
    
    for (const target of potentialTargets) {
      const targetCollider = target.getComponent(Collider);
      const targetTransform = target.getComponent(Transform);
      
      if (targetCollider && targetTransform) {
        const distance = towerTransform.position.distanceTo(targetTransform.position);
      }
      
      if (!this.isValidTarget(target, towerTransform, tower)) {
        // Debug: Log why target was rejected
        const targetPlayerId = this.getPlayerIdForEntity(target);
        const targetCollider = target.getComponent(Collider);
        continue;
      }

      validTargetCount++;
      const targetTransform2 = target.getComponent(Transform);
      if (!targetTransform2) continue;

      const distance = towerTransform.position.distanceTo(targetTransform2.position);

      if (distance <= tower.targetSearchRange && distance < closestDistance) {
        closestTarget = target;
        closestDistance = distance;
      }
    }
    
    
    if (closestTarget) {
      // Get target info for logging
      const targetTransform = closestTarget.getComponent(Transform);
      const targetCollider = closestTarget.getComponent(Collider);
      const targetPlayerId = this.getPlayerIdForEntity(closestTarget);

      tower.setTarget(closestTarget.id);
    } else if (tower.currentTarget) {
      // Clear target if no valid targets found
      tower.clearTarget();
    }
  }
  
  private isValidTarget(target: Entity | null, towerTransform: Transform, tower: Tower): boolean {
    if (!target) {
      return false;
    }

    const targetHealth = target.getComponent(Health);
    const targetTransform = target.getComponent(Transform);
    const targetCollider = target.getComponent(Collider);

    // Must have required components and be alive
    if (!targetHealth || !targetTransform || !targetCollider || targetHealth.isDead) {
      return false;
    }

    // Must be a player (not an enemy or other tower)
    if (targetCollider.layer !== CollisionLayer.PLAYER && targetCollider.layer !== CollisionLayer.ENEMY) {
      return false;
    }

    // Don't target other towers
    if (target.hasComponent(Tower)) {
      return false;
    }

    // CRITICAL: Never target the tower's own owner - check this first
    if (this.localSocketId && this.serverPlayerEntities.size > 0) {
      // Check if this target is the tower owner (local player)
      if (targetCollider.layer === CollisionLayer.PLAYER && tower.ownerId === this.localSocketId) {
        return false;
      }

      // Check if this target is the tower owner (remote player)
      if (targetCollider.layer === CollisionLayer.ENEMY) {
        // Find which player this entity belongs to
        let targetPlayerId: string | null = null;
        this.serverPlayerEntities.forEach((entityId, playerId) => {
          if (entityId === target.id) {
            targetPlayerId = playerId;
          }
        });

        if (targetPlayerId && tower.ownerId === targetPlayerId) {
          return false;
        }
      }
    }

    // Check if this is a summoned unit
    const summonedUnit = target.getComponent(SummonedUnit);
    if (summonedUnit) {
      // Don't target dead or inactive summoned units
      if (summonedUnit.isDead || !summonedUnit.isActive) {
        return false;
      }
      // Only target enemy summoned units (different owner)
      return summonedUnit.ownerId !== tower.ownerId;
    }

    // For player entities, we need to handle stealth and ensure we don't target own player
    if (this.localSocketId && this.serverPlayerEntities.size > 0) {
      let targetPlayerId: string | null = null;

      // Determine the player ID for this target
      if (targetCollider.layer === CollisionLayer.PLAYER) {
        // Local player
        targetPlayerId = this.localSocketId;
      } else if (targetCollider.layer === CollisionLayer.ENEMY) {
        // Remote player - find their ID from the mapping
        this.serverPlayerEntities.forEach((entityId, playerId) => {
          if (entityId === target.id) {
            targetPlayerId = playerId;
          }
        });
      }

      // If we can't identify the player, be conservative and don't target
      if (!targetPlayerId) {
        return false;
      }

      // Check if target player is invisible (stealthed)
      if (this.playerStealthStates.get(targetPlayerId)) {
        return false; // Don't target invisible players
      }

      // At this point, we know it's a valid enemy player (not the tower owner)
      // The ownership check was already done above, so we can safely return true
      return true;
    }

    // If we reach here, we couldn't properly identify the target
    // Be conservative and don't target unidentified entities
    return false;
  }
  
  private attackTarget(towerEntity: Entity, towerTransform: Transform, tower: Tower, currentTime: number): void {
    const targetEntity = this.world.getEntity(tower.currentTarget!);
    if (!targetEntity) {
      tower.clearTarget();
      return;
    }

    // Double-check target validity before attacking
    if (!this.isValidTarget(targetEntity, towerTransform, tower)) {
      tower.clearTarget();
      return;
    }

    const targetTransform = targetEntity.getComponent(Transform);
    if (!targetTransform) {
      tower.clearTarget();
      return;
    }

    // Calculate projectile spawn position (slightly above tower center)
    this.tempVector2.copy(towerTransform.position);
    this.tempVector2.y += 2; // Spawn projectiles 2 units above tower base

    // Calculate direction from spawn position to target (not tower base)
    this.tempVector.copy(targetTransform.position);
    this.tempVector.sub(this.tempVector2);
    const distance = this.tempVector.length();

    // Check if target is still in range
    if (distance > tower.attackRange) {
      tower.clearTarget();
      return;
    }

    // Special handling for very close targets - ensure we can always hit them
    if (distance < 0.5) {
      // For extremely close targets, create a more predictable trajectory
      // Aim slightly above the target to account for gravity and ensure hit
      this.tempVector.copy(targetTransform.position);
      this.tempVector.y += 0.3; // Aim 0.3 units above target
      this.tempVector.sub(this.tempVector2);
      this.tempVector.normalize();
    } else {
      // Normalize direction for normal cases
      this.tempVector.normalize();
    }
    
    // Create projectile
    if (this.projectileSystem) {
      const projectileConfig = {
        speed: tower.projectileSpeed,
        damage: tower.attackDamage,
        lifetime: 2, // 5 second lifetime
        opacity: 1.0,
        sourcePlayerId: tower.ownerId // Set the tower owner as the source player for proper EXP attribution
      };

      const projectileEntity = this.projectileSystem.createProjectile(
        this.world,
        this.tempVector2, // spawn position
        this.tempVector,  // direction
        towerEntity.id,   // tower as owner
        projectileConfig
      );

      // Enable extremely strong homing for tower projectiles
      const projectile = projectileEntity.getComponent(Projectile);
      if (projectile && tower.currentTarget) {
        // Check if target is a summoned unit for special handling
        const targetEntity = this.world.getEntity(tower.currentTarget);
        const isSummonedUnit = targetEntity?.getComponent(SummonedUnit) !== undefined;

        if (isSummonedUnit) {
          // Make it IMPOSSIBLE for summoned units to dodge - perfect tracking
          projectile.setHoming(tower.currentTarget, 1.0, 8.0);
        } else {
          // For players: very difficult to dodge but not impossible
          projectile.setHoming(tower.currentTarget, 0.95, 6.0);
        }

        // Add special tower projectile properties for enhanced tracking
        projectile.maxTurnRate = isSummonedUnit ? 12.0 : 8.0; // Even faster turns for summoned units
      }

      // Mark projectile as tower projectile for special handling
      const projectileRenderer = projectileEntity.getComponent(Renderer) as Renderer;
      if (projectileRenderer && projectileRenderer.mesh) {
        // Add metadata to identify this as a tower projectile
        projectileRenderer.mesh.userData.isTowerProjectile = true;
        projectileRenderer.mesh.userData.towerOwnerId = tower.ownerId;
        projectileRenderer.mesh.userData.towerIndex = tower.towerIndex;
        projectileRenderer.mesh.userData.isRegularArrow = false; // Override regular arrow flag
        projectileRenderer.mesh.userData.direction = this.tempVector.clone();
        projectileRenderer.mesh.userData.opacity = 1.0;
      }
      
      // Also mark the entity itself for ProjectileSystem detection
      (projectileEntity as any).isTowerProjectile = true;
      (projectileEntity as any).towerOwnerId = tower.ownerId;

      // CRITICAL: Set source player ID on projectile for damage routing
      // This ensures tower projectiles can damage enemy summoned units
      projectileEntity.userData = projectileEntity.userData || {};
      projectileEntity.userData.playerId = tower.ownerId;
      
      // Also set it on the projectile component for combat system detection
      const projectileComponent = projectileEntity.getComponent(Projectile);
      if (projectileComponent) {
        (projectileComponent as any).sourcePlayerId = tower.ownerId;
      }

    }
    
    // Broadcast attack to multiplayer if callback is set
    if (this.onTowerAttackCallback) {
      // We need to map the target entity back to a player ID
      // For now, we'll use a placeholder - this will need to be improved with proper player mapping
      const targetPlayerId = `player_${tower.currentTarget}`;
      this.onTowerAttackCallback(tower.ownerId, targetPlayerId, this.tempVector2, this.tempVector);
    }
    
    tower.performAttack(currentTime);
  }
  
  // Utility method to get all towers owned by a specific player
  public getTowersByOwner(ownerId: string): Entity[] {
    const allTowers = this.world.queryEntities([Transform, Tower, Health]);
    return allTowers.filter(entity => {
      const tower = entity.getComponent(Tower);
      return tower && tower.ownerId === ownerId;
    });
  }
  
  // Utility method to get tower count for a player
  public getTowerCount(ownerId: string): number {
    return this.getTowersByOwner(ownerId).length;
  }
  
  // Utility method to check if a player has any active towers
  public hasActiveTowers(ownerId: string): boolean {
    const towers = this.getTowersByOwner(ownerId);
    return towers.some(entity => {
      const tower = entity.getComponent(Tower);
      const health = entity.getComponent(Health);
      return tower && health && tower.isActive && !tower.isDead && !health.isDead;
    });
  }
  
  // Methods for managing player stealth states
  public updatePlayerStealthState(playerId: string, isInvisible: boolean): void {
    this.playerStealthStates.set(playerId, isInvisible);
  }
  
  public clearPlayerStealthState(playerId: string): void {
    this.playerStealthStates.delete(playerId);
  }
  
  public setLocalSocketId(socketId: string): void {
    this.localSocketId = socketId;
  }

  // Update player level and adjust tower damage accordingly
  public updatePlayerLevel(playerId: string, newLevel: number): void {
    const oldLevel = this.playerLevels.get(playerId) || 1;

    if (oldLevel !== newLevel) {
      this.playerLevels.set(playerId, newLevel);

      // Update all towers owned by this player
      this.updateTowersForPlayer(playerId, newLevel);
    }
  }

  // Update all towers for a specific player with their new level
  private updateTowersForPlayer(playerId: string, newLevel: number): void {
    const allTowers = this.world.queryEntities([Transform, Tower, Health]);

    for (const towerEntity of allTowers) {
      const tower = towerEntity.getComponent(Tower);
      if (tower && tower.ownerId === playerId) {
        tower.updatePlayerLevel(newLevel);
      }
    }
  }

  // Get current level for a player (defaults to 1)
  public getPlayerLevel(playerId: string): number {
    return this.playerLevels.get(playerId) || 1;
  }

  // Initialize player levels from a players map (useful for startup)
  public initializePlayerLevels(players: Map<string, any>): void {
    players.forEach((player, playerId) => {
      if (player.level && player.level !== this.getPlayerLevel(playerId)) {
        this.updatePlayerLevel(playerId, player.level);
      }
    });
  }

  // Helper method to get player ID for an entity
  private getPlayerIdForEntity(entity: Entity): string | null {
    if (!this.localSocketId || this.serverPlayerEntities.size === 0) {
      return null;
    }

    const collider = entity.getComponent(Collider);
    if (!collider) return null;

    if (collider.layer === CollisionLayer.PLAYER) {
      return this.localSocketId;
    } else if (collider.layer === CollisionLayer.ENEMY) {
      // Find the player ID from the server player entities map
      let playerId: string | null = null;
      this.serverPlayerEntities.forEach((entityId, pId) => {
        if (entityId === entity.id) {
          playerId = pId;
        }
      });
      return playerId;
    }

    return null;
  }
}
