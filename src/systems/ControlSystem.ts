// Control system for player input handling
import { Vector3, Matrix4 } from '@/utils/three-exports';
import { PerspectiveCamera } from '@/utils/three-exports';

import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { Enemy } from '@/ecs/components/Enemy';
import { Renderer } from '@/ecs/components/Renderer';
import { Collider } from '@/ecs/components/Collider';
import { InputManager } from '@/core/InputManager';
import { World } from '@/ecs/World';
import { ProjectileSystem } from './ProjectileSystem';
import { CombatSystem } from './CombatSystem';
import { WeaponSubclass, WeaponType } from '@/components/dragon/weapons';
import { DeflectBarrier } from '@/components/weapons/DeflectBarrier';
import { triggerGlobalFrostNova, addGlobalFrozenEnemy } from '@/components/weapons/FrostNovaManager';
import { addGlobalStunnedEnemy } from '@/components/weapons/StunManager';
import { triggerGlobalCobraShot } from '@/components/projectiles/CobraShotManager';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';

export class ControlSystem extends System {
  public readonly requiredComponents = [Transform, Movement];
  private inputManager: InputManager;
  private camera: PerspectiveCamera;
  private world: World;
  private projectileSystem: ProjectileSystem;
  private playerEntity: Entity | null = null;
  
  // Callback for bow release effects
  private onBowReleaseCallback?: (finalProgress: number, isPerfectShot?: boolean) => void;
  
  // Callback for Divine Storm activation
  private onDivineStormCallback?: (position: Vector3, direction: Vector3, duration: number) => void;
  
  // Callback for projectile creation
  private onProjectileCreatedCallback?: (projectileType: string, position: Vector3, direction: Vector3, config: any) => void;
  
  // Callback for Viper Sting activation
  private onViperStingCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Barrage activation
  private onBarrageCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Reanimate healing effect
  private onReanimateCallback?: () => void;
  
  // Callback for Frost Nova activation
  private onFrostNovaCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Cobra Shot activation
  private onCobraShotCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Charge activation
  private onChargeCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Deflect activation
  private onDeflectCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for broadcasting debuff effects in PVP
  private onDebuffCallback?: (targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned', duration: number, position: Vector3) => void;
  
  // Callback for Skyfall ability
  private onSkyfallCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Backstab ability
  private onBackstabCallback?: (position: Vector3, direction: Vector3, damage: number, isBackstab: boolean) => void;
  
  // Callback for Sunder ability
  private onSunderCallback?: (position: Vector3, direction: Vector3, damage: number, stackCount: number) => void;

  // Callback for Smite ability
  private onSmiteCallback?: (position: Vector3, direction: Vector3, onDamageDealt?: (damageDealt: boolean) => void) => void;

  // Callback for DeathGrasp ability
  private onDeathGraspCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for Runeblade mana consumption
  private onConsumeManaCallback?: (amount: number) => void;

  // Callback for Runeblade mana checking
  private onCheckManaCallback?: (amount: number) => boolean;

  // Rate limiting for projectile firing
  private lastFireTime = 0;
  private lastCrossentropyTime = 0; // Separate tracking for CrossentropyBolt
  private lastReanimateTime = 0; // Separate tracking for Reanimate ability
  private lastViperStingTime = 0;
  private lastFrostNovaTime = 0; // Separate tracking for Frost Nova ability
  private lastCobraShotTime = 0; // Separate tracking for Cobra Shot ability
  private fireRate = 0.2; // Default for bow
  private swordFireRate = 0.9; // Rate for sword attacks
  private runebladeFireRate = 0.75; // Runeblade attack rate
  private sabresFireRate = 0.6; // Sabres dual attack rate (600ms between attacks)
  private scytheFireRate = 0.375; // EntropicBolt rate (0.33s cooldown)
  private crossentropyFireRate = 2; // CrossentropyBolt rate (1 per second)
  private viperStingFireRate = 2.5; // Viper Sting rate (2 seconds cooldown)
  private frostNovaFireRate = 12.0; // Frost Nova rate (12 seconds cooldown)
  private cobraShotFireRate = 2.5; // Cobra Shot rate (2 seconds cooldown)
  
  // Current weapon configuration
  private currentWeapon: WeaponType = WeaponType.BOW; // Default weapon
  private currentSubclass: WeaponSubclass = WeaponSubclass.ELEMENTAL; // Default for bow
  private currentLevel = 1;
  
  // Weapon-specific states
  private isCharging = false;
  private chargeProgress = 0;
  private isSwinging = false;
  
  // Viper Sting charging state
  private isViperStingCharging = false;
  private viperStingChargeProgress = 0;
  
  // Barrage charging state
  private isBarrageCharging = false;
  private barrageChargeProgress = 0;
  private lastBarrageTime = 0;
  private barrageFireRate = 5.0; // 5 second cooldown (keeping as requested)
  
  // Cobra Shot charging state
  private isCobraShotCharging = false;
  private cobraShotChargeProgress = 0;
  
  // Sword-specific states
  private swordComboStep: 1 | 2 | 3 = 1;
  private lastSwordAttackTime = 0;
  private swordComboResetTime = 1; // Reset combo after 1 seconds
  
  // Divine Storm ability state
  private isDivineStorming = false;
  private lastDivineStormTime = 0;
  private divineStormCooldown = 8.0; // 8 second cooldown
  
  // Charge ability state
  private isSwordCharging = false;
  private lastChargeTime = 0;
  private chargeCooldown = 8.0; // 8 second cooldown
  
  // Deflect ability state
  private isDeflecting = false;
  private lastDeflectTime = 0;
  private deflectCooldown = 6.0; // 8 second cooldown
  private deflectDuration = 3.0; // 3 second duration
  private deflectBarrier: DeflectBarrier;
  
  // Skyfall ability state (Sabres)
  private isSkyfalling = false;
  private skyfallPhase: 'none' | 'ascending' | 'descending' | 'landing' = 'none';
  private lastSkyfallTime = 0;
  private skyfallCooldown = 5.0; // 4 second cooldown
  private skyfallStartTime = 0;
  private skyfallStartPosition = new Vector3();
  private skyfallTargetHeight = 0;
  private skyfallOriginalGravity = 0;
  
  // Backstab ability state (Sabres)
  private lastBackstabTime = 0;
  private backstabCooldown = 1.5; // 2 second cooldown
  private isBackstabbing = false;
  private backstabStartTime = 0;
  private backstabDuration = 1.0; // Total animation duration (0.3 + 0.4 + 0.3 seconds)
  
  // Sunder ability state (Sabres)
  private lastSunderTime = 0;
  private sunderCooldown = 1.125; // 1.5 second cooldown
  private isSundering = false;
  private sunderStartTime = 0;
  private sunderDuration = 1.0; // Same animation duration as backstab
  
  // Sunder stack tracking - Map of entity ID to stack data
  private sunderStacks = new Map<number, { stacks: number; lastApplied: number; duration: number }>();

  // Smite ability state (Runeblade)
  private lastSmiteTime = 0;
  private smiteCooldown = 2.0; // 2 second cooldown
  private isSmiting = false;

  // DeathGrasp ability state (Runeblade)
  private lastDeathGraspTime = 0;
  private deathGraspCooldown = 5.0; // 5 second cooldown
  private isDeathGrasping = false;
  constructor(
    camera: PerspectiveCamera, 
    inputManager: InputManager, 
    world: World,
    projectileSystem: ProjectileSystem
  ) {
    super();
    this.camera = camera;
    this.inputManager = inputManager;
    this.world = world;
    this.projectileSystem = projectileSystem;
    this.deflectBarrier = new DeflectBarrier(world);
    this.priority = 5; // Run early for input handling
  }

  public setPlayer(entity: Entity): void {
    this.playerEntity = entity;
  }

  public update(entities: Entity[], deltaTime: number): void {
    if (!this.playerEntity) return;

    const playerTransform = this.playerEntity.getComponent(Transform);
    const playerMovement = this.playerEntity.getComponent(Movement);
    
    if (!playerTransform || !playerMovement) return;

    // Update debuff states first
    if (typeof playerMovement.updateDebuffs === 'function') {
      playerMovement.updateDebuffs();
    }
    
    // Clean up expired Sunder stacks periodically
    this.cleanupSunderStacks();

    // Handle weapon switching
    this.handleWeaponSwitching();

    // Handle dash movement first (overrides regular movement)
    this.handleDashMovement(playerMovement, playerTransform);

    // Handle charge movement (overrides regular movement)
    this.handleChargeMovement(playerMovement, playerTransform);

    // Handle player movement input (only if not dashing, charging, frozen, or skyfalling)
    if (!playerMovement.isDashing && !playerMovement.isCharging && !playerMovement.isFrozen && !this.isSkyfalling) {
      this.handleMovementInput(playerMovement);
    }
    
    // Handle combat input
    this.handleCombatInput(playerTransform);
    
    // Update deflect barrier position if active
    this.updateDeflectBarrier(playerTransform);
  }

  private handleMovementInput(movement: Movement): void {
    if (!this.playerEntity) return;

    const playerTransform = this.playerEntity.getComponent(Transform);
    if (!playerTransform) return;

    // Check for double-tap dashes first (before processing regular movement)
    this.checkForDashInput(movement, playerTransform);

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
    if (hasInput) {
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
    } else {
      movement.setMoveDirection(new Vector3(0, 0, 0), 0);
    }

    // Handle jumping
    if (this.inputManager.isKeyPressed(' ')) { // Spacebar
      movement.jump();
    }
  }

  private lastWeaponSwitchTime = 0;
  private weaponSwitchCooldown = 1.5; // 200ms cooldown to prevent rapid switching

  private handleWeaponSwitching(): void {
    const currentTime = Date.now() / 1000;
    
    // Prevent rapid weapon switching
    if (currentTime - this.lastWeaponSwitchTime < this.weaponSwitchCooldown) {
      return;
    }

    // Handle weapon switching with number keys
    if (this.inputManager.isKeyPressed('1')) {
      if (this.currentWeapon !== WeaponType.SWORD) {
        this.resetAllAbilityStates(); // Reset all ability states when switching weapons
        this.currentWeapon = WeaponType.SWORD;
        this.currentSubclass = WeaponSubclass.DIVINITY; // Default sword subclass
        this.fireRate = this.swordFireRate; // Use sword-specific fire rate
        this.lastWeaponSwitchTime = currentTime;
        this.swordComboStep = 1; // Reset combo when switching to sword
      }
    } else if (this.inputManager.isKeyPressed('2')) {
      if (this.currentWeapon !== WeaponType.BOW) {
        this.resetAllAbilityStates(); // Reset all ability states when switching weapons
        this.currentWeapon = WeaponType.BOW;
        this.currentSubclass = WeaponSubclass.ELEMENTAL; // Default bow subclass
        this.fireRate = 0.225; // Bow fire rate
        this.lastWeaponSwitchTime = currentTime;
      }
    } else if (this.inputManager.isKeyPressed('3')) {
      if (this.currentWeapon !== WeaponType.SCYTHE) {
        this.resetAllAbilityStates(); // Reset all ability states when switching weapons
        this.currentWeapon = WeaponType.SCYTHE;
        this.currentSubclass = WeaponSubclass.CHAOS; // Default scythe subclass
        this.fireRate = this.scytheFireRate; // Use scythe fire rate (0.5s)
        this.lastWeaponSwitchTime = currentTime;
      }
    } else if (this.inputManager.isKeyPressed('4')) {
      if (this.currentWeapon !== WeaponType.SABRES) {
        this.resetAllAbilityStates(); // Reset all ability states when switching weapons
        this.currentWeapon = WeaponType.SABRES;
        this.currentSubclass = WeaponSubclass.FROST; // Default sabres subclass
        this.fireRate = this.sabresFireRate; // Use sabres-specific fire rate
        this.lastWeaponSwitchTime = currentTime;
      }
    } else if (this.inputManager.isKeyPressed('5')) {
      if (this.currentWeapon !== WeaponType.RUNEBLADE) {
        this.resetAllAbilityStates(); // Reset all ability states when switching weapons
        this.currentWeapon = WeaponType.RUNEBLADE;
        this.currentSubclass = WeaponSubclass.ARCANE; // Default runeblade subclass
        this.fireRate = this.runebladeFireRate; // Use runeblade fire rate
        this.lastWeaponSwitchTime = currentTime;
        this.swordComboStep = 1; // Reset combo when switching to runeblade
      }
    }
  }

  private handleCombatInput(playerTransform: Transform): void {
    if (this.currentWeapon === WeaponType.BOW) {
      this.handleBowInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SCYTHE) {
      this.handleScytheInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SWORD) {
      this.handleSwordInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SABRES) {
      this.handleSabresInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.RUNEBLADE) {
      this.handleRunebladeInput(playerTransform);
    }
  }

  private handleBowInput(playerTransform: Transform): void {
    // Handle Viper Sting ability with 'R' key
    if (this.inputManager.isKeyPressed('r') && !this.isViperStingCharging && !this.isCharging) {
      this.performViperSting(playerTransform);
    }
    
    // Handle Barrage ability with 'Q' key
    if (this.inputManager.isKeyPressed('q')) {

      if (!this.isBarrageCharging && !this.isCharging && !this.isViperStingCharging) {
        this.performBarrage(playerTransform);
      }
    }
    
    // Handle Cobra Shot ability with 'E' key
    if (this.inputManager.isKeyPressed('e')) {

      if (!this.isCharging && !this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging) {
        this.performCobraShot(playerTransform);
      }
    }
    
    // Handle bow charging and firing
    if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button held
      if (!this.isCharging && !this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging) {
        this.isCharging = true;
        this.chargeProgress = 0;

      }
      // Increase charge progress (could be time-based)
      if (!this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging) {
        this.chargeProgress = Math.min(this.chargeProgress + 0.0125, 1.0); // BOW CHARGE SPEED
      }
    } else if (this.isCharging) {
      // Check if any ability is charging - if so, cancel the regular bow shot
      if (this.isViperStingCharging || this.isBarrageCharging || this.isCobraShotCharging) {
        this.isCharging = false;
        this.chargeProgress = 0;
        return;
      }
      
      // Store charge progress before resetting for visual effects
      const finalChargeProgress = this.chargeProgress;
      
      // Release the bow
      this.fireProjectile(playerTransform);
      this.isCharging = false;
      this.chargeProgress = 0;
      
      // Trigger visual effects callback with the stored charge progress
      this.triggerBowReleaseEffects(finalChargeProgress);
    }
  }

