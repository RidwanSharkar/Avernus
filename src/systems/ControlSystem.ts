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
import { AudioSystem } from './AudioSystem';
import { CombatSystem } from './CombatSystem';
import { WeaponSubclass, WeaponType } from '@/components/dragon/weapons';
import { DeflectBarrier } from '@/components/weapons/DeflectBarrier';
import { SkillPointSystem, SkillPointData } from '@/utils/SkillPointSystem';
import { triggerGlobalFrostNova, addGlobalFrozenEnemy } from '@/components/weapons/FrostNovaManager';
import { addGlobalStunnedEnemy } from '@/components/weapons/StunManager';
import { triggerGlobalCobraShot } from '@/components/projectiles/CobraShotManager';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';
import { setGlobalCriticalRuneCount, setGlobalCritDamageRuneCount, getGlobalRuneCounts, setControlSystem, calculateDamage, DamageResult } from '@/core/DamageCalculator';

export class ControlSystem extends System {
  public readonly requiredComponents = [Transform, Movement];
  private inputManager: InputManager;
  private camera: PerspectiveCamera;
  private world: World;
  private projectileSystem: ProjectileSystem;
  private audioSystem: AudioSystem | null = null;
  private playerEntity: Entity | null = null;

  // Input control
  private inputDisabled: boolean = false;
  
  // Callback for bow release effects
  private onBowReleaseCallback?: (finalProgress: number, isPerfectShot?: boolean) => void;
  
  
  // Callback for projectile creation
  private onProjectileCreatedCallback?: (projectileType: string, position: Vector3, direction: Vector3, config: any) => void;
  
  // Callback for Viper Sting activation
  private onViperStingCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for Cloudkill activation
  private onCloudkillCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Barrage activation
  private onBarrageCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Reanimate healing effect
  private onReanimateCallback?: () => void;

  // Callback for creating damage numbers
  private onDamageNumbersUpdate?: (damageNumbers: Array<{
    id: string;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    timestamp: number;
    damageType?: string;
  }>) => void;

  // Callback for broadcasting healing in PVP
  private onBroadcastHealing?: (healingAmount: number, healingType: string, position: Vector3) => void;
  
  // Callback for Frost Nova activation
  private onFrostNovaCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for Cobra Shot activation
  private onCobraShotCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for Summon Totem activation
  private onSummonTotemCallback?: (position: Vector3) => void;
  
