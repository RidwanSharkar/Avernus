// SummonedUnit system for managing PVP tower minions
import { Vector3 } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { SummonedUnit } from '@/ecs/components/SummonedUnit';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { Tower } from '@/ecs/components/Tower';
import { World } from '@/ecs/World';
import { CombatSystem } from './CombatSystem';

export class SummonedUnitSystem extends System {
  public readonly requiredComponents = [Transform, SummonedUnit, Health];

  private world: World;
  private combatSystem: CombatSystem | null = null;

  // Unit spawning tracking
  private lastSpawnTime: Map<string, number> = new Map(); // ownerId -> last spawn time
  private spawnInterval: number = 45; // 45 seconds between spawns

  // Wave tracking
  private currentWaveId: string | null = null;
  private waveUnits: Set<number> = new Set(); // Entity IDs of units in current wave
  private waveStartTime: number = 0;
  private lastWaveCompletionTime: number = 0;

  // Unit tracking
  private unitsToDestroy: number[] = [];

  // Player and tower positions for targeting
  private playerPositions: Map<string, Vector3> = new Map();
  private towerPositions: Map<string, Vector3> = new Map();

  // Wave completion callback
  private onWaveComplete?: () => void;

  // Elite unit tracking based on opponent's lost pillars
  private destroyedEnemyPillars: Map<string, number> = new Map(); // playerId -> number of their own pillars that have been destroyed

  // Reusable objects
  private tempVector = new Vector3();
  private tempVector2 = new Vector3();

  constructor(world: World) {
    super();
    this.world = world;
    this.priority = 15; // Run before combat system
  }

  public setCombatSystem(combatSystem: CombatSystem): void {
    this.combatSystem = combatSystem;
  }

  public setWaveCompleteCallback(callback: () => void): void {
    this.onWaveComplete = callback;
  }

  public updatePlayerPosition(playerId: string, position: Vector3): void {
    this.playerPositions.set(playerId, position.clone());
  }

  public updateTowerPosition(towerId: string, position: Vector3): void {
    this.towerPositions.set(towerId, position.clone());
  }

  public update(entities: Entity[], deltaTime: number): void {
    const currentTime = Date.now() / 1000; // Convert to seconds

    this.unitsToDestroy.length = 0;

    // Process existing units
    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      const unit = entity.getComponent(SummonedUnit);
      const health = entity.getComponent(Health);

      if (!transform || !unit || !health) continue;

      // Check if unit is expired
      if (unit.isExpired(currentTime)) {
        // Remove unit from wave tracking
        this.waveUnits.delete(entity.id);

        this.unitsToDestroy.push(entity.id);
        continue;
      }

      // Check if unit is dead
      if (health.isDead && !unit.isDead) {
        unit.die(currentTime);

        // Remove unit from wave tracking immediately
        this.waveUnits.delete(entity.id);

        // Mark for destruction and immediately disable to prevent targeting
        unit.isActive = false;
        this.unitsToDestroy.push(entity.id);
        continue;
      }

      // Skip inactive or dead units (including those marked for destruction)
      if (!unit.isActive || unit.isDead || health.isDead) continue;

      // Update unit behavior
      this.updateUnitBehavior(entity, transform, unit, currentTime, deltaTime);
    }

    // Check for wave completion
    this.checkWaveCompletion(currentTime);

    // Handle spawning new units
    this.handleUnitSpawning(currentTime);