  private handleScytheInput(playerTransform: Transform): void {
    // Handle scythe left click for EntropicBolt
    if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button held
      if (!this.isCharging) {
        this.isCharging = true;
        this.chargeProgress = 0;
        console.log('⚡ Started charging scythe (spinning)');
      }
      // Increase charge progress continuously for spinning animation (no cap)
      this.chargeProgress += 0.03; // Continuously increase for spinning
      
      // Fire EntropicBolt projectiles continuously while spinning
      this.fireEntropicBoltProjectile(playerTransform);
    } else if (this.isCharging) {
      // Stop spinning when mouse is released
      this.isCharging = false;
      this.chargeProgress = 0;
    }
    
    // Handle CrossentropyBolt ability with 'R' key
    if (this.inputManager.isKeyPressed('r') && !this.isCharging) {
      this.fireCrossentropyBoltAbility(playerTransform);
    }
    
    // Handle Reanimate ability with 'Q' key
    if (this.inputManager.isKeyPressed('q') && !this.isCharging) {
      this.performReanimateAbility(playerTransform);
    }
    
    // Handle Frost Nova ability with 'E' key
    if (this.inputManager.isKeyPressed('e') && !this.isCharging) {
      this.performFrostNovaAbility(playerTransform);
    }
  }

  private fireProjectile(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireTime < this.fireRate) {
      return;
    }
    this.lastFireTime = currentTime;
    
    // Get dragon's facing direction (same as camera direction since dragon faces camera)
    // This ensures arrows fire outward from where the dragon is facing
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply downward angle compensation to account for restricted camera bounds
    // Since camera can't look down much due to bounds, we add a fixed downward angle
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    
    // Create a rotation matrix to apply the downward angle around the camera's right axis
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    // Apply rotation around the right axis to tilt the direction downward
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Perfect shot timing constants
    const perfectShotMinThreshold = 0.7; // 85% charge
    const perfectShotMaxThreshold = 0.98; // 95% charge
    const isPerfectShot = this.chargeProgress >= perfectShotMinThreshold && this.chargeProgress <= perfectShotMaxThreshold;
    
    // Check if bow is fully charged for special projectile
    if (this.chargeProgress >= 1.0) {
      this.createChargedArrowProjectile(playerTransform.position.clone(), direction);
    } else if (isPerfectShot) {
      this.createPerfectShotProjectile(playerTransform.position.clone(), direction);
    } else {
      // Debug: Log the firing angle to verify it's changing with camera rotation
      const angle = Math.atan2(direction.x, direction.z);
      this.createProjectile(playerTransform.position.clone(), direction);
    }
  }

  private fireEntropicBoltProjectile(playerTransform: Transform): void {
    // Rate limiting - use new scythe rate (0.35 seconds)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireTime < this.scytheFireRate) {
      return;
    }
    this.lastFireTime = currentTime;
    
    // Get dragon's facing direction
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply downward angle compensation (same as bow projectiles)
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    const spinStatus = this.isCharging ? ' (SPINNING)' : '';
    
    this.createEntropicBoltProjectile(playerTransform.position.clone(), direction);
  }

  private fireCrossentropyBoltAbility(playerTransform: Transform): void {
    // Rate limiting - use CrossentropyBolt rate (1 per second)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastCrossentropyTime < this.crossentropyFireRate) {
      return;
    }
    this.lastCrossentropyTime = currentTime;
    
    // Get dragon's facing direction
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply angle compensation (same as bow projectiles)
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();

    
    this.createCrossentropyBoltProjectile(playerTransform.position.clone(), direction);
  }

  private createProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Check if there are any valid targets in the world before creating projectiles
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);
    const validTargets = potentialTargets.filter(target => 
      target.id !== this.playerEntity!.id && // Not the player itself
      !target.getComponent(Health)?.isDead // Not dead
    );
    
    // In multiplayer mode, only create projectiles if there are valid targets or if we need to broadcast to other players
    const hasValidTargets = validTargets.length > 0;
    const shouldBroadcast = this.onProjectileCreatedCallback !== undefined;
    
    if (!hasValidTargets && !shouldBroadcast) {
      return;
    }
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 0.75; // Slightly higher
    
    // Create projectile using the ProjectileSystem with current weapon config
    const projectileConfig = {
      speed: 25,
      damage: 10, // Arrow damage should be 10
      lifetime: 3,
      maxDistance: 25, // Limit bow arrows to 25 units distance
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0
    };
    
    this.projectileSystem.createProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      projectileConfig
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('regular_arrow', spawnPosition, direction, projectileConfig);
    }
  }

  private createEntropicBoltProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Check if there are any valid targets in the world before creating projectiles
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);
    const validTargets = potentialTargets.filter(target => 
      target.id !== this.playerEntity!.id && // Not the player itself
      !target.getComponent(Health)?.isDead // Not dead
    );
    
    // In multiplayer mode, only create projectiles if there are valid targets or if we need to broadcast to other players
    const hasValidTargets = validTargets.length > 0;
    const shouldBroadcast = this.onProjectileCreatedCallback !== undefined;
    
    if (!hasValidTargets && !shouldBroadcast) {
      return;
    }
    
    // Check if player has enough mana (15 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastEntropicBolt()) {
      return;
    }
    
    // Consume mana
    if (gameUI) {
      gameUI.consumeMana(10);
    }
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 1; // Slightly higher
    
    // Create EntropicBolt projectile using the new method
    const entropicConfig = {
      speed: 20, // Faster than CrossentropyBolt
      damage: 20, // EntropicBolt damage
      lifetime: 2, // Shorter lifetime
      piercing: false, // Non-piercing so projectile gets destroyed on hit
      explosive: false, // No explosion effect
      explosionRadius: 0, // No explosion radius
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0
    };
    
    this.projectileSystem.createEntropicBoltProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      entropicConfig
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('entropic_bolt', spawnPosition, direction, entropicConfig);
    }
  }

  private createCrossentropyBoltProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Check if player has enough mana (40 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastCrossentropyBolt()) {
      return;
    }
    
    // Consume mana
    if (gameUI) {
      gameUI.consumeMana(40);
      console.log('⚔️ Consumed 40 mana for Crossentropy Bolt');
    }
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 1; // Slightly higher
    
    // Create CrossentropyBolt projectile using the existing method
    const crossentropyConfig = {
      speed: 15, // Slower than EntropicBolt
      damage: 90, // Higher damage for R ability
      lifetime: 2.5, // Longer lifetime
      piercing: false, // 
      explosive: false, // Disabled explosion effect for performance
      explosionRadius: 0, // No explosion radius
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0
    };
    
    this.projectileSystem.createCrossentropyBoltProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      crossentropyConfig
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('crossentropy_bolt', spawnPosition, direction, crossentropyConfig);
    }
  }

  private performReanimateAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    
    // Rate limiting - prevent spam casting (1 second cooldown)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastReanimateTime < 1.0) {
      return;
    }
    this.lastReanimateTime = currentTime;
    
    // Check if player has enough mana (20 mana cost - doubled from 10)
    const gameUI = (window as any).gameUI;
    const currentMana = gameUI ? gameUI.getCurrentMana() : 0;
    
    if (gameUI && !gameUI.canCastReanimate()) {
      return;
    }
    
    // Consume mana
    if (gameUI) {
      const manaBefore = gameUI.getCurrentMana();
      gameUI.consumeMana(20);
      const manaAfter = gameUI.getCurrentMana();
    }
    
    // Always trigger the visual effect first, regardless of healing success
    this.triggerReanimateEffect(playerTransform);
    
    // Get player's health component and heal for 30 HP 
    const healthComponent = this.playerEntity.getComponent(Health);
    if (healthComponent) {
      const didHeal = healthComponent.heal(30); // REANIMATE HEAL AMOUNT
      if (didHeal) {
        // console.log(`🩸 Reanimate healed player for 30 HP. Current health: ${healthComponent.currentHealth}/${healthComponent.maxHealth}`);
      } else {
        // console.log('🩸 Reanimate cast successfully but player already at full health');
      }
    }
  }

  private triggerReanimateEffect(playerTransform: Transform): void {
    // Trigger the visual healing effect
    
    if (this.onReanimateCallback) {
      this.onReanimateCallback();
    } 
    
    const playerPosition = playerTransform.position;
  }

  private performFrostNovaAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFrostNovaTime < this.frostNovaFireRate) {
      return;
    }
    
    // Check if player has enough mana (50 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastFrostNova()) {
      return;
    }
    
    // Consume mana
    if (gameUI) {
      gameUI.consumeMana(50);
    }
    
    this.lastFrostNovaTime = currentTime;
    
    
    // Get player position and direction
    const playerPosition = playerTransform.getWorldPosition();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Trigger Frost Nova callback for visual effects
    if (this.onFrostNovaCallback) {
      this.onFrostNovaCallback(playerPosition, direction);
    }
    
    // Find all enemies within 5 unit radius and freeze them
    this.freezeEnemiesInRadius(playerPosition, 6.0, currentTime);
    
    // Trigger global frost nova visual effect
    triggerGlobalFrostNova(playerPosition);
  }

  private performCobraShot(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastCobraShotTime < this.cobraShotFireRate) {
      return;
    }

    // Check if player has enough energy (40 energy cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastCobraShot()) {
      return;
    }

    // Consume energy
    if (gameUI) {
      gameUI.consumeEnergy(40);
    }

    this.isCobraShotCharging = true;
    this.cobraShotChargeProgress = 0;
    this.lastCobraShotTime = currentTime;
    
    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 750; // 0.75 second charge time (between Viper Sting and Barrage)
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.cobraShotChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.cobraShotChargeProgress >= 1.0) {
        clearInterval(chargeInterval);
        this.fireCobraShot(playerTransform);
        this.isCobraShotCharging = false;
        this.cobraShotChargeProgress = 0;
      }
    }, 16); // ~60fps updates
  }

  private fireCobraShot(playerTransform: Transform): void {
    // Get player position and direction (same as other projectiles)
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 0.825; // Shoot from chest level like Viper Sting
    
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply same downward angle compensation as other projectiles
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    // Apply rotation around the right axis to tilt the direction downward
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Offset spawn position slightly forward to avoid collision with player
    const spawnPosition = playerPosition.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    
    // Note: Cobra Shot damage is handled by CobraShotManager, not ECS projectiles
    // This prevents duplicate projectiles and damage (similar to Viper Sting)
    
    // Trigger Cobra Shot callback for visual effects
    if (this.onCobraShotCallback) {
      this.onCobraShotCallback(spawnPosition, direction);
    }
    
    // Trigger global cobra shot with proper positioning (handles local visual effects and damage)
    triggerGlobalCobraShot(spawnPosition, direction);
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('cobra_shot_projectile', spawnPosition, direction, {
        speed: 20, // Consistent speed for PVP
        damage: 29, // Use consistent damage value
        lifetime: 8,
        venomDuration: 6
      });
    }
  }

  private freezeEnemiesInRadius(centerPosition: Vector3, radius: number, currentTime: number): void {
    // Get all entities in the world
    const allEntities = this.world.getAllEntities();
    let frozenCount = 0;
    let damagedPlayers = 0;
    
    // Get local socket ID to prevent self-targeting
    const localSocketId = (window as any).localSocketId;
    
    allEntities.forEach(entity => {
      const entityTransform = entity.getComponent(Transform);
      const entityHealth = entity.getComponent(Health);
      
      if (!entityTransform || !entityHealth || entityHealth.isDead) return;
      
      // Skip self (local player entity)
      if (entity.id === this.playerEntity?.id) return;
      
      const entityPosition = entityTransform.position;
      const distance = centerPosition.distanceTo(entityPosition);
      
      // Check if entity is within freeze radius
      if (distance <= radius) {
        const enemy = entity.getComponent(Enemy);
        
        if (enemy) {
          // This is an enemy - freeze it (single player mode)
          enemy.freeze(6.0, currentTime);
          frozenCount++;
          
          // Add frozen visual effect for this enemy
          addGlobalFrozenEnemy(entity.id.toString(), entityPosition);
        } else {
          // This is likely another player in PVP mode - deal damage and freeze
          // CRITICAL FIX: First check if this entity represents the local player
          const serverPlayerEntities = (window as any).serverPlayerEntities;
          let targetPlayerId: string | null = null;
          
          if (serverPlayerEntities && serverPlayerEntities.current) {
            serverPlayerEntities.current.forEach((localEntityId: number, playerId: string) => {
              if (localEntityId === entity.id) {
                targetPlayerId = playerId;
              }
            });
          }
          
          // NEVER damage or debuff ourselves
          if (targetPlayerId && targetPlayerId === localSocketId) {
            console.log(`⚠️ Skipping Frost Nova on local player ${localSocketId}`);
            return; // Skip this entity completely
          }
          
          const combatSystem = this.world.getSystem(CombatSystem);
          if (combatSystem && this.playerEntity && targetPlayerId) {
            const frostNovaDamage = 50; // Frost Nova damage
            combatSystem.queueDamage(entity, frostNovaDamage, this.playerEntity, 'frost_nova');
            damagedPlayers++;
            
            // Broadcast freeze effect to the target player so they get frozen on their end
            if (this.onDebuffCallback) {
              console.log(`🎯 Broadcasting freeze effect to player ${targetPlayerId} (NOT local player ${localSocketId})`);
              this.onDebuffCallback(entity.id, 'frozen', 6000, entityPosition);
            }
          }
        }
      }
    });
    
    if (frozenCount > 0) {
      // console.log(`❄️ Frost Nova froze ${frozenCount} enemies within ${radius} unit radius`);
    }
    if (damagedPlayers > 0) {
      // console.log(`❄️ Frost Nova damaged ${damagedPlayers} players within ${radius} unit radius`);
    }
  }

  private createChargedArrowProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 0.5; // Slightly higher
    
    // Create charged arrow projectile - more powerful than regular arrows
    const chargedArrowConfig = {
      speed: 35, // Faster than regular arrows (25)
      damage: 50, // Much higher damage than regular arrows (10)
      lifetime: 2, // Longer lifetime than regular arrows (3)
      piercing: true, // Charged arrows can pierce through enemies
      explosive: false, // No explosion, but could add special effects
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0
    };
    
    this.projectileSystem.createChargedArrowProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      chargedArrowConfig
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('charged_arrow', spawnPosition, direction, chargedArrowConfig);
    }
  }

  private createPerfectShotProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 0.5; // Slightly higher
    
    // Create perfect shot projectile - enhanced charged arrow with special effects
    this.projectileSystem.createChargedArrowProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      {
        speed: 40, // Faster than regular charged arrows (35)
        damage: 75, // Higher damage than regular charged arrows (50)
        lifetime: 6, // Longer lifetime than regular charged arrows (5)
        piercing: true, // Perfect shots can pierce through enemies
        explosive: false, // No explosion, but has special visual effects
        subclass: this.currentSubclass,
        level: this.currentLevel,
        opacity: 1.0
      }
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('perfect_shot', spawnPosition, direction, {
        speed: 40,
        damage: 75,
        lifetime: 6,
        piercing: true,
        subclass: this.currentSubclass,
        level: this.currentLevel,
        opacity: 1.0
      });
    }
  }

  // Methods to configure weapon for testing
  public setWeaponSubclass(subclass: WeaponSubclass): void {
    this.currentSubclass = subclass;
  }

  // Method to set bow release callback
  public setBowReleaseCallback(callback: (finalProgress: number, isPerfectShot?: boolean) => void): void {
    this.onBowReleaseCallback = callback;
  }
  
  public setDivineStormCallback(callback: (position: Vector3, direction: Vector3, duration: number) => void): void {
    this.onDivineStormCallback = callback;
  }
  
  public setProjectileCreatedCallback(callback: (projectileType: string, position: Vector3, direction: Vector3, config: any) => void): void {
    this.onProjectileCreatedCallback = callback;
  }
  
  public setViperStingCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onViperStingCallback = callback;
  }

  public setBarrageCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onBarrageCallback = callback;
  }

  public setReanimateCallback(callback: () => void): void {
    this.onReanimateCallback = callback;
  }
  
  public setFrostNovaCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onFrostNovaCallback = callback;
  }
  
  public setCobraShotCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onCobraShotCallback = callback;
  }
  
  public setChargeCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onChargeCallback = callback;
  }
  
  public setDeflectCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onDeflectCallback = callback;
  }
  
  public setSkyfallCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onSkyfallCallback = callback;
  }
  
  public setBackstabCallback(callback: (position: Vector3, direction: Vector3, damage: number, isBackstab: boolean) => void): void {
    this.onBackstabCallback = callback;
  }
  
  public setSunderCallback(callback: (position: Vector3, direction: Vector3, damage: number, stackCount: number) => void): void {
    this.onSunderCallback = callback;
  }

  public setSmiteCallback(callback: (position: Vector3, direction: Vector3, onDamageDealt?: (damageDealt: boolean) => void) => void): void {
    this.onSmiteCallback = callback;
  }

  public setDeathGraspCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onDeathGraspCallback = callback;
  }

  public setConsumeManaCallback(callback: (amount: number) => void): void {
    this.onConsumeManaCallback = callback;
  }

  public setCheckManaCallback(callback: (amount: number) => boolean): void {
    this.onCheckManaCallback = callback;
  }

  public setDebuffCallback(callback: (targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned', duration: number, position: Vector3) => void): void {
    this.onDebuffCallback = callback;
  }

  // Method to trigger bow release effects
  private triggerBowReleaseEffects(finalChargeProgress: number): void {
    if (this.onBowReleaseCallback) {
      // Check if this was a perfect shot
      const perfectShotMinThreshold = 0.75; // 85% charge
      const perfectShotMaxThreshold = 0.98; // 95% charge
      const isPerfectShot = finalChargeProgress >= perfectShotMinThreshold && finalChargeProgress <= perfectShotMaxThreshold;
      
      this.onBowReleaseCallback(finalChargeProgress, isPerfectShot);
    }
  }

  public setWeaponLevel(level: number): void {
    this.currentLevel = level;
  }

  public getCurrentWeaponConfig(): { weapon: WeaponType; subclass: WeaponSubclass; level: number } {
    return {
      weapon: this.currentWeapon,
      subclass: this.currentSubclass,
      level: this.currentLevel
    };
  }

  // Getters for weapon state (for UI/rendering)
  public getCurrentWeapon(): WeaponType {
    return this.currentWeapon;
  }

  public getCurrentSubclass(): WeaponSubclass {
    return this.currentSubclass;
  }

  public isWeaponCharging(): boolean {
    return this.isCharging;
  }

  public getChargeProgress(): number {
    return this.chargeProgress;
  }

  public isViperStingChargingActive(): boolean {
    return this.isViperStingCharging;
  }

  public getViperStingChargeProgress(): number {
    return this.viperStingChargeProgress;
  }

  public isBarrageChargingActive(): boolean {
    return this.isBarrageCharging;
  }

  public getBarrageChargeProgress(): number {
    return this.barrageChargeProgress;
  }

  public isCobraShotChargingActive(): boolean {
    return this.isCobraShotCharging;
  }

  public getCobraShotChargeProgress(): number {
    return this.cobraShotChargeProgress;
  }

  public isWeaponSwinging(): boolean {
    return this.isSwinging;
  }

  // Sword-specific getters
  public getSwordComboStep(): 1 | 2 | 3 {
    return this.swordComboStep;
  }

  public isDivineStormActive(): boolean {
    return this.isDivineStorming;
  }

  public isChargeActive(): boolean {
    return this.isSwordCharging;
  }

  public isDeflectActive(): boolean {
    return this.isDeflecting;
  }
  
  public isSkyfallActive(): boolean {
    return this.isSkyfalling;
  }
  
  public isBackstabActive(): boolean {
    return this.isBackstabbing;
  }
  
  public isSunderActive(): boolean {
    return this.isSundering;
  }

  public isSmiteActive(): boolean {
    return this.isSmiting;
  }

  public isDeathGraspActive(): boolean {
    return this.isDeathGrasping;
  }

  private handleSwordInput(playerTransform: Transform): void {
    // Handle sword melee attacks
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isDivineStorming && !this.isSwordCharging && !this.isDeflecting) { // Left mouse button
      this.performSwordMeleeAttack(playerTransform);
    }

    // Handle Divine Storm ability with 'R' key
    if (this.inputManager.isKeyPressed('r') && !this.isDivineStorming && !this.isSwinging && !this.isSwordCharging && !this.isDeflecting) {
      this.performDivineStorm(playerTransform);
    }

    // Handle Charge ability with 'E' key
    if (this.inputManager.isKeyPressed('e') && !this.isSwordCharging && !this.isDivineStorming && !this.isSwinging && !this.isDeflecting) {
      this.performCharge(playerTransform);
    }

    // Handle Deflect ability with 'Q' key
    if (this.inputManager.isKeyPressed('q') && !this.isDeflecting && !this.isDivineStorming && !this.isSwinging && !this.isSwordCharging) {
      this.performDeflect(playerTransform);
    }

    // Check for combo reset
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSwordAttackTime > this.swordComboResetTime) {
      this.swordComboStep = 1;
    }
  }

  private handleRunebladeInput(playerTransform: Transform): void {
    // Handle runeblade melee attacks
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isSmiting && !this.isDeathGrasping) { // Left mouse button
      this.performRunebladeMeleeAttack(playerTransform);
    }

    // Handle Smite ability with 'E' key
    if (this.inputManager.isKeyPressed('e') && !this.isSmiting && !this.isSwinging && !this.isDeathGrasping) {
      this.performSmite(playerTransform);
    }

    // Handle DeathGrasp ability with 'Q' key
    if (this.inputManager.isKeyPressed('q') && !this.isDeathGrasping && !this.isSmiting && !this.isSwinging) {
      this.performDeathGrasp(playerTransform);
    }

    // Check for combo reset
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSwordAttackTime > this.swordComboResetTime) {
      this.swordComboStep = 1;
    }
  }

  private performSwordMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking (use sword-specific fire rate)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireTime < this.swordFireRate) {
      return;
    }
    this.lastFireTime = currentTime;
    this.lastSwordAttackTime = currentTime;

    // Set swinging state - completion will be handled by sword component callback
    this.isSwinging = true;

    // Perform melee damage in a cone in front of player
    this.performMeleeDamage(playerTransform);

    // Note: Swing completion and combo advancement is now handled by onSwordSwingComplete callback
  }

  private performRunebladeMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking (use runeblade-specific fire rate)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireTime < this.runebladeFireRate) {
      return;
    }
    this.lastFireTime = currentTime;
    this.lastSwordAttackTime = currentTime;

    // Set swinging state - completion will be handled by runeblade component callback
    this.isSwinging = true;

    // Perform melee damage in a cone in front of player (same as sword)
    this.performMeleeDamage(playerTransform);

    // Note: Swing completion and combo advancement is now handled by onSwordSwingComplete callback
  }

  private performSmite(playerTransform: Transform): void {
    // Check if using Runeblade
    if (this.currentWeapon !== WeaponType.RUNEBLADE) {
      return;
    }

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSmiteTime < this.smiteCooldown) {
      return; // Still on cooldown
    }

    // Check if already smiting
    if (this.isSmiting) {
      return;
    }

    // Check if player has enough mana (35 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastSmite()) {
      console.log(`⚡ Smite: Not enough mana to cast (need 35)`);
      return;
    }

    this.lastSmiteTime = currentTime;
    this.isSmiting = true;

    // Consume mana (35 mana)
    if (gameUI) {
      const manaBefore = gameUI.getCurrentMana();
      gameUI.consumeMana(35);
      const manaAfter = gameUI.getCurrentMana();
      console.log(`⚡ Smite: Consumed 35 mana. Mana: ${manaBefore} -> ${manaAfter}`);
    }

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Offset the smite position slightly forward to look like it's coming from the runeblade swing
    const smitePosition = position.clone().add(direction.clone().multiplyScalar(2.5));

    // NOTE: Damage detection is now handled by the Smite visual component
    // to prevent double damage. The visual component's damage detection is more
    // accurate and properly timed with the animation.

    // The healing will be triggered by the visual component's onDamageDealt callback
    // instead of the ControlSystem's performSmiteDamage method.

    console.log(`⚡ Smite: Damage detection delegated to visual component`);

    // Trigger smite callback with healing callback
    if (this.onSmiteCallback) {
      this.onSmiteCallback(smitePosition, direction, (damageDealtFlag: boolean) => {
        // Handle healing when damage is dealt by the visual component
        if (damageDealtFlag) {
          console.log(`⚡ Smite: Damage detected by visual component, triggering healing`);
          this.performSmiteHealing();
        }
      });
    }

    // Reset smiting state after animation duration (same as the Smite component)
    setTimeout(() => {
      this.isSmiting = false;
    }, 900); // 0.9 seconds matches the animation duration
  }

  private performSmiteDamage(smitePosition: Vector3): boolean {
    if (!this.playerEntity) return false;

    const smiteDamage = 80;
    const damageRadius = 3.0; // Small radius around impact location
    let damageDealt = false;

    // Get all entities in the world to check for enemies/players
    const allEntities = this.world.getAllEntities();

    allEntities.forEach(entity => {
      if (entity.id === this.playerEntity?.id) return; // Don't damage self

      const entityTransform = entity.getComponent(Transform);
      const entityHealth = entity.getComponent(Health);

      if (!entityTransform || !entityHealth || entityHealth.isDead) return;

      const distance = smitePosition.distanceTo(entityTransform.position);

      if (distance <= damageRadius) {
        // Entity is within damage radius - apply damage
        const combatSystem = this.world.getSystem(CombatSystem);
        if (combatSystem && this.playerEntity) {
          combatSystem.queueDamage(entity, smiteDamage, this.playerEntity, 'smite');
          damageDealt = true;
          console.log(`⚡ Smite dealt ${smiteDamage} damage to entity ${entity.id} at distance ${distance.toFixed(2)}`);
        } else {
          console.log(`⚡ Smite: Could not find CombatSystem or playerEntity to deal damage`);
        }
      }
    });

    // NOTE: PVP player damage detection is now handled by the Smite visual component
    // to prevent double damage. The visual component properly handles PVP damage
    // through the broadcastPlayerDamage system.

    return damageDealt;
  }

  private performSmiteHealing(): void {
    if (!this.playerEntity) {
      console.log(`⚡ Smite: No player entity available for healing`);
      return;
    }

    // Get player's health component and heal for 20 HP (like Reanimate ability)
    const healthComponent = this.playerEntity.getComponent(Health);
    if (healthComponent) {
      const oldHealth = healthComponent.currentHealth;
      const maxHealth = healthComponent.maxHealth;

      // Always attempt to heal, even if at full health (heal method handles this)
      const didHeal = healthComponent.heal(20); // Smite healing amount

      if (didHeal) {
        console.log(`⚡ Smite SUCCESSFULLY healed player for 20 HP! Health: ${oldHealth} -> ${healthComponent.currentHealth}/${maxHealth}`);
      } else {
        console.log(`⚡ Smite: Player already at full health (${healthComponent.currentHealth}/${maxHealth}) - no healing needed`);
      }
    } else {
      console.log(`⚡ Smite: CRITICAL ERROR - Could not find health component for player entity ${this.playerEntity.id}`);

      // Fallback: Try to heal through gameUI if health component is not available
      try {
        const gameUI = (window as any).gameUI;
        if (gameUI && typeof gameUI.gainHealth === 'function') {
          gameUI.gainHealth(20);
          console.log(`⚡ Smite: FALLBACK healing through gameUI - healed for 20 HP`);
        }
      } catch (error) {
        console.log(`⚡ Smite: Could not heal through fallback method either`);
      }
    }
  }

  private performDeathGrasp(playerTransform: Transform): void {
    // Check if using Runeblade
    if (this.currentWeapon !== WeaponType.RUNEBLADE) {
      return;
    }

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastDeathGraspTime < this.deathGraspCooldown) {
      return; // Still on cooldown
    }

    // Check if already death grasping
    if (this.isDeathGrasping) {
      return;
    }

    // Check if player has enough mana (25 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastDeathGrasp()) {
      console.log(`💀 DeathGrasp: Not enough mana to cast (need 25)`);
      return;
    }

    this.lastDeathGraspTime = currentTime;
    this.isDeathGrasping = true;

    // Consume mana (25 mana)
    if (gameUI) {
      const manaBefore = gameUI.getCurrentMana();
      gameUI.consumeMana(25);
      const manaAfter = gameUI.getCurrentMana();
      console.log(`💀 DeathGrasp: Consumed 25 mana. Mana: ${manaBefore} -> ${manaAfter}`);
    }

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Trigger death grasp callback
    if (this.onDeathGraspCallback) {
      this.onDeathGraspCallback(position, direction);
    }

    // Reset death grasping state after animation duration
    setTimeout(() => {
      this.isDeathGrasping = false;
    }, 1200); // 1.2 seconds matches the animation duration
  }

  // Called by sword component when swing animation completes
  public onSwordSwingComplete(): void {
    if (!this.isSwinging) return; // Prevent multiple calls

    // Reset swinging state
    this.isSwinging = false;

    // Advance combo step for next attack
    this.swordComboStep = (this.swordComboStep % 3 + 1) as 1 | 2 | 3;

  }

  // Called by runeblade component when smite animation completes
  public onSmiteComplete(): void {
    if (!this.isSmiting) return; // Prevent multiple calls

    // Reset smiting state
    this.isSmiting = false;
  }

  // Called by runeblade component when death grasp animation completes
  public onDeathGraspComplete(): void {
    if (!this.isDeathGrasping) return; // Prevent multiple calls

    // Reset death grasping state
    this.isDeathGrasping = false;
  }

  private handleSabresInput(playerTransform: Transform): void {
    // Handle left click for dual sabre attack
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isSkyfalling && !this.isSundering) {
      this.performSabresMeleeAttack(playerTransform);
    }
    
    // Handle Q key for Backstab ability
    if (this.inputManager.isKeyPressed('q') && !this.isSwinging && !this.isSkyfalling && !this.isSundering) {
      this.performBackstab(playerTransform);
    }
    
    // Handle E key for Sunder ability
    if (this.inputManager.isKeyPressed('e') && !this.isSwinging && !this.isSkyfalling && !this.isSundering) {
      this.performSunder(playerTransform);
    }
    
    // Handle R key for Skyfall ability (switched from E)
    if (this.inputManager.isKeyPressed('r') && !this.isSkyfalling && !this.isSundering) {
      this.performSkyfall(playerTransform);
    }
    
    // Update Skyfall state if active
    if (this.isSkyfalling) {
      this.updateSkyfallMovement(playerTransform);
    }
    
    // Update Backstab state if active
    if (this.isBackstabbing) {
      this.updateBackstabState(playerTransform);
    }
    
    // Update Sunder state if active
    if (this.isSundering) {
      this.updateSunderState(playerTransform);
    }
  }

  private performSabresMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking (use sabres-specific fire rate)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireTime < this.sabresFireRate) {
      return;
    }
    this.lastFireTime = currentTime;
    
    console.log('⚔️ Sabres dual attack initiated');
    
    // Set swinging state - completion will be handled by sabres component callback
    this.isSwinging = true;
    
    // Perform melee damage in a cone in front of player (dual attack)
    this.performSabresMeleeDamage(playerTransform);
  }

  // Called by sabres component when swing animation completes
  public onSabresSwingComplete(): void {
    if (!this.isSwinging) return; // Prevent multiple calls
    
    console.log('⚔️ Sabres dual swing completed');
    
    // Reset swinging state
    this.isSwinging = false;
  }

  private performSabresMeleeDamage(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Get all entities that could be damaged
    const allEntities = this.world.getAllEntities();
    const potentialTargets = allEntities.filter(entity => 
      entity.hasComponent(Health) && 
      entity.hasComponent(Transform) &&
      entity !== this.playerEntity
    );
    
    // SABRES DAMAGE
    const attackRange = 3.8; // Slightly longer range than sword
    const attackAngle = Math.PI / 2; // 60 degree cone (wider than sword)
    const leftSabreDamage = 19;
    const rightSabreDamage = 23;
    
    // Get camera direction for attack direction
    const attackDirection = new Vector3();
    this.camera.getWorldDirection(attackDirection);
    attackDirection.normalize();
    
    let hitCount = 0;
    
    for (const target of potentialTargets) {
      const targetTransform = target.getComponent(Transform);
      const targetHealth = target.getComponent(Health);
      
      if (!targetTransform || !targetHealth || targetHealth.isDead) continue;
      
      // Calculate direction to target
      const directionToTarget = targetTransform.position.clone().sub(playerTransform.position);
      const distanceToTarget = directionToTarget.length();
      
      // Check if target is within range
      if (distanceToTarget > attackRange) continue;
      
      // Check if target is within attack cone
      directionToTarget.normalize();
      const dotProduct = attackDirection.dot(directionToTarget);
      const angleToTarget = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
      
      if (angleToTarget > attackAngle / 2) continue;
      
      // Target is within range and cone - apply damage from both sabres
      const combatSystem = this.world.getSystem(CombatSystem);
      if (combatSystem) {
        // Left sabre hit (immediate)
        combatSystem.queueDamage(target, leftSabreDamage, this.playerEntity || undefined);
        
        // Right sabre hit (with small delay)
        setTimeout(() => {
          if (!targetHealth.isDead) {
            combatSystem.queueDamage(target, rightSabreDamage, this.playerEntity || undefined);
          }
        }, 100); // 100ms delay between sabre hits
        
        hitCount++;
      }
    }
  }

  // Skyfall ability implementation
  private performSkyfall(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Check cooldown
    if (currentTime - this.lastSkyfallTime < this.skyfallCooldown) {
      return;
    }
    
    // Check energy cost
    const gameUI = (window as any).gameUI;
    if (!gameUI || !gameUI.canCastSkyfall()) {
      return;
    }
    
    // Consume energy
    gameUI.consumeEnergy(40);
    
    // Start Skyfall
    this.isSkyfalling = true;
    this.skyfallPhase = 'ascending';
    this.skyfallStartTime = currentTime;
    this.lastSkyfallTime = currentTime;
    this.skyfallStartPosition.copy(playerTransform.position);
    
    // Set target height (double jump height)
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (playerMovement) {
      this.skyfallOriginalGravity = playerMovement.gravity;
      this.skyfallTargetHeight = playerTransform.position.y + (playerMovement.jumpForce * 1.4); // Reduced height by 30% (was 2x, now 1.4x)
            
      // Apply upward velocity
      playerMovement.velocity.y = playerMovement.jumpForce * 2; // Stronger initial velocity
      playerMovement.gravity = 0; // Disable gravity during ascent
      // Don't disable canMove as it prevents all physics updates including gravity
      // Instead we'll control horizontal movement in the ControlSystem
    }

    
    // Trigger callback for multiplayer/visual effects
    if (this.onSkyfallCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      this.onSkyfallCallback(playerTransform.position, direction);
    }
  }
  
  private updateSkyfallMovement(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (!playerMovement) return;
    
    const elapsedTime = currentTime - this.skyfallStartTime;
    

    
    switch (this.skyfallPhase) {
      case 'ascending':
        // Check if we've reached target height or started falling
        if (playerTransform.position.y >= this.skyfallTargetHeight || playerMovement.velocity.y <= 0) {
          this.skyfallPhase = 'descending';
          playerMovement.velocity.y = 0; // Stop at peak
          playerMovement.gravity = this.skyfallOriginalGravity * 30; // Faster descent
        }
        break;
        
      case 'descending':
        // Check if we've landed (close to original height or on ground)
        if (playerTransform.position.y <= this.skyfallStartPosition.y + 0.5) {
          this.skyfallPhase = 'landing';
          this.performSkyfallLanding(playerTransform);
        }
        break;
        
      case 'landing':
        // Landing phase complete
        this.completeSkyfallAbility(playerTransform);
        break;
    }
    
    // Safety timeout (if something goes wrong, end after 5 seconds)
    if (elapsedTime > 4.0) {
      this.completeSkyfallAbility(playerTransform);
    }
  }
  
  private performSkyfallLanding(playerTransform: Transform): void {
    
    // Deal damage to enemies in landing area
    const allEntities = this.world.getAllEntities();
    const landingPosition = playerTransform.position;
    const damageRadius = 4.0; // 4 unit radius
    const skyfallDamage = 125; // 125 damage as requested
    
    let hitCount = 0;
    
    for (const entity of allEntities) {
      if (entity === this.playerEntity) continue;
      
      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);
      
      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
      
      // Check distance to landing position
      const distanceToLanding = landingPosition.distanceTo(targetTransform.position);
      
      if (distanceToLanding <= damageRadius) {
        // Apply Skyfall damage
        const combatSystem = this.world.getSystem(CombatSystem);
        if (combatSystem) {
          combatSystem.queueDamage(entity, skyfallDamage, this.playerEntity || undefined);
          hitCount++;
        }
      }
    }
  }
  
  private completeSkyfallAbility(playerTransform: Transform): void {
    // Reset all Skyfall states
    this.isSkyfalling = false;
    this.skyfallPhase = 'none';
    
    // Restore player movement
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (playerMovement) {
      playerMovement.gravity = this.skyfallOriginalGravity;
      playerMovement.velocity.y = 0; // Stop any remaining vertical movement
    }
  }
  
  private updateBackstabState(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const elapsedTime = currentTime - this.backstabStartTime;
    
    // Check if backstab animation duration has elapsed
    if (elapsedTime >= this.backstabDuration) {
      this.isBackstabbing = false;
    }
  }
  
  // Sunder ability implementation
  private performSunder(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Check cooldown
    if (currentTime - this.lastSunderTime < this.sunderCooldown) {
      return;
    }
    
    // Check energy cost (35 energy)
    const gameUI = (window as any).gameUI;
    if (!gameUI || !gameUI.canCastSunder()) {
      return;
    }
    
    // Consume energy
    gameUI.consumeEnergy(35);
    
    // Set cooldown
    this.lastSunderTime = currentTime;
    
    // Start sunder animation (same as backstab)
    this.isSundering = true;
    this.sunderStartTime = currentTime;
    
    // Perform sunder damage with stacking logic
    this.performSunderDamage(playerTransform);
  }
  
  private updateSunderState(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const elapsedTime = currentTime - this.sunderStartTime;
    
    // Check if sunder animation duration has elapsed
    if (elapsedTime >= this.sunderDuration) {
      this.isSundering = false;
    }
  }
  
  private performSunderDamage(playerTransform: Transform): void {
    // Get all entities in the world to check for enemies/players
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;
    
    // Get player facing direction (camera direction)
    const playerDirection = new Vector3();
    this.camera.getWorldDirection(playerDirection);
    playerDirection.normalize();
    
    const sunderRange = 3.5; // Same range as backstab
    let hitCount = 0;
    const currentTime = Date.now() / 1000;
    
    for (const entity of allEntities) {
      if (entity === this.playerEntity) continue;
      
      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);
      
      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
      
      // Check if target is in range
      const distance = playerPosition.distanceTo(targetTransform.position);
      if (distance > sunderRange) continue;
      
      // Check if target is in front of player (cone attack)
      const directionToTarget = new Vector3()
        .subVectors(targetTransform.position, playerPosition)
        .normalize();
      
      const dotProduct = playerDirection.dot(directionToTarget);
      const angleThreshold = Math.cos(Math.PI / 4); // 60 degree cone
      
      if (dotProduct < angleThreshold) continue;
      
      // Apply Sunder stacks and calculate damage
      const { damage, stackCount, isStunned } = this.applySunderStack(entity.id, currentTime);
      
      // Apply damage
      const combatSystem = this.world.getSystem(CombatSystem);
      if (combatSystem) {
        combatSystem.queueDamage(
          entity,
          damage,
          this.playerEntity!,
          'sunder'
        );
        
        // Apply stun effect if at 3 stacks
        if (isStunned) {
          const enemy = entity.getComponent(Enemy);
          if (enemy) {
            enemy.freeze(4.0, currentTime); // 4 second stun (using freeze mechanics for movement)
            
            // Add visual stun effect (different from freeze)
            addGlobalStunnedEnemy(entity.id.toString(), targetTransform.position);
          }
          
          // Broadcast stun effect for PVP (using new 'stunned' type)
          // CRITICAL FIX: Check if we're about to target ourselves before broadcasting debuff
          if (this.onDebuffCallback) {
            const localSocketId = (window as any).localSocketId;
            const serverPlayerEntities = (window as any).serverPlayerEntities;
            let targetPlayerId: string | null = null;
            
            if (serverPlayerEntities && serverPlayerEntities.current) {
              serverPlayerEntities.current.forEach((localEntityId: number, playerId: string) => {
                if (localEntityId === entity.id) {
                  targetPlayerId = playerId;
                }
              });
            }
            
            // NEVER broadcast debuff to ourselves
            if (targetPlayerId && targetPlayerId !== localSocketId) {
              console.log(`🎯 Broadcasting stun effect to player ${targetPlayerId} (NOT local player ${localSocketId})`);
              this.onDebuffCallback(entity.id, 'stunned', 4000, targetTransform.position);
            } else {
              console.log(`⚠️ Skipping stun broadcast - would target local player ${localSocketId} or invalid target ${targetPlayerId}`);
            }
          }
        }
        
        hitCount++;
      }
      
      // Trigger callback for multiplayer/visual effects
      if (this.onSunderCallback) {
        this.onSunderCallback(playerTransform.position, playerDirection, damage, stackCount);
      }
    }
  }
  
  private applySunderStack(entityId: number, currentTime: number): { damage: number; stackCount: number; isStunned: boolean } {
    const stackDuration = 10.0; // 10 seconds
    let currentStacks = this.sunderStacks.get(entityId);
    
    // Clean up expired stacks or initialize new entry
    if (!currentStacks || (currentTime - currentStacks.lastApplied) > stackDuration) {
      currentStacks = { stacks: 0, lastApplied: currentTime, duration: stackDuration };
    }
    
    // Calculate damage based on current stack count (before adding new stack)
    const baseDamages = [60, 70, 80, 90]; // 0, 1, 2, 3 stacks
    const damage = baseDamages[Math.min(currentStacks.stacks, 3)];
    
    let isStunned = false;
    let newStackCount = currentStacks.stacks;
    
    // Apply new stack
    if (currentStacks.stacks < 3) {
      newStackCount = currentStacks.stacks + 1;
      this.sunderStacks.set(entityId, {
        stacks: newStackCount,
        lastApplied: currentTime,
        duration: stackDuration
      });
    } else {
      // At 3 stacks, apply stun and reset to 0 stacks
      isStunned = true;
      newStackCount = 0;
      this.sunderStacks.set(entityId, {
        stacks: 0,
        lastApplied: currentTime,
        duration: stackDuration
      });
    }
    
    return { damage, stackCount: newStackCount, isStunned };
  }
  
  // Clean up expired Sunder stacks periodically
  private cleanupSunderStacks(): void {
    const currentTime = Date.now() / 1000;
    const stackDuration = 10.0;
    
    // Convert to array to avoid iteration issues
    const entries = Array.from(this.sunderStacks.entries());
    for (const [entityId, stackData] of entries) {
      if ((currentTime - stackData.lastApplied) > stackDuration) {
        this.sunderStacks.delete(entityId);
      }
    }
  }
  
  private resetAllAbilityStates(): void {
    // Reset all ability states when switching weapons
    this.isSkyfalling = false;
    this.skyfallPhase = 'none';
    this.isBackstabbing = false;
    this.isSundering = false;
    this.isDivineStorming = false;
    this.isSwordCharging = false;
    this.isDeflecting = false;
    
    // Clear Sunder stacks when switching weapons
    this.sunderStacks.clear();
  }

  // Backstab ability implementation
  private performBackstab(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Check cooldown
    if (currentTime - this.lastBackstabTime < this.backstabCooldown) {
      return;
    }
    
    // Check energy cost
    const gameUI = (window as any).gameUI;
    if (!gameUI || !gameUI.canCastBackstab()) {
      return;
    }
    
    // Consume energy
    gameUI.consumeEnergy(60);
    
    // Set cooldown
    this.lastBackstabTime = currentTime;
  
    
    // Start backstab animation
    this.isBackstabbing = true;
    this.backstabStartTime = currentTime;
    
    // Trigger callback for multiplayer/visual effects
    if (this.onBackstabCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      this.onBackstabCallback(playerTransform.position, direction, 75, false); // Base damage, not backstab by default
    }
    
    // Perform backstab damage
    this.performBackstabDamage(playerTransform);
  }

  private performBackstabDamage(playerTransform: Transform): void {
    // Get all entities in the world to check for enemies/players
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;
    
    // Get player facing direction (camera direction)
    const playerDirection = new Vector3();
    this.camera.getWorldDirection(playerDirection);
    playerDirection.normalize();
    
    const backstabRange = 4.25; // Sabre melee range
    let hitCount = 0;
    
    for (const entity of allEntities) {
      if (entity === this.playerEntity) continue;
      
      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);
      
      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
      
      // Check if target is in range
      const distance = playerPosition.distanceTo(targetTransform.position);
      if (distance > backstabRange) continue;
      
      // Check if target is in front of player (cone attack)
      const directionToTarget = new Vector3()
        .subVectors(targetTransform.position, playerPosition)
        .normalize();
      
      const dotProduct = playerDirection.dot(directionToTarget);
      const angleThreshold = Math.cos(Math.PI / 3); // 60 degree cone
      
      if (dotProduct < angleThreshold) continue;
      
      // Determine if this is a backstab (attacking from behind the target)
      let isBackstab = false;
      let damage = 75; // Base damage
      
      // For PVP players, check if we're behind them
      const pvpPlayers = (window as any).pvpPlayers;
      const localSocketId = (window as any).localSocketId;
      
      if (pvpPlayers && localSocketId) {
        // Find the target player in PVP players map
        let targetPlayer = null;
        for (const [playerId, player] of pvpPlayers) {
          if (playerId !== localSocketId) {
            const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
            if (playerPos.distanceTo(targetTransform.position) < 0.5) {
              targetPlayer = player;
              break;
            }
          }
        }
        
        if (targetPlayer) {
          // Calculate target's facing direction from their rotation
          const targetFacingDirection = new Vector3(
            Math.sin(targetPlayer.rotation.y),
            0,
            Math.cos(targetPlayer.rotation.y)
          ).normalize();
          
          // Vector from target to attacker
          const attackerDirection = new Vector3()
            .subVectors(playerPosition, targetTransform.position)
            .normalize();
          
          // Check if attacker is behind target (dot product < 0 means opposite direction)
          const behindDotProduct = targetFacingDirection.dot(attackerDirection);
          isBackstab = behindDotProduct < -0.3; // 70 degree cone behind target
          
          if (isBackstab) {
            damage = 175; // Backstab damage
          }
        }
      }
      
      // Apply damage
      const combatSystem = this.world.getSystem(CombatSystem);
      if (combatSystem) {
        combatSystem.queueDamage(
          entity,
          damage,
          this.playerEntity!,
          'backstab'
        );
        
        hitCount++;
      }
    }
  }

  private performMeleeDamage(playerTransform: Transform): void {
    // Get all entities in the world to check for enemies
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;
    
    // Get player facing direction (camera direction)
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Melee attack parameters - increased for PVP combat
    const meleeRange = 4.5; // Increased attack range for PVP
    const meleeAngle = Math.PI / 2; // 120 degree cone (60 degrees each side)
    
    // Base damage values based on combo step and weapon type
    let baseDamage = 45; // Default base damage

    // Weapon-specific damage scaling
    if (this.currentWeapon === WeaponType.SWORD) {
      // Sword damage values
      switch (this.swordComboStep) {
        case 1: baseDamage = 40; break;
        case 2: baseDamage = 45; break;
        case 3: baseDamage = 55; break; // Finisher does more damage
      }
    } else if (this.currentWeapon === WeaponType.RUNEBLADE) {
      // Runeblade damage values
      switch (this.swordComboStep) {
        case 1: baseDamage = 30; break;
        case 2: baseDamage = 35; break;
        case 3: baseDamage = 45; break; // Finisher does more damage
      }
    }
    
    // Get combat system to apply damage
    const combatSystem = this.world.getSystem(CombatSystem);
    
    // Track enemies hit for rage generation
    let enemiesHit = 0;
    
    allEntities.forEach(entity => {
      // Check if entity has enemy component and health
      const enemyTransform = entity.getComponent(Transform);
      const enemyHealth = entity.getComponent(Health);
      if (!enemyTransform || !enemyHealth || entity.id === this.playerEntity?.id) return;
      
      const enemyPosition = enemyTransform.position;
      const toEnemy = enemyPosition.clone().sub(playerPosition);
      const distance = toEnemy.length();
      
      // Debug logging for PVP hit detection
      
      
      // Check if enemy is within range
      if (distance <= meleeRange) {
        // Check if enemy is within attack cone
        toEnemy.normalize();
        const angle = direction.angleTo(toEnemy);
        const angleDegrees = angle * 180 / Math.PI;
        const maxAngleDegrees = (meleeAngle / 2) * 180 / Math.PI;
        
        
        if (angle <= meleeAngle / 2) {
          // Enemy is within attack cone - deal damage through combat system
          
          if (combatSystem && this.playerEntity) {
            // Queue damage through combat system (which will route to multiplayer for enemies)
            combatSystem.queueDamage(entity, baseDamage, this.playerEntity, 'melee');
            enemiesHit++;
          }
        }
      }
    });
    
    // Generate rage only if we hit enemies (5 rage per hit, max 5 per swing)
    if (enemiesHit > 0) {
      const gameUI = (window as any).gameUI;
      if (gameUI) {
        const rageToGain = Math.min(enemiesHit * 5, 5); // 5 rage per hit, max 5 per swing
        gameUI.gainRage(rageToGain);
      }
    }
  }

  private checkForDashInput(movement: Movement, transform: Transform): void {
    // Check for double-tap on movement keys
    const dashDirections = [
      { key: 'w', direction: new Vector3(0, 0, -1) }, // Forward
      { key: 's', direction: new Vector3(0, 0, 1) },  // Backward
      { key: 'a', direction: new Vector3(-1, 0, 0) }, // Left
      { key: 'd', direction: new Vector3(1, 0, 0) }   // Right
    ];

    for (const { key, direction } of dashDirections) {
      if (this.inputManager.checkDoubleTap(key)) {
        // Debug: Log the double tap detection
        const debugInfo = this.inputManager.getDoubleTapDebugInfo(key);
        
        // Convert input direction to world space based on camera orientation
        const worldDirection = this.getWorldSpaceDirection(direction);
        
        // Attempt to start dash
        const currentTime = Date.now() / 1000; // Convert to seconds
        const dashStarted = movement.startDash(worldDirection, transform.position, currentTime);
        
        if (dashStarted) {
          // Reset the double-tap state to prevent multiple dashes
          this.inputManager.resetDoubleTap(key);
        }
        
        break; // Only process one dash per frame
      }
    }
  }

  private handleDashMovement(movement: Movement, transform: Transform): void {
    if (!movement.isDashing) return;

    const currentTime = Date.now() / 1000; // Convert to seconds
    const dashResult = movement.updateDash(currentTime);

    if (dashResult.newPosition) {
      // Apply bounds checking (similar to old implementation)
      const MAX_DASH_BOUNDS = 29; // Maximum distance from origin (matches map boundary)
      const distanceFromOrigin = dashResult.newPosition.length();
      
      if (distanceFromOrigin <= MAX_DASH_BOUNDS) {
        transform.position.copy(dashResult.newPosition);
      } else {
        // Cancel dash if it would move too far from origin
        // console.warn(`Dash cancelled: would move too far from origin (${distanceFromOrigin.toFixed(2)} > ${MAX_DASH_BOUNDS})`);
        movement.cancelDash();
      }
    }
  }

  private handleChargeMovement(movement: Movement, transform: Transform): void {
    if (!movement.isCharging) return;

    const currentTime = Date.now() / 1000; // Convert to seconds
    
    // Check if charge was stopped by collision
    if (this.chargeStoppedByCollision) {
      movement.cancelCharge();
      return;
    }
    
    const chargeResult = movement.updateCharge(currentTime);

    if (chargeResult.newPosition) {
      // Apply bounds checking
      const MAX_CHARGE_BOUNDS = 29; // Maximum distance from origin (matches map boundary)
      const distanceFromOrigin = chargeResult.newPosition.length();
      
      // Check for pillar collision
      const pillarCollision = this.checkPillarCollision(chargeResult.newPosition);
      
      if (distanceFromOrigin > MAX_CHARGE_BOUNDS) {
        // Cancel charge if it would move too far from origin
        movement.cancelCharge();
        // Notify sword component that charge was cancelled
        this.onChargeComplete();
      } else if (pillarCollision.hasCollision) {
        // Cancel charge if it would collide with a pillar
        console.warn(`Charge cancelled: would collide with pillar at [${pillarCollision.pillarCenter.toArray().join(', ')}]`);
        movement.cancelCharge();
        // Notify sword component that charge was cancelled
        this.onChargeComplete();
      } else if (!this.chargeStoppedByCollision) {
        // Only update position if not stopped by collision
        transform.position.copy(chargeResult.newPosition);
      }
    }

    if (chargeResult.isComplete || this.chargeStoppedByCollision) {
      console.log('⚔️ Charge movement completed');
      // Notify sword component that charge is complete
      this.onChargeComplete();
    }
  }

  // Define pillar positions (same as in Environment.tsx)
  private readonly PILLAR_POSITIONS = [
    new Vector3(0, 0, -5),        // Front pillar
    new Vector3(-4.25, 0, 2.5),   // Left pillar
    new Vector3(4.25, 0, 2.5)     // Right pillar
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

  private getWorldSpaceDirection(inputDirection: Vector3): Vector3 {
    // Get camera direction vectors
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

    return worldDirection;
  }

  private performDivineStorm(playerTransform: Transform): void {
    // Check if player has enough rage (minimum 20 rage required)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastDivineStorm()) {
      return;
    }

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastDivineStormTime < this.divineStormCooldown) {
      return;
    }

    // Get current rage amount and consume ALL rage
    const currentRage = gameUI ? gameUI.getCurrentRage() : 40; // Fallback to 40 if gameUI not available
    if (gameUI) {
      gameUI.consumeAllRage(); // Consume all rage instead of just 20
    }

    // Calculate extended duration: base 4 seconds + 1 second per 10 rage consumed
    const baseStormDuration = 1000; // 4 seconds base
    const bonusDuration = Math.floor(currentRage / 10) * 500; // 1 second per 10 rage
    const totalDivineStormDuration = baseStormDuration + bonusDuration;

    this.isDivineStorming = true;
    this.lastDivineStormTime = currentTime;
    
    // Trigger Divine Storm callback for multiplayer
    if (this.onDivineStormCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.normalize();
      this.onDivineStormCallback(playerTransform.position.clone(), direction, totalDivineStormDuration);
    }

    // Divine Storm lasts for calculated duration
    setTimeout(() => {
      this.isDivineStorming = false;
    }, totalDivineStormDuration);
  }

  private performCharge(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastChargeTime < this.chargeCooldown) {
      return;
    }

    this.isSwordCharging = true;
    this.lastChargeTime = currentTime;
    
    // Reset collision tracking for new charge
    this.chargeStoppedByCollision = false;
    
    // Trigger Charge callback for multiplayer
    if (this.onChargeCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.normalize();
      this.onChargeCallback(playerTransform.position.clone(), direction);
    }
    
    // Gain rage for using charge ability (+20 rage)
    const gameUI = (window as any).gameUI;
    if (gameUI) {
      gameUI.gainRage(20);
    }
    
    // Start the charge movement using the separate charge system
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        // Get charge direction from camera
        const direction = new Vector3();
        this.camera.getWorldDirection(direction);
        direction.y = 0; // Keep movement horizontal
        direction.normalize();
        
        // Start charge with 10.5 distance (separate from dash system)
        const chargeStarted = playerMovement.startCharge(direction, playerTransform.position, currentTime);
        
        if (chargeStarted) {
          // Schedule charge damage detection during movement
          this.scheduleChargeDamage(playerTransform, direction, currentTime);
        }
      }
    }
  }

  // Track charge hit entities to prevent multiple hits and enable collision stopping
  private chargeHitEntities = new Set<number>();
  private chargeStoppedByCollision = false;

  // Schedule damage detection during charge movement
  private scheduleChargeDamage(playerTransform: Transform, chargeDirection: Vector3, startTime: number): void {
    const chargeDuration = 0.6; 
    const damageCheckInterval = 50; // Check for damage every 50ms for better collision detection
    const chargeDamage = 40; // High damage for charge ability
    const chargeRadius = 2.5; // Damage radius around player during charge
    
    // Reset charge hit tracking
    this.chargeHitEntities.clear();
    this.chargeStoppedByCollision = false;
    
    const damageInterval = setInterval(() => {
      const currentTime = Date.now() / 1000;
      
      // Stop if charge is complete, cancelled, or stopped by collision
      if (!this.isSwordCharging || currentTime - startTime > chargeDuration || this.chargeStoppedByCollision) {
        clearInterval(damageInterval);
        return;
      }
      
      // Get all entities in the world to check for damage
      const allEntities = this.world.getAllEntities();
      const playerPosition = playerTransform.position;
      
      let hitSomething = false;
      
      // Debug: Log all entities in the world during charge
      
      // ENHANCED: Also check against server player positions directly as a fallback
      // This ensures we don't miss collisions due to entity sync issues
      const serverPlayers = (window as any).pvpPlayers || new Map();
      const localSocketId = (window as any).localSocketId;
            
      serverPlayers.forEach((serverPlayer: any, playerId: string) => {
        // Skip self
        if (playerId === localSocketId) return;
        
        // Skip already hit players (use hash of player ID for tracking)
        const playerIdHash = playerId.length * 1000 + playerId.charCodeAt(0);
        if (this.chargeHitEntities.has(playerIdHash)) return;
        
        const serverPlayerPos = new Vector3(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
        const distance = playerPosition.distanceTo(serverPlayerPos);
        const stopDistance = 0.9 + 1.0; // Player collision radius + buffer
        
        
        if (distance <= stopDistance && serverPlayer.health > 0) {
          this.chargeHitEntities.add(playerIdHash);
          hitSomething = true;
          
          // Apply damage through PVP system if available
          if (this.onProjectileCreatedCallback) {
            this.onProjectileCreatedCallback('sword_charge_hit', playerPosition.clone(), chargeDirection.clone(), {
              damage: chargeDamage,
              targetId: playerId,
              hitPosition: {
                x: serverPlayerPos.x,
                y: serverPlayerPos.y,
                z: serverPlayerPos.z
              }
            });
          }
        }
      });
      
      allEntities.forEach(entity => {
        // Skip self
        if (entity.id === this.playerEntity?.id) return;
        
        // Skip already hit entities
        if (this.chargeHitEntities.has(entity.id)) return;
        
        // Check if entity has transform and health (could be enemy or player)
        const entityTransform = entity.getComponent(Transform);
        const entityHealth = entity.getComponent(Health);
        const entityCollider = entity.getComponent(Collider);
        
        // Debug: Log entity details
        const enemy = entity.getComponent(Enemy);
        const entityType = enemy ? `Enemy(${enemy.getDisplayName()})` : `Player(${entity.id})`;
        
        if (!entityTransform || !entityHealth || entityHealth.isDead) return;
        
        const entityPosition = entityTransform.position;
        const distance = playerPosition.distanceTo(entityPosition);
        
        // Check if entity is within charge damage radius
        // In PVP, we want to stop just before hitting the enemy, not overlap with them
        const stopDistance = entityCollider ? entityCollider.radius + 1.0 : chargeRadius; // Stop 1 unit away from enemy edge
        
        // Debug: Log position and distance information
        
        if (distance <= stopDistance) {
          // Mark as hit to prevent multiple hits
          this.chargeHitEntities.add(entity.id);
          hitSomething = true;
          
          // Apply damage through combat system
          const combatSystem = this.world.getSystem(CombatSystem);
          if (combatSystem && this.playerEntity) {
            combatSystem.queueDamage(entity, chargeDamage, this.playerEntity, 'charge');
            
            const enemy = entity.getComponent(Enemy);
            const entityType = enemy ? `Enemy(${enemy.getDisplayName()})` : `Player(${entity.id})`;
            
            // Broadcast charge attack for PVP (includes damage and animation)
            if (this.onProjectileCreatedCallback) {
              this.onProjectileCreatedCallback('sword_charge_hit', playerPosition.clone(), chargeDirection.clone(), {
                damage: chargeDamage,
                targetId: entity.id,
                hitPosition: {
                  x: entityPosition.x,
                  y: entityPosition.y,
                  z: entityPosition.z
                }
              });
            }
          }
        }
      });
      
      // In PVP mode, stop charge when hitting something
      if (hitSomething) {
        this.chargeStoppedByCollision = true;
        
        // Stop the charge movement immediately
        if (this.playerEntity) {
          const playerMovement = this.playerEntity.getComponent(Movement);
          if (playerMovement) {
            playerMovement.cancelCharge();
          }
        }
        
        // Clear the damage interval immediately to prevent further hits
        clearInterval(damageInterval);
        
        // Trigger charge completion
        this.onChargeComplete();
      }
    }, damageCheckInterval);
  }

  // Called by sword component when Charge completes
  public onChargeComplete(): void {
    this.isSwordCharging = false;
  }

  private performDeflect(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastDeflectTime < this.deflectCooldown) {
      return;
    }

    this.isDeflecting = true;
    this.lastDeflectTime = currentTime;
    
    // Trigger Deflect callback for multiplayer
    if (this.onDeflectCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.normalize();
      this.onDeflectCallback(playerTransform.position.clone(), direction);
    }
    
    // Set up deflect barrier that blocks damage and reflects projectiles
    this.setupDeflectBarrier(playerTransform);
    
    // Auto-complete deflect after duration
    setTimeout(() => {
      this.onDeflectComplete();
    }, this.deflectDuration * 1000);
  }

  private performViperSting(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastViperStingTime < this.viperStingFireRate) {
      return;
    }

    // Check if player has enough energy (60 energy cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastViperSting()) {
      return;
    }

    // Consume energy
    if (gameUI) {
      gameUI.consumeEnergy(60);
    }

    this.isViperStingCharging = true;
    this.viperStingChargeProgress = 0;
    this.lastViperStingTime = currentTime;
    
    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 1000; // 1 second charge time
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.viperStingChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.viperStingChargeProgress >= 1.0) {
        clearInterval(chargeInterval);
        this.fireViperSting(playerTransform);
        this.isViperStingCharging = false;
        this.viperStingChargeProgress = 0;
      }
    }, 16); // ~60fps updates
  }

  private fireViperSting(playerTransform: Transform): void {
    
    // Get player position and direction
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 0.825; // Shoot from chest level
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply same downward angle compensation as other projectiles
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    // Apply rotation around the right axis to tilt the direction downward
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Offset spawn position slightly forward to avoid collision with player
    const spawnPosition = playerPosition.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    
    // Note: Viper Sting damage is handled by ViperStingManager, not ECS projectiles
    // This prevents duplicate projectiles and damage
    
    // Trigger Viper Sting callback for visual effects
    if (this.onViperStingCallback) {
      this.onViperStingCallback(playerPosition, direction);
    }
    
    // Trigger the global Viper Sting manager for visual effects
    const success = triggerGlobalViperSting();
    if (success) {
      // console.log('🐍 Viper Sting visual effects successfully triggered!');
    }
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('viper_sting_projectile', spawnPosition, direction, {
        speed: 16,
        damage: 61,
        lifetime: 5,
        isReturning: false
      });
    }
  }

  private performBarrage(playerTransform: Transform): void {
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastBarrageTime < this.barrageFireRate) {
      console.log(`⏰ Barrage on cooldown for ${(this.barrageFireRate - (currentTime - this.lastBarrageTime)).toFixed(1)}s`);
      return;
    }

    // Check if player has enough energy (40 energy cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastBarrage()) {
      return;
    }

    // Consume energy
    if (gameUI) {
      gameUI.consumeEnergy(40);
    }

    this.isBarrageCharging = true;
    this.barrageChargeProgress = 0;
    this.lastBarrageTime = currentTime;
    
    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 500; // 1 second charge time
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.barrageChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.barrageChargeProgress >= 1.0) {
        clearInterval(chargeInterval);
        this.fireBarrage(playerTransform);
        this.isBarrageCharging = false;
        this.barrageChargeProgress = 0;
      }
    }, 16); // ~60fps updates
  }

  private fireBarrage(playerTransform: Transform): void {
    
    // Get player position and direction
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 0.825; // Shoot from chest level
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    
    // Apply same downward compensation as projectile system
    const compensationAngle = Math.PI / 6; // 30 degrees
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Create 5 arrows: center (0°), left (15°, 30°), right (-15°, -30°) using proper ECS projectiles
    const angles = [0, Math.PI / 12, -Math.PI / 12, Math.PI / 6, -Math.PI / 6]; // 0°, 15°, -15°, 30°, -30°
    
    angles.forEach(angle => {
      // Rotate the base direction by the specified angle around the Y axis
      const projectileDirection = direction.clone();
      const rotationMatrix = new Matrix4().makeRotationY(angle);
      projectileDirection.applyMatrix4(rotationMatrix);
      projectileDirection.normalize();
      
      // Offset spawn position slightly forward to avoid collision with player
      const spawnPosition = playerPosition.clone();
      spawnPosition.add(projectileDirection.clone().multiplyScalar(1)); // 1 unit forward
      
      // Create proper ECS projectile entity
      const projectileConfig = {
        speed: 22, // Slightly faster than regular arrows (20)
        damage: 30, // High damage for barrage arrows
        lifetime: 8,
        maxDistance: 25, // Limit barrage arrows to 25 units distance (same as regular arrows)
        piercing: false,
        subclass: this.currentSubclass,
        level: 1,
        opacity: 1.0
      };
      
      const projectileEntity = this.projectileSystem.createProjectile(
        this.world,
        spawnPosition,
        projectileDirection,
        this.playerEntity!.id,
        projectileConfig
      );
      
      // Mark as barrage arrow for visual identification
      const renderer = projectileEntity.getComponent(Renderer) as Renderer;
      if (renderer?.mesh) {
        renderer.mesh.userData.isBarrageArrow = true;
        renderer.mesh.userData.isRegularArrow = false; // Override regular arrow marking
      }
      
      // Broadcast projectile creation to other players
      if (this.onProjectileCreatedCallback) {
        this.onProjectileCreatedCallback('barrage_projectile', spawnPosition, projectileDirection, projectileConfig);
      }
      
    });
    
    // Trigger Barrage callback for additional visual effects if needed
    if (this.onBarrageCallback) {
      this.onBarrageCallback(playerPosition, direction);
    }
    
  }

  private setupDeflectBarrier(playerTransform: Transform): void {
    // Activate the deflect barrier
    const playerPosition = playerTransform.getWorldPosition();
    const playerRotation = new Vector3(0, 0, 0);
    
    // Use SAME rotation logic as DragonRenderer for consistency with visual shield
    if (this.playerEntity) {
      const movement = this.playerEntity.getComponent(Movement);
      if (movement && movement.inputStrength > 0.1) {
        // Player is actively moving - use movement direction (same as DragonRenderer)
        const moveDir = movement.moveDirection;
        if (moveDir.length() > 0.1) {
          const moveAngle = Math.atan2(moveDir.x, moveDir.z);
          playerRotation.y = moveAngle;
        }
      } else {
        // Not moving - use camera direction (same as DragonRenderer fallback)
        const cameraDirection = new Vector3();
        this.camera.getWorldDirection(cameraDirection);
        playerRotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);
      }
    }
    
    this.deflectBarrier.activate(playerPosition, playerRotation, this.playerEntity || undefined);
  }

  private updateDeflectBarrier(playerTransform: Transform): void {
    // Update deflect barrier position if it's active
    if (this.deflectBarrier.isBarrierActive()) {
      const playerPosition = playerTransform.getWorldPosition();
      const playerRotation = new Vector3(0, 0, 0);
      
      // Use SAME rotation logic as DragonRenderer for consistency with visual shield
      if (this.playerEntity) {
        const movement = this.playerEntity.getComponent(Movement);
        if (movement && movement.inputStrength > 0.1) {
          // Player is actively moving - use movement direction (same as DragonRenderer)
          const moveDir = movement.moveDirection;
          if (moveDir.length() > 0.1) {
            const moveAngle = Math.atan2(moveDir.x, moveDir.z);
            playerRotation.y = moveAngle;
          }
        } else {
          // Not moving - use camera direction (same as DragonRenderer fallback)
          const cameraDirection = new Vector3();
          this.camera.getWorldDirection(cameraDirection);
          playerRotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);
        }
      }
      
      // Update barrier position to follow player
      this.deflectBarrier.updatePosition(playerPosition, playerRotation);
    }
  }

  // Called by sword component when Deflect completes
  public onDeflectComplete(): void {
    this.isDeflecting = false;
    this.deflectBarrier.deactivate();
  }

  // Public methods to get cooldown information for UI
  public getWeaponSwitchCooldown(): { current: number; max: number } {
    const currentTime = Date.now() / 1000;
    return {
      current: Math.max(0, this.weaponSwitchCooldown - (currentTime - this.lastWeaponSwitchTime)),
      max: this.weaponSwitchCooldown
    };
  }

  public getAbilityCooldowns(): Record<string, { current: number; max: number; isActive: boolean }> {
    const currentTime = Date.now() / 1000;
    
    const cooldowns: Record<string, { current: number; max: number; isActive: boolean }> = {};
    
    if (this.currentWeapon === WeaponType.SWORD) {
      cooldowns['Q'] = {
        current: Math.max(0, this.deflectCooldown - (currentTime - this.lastDeflectTime)),
        max: this.deflectCooldown,
        isActive: this.isDeflecting
      };
      cooldowns['E'] = {
        current: Math.max(0, this.chargeCooldown - (currentTime - this.lastChargeTime)),
        max: this.chargeCooldown,
        isActive: this.isSwordCharging
      };
      cooldowns['R'] = {
        current: Math.max(0, this.divineStormCooldown - (currentTime - this.lastDivineStormTime)),
        max: this.divineStormCooldown,
        isActive: this.isDivineStorming
      };
    } else if (this.currentWeapon === WeaponType.BOW) {
      cooldowns['Q'] = {
        current: Math.max(0, this.barrageFireRate - (currentTime - this.lastBarrageTime)),
        max: this.barrageFireRate,
        isActive: this.isBarrageCharging
      };
      cooldowns['E'] = {
        current: Math.max(0, this.cobraShotFireRate - (currentTime - this.lastCobraShotTime)),
        max: this.cobraShotFireRate,
        isActive: false
      };
      cooldowns['R'] = {
        current: Math.max(0, this.viperStingFireRate - (currentTime - this.lastViperStingTime)),
        max: this.viperStingFireRate,
        isActive: this.isViperStingCharging
      };
    } else if (this.currentWeapon === WeaponType.SCYTHE) {
      cooldowns['Q'] = {
        current: Math.max(0, 1.0 - (currentTime - this.lastReanimateTime)),
        max: 1.0,
        isActive: false
      };
      cooldowns['E'] = {
        current: Math.max(0, this.frostNovaFireRate - (currentTime - this.lastFrostNovaTime)),
        max: this.frostNovaFireRate,
        isActive: false
      };
      cooldowns['R'] = {
        current: Math.max(0, this.crossentropyFireRate - (currentTime - this.lastCrossentropyTime)),
        max: this.crossentropyFireRate,
        isActive: false
      };
    } else if (this.currentWeapon === WeaponType.SABRES) {
      cooldowns['Q'] = {
        current: Math.max(0, this.backstabCooldown - (currentTime - this.lastBackstabTime)),
        max: this.backstabCooldown,
        isActive: this.isBackstabbing
      };
      cooldowns['E'] = {
        current: Math.max(0, this.sunderCooldown - (currentTime - this.lastSunderTime)),
        max: this.sunderCooldown,
        isActive: this.isSundering
      };
      cooldowns['R'] = {
        current: Math.max(0, this.skyfallCooldown - (currentTime - this.lastSkyfallTime)),
        max: this.skyfallCooldown,
        isActive: this.isSkyfalling
      };
    } else if (this.currentWeapon === WeaponType.RUNEBLADE) {
      // RUNEBLADE abilities
      cooldowns['Q'] = {
        current: Math.max(0, this.deathGraspCooldown - (currentTime - this.lastDeathGraspTime)),
        max: this.deathGraspCooldown,
        isActive: this.isDeathGrasping
      };
      cooldowns['E'] = {
        current: Math.max(0, this.smiteCooldown - (currentTime - this.lastSmiteTime)),
        max: this.smiteCooldown,
        isActive: this.isSmiting
      };
      // R is unused for RUNEBLADE
    }

    return cooldowns;
  }
}