  // Callback for Charge activation
  private onChargeCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Deflect activation
  private onDeflectCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for broadcasting debuff effects in PVP
  private onDebuffCallback?: (targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', duration: number, position: Vector3) => void;
  
  // Callback for Skyfall ability
  private onSkyfallCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Backstab ability
  private onBackstabCallback?: (position: Vector3, direction: Vector3, damage: number, isBackstab: boolean) => void;
  
  // Callback for Sunder ability
  private onSunderCallback?: (position: Vector3, direction: Vector3, damage: number, stackCount: number) => void;

  // Callback for Smite ability
  private onSmiteCallback?: (position: Vector3, direction: Vector3, onDamageDealt?: (totalDamage: number) => void) => void;

  // Callback for Colossus Strike ability
  private onColossusStrikeCallback?: (position: Vector3, direction: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => void;

  // Callback for Wind Shear ability
  private onWindShearCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for DeathGrasp ability
  private onDeathGraspCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for WraithStrike ability
  private onWraithStrikeCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for Runeblade mana consumption
  private onConsumeManaCallback?: (amount: number) => void;

  // Callback for Runeblade mana checking
  private onCheckManaCallback?: (amount: number) => boolean;

  // Callback for creating Sabre Reaper Mist effect
  private onCreateSabreMistEffectCallback?: (position: Vector3) => void;

  // Callback for Stealth ability
  private onStealthCallback?: (position: Vector3, isActivating: boolean) => void;

  // Callback for broadcasting Sabre Reaper Mist effects in PVP
  private onBroadcastSabreMistCallback?: (position: Vector3, effectType: 'stealth' | 'skyfall') => void;

  // Callback for creating local debuff effects in PVP
  private onCreateLocalDebuffCallback?: (playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', position: Vector3, duration: number) => void;

  // Callback for Haunted Soul effect (WraithStrike)
  private onHauntedSoulEffectCallback?: (position: Vector3) => void;

  // Callback for WindShear Tornado effect
  private onWindShearTornadoCallback?: (playerId: string, duration: number) => void;

  // Callback for broadcasting melee attack sounds in PVP
  private onBroadcastMeleeAttackCallback?: (attackType: string, position: Vector3, comboStep?: number) => void;

  // Local socket ID for identifying the local player
  private localSocketId: string | null = null;

  // Rate limiting for projectile firing
  private lastBowFireTime = 0; // Bow projectiles
  private lastScytheFireTime = 0; // Scythe entropic bolts
  private lastSwordFireTime = 0; // Sword melee attacks
  private lastRunebladeFireTime = 0; // Runeblade melee attacks
  private lastSabresFireTime = 0; // Sabres melee attacks
  private lastCrossentropyTime = 0; // Separate tracking for CrossentropyBolt
  private lastReanimateTime = 0; // Separate tracking for Reanimate ability
  private lastViperStingTime = 0;
  private lastFrostNovaTime = 0; // Separate tracking for Frost Nova ability
  private lastCobraShotTime = 0; // Separate tracking for Cobra Shot ability
  private lastSummonTotemTime = 0; // Separate tracking for Summon Totem ability
  private lastCloudkillTime = 0; // Separate tracking for Cloudkill ability
  private fireRate = 0.2; // Default for bow
  private swordFireRate = 0.825; // Rate for sword attacks
  private runebladeFireRate = 0.725; // Runeblade attack rate
  private sabresFireRate = 0.6; // Sabres dual attack rate (600ms between attacks)
  private scytheFireRate = 0.35; // EntropicBolt rate (0.33s cooldown)
  private crossentropyFireRate = 2; // CrossentropyBolt rate (1 per second)
  private summonTotemFireRate = 5.0; // Summon Totem rate (5 seconds cooldown)
  private viperStingFireRate = 2.0; // Viper Sting rate (2 seconds cooldown)
  private frostNovaFireRate = 12.0; // Frost Nova rate (12 seconds cooldown)
  private cobraShotFireRate = 2.0; // Cobra Shot rate (2 seconds cooldown)
  private cloudkillFireRate = 4.0; // Cloudkill rate (1.5 seconds cooldown)
  private lastBurstFireTime = 0; // Separate tracking for Bow burst fire
  private burstFireRate = 0.85; // 1 second cooldown between bursts

  // Key press tracking for toggle abilities
  private fKeyWasPressed = false;
  
  // Current weapon configuration
  private currentWeapon: WeaponType;
  private currentSubclass: WeaponSubclass;
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

  // Cloudkill charging state
  private isCloudkillCharging = false;
  private cloudkillChargeProgress = 0;

  // Crossentropy Bolt charging state
  private isCrossentropyCharging = false;
  private crossentropyChargeProgress = 0;

  // Summon Totem charging state
  private isSummonTotemCharging = false;
  private summonTotemChargeProgress = 0;
  
  // Sword-specific states
  private swordComboStep: 1 | 2 | 3 = 1;
  private lastSwordAttackTime = 0;
  private swordComboResetTime = 1; // Reset combo after 1 seconds
  
  
  // Charge ability state
  private isSwordCharging = false;
  private lastChargeTime = 0;
  private chargeCooldown = 8.0; // 8 second cooldown
  
  // Deflect ability state
  private isDeflecting = false;
  private lastDeflectTime = 0;
  private deflectCooldown = 7.0; // 8 second cooldown
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
  private backstabCooldown = 1.65; // 2 second cooldown
  private isBackstabbing = false;
  private backstabStartTime = 0;
  private backstabDuration = 1.0; // Total animation duration (0.3 + 0.4 + 0.3 seconds)
  
  // Sunder ability state (Sabres)
  private lastSunderTime = 0;
  private sunderCooldown = 1.65; // 1.5 second cooldown
  private isSundering = false;
  private sunderStartTime = 0;
  private sunderDuration = 1.0; // Same animation duration as backstab
  private sunderDamageApplied = false; // Track if damage has been applied during current sunder
  
  // Stealth ability state (Sabres)
  private lastStealthTime = 0;
  private stealthCooldown = 10.0; // 10 second cooldown
  private isStealthing = false;

  // Public getter for stealth state
  public getIsStealthing(): boolean {
    return this.isStealthing;
  }
  private stealthStartTime = 0;
  private stealthDelayDuration = 0.5; // 0.5 second delay before invisibility
  private stealthInvisibilityDuration = 5.0; // 5 seconds of invisibility
  private isInvisible = false;
  
  // Sunder stack tracking - Map of entity ID to stack data
  private sunderStacks = new Map<number, { stacks: number; lastApplied: number; duration: number }>();

  // Burning stack tracking - Map of entity ID to stack data
  private burningStacks = new Map<number, { stacks: number; lastApplied: number; duration: number }>();

  // Active debuff effects tracking for PVP players - Map of entity ID to debuff data
  private activeDebuffEffects = new Map<number, { debuffType: string; startTime: number; duration: number }[]>();

  // Smite ability state (Runeblade)
  private lastSmiteTime = 0;
  private smiteCooldown = 2.0; // 2 second cooldown
  private isSmiting = false;

  // Colossus Strike ability state (Sword)
  private lastColossusStrikeTime = 0;
  private colossusStrikeCooldown = 5.0; // 2 second cooldown
  private isColossusStriking = false;

  // Wind Shear ability state (Sword)
  private lastWindShearTime = 0;
  private windShearCooldown = 2.0; // 2 second cooldown
  private isWindShearing = false;

  // Wind Shear charging state
  private isWindShearCharging = false;
  private windShearChargeProgress = 0;


  // DeathGrasp ability state (Runeblade)
  private lastDeathGraspTime = 0;
  private deathGraspCooldown = 5.0; // 5 second cooldown
  private isDeathGrasping = false;

  // WraithStrike ability state (Runeblade)
  private lastWraithStrikeTime = 0;
  private wraithStrikeCooldown = 3.0; // 3 second cooldown
  private isWraithStriking = false;

  // Corrupted Aura ability state (Runeblade)
  private corruptedAuraActive = false;
  private lastManaDrainTime = 0;
  private corruptedAuraRange = 2.0; 
  private corruptedAuraManaCost = 24; // 12 mana per second
  private corruptedAuraSlowEffect = 0.5; // 50% slow (multiply movement speed by this)
  private corruptedAuraSlowedEntities = new Map<number, boolean>(); // Track slowed entities

  // Store original rune counts to restore when corrupted aura deactivates
  private originalCriticalRunes = 0;
  private originalCritDamageRunes = 0;

  // Store base rune counts for Sabres passive (level-based only, not including passive bonus)
  private sabresBaseCriticalRunes = 0;
  private sabresPassiveCriticalBonus = 0; // Track how much the passive adds

  // Selected weapons mapping for hotkeys
  private selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null;

  // Damage number ID counter
  private nextDamageNumberId: number = 0;

  // Skill point system data
  private skillPointData: SkillPointData;

  // Titanheart passive tracking
  private titanheartMaxHealthApplied = false;

  // Death state tracking
  private isPlayerDead = false;

  constructor(
    camera: PerspectiveCamera,
    inputManager: InputManager,
    world: World,
    projectileSystem: ProjectileSystem,
    audioSystem?: AudioSystem | null,
    selectedWeapons?: {
      primary: WeaponType;
      secondary: WeaponType;
      tertiary?: WeaponType;
    } | null
  ) {
    super();
    this.camera = camera;
    this.inputManager = inputManager;
    this.world = world;
    this.projectileSystem = projectileSystem;
    this.audioSystem = audioSystem || null;
    this.selectedWeapons = selectedWeapons;
    this.deflectBarrier = new DeflectBarrier(world);
    this.priority = 5; // Run early for input handling

    // Initialize skill point system
    this.skillPointData = SkillPointSystem.getInitialSkillPointData();

    // Initialize weapon and subclass based on selected weapons
    this.currentWeapon = selectedWeapons?.primary || WeaponType.BOW;
    this.currentSubclass = this.getDefaultSubclassForWeapon(this.currentWeapon);

    // Set reference in DamageCalculator for passive ability checks
    setControlSystem(this);
  }

  private getDefaultSubclassForWeapon(weapon: WeaponType): WeaponSubclass {
    switch (weapon) {
      case WeaponType.SWORD:
        return WeaponSubclass.DIVINITY;
      case WeaponType.BOW:
        return WeaponSubclass.ELEMENTAL;
      case WeaponType.SCYTHE:
        return WeaponSubclass.CHAOS;
      case WeaponType.SABRES:
        return WeaponSubclass.FROST;
      case WeaponType.RUNEBLADE:
        return WeaponSubclass.ARCANE;
      default:
        return WeaponSubclass.ELEMENTAL;
    }
  }

  public setPlayer(entity: Entity): void {
    this.playerEntity = entity;
  }

  public setInputDisabled(disabled: boolean): void {
    this.inputDisabled = disabled;
  }

  public setAllowAllInput(allow: boolean): void {
    this.inputManager.setAllowAllInput(allow);
  }

  public update(entities: Entity[], deltaTime: number): void {
    if (!this.playerEntity) return;

    const playerTransform = this.playerEntity.getComponent(Transform);
    const playerMovement = this.playerEntity.getComponent(Movement);

    if (!playerTransform || !playerMovement) return;

    // If input is disabled (e.g., chat is open), skip input processing
    if (this.inputDisabled) return;

    // If player is dead, allow input processing but set movement to 0
    if (this.isPlayerDead) {
      // Update debuff states even when dead (for visual effects)
      if (typeof playerMovement.updateDebuffs === 'function') {
        playerMovement.updateDebuffs();
      }
      // Set movement velocity to 0 to prevent movement while dead
      playerMovement.velocity.set(0, 0, 0);
      // Continue with input processing below
    }

    // Update debuff states first
    if (typeof playerMovement.updateDebuffs === 'function') {
      playerMovement.updateDebuffs();
    }

    // Clean up expired Sunder stacks periodically
    this.cleanupSunderStacks();

    // Clean up expired Burning stacks periodically
    this.cleanupBurningStacks();

    // Handle weapon switching
    this.handleWeaponSwitching();

    // Handle dash movement first (overrides regular movement)
    this.handleDashMovement(playerMovement, playerTransform);

    // Handle charge movement (overrides regular movement)
    this.handleChargeMovement(playerMovement, playerTransform);

    // Handle player movement input (only prevent for abilities that truly override movement)
    // Most abilities should allow movement - only prevent for dashing, charging, and debuffs
    if (!playerMovement.isDashing && !playerMovement.isCharging && !playerMovement.isFrozen) {
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
  private weaponSwitchCooldown = 4; // 200ms cooldown to prevent rapid switching

  private handleWeaponSwitching(): void {
    // Prevent weapon switching while dead and waiting to respawn
    if (this.isPlayerDead) {
      return;
    }

    const currentTime = Date.now() / 1000;

    // Prevent rapid weapon switching
    if (currentTime - this.lastWeaponSwitchTime < this.weaponSwitchCooldown) {
      return;
    }

    // Handle weapon switching with number keys based on selected weapons
    if (this.inputManager.isKeyPressed('1') && this.selectedWeapons?.primary) {
      if (this.currentWeapon !== this.selectedWeapons.primary) {
        this.switchToWeapon(this.selectedWeapons.primary, currentTime);
      }
    } else if (this.inputManager.isKeyPressed('2') && this.selectedWeapons?.secondary) {
      if (this.currentWeapon !== this.selectedWeapons.secondary) {
        this.switchToWeapon(this.selectedWeapons.secondary, currentTime);
      }
    } else if (this.inputManager.isKeyPressed('3') && this.selectedWeapons?.tertiary) {
      if (this.currentWeapon !== this.selectedWeapons.tertiary) {
        this.switchToWeapon(this.selectedWeapons.tertiary, currentTime);
      }
    }
  }

  private switchToWeapon(weaponType: WeaponType, currentTime: number): void {
    this.resetAllAbilityStates(); // Reset all ability states when switching weapons
    this.resetAllPassiveEffects(); // Reset all passive effects when switching weapons

    // Update current weapon
    this.currentWeapon = weaponType;

    // Set appropriate subclass and fire rate based on weapon type
    switch (weaponType) {
      case WeaponType.SWORD:
        this.currentSubclass = WeaponSubclass.DIVINITY;
        this.fireRate = this.swordFireRate;
        this.swordComboStep = 1; // Reset combo when switching to sword
        break;
      case WeaponType.BOW:
        this.currentSubclass = WeaponSubclass.ELEMENTAL;
        this.fireRate = 0.225; // Bow fire rate
        break;
      case WeaponType.SCYTHE:
        this.currentSubclass = WeaponSubclass.CHAOS;
        this.fireRate = this.scytheFireRate;
        break;
      case WeaponType.SABRES:
        this.currentSubclass = WeaponSubclass.FROST;
        this.fireRate = this.sabresFireRate;
        break;
      case WeaponType.RUNEBLADE:
        this.currentSubclass = WeaponSubclass.ARCANE;
        this.fireRate = this.runebladeFireRate;
        this.swordComboStep = 1; // Reset combo when switching to runeblade
        break;
    }

    this.lastWeaponSwitchTime = currentTime;

    // Apply passive abilities for the new weapon
    this.applyPassiveAbilities(weaponType);
  }

  private applyPassiveAbilities(weaponType: WeaponType): void {
    // First, apply global passive effects that persist regardless of current weapon
    this.applyGlobalPassiveEffects();

    // Determine weapon slot
    let weaponSlot: 'primary' | 'secondary' | null = null;
    if (this.selectedWeapons) {
      if (weaponType === this.selectedWeapons.primary) {
        weaponSlot = 'primary';
      } else if (weaponType === this.selectedWeapons.secondary) {
        weaponSlot = 'secondary';
      }
    }

    if (!weaponSlot) return;

    // Apply weapon-specific passive effects
    switch (weaponType) {
      case WeaponType.SABRES:
        this.applySabresPassive(weaponSlot);
        break;
      case WeaponType.SWORD:
        this.applySwordPassive(weaponSlot);
        break;
      case WeaponType.BOW:
        this.applyBowPassive(weaponSlot);
        break;
      case WeaponType.SCYTHE:
        this.applyScythePassive(weaponSlot);
        break;
      case WeaponType.RUNEBLADE:
        this.applyRunebladePassive(weaponSlot);
        break;
    }
  }

  private applyGlobalPassiveEffects(): void {
    // Apply Titanheart max health bonus if unlocked anywhere
    const hasTitanheartPrimary = SkillPointSystem.isAbilityUnlocked(this.skillPointData, WeaponType.SWORD, 'P', 'primary');
    const hasTitanheartSecondary = SkillPointSystem.isAbilityUnlocked(this.skillPointData, WeaponType.SWORD, 'P', 'secondary');

    if ((hasTitanheartPrimary || hasTitanheartSecondary) && !this.titanheartMaxHealthApplied) {
      if (this.playerEntity) {
        const health = this.playerEntity.getComponent(Health);
        if (health) {
          // Store original max health if not already stored
          if (!health.hasOwnProperty('originalMaxHealth')) {
            (health as any).originalMaxHealth = health.maxHealth;
          }

          // Increase max health by 350 once
          health.setMaxHealth(health.maxHealth + 350);
          this.titanheartMaxHealthApplied = true;
        }
      }
    }
  }

  private applySabresPassive(weaponSlot: 'primary' | 'secondary'): void {
    if (this.isPassiveAbilityUnlocked('P', WeaponType.SABRES, weaponSlot)) {
      // Lethality: Increase movement speed from 3.65 to 4.25 and grant 10 critical strike chance runes
      if (this.playerEntity) {
        const movement = this.playerEntity.getComponent(Movement);
        if (movement) {
          // Store original speed if not already stored
          if (!movement.hasOwnProperty('originalMaxSpeed')) {
            (movement as any).originalMaxSpeed = movement.maxSpeed;
          }
          movement.maxSpeed = 4.25;
        }
      }

      // Store base critical rune count (level-based only) if not already stored for this passive
      if (this.sabresBaseCriticalRunes === 0) {
        const currentRuneCounts = getGlobalRuneCounts();
        // The base should be the current total minus any previous passive bonus
        this.sabresBaseCriticalRunes = currentRuneCounts.criticalRunes - this.sabresPassiveCriticalBonus;
      }

      // Add +10 critical runes as permanent passive bonus (only add if not already applied)
      if (this.sabresPassiveCriticalBonus === 0) {
        this.sabresPassiveCriticalBonus = 10;
        const currentRuneCounts = getGlobalRuneCounts();
        const newCriticalRunes = currentRuneCounts.criticalRunes + 10;
        setGlobalCriticalRuneCount(newCriticalRunes);
      }
    } else {
      // Reset to original state if passive is not unlocked
      this.resetSabresPassive();
    }
  }

  private resetSabresPassive(): void {
    if (this.playerEntity) {
      const movement = this.playerEntity.getComponent(Movement);
      if (movement && (movement as any).originalMaxSpeed) {
        movement.maxSpeed = (movement as any).originalMaxSpeed;
      }
    }

    // Remove the passive critical rune bonus (restore to base level-based runes only)
    if (this.sabresPassiveCriticalBonus > 0) {
      const currentRuneCounts = getGlobalRuneCounts();
      const newCriticalRunes = Math.max(0, currentRuneCounts.criticalRunes - this.sabresPassiveCriticalBonus);
      setGlobalCriticalRuneCount(newCriticalRunes);

      this.sabresPassiveCriticalBonus = 0;
      this.sabresBaseCriticalRunes = 0; // Reset stored values
    }
  }

  private applySwordPassive(weaponSlot: 'primary' | 'secondary'): void {
    // Check if Titanheart passive is unlocked for this sword slot
    const isTitanheartUnlocked = this.isPassiveAbilityUnlocked('P', WeaponType.SWORD, weaponSlot);

    if (this.playerEntity) {
      const health = this.playerEntity.getComponent(Health);
      if (health) {
        // Apply enhanced regeneration only when sword is currently equipped
        if (isTitanheartUnlocked) {
          // Store original regeneration values if not already stored
          if (!health.hasOwnProperty('originalRegenerationRate')) {
            (health as any).originalRegenerationRate = health.regenerationRate;
          }
          if (!health.hasOwnProperty('originalRegenerationDelay')) {
            (health as any).originalRegenerationDelay = health.regenerationDelay;
          }

          // Set regeneration to 30 HP per second after 5 seconds
          health.regenerationRate = 30.0;
          health.enableRegeneration(30.0, 5.0); // 5 second delay
        } else {
          // Reset regeneration to normal if sword is not equipped but Titanheart was previously active
          this.resetSwordRegeneration();
        }
      }
    }
  }

  private resetSwordPassive(): void {
    // Only reset regeneration, keep the max health bonus
    this.resetSwordRegeneration();

    // Note: We don't reset max health here - it stays permanently increased once Titanheart is unlocked
  }

  private resetSwordRegeneration(): void {
    if (this.playerEntity) {
      const health = this.playerEntity.getComponent(Health);
      if (health) {
        // Restore original regeneration settings if they were stored
        if ((health as any).originalRegenerationRate && (health as any).originalRegenerationDelay) {
          health.regenerationRate = (health as any).originalRegenerationRate;
          health.enableRegeneration((health as any).originalRegenerationRate, (health as any).originalRegenerationDelay);
        }
      }
    }
  }

  private applyBowPassive(weaponSlot: 'primary' | 'secondary'): void {
    // Sharpshooter: +5% critical hit chance (handled in DamageCalculator)
    // This is a global effect that doesn't need specific application
  }

  private applyScythePassive(weaponSlot: 'primary' | 'secondary'): void {
    // Soul Harvest: Gain 5 mana per enemy kill (handled in CombatSystem when enemies die)
    // This is a global effect that doesn't need specific application
  }

  private applyRunebladePassive(weaponSlot: 'primary' | 'secondary'): void {
    // Arcane Mastery: -10% mana costs (handled in mana consumption methods)
    // This is a global effect that doesn't need specific application
  }

  private resetAllPassiveEffects(): void {
    // Reset all passive effects to their base values
    this.resetSabresPassive();
    this.resetSwordPassive();
    // Bow, Scythe, and Runeblade passives are global and don't need resetting
  }

  private handleCombatInput(playerTransform: Transform): void {
    // Prevent combat actions while dead and waiting to respawn
    if (this.isPlayerDead) {
      return;
    }

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
    // Check if RAPIDFIRE passive is unlocked
    const hasRapidfirePassive = this.isPassiveAbilityUnlocked('P', WeaponType.BOW, this.currentWeapon === this.selectedWeapons?.primary ? 'primary' : 'secondary');

    // Handle Viper Sting ability with 'R' key
    if (this.inputManager.isKeyPressed('r') && !this.isViperStingCharging && !this.isCharging && this.isAbilityUnlocked('R')) {
      this.performViperSting(playerTransform);
    }

    // Handle Barrage ability with 'Q' key
    if (this.inputManager.isKeyPressed('q')) {

      if (!this.isBarrageCharging && !this.isCharging && !this.isViperStingCharging) {
        this.performBarrage(playerTransform);
      }
    }

    // Handle Cobra Shot ability with 'E' key
    if (this.inputManager.isKeyPressed('e') && this.isAbilityUnlocked('E')) {

      if (!this.isCharging && !this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging) {
        this.performCobraShot(playerTransform);
      }
    }

    // Handle Cloudkill ability with 'F' key
    if (this.inputManager.isKeyPressed('f') && this.isAbilityUnlocked('F')) {
      if (!this.isCharging && !this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging && !this.isCloudkillCharging) {
        this.performCloudkill(playerTransform);
      }
    }

    // Handle bow input based on whether RAPIDFIRE passive is unlocked
    if (hasRapidfirePassive) {
      // RAPIDFIRE MODE: Burst fire without charging
      // Ensure charging state is reset since we don't use charging in burst mode
      this.isCharging = false;
      this.chargeProgress = 0;

      if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button pressed
        const currentTime = performance.now() / 1000; // Convert to seconds

        // Check cooldown
        if (currentTime - this.lastBurstFireTime >= this.burstFireRate) {
          // Fire burst attack - use same direction calculation as regular projectiles
          // Get dragon's facing direction (same as camera direction since dragon faces camera)
          const direction = new Vector3();
          this.camera.getWorldDirection(direction);
          direction.normalize();

          // Apply downward angle compensation to account for restricted camera bounds
          const compensationAngle = Math.PI / 7; // 30 degrees downward compensation

          // Create a rotation matrix to apply the downward angle around the camera's right axis
          const cameraRight = new Vector3();
          cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();

          // Apply rotation around the right axis to tilt the direction downward
          const rotationMatrix = new Matrix4();
          rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
          direction.applyMatrix4(rotationMatrix);
          direction.normalize();

          this.fireBurstAttack(playerTransform.position, direction);
        }
      }
    } else {
      // NORMAL MODE: Charge-based firing
      if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button held
        if (!this.isCharging && !this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging && !this.isCloudkillCharging) {
          this.isCharging = true;
          this.chargeProgress = 0;

          // Play bow draw sound when starting to charge
          this.audioSystem?.playBowDrawSound(playerTransform.position);
        }
        // Increase charge progress (could be time-based)
        if (!this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging && !this.isCloudkillCharging) {
          this.chargeProgress = Math.min(this.chargeProgress + 0.0125, 1.0); // BOW CHARGE SPEED
        }
      } else if (this.isCharging) {
        // Check if any ability is charging - if so, cancel the regular bow shot
        if (this.isViperStingCharging || this.isBarrageCharging || this.isCobraShotCharging || this.isCloudkillCharging) {
          this.isCharging = false;
          this.chargeProgress = 0;
          return;
        }

        // Store charge progress before resetting for visual effects
        const finalChargeProgress = this.chargeProgress;

        // Stop the bow draw sound before playing release sound
        this.audioSystem?.stopSound('bow_draw');

        // Play bow release sound when firing
        this.audioSystem?.playBowReleaseSound(playerTransform.position, finalChargeProgress);

        // Release the bow
        this.fireProjectile(playerTransform);
        this.isCharging = false;
        this.chargeProgress = 0;

        // Trigger visual effects callback with the stored charge progress
        this.triggerBowReleaseEffects(finalChargeProgress);
      }
    }
  }

  private handleScytheInput(playerTransform: Transform): void {
    // Handle scythe left click for EntropicBolt
    if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button held
      if (!this.isCharging) {
        this.isCharging = true;
        this.chargeProgress = 0;

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
    if (this.inputManager.isKeyPressed('r') && !this.isCharging && !this.isCrossentropyCharging && this.isAbilityUnlocked('R')) {
      this.performCrossentropyAbility(playerTransform);
    }
    
    // Handle Reanimate ability with 'Q' key
    if (this.inputManager.isKeyPressed('q') && !this.isCharging) {
      this.performReanimateAbility(playerTransform);
    }
    
    // Handle Frost Nova ability with 'E' key
    if (this.inputManager.isKeyPressed('e') && !this.isCharging && this.isAbilityUnlocked('E')) {
      this.performFrostNovaAbility(playerTransform);
    }

    // Handle Summon Totem ability with 'F' key
    if (this.inputManager.isKeyPressed('f') && !this.isCharging && !this.isSummonTotemCharging && !this.isCrossentropyCharging && this.isAbilityUnlocked('F')) {
      this.performSummonTotemAbility(playerTransform);
    }
  }

  private fireProjectile(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastBowFireTime < this.fireRate) {
      return;
    }
    this.lastBowFireTime = currentTime;
    
    // Get dragon's facing direction (same as camera direction since dragon faces camera)
    // This ensures arrows fire outward from where the dragon is facing
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply downward angle compensation to account for restricted camera bounds
    // Since camera can't look down much due to bounds, we add a fixed downward angle
    const compensationAngle = Math.PI / 7; // 30 degrees downward compensation
    
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
    if (currentTime - this.lastScytheFireTime < this.scytheFireRate) {
      return;
    }
    this.lastScytheFireTime = currentTime;

    // Play entropic bolt sound (or cryoflame if passive unlocked)
    const weaponSlot: 'primary' | 'secondary' = this.currentWeapon === this.selectedWeapons?.primary ? 'primary' : 'secondary';
    const isCryoflameUnlocked = this.isPassiveAbilityUnlocked('P', WeaponType.SCYTHE, weaponSlot);
    if (isCryoflameUnlocked) {
      this.audioSystem?.playScytheCryoflameSound(playerTransform.position);
    } else {
      this.audioSystem?.playEntropicBoltSound(playerTransform.position);
    }

    // Get dragon's facing direction
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Apply downward angle compensation (same as bow projectiles)
    const compensationAngle = Math.PI / 7; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();

    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();

    const spinStatus = this.isCharging ? ' (SPINNING)' : '';

    this.createEntropicBoltProjectile(playerTransform.position.clone(), direction);
  }

  private performCrossentropyAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastCrossentropyTime < this.crossentropyFireRate) {
      return;
    }

    // Check if player has enough mana (40 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastCrossentropyBolt()) {
      return;
    }

    // Consume mana
    if (gameUI) {
      const manaBefore = gameUI.getCurrentMana();
      const manaConsumed = gameUI.consumeMana(40);
      if (!manaConsumed) {
        return;
      }
    }

    this.isCrossentropyCharging = true;
    this.crossentropyChargeProgress = 0;
    this.lastCrossentropyTime = currentTime;

    // Play crossentropy sound at the start of the ability
    this.audioSystem?.playCrossentropySound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 1000; // 1 second charge time

    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.crossentropyChargeProgress = Math.min(elapsed / chargeDuration, 1.0);

      if (this.crossentropyChargeProgress >= 1.0) {
        clearInterval(chargeInterval);
        this.fireCrossentropyBoltAbilityAfterCharge(playerTransform);
        this.isCrossentropyCharging = false;
        this.crossentropyChargeProgress = 0;
      }
    }, 16); // ~60fps updates
  }

  private fireCrossentropyBoltAbilityAfterCharge(playerTransform: Transform): void {
    // Rate limiting was already checked in performCrossentropyAbility()
    // No need to check again here - we just finished charging

    // Get dragon's facing direction
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Apply angle compensation (same as bow projectiles)
    const compensationAngle = Math.PI / 7; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();

    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();


    this.createCrossentropyBoltProjectile(playerTransform.position.clone(), direction);
  }

  private performSummonTotemAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSummonTotemTime < this.summonTotemFireRate) {
      return;
    }

    // Check if player has enough mana (75 mana cost for Summon Totem)
    const gameUI = (window as any).gameUI;
    if (gameUI) {
      const currentMana = gameUI.getCurrentMana();
      if (currentMana < 75) {
        return;
      }
    }

    // Consume mana
    if (gameUI) {
      const manaBefore = gameUI.getCurrentMana();
      const manaConsumed = gameUI.consumeMana(75);
      if (!manaConsumed) {
        return;
      }
    }

    this.lastSummonTotemTime = currentTime;

    // Play mantra sound when totem is summoned
    this.audioSystem?.playScytheMantraSound(playerTransform.getWorldPosition());

    // Get player's world position
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 0.825; // Summon at chest level

    // Trigger Summon Totem callback for remote players
    if (this.onSummonTotemCallback) {
      this.onSummonTotemCallback(playerPosition);
    }
  }

  private createWindShearProjectile(position: Vector3, direction: Vector3): Entity {
    if (!this.playerEntity) return null as any;

    // Offset projectile spawn position forward to avoid immediate collision with player or close enemies
    const spawnPosition = position.clone().add(direction.clone().multiplyScalar(2.0));

    // Wind Shear projectile config - 120 piercing damage, 15 unit range, increased speed
    const projectileConfig = {
      speed: 32.5, // Increased projectile speed by 30% (matches visual speed)
      damage: 120, // 120 piercing damage as requested
      lifetime: 2.0, // 2 seconds lifetime (enough for 15 units at 32.5 speed)
      piercing: true, // Piercing damage - hits multiple targets as it travels
      explosive: false,
      maxDistance: 15, // 15 unit range as requested
      projectileType: 'wind_shear', // Custom projectile type for identification
      sourcePlayerId: 'unknown' // Will be set by broadcasting system if needed
    };

    // Create the projectile entity
    const projectileEntity = this.projectileSystem.createProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      projectileConfig
    );

    // Mark as wind shear projectile for visual identification
    const renderer = projectileEntity.getComponent(Renderer) as Renderer;
    if (renderer?.mesh) {
      renderer.mesh.userData.projectileType = 'wind_shear';
    }

    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('wind_shear', spawnPosition, direction, projectileConfig);
    }

    return projectileEntity;
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
      opacity: 1.0,
      sourcePlayerId: this.playerEntity.userData?.playerId || 'unknown'
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

  private createBurstProjectile(position: Vector3, direction: Vector3): void {
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

    // Create burst projectile with higher damage
    const projectileConfig = {
      speed: 25,
      damage: 30, // Burst arrows deal 30 damage each
      lifetime: 3,
      maxDistance: 25, // Limit bow arrows to 25 units distance
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0,
      projectileType: 'burst_arrow', // Mark as burst arrow for teal coloring
      sourcePlayerId: this.playerEntity.userData?.playerId || 'unknown'
    };

    this.projectileSystem.createProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      projectileConfig
    );

    // Play bow release sound locally for Tempest Rounds burst
    this.audioSystem?.playBowReleaseSound(spawnPosition);

    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('burst_arrow', spawnPosition, direction, projectileConfig);
    }
  }

  private fireBurstAttack(position: Vector3, direction: Vector3): void {
    // Fire 3 projectiles in rapid succession with small delays
    const currentTime = performance.now() / 1000; // Convert to seconds

    // Fire first projectile immediately
    this.createBurstProjectile(position, direction);

    // Fire second projectile after 0.1 seconds
    setTimeout(() => {
      this.createBurstProjectile(position, direction);
    }, 100);

    // Fire third projectile after 0.2 seconds
    setTimeout(() => {
      this.createBurstProjectile(position, direction);
    }, 200);

    // Update burst fire cooldown
    this.lastBurstFireTime = currentTime;
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

    // Check if Cryoflame is unlocked for the current weapon
    const weaponSlot: 'primary' | 'secondary' = this.currentWeapon === this.selectedWeapons?.primary ? 'primary' : 'secondary';
    const isCryoflameUnlocked = this.isPassiveAbilityUnlocked('P', WeaponType.SCYTHE, weaponSlot);
    
    // Check if player has enough mana (15 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastEntropicBolt()) {
      return;
    }
    
    // Consume mana
    if (gameUI) {
      const manaConsumed = gameUI.consumeMana(10);
      if (!manaConsumed) {
        return;
      }
    }
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 1; // Slightly higher
    
    // Create EntropicBolt projectile using the new method
    const entropicConfig = {
      speed: 20, // Faster than CrossentropyBolt
      damage: isCryoflameUnlocked ? 45 : 20, // Cryoflame increases damage to 45
      lifetime: 2, // Shorter lifetime
      piercing: false, // Non-piercing so projectile gets destroyed on hit
      explosive: false, // No explosion effect
      explosionRadius: 0, // No explosion radius
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0,
      sourcePlayerId: this.playerEntity?.userData?.playerId || 'unknown',
      isCryoflame: isCryoflameUnlocked // Pass Cryoflame mode to projectile system
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

    // Note: Mana was already checked and consumed in performCrossentropyAbility()
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 1; // Slightly higher
    
    // Create CrossentropyBolt projectile using the existing method
    const crossentropyConfig = {
      speed: 25, // Slower than EntropicBolt
      damage: 140, // Base Crossentropy damage (matches PVP calculation)
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
      const manaConsumed = gameUI.consumeMana(30);
      if (!manaConsumed) {
        return;
      }
      const manaAfter = gameUI.getCurrentMana();
    }

    // Play sunwell sound when reanimate is cast
    this.audioSystem?.playScytheSunwellSound(playerTransform.getWorldPosition());

    // Always trigger the visual effect first, regardless of healing success
    this.triggerReanimateEffect(playerTransform);
    
    // Get player's health component and heal for 30 HP 
    const healthComponent = this.playerEntity.getComponent(Health);
    if (healthComponent) {
    const didHeal = healthComponent.heal(60); // REANIMATE HEAL AMOUNT
    }
  }

  private triggerReanimateEffect(playerTransform: Transform): void {
    // Trigger the visual healing effect

    if (this.onReanimateCallback) {
      this.onReanimateCallback();
    }

    // Create healing damage number above player head
    const playerPosition = playerTransform.position.clone();
    playerPosition.y += 1.5; // Position above player's head

    if (this.onDamageNumbersUpdate) {
      this.onDamageNumbersUpdate([{
        id: this.nextDamageNumberId.toString(),
        damage: 60, // Reanimate heals for 60 HP
        position: playerPosition,
        isCritical: false,
        timestamp: Date.now(),
        damageType: 'reanimate_healing'
      }]);
      this.nextDamageNumberId++;
    }

    // Broadcast healing in PVP mode
    if (this.onBroadcastHealing) {
      this.onBroadcastHealing(60, 'reanimate', playerPosition);
    }
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
    if (gameUI && !gameUI.canCastFrostNova(50)) {
      return;
    }
    
    // Consume mana
    if (gameUI) {
      const manaConsumed = gameUI.consumeMana(50);
      if (!manaConsumed) {
        return;
      }
    }
    
    this.lastFrostNovaTime = currentTime;

    // Play frost nova sound at the start of the ability
    this.audioSystem?.playFrostNovaSound(playerTransform.position);

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

    // Check if player has enough energy (50 energy cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastCobraShot(60)) {
      return;
    }

    // Consume energy
    if (gameUI) {
      gameUI.consumeEnergy(60);
    }

    this.isCobraShotCharging = true;
    this.cobraShotChargeProgress = 0;
    this.lastCobraShotTime = currentTime;

    // Play bow draw sound when starting to charge
    this.audioSystem?.playBowDrawSound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 750; // 0.75 second charge time (between Viper Sting and Barrage)
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.cobraShotChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.cobraShotChargeProgress >= 1.0) {
        clearInterval(chargeInterval);

        // Play cobra shot release sound when firing
        this.audioSystem?.playCobraShotReleaseSound(playerTransform.position);

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
    const compensationAngle = Math.PI / 7; // 30 degrees downward compensation
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
            return; // Skip this entity completely
          }
          
          const combatSystem = this.world.getSystem(CombatSystem);
          if (combatSystem && this.playerEntity && targetPlayerId) {
            const frostNovaDamage = 50; // Frost Nova damage
            combatSystem.queueDamage(entity, frostNovaDamage, this.playerEntity, 'frost_nova', this.playerEntity?.userData?.playerId);
            damagedPlayers++;
            
            // Broadcast freeze effect to the target player so they get frozen on their end
            if (this.onDebuffCallback) {
              this.onDebuffCallback(entity.id, 'frozen', 6000, entityPosition);
            }
          }
        }
      }
    });
    
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
        opacity: 1.0,
        sourcePlayerId: this.playerEntity?.userData?.playerId || 'unknown'
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
  
  
  public setProjectileCreatedCallback(callback: (projectileType: string, position: Vector3, direction: Vector3, config: any) => void): void {
    this.onProjectileCreatedCallback = callback;
  }
  
  public setViperStingCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onViperStingCallback = callback;
  }

  public setCloudkillCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onCloudkillCallback = callback;
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

  public setSummonTotemCallback(callback: (position: Vector3) => void): void {
    this.onSummonTotemCallback = callback;
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

  public setSmiteCallback(callback: (position: Vector3, direction: Vector3, onDamageDealt?: (totalDamage: number) => void) => void): void {
    this.onSmiteCallback = callback;
  }

  public setColossusStrikeCallback(callback: (position: Vector3, direction: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => void): void {
    this.onColossusStrikeCallback = callback;
  }

  public setWindShearCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onWindShearCallback = callback;
  }

  // Method to reduce Charge cooldown when WindShear hits a player
  public reduceChargeCooldownFromWindShear(playerId: string): void {
    const currentTime = Date.now() / 1000;
    const timeSinceLastCharge = currentTime - this.lastChargeTime;
    const remainingCooldown = Math.max(0, this.chargeCooldown - timeSinceLastCharge);

    if (remainingCooldown > 0) {
      // Reduce the cooldown by 4 seconds (or to 0 if less than 4 seconds remaining)
      const reductionAmount = Math.min(4.0, remainingCooldown);
      this.lastChargeTime -= reductionAmount; // Move the last charge time back to effectively reduce cooldown
    }
  }

  public setDeathGraspCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onDeathGraspCallback = callback;
  }

  public setWraithStrikeCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onWraithStrikeCallback = callback;
  }

  public setConsumeManaCallback(callback: (amount: number) => void): void {
    this.onConsumeManaCallback = callback;
  }

  public setCheckManaCallback(callback: (amount: number) => boolean): void {
    this.onCheckManaCallback = callback;
  }

  public setCreateSabreMistEffectCallback(callback: (position: Vector3) => void): void {
    this.onCreateSabreMistEffectCallback = callback;
  }

  public setStealthCallback(callback: (position: Vector3, isActivating: boolean) => void): void {
    this.onStealthCallback = callback;
  }

  public setBroadcastSabreMistCallback(callback: (position: Vector3, effectType: 'stealth' | 'skyfall') => void): void {
    this.onBroadcastSabreMistCallback = callback;
  }

  public setCreateLocalDebuffCallback(callback: (playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', position: Vector3, duration: number) => void): void {
    this.onCreateLocalDebuffCallback = callback;
  }

  public setHauntedSoulEffectCallback(callback: (position: Vector3) => void): void {
    this.onHauntedSoulEffectCallback = callback;
  }

  public setWindShearTornadoCallback(callback: (playerId: string, duration: number) => void): void {
    this.onWindShearTornadoCallback = callback;
  }

  public setBroadcastMeleeAttackCallback(callback: (attackType: string, position: Vector3, comboStep?: number) => void): void {
    this.onBroadcastMeleeAttackCallback = callback;
  }

  public setDamageNumbersCallback(callback: (damageNumbers: Array<{
    id: string;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    timestamp: number;
    damageType?: string;
  }>) => void): void {
    this.onDamageNumbersUpdate = callback;
  }

  public setBroadcastHealingCallback(callback: (healingAmount: number, healingType: string, position: Vector3) => void): void {
    this.onBroadcastHealing = callback;
  }

  public setDebuffCallback(callback: (targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', duration: number, position: Vector3) => void): void {
    // Store the original callback
    const originalCallback = callback;

    // Create a wrapper callback that also tracks debuffs internally
    this.onDebuffCallback = (targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', duration: number, position: Vector3) => {
      // Track the debuff effect internally for stun detection
      this.trackDebuffEffect(targetEntityId, debuffType, duration);

      // Call the original callback
      if (originalCallback) {
        originalCallback(targetEntityId, debuffType, duration, position);
      }
    };
  }

  public setLocalSocketId(socketId: string): void {
    this.localSocketId = socketId;
  }

  // Internal method to track debuff effects for stun detection
  private trackDebuffEffect(entityId: number, debuffType: string, duration: number): void {
    const currentTime = Date.now();
    const effect = {
      debuffType,
      startTime: currentTime,
      duration
    };

    // Get existing effects for this entity
    const existingEffects = this.activeDebuffEffects.get(entityId) || [];

    // Add the new effect
    existingEffects.push(effect);

    // Update the map
    this.activeDebuffEffects.set(entityId, existingEffects);

    // Schedule cleanup of expired effect
    setTimeout(() => {
      const currentEffects = this.activeDebuffEffects.get(entityId) || [];
      const filteredEffects = currentEffects.filter(e => e !== effect);
      if (filteredEffects.length === 0) {
        this.activeDebuffEffects.delete(entityId);
      } else {
        this.activeDebuffEffects.set(entityId, filteredEffects);
      }
    }, duration);
  }

  // Method to check if a player/entity is currently stunned or frozen
  private isPlayerStunned(entityId: number): boolean {
    const currentTime = Date.now();
    const effects = this.activeDebuffEffects.get(entityId);

    if (!effects) return false;

    // Check if any active effect is a stun or freeze effect
    return effects.some(effect =>
      (effect.debuffType === 'stunned' || effect.debuffType === 'frozen') &&
      (currentTime - effect.startTime) < effect.duration
    );
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

  /**
   * Get the camera's vertical aim angle (pitch).
   * Returns a normalized value from -1 (looking up) to 1 (looking down).
   * This is used for the bow aimer to show where arrows will land.
   */
  public getCameraVerticalAim(): number {
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    // The y-component of the normalized direction tells us the pitch
    // Negative y = looking up, Positive y = looking down
    // We return -direction.y to make positive = up, negative = down in screen space
    return -direction.y;
  }

  /**
   * Get the camera's zoom distance.
   * Returns the current distance from camera to player (2 to 12.5).
   * This is used for the bow aimer to adjust for zoom level.
   */
  public getCameraDistance(): number {
    const cameraSystem = (window as any).cameraSystem;
    if (cameraSystem && typeof cameraSystem.getDistance === 'function') {
      return cameraSystem.getDistance();
    }
    return 8; // Default distance if camera system not available
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

  public isCloudkillChargingActive(): boolean {
    return this.isCloudkillCharging;
  }

  public getCloudkillChargeProgress(): number {
    return this.cloudkillChargeProgress;
  }

  public isCrossentropyChargingActive(): boolean {
    return this.isCrossentropyCharging;
  }

  public getCrossentropyChargeProgress(): number {
    return this.crossentropyChargeProgress;
  }

  public isSummonTotemChargingActive(): boolean {
    return this.isSummonTotemCharging;
  }

  public getSummonTotemChargeProgress(): number {
    return this.summonTotemChargeProgress;
  }

  public isWeaponSwinging(): boolean {
    return this.isSwinging;
  }

  // Sword-specific getters
  public getSwordComboStep(): 1 | 2 | 3 {
    return this.swordComboStep;
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
  
  public isStealthActive(): boolean {
    return this.isStealthing;
  }
  
  public isPlayerInvisible(): boolean {
    return this.isInvisible;
  }

  public isSmiteActive(): boolean {
    return this.isSmiting;
  }

  public isColossusStrikeActive(): boolean {
    return this.isColossusStriking;
  }

  public isWindShearActive(): boolean {
    return this.isWindShearing;
  }

  public isWindShearChargingActive(): boolean {
    return this.isWindShearCharging;
  }

  public getWindShearChargeProgress(): number {
    return this.windShearChargeProgress;
  }

  public isDeathGraspActive(): boolean {
    return this.isDeathGrasping;
  }

  public isWraithStrikeActive(): boolean {
    return this.isWraithStriking;
  }

  public isCorruptedAuraActive(): boolean {
    return this.corruptedAuraActive;
  }


  private handleSwordInput(playerTransform: Transform): void {
    // Handle sword melee attacks
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isSwordCharging && !this.isDeflecting) { // Left mouse button
      this.performSwordMeleeAttack(playerTransform);
    }


    // Handle Charge ability with 'E' key
    if (this.inputManager.isKeyPressed('e') && !this.isSwordCharging && !this.isSwinging && !this.isDeflecting && this.isAbilityUnlocked('E')) {
      this.performCharge(playerTransform);
    }

    // Handle Deflect ability with 'Q' key
    if (this.inputManager.isKeyPressed('q') && !this.isDeflecting && !this.isSwinging && !this.isSwordCharging) {
      this.performDeflect(playerTransform);
    }

    // Handle Colossus Strike ability with 'R' key
    if (this.inputManager.isKeyPressed('r') && !this.isColossusStriking && !this.isSwinging && !this.isSwordCharging && !this.isDeflecting && this.isAbilityUnlocked('R')) {
      this.performColossusStrike(playerTransform);
    }

    // Handle Wind Shear ability with 'F' key
    if (this.inputManager.isKeyPressed('f') && !this.isWindShearing && !this.isSwinging && !this.isSwordCharging && !this.isDeflecting && !this.isColossusStriking && this.isAbilityUnlocked('F')) {
      this.performWindShear(playerTransform);
    }

    // Check for combo reset
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSwordAttackTime > this.swordComboResetTime) {
      this.swordComboStep = 1;
    }
  }

  private handleRunebladeInput(playerTransform: Transform): void {
    // Handle runeblade melee attacks
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isSmiting && !this.isDeathGrasping && !this.isWraithStriking) { // Left mouse button
      this.performRunebladeMeleeAttack(playerTransform);
    }

    // Handle Smite ability with 'R' key
    if (this.inputManager.isKeyPressed('r') && !this.isSmiting && !this.isSwinging && !this.isDeathGrasping && !this.isWraithStriking && this.isAbilityUnlocked('R')) {
      this.performSmite(playerTransform);
    }

    // Handle DeathGrasp ability with 'Q' key
    if (this.inputManager.isKeyPressed('q') && !this.isDeathGrasping && !this.isSmiting && !this.isSwinging && !this.isWraithStriking) {
      this.performDeathGrasp(playerTransform);
    }

    // Handle Corrupted Aura ability with 'F' key (just pressed detection)
    if (this.inputManager.isKeyPressed('f') && !this.isSmiting && !this.isSwinging && !this.isDeathGrasping && !this.isWraithStriking && this.isAbilityUnlocked('F')) {
      // Track if F key was just pressed (not held down)
      if (!this.fKeyWasPressed) {
        this.toggleCorruptedAura(playerTransform);
        this.fKeyWasPressed = true;
      }
    } else {
      // Reset the just pressed flag when F key is released
      this.fKeyWasPressed = false;
    }

    // Handle WraithStrike ability with 'E' key
    if (this.inputManager.isKeyPressed('e') && !this.isWraithStriking && !this.isSmiting && !this.isSwinging && !this.isDeathGrasping && this.isAbilityUnlocked('E')) {
      this.performWraithStrike(playerTransform);
    }

    // Handle Corrupted Aura effects while active
    if (this.corruptedAuraActive) {
      this.updateCorruptedAuraEffects(playerTransform);
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
    if (currentTime - this.lastSwordFireTime < this.swordFireRate) {
      return;
    }
    this.lastSwordFireTime = currentTime;
    this.lastSwordAttackTime = currentTime;

    // Play sword swing sound based on current combo step
    this.audioSystem?.playSwordSwingSound(this.swordComboStep, playerTransform.position);

    // Set swinging state - completion will be handled by sword component callback
    // Animation state broadcasting will handle sound synchronization for other players
    this.isSwinging = true;

    // Perform melee damage in a cone in front of player
    this.performMeleeDamage(playerTransform);

    // Note: Swing completion and combo advancement is now handled by onSwordSwingComplete callback
  }

  private performRunebladeMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking (use runeblade-specific fire rate)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastRunebladeFireTime < this.runebladeFireRate) {
      return;
    }
    this.lastRunebladeFireTime = currentTime;
    this.lastSwordAttackTime = currentTime;

    // Play sword swing sound based on current combo step (same as sword)
    this.audioSystem?.playSwordSwingSound(this.swordComboStep, playerTransform.position);

    // Set swinging state - completion will be handled by runeblade component callback
    // Animation state broadcasting will handle sound synchronization for other players
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
      return;
    }

    this.lastSmiteTime = currentTime;
    this.isSmiting = true;

    // Play smite sound
    this.audioSystem?.playRunebladeSmiteSound(playerTransform.position);

    // Stop player movement immediately when casting Smite
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        playerMovement.velocity.x = 0;
        playerMovement.velocity.z = 0;
        playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      }
    }

    // Consume mana (35 mana)
    if (gameUI) {
      const manaBefore = gameUI.getCurrentMana();
      const manaConsumed = gameUI.consumeMana(45);
      if (!manaConsumed) {
        return;
      }
      const manaAfter = gameUI.getCurrentMana();
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

    // Trigger smite callback with healing callback
    if (this.onSmiteCallback) {
      this.onSmiteCallback(smitePosition, direction, (totalDamage: number) => {
        // Handle healing based on the actual damage dealt by the visual component
        if (totalDamage > 0) {
          this.performSmiteHealing(totalDamage);
        }
      });
    }

    // Reset smiting state after animation duration (same as the Smite component)
    setTimeout(() => {
      this.isSmiting = false;
    }, 1000); // 1.0 seconds matches the original animation duration
  }

  private performColossusStrike(playerTransform: Transform): void {
    // Check if using Sword
    if (this.currentWeapon !== WeaponType.SWORD) {
      return;
    }

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastColossusStrikeTime < this.colossusStrikeCooldown) {
      return; // Still on cooldown
    }

    // Check if already colossus striking
    if (this.isColossusStriking) {
      return;
    }

    // Check minimum rage requirement (25 rage minimum)
    const gameUI = (window as any).gameUI;
    if (gameUI && gameUI.getCurrentRage() < 25) {
      return;
    }

    // Consume all rage and calculate damage
    const rageConsumed = gameUI ? gameUI.getCurrentRage() : 0;
    if (gameUI) {
      gameUI.consumeAllRage();
    }

    // Calculate damage: 100 base + (30 * floor(rageConsumed / 5))
    const extraDamage = Math.floor(rageConsumed / 5) * 30;
    const totalDamage =  extraDamage;

    this.lastColossusStrikeTime = currentTime;
    this.isColossusStriking = true;

    // Play colossus strike sound at the start of the ability
    this.audioSystem?.playColossusStrikeSound(playerTransform.position);

    // Stop player movement immediately when casting Colossus Strike
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        playerMovement.velocity.x = 0;
        playerMovement.velocity.z = 0;
        playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      }
    }

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Offset the colossus strike position slightly forward to look like it's coming from the sword swing
    const strikePosition = position.clone().add(direction.clone().multiplyScalar(2.5));

    // Trigger colossus strike callback with calculated damage
    if (this.onColossusStrikeCallback) {
      this.onColossusStrikeCallback(strikePosition, direction, totalDamage, (damageDealtFlag: boolean) => {
        // Handle any effects when damage is dealt by the visual component
      });
    }

    // Reset colossus striking state after animation duration (same as the ColossusStrike component)
    setTimeout(() => {
      this.isColossusStriking = false;
    }, 1200); // 1.2 seconds matches the updated animation duration
  }

  private performWindShear(playerTransform: Transform): void {
    // Check if using Sword
    if (this.currentWeapon !== WeaponType.SWORD) {
      return;
    }

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastWindShearTime < this.windShearCooldown) {
      return; // Still on cooldown
    }

    // Check if already wind shearing or charging
    if (this.isWindShearing || this.isWindShearCharging) {
      return;
    }

    // Check if player has enough rage (10 rage cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastWindShear()) {
      return;
    }

    // Consume rage
    if (gameUI) {
      gameUI.consumeRage(10);
    }

    this.isWindShearCharging = true;
    this.windShearChargeProgress = 0;
    this.lastWindShearTime = currentTime;

    // Play windshear sound for the duration of the charge
    this.audioSystem?.playWindshearSound(playerTransform.position);

    // Trigger tornado effect (1.25 seconds duration)
    if (this.onWindShearTornadoCallback) {
      const playerId = this.localSocketId || 'local'; // Use actual socket ID if available, fallback to 'local'
      this.onWindShearTornadoCallback(playerId, 1250); // 1.25 seconds
    }

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 1000; // 0.75 second charge time

    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.windShearChargeProgress = Math.min(elapsed / chargeDuration, 1.0);

      if (this.windShearChargeProgress >= 1.0) {
        clearInterval(chargeInterval);
        this.fireWindShear(playerTransform);
        this.isWindShearCharging = false;
        this.windShearChargeProgress = 0;
      }
    }, 16); // ~60fps updates
  }

  private fireWindShear(playerTransform: Transform): void {
    this.isWindShearing = true;

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);

    // Keep direction horizontal (remove Y component to fire on flat plane)
    direction.y = 0;
    direction.normalize();

    // Set position to chest level (player position + 1 unit up)
    const chestLevelPosition = position.clone();
    chestLevelPosition.y += 1.0;

    // Offset the wind shear position slightly forward from chest level
    const shearPosition = chestLevelPosition.add(direction.clone().multiplyScalar(1.5));

    // Trigger wind shear visual effect via callback
    if (this.onWindShearCallback) {
      this.onWindShearCallback(shearPosition, direction);
    }

    // Also create ECS projectile for damage calculations
    this.createWindShearProjectile(shearPosition, direction);

    // Reset the wind shearing state after a short delay
    setTimeout(() => {
      this.isWindShearing = false;
    }, 200); // 200ms delay to prevent spamming
  }

  private performSmiteDamage(smitePosition: Vector3): { damageDealt: boolean; totalDamage: number } {
    if (!this.playerEntity) return { damageDealt: false, totalDamage: 0 };

    const baseSmiteDamage = 100;
    const damageRadius = 3.0; // Small radius around impact location
    let damageDealt = false;
    let totalDamage = 0;

    // Get all entities in the world to check for enemies/players
    const allEntities = this.world.getAllEntities();

    allEntities.forEach(entity => {
      if (entity.id === this.playerEntity?.id) return; // Don't damage self

      const entityTransform = entity.getComponent(Transform);
      const entityHealth = entity.getComponent(Health);

      if (!entityTransform || !entityHealth || entityHealth.isDead) return;

      const distance = smitePosition.distanceTo(entityTransform.position);

      if (distance <= damageRadius) {
        // Entity is within damage radius - calculate actual damage and queue it
        const combatSystem = this.world.getSystem(CombatSystem);
        if (combatSystem && this.playerEntity) {
          // Calculate actual damage with critical hit mechanics
          const damageResult: DamageResult = calculateDamage(baseSmiteDamage, this.currentWeapon);
          const actualDamage = damageResult.damage;

          combatSystem.queueDamage(entity, actualDamage, this.playerEntity, 'smite', this.playerEntity?.userData?.playerId);
          damageDealt = true;
          totalDamage += actualDamage;
        }
      }
    });

    // NOTE: PVP player damage detection is now handled by the Smite visual component
    // to prevent double damage. The visual component properly handles PVP damage
    // through the broadcastPlayerDamage system.

    return { damageDealt, totalDamage };
  }

  private performSmiteHealing(healingAmount: number): void {
    if (!this.playerEntity) {
      return;
    }

    // Get player's health component and heal for the actual damage dealt
    const healthComponent = this.playerEntity.getComponent(Health);
    if (healthComponent) {
      const oldHealth = healthComponent.currentHealth;
      const maxHealth = healthComponent.maxHealth;

      // Always attempt to heal, even if at full health (heal method handles this)
      const didHeal = healthComponent.heal(healingAmount); // Smite healing amount based on damage dealt

      if (didHeal) {
        // Create healing damage number above player head
        const playerTransform = this.playerEntity.getComponent(Transform);
        if (playerTransform && this.onDamageNumbersUpdate) {
          const healingPosition = playerTransform.position.clone();
          healingPosition.y += 1.5; // Position above player's head

          this.onDamageNumbersUpdate([{
            id: this.nextDamageNumberId.toString(),
            damage: healingAmount, // Smite heals for the actual damage dealt
            position: healingPosition,
            isCritical: false,
            timestamp: Date.now(),
            damageType: 'smite_healing'
          }]);
          this.nextDamageNumberId++;

          // Broadcast healing in PVP mode
          if (this.onBroadcastHealing) {
            this.onBroadcastHealing(healingAmount, 'smite', healingPosition);
          }
        }
      }
    } else {
      // Fallback: Try to heal through gameUI if health component is not available
      try {
        const gameUI = (window as any).gameUI;
        if (gameUI && typeof gameUI.gainHealth === 'function') {
          gameUI.gainHealth(healingAmount);
        }
      } catch (error) {
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

    // Check if player has enough mana (35 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastDeathGrasp()) {
      return;
    }

    this.lastDeathGraspTime = currentTime;
    this.isDeathGrasping = true;

    // Play void grasp sound
    this.audioSystem?.playRunebladeVoidGraspSound(playerTransform.position);

    // Stop player movement immediately when casting Death Grasp
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        playerMovement.velocity.x = 0;
        playerMovement.velocity.z = 0;
        playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      }
    }

    // Consume mana (35 mana)
    if (gameUI) {
      const manaBefore = gameUI.getCurrentMana();
      const manaConsumed = gameUI.consumeMana(35);
      if (!manaConsumed) {
        return;
      }
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

  private performWraithStrike(playerTransform: Transform): void {
    // Check if using Runeblade
    if (this.currentWeapon !== WeaponType.RUNEBLADE) {
      return;
    }

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastWraithStrikeTime < this.wraithStrikeCooldown) {
      return; // Still on cooldown
    }

    // Check if already wraith striking
    if (this.isWraithStriking) {
      return;
    }

    // Check if player has enough mana (35 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastWraithStrike()) {
      return;
    }

    this.lastWraithStrikeTime = currentTime;
    this.isWraithStriking = true;

    // Play wraithblade sound
    this.audioSystem?.playRunebladeWraithbladeSound(playerTransform.position);

    // Stop player movement immediately when casting Wraith Strike
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        playerMovement.velocity.x = 0;
        playerMovement.velocity.z = 0;
        playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      }
    }

    // Consume mana (35 mana)
    if (gameUI) {
      const manaBefore = gameUI.getCurrentMana();
      const manaConsumed = gameUI.consumeMana(35);
      if (!manaConsumed) {
        return;
      }
    }

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Perform wraith strike damage and apply corrupted debuff
    this.performWraithStrikeDamage(playerTransform);

    // Trigger wraith strike callback
    if (this.onWraithStrikeCallback) {
      this.onWraithStrikeCallback(position, direction);
    }

    // Reset wraith striking state after animation duration (same as 2nd swing)
    setTimeout(() => {
      this.isWraithStriking = false;
    }, 750); // 0.75 seconds matches the 2nd swing animation duration
  }

  private performWraithStrikeDamage(playerTransform: Transform): void {
    // Get all entities in the world to check for enemies/players
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;
    
    // Get player facing direction (camera direction)
    const playerDirection = new Vector3();
    this.camera.getWorldDirection(playerDirection);
    playerDirection.normalize();
    
    const wraithStrikeRange = 4.5; // Same range as melee attacks
    const wraithStrikeAngle = Math.PI / 2; // 90 degree cone
    const wraithStrikeDamage = 85; // High damage for wraith strike
    
    let hitCount = 0;
    const currentTime = Date.now() / 1000;
    
    for (const entity of allEntities) {
      if (entity === this.playerEntity) continue;
      
      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);
      
      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
      
      // Check if target is in range
      const distance = playerPosition.distanceTo(targetTransform.position);
      if (distance > wraithStrikeRange) continue;
      
      // Check if target is in front of player (cone attack)
      const directionToTarget = new Vector3()
        .subVectors(targetTransform.position, playerPosition)
        .normalize();
      
      const dotProduct = playerDirection.dot(directionToTarget);
      const angleThreshold = Math.cos(wraithStrikeAngle / 2);
      
      if (dotProduct < angleThreshold) continue;
      
      // Apply damage
      const combatSystem = this.world.getSystem(CombatSystem);
      if (combatSystem) {
        combatSystem.queueDamage(entity, wraithStrikeDamage, this.playerEntity!, 'wraith_strike', this.playerEntity?.userData?.playerId);
        hitCount++;
        
        // Apply Corrupted debuff
        this.applyCorruptedDebuff(entity, targetTransform.position, currentTime);
      }
    }
  }

  private applyCorruptedDebuff(entity: Entity, position: Vector3, currentTime: number): void {
    const enemy = entity.getComponent(Enemy);
    
    if (enemy) {
      // This is an enemy - apply corrupted debuff directly
      enemy.applyCorrupted(8.0, currentTime); // 8 second duration
      
      // Trigger haunted soul visual effect
      this.triggerHauntedSoulEffect(position);
    } else {
      // This is likely another player in PVP mode - broadcast corrupted debuff
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
            // Broadcast corrupted effect to the target player
            if (this.onDebuffCallback) {
              this.onDebuffCallback(entity.id, 'corrupted', 8000, position); // 8 seconds in milliseconds
            }
        
        // Trigger haunted soul visual effect
        this.triggerHauntedSoulEffect(position);
      }
    }
  }

  private triggerHauntedSoulEffect(position: Vector3): void {
    // Trigger haunted soul visual effect through callback
    
    // Call the haunted soul effect callback if available
    if (this.onHauntedSoulEffectCallback) {
      this.onHauntedSoulEffectCallback(position);
    }
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

  // Called by sword component when colossus strike animation completes
  public onColossusStrikeComplete(): void {
    if (!this.isColossusStriking) return; // Prevent multiple calls

    // Reset colossus striking state
    this.isColossusStriking = false;
  }

  // Called by runeblade component when death grasp animation completes
  public onDeathGraspComplete(): void {
    if (!this.isDeathGrasping) return; // Prevent multiple calls

    // Reset death grasping state
    this.isDeathGrasping = false;
  }

  // Called by runeblade component when wraith strike animation completes
  public onWraithStrikeComplete(): void {
    if (!this.isWraithStriking) return; // Prevent multiple calls

    // Reset wraith striking state
    this.isWraithStriking = false;
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
    if (this.inputManager.isKeyPressed('e') && !this.isSkyfalling && !this.isSundering && this.isAbilityUnlocked('E')) {
      // Allow Sunder even while swinging - it should be usable during combat
      this.performSunder(playerTransform);
    }

    // Handle R key for Skyfall ability (switched from E)
    if (this.inputManager.isKeyPressed('r') && !this.isSkyfalling && !this.isSundering && this.isAbilityUnlocked('R')) {
      this.performSkyfall(playerTransform);
    }
    
    // Handle F key for Stealth ability
    if (this.inputManager.isKeyPressed('f') && !this.isSwinging && !this.isSkyfalling && !this.isSundering && !this.isBackstabbing && !this.isStealthing && this.isAbilityUnlocked('F')) {
      this.performStealth(playerTransform);
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
    
    // Update Stealth state if active
    if (this.isStealthing) {
      this.updateStealthState(playerTransform);
    }
  }

  private performSabresMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking (use sabres-specific fire rate)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSabresFireTime < this.sabresFireRate) {
      return;
    }
    this.lastSabresFireTime = currentTime;

    // Play sabres swing sound
    this.audioSystem?.playSabresSwingSound(playerTransform.position);

    // Set swinging state - completion will be handled by sabres component callback
    // Animation state broadcasting will handle sound synchronization for other players
    this.isSwinging = true;

    // Perform melee damage in a cone in front of player (dual attack)
    this.performSabresMeleeDamage(playerTransform);
  }

  // Called by sabres component when swing animation completes
  public onSabresSwingComplete(): void {
    if (!this.isSwinging) return; // Prevent multiple calls

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
    const attackRange = 3.8;
    const attackAngle = Math.PI / 2;
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
        combatSystem.queueDamage(target, leftSabreDamage, this.playerEntity || undefined, 'sabre_left', this.playerEntity?.userData?.playerId);
        
        // Right sabre hit (with small delay)
        setTimeout(() => {
          if (!targetHealth.isDead) {
            combatSystem.queueDamage(target, rightSabreDamage, this.playerEntity || undefined, 'sabre_right', this.playerEntity?.userData?.playerId);
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

    // Play skyfall sound
    this.audioSystem?.playSabresSkyfallSound(playerTransform.position);

    // Set target height (double jump height)
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (playerMovement) {
      this.skyfallOriginalGravity = playerMovement.gravity;
      this.skyfallTargetHeight = playerTransform.position.y + (playerMovement.jumpForce * 1.4); // Reduced height by 30% (was 2x, now 1.4x)
            
      // Apply upward velocity
      playerMovement.velocity.y = playerMovement.jumpForce * 2.0; // Stronger initial velocity
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

    // Create Sabre Reaper Mist effect at player position
    if (this.onCreateSabreMistEffectCallback) {
      this.onCreateSabreMistEffectCallback(playerTransform.position.clone());
    } 
    // Broadcast mist effect to other players in PVP
    if (this.onBroadcastSabreMistCallback) {
      this.onBroadcastSabreMistCallback(playerTransform.position.clone(), 'skyfall');
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
    
    // Safety timeout (end after 5 seconds)
    if (elapsedTime > 4.0) {
      this.completeSkyfallAbility(playerTransform);
    }
  }
  
  private performSkyfallLanding(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000; // Define currentTime for stun effects

    // Deal damage to enemies in landing area
    const allEntities = this.world.getAllEntities();
    const landingPosition = playerTransform.position;
    const damageRadius = 4.0; // 4 unit radius
    const skyfallDamage = 125; // SKYFALL DAMAGE

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
          combatSystem.queueDamage(entity, skyfallDamage, this.playerEntity || undefined, 'skyfall', this.playerEntity?.userData?.playerId);
          hitCount++;

          // Apply stun effect (2 seconds) to enemies hit by Skyfall
          const enemy = entity.getComponent(Enemy);
          if (enemy) {
            enemy.freeze(2.0, currentTime); // 2 second stun using freeze mechanics
          } else {
            // apply stun debuff
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

            // Broadcast debuff to other players (but not ourselves)
            if (targetPlayerId && targetPlayerId !== localSocketId) {
              // Broadcast stun effect to the target player
              if (this.onDebuffCallback) {
                this.onDebuffCallback(entity.id, 'stunned', 2000, targetTransform.position);
              }
            }

            // Create local debuff effect so the caster can see the stun on the enemy
            if (this.onCreateLocalDebuffCallback && targetPlayerId) {
              this.onCreateLocalDebuffCallback(targetPlayerId, 'stunned', targetTransform.position, 2000);
            }
          }
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
    this.sunderDamageApplied = false; // Reset damage flag for new sunder

    // Play flourish sound
    this.audioSystem?.playSabresFlourishSound(playerTransform.position);

    // Don't perform damage immediately - wait for the right moment in animation
    // This ensures damage happens during the actual sunder animation, not just at the start
  }
  
  private updateSunderState(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const elapsedTime = currentTime - this.sunderStartTime;
    
    // Apply damage at the right moment in the animation (30% through, like backstab)
    const damageTimingPercent = 0.3; // 30% through the animation
    const damageWindow = this.sunderDuration * damageTimingPercent;
    const damageWindowEnd = damageWindow + 0.1; // Small window to ensure damage is applied
    
    if (elapsedTime >= damageWindow && elapsedTime <= damageWindowEnd) {
      // Only apply damage once during this window
      if (!this.sunderDamageApplied) {
        this.performSunderDamage(playerTransform);
        this.sunderDamageApplied = true;
      }
    }
    
    // Check if sunder animation duration has elapsed
    if (elapsedTime >= this.sunderDuration) {
      this.isSundering = false;
      this.sunderDamageApplied = false; // Reset for next use
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
          'sunder',
          this.playerEntity?.userData?.playerId
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
            
            // Broadcast debuff to other players (but not ourselves)
          if (targetPlayerId && targetPlayerId !== localSocketId) {
            this.onDebuffCallback(entity.id, 'stunned', 4000, targetTransform.position);
          }

          // Create local debuff effect so the local player can see the stun on the enemy
          if (this.onCreateLocalDebuffCallback && targetPlayerId) {
            this.onCreateLocalDebuffCallback(targetPlayerId, 'stunned', targetTransform.position, 4000);
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

  // Apply burning stack and calculate damage bonus
  public getBurningStacks(targetId: number): number {
    const currentStacks = this.burningStacks.get(targetId);
    return currentStacks ? currentStacks.stacks : 0;
  }

  public applyBurningStack(entityId: number, currentTime: number, isEntropicBolt: boolean = true): { damageBonus: number; stackCount: number } {
    const stackDuration = 5.0; // 5 seconds
    const maxStacks = 5; // Maximum 5 stacks (reduced from 15)
    let currentStacks = this.burningStacks.get(entityId);
    
    // Clean up expired stacks or initialize new entry
    if (!currentStacks || (currentTime - currentStacks.lastApplied) > stackDuration) {
      currentStacks = { stacks: 0, lastApplied: currentTime, duration: stackDuration };
    }
    
    // Calculate damage bonus based on current stack count (before adding new stack)
    let damageBonus = 0;
    if (isEntropicBolt) {
      // Entropic Bolt: +2 damage per stack (5 max stacks = 20-30 damage range)
      damageBonus = currentStacks.stacks * 2;
    } else {
      // Crossentropy Bolt: +20 damage per stack (increased from +10 to match CombatSystem calculation)
      damageBonus = currentStacks.stacks * 20;
    }
    
    let newStackCount = currentStacks.stacks;
    
    // Apply new stack (up to maximum)
    if (currentStacks.stacks < maxStacks) {
      newStackCount = currentStacks.stacks + 1;
      this.burningStacks.set(entityId, {
        stacks: newStackCount,
        lastApplied: currentTime,
        duration: stackDuration
      });
    } else {
      // At max stacks, just refresh the duration
      this.burningStacks.set(entityId, {
        stacks: maxStacks,
        lastApplied: currentTime,
        duration: stackDuration
      });
      newStackCount = maxStacks;
    }
    
    // Broadcast burning debuff effect in PVP mode
    if (this.onDebuffCallback && newStackCount > 0) {
      // Find the entity to get its position
      const targetEntity = this.world.getEntity(entityId);
      if (targetEntity) {
        const transform = targetEntity.getComponent(Transform);
        if (transform) {
          // Create a position with stack count information
          const positionWithStacks = transform.position.clone();
          (positionWithStacks as any).stackCount = newStackCount; // Attach stack count to position
          this.onDebuffCallback(entityId, 'burning', stackDuration * 1000, positionWithStacks);
        }
      }
    }
    
    return { damageBonus, stackCount: newStackCount };
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

  // Clean up expired Burning stacks periodically
  private cleanupBurningStacks(): void {
    const currentTime = Date.now() / 1000;
    const stackDuration = 5.0;
    
    // Convert to array to avoid iteration issues
    const entries = Array.from(this.burningStacks.entries());
    for (const [entityId, stackData] of entries) {
      if ((currentTime - stackData.lastApplied) > stackDuration) {
        this.burningStacks.delete(entityId);
      }
    }
  }
  
  // Stealth ability implementation
  private performStealth(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Check cooldown
    if (currentTime - this.lastStealthTime < this.stealthCooldown) {
      return;
    }
    
    // No energy cost for Stealth ability
    
    // Set cooldown
    this.lastStealthTime = currentTime;
    
    // Start stealth animation
    this.isStealthing = true;
    this.stealthStartTime = currentTime;

    // Play shadow step sound
    this.audioSystem?.playSabresShadowStepSound(playerTransform.position);

    // Create Sabre Reaper Mist effect at player position
    if (this.onCreateSabreMistEffectCallback) {
      this.onCreateSabreMistEffectCallback(playerTransform.position.clone());
    }

    // Broadcast mist effect to other players in PVP
    if (this.onBroadcastSabreMistCallback) {
      this.onBroadcastSabreMistCallback(playerTransform.position.clone(), 'stealth');
    }
    
    // Don't broadcast stealth state immediately - wait for invisibility activation
    
    // Schedule invisibility activation after delay
    setTimeout(() => {
      if (this.isStealthing) { // Only activate if stealth wasn't cancelled
        this.isInvisible = true;
        
        // Broadcast invisibility state to other players
        this.broadcastStealthState(true);
      }
    }, this.stealthDelayDuration * 1000);
    
    // Schedule invisibility deactivation with proper cleanup
    const totalStealthDuration = this.stealthDelayDuration + this.stealthInvisibilityDuration;

    setTimeout(() => {
      if (this.isStealthing) {
        // Create local reappearance mist effect
        if (this.onCreateSabreMistEffectCallback && this.playerEntity) {
          const currentPlayerTransform = this.playerEntity.getComponent(Transform);
          if (currentPlayerTransform) {
            this.onCreateSabreMistEffectCallback(currentPlayerTransform.position.clone());
          }
        }

        // Broadcast reappearance mist effect to other players
        if (this.onBroadcastSabreMistCallback && this.playerEntity) {
          const currentPlayerTransform = this.playerEntity.getComponent(Transform);
          if (currentPlayerTransform) {
            this.onBroadcastSabreMistCallback(currentPlayerTransform.position.clone(), 'stealth');
          }
        }

        // Ensure we clean up all stealth states
        this.isInvisible = false;
        this.isStealthing = false;
        this.stealthStartTime = 0;

        // Force broadcast the visibility state to ensure all clients see the player again
        this.broadcastStealthState(false);
      }
    }, totalStealthDuration * 1000);
  }
  
  private updateStealthState(playerTransform: Transform): void {
    // Only check if stealth state needs cleanup if we have an active stealth effect
    if (!this.isStealthing || this.stealthStartTime === 0) {
      return;
    }

    const currentTime = Date.now() / 1000;
    const elapsedTime = currentTime - this.stealthStartTime;
    const totalStealthDuration = this.stealthDelayDuration + this.stealthInvisibilityDuration;

    // Only clean up if the setTimeout might have failed for some reason
    // This is a safety net, not the primary cleanup mechanism
    if (elapsedTime >= totalStealthDuration + 1.0) { // Add 1 second buffer

      this.isStealthing = false;
      this.isInvisible = false;
      this.stealthStartTime = 0;

      // Emergency broadcast in case the normal broadcast failed
      this.broadcastStealthState(false);
    }
  }
  
  private broadcastStealthState(isInvisible: boolean): void {
    // Broadcast stealth state through the multiplayer system
    const multiplayerContext = (window as any).multiplayerContext;
    if (multiplayerContext && multiplayerContext.broadcastPlayerStealth) {
      multiplayerContext.broadcastPlayerStealth(isInvisible);
    }
  }
  
  private resetAllAbilityStates(): void {
    // Reset all ability states when switching weapons
    this.isSwinging = false; // Reset swinging state to prevent sound overlap
    this.isCharging = false; // Reset bow charging state
    this.chargeProgress = 0; // Reset charge progress
    this.isViperStingCharging = false; // Reset viper sting charging
    this.viperStingChargeProgress = 0;
    this.isBarrageCharging = false; // Reset barrage charging
    this.barrageChargeProgress = 0;
    this.isCobraShotCharging = false; // Reset cobra shot charging
    this.cobraShotChargeProgress = 0;
    this.isCloudkillCharging = false; // Reset cloudkill charging
    this.cloudkillChargeProgress = 0;
    this.isCrossentropyCharging = false; // Reset crossentropy charging
    this.crossentropyChargeProgress = 0;
    this.isSummonTotemCharging = false; // Reset summon totem charging
    this.summonTotemChargeProgress = 0;
    this.isWindShearCharging = false; // Reset wind shear charging
    this.windShearChargeProgress = 0;
    this.isSkyfalling = false;
    this.skyfallPhase = 'none';
    this.isBackstabbing = false;
    this.isSundering = false;
    this.sunderDamageApplied = false; // Reset sunder damage flag

    // Clean up stealth state and ensure visibility is restored
    if (this.isStealthing || this.isInvisible) {
      this.isStealthing = false;
      this.isInvisible = false;
      this.stealthStartTime = 0;

      // Broadcast visibility restoration when switching weapons
      this.broadcastStealthState(false);
    }

    this.isSwordCharging = false;
    this.isDeflecting = false;
    this.isWraithStriking = false; // Reset WraithStrike when switching weapons

    // Reset Corrupted Aura and restore original rune counts when switching weapons
    if (this.corruptedAuraActive) {
      this.corruptedAuraActive = false;
      setGlobalCriticalRuneCount(this.originalCriticalRunes);
      setGlobalCritDamageRuneCount(this.originalCritDamageRunes);
    }

    // Clear Sunder stacks when switching weapons
    this.sunderStacks.clear();

    // Clear Corrupted Aura slowed entities when switching weapons
    this.corruptedAuraSlowedEntities.clear();

    // Clear active debuff effects when switching weapons (for stun detection)
    this.activeDebuffEffects.clear();
  }

  private toggleCorruptedAura(playerTransform: Transform): void {
    // Check if player has enough mana to activate (minimum 8 mana)
    const gameUI = (window as any).gameUI;
    if (!this.corruptedAuraActive && gameUI && !gameUI.canCastCorruptedAura()) {
      return; // Not enough mana to activate
    }

    // Toggle the aura
    this.corruptedAuraActive = !this.corruptedAuraActive;

    // Handle rune count changes
    if (this.corruptedAuraActive) {
      // Store original rune counts before changing them
      const currentRuneCounts = getGlobalRuneCounts();

      this.originalCriticalRunes = currentRuneCounts.criticalRunes;
      this.originalCritDamageRunes = currentRuneCounts.critDamageRunes;

      // Heartbreak: increases critical strike chance by 45% and critical strike damage by 75%
      // Each crit rune adds 3% chance, so 45% = +15 crit runes
      // Each crit damage rune adds 15% damage, so 75% = +5 crit damage runes
      setGlobalCriticalRuneCount(currentRuneCounts.criticalRunes + 15);
      setGlobalCritDamageRuneCount(currentRuneCounts.critDamageRunes + 6);

      // Reset mana drain timer when activating
      this.lastManaDrainTime = Date.now() / 1000;

      // Play heartrend sound when Corrupted Aura is activated
      this.audioSystem?.playRunebladeHeartrendSound(playerTransform.position);
    } else {
      // Restore original rune counts when deactivating
      setGlobalCriticalRuneCount(this.originalCriticalRunes);
      setGlobalCritDamageRuneCount(this.originalCritDamageRunes);

      // Clear all slowed entities when deactivating
      this.corruptedAuraSlowedEntities.clear();
    }

    // Trigger callback to update visual component
    if (this.onCorruptedAuraToggleCallback) {
      this.onCorruptedAuraToggleCallback(this.corruptedAuraActive);
    }
  }

  private updateCorruptedAuraEffects(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const playerPosition = playerTransform.position;

    // Handle mana draining (8 mana per second)
    if (currentTime - this.lastManaDrainTime >= 1.0) {
      const gameUI = (window as any).gameUI;
        if (gameUI) {
          const manaConsumed = gameUI.consumeMana(this.corruptedAuraManaCost);
          if (!manaConsumed) {
            // Not enough mana - deactivate aura and restore rune counts
            this.corruptedAuraActive = false;
          setGlobalCriticalRuneCount(this.originalCriticalRunes);
          setGlobalCritDamageRuneCount(this.originalCritDamageRunes);
          this.corruptedAuraSlowedEntities.clear();
          if (this.onCorruptedAuraToggleCallback) {
            this.onCorruptedAuraToggleCallback(false);
          }
          return;
        }
        this.lastManaDrainTime = currentTime;
      }
    }

    // Apply slow effect to enemies/players within range
    this.applyCorruptedAuraSlow(playerPosition, currentTime);
  }

  private applyCorruptedAuraSlow(playerPosition: Vector3, currentTime: number): void {
    // Get all entities in the world
    const allEntities = this.world.getAllEntities();

    allEntities.forEach(entity => {
      if (entity.id === this.playerEntity?.id) return; // Don't slow self

      const entityTransform = entity.getComponent(Transform);
      const entityMovement = entity.getComponent(Movement);

      if (!entityTransform || !entityMovement) return;

      const distance = playerPosition.distanceTo(entityTransform.position);
      const isInRange = distance <= this.corruptedAuraRange;
      const wasSlowed = this.corruptedAuraSlowedEntities.get(entity.id) || false;

      if (isInRange && !wasSlowed) {
        // Entity just entered range - apply slow
        entityMovement.movementSpeedMultiplier = this.corruptedAuraSlowEffect;
        this.corruptedAuraSlowedEntities.set(entity.id, true);
      } else if (!isInRange && wasSlowed) {
        // Entity just left range - remove slow
        entityMovement.movementSpeedMultiplier = 1.0;
        this.corruptedAuraSlowedEntities.delete(entity.id);
      }
    });
  }

  // Callback for Corrupted Aura toggle
  private onCorruptedAuraToggleCallback?: (active: boolean) => void;


  public setCorruptedAuraToggleCallback(callback: (active: boolean) => void): void {
    this.onCorruptedAuraToggleCallback = callback;
  }

  // Skill Point System Methods
  public getSkillPointData(): SkillPointData {
    return { ...this.skillPointData };
  }

  public setSkillPointData(data: SkillPointData): void {
    this.skillPointData = data;
  }

  public setPlayerDead(isDead: boolean): void {
    this.isPlayerDead = isDead;
  }


  public isPlayerDeadState(): boolean {
    return this.isPlayerDead;
  }

  public updateSkillPointsForLevel(level: number): void {
    this.skillPointData = SkillPointSystem.updateSkillPointsForLevel(this.skillPointData, level);
  }

  public unlockAbility(weaponType: WeaponType, abilityKey: 'R' | 'F' | 'P', weaponSlot: 'primary' | 'secondary'): boolean {
    try {
      this.skillPointData = SkillPointSystem.unlockAbility(this.skillPointData, weaponType, abilityKey, weaponSlot);

      // Apply passive effects immediately if this is a passive ability
      if (abilityKey === 'P') {
        this.applyPassiveAbilities(weaponType);
      }

      return true;
    } catch (error) {
      console.error('Failed to unlock ability:', error);
      return false;
    }
  }

  private isAbilityUnlocked(abilityKey: 'E' | 'R' | 'F'): boolean {
    if (!this.selectedWeapons) return false;

    // Determine weapon slot
    let weaponSlot: 'primary' | 'secondary';
    let weaponType: WeaponType;

    if (this.currentWeapon === this.selectedWeapons.primary) {
      weaponSlot = 'primary';
      weaponType = this.selectedWeapons.primary;
    } else if (this.currentWeapon === this.selectedWeapons.secondary) {
      weaponSlot = 'secondary';
      weaponType = this.selectedWeapons.secondary;
    } else {
      // For tertiary weapon or unknown, allow abilities (tertiary unlocks later)
      return true;
    }

    return SkillPointSystem.isAbilityUnlocked(this.skillPointData, weaponType, abilityKey, weaponSlot);
  }

  public isPassiveAbilityUnlocked(abilityKey: 'P', weaponType: WeaponType, weaponSlot: 'primary' | 'secondary'): boolean {
    if (!this.selectedWeapons) return false;

    return SkillPointSystem.isAbilityUnlocked(this.skillPointData, weaponType, abilityKey, weaponSlot);
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

    // Play backstab sound at the start of the ability
    this.audioSystem?.playBackstabSound(playerTransform.position);

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
      let baseDamage = 75; // Base damage

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
            baseDamage = 175; // Backstab base damage (before critical calculation)
          }
        }
      }

      // Use DamageCalculator for proper critical chance and damage scaling
      const damageResult = calculateDamage(baseDamage, WeaponType.SABRES);
      const damage = damageResult.damage;
      
      // Check if target is stunned (for energy refund)
      let isTargetStunned = false;

      // Check for enemy stun status (single player mode)
      const enemy = entity.getComponent(Enemy);
      if (enemy) {
        // Check if enemy is currently frozen/stunned
        isTargetStunned = enemy.isFrozen;
      } else {
        // Check for PVP player stun status using ControlSystem's internal tracking
        isTargetStunned = this.isPlayerStunned(entity.id);
      }

      // Apply damage
      const combatSystem = this.world.getSystem(CombatSystem);
      if (combatSystem) {
        combatSystem.queueDamage(
          entity,
          damage,
          this.playerEntity!,
          'backstab',
          this.playerEntity?.userData?.playerId,
          damageResult.isCritical
        );

        hitCount++;

        // Refund energy if target is stunned (60 energy)
        if (isTargetStunned) {
          const gameUI = (window as any).gameUI;
          if (gameUI && gameUI.gainEnergy) {
            gameUI.gainEnergy(45);
          }
        }
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
    
    // Melee attack parameters -  for PVP combat
    const meleeRange = 4.5; //  attack range for PVP
    const meleeAngle = Math.PI / 2; // 120 degree cone (60 degrees each side)
    
    // Base damage values based on combo step and weapon type
    let baseDamage = 45; // Default base damage

    // Weapon-specific damage scaling
    if (this.currentWeapon === WeaponType.SWORD) {
      // Sword damage values
      switch (this.swordComboStep) {
        case 1: baseDamage = 40; break;
        case 2: baseDamage = 45; break;
        case 3: baseDamage = 50; break; // Finisher does more damage
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
    let criticalHits = 0;

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
          // Enemy is within attack cone - calculate damage with critical hits
          if (combatSystem && this.playerEntity) {
            // Calculate damage using DamageCalculator to get critical hit information
            const damageResult = calculateDamage(baseDamage, this.currentWeapon);
            const actualDamage = damageResult.damage;

            // Track critical hits for rage generation
            if (damageResult.isCritical) {
              criticalHits++;
            }

            // Queue damage through combat system (which will route to multiplayer for enemies)
            // Pass isCritical flag so CombatSystem doesn't recalculate critical damage
            combatSystem.queueDamage(entity, actualDamage, this.playerEntity, 'melee', this.playerEntity?.userData?.playerId, damageResult.isCritical);
            enemiesHit++;
          }
        }
      }
    });

    // Generate rage based on hits and critical hits
    if (enemiesHit > 0) {
      const gameUI = (window as any).gameUI;
      if (gameUI) {
        // Critical strikes give 10 rage each, regular hits give 5 rage, max 5 per swing
        const criticalRage = criticalHits * 10;
        const regularRage = Math.max(0, enemiesHit - criticalHits) * 5;
        const totalRage = Math.min(criticalRage + regularRage, 5); // Max 5 rage per swing total
        gameUI.gainRage(totalRage);
      }
    }
  }

  private checkForDashInput(movement: Movement, transform: Transform): void {
    // Prevent dashing while dead and waiting to respawn
    if (this.isPlayerDead) {
      return;
    }

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
          // Play dash sound
          this.audioSystem?.playUIDashSound();

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

    // If player died during charge, cancel it
    if (this.isPlayerDead) {
      movement.cancelCharge();
      return;
    }

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
        movement.cancelCharge();
        // Notify sword component that charge was cancelled
        this.onChargeComplete();
      } else if (!this.chargeStoppedByCollision) {
        // Only update position if not stopped by collision
        transform.position.copy(chargeResult.newPosition);
      }
    }

    if (chargeResult.isComplete || this.chargeStoppedByCollision) {
      // Notify sword component that charge is complete
      this.onChargeComplete();
    }
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



  private performCharge(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastChargeTime < this.chargeCooldown) {
      return;
    }

    this.isSwordCharging = true;
    this.lastChargeTime = currentTime;

    // Play charge sound
    this.audioSystem?.playSwordChargeSound(playerTransform.position);

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
      gameUI.gainRage(25);
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
    const chargeDamage = 40; // Damage for charge ability
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
            combatSystem.queueDamage(entity, chargeDamage, this.playerEntity, 'charge', this.playerEntity?.userData?.playerId);
            
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

    // Play deflect sound
    this.audioSystem?.playSwordDeflectSound(playerTransform.position);

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

    // Play bow draw sound when starting to charge
    this.audioSystem?.playBowDrawSound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 1000; // 1 second charge time
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.viperStingChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.viperStingChargeProgress >= 1.0) {
        clearInterval(chargeInterval);

        // Play viper sting release sound when firing
        this.audioSystem?.playViperStingReleaseSound(playerTransform.position);

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
    const compensationAngle = Math.PI / 7; // 30 degrees downward compensation
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
    triggerGlobalViperSting();
    
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

  private performCloudkill(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastCloudkillTime < this.cloudkillFireRate) {
      return;
    }

    // Check if player has enough energy (40 energy cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastCloudkill()) {
      return;
    }

    // Consume energy
    if (gameUI) {
      gameUI.consumeEnergy(40);
    }

    this.isCloudkillCharging = true;
    this.cloudkillChargeProgress = 0;
    this.lastCloudkillTime = currentTime;

    // Play bow draw sound when starting to charge (same as other bow abilities)
    this.audioSystem?.playBowDrawSound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 700; // 0.8 second charge time (shorter than Barrage)

    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.cloudkillChargeProgress = Math.min(elapsed / chargeDuration, 1.0);

      if (this.cloudkillChargeProgress >= 1.0) {
        clearInterval(chargeInterval);
        this.fireCloudkill(playerTransform);
        this.isCloudkillCharging = false;
        this.cloudkillChargeProgress = 0;
      }
    }, 16); // ~60fps updates
  }

  private fireCloudkill(playerTransform: Transform): void {
    // Get player position and direction
    const playerPosition = new Vector3(
      playerTransform.position.x,
      playerTransform.position.y,
      playerTransform.position.z
    );
    const direction = new Vector3(0, 0, -1); // Default forward direction

    // Play cloudkill release sound
    this.audioSystem?.playCloudkillReleaseSound(playerTransform.position);

    // Trigger Cloudkill callback
    if (this.onCloudkillCallback) {
      this.onCloudkillCallback(playerPosition, direction);
    }
  }

  private performBarrage(playerTransform: Transform): void {
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastBarrageTime < this.barrageFireRate) {
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

    // Play bow draw sound when starting to charge
    this.audioSystem?.playBowDrawSound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 500; // 1 second charge time
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.barrageChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.barrageChargeProgress >= 1.0) {
        clearInterval(chargeInterval);

        // Play barrage release sound when firing
        this.audioSystem?.playBarrageReleaseSound(playerTransform.position);

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
    const compensationAngle = Math.PI / 7; // 30 degrees
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
        opacity: 1.0,
        sourcePlayerId: this.playerEntity?.userData?.playerId || 'unknown'
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

  public switchWeaponBySlot(slot: 1 | 2 | 3): void {
    const currentTime = Date.now() / 1000;

    // Prevent rapid weapon switching
    if (currentTime - this.lastWeaponSwitchTime < this.weaponSwitchCooldown) {
      return;
    }

    let weaponType: WeaponType | undefined;

    if (slot === 1 && this.selectedWeapons?.primary) {
      weaponType = this.selectedWeapons.primary;
    } else if (slot === 2 && this.selectedWeapons?.secondary) {
      weaponType = this.selectedWeapons.secondary;
    } else if (slot === 3 && this.selectedWeapons?.tertiary) {
      weaponType = this.selectedWeapons.tertiary;
    }

    if (weaponType && this.currentWeapon !== weaponType) {
      this.switchToWeapon(weaponType, currentTime);
    }
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
        current: Math.max(0, this.colossusStrikeCooldown - (currentTime - this.lastColossusStrikeTime)),
        max: this.colossusStrikeCooldown,
        isActive: this.isColossusStriking
      };
      cooldowns['F'] = {
        current: Math.max(0, this.windShearCooldown - (currentTime - this.lastWindShearTime)),
        max: this.windShearCooldown,
        isActive: this.isWindShearCharging
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
      cooldowns['F'] = {
        current: Math.max(0, this.cloudkillFireRate - (currentTime - this.lastCloudkillTime)),
        max: this.cloudkillFireRate,
        isActive: this.isCloudkillCharging
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
        isActive: this.isCrossentropyCharging
      };
      cooldowns['F'] = {
        current: Math.max(0, this.summonTotemFireRate - (currentTime - this.lastSummonTotemTime)),
        max: this.summonTotemFireRate,
        isActive: this.isSummonTotemCharging
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
      cooldowns['F'] = {
        current: Math.max(0, this.stealthCooldown - (currentTime - this.lastStealthTime)),
        max: this.stealthCooldown,
        isActive: this.isStealthing
      };
    } else if (this.currentWeapon === WeaponType.RUNEBLADE) {
      // RUNEBLADE abilities
      cooldowns['Q'] = {
        current: Math.max(0, this.deathGraspCooldown - (currentTime - this.lastDeathGraspTime)),
        max: this.deathGraspCooldown,
        isActive: this.isDeathGrasping
      };
      cooldowns['E'] = {
        current: Math.max(0, this.wraithStrikeCooldown - (currentTime - this.lastWraithStrikeTime)),
        max: this.wraithStrikeCooldown,
        isActive: this.isWraithStriking
      };
      cooldowns['R'] = {
        current: Math.max(0, this.smiteCooldown - (currentTime - this.lastSmiteTime)),
        max: this.smiteCooldown,
        isActive: this.isSmiting
      };
      cooldowns['F'] = {
        current: this.corruptedAuraActive ? 0 : 0, // No cooldown, just active/inactive state
        max: 1,
        isActive: this.corruptedAuraActive
      };
    }

    return cooldowns;
  }
}