    // Destroy expired units
    for (const entityId of this.unitsToDestroy) {
      this.world.destroyEntity(entityId);
    }
  }

  private updateUnitBehavior(
    entity: Entity,
    transform: Transform,
    unit: SummonedUnit,
    currentTime: number,
    deltaTime: number
  ): void {
    // Search for targets periodically
    if (unit.canSearchForTargets(currentTime)) {
      this.findTargetForUnit(unit, transform.position);
      unit.updateTargetSearch(currentTime);
    }

    // Move towards target position if no specific target
    if (!unit.currentTarget && unit.targetPosition) {
      this.moveTowardsPosition(entity, transform, unit, deltaTime);
    }

    // Handle combat with current target
    if (unit.currentTarget && unit.canAttack(currentTime)) {
      this.handleUnitAttack(entity, unit, currentTime);
    }
  }

  private findTargetForUnit(unit: SummonedUnit, unitPosition: Vector3): void {
    // Priority 1: Find enemy units to attack
    const enemyUnits = this.findEnemyUnits(unit.ownerId, unitPosition);
    if (enemyUnits.length > 0) {
      // Target the closest enemy unit
      const closestUnit = this.findClosestEntity(enemyUnits, unitPosition);
      if (closestUnit) {
        unit.setTarget(closestUnit.id);
        return;
      }
    }

    // Priority 2: If no enemy units, target enemy tower
    const enemyTower = this.findEnemyTower(unit.ownerId, unitPosition);
    if (enemyTower) {
      unit.setTarget(enemyTower.id);
      return;
    }

    // No targets found, clear target
    unit.clearTarget();
  }

  private findEnemyUnits(ownerId: string, unitPosition: Vector3): Entity[] {
    const enemyUnits: Entity[] = [];
    const allEntities = this.world.queryEntities([Transform, SummonedUnit, Health, Collider]);

    for (const entity of allEntities) {
      const summonedUnit = entity.getComponent(SummonedUnit);
      const health = entity.getComponent(Health);
      const collider = entity.getComponent(Collider);

      if (!summonedUnit || !health || !collider) continue;
      if (health.isDead || !summonedUnit.isActive) continue;

      // Check if this is an enemy unit (different owner)
      if (summonedUnit.ownerId !== ownerId && collider.layer === CollisionLayer.ENEMY) {
        enemyUnits.push(entity);
      }
    }

    return enemyUnits;
  }

  private findEnemyTower(ownerId: string, unitPosition: Vector3): Entity | null {
    const allEntities = this.world.queryEntities([Transform, Tower, Health, Collider]);

    for (const entity of allEntities) {
      const tower = entity.getComponent(Tower);
      const health = entity.getComponent(Health);
      const collider = entity.getComponent(Collider);

      if (!tower || !health || !collider) continue;
      if (health.isDead || !tower.isActive) continue;

      // Check if this is an enemy tower
      if (tower.ownerId !== ownerId && collider.layer === CollisionLayer.ENEMY) {
        return entity;
      }
    }

    return null;
  }

  private findClosestEntity(entities: Entity[], fromPosition: Vector3): Entity | null {
    let closestEntity: Entity | null = null;
    let closestDistance = Infinity;

    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      if (!transform) continue;

      const distance = fromPosition.distanceTo(transform.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestEntity = entity;
      }
    }

    return closestEntity;
  }

  private moveTowardsPosition(
    entity: Entity,
    transform: Transform,
    unit: SummonedUnit,
    deltaTime: number
  ): void {
    if (!unit.targetPosition) return;

    const currentPos = transform.position;
    const targetPos = new Vector3(unit.targetPosition.x, unit.targetPosition.y, unit.targetPosition.z);

    // Calculate direction to target
    this.tempVector.copy(targetPos).sub(currentPos);
    const distance = this.tempVector.length();

    // If close enough to target position, stop moving
    if (distance < 0.5) {
      unit.targetPosition = null;
      return;
    }

    // Normalize and move
    this.tempVector.normalize();
    const moveDistance = unit.moveSpeed * deltaTime;

    if (moveDistance < distance) {
      // Move towards target
      const newPosition = currentPos.clone().add(this.tempVector.multiplyScalar(moveDistance));
      transform.setPosition(newPosition.x, newPosition.y, newPosition.z);
    } else {
      // Arrived at target
      transform.setPosition(targetPos.x, targetPos.y, targetPos.z);
      unit.targetPosition = null;
    }

    // Update movement component if it exists
    const movement = entity.getComponent(Movement);
    if (movement) {
      movement.velocity.copy(this.tempVector).multiplyScalar(unit.moveSpeed);
    }
  }

  private handleUnitAttack(entity: Entity, unit: SummonedUnit, currentTime: number): void {
    if (!unit.currentTarget) return;

    const targetEntity = this.world.getEntity(unit.currentTarget);
    if (!targetEntity) {
      unit.clearTarget();
      return;
    }

    const targetTransform = targetEntity.getComponent(Transform);
    const targetHealth = targetEntity.getComponent(Health);

    if (!targetTransform || !targetHealth) {
      unit.clearTarget();
      return;
    }

    // Check if target is still in range
    const unitTransform = entity.getComponent(Transform);
    if (!unitTransform) return;

    const distance = unitTransform.position.distanceTo(targetTransform.position);
    if (distance > unit.attackRange) {
      unit.clearTarget();
      return;
    }

    // Check if target is still alive
    if (targetHealth.isDead) {
      unit.clearTarget();
      return;
    }

    // Perform attack
    if (this.combatSystem) {
      // Set the source player ID on the attacking entity for proper attribution
      entity.userData = entity.userData || {};
      entity.userData.playerId = unit.ownerId;
      
      // Use combat system to handle damage
      this.combatSystem.queueDamage(targetEntity, unit.attackDamage, entity, 'melee', entity.userData?.playerId);
    } else {
      // Fallback direct damage
      targetHealth.takeDamage(unit.attackDamage, currentTime, targetEntity);
    }

    unit.performAttack(currentTime);
  }

  private checkWaveCompletion(currentTime: number): void {
    // Check if current wave is complete (all units dead or expired)
    if (this.currentWaveId && this.waveUnits.size === 0) {
      // Ensure we don't spam the callback (minimum 30 seconds between wave completions)
      if (currentTime - this.lastWaveCompletionTime >= 30) {

        // Award experience to all players
        if (this.onWaveComplete) {
          this.onWaveComplete();
        }

        this.lastWaveCompletionTime = currentTime;
        this.currentWaveId = null;
      }
    }
  }

  private handleUnitSpawning(currentTime: number): void {
    // Get all towers to check for spawning
    const towers = this.world.queryEntities([Transform, Tower, Health]);

    for (const towerEntity of towers) {
      const tower = towerEntity.getComponent(Tower);
      const towerTransform = towerEntity.getComponent(Transform);

      if (!tower || !towerTransform) continue;
      if (!tower.isActive || tower.isDead) continue;

      // Check if it's time to spawn units for this tower
      const lastSpawn = this.lastSpawnTime.get(tower.ownerId) || 0;
      if (currentTime - lastSpawn >= this.spawnInterval) {
        this.spawnUnitsForTower(tower, towerTransform.position, currentTime);
        this.lastSpawnTime.set(tower.ownerId, currentTime);
      }
    }
  }

  private spawnUnitsForTower(tower: Tower, towerPosition: Vector3, currentTime: number): void {
    // Start a new wave if this is the first tower spawning in this cycle
    if (!this.currentWaveId) {
      this.currentWaveId = `wave_${currentTime}`;
      this.waveStartTime = currentTime;
      this.waveUnits.clear();
    }

    // Find the opposing tower position for targeting
    let opposingTowerPosition = this.findOpposingTowerPosition(tower.ownerId);

    // If no opposing tower found, use a default position in front of current tower
    if (!opposingTowerPosition) {
      opposingTowerPosition = towerPosition.clone().add(new Vector3(0, 0, 20));
    }

    // Spawn 3 units: some normal, some elite based on destroyed enemy pillars
    const eliteCount = this.getEliteUnitCount(tower.ownerId);
    const normalCount = 3 - eliteCount;

    // Spawn normal units first
    for (let i = 0; i < normalCount; i++) {
      const unitEntity = this.spawnUnit(tower.ownerId, towerPosition, opposingTowerPosition, i, currentTime, false);
      if (unitEntity) {
        this.waveUnits.add(unitEntity.id);
      }
    }

    // Spawn elite units
    for (let i = 0; i < eliteCount; i++) {
      const unitEntity = this.spawnUnit(tower.ownerId, towerPosition, opposingTowerPosition, normalCount + i, currentTime, true);
      if (unitEntity) {
        this.waveUnits.add(unitEntity.id);
      }
    }
  }

  private findOpposingTowerPosition(ownerId: string): Vector3 | null {
    const towers = this.world.queryEntities([Transform, Tower, Health]);

    for (const towerEntity of towers) {
      const tower = towerEntity.getComponent(Tower);
      const towerTransform = towerEntity.getComponent(Transform);

      if (!tower || !towerTransform) continue;
      if (tower.ownerId !== ownerId) {
        return towerTransform.position.clone();
      }
    }

    return null;
  }

  private spawnUnit(
    ownerId: string,
    spawnPosition: Vector3,
    targetPosition: Vector3,
    unitIndex: number,
    currentTime: number,
    isElite: boolean = false
  ): Entity {
    const unitEntity = this.world.createEntity();
    const unitId = `${ownerId}_unit_${currentTime}_${unitIndex}`;

    // Add offset to spawn position to avoid stacking
    const offset = new Vector3(
      (unitIndex - 0.5) * 2, // Spread units left/right
      0,
      0
    );
    const actualSpawnPosition = spawnPosition.clone().add(offset);

    // Add Transform component
    const transform = this.world.createComponent(Transform);
    transform.setPosition(actualSpawnPosition.x, actualSpawnPosition.y, actualSpawnPosition.z);
    unitEntity.addComponent(transform);

    // Add SummonedUnit component
    const summonedUnit = this.world.createComponent(SummonedUnit);
    summonedUnit.ownerId = ownerId;
    summonedUnit.unitId = unitId;
    summonedUnit.isElite = isElite;
    // Reinitialize stats based on elite status
    if (isElite) {
      summonedUnit.maxHealth = 1500;
      summonedUnit.attackDamage = 120;
    }
    summonedUnit.targetPosition = {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z
    };
    summonedUnit.summonTime = currentTime;
    unitEntity.addComponent(summonedUnit);

    // Add Health component
    const health = new Health(summonedUnit.maxHealth);
    unitEntity.addComponent(health);

    // Add Movement component
    const movement = this.world.createComponent(Movement);
    movement.maxSpeed = summonedUnit.moveSpeed;
    movement.friction = 0.9;
    unitEntity.addComponent(movement);

    // Add Collider component
    const collider = this.world.createComponent(Collider);
    collider.type = ColliderType.SPHERE; // Use sphere collider for units
    collider.radius = 0.5;
    collider.layer = CollisionLayer.ENEMY; // Use enemy layer for PVP
    collider.setOffset(0, 0.6, 0); // Center on unit
    unitEntity.addComponent(collider);

    // CRITICAL: Set source player ID on summoned unit entity for proper damage attribution
    // This ensures summoned unit attacks are properly attributed to their owner for PVP experience
    unitEntity.userData = unitEntity.userData || {};
    unitEntity.userData.playerId = ownerId;

    // Notify systems that the entity is ready
    this.world.notifyEntityAdded(unitEntity);

    return unitEntity;
  }

  // Utility methods for external access
  public getUnitCount(ownerId: string): number {
    const units = this.world.queryEntities([Transform, SummonedUnit, Health]);
    return units.filter(entity => {
      const unit = entity.getComponent(SummonedUnit);
      const health = entity.getComponent(Health);
      return unit && health && unit.ownerId === ownerId && unit.isActive && !unit.isDead && !health.isDead;
    }).length;
  }

  public getAllUnits(): Entity[] {
    return this.world.queryEntities([Transform, SummonedUnit, Health]);
  }

  public getUnitsByOwner(ownerId: string): Entity[] {
    const allUnits = this.getAllUnits();
    return allUnits.filter(entity => {
      const unit = entity.getComponent(SummonedUnit);
      return unit && unit.ownerId === ownerId;
    });
  }

  public onDisable(): void {
    // Clean up when system is disabled
    this.lastSpawnTime.clear();
    this.playerPositions.clear();
    this.towerPositions.clear();
    this.waveUnits.clear();
    this.destroyedEnemyPillars.clear();
    this.currentWaveId = null;
    this.onWaveComplete = undefined;
  }

  public onEnemyPillarDestroyed(destroyerPlayerId: string, pillarOwnerId: string): void {
    // Track destroyed pillars for each player (pillars they've lost to opponents)
    // Players get elite units when their opponent's pillars are destroyed
    const currentCount = this.destroyedEnemyPillars.get(pillarOwnerId) || 0;
    this.destroyedEnemyPillars.set(pillarOwnerId, currentCount + 1);
  }

  private getEliteUnitCount(ownerId: string): number {
    // Note: This method would need to be updated to find opponent and count their lost pillars
    // Currently unused in PVP mode (server-authoritative)
    const destroyedPillars = this.destroyedEnemyPillars.get(ownerId) || 0;
    return Math.min(destroyedPillars, 3); // Max 3 elite units (one per enemy pillar destroyed)
  }
}
