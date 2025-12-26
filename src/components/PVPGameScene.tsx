'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Matrix4, Camera, PerspectiveCamera, Scene, WebGLRenderer, PCFSoftShadowMap, Color, Quaternion, Euler, Group, AdditiveBlending } from '@/utils/three-exports';
import DragonRenderer from './dragon/DragonRenderer';
import { useMultiplayer, Player } from '@/contexts/MultiplayerContext';
import { SkillPointData } from '@/utils/SkillPointSystem';

// Import our ECS systems
import { Engine } from '@/core/Engine';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { Shield } from '@/ecs/components/Shield';

import { Renderer } from '@/ecs/components/Renderer';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { Tower } from '@/ecs/components/Tower';
import { Pillar as PillarComponent } from '@/ecs/components/Pillar';
import { SummonedUnit } from '@/ecs/components/SummonedUnit';

// Server data interfaces (match MultiplayerContext interfaces)
interface ServerPillar {
  id: string;
  ownerId: string;
  pillarIndex: number;
  position: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  isDead?: boolean;
}

interface ServerTower {
  id: string;
  ownerId: string;
  towerIndex: number;
  position: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  isDead?: boolean;
}

interface ServerSummonedUnit {
  unitId: string;
  ownerId: string;
  position: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  isDead: boolean;
  isActive: boolean;
  isElite?: boolean;
  currentTarget?: string | null;
  targetPosition?: { x: number; y: number; z: number } | null;
}
import { Entity } from '@/ecs/Entity';
import { InterpolationBuffer } from '@/ecs/components/Interpolation';
import { RenderSystem } from '@/systems/RenderSystem';
import { ControlSystem } from '@/systems/ControlSystem';
import { AudioSystem } from '@/systems/AudioSystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { ProjectileSystem } from '@/systems/ProjectileSystem';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { TowerSystem } from '@/systems/TowerSystem';
import { PillarSystem } from '@/systems/PillarSystem';
import { InterpolationSystem } from '@/systems/InterpolationSystem';
import { MerchantSystem } from '@/systems/MerchantSystem';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { ReanimateRef } from '@/components/weapons/Reanimate';
import PVPReanimateEffect from '@/components/weapons/PVPReanimateEffect';
import Smite from '@/components/weapons/Smite';
import ColossusStrike from '@/components/weapons/ColossusStrike';
import WindShearProjectileManager, { triggerWindShearProjectile } from '@/components/projectiles/WindShearProjectile';
import WindShearTornadoEffect from '@/components/projectiles/WindShearTornadoEffect';
import DeathGraspProjectile from '@/components/weapons/DeathGraspProjectile';
import DeathGraspPull from '@/components/weapons/DeathGraspPull';
import UnifiedProjectileManager from '@/components/managers/UnifiedProjectileManager';
import BowPowershotManager from '@/components/projectiles/BowPowershotManager';
import FrostNovaManager from '@/components/weapons/FrostNovaManager';
import StunManager from '@/components/weapons/StunManager';
import FrostNova from '@/components/weapons/FrostNova';
import CobraShotManager from '@/components/projectiles/CobraShotManager';
import ViperStingManager from '@/components/projectiles/ViperStingManager';
import CloudkillManager, { triggerGlobalCloudkill, triggerGlobalCloudkillWithTargets } from '@/components/projectiles/CloudkillManager';
import VenomEffect from '@/components/projectiles/VenomEffect';
import DebuffIndicator from '@/components/ui/DebuffIndicator';
import FrozenEffect from '@/components/weapons/FrozenEffect';
import StunnedEffect from '@/components/weapons/StunnedEffect';
import DeathEffect from '@/components/weapons/DeathEffect';
import SabreReaperMistEffect from '@/components/weapons/SabreReaperMistEffect';
import HauntedSoulEffect from '@/components/weapons/HauntedSoulEffect';
import CrossentropyExplosion from '@/components/projectiles/CrossentropyExplosion';
import SummonTotemExplosion from '@/components/projectiles/SummonTotemExplosion';
import {
  OptimizedPVPCobraShotManager,
  OptimizedPVPBarrageManager,
  OptimizedPVPFrostNovaManager,
  OptimizedPVPViperStingManager,
  OptimizedPVPCrossentropyManager,
  useOptimizedPVPEffects
} from '@/components/pvp/OptimizedPVPManagers';
import { pvpObjectPool } from '@/utils/PVPObjectPool';
import { pvpStateBatcher, PVPStateUpdateHelpers } from '@/utils/PVPStateBatcher';
import DeflectShieldManager, { triggerGlobalDeflectShield } from '@/components/weapons/DeflectShieldManager';
import PlayerHealthBar from '@/components/ui/PlayerHealthBar';
import MerchantUI from '@/components/ui/MerchantUI';
import TowerRenderer from '@/components/towers/TowerRenderer';
import PillarRenderer from '@/components/environment/PillarRenderer';
import SummonedUnitRenderer from '@/components/SummonedUnitRenderer';
import EnhancedGround from '@/components/environment/EnhancedGround';


import { DamageNumberData } from '@/components/DamageNumbers';
import { setGlobalCriticalRuneCount, setGlobalCritDamageRuneCount, setControlSystem } from '@/core/DamageCalculator';
import Environment from '@/components/environment/Environment';
import { useBowPowershot } from '@/components/projectiles/useBowPowershot';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';
import PVPSummonTotemManager from '@/components/projectiles/PVPSummonTotemManager';
import { ExperienceSystem } from '@/utils/ExperienceSystem';

// Function to calculate rune count based on weapon type and player level
// Bow, Sword, and Sabres gain 1 critical chance and 1 critical damage rune per level
// Level 1: 0 runes, Level 2: 1 rune, Level 3: 2 runes, Level 4: 3 runes, Level 5: 4 runes
function getRuneCountForWeapon(weaponType: WeaponType, level: number): number {
  if (weaponType === WeaponType.BOW || weaponType === WeaponType.SWORD || weaponType === WeaponType.SABRES) {
    return Math.max(0, level - 1); // Level 1 = 0, Level 5 = 4
  }
  return 0; // Scythe and Runeblade don't get runes from leveling
}


interface PVPGameSceneProps {
  onDamageNumbersUpdate?: (damageNumbers: DamageNumberData[]) => void;
  onDamageNumberComplete?: (id: string) => void;
  onCameraUpdate?: (camera: Camera, size: { width: number; height: number }) => void;
  onGameStateUpdate?: (gameState: {
    playerHealth: number;
    maxHealth: number;
    playerShield: number;
    maxShield: number;
    currentWeapon: WeaponType;
    currentSubclass: WeaponSubclass;
  }) => void;
  onControlSystemUpdate?: (controlSystem: any) => void;
  onExperienceUpdate?: (experience: number, level: number) => void;
  onEssenceUpdate?: (essence: number) => void;
  onScoreboardUpdate?: (playerKills: Map<string, number>, players: Map<string, any>) => void;
  onMerchantUIUpdate?: (isVisible: boolean) => void;
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null;
  skillPointData?: SkillPointData;
}

export function PVPGameScene({ onDamageNumbersUpdate, onDamageNumberComplete, onCameraUpdate, onGameStateUpdate, onControlSystemUpdate, onExperienceUpdate, onEssenceUpdate, onScoreboardUpdate, onMerchantUIUpdate, selectedWeapons, skillPointData }: PVPGameSceneProps = {}) {
  const { scene, camera, gl, size } = useThree();
  const {
    players,
    setPlayers,
    towers,
    pillars,
    setPillars,
    summonedUnits,
    gameStarted,
    isInRoom,
    currentRoomId,
    updatePlayerPosition,
    updatePlayerWeapon,
    updatePlayerHealth,
    updatePlayerShield,
    broadcastPlayerAttack,
    broadcastPlayerAbility,
    broadcastPlayerAnimationState,
    broadcastPlayerDamage, // New function for PVP damage
    broadcastPlayerHealing, // New function for PVP healing numbers
    broadcastPlayerEffect, // For broadcasting venom effects
    broadcastPlayerDebuff, // For broadcasting debuff effects
    broadcastPlayerStealth, // For broadcasting stealth state
    broadcastPlayerTornadoEffect, // For broadcasting tornado effects
    broadcastPlayerDeathEffect, // For broadcasting death effects
    broadcastPlayerKnockback, // For broadcasting knockback effects
    damageTower, // New function for tower damage
    damagePillar, // New function for pillar damage
    damageSummonedUnit, // New function for summoned unit damage
    damageEnemy, // New function for enemy damage with source player tracking
    socket,
    updatePlayerEssence,
    isChatOpen,
    openChat,
    closeChat,
  } = useMultiplayer();


  const engineRef = useRef<Engine | null>(null);
  const playerEntityRef = useRef<number | null>(null);
  const controlSystemRef = useRef<ControlSystem | null>(null);
  const cameraSystemRef = useRef<CameraSystem | null>(null);
  const towerSystemRef = useRef<TowerSystem | null>(null);
  // summonedUnitSystemRef removed - using server-authoritative summoned units
  const reanimateRef = useRef<ReanimateRef>(null);
  const isInitialized = useRef(false);
  const lastAnimationBroadcast = useRef(0);
  const realTimePlayerPositionRef = useRef<Vector3>(new Vector3(0, 0.5, 0));
  // Real-time position refs for enemy players to enable ghost trail updates
  const enemyPlayerPositionRefs = useRef<Map<string, { current: Vector3 }>>(new Map());
  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 0.5, 0));
  const [playerEntity, setPlayerEntity] = useState<any>(null);

  // PVP Kill Counter - tracks kills for all players
  const [playerKills, setPlayerKills] = useState<Map<string, number>>(new Map());

  // Merchant system state
  const [isMerchantNearby, setIsMerchantNearby] = useState(false);
  const [isMerchantVisible, setIsMerchantVisible] = useState(false);
  const [merchantRotation, setMerchantRotation] = useState<[number, number, number]>([0, 0, 0]);
  const merchantSystemRef = useRef<MerchantSystem | null>(null);
  const isMerchantNearbyRef = useRef(false);
  const isMerchantVisibleRef = useRef(false);

  // Merchant interaction handler
  const handleMerchantInteraction = useCallback(() => {
    if (isMerchantNearby) {
      if (merchantSystemRef.current) {
        merchantSystemRef.current.interact();
      }
      onMerchantUIUpdate?.(true); // Show merchant UI
      // Play interaction sound or effect here if needed
    }
  }, [isMerchantNearby, onMerchantUIUpdate]);

  // Keyboard event handler for merchant interaction and chat
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Handle Enter key for chat (only when not in input fields)
      if (event.key === 'Enter' && !isChatOpen && event.target === document.body) {
        event.preventDefault();
        openChat();
      }

      // Handle merchant interaction
      if (event.key.toLowerCase() === 'e' && isMerchantNearby) {
        handleMerchantInteraction();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isMerchantNearby, handleMerchantInteraction, isChatOpen, openChat]);

  // Disable control system input and allow all keyboard input when chat is open
  useEffect(() => {
    if (controlSystemRef.current) {
      controlSystemRef.current.setInputDisabled(isChatOpen);
      controlSystemRef.current.setAllowAllInput(isChatOpen);
    }
  }, [isChatOpen]);

  // Function to increment kill count for a player
  const incrementKillCount = useCallback((playerId: string) => {
    setPlayerKills(prev => {
      const newKills = new Map(prev);
      const currentKills = newKills.get(playerId) || 0;
      newKills.set(playerId, currentKills + 1);
      return newKills;
    });
  }, []);

  // Clean up expired venom effects on players
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setPlayers((prev: Map<string, Player>) => {
        const newPlayers = new Map(prev);
        let hasChanges = false;
        
        newPlayers.forEach((player: Player, playerId: string) => {
          if (player.isVenomed && player.venomedUntil && now > player.venomedUntil) {
            newPlayers.set(playerId, {
              ...player,
              isVenomed: false,
              venomedUntil: undefined
            });
            hasChanges = true;
          }
        });
        
        return hasChanges ? newPlayers : prev;
      });
    }, 1000); // Check every second

    return () => clearInterval(cleanupInterval);
  }, []); // Remove setPlayers dependency to prevent infinite re-renders

  // Update enemy player position refs for ghost trail functionality
  useEffect(() => {
    players.forEach((player, playerId) => {
      // Skip local player - they have their own realTimePlayerPositionRef
      if (playerId === socket?.id) return;

      // Get or create position ref for this enemy player
      let positionRef = enemyPlayerPositionRefs.current.get(playerId);
      if (!positionRef) {
        positionRef = { current: new Vector3(player.position.x, player.position.y, player.position.z) };
        enemyPlayerPositionRefs.current.set(playerId, positionRef);
      } else if (positionRef.current) {
        // Update existing ref with new position
        positionRef.current.set(player.position.x, player.position.y, player.position.z);
      }
    });

    // Clean up refs for players that no longer exist
    const currentPlayerIds = Array.from(players.keys());
    const refPlayerIds = Array.from(enemyPlayerPositionRefs.current.keys());
    refPlayerIds.forEach(playerId => {
      if (!currentPlayerIds.includes(playerId)) {
        enemyPlayerPositionRefs.current.delete(playerId);
      }
    });
  }, [players, socket?.id]);

  // Monitor player level changes and update TowerSystem
  useEffect(() => {
    players.forEach((player, playerId) => {
      if (player.level && towerSystemRef.current) {
        towerSystemRef.current.updatePlayerLevel(playerId, player.level);
      }
    });
  }, [players]);

  // Damage number management for Smite effects - initialize with dummy functions
  const [smiteDamageNumbers, setSmiteDamageNumbers] = useState<{
    setDamageNumbers: (callback: (prev: Array<{
      id: number;
      damage: number;
      position: Vector3;
      isCritical: boolean;
      isSmite?: boolean;
    }>) => Array<{
      id: number;
      damage: number;
      position: Vector3;
      isCritical: boolean;
      isSmite?: boolean;
    }>) => void;
    nextDamageNumberId: { current: number };
  }>({
    setDamageNumbers: (callback) => {
      return [];
    },
    nextDamageNumberId: { current: 0 }
  });

  // Callback to receive damage number functions from DragonRenderer
  const handleDamageNumbersReady = useCallback((setDamageNumbers: any, nextDamageNumberId: any) => {
    setSmiteDamageNumbers({ setDamageNumbers, nextDamageNumberId });
  }, []);

  // Create a ref for the Viper Sting manager that includes position and rotation
  const viperStingParentRef = useRef({
    position: new Vector3(0, 0.5, 0),
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  });

  // Ref for ViperStingManager damage number ID (moved to top level to avoid hook rule violations)
  const viperStingDamageNumberIdRef = useRef(0);
  
  // Track server player to local ECS entity mapping for PVP damage
  const serverPlayerEntities = useRef<Map<string, number>>(new Map());
  
  // Track server tower to local ECS entity mapping
  const serverTowerEntities = useRef<Map<string, number>>(new Map());
  const serverPillarEntities = useRef<Map<string, number>>(new Map());

  // Track server summoned unit to local ECS entity mapping
  const serverSummonedUnitEntities = useRef<Map<string, number>>(new Map());

  // Track stealth states for players - using useState to trigger re-renders when stealth changes
  const [playerStealthStates, setPlayerStealthStates] = useState<Map<string, boolean>>(new Map());

  // Track active Sabre Reaper Mist effects
  const [activeMistEffects, setActiveMistEffects] = useState<Array<{
    id: string;
    position: Vector3;
    startTime: number;
  }>>([]);

  // Track player deaths and respawn timers for PVP
  const [playerDeathStates, setPlayerDeathStates] = useState<Map<string, {
    isDead: boolean;
    deathTime: number;
    killerId?: string;
    deathPosition: Vector3;
  }>>(new Map());

  // Track death effects for players
  const [deathEffects, setDeathEffects] = useState<Map<string, {
    playerId: string;
    position: Vector3;
    startTime: number;
    isActive: boolean;
  }>>(new Map());

  // Sync server summoned units to ECS entities for targeting and collision
  const syncSummonedUnitsToECS = useCallback(() => {
    if (!engineRef.current) return;

    const world = engineRef.current.getWorld();
    const currentUnits = Array.from(summonedUnits.values()) as ServerSummonedUnit[];
    const currentEntityIds = new Set(serverSummonedUnitEntities.current.values());

    // Remove entities for units that no longer exist on server
    for (const [unitId, entityId] of Array.from(serverSummonedUnitEntities.current.entries())) {
      const unitStillExists = currentUnits.some(unit => unit.unitId === unitId);
      if (!unitStillExists) {
        world.destroyEntity(entityId);
        serverSummonedUnitEntities.current.delete(unitId);
      }
    }

    // Create or update entities for current server units
    for (const unit of currentUnits) {
      let entityId = serverSummonedUnitEntities.current.get(unit.unitId);
      let entity: Entity;

      // Handle dead or inactive units - remove their ECS entities
      if (!unit.isActive || unit.isDead) {
        if (entityId) {
          world.destroyEntity(entityId);
          serverSummonedUnitEntities.current.delete(unit.unitId);
        }
        continue;
      }

      if (!entityId) {
        // Create new entity for this summoned unit
        entity = world.createEntity();
        entityId = entity.id;
        serverSummonedUnitEntities.current.set(unit.unitId, entityId);

        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(unit.position.x, unit.position.y, unit.position.z);
        entity.addComponent(transform);

        // Add SummonedUnit component
        const summonedUnitComponent = world.createComponent(SummonedUnit);
        summonedUnitComponent.ownerId = unit.ownerId;
        summonedUnitComponent.unitId = unit.unitId;
        summonedUnitComponent.maxHealth = unit.maxHealth;
        summonedUnitComponent.isActive = unit.isActive;
        summonedUnitComponent.isDead = unit.isDead;
        entity.addComponent(summonedUnitComponent);

        // Add Health component
        const health = new Health(unit.maxHealth);
        health.currentHealth = unit.health;
        health.isDead = unit.isDead;
        entity.addComponent(health);

        // Add Collider component for targeting and damage detection
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        collider.radius = 0.5;
        collider.layer = CollisionLayer.ENEMY; // Use enemy layer so towers and players can target them
        collider.setOffset(0, 0.6, 0); // Center on unit
        entity.addComponent(collider);

        // Store server unit ID in userData for damage routing
        entity.userData = entity.userData || {};
        entity.userData.serverUnitId = unit.unitId;
        entity.userData.serverUnitOwnerId = unit.ownerId;

      } else {
        // Update existing entity
        const existingEntity = world.getEntity(entityId);
        if (existingEntity) {
          entity = existingEntity;
          // Update transform
          const transform = entity.getComponent(Transform);
          if (transform) {
            transform.setPosition(unit.position.x, unit.position.y, unit.position.z);
          }

          // Update health
          const health = entity.getComponent(Health);
          if (health) {
            health.currentHealth = unit.health;
            health.isDead = unit.isDead;
          }

          // Update summoned unit component
          const summonedUnitComponent = entity.getComponent(SummonedUnit);
          if (summonedUnitComponent) {
            summonedUnitComponent.isActive = unit.isActive;
            summonedUnitComponent.isDead = unit.isDead;
          }
        }
      }
    }
  }, [summonedUnits]);

  // Sync summoned units to ECS when they change
  useEffect(() => {
    syncSummonedUnitsToECS();
  }, [summonedUnits]);

  // Sync server towers to ECS entities for targeting and collision
  const syncTowersToECS = useCallback(() => {
    if (!engineRef.current) return;

    const world = engineRef.current.getWorld();
    const currentTowers = Array.from(towers.values()) as ServerTower[];

    // Remove entities for towers that no longer exist on server
    for (const [towerId, entityId] of Array.from(serverTowerEntities.current.entries())) {
      const towerStillExists = currentTowers.some(tower => tower.id === towerId);
      if (!towerStillExists) {
        world.destroyEntity(entityId);
        serverTowerEntities.current.delete(towerId);
      }
    }

    // Create or update entities for current server towers
    for (const tower of currentTowers) {
      let entityId = serverTowerEntities.current.get(tower.id);
      let entity: Entity;

      if (!entityId) {
        // Create new entity for this tower
        entity = world.createEntity();
        entityId = entity.id;
        serverTowerEntities.current.set(tower.id, entityId);

        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(tower.position.x, tower.position.y, tower.position.z);
        entity.addComponent(transform);

        // Add Tower component with player level for damage scaling
        const ownerPlayer = players.get(tower.ownerId);
        const playerLevel = ownerPlayer?.level || 1; // Default to level 1 if not found
        const towerComponent = world.createComponent(Tower);
        towerComponent.ownerId = tower.ownerId;
        towerComponent.towerIndex = tower.towerIndex;
        towerComponent.playerLevel = playerLevel;
        towerComponent.isActive = !tower.isDead;
        towerComponent.isDead = tower.isDead || false;
        entity.addComponent(towerComponent);

        // Add Health component
        const health = new Health(tower.maxHealth);
        health.currentHealth = tower.health;
        health.isDead = tower.isDead || false;
        entity.addComponent(health);

        // Add Collider component for targeting
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        collider.radius = 1.5; // Tower collision radius
        collider.layer = CollisionLayer.ENEMY; // Use enemy layer so they can be targeted
        collider.setOffset(0, 1.0, 0); // Center on tower
        entity.addComponent(collider);

        // Store server tower ID in userData
        entity.userData = entity.userData || {};
        entity.userData.serverTowerId = tower.id;
        entity.userData.serverTowerOwnerId = tower.ownerId;

      } else {
        // Update existing entity
        const existingEntity = world.getEntity(entityId);
        if (existingEntity) {
          entity = existingEntity;
          // Update transform
          const transform = entity.getComponent(Transform);
          if (transform) {
            transform.setPosition(tower.position.x, tower.position.y, tower.position.z);
          }

          // Update health
          const health = entity.getComponent(Health);
          if (health) {
            health.currentHealth = tower.health;
            health.isDead = tower.isDead || false;
          }

          // Update tower component
          const towerComponent = entity.getComponent(Tower);
          if (towerComponent) {
            // Check if player level changed and update damage accordingly
            const ownerPlayer = players.get(tower.ownerId);
            const currentPlayerLevel = ownerPlayer?.level || 1;

            if (towerComponent.playerLevel !== currentPlayerLevel) {
              towerComponent.updatePlayerLevel(currentPlayerLevel);
            }

            towerComponent.isActive = !tower.isDead;
            towerComponent.isDead = tower.isDead || false;
          }
        }
      }
    }
  }, [towers]);

  // Sync towers to ECS when they change
  useEffect(() => {
    syncTowersToECS();
  }, [towers]);

  // Sync pillars to ECS
  const syncPillarsToECS = useCallback(() => {
    if (!engineRef.current) return;
    const world = engineRef.current.getWorld();
    const currentPillars = Array.from(pillars.values()) as ServerPillar[];

    // Remove entities for pillars that no longer exist on server
    for (const [pillarId, entityId] of Array.from(serverPillarEntities.current.entries())) {
      const pillarStillExists = currentPillars.some(pillar => pillar.id === pillarId);
      if (!pillarStillExists) {
        world.destroyEntity(entityId);
        serverPillarEntities.current.delete(pillarId);
      }
    }

    // Create or update entities for current server pillars
    for (const pillar of currentPillars) {
      let entityId = serverPillarEntities.current.get(pillar.id);
      let entity: Entity;

      if (!entityId) {
        // Create new entity for this pillar
        entity = world.createEntity();
        entityId = entity.id;
        serverPillarEntities.current.set(pillar.id, entityId);

        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(pillar.position.x, pillar.position.y, pillar.position.z);
        entity.addComponent(transform);

        // Add Pillar component
        const pillarComponent = world.createComponent(PillarComponent);
        pillarComponent.ownerId = pillar.ownerId;
        pillarComponent.pillarIndex = pillar.pillarIndex;
        pillarComponent.isActive = !pillar.isDead;
        pillarComponent.isDead = pillar.isDead || false;
        entity.addComponent(pillarComponent);

        // Store server pillar ID for damage routing
        entity.userData = entity.userData || {};
        entity.userData.serverPillarId = pillar.id;

        // Add Health component
        const health = new Health(pillar.maxHealth);
        health.currentHealth = pillar.health;
        health.isDead = pillar.isDead || false;
        entity.addComponent(health);

        // Add Collider component for targeting
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        collider.radius = 0.7; // Pillar collision radius (matches visual)
        collider.layer = CollisionLayer.ENEMY; // Use enemy layer so they can be targeted like towers
        collider.isStatic = true;
        entity.addComponent(collider);

        // Notify world that entity is ready
        world.notifyEntityAdded(entity);
      } else {
        // Update existing entity
        const existingEntity = world.getEntity(entityId);
        if (!existingEntity) continue;
        entity = existingEntity;

        // Update transform if position changed
        const transform = entity.getComponent(Transform);
        if (transform) {
          transform.setPosition(pillar.position.x, pillar.position.y, pillar.position.z);
        }

        // Update health
        const health = entity.getComponent(Health);
        if (health) {
          health.currentHealth = pillar.health;
          health.isDead = pillar.isDead || false;
        }

        // Update pillar component
        const pillarComponent = entity.getComponent(PillarComponent);
        if (pillarComponent) {
          pillarComponent.isActive = !pillar.isDead;
          pillarComponent.isDead = pillar.isDead || false;
        }
      }
    }
  }, [pillars, engineRef]);

  // Sync pillars to ECS when they change or engine becomes available
  useEffect(() => {
    syncPillarsToECS();
  }, [pillars, engineRef.current]);

  // Refs to track latest values without triggering effect restarts
  const playersRef = useRef(players);
  const towersRef = useRef(towers);
  const pillarsRef = useRef(pillars);
  const summonedUnitsRef = useRef(summonedUnits);
  const activeMistEffectsRef = useRef(activeMistEffects);
  const deathEffectsRef = useRef(deathEffects);

  // Update refs when values change
  useEffect(() => {
    playersRef.current = players;
    towersRef.current = towers;
    pillarsRef.current = pillars;
    summonedUnitsRef.current = summonedUnits;
    activeMistEffectsRef.current = activeMistEffects;
    deathEffectsRef.current = deathEffects;
  }, [players, towers, pillars, summonedUnits, activeMistEffects, deathEffects]);

  // Memory monitoring and leak detection (runs continuously without restarting)
  useEffect(() => {
    console.log('🔍 Memory monitor started');
    const memoryMonitorInterval = setInterval(() => {
      try {
        // Check if performance.memory is available (Chrome only)
        const performanceMemory = (performance as any).memory;
        const usedJSHeapSize = performanceMemory?.usedJSHeapSize;
        const usedMB = usedJSHeapSize ? Math.round(usedJSHeapSize / (1024 * 1024)) : null;

        // Collect live object counts using refs
        const liveObjectCounts = {
          players: playersRef.current.size,
          towers: towersRef.current.size,
          pillars: pillarsRef.current.size,
          summonedUnits: summonedUnitsRef.current.size,
          pvpReanimateEffects: 0, // Will be counted from state
          pvpSmiteEffects: 0,
          pvpColossusStrikeEffects: 0,
          pvpWindShearEffects: 0,
          pvpDeathGraspEffects: 0,
          pvpFrozenEffects: 0,
          pvpStunnedEffects: 0,
          activeMistEffects: activeMistEffectsRef.current.length,
          deathEffects: deathEffectsRef.current.size,
          serverPlayerEntities: serverPlayerEntities.current.size,
          serverTowerEntities: serverTowerEntities.current.size,
          serverPillarEntities: serverPillarEntities.current.size,
          serverSummonedUnitEntities: serverSummonedUnitEntities.current.size,
        };

        // Get WebGL memory info
        const webglInfo = gl.info;
        const webglMemory = {
          geometries: webglInfo.memory?.geometries || 0,
          textures: webglInfo.memory?.textures || 0,
          programs: webglInfo.programs?.length || 0,
        };

        // Log memory pressure warning if usage is high
        if (usedMB && usedMB > 150) {
          console.warn(`⚠️ Memory pressure: ${usedMB}MB`, liveObjectCounts);
        }

        // Log live object counts every 10 seconds for debugging
        console.log('📊 Live object counts', liveObjectCounts);
        console.log('🎛️ WebGL memory', webglMemory);

        // Alert on potential geometry leaks
        if (webglMemory.geometries > 200) {
          console.warn(`⚠️ Geometry Count: ${webglMemory.geometries}`);
        }
      } catch (error) {
        console.error('❌ Memory monitor error:', error);
      }

    }, 10000); // Check every 10 seconds

    return () => {
      console.log('🛑 Memory monitor stopped');
      clearInterval(memoryMonitorInterval);
    };
  }, [gl]); // Only restart if gl changes (which should be rare)

  // Experience system state
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [lastExperienceAwardTime, setLastExperienceAwardTime] = useState(0);

// Mana scaling based on player level
const getMaxManaForWeapon = (weaponType: WeaponType, level: number): number => {
  if (weaponType === WeaponType.RUNEBLADE) {
    // Runeblade scaling: Level 1: 150, Level 2: 175, Level 3: 200, Level 4: 225, Level 5: 250
    const runebladeMana = [0, 150, 175, 200, 225, 250];
    return runebladeMana[level] || 150;
  } else if (weaponType === WeaponType.SCYTHE) {
    // Scythe scaling: Level 1: 250, Level 2: 275, Level 3: 300, Level 4: 325, Level 5: 350
    return 250 + (level - 1) * 25;
  }
  return 200; // Default for other weapons
};

// Mana system state for weapons (persistent across weapon switches)
const [weaponManaResources, setWeaponManaResources] = useState<{
  [key in WeaponType]: number;
}>({
  [WeaponType.SCYTHE]: getMaxManaForWeapon(WeaponType.SCYTHE, 1), // Start with level 1 capacity
  [WeaponType.SWORD]: 0,
  [WeaponType.BOW]: 0,
  [WeaponType.SABRES]: 0,
  [WeaponType.RUNEBLADE]: getMaxManaForWeapon(WeaponType.RUNEBLADE, 1) // Start with level 1 capacity
});
const [maxMana, setMaxMana] = useState(150);

  // Track current weapon for mana management
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>(WeaponType.BOW);
  const currentMana = weaponManaResources[currentWeapon];

  // PVP Reanimate Effect Management
  const [pvpReanimateEffects, setPvpReanimateEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextReanimateEffectId = useRef(0);

  // PVP Smite Effect Management
  const [pvpSmiteEffects, setPvpSmiteEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
    onDamageDealt?: (totalDamage: number) => void;
  }>>([]);
  const nextSmiteEffectId = useRef(0);

  // PVP Colossus Strike Effect Management
  const [pvpColossusStrikeEffects, setPvpColossusStrikeEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    damage: number;
    startTime: number;
    duration: number;
    onDamageDealt?: (damageDealt: boolean) => void;
  }>>([]);
  const nextColossusStrikeEffectId = useRef(0);

  // PVP Wind Shear Effect Management
  const [pvpWindShearEffects, setPvpWindShearEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    direction: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextWindShearEffectId = useRef(0);

  // PVP WindShear Tornado Effect Management
  const [pvpWindShearTornadoEffects, setPvpWindShearTornadoEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextWindShearTornadoEffectId = useRef(0);

  // PVP DeathGrasp Effect Management
  const [pvpDeathGraspEffects, setPvpDeathGraspEffects] = useState<Array<{
    id: number;
    playerId: string;
    startPosition: Vector3;
    direction: Vector3;
    startTime: number;
    duration: number;
    pullTriggered: boolean;
  }>>([]);
  const nextDeathGraspEffectId = useRef(0);

  // PVP DeathGrasp Pull Management
  const [pvpDeathGraspPulls, setPvpDeathGraspPulls] = useState<Array<{
    id: number;
    targetPlayerId: string;
    casterPosition: Vector3;
    startTime: number;
    duration: number;
    isActive: boolean;
  }>>([]);
  const nextDeathGraspPullId = useRef(0);

  // PVP Summon Totem Effect Management
  const [pvpSummonTotemEffects, setPvpSummonTotemEffects] = useState<Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>>([]);

  // PVP Venom Effect Management
  const [pvpVenomEffects, setPvpVenomEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextVenomEffectId = useRef(0);

  // PVP Debuff Management
  const [pvpDebuffEffects, setPvpDebuffEffects] = useState<Array<{
    id: number;
    playerId: string;
    debuffType: 'frozen' | 'slowed' | 'stunned' | 'burning';
    position: Vector3;
    startTime: number;
    duration: number;
    stackCount?: number; // For burning stacks
  }>>([]);
  const nextDebuffEffectId = useRef(0);

  // Track active debuff indicators to prevent visual overcrowding
  // Key format: "playerId:debuffType" -> debuff effect id
  const activeDebuffIndicators = useRef<Map<string, number>>(new Map());

  // PVP Frost Nova Effect Management
  const [pvpFrostNovaEffects, setPvpFrostNovaEffects] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextFrostNovaEffectId = useRef(0);


  // PVP Crossentropy Explosion Effect Management
  const [pvpCrossentropyExplosions, setPvpCrossentropyExplosions] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextCrossentropyExplosionId = useRef(0);

  // PVP Summon Totem Explosion Effect Management
  const [pvpSummonTotemExplosions, setPvpSummonTotemExplosions] = useState<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextSummonTotemExplosionId = useRef(0);

  // PVP Haunted Soul Effect Management
  const [pvpHauntedSoulEffects, setPvpHauntedSoulEffects] = useState<Array<{
    id: number;
    position: Vector3;
    startTime: number;
  }>>([]);
  const nextHauntedSoulEffectId = useRef(0);
  
  // Function to create venom effect on PVP players
  // Function to create debuff effect on PVP players
  const createPvpDebuffEffect = useCallback((playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', position: Vector3, duration: number = 5000) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    // Check if there's already an active debuff indicator for this player and debuff type
    const indicatorKey = `${playerId}:${debuffType}`;
    const existingIndicatorId = activeDebuffIndicators.current.get(indicatorKey);
    
    // If there's already an active indicator, extend its duration instead of creating a new one
    if (existingIndicatorId !== undefined) {
      // Find and update the existing debuff effect
      setPvpDebuffEffects(prev => prev.map(effect => {
        if (effect.id === existingIndicatorId) {
          return {
            ...effect,
            duration: Math.max(effect.duration, duration), // Use the longer duration
            position: position.clone(), // Update position to latest
            stackCount: Math.max(effect.stackCount || 1, (position as any).stackCount || 1) // Update stack count if higher
          };
        }
        return effect;
      }));
      
      // Apply the debuff to the local player's movement if this is targeting us
      if (isLocalPlayer && playerEntity) {
        const playerMovement = playerEntity.getComponent(Movement);
        if (playerMovement) {
          if (debuffType === 'frozen') {
            playerMovement.freeze(duration);
          } else if (debuffType === 'slowed') {
            playerMovement.slow(duration, 0.5); // 50% speed reduction
          } else if (debuffType === 'stunned') {
            playerMovement.freeze(duration); // Stun uses same movement restriction as freeze
          } else if (debuffType === 'corrupted') {
            playerMovement.applyCorrupted(duration); // Apply corrupted debuff with gradual recovery
          } else if (debuffType === 'burning') {
            // Burning doesn't affect movement, it's a visual effect only
          }
        }
      }
      
      return; // Exit early, don't create a new indicator
    }
    
    const debuffEffect = {
      id: nextDebuffEffectId.current++,
      playerId,
      debuffType,
      position: position.clone(),
      startTime: Date.now(),
      duration,
      stackCount: (position as any).stackCount || 1 // Extract stack count from position if available
    };
    
    // Track this new debuff indicator
    activeDebuffIndicators.current.set(indicatorKey, debuffEffect.id);
    
    // Use batched updates for debuff effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'debuff',
      setter: setPvpDebuffEffects,
      data: debuffEffect
    }]);
    
    // Apply the debuff to the local player's movement if this is targeting us
    if (isLocalPlayer && playerEntity) {
      const playerMovement = playerEntity.getComponent(Movement);
      if (playerMovement) {
        if (debuffType === 'frozen') {
          playerMovement.freeze(duration);
        } else if (debuffType === 'slowed') {
          playerMovement.slow(duration, 0.5); // 50% speed reduction
        } else if (debuffType === 'stunned') {
          playerMovement.freeze(duration); // Stun uses same movement restriction as freeze
        } else if (debuffType === 'corrupted') {
          playerMovement.applyCorrupted(duration); // Apply corrupted debuff with gradual recovery
        } else if (debuffType === 'burning') {
          // Burning doesn't affect movement, it's a visual effect only
        }
      }
    }
    
    // Clean up debuff effect after duration using batched updates
    setTimeout(() => {
      // Remove from tracking map
      const indicatorKey = `${debuffEffect.playerId}:${debuffEffect.debuffType}`;
      activeDebuffIndicators.current.delete(indicatorKey);
      
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'debuff',
        setter: setPvpDebuffEffects,
        filterId: debuffEffect.id
      }]);
    }, debuffEffect.duration);
  }, [socket?.id, playerEntity]);

  // Function to create frozen effect on PVP players (called by PVPFrostNovaManager)
  const createPvpFrozenEffect = useCallback((playerId: string, position: Vector3) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    // Create the frozen debuff effect (3 second freeze)
    createPvpDebuffEffect(playerId, 'frozen', position, 5000);
    
    // Broadcast debuff effect to all players so they can see it
    if (broadcastPlayerDebuff) {
      broadcastPlayerDebuff(playerId, 'frozen', 5000, {
        position: { x: position.x, y: position.y, z: position.z }
      });
    }
  }, [createPvpDebuffEffect, broadcastPlayerDebuff]);

  // Function to create reanimate effect on PVP players
  const createPvpReanimateEffect = useCallback((playerId: string, position: Vector3) => {

    const reanimateEffect = {
      id: nextReanimateEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1500 // 1.5 seconds reanimate duration (matches Reanimate component)
    };

    // Use batched updates for reanimate effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'reanimate',
      setter: setPvpReanimateEffects,
      data: reanimateEffect
    }]);

    // Clean up reanimate effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'reanimate',
        setter: setPvpReanimateEffects,
        filterId: reanimateEffect.id
      }]);
    }, reanimateEffect.duration);
  }, []);

  // Function to create smite effect on PVP players
  const createPvpSmiteEffect = useCallback((playerId: string, position: Vector3, onDamageDealt?: (totalDamage: number) => void) => {

    const smiteEffect = {
      id: nextSmiteEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1200, // 1.2 seconds - extended to account for start delay (0.05s) + animation (1.0s) + buffer (0.15s)
      onDamageDealt: onDamageDealt // Include healing callback
    };

    // Use batched updates for smite effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'smite',
      setter: setPvpSmiteEffects,
      data: smiteEffect
    }]);

    // Clean up smite effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'smite',
        setter: setPvpSmiteEffects,
        filterId: smiteEffect.id
      }]);
    }, smiteEffect.duration);
  }, []);

  const createPvpColossusStrikeEffect = useCallback((playerId: string, position: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => {

    const colossusStrikeEffect = {
      id: nextColossusStrikeEffectId.current++,
      playerId,
      position: position.clone(),
      damage: damage,
      startTime: Date.now(),
      duration: 1200, // 1.2 seconds - extended to account for start delay (0.05s) + animation (1.0s) + buffer (0.15s)
      onDamageDealt: onDamageDealt
    };

    // Use batched updates for colossus strike effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'colossusStrike',
      setter: setPvpColossusStrikeEffects,
      data: colossusStrikeEffect
    }]);

    // Clean up colossus strike effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'colossusStrike',
        setter: setPvpColossusStrikeEffects,
        filterId: colossusStrikeEffect.id
      }]);
    }, colossusStrikeEffect.duration);
  }, []);

  // Function to create wind shear effect on PVP players
  const createPvpWindShearEffect = useCallback((playerId: string, position: Vector3, direction: Vector3) => {
    // Trigger the visual projectile effect
    triggerWindShearProjectile(position, direction);

    const windShearEffect = {
      id: nextWindShearEffectId.current++,
      playerId,
      position: position.clone(),
      direction: direction.clone(),
      startTime: Date.now(),
      duration: 2200 // 2.2 seconds (slightly longer than projectile lifetime)
    };

    // Use batched updates for wind shear effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'windShear',
      setter: setPvpWindShearEffects,
      data: windShearEffect
    }]);

    // Clean up wind shear effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'windShear',
        setter: setPvpWindShearEffects,
        filterId: windShearEffect.id
      }]);
    }, windShearEffect.duration);
  }, []);

  // Function to create wind shear tornado effect on PVP players
  const createPvpWindShearTornadoEffect = useCallback((playerId: string, duration: number) => {
    // Debug: Log all players in the map

    // For local player (socket.id or 'local'), use the actual player entity position
    let initialPosition = new Vector3();
    let player = players.get(playerId);

    // Check if this is for the local player
    const isLocalPlayer = playerId === socket?.id || playerId === 'local';
    
    if (isLocalPlayer && playerEntity) {
      const transform = playerEntity.getComponent(Transform);
      if (transform) {
        initialPosition = transform.position.clone();
      }
    } else if (player) {
      initialPosition = new Vector3(player.position.x, player.position.y, player.position.z);
    } else {
      // Try to find the local player by socket ID if playerId was 'local'
      if (playerId === 'local' && socket?.id) {
        player = players.get(socket.id);
        if (player) {
          initialPosition = new Vector3(player.position.x, player.position.y, player.position.z);
        }
      }
    }

    const tornadoEffect = {
      id: nextWindShearTornadoEffectId.current++,
      playerId,
      position: initialPosition,
      startTime: Date.now(),
      duration
    };

    // Use batched updates for tornado effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'windShearTornado',
      setter: setPvpWindShearTornadoEffects,
      data: tornadoEffect
    }]);

    // Clean up tornado effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'windShearTornado',
        setter: setPvpWindShearTornadoEffects,
        filterId: tornadoEffect.id
      }]);
    }, duration);
  }, [players, socket?.id, playerEntity]);

  // Function to create death grasp effect on PVP players
  const createPvpDeathGraspEffect = useCallback((playerId: string, startPosition: Vector3, direction: Vector3) => {

    const deathGraspEffect = {
      id: nextDeathGraspEffectId.current++,
      playerId,
      startPosition: startPosition.clone(),
      direction: direction.clone(),
      startTime: Date.now(),
      duration: 1200, // 1.2 seconds death grasp duration (matches DeathGraspProjectile component)
      pullTriggered: false
    };

    // Use batched updates for death grasp effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'deathgrasp',
      setter: setPvpDeathGraspEffects,
      data: deathGraspEffect
    }]);

    // Clean up death grasp effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'deathgrasp',
        setter: setPvpDeathGraspEffects,
        filterId: deathGraspEffect.id
      }]);
    }, deathGraspEffect.duration);
  }, []);

  // Function to create death grasp pull effect on PVP players
  const createPvpDeathGraspPull = useCallback((targetPlayerId: string, casterPosition: Vector3) => {

    const deathGraspPull = {
      id: nextDeathGraspPullId.current++,
      targetPlayerId,
      casterPosition: casterPosition.clone(),
      startTime: Date.now(),
      duration: 600, // 0.6 seconds pull duration (matches DeathGraspPull component)
      isActive: true
    };


    // Use batched updates for death grasp pulls
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'deathgrasp',
      setter: setPvpDeathGraspPulls,
      data: deathGraspPull
    }]);

    // Clean up death grasp pull after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'deathgrasp',
        setter: setPvpDeathGraspPulls,
        filterId: deathGraspPull.id
      }]);
    }, deathGraspPull.duration);
  }, []);

  // Function to create frost nova effect on PVP players
  const createPvpFrostNovaEffect = useCallback((playerId: string, position: Vector3) => {

    const frostNovaEffect = {
      id: nextFrostNovaEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1200 // 1.2 seconds frost nova duration (matches FrostNovaManager)
    };

    // Use batched updates for frost nova effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'frostNova',
      setter: setPvpFrostNovaEffects,
      data: frostNovaEffect
    }]);

    // Clean up frost nova effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'frostNova',
        setter: setPvpFrostNovaEffects,
        filterId: frostNovaEffect.id
      }]);
    }, frostNovaEffect.duration);
  }, []);



  // Function to create haunted soul effect (for WraithStrike)
  const createPvpHauntedSoulEffect = useCallback((position: Vector3) => {
    const hauntedSoulEffect = {
      id: nextHauntedSoulEffectId.current++,
      position: position.clone(),
      startTime: Date.now()
    };
    
    setPvpHauntedSoulEffects(prev => [...prev, hauntedSoulEffect]);
    
  }, []);

  const createPvpVenomEffect = useCallback((playerId: string, position: Vector3, casterId?: string) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    // SAFETY CHECK: Don't create venom effects on the local player
    if (isLocalPlayer) {
      return;
    }
    
    const venomEffect = {
      id: nextVenomEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 6000 // 6 seconds venom duration
    };
    
    // Use batched updates for venom effects
    PVPStateUpdateHelpers.batchEffectUpdates([{
      type: 'add',
      effectType: 'venom',
      setter: setPvpVenomEffects,
      data: venomEffect
    }]);
    
    // Apply DoT damage over time
    const venomDamagePerSecond = 17;
    const tickInterval = 1000; // 1 second per tick
    let tickCount = 0;
    const maxTicks = 6; // 6 seconds total
    
    const venomInterval = setInterval(() => {
      tickCount++;
      if (tickCount > maxTicks) {
        clearInterval(venomInterval);
        return;
      }
      
      // Apply venom damage
      if (broadcastPlayerDamage) {
        broadcastPlayerDamage(playerId, venomDamagePerSecond, 'cobra_shot');
      }

      // Create local damage numbers for the caster to see their venom DoT
      if (casterId === socket?.id) {
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        if (damageNumberManager && damageNumberManager.addDamageNumber) {
          const targetPlayer = players.get(playerId);
          if (targetPlayer) {
            const damagePosition = new Vector3(
              targetPlayer.position.x,
              targetPlayer.position.y + 1.5,
              targetPlayer.position.z
            );
            damageNumberManager.addDamageNumber(
              venomDamagePerSecond,
              false, // Not critical
              damagePosition,
              'cobra_shot' // Green color for venom DoT damage
            );
          }
        }
      }
    }, tickInterval);
    
    // Clean up venom effect after duration using batched updates
    setTimeout(() => {
      PVPStateUpdateHelpers.batchEffectUpdates([{
        type: 'remove',
        effectType: 'venom',
        setter: setPvpVenomEffects,
        filterId: venomEffect.id
      }]);
    }, venomEffect.duration);
  }, [socket?.id, broadcastPlayerDamage]);

  // Function to handle player death in PVP
  const handlePlayerDeath = useCallback((deadPlayerId: string, killerId: string | undefined) => {
    // Mark player as dead
    setPlayerDeathStates(prev => {
      const newState = new Map(prev);
      const player = players.get(deadPlayerId);
      const deathPosition = player ? new Vector3(player.position.x, player.position.y, player.position.z) : new Vector3(0, 0.5, 0);

      newState.set(deadPlayerId, {
        isDead: true,
        deathTime: Date.now(),
        killerId,
        deathPosition: deathPosition.clone()
      });
      return newState;
    });

    // Start death effect locally
    const player = players.get(deadPlayerId);
    if (player) {
      setDeathEffects(prev => {
        const newEffects = new Map(prev);
        newEffects.set(deadPlayerId, {
          playerId: deadPlayerId,
          position: new Vector3(player.position.x, player.position.y, player.position.z),
          startTime: Date.now(),
          isActive: true
        });
        return newEffects;
      });

      // Broadcast death effect to other players
      broadcastPlayerDeathEffect(deadPlayerId, player.position, true);
    }

    // Set death state in ControlSystem to prevent movement and abilities
    if (deadPlayerId === socket?.id && controlSystemRef.current) {
      controlSystemRef.current.setPlayerDead(true);

      // Also disable camera rotation during death
      if (cameraSystemRef.current) {
        cameraSystemRef.current.setDeathCameraDisabled(true, socket.id);
      }

      // Also set the Health component's isDead flag and make player invulnerable
      if (playerEntityRef.current !== null && engineRef.current) {
        const world = engineRef.current.getWorld();
        const playerEntity = world.getEntity(playerEntityRef.current);
        if (playerEntity) {
          const health = playerEntity.getComponent(Health);
          if (health) {
            health.isDead = true; // Ensure Health component knows player is dead
            health.setInvulnerable(6.0); // Make invulnerable for 6 seconds (1 second longer than respawn)
          }
        }
      }
    }

    // Note: Experience rewards for kills are handled in handlePlayerDamaged
    // This function only handles the death of the local player

    // Start respawn timer (10 seconds)
    setTimeout(() => {
      handlePlayerRespawn(deadPlayerId);
    }, 12500);
  }, [socket?.id, players, updatePlayerHealth, playerEntityRef, engineRef]);

  // Function to handle player respawn
  const handlePlayerRespawn = useCallback((playerId: string) => {
    // Find the player's tower
    const playerTower = (Array.from(towers.values()) as ServerTower[]).find(tower => tower.ownerId === playerId);
    if (!playerTower) {
      // console.warn(`⚠️ No tower found for player ${playerId}, cannot respawn`);
      return;
    }

    // Teleport player to their tower
    const respawnPosition = {
      x: playerTower.position.x,
      y: playerTower.position.y + 1, // Slightly above ground
      z: playerTower.position.z
    };

    if (playerId === socket?.id) {
      // Local player respawn
      if (playerEntityRef.current !== null && engineRef.current) {
        const world = engineRef.current.getWorld();
        const playerEntity = world.getEntity(playerEntityRef.current);

        if (playerEntity) {
          const transform = playerEntity.getComponent(Transform);
          const health = playerEntity.getComponent(Health);

          if (transform) {
            transform.setPosition(respawnPosition.x, respawnPosition.y, respawnPosition.z);
          }

          if (health) {
            health.revive(); // Restore full health and clear death flag
            health.setInvulnerable(2.0); // Give player 2 seconds of invulnerability after respawn
            updatePlayerHealth(health.currentHealth, health.maxHealth);

            // Get shield component for immediate UI update
            const shield = playerEntity.getComponent(Shield);
            if (shield) {
              shield.restoreShield(); // Restore shield to full on respawn
            }

            // Immediately update game state to ensure health bar reflects respawned values
            if (onGameStateUpdate && controlSystemRef.current) {
              const gameState = {
                playerHealth: health.currentHealth,
                maxHealth: health.maxHealth,
                playerShield: shield ? shield.currentShield : 0,
                maxShield: shield ? shield.maxShield : 0,
                currentWeapon: controlSystemRef.current.getCurrentWeapon(),
                currentSubclass: controlSystemRef.current.getCurrentSubclass(),
                mana: (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) ? currentMana : 0,
                maxMana: (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) ? maxMana : 0
              };
              onGameStateUpdate(gameState);
              
              // Prevent game loop from sending stale health after respawn
              lastGameStateUpdate.current = Date.now();
            }

            // Update local player's entry in players Map
            const localPlayerId = socket?.id;
            if (localPlayerId) {
              setPlayers(prevPlayers => {
                const newPlayers = new Map(prevPlayers);
                const player = newPlayers.get(localPlayerId);
                if (player) {
                  newPlayers.set(localPlayerId, {
                    ...player,
                    health: health.currentHealth,
                    maxHealth: health.maxHealth,
                    shield: shield ? shield.currentShield : 0,
                    maxShield: shield ? shield.maxShield : 0
                  });
                }
                return newPlayers;
              });
            }
          }
        }
      }
    } else {
      // Remote player respawn - the server will handle broadcasting the position update
      // We don't need to update local state as the server sync will handle it
    }

    // Clear death state
    setPlayerDeathStates(prev => {
      const newState = new Map(prev);
      newState.delete(playerId);
      return newState;
    });

    // Stop death effect locally
    setDeathEffects(prev => {
      const newEffects = new Map(prev);
      newEffects.delete(playerId);
      return newEffects;
    });

    // Stop death effect for other players
    broadcastPlayerDeathEffect(playerId, { x: 0, y: 0, z: 0 }, false);

    // Clear death state in ControlSystem to re-enable movement and abilities
    if (playerId === socket?.id && controlSystemRef.current) {
      controlSystemRef.current.setPlayerDead(false);

      // Re-enable camera rotation
      if (cameraSystemRef.current) {
        cameraSystemRef.current.setDeathCameraDisabled(false, socket.id);
      }
    }

    // Notify server of respawn for death confirmation and experience award
    if (socket && socket.connected && currentRoomId) {
      socket.emit('player-respawn', {
        roomId: currentRoomId,
        playerId: playerId
      });
    }
  }, [socket, currentRoomId, towers, updatePlayerHealth, playerEntityRef, engineRef]);

  // Function to handle wave completion (legacy multiplayer mode - wave experience removed)
  const handleWaveComplete = useCallback(() => {
    // Wave experience has been removed - no EXP is awarded for wave completions
  }, []);

  // Function to handle PVP wave completion (wave experience removed)
  const handlePvpWaveComplete = useCallback((eventData: any) => {
    const { winnerPlayerId, defeatedPlayerId, isLocalPlayerWinner, waveId } = eventData;

    // Award 10 essence when any enemy player's wave is defeated (even if we didn't win)
    if (defeatedPlayerId && defeatedPlayerId !== socket?.id) {
      updatePlayerEssence(socket?.id!, 10);
    }

    if (isLocalPlayerWinner) {
      // Local player won - no experience awarded (wave experience system removed)
    } else {
      // Opponent won - no experience for local player
    }
  }, [socket, updatePlayerEssence]);

  // Listen for wave completion events from server
  useEffect(() => {
    const handleWaveCompletedEvent = (event: CustomEvent) => {
      handleWaveComplete();
    };

    const handlePvpWaveCompletedEvent = (event: CustomEvent) => {
      handlePvpWaveComplete(event.detail);
    };

    // Listen for both legacy multiplayer and PVP wave completion events
    window.addEventListener('wave-completed', handleWaveCompletedEvent as EventListener);
    window.addEventListener('pvp-wave-completed', handlePvpWaveCompletedEvent as EventListener);

    return () => {
      window.removeEventListener('wave-completed', handleWaveCompletedEvent as EventListener);
      window.removeEventListener('pvp-wave-completed', handlePvpWaveCompletedEvent as EventListener);
    };
  }, [handleWaveComplete, handlePvpWaveComplete]);

  // Notify parent component of experience updates
  React.useEffect(() => {
    if (onExperienceUpdate) {
      onExperienceUpdate(playerExperience, playerLevel);
    }
  }, [playerExperience, playerLevel, onExperienceUpdate]);

  // Update runes when level or primary weapon changes
  React.useEffect(() => {
    const primaryWeapon = selectedWeapons?.primary || WeaponType.BOW;
    const runeCount = getRuneCountForWeapon(primaryWeapon, playerLevel);
    setGlobalCriticalRuneCount(runeCount);
    setGlobalCritDamageRuneCount(runeCount);
  }, [playerLevel, selectedWeapons?.primary]);

  const [weaponState, setWeaponState] = useState({
    currentWeapon: WeaponType.BOW,
    currentSubclass: WeaponSubclass.ELEMENTAL,
    isCharging: false,
    chargeProgress: 0,
    chargeDirection: new Vector3(0, 0, -1), // Default forward direction
    isSwinging: false,
    isSpinning: false,
    swordComboStep: 1 as 1 | 2 | 3,
    isSwordCharging: false,
    isDeflecting: false,
    isViperStingCharging: false,
    viperStingChargeProgress: 0,
    isBarrageCharging: false,
    barrageChargeProgress: 0,
    isCobraShotCharging: false,
    cobraShotChargeProgress: 0,
    isSkyfalling: false,
    isBackstabbing: false,
    isSundering: false,
    isCorruptedAuraActive: false,
    isFrozen: false
  });

  // Use a ref to store current weapon state to avoid infinite re-renders
  const weaponStateRef = useRef(weaponState);
  const lastWeaponStateUpdate = useRef(0);

  // Throttling refs to prevent infinite re-renders in useFrame
  const lastDamageNumbersUpdate = useRef(0);
  const lastCameraUpdate = useRef(0);
  const lastGameStateUpdate = useRef(0);

  // Track previous weapon state for change detection
  const prevWeaponRef = useRef<{ weapon: WeaponType; subclass: WeaponSubclass }>({
    weapon: WeaponType.BOW,
    subclass: WeaponSubclass.ELEMENTAL
  });
  
  // Track multiplayer player states for animations
  const [multiplayerPlayerStates, setMultiplayerPlayerStates] = useState<Map<string, {
    isCharging: boolean;
    chargeProgress: number;
    isSwinging: boolean;
    swordComboStep: 1 | 2 | 3;
    isSpinning: boolean;
    isSwordCharging: boolean;
    isDeflecting: boolean;
    isViperStingCharging: boolean;
    viperStingChargeProgress: number;
    isBarrageCharging: boolean;
    barrageChargeProgress: number;
    isCobraShotCharging: boolean;
    cobraShotChargeProgress: number;
    isSkyfalling: boolean;
    isBackstabbing: boolean;
    // Add missing Runeblade animation states
    isSmiting: boolean;
    isColossusStriking?: boolean;
    isWindShearing?: boolean;
    isWindShearCharging?: boolean;
    windShearChargeProgress?: number;
    isDeathGrasping: boolean;
    isWraithStriking: boolean;
    isCorruptedAuraActive: boolean;
    isSundering?: boolean;
    isSummonTotemCharging?: boolean;
    summonTotemChargeProgress?: number;
    isFrozen?: boolean;
    lastAttackType?: string;
    lastAttackTime?: number;
    lastAnimationUpdate?: number;
  }>>(new Map());
  
  // Perfect shot system
  const { createPowershotEffect } = useBowPowershot();
  
  // Optimized PVP effects with object pooling
  const { createOptimizedVenomEffect, createOptimizedDebuffEffect, getPoolStats } = useOptimizedPVPEffects();

// Mana regeneration for weapons that use mana (Scythe and Runeblade)
useEffect(() => {
  // Continuous mana regeneration for all weapons (resources regenerate even when not using that weapon)
  const interval = setInterval(() => {
    setWeaponManaResources(prev => {
      const updated = { ...prev };

      // Mana regeneration for Scythe (10 mana per second = 5 every 500ms)
      const scytheMaxMana = getMaxManaForWeapon(WeaponType.SCYTHE, playerLevel);
      if (updated[WeaponType.SCYTHE] < scytheMaxMana) {
        updated[WeaponType.SCYTHE] = Math.min(scytheMaxMana, updated[WeaponType.SCYTHE] + 5);
      }

      // Mana regeneration for Runeblade (8 mana per second = 4 every 500ms)
      const runebladeMaxMana = getMaxManaForWeapon(WeaponType.RUNEBLADE, playerLevel);
      if (updated[WeaponType.RUNEBLADE] < runebladeMaxMana) {
        updated[WeaponType.RUNEBLADE] = Math.min(runebladeMaxMana, updated[WeaponType.RUNEBLADE] + 2);
      }

      return updated;
    });
  }, 500);

  return () => clearInterval(interval);
}, [playerLevel]);

// Handle mana capacity increase when leveling up
useEffect(() => {
  // When player levels up, increase mana capacity for Scythe and Runeblade
  setWeaponManaResources(prev => {
    const updated = { ...prev };
    
    // Update Scythe mana capacity
    const scytheMaxMana = getMaxManaForWeapon(WeaponType.SCYTHE, playerLevel);
    if (updated[WeaponType.SCYTHE] < scytheMaxMana) {
      updated[WeaponType.SCYTHE] = scytheMaxMana; // Fill to new max capacity
    }
    
    // Update Runeblade mana capacity
    const runebladeMaxMana = getMaxManaForWeapon(WeaponType.RUNEBLADE, playerLevel);
    if (updated[WeaponType.RUNEBLADE] < runebladeMaxMana) {
      updated[WeaponType.RUNEBLADE] = runebladeMaxMana; // Fill to new max capacity
    }
    
    return updated;
  });
}, [playerLevel]);

  // Sync currentWeapon with weaponState
  useEffect(() => {
    setCurrentWeapon(weaponState.currentWeapon);
  }, [weaponState.currentWeapon]);

// Update max mana display based on current weapon and level (but don't reset the actual mana value)
useEffect(() => {
  if (currentWeapon === WeaponType.SCYTHE) {
    setMaxMana(getMaxManaForWeapon(WeaponType.SCYTHE, playerLevel));
  } else if (currentWeapon === WeaponType.RUNEBLADE) {
    setMaxMana(getMaxManaForWeapon(WeaponType.RUNEBLADE, playerLevel));
  } else {
    setMaxMana(0); // No mana for other weapons
  }
}, [currentWeapon, playerLevel]);

// Function to consume mana for weapon abilities (Scythe and Runeblade)
const consumeMana = useCallback((amount: number) => {
  if (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) {
    setWeaponManaResources(prev => ({
      ...prev,
      [currentWeapon]: Math.max(0, prev[currentWeapon] - amount)
    }));
  }
}, [currentWeapon]);

// Function to check if current weapon has enough mana
const hasMana = useCallback((amount: number) => {
  const result = currentMana >= amount;
  return result;
}, [currentMana]);

  // Set up PVP event listeners for player actions and damage
  useEffect(() => {
    if (!socket) return;

    const handlePlayerAttack = (data: any) => {
      // CRITICAL FIX: Never process our own attacks to prevent duplicate projectiles and damage
      if (data.playerId === socket.id) {
        return;
      }
      
      if (engineRef.current) {
        // NOTE: bow_release attacks are no longer broadcast to avoid duplicate damage
        // Perfect shot visual effects are now handled via the projectile system broadcasts
        
        // Handle special ability projectiles that need custom visual effects
        if (data.attackType === 'viper_sting_projectile') {

          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          // Create the ECS projectile for damage (this is needed for collision detection)
          const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
          if (projectileSystem) {
            const attackerEntityId = serverPlayerEntities.current.get(data.playerId) || -Math.abs(data.playerId.length * 1000 + Date.now() % 1000);

            // Create Viper Sting projectile for damage
            projectileSystem.createProjectile(
              engineRef.current.getWorld(),
              position,
              direction,
              attackerEntityId,
              { speed: 16, damage: 61, lifetime: 5, piercing: true, opacity: 0.8, projectileType: 'viper_sting', sourcePlayerId: data.playerId }
            );
          }
          
          // For PVP broadcasts, normalize the position and direction to be flat for visual effect
          const flatPosition = position.clone();
          flatPosition.y = 1.5; // Fixed height for visual consistency
          
          const flatDirection = direction.clone();
          flatDirection.y = 0; // Remove vertical component
          flatDirection.normalize(); // Ensure it's still a unit vector
          
          // Create visual effect from the remote player's position but with flat trajectory
          // This will show the Viper Sting projectile coming from the correct player but flat
          const success = triggerGlobalViperSting(flatPosition, flatDirection);
          if (success) {
          }
          
          return;
        }
        
        if (data.attackType === 'cobra_shot_projectile') {
          // Note: Cobra Shot damage is handled by PVPCobraShotManager through visual projectiles
          // No need to create ECS projectiles that show up as regular arrows
          
          // Trigger visual effect for Cobra Shot projectile (this creates the visual projectile that PVPCobraShotManager monitors)
          const { triggerGlobalCobraShot } = require('@/components/projectiles/CobraShotManager');
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          triggerGlobalCobraShot(position, direction);
          
          return;
        }
        
        // Handle sword charge hit attacks
        if (data.attackType === 'sword_charge_hit') {
          
          // Validate animationData object exists and has required properties
          if (!data.animationData || typeof data.animationData.damage !== 'number' || typeof data.animationData.targetId !== 'number') {
            return;
          }
          
          // Check if this hit targets the local player
          const targetEntityId = serverPlayerEntities.current.get(socket?.id || '');
          if (targetEntityId === data.animationData.targetId) {
            // Apply damage directly to local player
            if (playerEntity && broadcastPlayerDamage && socket?.id) {
              const health = playerEntity.getComponent(Health);
              if (health) {
                // Apply damage through PVP system
                broadcastPlayerDamage(socket.id, data.animationData.damage);
              }
            }
          }
          
          return; // Don't process as regular projectile
        }
        
        // Handle regular projectile attacks - create projectiles that can hit the local player
        const projectileTypes = ['regular_arrow', 'charged_arrow', 'entropic_bolt', 'crossentropy_bolt', 'perfect_shot', 'barrage_projectile', 'burst_arrow'];
        if (projectileTypes.includes(data.attackType)) {

          
          // Create a projectile that can damage the local player
          const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
          if (projectileSystem) {
            // Use pooled Vector3 objects for better performance
            const position = pvpObjectPool.acquireVector3(data.position.x, data.position.y, data.position.z);
            const direction = pvpObjectPool.acquireVector3(data.direction.x, data.direction.y, data.direction.z);
            
            // Get the attacker's local ECS entity ID (if it exists) or use a unique negative ID
            const attackerEntityId = serverPlayerEntities.current.get(data.playerId) || -Math.abs(data.playerId.length * 1000 + Date.now() % 1000);
            
            // Create appropriate projectile type with PVP damage enabled
            switch (data.attackType) {
              case 'regular_arrow':
                projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId, // Use attacker's entity ID as owner
                  { speed: 25, damage: 10, lifetime: 3, maxDistance: 25, opacity: 0.8, sourcePlayerId: data.playerId } // PVP damage handled by CombatSystem
                );
                break;
              case 'charged_arrow':
                // Only create visual effect for charged arrows - no damage-dealing projectile
                // The local player already created the damage-dealing projectile
                
                // Create charged arrow visual effect for other players with flat positioning
                const chargedPlayer = players.get(data.playerId);
                const chargedSubclass = chargedPlayer?.subclass || WeaponSubclass.ELEMENTAL;
                
                // For PVP broadcasts, normalize the position and direction to be flat
                const chargedFlatPosition = position.clone();
                chargedFlatPosition.y = 1.5; // Fixed height for visual consistency
                
                const chargedFlatDirection = direction.clone();
                chargedFlatDirection.y = 0; // Remove vertical component
                chargedFlatDirection.normalize(); // Ensure it's still a unit vector
                
                createPowershotEffect(
                  chargedFlatPosition,
                  chargedFlatDirection,
                  chargedSubclass,
                  false, // not a perfect shot
                  true   // isElementalShotsUnlocked
                );
                break;
              case 'entropic_bolt':
                // Use broadcast config data if available, otherwise fall back to defaults
                const entropicConfig = data.animationData?.projectileConfig || {};
                const isCryoflame = entropicConfig.isCryoflame || false;
                
                projectileSystem.createEntropicBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { 
                    speed: entropicConfig.speed || 20, 
                    damage: entropicConfig.damage || 20, 
                    lifetime: entropicConfig.lifetime || 1.75, 
                    piercing: entropicConfig.piercing || false, 
                    opacity: entropicConfig.opacity || 0.8,
                    isCryoflame: isCryoflame // Pass Cryoflame state to projectile system
                  }
                );
                break;
              case 'crossentropy_bolt':
                projectileSystem.createCrossentropyBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { speed: 15, damage: 90, lifetime: 2.5, piercing: false, opacity: 0.8 }
                );
                break;
              case 'perfect_shot':
                // Only create visual effect for perfect shots - no damage-dealing projectile
                // The local player already created the damage-dealing projectile
                
                // Create perfect shot visual effect for other players with flat positioning
                const player = players.get(data.playerId);
                const subclass = player?.subclass || WeaponSubclass.ELEMENTAL;
                
                // For PVP broadcasts, normalize the position and direction to be flat
                const flatPosition = position.clone();
                flatPosition.y = 1.25; // Fixed height for visual consistency
                
                const flatDirection = direction.clone();
                flatDirection.y = 0; // Remove vertical component
                flatDirection.normalize(); // Ensure it's still a unit vector
                
                createPowershotEffect(
                  flatPosition,
                  flatDirection,
                  subclass,
                  true, // isPerfectShot
                  true  // isElementalShotsUnlocked
                );
                break;
              case 'barrage_projectile':
                // Create Barrage projectiles for PVP
                const barrageEntity = projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { speed: 22, damage: 30, lifetime: 3, maxDistance: 25, piercing: false, opacity: 0.8, sourcePlayerId: data.playerId }
                );
                
                // Mark as barrage arrow for proper visual rendering
                const renderer = barrageEntity.getComponent(Renderer);
                if (renderer?.mesh) {
                  renderer.mesh.userData.isBarrageArrow = true;
                  renderer.mesh.userData.isRegularArrow = false;
                }
                break;
              case 'burst_arrow':
                // Create Tempest Rounds burst projectiles for PVP
                const burstEntity = projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { speed: 25, damage: 30, lifetime: 3, maxDistance: 25, piercing: false, opacity: 0.8, projectileType: 'burst_arrow', sourcePlayerId: data.playerId }
                );
                
                // Mark as burst arrow for proper visual rendering (teal color)
                const burstRenderer = burstEntity.getComponent(Renderer);
                if (burstRenderer?.mesh) {
                  burstRenderer.mesh.userData.isBurstArrow = true;
                  burstRenderer.mesh.userData.isRegularArrow = false;
                }
                break;
            }
            
            // Release pooled Vector3 objects back to pool after use
            pvpObjectPool.releaseVector3(position);
            pvpObjectPool.releaseVector3(direction);
          }
        }
        
        // Update the player state to show attack animation using batched updates
        const animationData = data.animationData || {};
        const animationUpdateTime = Date.now();
        
        PVPStateUpdateHelpers.batchPlayerStateUpdates(setMultiplayerPlayerStates, [{
          playerId: data.playerId,
          stateUpdate: {
            isSwinging: data.attackType.includes('swing') || (data.attackType.includes('sword') && !data.attackType.includes('charge')),
            isCharging: data.attackType.includes('bow') && data.attackType.includes('charge'),
            isSpinning: data.attackType.includes('scythe') || data.attackType.includes('entropic_bolt') || data.attackType.includes('crossentropy_bolt') || data.attackType.includes('sword_charge_spin') || animationData.isSpinning || false,
            isSwordCharging: data.attackType === 'sword_charge_spin' || data.attackType === 'sword_charge_start' || animationData.isSpinning || animationData.isSwordCharging || false,
            swordComboStep: animationData.comboStep || 1,
            chargeProgress: animationData.chargeProgress || 0,
            lastAttackType: data.attackType,
            lastAttackTime: animationUpdateTime,
            lastAnimationUpdate: animationUpdateTime
          }
        }]);
          
          // Get the player's weapon and subclass for proper animation timing
          const player = players.get(data.playerId);
          const playerWeapon = player?.weapon || WeaponType.BOW;
          const playerSubclass = player?.subclass;
          
          // Calculate weapon-specific animation duration based on actual weapon timing
          // These durations match the real animation calculations in each weapon component
          let resetDuration = 100; // Default
          
          // Special handling for sword charge attacks
          if (data.attackType === 'sword_charge_spin') {
            // Charge spin lasts about 1 full rotation at 27.5 rotation speed
            // (Math.PI * 2) / 27.5 / (1/60) ≈ 685ms for one full rotation
            resetDuration = 50;
          } else if (data.attackType === 'sword_charge_start') {
            // Charge movement lasts about 1.5 seconds (matches ControlSystem chargeDuration)
            resetDuration = 450;
          } else {
            switch (playerWeapon) {
              case WeaponType.SCYTHE:
                // Check if dual wielding (Abyssal subclass level 2+)
                if (playerSubclass === WeaponSubclass.ABYSSAL) {
                  // Dual scythe timing: similar to Sabres with delays
                  resetDuration = 350;
                } else {
                  // Single scythe: swingProgress += delta * 8 until >= Math.PI * 0.85
                  // At 60fps: (Math.PI * 0.85) / 8 / (1/60) ≈ 335ms
                  resetDuration = 167.5;
                }
                break;
              case WeaponType.SWORD:
                // swingProgress += delta * 6.75 until >= Math.PI * 0.55 (or 0.9 for combo step 3)
                // At 60fps: (Math.PI * 0.55) / 6.75 / (1/60) ≈ 400ms
                // Note: 3rd combo hit takes longer but we use average timing for multiplayer sync
                resetDuration = 80
                break;
            case WeaponType.SABRES:
              // Two swings with delays - total duration roughly 350ms
              resetDuration = 275;
              break;
            case WeaponType.RUNEBLADE:
              // Same timing as sword: swingProgress += delta * 6.75 until >= Math.PI * 0.55 (or 0.9 for combo step 3)
              // At 60fps: (Math.PI * 0.55) / 6.75 / (1/60) ≈ 400ms
              // Note: 3rd combo hit takes longer but we use average timing for multiplayer sync
              resetDuration = 80;
              break;
            case WeaponType.BOW:
              resetDuration = 300; // Quick shots
              break;
            default:
              resetDuration = 100; // Default for other weapons
            }
          }
          
          // Schedule animation reset using batched updates
          setTimeout(() => {
            PVPStateUpdateHelpers.batchPlayerStateUpdates(setMultiplayerPlayerStates, [{
              playerId: data.playerId,
              stateUpdate: {
                isSwinging: false,
                isCharging: false,
                isSpinning: false,
                isSwordCharging: false
              }
            }]);
          }, resetDuration);
      }

      // Play enemy sound effects at 50% volume
      const position = new Vector3(data.position.x, data.position.y, data.position.z);
      if (window.audioSystem) {
        switch (data.attackType) {
          case 'viper_sting_projectile':
            window.audioSystem.playEnemyViperStingReleaseSound(position);
            break;
          case 'cobra_shot_projectile':
            // Cobra shot uses bow release sound
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'regular_arrow':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'charged_arrow':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'perfect_shot':
            window.audioSystem.playEnemyBowReleaseSound(position, 1.0); // Perfect shot is max charge
            break;
          case 'barrage_projectile':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'burst_arrow':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'entropic_bolt':
            window.audioSystem.playEnemyEntropicBoltSound(position);
            break;
          case 'crossentropy_bolt':
            window.audioSystem.playEnemyCrossentropySound(position);
            break;
          case 'sword_swing':
            window.audioSystem.playEnemySwordSwingSound(data.animationData?.comboStep || 1, position);
            break;
          case 'runeblade_swing':
            window.audioSystem.playEnemySwordSwingSound(data.animationData?.comboStep || 1, position);
            break;
          case 'sabres_swing':
            window.audioSystem.playEnemySabresSwingSound(position);
            break;
          case 'scythe_swing':
            window.audioSystem.playEnemyEntropicBoltSound(position);
            break;
        }
      }
    };

    const handlePlayerAbility = (data: any) => {
      if (data.playerId !== socket.id) {
        // Handle special abilities like Viper Sting, Barrage
        if (data.abilityType === 'viper_sting') {

          // Create Viper Sting visual effect from the remote player's position and direction
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // For PVP broadcasts, normalize the position and direction to be flat
          const flatPosition = position.clone();
          flatPosition.y = 1.5; // Fixed height for visual consistency
          
          const flatDirection = direction.clone();
          flatDirection.y = 0; // Remove vertical component
          flatDirection.normalize(); // Ensure it's still a unit vector
          
          // Trigger Viper Sting visual effect with flat position and direction
          // This will create the projectile from the correct player's position but flat
          // Pass caster ID so projectile returns to the correct player
          const success = triggerGlobalViperSting(flatPosition, flatDirection, data.playerId);
          if (success) {
          }
          
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isViperStingCharging: true,
              viperStingChargeProgress: 1.0 // Full charge when triggered
            });
            
            // Reset Viper Sting state after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isViperStingCharging: false,
                    viperStingChargeProgress: 0
                  });
                }
                return updated;
              });
            }, 2000); // Viper Sting lasts 2 seconds
            
            return updated;
          });
        } else if (data.abilityType === 'cloudkill') {
          // Cloudkill ability - use the target positions from when the ability was originally cast
          // Check if target positions are included in the broadcast data
          if (data.targetPositions && Array.isArray(data.targetPositions)) {
            // Use the original target positions from the caster
            triggerGlobalCloudkillWithTargets(data.targetPositions, data.playerId);
          } else {
            // Fallback to old behavior for compatibility (should be removed after testing)
            if (playerEntityRef.current !== null && engineRef.current) {
              const world = engineRef.current.getWorld();
              const localPlayerEntity = world.getEntity(playerEntityRef.current);
              if (localPlayerEntity) {
                const localPlayerTransform = localPlayerEntity.getComponent(Transform);
                if (localPlayerTransform) {
                  const localPosition = localPlayerTransform.position.clone();
                  triggerGlobalCloudkill(localPosition, data.playerId);
                }
              }
            }
          }
        } else if (data.abilityType === 'frost_nova') {
          // Create frost nova visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpFrostNovaEffect(data.playerId, position);
          
          // Note: PVP damage and freeze effects are now handled by PVPFrostNovaManager
        } else if (data.abilityType === 'reanimate') {

          // Create reanimate visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpReanimateEffect(data.playerId, position);
        } else if (data.abilityType === 'smite') {

          // Create smite visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpSmiteEffect(data.playerId, position, undefined); // No healing callback for remote players

          // Update player state to show smiting animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isSmiting: true
            });

            // Reset smite state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSmiting: false
                  });
                }
                return updated;
              });
            }, 900); // Smite animation duration

            return updated;
          });
        } else if (data.abilityType === 'colossusStrike') {

          // Create colossus strike visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const damage = (data.extraData && data.extraData.damage) ? data.extraData.damage : 100;
          createPvpColossusStrikeEffect(data.playerId, position, damage, undefined); // No healing callback for remote players

          // Update player state to show colossus striking animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isCrossentropyCharging: false,
              crossentropyChargeProgress: 0,
              isSmiting: false,
              isColossusStriking: false,
              isDeathGrasping: false,
              isCorruptedAuraActive: false,
              isWraithStriking: false,
              isSkyfalling: false,
              isBackstabbing: false,
              isSundering: false,
              isStealthing: false,
              isInvisible: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isColossusStriking: true
            });

            // Reset colossus strike state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isColossusStriking: false
                  });
                }
                return updated;
              });
            }, 1200); // Colossus Strike animation duration

            return updated;
          });
        } else if (data.abilityType === 'windShear') {

          // Create wind shear projectile visual effect
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          createPvpWindShearEffect(data.playerId, position, direction);

          // Update player state to show wind shearing animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isCrossentropyCharging: false,
              crossentropyChargeProgress: 0,
              isSmiting: false,
              isColossusStriking: false,
              isWindShearing: false,
              isWindShearCharging: false,
              windShearChargeProgress: 0,
              isDeathGrasping: false,
              isCorruptedAuraActive: false,
              isWraithStriking: false,
              isSkyfalling: false,
              isBackstabbing: false,
              isSundering: false,
              isStealthing: false,
              isInvisible: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isWindShearing: true
            });

            // Reset wind shear state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isWindShearing: false,
                    isWindShearCharging: false,
                    windShearChargeProgress: 0
                  });
                }
                return updated;
              });
            }, 200); // Wind shear animation duration

            return updated;
          });
        } else if (data.abilityType === 'deathgrasp') {

          // Create death grasp visual effect
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          const targetPosition = position.clone().add(direction.clone().multiplyScalar(8));

          createPvpDeathGraspEffect(data.playerId, position, direction);

          // Update player state to show death grasping animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isDeathGrasping: true
            });

            // Reset death grasp state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isDeathGrasping: false
                  });
                }
                return updated;
              });
            }, 1200); // Death grasp animation duration

            return updated;
          });

          // Find target player to pull (closest player in front of caster)
          let closestTarget: { id: string; distance: number } | null = null;
          players.forEach((player: any) => {
            if (player.id === data.playerId) return; // Don't pull self

            const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
            const distance = position.distanceTo(playerPos);

            // Check if player is in front of caster and within range
            const toPlayer = playerPos.clone().sub(position).normalize();
            const dotProduct = direction.dot(toPlayer);

            if (dotProduct > 0.5 && distance <= 8) { // 60 degree cone, 8 unit range
              if (!closestTarget || distance < closestTarget.distance) {
                closestTarget = { id: player.id, distance };
              }
            }
          });

          // Pull the closest target player if found
          if (closestTarget !== null && closestTarget !== undefined) {
            const target = closestTarget as { id: string; distance: number };
            createPvpDeathGraspPull(target.id, position);
          }
        } else if (data.abilityType === 'wraith_strike') {

          // Update player state to show wraith striking animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isWraithStriking: true
            });

            // Reset wraith strike state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isWraithStriking: false
                  });
                }
                return updated;
              });
            }, 550); // Wraith strike animation duration

            return updated;
          });

          // Create Haunted Soul effect for remote players
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          setPvpHauntedSoulEffects(prev => [...prev, {
            id: Date.now(),
            playerId: data.playerId,
            position: position,
            startTime: Date.now(),
            duration: 800 // Match the effect duration
          }]);
        } else if (data.abilityType === 'charge') {
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isSwordCharging: true
            });
            
            // Reset Charge state after duration (charge lasts about 2 seconds)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSwordCharging: false
                  });
                }
                return updated;
              });
            }, 2000);
            
            return updated;
          });
        } else if (data.abilityType === 'deflect') {
          
          // Trigger visual Deflect Shield effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // Calculate rotation from direction for shield positioning
          const rotation = new Vector3(0, Math.atan2(direction.x, direction.z), 0);
          triggerGlobalDeflectShield(position, rotation, data.playerId);
          
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isDeflecting: true
            });
            
            // Reset Deflect state after duration (deflect lasts 3 seconds)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isDeflecting: false
                  });
                }
                return updated;
              });
            }, 3000);
            
            return updated;
          });
        } else if (data.abilityType === 'skyfall') {
          
          // Set the skyfall animation state for the attacking player
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isSkyfalling: true
            });
            
            // Reset Skyfall state after duration (skyfall lasts about 3-4 seconds total)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSkyfalling: false
                  });
                }
                return updated;
              });
            }, 1750); // Skyfall duration
            
            return updated;
          });
        } else if (data.abilityType === 'backstab') {
          
          // Backstab is an instant melee attack, so we need to:
          // 1. Calculate damage based on position relative to targets
          // 2. Apply damage to players in range
          // 3. Show brief animation state
          
          const attackerPosition = new Vector3(data.position.x, data.position.y, data.position.z);
          const attackerDirection = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // Set the backstab animation state for the attacking player
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isDeflecting: false,
              isSwordCharging: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            // Set backstab animation state
            updated.set(data.playerId, {
              ...currentState,
              isBackstabbing: true
            });
            
            // Reset backstab animation after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const currentState = updated.get(data.playerId);
                if (currentState) {
                  updated.set(data.playerId, {
                    ...currentState,
                    isBackstabbing: false
                  });
                }
                return updated;
              });
            }, 1000); // Match backstab duration
            
            return updated;
          });
          
          // Find the attacker player to get their rotation
          const attackerPlayer = players.get(data.playerId);
          if (attackerPlayer) {
            // Check if local player is in range and calculate damage
            const localPlayer = players.get(socket?.id || '');
            if (localPlayer && socket?.id !== data.playerId) {
              const localPlayerPos = new Vector3(localPlayer.position.x, localPlayer.position.y, localPlayer.position.z);
              const distance = attackerPosition.distanceTo(localPlayerPos);
              
              if (distance <= 2.5) { // Backstab range
                // Check if attacker is in front of local player (cone attack)
                const directionToLocal = new Vector3()
                  .subVectors(localPlayerPos, attackerPosition)
                  .normalize();
                
                const dotProduct = attackerDirection.dot(directionToLocal);
                const angleThreshold = Math.cos(Math.PI / 3); // 60 degree cone
                
                if (dotProduct >= angleThreshold) {
                  // Local player is in the attack cone, calculate backstab damage
                  let damage = 75; // Base damage
                  let isBackstab = false;
                  
                  // Calculate local player's facing direction from their rotation
                  const localFacingDirection = new Vector3(
                    Math.sin(localPlayer.rotation.y),
                    0,
                    Math.cos(localPlayer.rotation.y)
                  ).normalize();
                  
                  // Vector from local player to attacker
                  const attackerDirectionFromLocal = new Vector3()
                    .subVectors(attackerPosition, localPlayerPos)
                    .normalize();
                  
                  // Check if attacker is behind local player (dot product < 0 means opposite direction)
                  const behindDotProduct = localFacingDirection.dot(attackerDirectionFromLocal);
                  isBackstab = behindDotProduct < -0.3; // 70 degree cone behind target
                  
                  if (isBackstab) {
                    damage = 150; // Backstab damage
                  }
                  
                  // Apply damage to local player
                  if (broadcastPlayerDamage && socket?.id) {
                    broadcastPlayerDamage(socket.id, damage, 'backstab');
                  }
                }
              }
            }
          }
          
          // Show brief backstab animation state
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isSwinging: true // Brief swing animation for backstab
            });
            
            // Reset swing state after brief duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSwinging: false
                  });
                }
                return updated;
              });
            }, 300); // Brief 300ms animation
            
            return updated;
          });
        } else if (data.abilityType === 'sunder') {

          // Set the sunder animation state for the attacking player
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isSundering: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isSundering: true
            });

            // Reset sunder animation after duration (match the 1.5 second duration from ControlSystem)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSundering: false
                  });
                }
                return updated;
              });
            }, 1500); // Sunder animation duration

            return updated;
          });
        } else if (data.abilityType === 'summon_totem') {
          // Trigger remote totem creation via PVPSummonTotemManager

          if ((window as any).triggerGlobalSummonTotem) {
            const position = new Vector3(data.position.x, data.position.y, data.position.z);
            (window as any).triggerGlobalSummonTotem(
              position,
              undefined, // Let PVPSummonTotemManager handle enemy data
              undefined, // Let PVPSummonTotemManager handle damage callback
              undefined, // Let PVPSummonTotemManager handle effects
              undefined, // Let PVPSummonTotemManager handle active effects
              undefined, // Let PVPSummonTotemManager handle damage numbers
              undefined, // Let PVPSummonTotemManager handle damage number ID
              undefined, // Let PVPSummonTotemManager handle healing
              data.playerId // Pass remote caster ID
            );
          }
        }
      }

      // Play enemy ability sound effects at 50% volume
      const position = new Vector3(data.position.x, data.position.y, data.position.z);
      if (window.audioSystem) {
        switch (data.abilityType) {
          case 'cloudkill':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'frost_nova':
            window.audioSystem.playEnemyFrostNovaSound(position);
            break;
          case 'reanimate':
            // Reanimate doesn't have a specific sound, uses healing sound which is handled separately
            break;
          case 'smite':
            window.audioSystem.playEnemyRunebladeSmiteSound(position);
            break;
          case 'colossusStrike':
            window.audioSystem.playEnemyColossusStrikeSound(position);
            break;
          case 'windShear':
            window.audioSystem.playEnemyWindshearSound(position);
            break;
          case 'deathgrasp':
            window.audioSystem.playEnemyRunebladeVoidGraspSound(position);
            break;
          case 'wraith_strike':
            window.audioSystem.playEnemyRunebladeWraithbladeSound(position);
            break;
          case 'charge':
            window.audioSystem.playEnemySwordChargeSound(position);
            break;
          case 'deflect':
            window.audioSystem.playEnemySwordDeflectSound(position);
            break;
          case 'skyfall':
            window.audioSystem.playEnemySabresSkyfallSound(position);
            break;
          case 'backstab':
            window.audioSystem.playEnemyBackstabSound(position);
            break;
          case 'sunder':
            window.audioSystem.playEnemySabresFlourishSound(position);
            break;
          case 'stealth':
            window.audioSystem.playEnemySabresShadowStepSound(position);
            break;
        }
      }
    };

    const handlePlayerDamaged = (data: any) => {
      let targetActuallyDied = false;

      // Update the players Map for the damaged player (for remote player health bar display)
      // Skip local player - local Health component is authoritative
      if (data.targetPlayerId !== socket?.id && data.newHealth !== undefined) {
        setPlayers(prevPlayers => {
          const newPlayers = new Map(prevPlayers);
          const player = newPlayers.get(data.targetPlayerId);
          if (player) {
            newPlayers.set(data.targetPlayerId, {
              ...player,
              health: data.newHealth,
              maxHealth: data.maxHealth ?? player.maxHealth,
              shield: data.newShield !== undefined ? data.newShield : player.shield,
              maxShield: data.maxShield ?? player.maxShield
            });
          }
          return newPlayers;
        });
      }

      // If we are the target, apply damage to our player
      if (data.targetPlayerId === socket?.id && playerEntity && socket?.id) {
        // Check if player is already in death state - if so, ignore damage
        const deathState = playerDeathStates.get(socket.id);
        if (deathState?.isDead) {
          return;
        }
        const health = playerEntity.getComponent(Health);
        const shield = playerEntity.getComponent(Shield);
        if (health) {
          // Track if player was alive before damage
          const wasAlive = !health.isDead;

          // Pass the entity so Health component can use Shield for damage absorption
          // Bypass invulnerability for PVP damage to allow rapid attacks like bursts to land multiple hits,
          // but respect deflect invulnerability (3 seconds) which is much longer than standard invulnerability (0.5s)
          const bypassInvulnerability = !health.isInvulnerable || health.invulnerabilityTimer <= 1.0;
          health.takeDamage(data.damage, Date.now() / 1000, playerEntity, bypassInvulnerability);

          // Display incoming damage numbers
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              // Use the critical hit information passed from the server
              const isCritical = data.isCritical || false;

              // Directly add damage numbers using the combat system's damage number manager
              const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
              if (damageNumberManager && damageNumberManager.addDamageNumber) {
                const incomingDamagePosition = transform.position.clone();
                incomingDamagePosition.y -= 0.5; // Position below player's feet

                damageNumberManager.addDamageNumber(
                  data.damage,
                  isCritical,
                  incomingDamagePosition,
                  data.damageType,
                  true // isIncomingDamage = true
                );
              }
            }
          }

          // Broadcast shield changes to other players
          if (shield && socket?.id) {
            updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
          }

          // Immediately update game state to ensure health bar reflects current values
          // This bypasses the 100ms throttle to provide instant visual feedback after damage
          if (onGameStateUpdate && controlSystemRef.current) {
            const gameState = {
              playerHealth: health.currentHealth,
              maxHealth: health.maxHealth,
              playerShield: shield ? shield.currentShield : 0,
              maxShield: shield ? shield.maxShield : 0,
              currentWeapon: controlSystemRef.current.getCurrentWeapon(),
              currentSubclass: controlSystemRef.current.getCurrentSubclass(),
              mana: (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) ? currentMana : 0,
              maxMana: (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) ? maxMana : 0
            };
            onGameStateUpdate(gameState);
            
            // CRITICAL FIX: Update the throttle timestamp to prevent the game loop from
            // sending a stale health update that could cause the health bar to briefly
            // flash to a higher value before settling to the correct (damaged) value.
            // This race condition occurs when the game loop reads health BEFORE damage
            // is applied but its state update is processed by React AFTER.
            lastGameStateUpdate.current = Date.now();
          }

          // Also update the local player's entry in the players Map for consistency
          const localPlayerId = socket?.id;
          if (localPlayerId) {
            setPlayers(prevPlayers => {
              const newPlayers = new Map(prevPlayers);
              const player = newPlayers.get(localPlayerId);
              if (player) {
                newPlayers.set(localPlayerId, {
                  ...player,
                  health: health.currentHealth,
                  maxHealth: health.maxHealth,
                  shield: shield ? shield.currentShield : 0,
                  maxShield: shield ? shield.maxShield : 0
                });
              }
              return newPlayers;
            });
          }

          // Check if player just died
          if (wasAlive && health.isDead) {
            targetActuallyDied = true;
            handlePlayerDeath(socket.id, data.sourcePlayerId);
          }
        }
      }

      // Check if we are the source of damage that killed another player
      // Only award experience if our damage ACTUALLY killed the target (not just what backend thought)
      if (data.sourcePlayerId === socket.id && data.targetPlayerId !== socket.id) {
        // For remote players, we need to check if they actually died
        // STRICT VALIDATION: Only award experience if backend says wasKilled AND health is exactly 0
        const remotePlayerDied = !targetActuallyDied && data.wasKilled && data.newHealth === 0;

        // Additional validation: Check if target player is actually removed from players map (truly dead)
        const targetPlayerStillExists = players.has(data.targetPlayerId);
        
        // All EXP awards are now handled by the server via player-experience-gained events
        // The frontend no longer does any kill detection or EXP calculation
        if (targetActuallyDied || remotePlayerDied) {
        }
      }

      // Check if we are the source of damage that killed a summoned unit
      if (data.sourcePlayerId === socket.id && data.damageType === 'summoned_unit_kill') {
        // EXP award is now handled by the server via player-experience-gained event
      }

      // Check if we are the source of damage that killed an enemy
      if (data.sourcePlayerId === socket.id && data.damageType === 'enemy_kill') {
        // EXP award is now handled by the server via player-experience-gained event
      }

      // Create damage number for visual feedback - ONLY for the local player being damaged
      // This prevents duplicate damage numbers from appearing on multiple screens
      if (onDamageNumbersUpdate && socket.id && data.targetPlayerId === socket.id) {
        // Get the position of the local player (who was damaged)
        const localPlayer = players.get(socket.id);
        if (localPlayer) {
          const damagePosition = new Vector3(
            localPlayer.position.x,
            localPlayer.position.y + 1.5, // Offset above player
            localPlayer.position.z
          );

          const damageNumberId = Math.random().toString(36).substr(2, 9);
          onDamageNumbersUpdate([{
            id: damageNumberId,
            damage: data.damage,
            position: damagePosition,
            isCritical: false, // PVP damage doesn't have crits currently
            timestamp: Date.now(),
            damageType: data.damageType || 'default' // Use the damage type from the broadcast
          }]);
        }
      }
    };

    const handlePlayerAnimationState = (data: any) => {
      
      
      if (data.playerId !== socket.id) {
        setMultiplayerPlayerStates(prev => {
          const updated = new Map(prev);
          const currentState = updated.get(data.playerId) || {
            isCharging: false,
            chargeProgress: 0,
            isSwinging: false,
            swordComboStep: 1 | 2 | 3,
            isSpinning: false,
            isSwordCharging: false,
            isDeflecting: false,
            isViperStingCharging: false,
            viperStingChargeProgress: 0,
            isBarrageCharging: false,
            barrageChargeProgress: 0,
            isCobraShotCharging: false,
            cobraShotChargeProgress: 0,
            isBackstabbing: false,
            // Add missing Runeblade animation states
            isSmiting: false,
            isDeathGrasping: false,
            isWraithStriking: false,
            isCorruptedAuraActive: false,
            isSundering: false,
            isFrozen: false
          };
          
          // Update with the received animation state
          const newState = {
            ...currentState,
            ...data.animationState,
            lastAnimationUpdate: Date.now()
          };



          updated.set(data.playerId, newState);

          // NOTE: Melee attack sounds (isSwinging) are handled by handlePlayerAttack
          // to avoid duplicate sounds and ensure correct weapon type is used based on attackType.
          // Only handle charging sounds here since those are for charge start transitions.
          
          const position = new Vector3(data.position?.x || 0, data.position?.y || 0, data.position?.z || 0);
          if (window.audioSystem && data.animationState) {
            // Handle charging sounds - only play when charging starts (transitions from false to true)
            if (data.animationState.isCharging && !currentState.isCharging) {
              const player = players.get(data.playerId);
              const weaponType = player?.weapon;

              // Only play charging sound if we know the weapon type
              if (weaponType === WeaponType.BOW) {
                window.audioSystem.playEnemyBowDrawSound(position);
              } else if (weaponType === WeaponType.SWORD) {
                window.audioSystem.playEnemySwordChargeSound(position);
              }
            }
          }

          return updated;
        });
      }
    };

    const handlePlayerEffect = (data: any) => {

      if (data.effect?.type === 'venom') {
        const { targetPlayerId, position, duration } = data.effect;

        // Create venom effect on the target player (could be local player or other player)
        if (targetPlayerId && position) {
          const venomPosition = new Vector3(position.x, position.y, position.z);
          createPvpVenomEffect(targetPlayerId, venomPosition);
        }
      }

      if (data.effect?.type === 'mist') {
        const { effectType, position, duration } = data.effect;

        // Create Sabre Reaper Mist effect at the specified position
        if (position) {
          const mistPosition = new Vector3(position.x, position.y, position.z);

          const effectId = `mist_${data.playerId}_${Date.now()}_${Math.random()}`;
          const newEffect = {
            id: effectId,
            position: mistPosition,
            startTime: Date.now(),
            effectType
          };

          setActiveMistEffects(prev => {
            const newEffects = [...prev, newEffect];
            return newEffects;
          });

          // Remove effect after duration (1 second)
          setTimeout(() => {
            setActiveMistEffects(prev => {
              const filtered = prev.filter(effect => effect.id !== effectId);
              return filtered;
            });
          }, duration || 1000);
        }
      }

      if (data.effect?.type === 'deathgrasp_pull') {
        const { targetPlayerId, position, casterId } = data.effect;

        // If this client is the target player, update the local position
        if (targetPlayerId === socket?.id && position) {
          const pullPosition = new Vector3(position.x, position.y, position.z);

          // Update local player entity position
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              transform.setPosition(pullPosition.x, pullPosition.y, pullPosition.z);
            }
          }
        }
      }
    };

    const handlePlayerDebuff = (data: any) => {

      const { targetPlayerId, debuffType, duration, effectData } = data;
      
      if (targetPlayerId && debuffType && duration) {
        let position: Vector3;
        
        // If this is the local player being debuffed, use the local player entity position for accuracy
        if (targetPlayerId === socket?.id && playerEntity) {
          const transform = playerEntity.getComponent(Transform);
          if (transform) {
            position = transform.position.clone();
          } else {
            // Fallback to current player position from state
            position = playerPosition.clone();
          }
        } else {
          // For other players, use the multiplayer context or effectData
          const targetPlayer = players.get(targetPlayerId);
          position = targetPlayer 
            ? new Vector3(targetPlayer.position.x, targetPlayer.position.y, targetPlayer.position.z)
            : (effectData?.position 
                ? new Vector3(effectData.position.x, effectData.position.y, effectData.position.z)
                : new Vector3(0, 0, 0));
        }
        
        createPvpDebuffEffect(targetPlayerId, debuffType, position, duration);
      }
    };

    const handlePlayerStealth = (data: any) => {

      if (!data || !data.playerId) {
        return;
      }

      const { playerId, isInvisible } = data;

      // Update stealth state for the player - use setState to trigger re-render
      setPlayerStealthStates(prev => {
        const updated = new Map(prev);
        updated.set(playerId, isInvisible);
        return updated;
      });

      // Update tower system stealth state so towers don't target invisible players
      if (towerSystemRef.current) {
        towerSystemRef.current.updatePlayerStealthState(playerId, isInvisible);
      }

    };

    const handlePlayerTornadoEffect = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, duration } = data;

      // Create the tornado effect for the remote player
      createPvpWindShearTornadoEffect(playerId, duration);
    };

    const handlePlayerDeathEffect = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, position, isStarting } = data;

      if (isStarting) {
        // Start death effect
        setDeathEffects(prev => {
          const newEffects = new Map(prev);
          newEffects.set(playerId, {
            playerId,
            position: new Vector3(position.x, position.y, position.z),
            startTime: Date.now(),
            isActive: true
          });
          return newEffects;
        });
      } else {
        // Stop death effect
        setDeathEffects(prev => {
          const newEffects = new Map(prev);
          newEffects.delete(playerId);
          return newEffects;
        });
      }
    };

    const handlePlayerShieldChanged = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, shield, maxShield } = data;

      // Skip shield updates for the local player - local Shield component is authoritative
      // This prevents shield bar flickering from race conditions between local and server state
      if (playerId === socket?.id) {
        return;
      }

      // Update the player's shield in the players state
      setPlayers(prevPlayers => {
        const newPlayers = new Map(prevPlayers);
        const player = newPlayers.get(playerId);
        if (player) {
          newPlayers.set(playerId, {
            ...player,
            shield: shield,
            maxShield: maxShield ?? player.maxShield
          });
        }
        return newPlayers;
      });
    };

    const handlePlayerKnockback = (data: any) => {
      if (!data || !data.targetPlayerId) {
        return;
      }

      const { targetPlayerId, direction, distance, duration } = data;

      // Find the target player entity
      const targetEntityId = serverPlayerEntities.current.get(targetPlayerId);
      if (!targetEntityId) {
        return;
      }

      // Get the entity from the world
      const world = engineRef.current?.getWorld();
      if (!world) {
        return;
      }

      const targetEntity = world.getEntity(targetEntityId);
      if (!targetEntity) {
        return;
      }

      // Get the movement component
      const targetMovement = targetEntity.getComponent(Movement);
      if (!targetMovement) {
        return;
      }

      // Get the transform component for current position
      const targetTransform = targetEntity.getComponent(Transform);
      if (!targetTransform) {
        return;
      }

      // Apply knockback
      const knockbackDirection = new Vector3(direction.x, direction.y, direction.z);
      const currentTime = Date.now() / 1000; // Convert to seconds

      targetMovement.applyKnockback(
        knockbackDirection,
        distance,
        targetTransform.position.clone(),
        currentTime,
        duration
      );
    };

    const handlePlayerKill = (data: any) => {
      if (!data || !data.killerId || !data.victimId) {
        return;
      }

      const { killerId, victimId } = data;

      // Increment kill counter for the killer
      incrementKillCount(killerId);

      // Award 20 essence for player kills
      updatePlayerEssence(killerId, 20);
    };

    const handlePillarDestroyed = (data: any) => {
      if (!data || !data.destroyerId) {
        return;
      }

      const { destroyerId } = data;

      // Award 150 essence to the player who destroyed the pillar
      updatePlayerEssence(destroyerId, 150);
    };

    const handlePlayerEssenceChanged = (data: any) => {
      if (!data || !data.playerId || typeof data.essence !== 'number') {
        return;
      }

      const { playerId, essence } = data;

      // Update the players map with new essence
      setPlayers(prevPlayers => {
        const newPlayers = new Map(prevPlayers);
        const player = newPlayers.get(playerId);
        if (player) {
          newPlayers.set(playerId, {
            ...player,
            essence
          });
        }
        return newPlayers;
      });

      // If this is the local player, notify parent component
      if (playerId === socket?.id && onEssenceUpdate) {
        onEssenceUpdate(essence);
      }
    };


  const handlePlayerHealing = (data: any) => {
      const { healingAmount, healingType, position } = data;

      // Get the source player ID from socket data
      const sourcePlayerId = data.sourcePlayerId || data.playerId;

      // Only create damage numbers for healing that affects OTHER players
      // Self-healing damage numbers are already created by ControlSystem locally
      if (socket.id && sourcePlayerId !== socket.id) {
        const damageNumberManager = (window as any).damageNumberManager;
        if (damageNumberManager && position) {
          const healingPosition = new Vector3(position.x, position.y, position.z);
          damageNumberManager.addDamageNumber(
            healingAmount,
            false, // Not critical
            healingPosition,
            `${healingType}_healing`
          );
        }
      }
    };

    const handlePlayerExperienceGained = (data: any) => {
      const { playerId, experienceGained, source, timestamp } = data;

      // Only award EXP to the local player
      if (playerId === socket?.id) {
        setPlayerExperience(prev => {
          const newExp = prev + experienceGained;

          // Check for level up
          const currentLevel = ExperienceSystem.getLevelFromExperience(prev);
          const newLevel = ExperienceSystem.getLevelFromExperience(newExp);

          if (newLevel > currentLevel) {
            setPlayerLevel(newLevel);

            // Update ControlSystem level for rune calculations
            if (controlSystemRef.current) {
              controlSystemRef.current.setWeaponLevel(newLevel);
            }

            // Update max health based on new level
            if (playerEntity) {
              const health = playerEntity.getComponent(Health);
              if (health) {
                const newMaxHealth = ExperienceSystem.getMaxHealthForLevel(newLevel);
                health.maxHealth = newMaxHealth;
              }
            }
          }

          return newExp;
        });
      }
    };

    socket.on('player-attacked', handlePlayerAttack);
    socket.on('player-used-ability', handlePlayerAbility);
    socket.on('player-damaged', handlePlayerDamaged);
    socket.on('player-healing', handlePlayerHealing);
    socket.on('player-experience-gained', handlePlayerExperienceGained);
    socket.on('player-kill', handlePlayerKill);
    socket.on('pillar-destroyed', handlePillarDestroyed);
    socket.on('player-essence-changed', handlePlayerEssenceChanged);
    socket.on('player-animation-state', handlePlayerAnimationState);
    socket.on('player-effect', handlePlayerEffect);
    socket.on('player-debuff', handlePlayerDebuff);
    socket.on('player-stealth', handlePlayerStealth);
    socket.on('player-tornado-effect', handlePlayerTornadoEffect);
    socket.on('player-death-effect', handlePlayerDeathEffect);
    socket.on('player-shield-changed', handlePlayerShieldChanged);
    socket.on('player-knockback', handlePlayerKnockback);


    return () => {
      socket.off('player-attacked', handlePlayerAttack);
      socket.off('player-used-ability', handlePlayerAbility);
      socket.off('player-damaged', handlePlayerDamaged);
      socket.off('player-healing', handlePlayerHealing);
      socket.off('player-experience-gained', handlePlayerExperienceGained);
      socket.off('player-kill', handlePlayerKill);
      socket.off('player-animation-state', handlePlayerAnimationState);
      socket.off('player-effect', handlePlayerEffect);
      socket.off('player-debuff', handlePlayerDebuff);
      socket.off('player-stealth', handlePlayerStealth);
      socket.off('player-tornado-effect', handlePlayerTornadoEffect);
      socket.off('player-death-effect', handlePlayerDeathEffect);
      socket.off('player-shield-changed', handlePlayerShieldChanged);
      socket.off('player-knockback', handlePlayerKnockback);
    };
  }, [socket, playerEntity]);

  // Add a cleanup effect to prevent stuck animations
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setMultiplayerPlayerStates(prev => {
        const updated = new Map(prev);
        const now = Date.now();
        let hasChanges = false;
        
        updated.forEach((state, playerId) => {
          // If an animation has been active for more than 3 seconds, force reset it
          if (state.lastAnimationUpdate && now - state.lastAnimationUpdate > 3000) {
            if (state.isSwinging || state.isCharging || state.isSpinning) {
              updated.set(playerId, {
                ...state,
                isSwinging: false,
                isCharging: false,
                isSpinning: false
              });
              hasChanges = true;
            }
          }
        });
        
        return hasChanges ? updated : prev;
      });
    }, 1000); // Check every second
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Sync server players and towers with local ECS entities for PVP damage system
  useEffect(() => {
    if (!engineRef.current || !gameStarted) return;
    
    const world = engineRef.current.getWorld();
    
    // Create local ECS entities for other players (for collision detection)
    players.forEach((serverPlayer, playerId) => {
      // Skip our own player
      if (playerId === socket?.id) return;
      
      if (!serverPlayerEntities.current.has(playerId)) {
        // Create a new local ECS entity for this server player
        const entity = world.createEntity();
        
        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
        entity.addComponent(transform);

        // Add InterpolationBuffer component for smooth movement
        const interpolationBuffer = world.createComponent(InterpolationBuffer);
        entity.addComponent(interpolationBuffer);
        
        // Add Health component (for PVP damage)
        const health = new Health(serverPlayer.maxHealth);
        health.currentHealth = serverPlayer.health;
        entity.addComponent(health);

        // Add Shield component (for PVP damage)
        const shield = new Shield(250, 20, 2.5); // 100 max shield, 20/s regen, 5s delay
        entity.addComponent(shield);

        // Add Movement component for equal collision treatment with local player
        // Remote players don't use this for actual movement (they're position-synced from server)
        // but having it ensures equal collision resolution in CollisionSystem
        const movement = world.createComponent(Movement);
        movement.maxSpeed = 3.75; // Match local player settings
        movement.jumpForce = 8;
        movement.friction = 0.85;
        movement.canMove = false; // Disable actual movement since position comes from server
        entity.addComponent(movement);
        
        // Add Collider component for PVP damage detection
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        collider.radius = 0.9; // Reduced collision radius for better player proximity in PVP
        collider.layer = CollisionLayer.ENEMY; // Use enemy layer so projectiles can hit remote players in PVP
        // Set collision mask to collide with environment only - NO player-to-player collision in PVP
        collider.setMask(CollisionLayer.ENVIRONMENT);
        collider.setOffset(0, 0.25, 0); // Center on player
        entity.addComponent(collider);
        
        // Notify systems that the entity is ready
        world.notifyEntityAdded(entity);
        
      // Store the mapping
      serverPlayerEntities.current.set(playerId, entity.id);

      // Update tower system player mapping
      if (towerSystemRef.current && socket?.id) {
        towerSystemRef.current.setPlayerMapping(serverPlayerEntities.current, socket.id);
        // Initialize player levels for tower damage scaling
        towerSystemRef.current.initializePlayerLevels(players);
      }
    
      } else {
        // Update existing local ECS entity
        const entityId = serverPlayerEntities.current.get(playerId)!;
        const entity = world.getEntity(entityId);
        
        if (entity) {
          // Update position using interpolation buffer for remote players only
          const transform = entity.getComponent(Transform);
          const interpolationBuffer = entity.getComponent(InterpolationBuffer);
          if (transform && interpolationBuffer) {
            // Create rotation quaternion from Euler angles
            const rotation = new Quaternion();
            rotation.setFromEuler(new Euler(serverPlayer.rotation.x, serverPlayer.rotation.y, serverPlayer.rotation.z));

            // Add server state to interpolation buffer for smooth remote player movement
            const position = new Vector3(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
            interpolationBuffer.addServerState(position, rotation);
          } else if (transform) {
            // Fallback to direct position update if interpolation buffer not available
            transform.setPosition(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
          }
          
          // Reset velocity for remote players to prevent drift from collision resolution
          const movement = entity.getComponent(Movement);
          if (movement) {
            movement.velocity.set(0, 0, 0); // Clear any velocity from collision resolution
            movement.acceleration.set(0, 0, 0); // Clear acceleration
          }
          
          // Update health
          const health = entity.getComponent(Health);
          if (health) {
            const wasAlive = !health.isDead;
            health.maxHealth = serverPlayer.maxHealth;
            health.currentHealth = serverPlayer.health;

            // Check if remote player just died
            if (wasAlive && health.isDead) {
              // For remote players, we don't know who killed them from server updates
              // This will be handled by server-side death broadcasts
            }
          }
        }
      }
    });
    
    // Clean up local entities for players that no longer exist
    const currentPlayerIds = new Set(players.keys());
    const entitiesToRemove: string[] = [];
    
    serverPlayerEntities.current.forEach((entityId, playerId) => {
      if (!currentPlayerIds.has(playerId) || playerId === socket?.id) {
        const entity = world.getEntity(entityId);
        if (entity) {
          // Mark entity as dead instead of removing
          const health = entity.getComponent(Health);
          if (health) {
            health.currentHealth = 0;
            health.isDead = true;
          }
        }
        entitiesToRemove.push(playerId);
      }
    });
    
    // Remove from mapping
    entitiesToRemove.forEach(playerId => {
      serverPlayerEntities.current.delete(playerId);
    });
    
    // Create local ECS entities for towers
    towers.forEach((serverTower, towerId) => {
      if (!serverTowerEntities.current.has(towerId)) {
        // Create a new local ECS entity for this server tower
        const entity = world.createEntity();
        
        // Add Transform component
        const transform = world.createComponent(Transform);
        transform.setPosition(serverTower.position.x, serverTower.position.y, serverTower.position.z);
        entity.addComponent(transform);
        
        // Add Tower component
        const tower = world.createComponent(Tower);
        tower.ownerId = serverTower.ownerId;
        tower.towerIndex = serverTower.towerIndex;
        entity.addComponent(tower);
        
        // Add Health component
        const health = new Health(serverTower.maxHealth);
        health.currentHealth = serverTower.health;
        entity.addComponent(health);
        
        // Add Collider component for tower damage detection
        const collider = world.createComponent(Collider);
        collider.type = ColliderType.CYLINDER;
        collider.radius = 1.5; // Tower base radius
        collider.height = 4; // Tower height
        collider.layer = CollisionLayer.ENEMY; // Use enemy layer so projectiles can hit towers
        collider.setMask(CollisionLayer.ENVIRONMENT | CollisionLayer.PLAYER);
        collider.setOffset(0, 2, 0); // Center vertically
        entity.addComponent(collider);
        
        // Notify systems that the entity is ready
        world.notifyEntityAdded(entity);
        
        // Store the mapping
        serverTowerEntities.current.set(towerId, entity.id);
        
  
      } else {
        // Update existing local ECS entity
        const entityId = serverTowerEntities.current.get(towerId)!;
        const entity = world.getEntity(entityId);
        
        if (entity) {
          // Update health
          const health = entity.getComponent(Health);
          if (health) {
            health.maxHealth = serverTower.maxHealth;
            health.currentHealth = serverTower.health;
            if (serverTower.isDead && !health.isDead) {
              health.currentHealth = 0;
              health.isDead = true;
            }
          }
          
          // Update tower state
          const tower = entity.getComponent(Tower);
          if (tower && serverTower.isDead && !tower.isDead) {
            tower.die(Date.now() / 1000);
          }
        }
      }
    });
    
    // Clean up local entities for towers that no longer exist
    const currentTowerIds = new Set(towers.keys());
    const towerEntitiesToRemove: string[] = [];
    
    serverTowerEntities.current.forEach((entityId, towerId) => {
      if (!currentTowerIds.has(towerId)) {
        const entity = world.getEntity(entityId);
        if (entity) {
          // Mark entity as dead instead of removing
          const health = entity.getComponent(Health);
          const tower = entity.getComponent(Tower);
          if (health && tower) {
            health.currentHealth = 0;
            health.isDead = true;
            tower.die(Date.now() / 1000);
          }
        }
        towerEntitiesToRemove.push(towerId);
      }
    });
    
    // Remove from mapping
    towerEntitiesToRemove.forEach(towerId => {
      serverTowerEntities.current.delete(towerId);
    });
  }, [players, towers, gameStarted, socket?.id]);

  // Update tower system player mapping when players change
  useEffect(() => {
    if (towerSystemRef.current && socket?.id) {
      towerSystemRef.current.setPlayerMapping(serverPlayerEntities.current, socket.id);
      // Initialize player levels for tower damage scaling
      towerSystemRef.current.initializePlayerLevels(players);
    }
  }, [players, socket?.id]);

  // Initialize the PVP game engine
  // Function to get cloudkill target positions (replicates CloudkillManager logic)
  const getCloudkillTargetPositions = useCallback((casterPosition: Vector3, casterId: string): Array<{ x: number; y: number; z: number }> => {
    const ARROW_COUNT = 3;
    const allTargets: Array<{ id: string; position: { x: number; y: number; z: number } }> = [];

    // Add players (excluding the casting player) - same logic as CloudkillManager
    Array.from(players.values()).forEach(player => {
      if (player.position && player.id !== casterId) {
        allTargets.push({
          id: player.id,
          position: player.position
        });
      }
    });

    if (allTargets.length === 0) return [];

    // Calculate distances and sort by proximity - same logic as CloudkillManager
    const targetsWithDistance = allTargets.map(target => ({
      target,
      distance: casterPosition.distanceTo(new Vector3(target.position.x, 0, target.position.z))
    }));

    targetsWithDistance.sort((a, b) => a.distance - b.distance);

    // Get closest targets
    const closestTargets = targetsWithDistance.slice(0, Math.min(allTargets.length, ARROW_COUNT)).map(item => item.target);

    // Return the target positions that arrows will be aimed at
    return closestTargets.map(target => target.position);
  }, [players]);

  useEffect(() => {
    if (isInitialized.current || !gameStarted) return;
    isInitialized.current = true;


    // Initialize damage system with level-scaled runes for Bow, Sword, and Sabres
    const primaryWeapon = selectedWeapons?.primary || WeaponType.BOW;
    const runeCount = getRuneCountForWeapon(primaryWeapon, playerLevel);
    setGlobalCriticalRuneCount(runeCount);
    setGlobalCritDamageRuneCount(runeCount);
    
    // Create engine
    const engine = new Engine({ enableDebug: true });
    engineRef.current = engine;

    // Initialize with canvas
    const canvas = gl.domElement;
    engine.initialize(canvas).then(() => {
      // Create a PVP damage callback that maps local ECS entity IDs back to server player IDs
      const damagePlayerWithMapping = (entityId: string, damage: number, damageType?: string, isCritical?: boolean) => {
        // Find the server player ID that corresponds to this local ECS entity ID
        const numericEntityId = parseInt(entityId);
        let serverPlayerId: string | null = null;

        serverPlayerEntities.current.forEach((localEntityId, playerId) => {
          if (localEntityId === numericEntityId) {
            serverPlayerId = playerId;
          }
        });

        if (serverPlayerId) {
          broadcastPlayerDamage(serverPlayerId, damage, damageType, isCritical);
        }
      };
      
      const { player, controlSystem, towerSystem, pillarSystem } = setupPVPGame(engine, scene, camera as PerspectiveCamera, gl, damagePlayerWithMapping, damageTower, damagePillar, damageSummonedUnit, damageEnemy, selectedWeapons, cameraSystemRef);

      // Initialize merchant system
      const merchantPosition = new Vector3(16, 0, 8); // Same position as in Environment.tsx
      const merchantSystem = new MerchantSystem(merchantPosition);
      merchantSystemRef.current = merchantSystem;

      // Set control system reference for damage calculations (needed for weapon passives)
      setControlSystem(controlSystem);

      // Update player entity with correct socket ID for team validation
      if (socket?.id) {
        player.userData = player.userData || {};
        player.userData.playerId = socket.id;
      }
      
      setPlayerEntity(player);
      playerEntityRef.current = player.id;
      controlSystemRef.current = controlSystem;
      towerSystemRef.current = towerSystem;
      // summonedUnitSystemRef.current = summonedUnitSystem; // Removed - using server-authoritative units

      // Synchronize ControlSystem level with player level
      controlSystem.setWeaponLevel(playerLevel);

      // Set skill point data for ability unlocks
      if (skillPointData) {
        controlSystem.setSkillPointData(skillPointData);
      }

      // Set initial tower system player mapping and socket ID if socket is available
      if (socket?.id) {
        towerSystem.setLocalSocketId(socket.id);
        towerSystem.setPlayerMapping(serverPlayerEntities.current, socket.id);
      }

      // Set up Corrupted Aura toggle callback
      controlSystem.setCorruptedAuraToggleCallback((active: boolean) => {
        const newState = {
          ...weaponStateRef.current,
          isCorruptedAuraActive: active,
          isFrozen: weaponStateRef.current.isFrozen
        };
        weaponStateRef.current = newState;
        setWeaponState(newState);
      });
      
      // Set up tower system with player mapping
      if (towerSystem && socket?.id) {
        towerSystem.setPlayerMapping(serverPlayerEntities.current, socket.id);
      }

      // Note: Wave completion callback is now handled by server-side summoned unit system
      // The server will broadcast 'wave-completed' events that we handle in MultiplayerContext
      
      // Pass controlSystem back to parent
      if (onControlSystemUpdate) {
        onControlSystemUpdate(controlSystem);
      }
      
      // Set up PVP callbacks (AFTER playerEntity is set)
      controlSystem.setBowReleaseCallback((finalProgress, isPerfectShot) => {
        // NOTE: Projectile broadcasting is now handled by setProjectileCreatedCallback
        // This callback only handles visual effects to avoid duplicate damage
        
        // Trigger perfect shot visual effect if it was a perfect shot
        if (isPerfectShot) {
          
          // Get current player position from the engine
          const currentPlayerEntity = engine.getWorld().getEntity(playerEntityRef.current!);
          if (currentPlayerEntity) {
            const transform = currentPlayerEntity.getComponent(Transform);
            if (transform) {
              // Get camera direction for effect direction
              const direction = new Vector3();
              camera.getWorldDirection(direction);
              direction.normalize();
              
              // Apply same downward compensation as projectile system
              const compensationAngle = Math.PI / 12; // 30 degrees
              const cameraRight = new Vector3();
              cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
              const rotationMatrix = new Matrix4();
              rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
              direction.applyMatrix4(rotationMatrix);
              direction.normalize();
              
              // Create perfect shot effect
              const effectId = createPowershotEffect(
                transform.position.clone(),
                direction,
                controlSystem.getCurrentSubclass(),
                true, // isPerfectShot
                true  // isElementalShotsUnlocked - for now assume unlocked
              );
            }
          }
        }
      });
      
      
      // Set up Viper Sting callback
      controlSystem.setViperStingCallback((position, direction) => {
        broadcastPlayerAbility('viper_sting', position, direction);
      });
      
      // Set up Barrage callback
      controlSystem.setBarrageCallback((position, direction) => {
        broadcastPlayerAbility('barrage', position, direction);
      });
      
      // Set up Frost Nova callback
      controlSystem.setFrostNovaCallback((position, direction) => {
        broadcastPlayerAbility('frost_nova', position, direction);
      });

      // Set up Summon Totem callback
      controlSystem.setSummonTotemCallback((position) => {
        // Broadcast to other players first
        broadcastPlayerAbility('summon_totem', position);
        
        // Trigger local totem creation via PVPSummonTotemManager 
        if (socket?.id && (window as any).triggerGlobalSummonTotem) {
          (window as any).triggerGlobalSummonTotem(
            position,
            undefined, // Let PVPSummonTotemManager handle enemy data
            undefined, // Let PVPSummonTotemManager handle damage callback
            undefined, // Let PVPSummonTotemManager handle effects
            undefined, // Let PVPSummonTotemManager handle active effects
            undefined, // Let PVPSummonTotemManager handle damage numbers
            undefined, // Let PVPSummonTotemManager handle damage number ID
            undefined, // Let PVPSummonTotemManager handle healing
            socket.id  // Pass caster ID
          );
        }
      });


      // Set up Cloudkill callback with target position capture
      controlSystem.setCloudkillCallback((position, direction) => {
        // First, get the target positions that will be hit by cloudkill
        const targetPositions = getCloudkillTargetPositions(position, socket?.id || '');
        
        // Broadcast to other players with target positions
        broadcastPlayerAbility('cloudkill', position, direction, undefined, { targetPositions });
        
        // Also trigger local CloudkillManager for the casting player
        if (socket?.id) {
          triggerGlobalCloudkill(position, socket.id);
        }
      });

      // Set up Cobra Shot callback (for local visual effects only - projectile is handled via onProjectileCreatedCallback)
      controlSystem.setCobraShotCallback((position, direction) => {
        // Don't broadcast as ability - the projectile is already broadcast via onProjectileCreatedCallback
      });
      
      // Set up Charge callback
      controlSystem.setChargeCallback((position, direction) => {
        // Store charge direction for trail effect
        setWeaponState(prev => ({
          ...prev,
          chargeDirection: direction.clone()
        }));
        // Broadcast as ability for state management
        broadcastPlayerAbility('charge', position, direction);
        // Also broadcast as attack for animation
        broadcastPlayerAttack('sword_charge_start', position, direction, {
          isSwordCharging: true
        });
      });
      
   
      
      // Set up Skyfall callback
      controlSystem.setSkyfallCallback((position, direction) => {
        broadcastPlayerAbility('skyfall', position, direction);
      });
      
      // Set up Backstab callback
      controlSystem.setBackstabCallback((position, direction, damage, isBackstab) => {
        broadcastPlayerAbility('backstab', position, direction);
        // Note: Animation state is now broadcasted automatically in the game loop
      });
      
      // Set up Sunder callback
      controlSystem.setSunderCallback((position, direction, damage, stackCount) => {
        broadcastPlayerAbility('sunder', position, direction);
        // Note: Animation state is now broadcasted automatically in the game loop
      });
      
      // Set up SabreReaperMistEffect callback for Stealth ability
      controlSystem.setCreateSabreMistEffectCallback((position: Vector3) => {

        const effectId = `mist_${Date.now()}_${Math.random()}`;
        const newEffect = {
          id: effectId,
          position: position.clone(),
          startTime: Date.now()
        };

        setActiveMistEffects(prev => {
          const newEffects = [...prev, newEffect];
          return newEffects;
        });

        // Remove effect after duration (1 second)
        setTimeout(() => {
          setActiveMistEffects(prev => {
            const filtered = prev.filter(effect => effect.id !== effectId);
            return filtered;
          });
        }, 1000);
      });

      // Set up broadcast callback for Sabre Reaper Mist effects
      controlSystem.setBroadcastSabreMistCallback((position: Vector3, effectType: 'stealth' | 'skyfall') => {
        if (broadcastPlayerEffect) {
          broadcastPlayerEffect({
            type: 'mist',
            effectType,
            position: { x: position.x, y: position.y, z: position.z },
            duration: 1000
          });
        }
      });

      // Set up callback for creating local debuff effects
      controlSystem.setCreateLocalDebuffCallback((playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', position: Vector3, duration: number) => {
        createPvpDebuffEffect(playerId, debuffType, position, duration);
      });
      
      // Set up Debuff callback for broadcasting freeze/slow effects
      controlSystem.setDebuffCallback((targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', duration: number, position: Vector3) => {
        
        // Find the server player ID that corresponds to this local ECS entity ID
        let targetPlayerId: string | null = null;
        serverPlayerEntities.current.forEach((localEntityId, playerId) => {
          if (localEntityId === targetEntityId) {
            targetPlayerId = playerId;
          }
        });
        
        if (targetPlayerId && broadcastPlayerDebuff) {
          broadcastPlayerDebuff(targetPlayerId, debuffType, duration, {
            position: { x: position.x, y: position.y, z: position.z }
          });
        }
      });

      // Set up multiplayer context reference for ControlSystem stealth broadcasting
      (window as any).multiplayerContext = {
        broadcastPlayerStealth,
        broadcastPlayerDamage,
        broadcastPlayerHealing,
        broadcastPlayerKnockback
      };
      
      // Set up global control system reference for tower targeting
      (window as any).controlSystemRef = controlSystemRef;
      
      // Set up projectile creation callback
      controlSystem.setProjectileCreatedCallback((projectileType, position, direction, config) => {
        const animationData: any = {};

        // Add charge progress for bow projectiles
        if (projectileType.includes('arrow') || projectileType.includes('bolt')) {
          animationData.chargeProgress = controlSystem.getChargeProgress();
        }

        // Add projectile config data for special effects (like Cryoflame)
        animationData.projectileConfig = config;

        broadcastPlayerAttack(projectileType, position, direction, animationData);
      });

      // Melee attack sounds are now handled through animation state broadcasting only
      
      // Set up Reanimate callback
      controlSystem.setReanimateCallback(() => {
        if (reanimateRef.current) {
          reanimateRef.current.triggerHealingEffect();
        }

        // Broadcast Reanimate ability to other players
        if (player) {
          const transform = player.getComponent(Transform);
          if (transform) {
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();

            broadcastPlayerAbility('reanimate', transform.position, direction);

            // Broadcast Reanimate healing to other players
            broadcastPlayerHealing(60, 'reanimate', {
              x: transform.position.x,
              y: transform.position.y + 1.5, // Position above player's head
              z: transform.position.z
            });
          }
        }
      });

      // Set up Smite callback
      controlSystem.setSmiteCallback((position: Vector3, direction: Vector3, onDamageDealt?: (totalDamage: number) => void) => {
        // Create local Smite effect
        createPvpSmiteEffect(socket?.id || '', position, onDamageDealt);

        // Broadcast Smite ability to other players
        broadcastPlayerAbility('smite', position, direction);
      });

      // Set up damage numbers callback for healing effects
      controlSystem.setDamageNumbersCallback((damageNumbers) => {
        if (onDamageNumbersUpdate) {
          onDamageNumbersUpdate(damageNumbers);
        }
      });

      // Incoming damage display is now handled directly in handlePlayerDamaged to avoid R3F issues

      // Set up healing broadcast callback for PVP
      controlSystem.setBroadcastHealingCallback((healingAmount, healingType, position) => {
        broadcastPlayerHealing(healingAmount, healingType, {
          x: position.x,
          y: position.y,
          z: position.z
        });
      });

      // Set up Colossus Strike callback
      controlSystem.setColossusStrikeCallback((position: Vector3, direction: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => {
        // Create local Colossus Strike effect with damage
        createPvpColossusStrikeEffect(socket?.id || '', position, damage, onDamageDealt);

        // Broadcast Colossus Strike ability to other players
        broadcastPlayerAbility('colossusStrike', position, direction, undefined, { damage });
      });

      // Set up Wind Shear callback
      controlSystem.setWindShearCallback((position: Vector3, direction: Vector3) => {
        // Create local Wind Shear projectile effect
        createPvpWindShearEffect(socket?.id || '', position, direction);

        // Broadcast Wind Shear ability to other players
        broadcastPlayerAbility('windShear', position, direction);
      });

      // Set the local socket ID for the control system
      if (socket?.id) {
        controlSystem.setLocalSocketId(socket.id);
      }

      // Set up WindShear Tornado callback
      controlSystem.setWindShearTornadoCallback((playerId: string, duration: number) => {
        // Create local tornado effect
        createPvpWindShearTornadoEffect(playerId, duration);

        // Always broadcast tornado effect to other players when windshear is used
        if (socket?.id) {
          // Get current player position for broadcasting (should be local player position)
          const localPlayer = players.get(socket.id);
          if (localPlayer) {
            broadcastPlayerTornadoEffect(socket.id, {
              x: localPlayer.position.x,
              y: localPlayer.position.y,
              z: localPlayer.position.z
            }, duration);
          }
        }
      });

      // Set up DeathGrasp callback
      controlSystem.setDeathGraspCallback((position: Vector3, direction: Vector3) => {

        // Create local DeathGrasp projectile effect
        createPvpDeathGraspEffect(socket?.id || '', position, direction);

        // Broadcast DeathGrasp ability to other players
        broadcastPlayerAbility('deathgrasp', position, direction);
      });

      // Set up WraithStrike callback
      controlSystem.setWraithStrikeCallback((position: Vector3, direction: Vector3) => {

        // Broadcast WraithStrike ability to other players
        broadcastPlayerAbility('wraith_strike', position, direction);
      });

      // Set up Haunted Soul Effect callback (for WraithStrike)
      controlSystem.setHauntedSoulEffectCallback((position: Vector3) => {
        createPvpHauntedSoulEffect(position);
      });


      // Set up mana callbacks for Runeblade
      controlSystem.setConsumeManaCallback(consumeMana);
      controlSystem.setCheckManaCallback(hasMana);

      engine.start();
    });

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
      // Clear any pending batched updates
      pvpStateBatcher.clear();
    };
  }, [scene, camera, gl, gameStarted]);

  // Expose PVP player data globally for ControlSystem access
  useEffect(() => {
    (window as any).pvpPlayers = players;
    (window as any).localSocketId = socket?.id;
    (window as any).serverPlayerEntities = serverPlayerEntities;
    (window as any).multiplayer = {
      broadcastPlayerEffect: broadcastPlayerEffect
    };

    // Set up Summon Totem explosion trigger
    (window as any).triggerSummonTotemExplosion = (playerId: string, initialPosition: Vector3) => {
      // Create explosion effect at the target player's current position
      const explosionId = nextSummonTotemExplosionId.current++;

      setPvpSummonTotemExplosions(prev => [...prev, {
        id: explosionId,
        playerId: playerId,
        position: initialPosition.clone(),
        startTime: Date.now(),
        duration: 1000 // 1 second explosion
      }]);

      // Remove explosion effect after duration
      setTimeout(() => {
        setPvpSummonTotemExplosions(prev => prev.filter(effect => effect.id !== explosionId));
      }, 1000);
    };

    // Expose interpolation system for debugging
    (window as any).getInterpolationStats = () => {
      if (!engineRef.current) {
        return { error: 'Engine not initialized' };
      }

      const world = engineRef.current.getWorld();
      const interpolationSystem = world.getSystem(InterpolationSystem);

      if (!interpolationSystem) {
        return { error: 'InterpolationSystem not found' };
      }

      const stats: any = {};
      serverPlayerEntities.current.forEach((entityId, playerId) => {
        const entity = world.getEntity(entityId);
        if (entity) {
          stats[playerId] = interpolationSystem.getInterpolationStats(entity);
        }
      });

      return stats;
    };

    // Expose advanced interpolation methods for testing
    (window as any).testInterpolationMethods = () => {


      return 'Interpolation methods available in InterpolationSystem class';
    };
  }, [players, socket?.id]);

  // Game loop integration with React Three Fiber
  useFrame((state, deltaTime) => {
    if (engineRef.current && engineRef.current.isEngineRunning() && gameStarted) {
      // Update FPS counter
      updateFPSCounter(engineRef.current.getCurrentFPS());

      // Reset object pool temporary objects for this frame
      pvpObjectPool.resetFrameTemporaries();

      // Update player position for dragon renderer
      if (playerEntity) {
        const transform = playerEntity.getComponent(Transform);
        if (transform && transform.position) {
          const newPosition = transform.position.clone();
          setPlayerPosition(newPosition);
          realTimePlayerPositionRef.current.copy(newPosition);

          // Update Viper Sting parent ref with current position and camera rotation
          viperStingParentRef.current.position.copy(newPosition);

          // Calculate quaternion from camera direction for Viper Sting
          const cameraDirection = new Vector3();
          camera.getWorldDirection(cameraDirection);
          const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);

          // Update quaternion for Viper Sting direction
          viperStingParentRef.current.quaternion = {
            x: 0,
            y: Math.sin(cameraAngle / 2),
            z: 0,
            w: Math.cos(cameraAngle / 2)
          };

          // Send position updates to other players with camera rotation
          const rotation = { x: 0, y: cameraAngle, z: 0 };
          updatePlayerPosition(transform.position, rotation);
        }
      }

      // Update weapon state from control system
      if (controlSystemRef.current) {
        const newWeaponState = {
          currentWeapon: controlSystemRef.current.getCurrentWeapon(),
          currentSubclass: controlSystemRef.current.getCurrentSubclass(),
          isCharging: controlSystemRef.current.isWeaponCharging(),
          chargeProgress: controlSystemRef.current.getChargeProgress(),
          chargeDirection: weaponStateRef.current.chargeDirection,
          isSwinging: controlSystemRef.current.isWeaponSwinging(),
          isSpinning: (controlSystemRef.current.isWeaponCharging() || controlSystemRef.current.isCrossentropyChargingActive()) && controlSystemRef.current.getCurrentWeapon() === WeaponType.SCYTHE,
          swordComboStep: controlSystemRef.current.getSwordComboStep(),
          isSwordCharging: controlSystemRef.current.isChargeActive(),
          isDeflecting: controlSystemRef.current.isDeflectActive(),
          isViperStingCharging: controlSystemRef.current.isViperStingChargingActive(),
          viperStingChargeProgress: controlSystemRef.current.getViperStingChargeProgress(),
          isBarrageCharging: controlSystemRef.current.isBarrageChargingActive(),
          barrageChargeProgress: controlSystemRef.current.getBarrageChargeProgress(),
          isCobraShotCharging: controlSystemRef.current.isCobraShotChargingActive(),
          cobraShotChargeProgress: controlSystemRef.current.getCobraShotChargeProgress(),
          isSkyfalling: controlSystemRef.current.isSkyfallActive(),
          isBackstabbing: controlSystemRef.current.isBackstabActive(),
          isSundering: controlSystemRef.current.isSunderActive(),
          isCorruptedAuraActive: controlSystemRef.current.isCorruptedAuraActive(),
          isFrozen: weaponStateRef.current.isFrozen
        };

        // Update the ref immediately
        weaponStateRef.current = newWeaponState;

        // Check for weapon changes and broadcast to other players
        const prevWeapon = prevWeaponRef.current;
        if (newWeaponState.currentWeapon !== prevWeapon.weapon ||
            newWeaponState.currentSubclass !== prevWeapon.subclass) {
          updatePlayerWeapon(newWeaponState.currentWeapon, newWeaponState.currentSubclass);
          prevWeaponRef.current = {
            weapon: newWeaponState.currentWeapon,
            subclass: newWeaponState.currentSubclass
          };
        }

        // Throttle React state updates to prevent infinite re-renders
        const now = Date.now();
        if (now - lastWeaponStateUpdate.current > 16) { // ~60fps throttle
          setWeaponState(newWeaponState);
          lastWeaponStateUpdate.current = now;
        }

        // Broadcast animation state changes to other players (throttled to avoid spam)
        const animationNow = Date.now();
        if (animationNow - lastAnimationBroadcast.current > 100) { // Throttle to 10 times per second
          // Determine if scythe is spinning based on weapon type and charging state
          const isScytheSpinning = newWeaponState.currentWeapon === WeaponType.SCYTHE && newWeaponState.isCharging;
          // Determine if sword is spinning during Charge
          const isSwordSpinning = newWeaponState.isSwordCharging;
          // Combine all spinning states
          const isSpinning = isScytheSpinning || isSwordSpinning;

          // Create the animation state object - only include weapon-specific fields for current weapon
          const animationStateToSend: any = {
            isCharging: newWeaponState.isCharging,
            chargeProgress: newWeaponState.chargeProgress,
            isSwinging: newWeaponState.isSwinging,
            isSpinning: isSpinning, // Broadcast spinning for scythe and sword charge
            isDeflecting: newWeaponState.isDeflecting,
            isSwordCharging: newWeaponState.isSwordCharging, // Broadcast sword charging state
            isViperStingCharging: newWeaponState.isViperStingCharging,
            viperStingChargeProgress: newWeaponState.viperStingChargeProgress,
            isBarrageCharging: newWeaponState.isBarrageCharging,
            barrageChargeProgress: newWeaponState.barrageChargeProgress,
            isBackstabbing: newWeaponState.isBackstabbing, // Broadcast backstab animation state
            // Add missing Runeblade animation states
            isSmiting: controlSystemRef.current?.isSmiteActive() || false,
            isColossusStriking: controlSystemRef.current?.isColossusStrikeActive() || false,
            isWindShearing: controlSystemRef.current?.isWindShearActive() || false,
            isWindShearCharging: controlSystemRef.current?.isWindShearChargingActive() || false,
            windShearChargeProgress: controlSystemRef.current?.getWindShearChargeProgress() || 0,
            isDeathGrasping: controlSystemRef.current?.isDeathGraspActive() || false,
            isWraithStriking: controlSystemRef.current?.isWraithStrikeActive() || false,
            isCorruptedAuraActive: controlSystemRef.current?.isCorruptedAuraActive() || false
          };

          // Only include swordComboStep for weapons that actually use it (Sword and Runeblade)
          const currentWeapon = controlSystemRef.current?.getCurrentWeapon();
          if (currentWeapon === WeaponType.SWORD || currentWeapon === WeaponType.RUNEBLADE) {
            animationStateToSend.swordComboStep = newWeaponState.swordComboStep;
          }
          broadcastPlayerAnimationState(animationStateToSend);
          lastAnimationBroadcast.current = animationNow;
        }
      }

      // Throttle damage numbers update to prevent infinite re-renders (every 33ms for smooth animation)
      const damageNumbersNow = Date.now();
      if (damageNumbersNow - lastDamageNumbersUpdate.current > 33 && onDamageNumbersUpdate) {
        const combatSystem = engineRef.current.getWorld().getSystem(CombatSystem);
        if (combatSystem) {
          const newDamageNumbers = combatSystem.getDamageNumbers();
          onDamageNumbersUpdate(newDamageNumbers);
          lastDamageNumbersUpdate.current = damageNumbersNow;
        }
      }

      // Update scoreboard data
      if (onScoreboardUpdate) {
        onScoreboardUpdate(playerKills, players);
      }

      // Throttle camera update to prevent object reference changes (every 33ms for consistency)
      const cameraNow = Date.now();
      if (cameraNow - lastCameraUpdate.current > 33 && onCameraUpdate) {
        onCameraUpdate(camera, size);
        lastCameraUpdate.current = cameraNow;
      }

      // Log object pool and state batcher statistics periodically (every 5 seconds)
      const now = Date.now();
      if (now % 10000 < 16) { // Approximately every 5 seconds (accounting for frame rate)
        const poolStats = getPoolStats();
        const batcherStats = pvpStateBatcher.getStats();
      }

      // Update merchant system and check player proximity
      if (merchantSystemRef.current && playerEntity) {
        const transform = playerEntity.getComponent(Transform);
        if (transform) {
          merchantSystemRef.current.update(deltaTime, transform.position);

          const merchantState = merchantSystemRef.current.getMerchantState();
          setIsMerchantNearby(merchantState.isPlayerNearby);
          setIsMerchantVisible(merchantState.isPlayerInVisibilityRange);
          setMerchantRotation(merchantState.rotation);

          // Auto-show merchant UI when player gets close (but allow manual toggle)
          if (merchantState.isPlayerNearby && !isMerchantNearbyRef.current) {
            // Player just entered range - show UI
            onMerchantUIUpdate?.(true);
          } else if (!merchantState.isPlayerNearby && isMerchantNearbyRef.current) {
            // Player just left range - hide UI
            onMerchantUIUpdate?.(false);
          }

          // Update the refs for next comparison
          isMerchantNearbyRef.current = merchantState.isPlayerNearby;
          isMerchantVisibleRef.current = merchantState.isPlayerInVisibilityRange;
        }
      }

      // Throttle game state update to prevent infinite re-renders (every 100ms)
      const gameStateNow = Date.now();
      if (gameStateNow - lastGameStateUpdate.current > 100 && onGameStateUpdate && playerEntityRef.current !== null && engineRef.current && controlSystemRef.current) {
        const world = engineRef.current.getWorld();
        const actualPlayerEntity = world.getEntity(playerEntityRef.current);
        if (actualPlayerEntity) {
          const healthComponent = actualPlayerEntity.getComponent(Health);
          const shieldComponent = actualPlayerEntity.getComponent(Shield);
          if (healthComponent) {
            const gameState = {
              playerHealth: healthComponent.currentHealth,
              maxHealth: healthComponent.maxHealth,
              playerShield: shieldComponent ? shieldComponent.currentShield : 0,
              maxShield: shieldComponent ? shieldComponent.maxShield : 0,
              currentWeapon: controlSystemRef.current.getCurrentWeapon(),
              currentSubclass: controlSystemRef.current.getCurrentSubclass(),
              // Add mana information for weapons that use mana
              mana: (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) ? currentMana : 0,
              maxMana: (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) ? maxMana : 0
            };
            onGameStateUpdate(gameState);

            // Update multiplayer health and shield
            updatePlayerHealth(healthComponent.currentHealth, healthComponent.maxHealth);
            if (shieldComponent) {
              updatePlayerShield(socket?.id || '', shieldComponent.currentShield, shieldComponent.maxShield);
            }
            lastGameStateUpdate.current = gameStateNow;
          }
        }
      }

      // Process pending summoned unit damage events
      const pendingDamage = (window as any).pendingSummonedUnitDamage;
      if (pendingDamage && pendingDamage.length > 0) {
        const combatSystem = engineRef.current?.getWorld().getSystem(CombatSystem);
        if (combatSystem) {
          for (const damageEvent of pendingDamage) {
            combatSystem.applySummonedUnitDamage(
              damageEvent.unitId,
              damageEvent.damage,
              damageEvent.sourcePlayerId
            );
          }
        }
        // Clear processed events
        (window as any).pendingSummonedUnitDamage = [];
      }

      // State updates are handled individually above
    }
  });

  // Expose damage number completion handler for parent component
  useEffect(() => {
    if (onDamageNumberComplete) {
      // Store the completion handler in a way the parent can access it
      (window as any).handleDamageNumberComplete = (id: string) => {
        const combatSystem = engineRef.current?.getWorld().getSystem(CombatSystem);
        if (combatSystem) {
          combatSystem.removeDamageNumber(id);
        }
      };
    }
  }, [onDamageNumberComplete]);

  // Real-time enemy data for PVP Summon Totem Manager (not memoized to get real-time positions)
  const pvpSummonTotemEnemyData = Array.from(players.values()).filter(player => player.id !== socket?.id).map(player => ({
    id: player.id,
    position: new Vector3(player.position.x, player.position.y, player.position.z),
    health: player.health
  }));


  return (
    <>
      {/* Don't render game world if game hasn't started */}
      {!gameStarted ? null : (
        <>
          {/* Environment (Sky, Planet, Mountains, Pillars, Pedestal) - No level progression in PVP */}
      <Environment
        level={1}
        world={engineRef.current?.getWorld()}
        camera={camera as PerspectiveCamera}
        enableLargeTree={true}
        isPVP={true}
        merchantRotation={merchantRotation}
        showMerchant={isMerchantVisible}
      />

      {/* Lighting */}
      <ambientLight intensity={0.1} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.25}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Enhanced Ground with textures and ambient occlusion */}
      <EnhancedGround radius={29} height={1} level={1} />








      {/* Main Player Dragon Unit Renderer */}
      {(() => {

        return playerEntity && engineRef.current && socket;
      })() && (
        <DragonRenderer
          entityId={playerEntity.id}
          position={playerPosition}
          realTimePositionRef={realTimePlayerPositionRef}
          world={engineRef.current!.getWorld()}
          currentWeapon={weaponState.currentWeapon}
          currentSubclass={weaponState.currentSubclass}
          isCharging={weaponState.isCharging}
          chargeProgress={weaponState.chargeProgress}
          chargeDirection={weaponState.chargeDirection}
          isSwinging={weaponState.isSwinging}
          isSpinning={weaponState.isSpinning}
          swordComboStep={weaponState.swordComboStep}
          isSwordCharging={weaponState.isSwordCharging}
          isDeflecting={weaponState.isDeflecting}
          isViperStingCharging={weaponState.isViperStingCharging}
          viperStingChargeProgress={weaponState.viperStingChargeProgress}
          isBarrageCharging={weaponState.isBarrageCharging}
          barrageChargeProgress={weaponState.barrageChargeProgress}
          isCobraShotCharging={weaponState.isCobraShotCharging}
          cobraShotChargeProgress={weaponState.cobraShotChargeProgress}
          isCloudkillCharging={controlSystemRef.current?.isCloudkillChargingActive() || false}
          cloudkillChargeProgress={controlSystemRef.current?.getCloudkillChargeProgress() || 0}
          isSkyfalling={weaponState.isSkyfalling}
          isBackstabbing={weaponState.isBackstabbing}
          isSundering={weaponState.isSundering}
          isSmiting={controlSystemRef.current?.isSmiteActive() || false}
          isColossusStriking={controlSystemRef.current?.isColossusStrikeActive() || false}
          isDeathGrasping={controlSystemRef.current?.isDeathGraspActive() || false}
          isWraithStriking={controlSystemRef.current?.isWraithStrikeActive() || false}
          isCorruptedAuraActive={controlSystemRef.current?.isCorruptedAuraActive() || false}
          reanimateRef={reanimateRef}
          isLocalPlayer={true}
          isStealthing={controlSystemRef.current?.getIsStealthing() || false}
          onDamageNumbersReady={handleDamageNumbersReady}
          combatSystem={engineRef.current?.getWorld().getSystem(require('@/systems/CombatSystem').CombatSystem)}
          onBowRelease={() => {
            // This callback is now handled by the ControlSystem directly
          }}
          onScytheSwingComplete={() => {
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('scythe_swing', playerPosition, direction, {
              isSpinning: true
            });
          }}
          onSwordSwingComplete={() => {
            controlSystemRef.current?.onSwordSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sword_swing', playerPosition, direction, {
              comboStep: weaponState.swordComboStep
            });
          }}
          onSabresSwingComplete={() => {
            controlSystemRef.current?.onSabresSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sabres_swing', playerPosition, direction);
          }}
          onRunebladeSwingComplete={() => {
            controlSystemRef.current?.onSwordSwingComplete(); // Reuse Sword swing complete for combo advancement
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('runeblade_swing', playerPosition, direction, {
              comboStep: weaponState.swordComboStep
            });
          }}
          onChargeComplete={() => {
            controlSystemRef.current?.onChargeComplete();
            // Broadcast charge spin animation
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sword_charge_spin', playerPosition, direction, {
              isSpinning: true
            });
          }}
          onDeflectComplete={() => {
            controlSystemRef.current?.onDeflectComplete();
          }}
          onBackstabComplete={() => {
            // Backstab animation completed - no need to broadcast as animation state is handled automatically
          }}
          onSunderComplete={() => {
            // Sunder animation completed - no need to broadcast as animation state is handled automatically
          }}
          onSmiteComplete={() => {
            controlSystemRef.current?.onSmiteComplete();
          }}
          onColossusStrikeComplete={() => {
            controlSystemRef.current?.onColossusStrikeComplete();
          }}
          onDeathGraspComplete={() => {
            controlSystemRef.current?.onDeathGraspComplete();
          }}
          onWraithStrikeComplete={() => {
            controlSystemRef.current?.onWraithStrikeComplete();
          }}
          onCorruptedAuraToggle={(active: boolean) => {
            // Update the weapon state when Corrupted Aura is toggled
            const newState = {
              ...weaponStateRef.current,
              isCorruptedAuraActive: active,
              isFrozen: weaponStateRef.current.isFrozen
            };
            weaponStateRef.current = newState;
            setWeaponState(newState);
          }}
          purchasedItems={players.get(socket?.id || '')?.purchasedItems || []}
        />
      )}

      {/* Other Players Dragon Renderers */}
      {Array.from(players.values()).map(player => {
        if (player.id === socket?.id) return null; // Don't render our own player twice

        // Check if player is invisible due to stealth
        const isPlayerInvisible = playerStealthStates.get(player.id) || false;

        // Check if player is dead
        const deathState = playerDeathStates.get(player.id);
        const isPlayerDead = deathState?.isDead || false;

        if (isPlayerInvisible) {
          return null; // Don't render invisible players
        }
        
        const playerState = multiplayerPlayerStates.get(player.id) || {
          isCharging: false,
          chargeProgress: 0,
          isSwinging: false,
          swordComboStep: 1 as 1 | 2 | 3,
          isSpinning: false,
          isSwordCharging: false,
          isDeflecting: false,
          isViperStingCharging: false,
          viperStingChargeProgress: 0,
          isBarrageCharging: false,
          barrageChargeProgress: 0,
          isCobraShotCharging: false,
          cobraShotChargeProgress: 0,
          isSkyfalling: false,
          isBackstabbing: false,
          // Add missing Runeblade animation states
          isSmiting: false,
          isDeathGrasping: false,
          isWraithStriking: false,
          isCorruptedAuraActive: false,
          isFrozen: false
        };
        
        // Get the real-time position ref for this enemy player
        const enemyPositionRef = enemyPlayerPositionRefs.current.get(player.id);

        return (
          <DragonRenderer
            key={player.id}
            entityId={parseInt(player.id.replace(/\D/g, '0'))} // Convert string ID to number
            position={new Vector3(player.position.x, player.position.y, player.position.z)}
            realTimePositionRef={enemyPositionRef}
            world={engineRef.current?.getWorld() || new World()} // Use current world or create new one
            currentWeapon={player.weapon}
            currentSubclass={player.subclass}
            isCharging={playerState.isCharging}
            chargeProgress={playerState.chargeProgress}
            isSwinging={playerState.isSwinging}
            isSpinning={playerState.isSpinning}
            swordComboStep={playerState.swordComboStep}
            isSwordCharging={playerState.isSwordCharging}
            isDeflecting={playerState.isDeflecting}
            isViperStingCharging={playerState.isViperStingCharging}
            viperStingChargeProgress={playerState.viperStingChargeProgress}
            isBarrageCharging={playerState.isBarrageCharging}
            barrageChargeProgress={playerState.barrageChargeProgress}
            isCobraShotCharging={playerState.isCobraShotCharging}
            cobraShotChargeProgress={playerState.cobraShotChargeProgress}
            isSkyfalling={playerState.isSkyfalling}
            isBackstabbing={playerState.isBackstabbing}
            isSundering={playerState.isSundering || false}
            isSmiting={playerState.isSmiting || false}
            isColossusStriking={playerState.isColossusStriking || false}
            isDeathGrasping={playerState.isDeathGrasping || false}
            isWraithStriking={playerState.isWraithStriking || false}
            isCorruptedAuraActive={playerState.isCorruptedAuraActive || false}
            isDead={isPlayerDead}
            rotation={player.rotation}
            isLocalPlayer={false}
            onBowRelease={() => {}}
            onScytheSwingComplete={() => {}}
            onSwordSwingComplete={() => {}}
            onSabresSwingComplete={() => {}}
            onRunebladeSwingComplete={() => {}}
            onBackstabComplete={() => {}}
            onSunderComplete={() => {}}
            onSmiteComplete={() => {}}
            onColossusStrikeComplete={() => {}}
            onDeathGraspComplete={() => {}}
            onWraithStrikeComplete={() => {}}
            purchasedItems={player.purchasedItems || []}
          />
        );
      })}

      {/* Towers */}
      {(Array.from(towers.values()) as ServerTower[]).map((tower) => {
        // Get the actual ECS entity ID for this tower
        const entityId = serverTowerEntities.current.get(tower.id);
        if (!entityId) return null; // Skip if entity doesn't exist yet

        return (
          <TowerRenderer
            key={tower.id}
            entityId={entityId}
            world={engineRef.current?.getWorld() || new World()}
            position={new Vector3(tower.position.x, tower.position.y, tower.position.z)}
            ownerId={tower.ownerId}
            towerIndex={tower.towerIndex}
            health={tower.health}
            maxHealth={tower.maxHealth}
            isDead={tower.isDead}
            camera={camera}
          />
        );
      })}

      {/* Render Pillars */}
      {(Array.from(pillars.values()) as ServerPillar[]).map((pillar) => {
        // Get the actual ECS entity ID for this pillar
        const entityId = serverPillarEntities.current.get(pillar.id);
        if (!entityId) return null; // Skip if entity doesn't exist yet

        // Get tower index for consistent player coloring
        const tower = (Array.from(towers.values()) as ServerTower[]).find((t) => t.ownerId === pillar.ownerId);
        const playerIndex = tower ? tower.towerIndex : 0;

        return (
          <PillarRenderer
            key={pillar.id}
            entityId={entityId}
            world={engineRef.current?.getWorld() || new World()}
            position={new Vector3(pillar.position.x, pillar.position.y, pillar.position.z)}
            ownerId={pillar.ownerId}
            pillarIndex={pillar.pillarIndex}
            playerIndex={playerIndex}
            health={pillar.health}
            maxHealth={pillar.maxHealth}
            isDead={pillar.isDead}
            camera={camera}
          />
        );
      })}

      {/* Server-Authoritative Summoned Units */}
      {engineRef.current && (Array.from(summonedUnits.values()) as ServerSummonedUnit[]).map((unit) => {
        // Filter out dead or inactive units
        if (!unit.isActive || unit.isDead) return null;

        return (
          <SummonedUnitRenderer
            key={unit.unitId}
            entityId={0} // Not using local entity ID for server-authoritative units
            world={engineRef.current!.getWorld()}
            position={new Vector3(unit.position.x, unit.position.y, unit.position.z)}
            ownerId={unit.ownerId}
            health={unit.health}
            maxHealth={unit.maxHealth}
            isDead={unit.isDead}
            isElite={unit.isElite}
          />
        );
      }).filter(Boolean)}

      {/* Other Players Health Bars */}
      {Array.from(players.values()).map(player => {
        if (player.id === socket?.id) return null; // Don't show health bar for local player

        // Check if player is invisible (stealth mode) - don't show health bar
        const isInvisible = playerStealthStates.get(player.id);
        if (isInvisible) return null;

        // Use shield values from the synchronized player data
        const shieldAmount = player.shield ?? 0;
        const maxShieldAmount = player.maxShield ?? 250;

        return (
          <PlayerHealthBar
            key={`healthbar-${player.id}`}
            playerId={player.id}
            playerName={player.name}
            position={new Vector3(player.position.x, player.position.y, player.position.z)}
            health={player.health}
            maxHealth={player.maxHealth}
            shield={shieldAmount}
            camera={camera}
            showDistance={35}
          />
        );
      })}

      {/* Unified Managers - Single query optimization */}
      {engineRef.current && (
        <>
          <UnifiedProjectileManager world={engineRef.current.getWorld()} />
          <WindShearProjectileManager
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            enemyData={[]} // Empty in PVP mode - we target other players instead
            localSocketId={socket?.id}
            onProjectileHit={(targetId: string, damage: number) => {
              // Handle damage for players in PVP (other players are "enemies")
              if (players.has(targetId) && broadcastPlayerDamage) {
                broadcastPlayerDamage(targetId, damage, 'windshear');

                // Create local damage number for immediate visual feedback
                const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
                const targetPlayer = players.get(targetId);
                if (damageNumberManager && damageNumberManager.addDamageNumber && targetPlayer) {
                  const hitPosition = new Vector3(targetPlayer.position.x, targetPlayer.position.y + 1.5, targetPlayer.position.z);
                  damageNumberManager.addDamageNumber(
                    damage,
                    false, // Not critical (could be enhanced later if needed)
                    hitPosition,
                    'windshear'
                  );
                }
              }
              // Handle damage for actual enemies (if any exist in PVP mode)
              else if (damageEnemy) {
                damageEnemy(targetId, damage);
              }
            }}
            onPlayerHit={(playerId: string) => {
              // Reduce Charge cooldown when WindShear hits a player
              if (controlSystemRef.current) {
                controlSystemRef.current.reduceChargeCooldownFromWindShear(playerId);
              }
            }}
          />

          {/* WindShear Tornado Effects */}
          {pvpWindShearTornadoEffects.map((effect) => (
            <WindShearTornadoEffect
              key={effect.id}
              getPlayerPosition={() => {
                // Check if this is for the local player
                const isLocalPlayer = effect.playerId === socket?.id || effect.playerId === 'local';
                
                if (isLocalPlayer && playerEntity) {
                  // Use the actual player entity position for local player
                  const transform = playerEntity.getComponent(Transform);
                  if (transform) {
                    const pos = transform.position.clone();
                    return pos;
                  }
                }

                // For remote players, get position from players map
                let player = players.get(effect.playerId);

                // If player not found and playerId is 'local', try to find the local player
                if (!player && effect.playerId === 'local' && socket?.id) {
                  player = players.get(socket.id);
                }

                if (player) {
                  const pos = new Vector3(player.position.x, player.position.y, player.position.z);
                  return pos;
                }

                // Fallback to stored position if player not found
                return effect.position;
              }}
              startTime={effect.startTime}
              duration={effect.duration}
              onComplete={() => {
              }}
            />
          ))}

          <BowPowershotManager />
          <FrostNovaManager world={engineRef.current.getWorld()} />
          <StunManager world={engineRef.current.getWorld()} />
          <CobraShotManager world={engineRef.current.getWorld()} />
          <DeflectShieldManager />
          {/* Optimized PVP-specific Cobra Shot Manager with Object Pooling */}
          <OptimizedPVPCobraShotManager
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())} // Include all players, filtering is done inside the component
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            damageNumberManager={engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager()}
            onPlayerHit={(playerId: string, damage: number) => {
              // CRITICAL FIX: Never damage the local player
              if (playerId === socket?.id) {
                return;
              }

              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage, 'cobra_shot');
              }
            }}
            onPlayerVenomed={(playerId: string, position: Vector3, casterId?: string) => {

              if (playerId === socket?.id) {
                return;
              }
              
              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpVenomEffect(playerId, clonedPosition, casterId);

              // Update player's venom status
              setPlayers((prev: Map<string, Player>) => {
                const newPlayers = new Map(prev);
                const player = newPlayers.get(playerId);
                if (player) {
                  newPlayers.set(playerId, {
                    ...player,
                    isVenomed: true,
                    venomedUntil: Date.now() + 6000 // 6 seconds venom duration
                  });
                }
                return newPlayers;
              });
              
              // Broadcast venom effect to all players so they can see it
              if (broadcastPlayerEffect) {
                broadcastPlayerEffect({
                  type: 'venom',
                  targetPlayerId: playerId,
                  position: { x: clonedPosition.x, y: clonedPosition.y, z: clonedPosition.z },
                  duration: 6000
                });
              }
            }}
          />
          
          {/* Optimized PVP-specific Barrage Manager with Object Pooling */}
          <OptimizedPVPBarrageManager
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            damageNumberManager={engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager()}
            onPlayerHit={(playerId: string, damage: number) => {
              // CRITICAL FIX: Never damage the local player
              if (playerId === socket?.id) {
                return;
              }

              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage, 'barrage');
              }
            }}
            onPlayerSlowed={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply slow effect to the local player
              if (playerId === socket?.id) {
                return;
              }
              
              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpDebuffEffect(playerId, 'slowed', clonedPosition, 5000); // 5 second slow
              
              // Broadcast debuff effect to all players so they can see it
              if (broadcastPlayerDebuff) {
                broadcastPlayerDebuff(playerId, 'slowed', 5000, {
                  position: { x: clonedPosition.x, y: clonedPosition.y, z: clonedPosition.z },
                  speedMultiplier: 0.5
                });
              }
            }}
          />
          
          {/* Optimized PVP-specific FrostNova Manager with Object Pooling */}
          <OptimizedPVPFrostNovaManager 
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            onPlayerHit={(playerId: string, damage: number) => {
              // CRITICAL FIX: Never damage the local player
              if (playerId === socket?.id) {
                return;
              }
              
              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerFrozen={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply frozen effect to the local player
              if (playerId === socket?.id) {
                return;
              }
              
              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpFrozenEffect(playerId, clonedPosition);
            }}
          />
          {/* Optimized PVP-specific ViperSting Manager with Object Pooling */}
          <OptimizedPVPViperStingManager
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            damageNumberManager={engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager()}
            onPlayerHit={(playerId: string, damage: number) => {

              if (playerId === socket?.id) {
                return;
              }

              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage);
              }
            }}
            onPlayerVenomed={(playerId: string, position: Vector3, casterId?: string) => {
              // CRITICAL FIX: Never apply venom effect to the local player
              if (playerId === socket?.id) {
                return;
              }

              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              createPvpVenomEffect(playerId, clonedPosition, casterId);
            }}
            onSoulStealCreated={(enemyPosition: Vector3) => {
              // Directly heal the local player for Viper Sting soul steal
              if (engineRef.current && playerEntityRef.current !== null) {
                const world = engineRef.current.getWorld();
                const playerEntity = world.getEntity(playerEntityRef.current);

                if (playerEntity) {
                  const healthComponent = playerEntity.getComponent(Health);
                  if (healthComponent) {
                    const didHeal = healthComponent.heal(20);
                    if (didHeal) {
                      // Create healing damage number above local player head
                      const damageNumberManager = (window as any).damageNumberManager;
                      if (damageNumberManager && damageNumberManager.addDamageNumber) {
                        // Get local player position
                        const transform = playerEntity.getComponent(Transform);
                        if (transform) {
                          const healingPosition = transform.position.clone();
                          healingPosition.y += 1.5; // Position above player's head

                          damageNumberManager.addDamageNumber(
                            20, // Healing amount
                            false, // Not critical
                            healingPosition,
                            'viper_sting_healing' // Damage type for healing styling
                          );
                        }
                      }

                      // Broadcast healing to other players
                      const transform = playerEntity.getComponent(Transform);
                      if (transform) {
                        broadcastPlayerHealing(20, 'viper_sting', {
                          x: transform.position.x,
                          y: transform.position.y + 1.5,
                          z: transform.position.z
                        });
                      }
                    }
                  }
                }
              }

              // Create the visual soul steal effect globally so all players can see souls flowing from enemy to caster
              const { triggerGlobalViperStingSoulSteal } = require('@/components/projectiles/ViperStingManager');
              if (triggerGlobalViperStingSoulSteal) {
                triggerGlobalViperStingSoulSteal(enemyPosition);
              }
            }}
          />

          {/* ViperStingManager for visual projectiles only in PVP mode */}
          <ViperStingManager
            parentRef={viperStingParentRef as any}
            enemyData={[]} // Empty in PVP mode - collision handled by OptimizedPVPViperStingManager
            onHit={() => {}} // No-op in PVP mode - damage handled by OptimizedPVPViperStingManager
            setDamageNumbers={() => {}} // No-op since damage numbers are handled by OptimizedPVPViperStingManager
            nextDamageNumberId={viperStingDamageNumberIdRef}
            onHealthChange={() => {
              // No-op in PVP mode - healing is handled by OptimizedPVPViperStingManager to prevent double healing
            }}
            charges={[{ id: 1, available: true, cooldownStartTime: null }]} // Dummy charge state
            setCharges={() => {}} // No-op since charges aren't used in PVP
            localSocketId={socket?.id}
            players={Array.from(players.values())} // Pass players data for dynamic targeting
          />

          {/* CloudkillManager for visual arrows in PVP mode */}
          <CloudkillManager
            enemyData={[]} // Empty array since we target players in PVP
            onHit={(targetId, damage, isCritical, position) => {
              // Handle player hits from Cloudkill arrows
              const targetPlayer = Array.from(players.values()).find(p => p.id === targetId);
              if (targetPlayer) {
                // Don't damage local player, but still show damage numbers for all valid hits
                if (targetId !== socket?.id) {
                  if (broadcastPlayerDamage) {
                    broadcastPlayerDamage(targetId, damage);
                  }
                }

                // Add damage numbers for all hits (teal for Cloudkill) - caster should see all their damage
                if (onDamageNumbersUpdate) {
                  const damageNumberId = Math.random().toString(36).substr(2, 9);
                  onDamageNumbersUpdate([{
                    id: damageNumberId,
                    damage: damage,
                    position: position,
                    isCritical: isCritical,
                    damageType: 'cloudkill',
                    timestamp: Date.now()
                  }]);
                }
              }
            }}
            playerPosition={playerPosition}
            onPlayerHit={(damage) => {
              // Handle self-damage if player is hit by their own Cloudkill
              if (socket?.id && broadcastPlayerDamage) {
                broadcastPlayerDamage(socket.id, damage);
              }
            }}
            players={Array.from(players.values())
              .filter(player => player.position) // Only include players with positions
              .map(player => ({
                id: player.id,
                position: player.position!,
                isVenomed: player.isVenomed,
                venomedUntil: player.venomedUntil
              }))}
            localSocketId={socket?.id}
            getCurrentPlayerPositions={() => {
              // Return real-time player positions at the moment this is called (at impact time)
              return Array.from(players.values())
                .filter(player => player.position && player.health !== undefined) 
                .map(player => ({
                  id: player.id,
                  position: player.position!,
                  health: player.health
                }));
            }}
          />

          {/* Optimized PVP-specific Crossentropy Manager with Object Pooling */}
          <OptimizedPVPCrossentropyManager
            world={engineRef.current.getWorld()}
            players={Array.from(players.values())}
            serverPlayerEntities={serverPlayerEntities}
            localSocketId={socket?.id}
            damageNumberManager={engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager()}
            onPlayerHit={(playerId: string, damage: number) => {
              // CRITICAL FIX: Never damage the local player
              if (playerId === socket?.id) {
                return;
              }

              if (broadcastPlayerDamage) {
                broadcastPlayerDamage(playerId, damage, 'crossentropy');
              }
            }}
            onPlayerExplosion={(playerId: string, position: Vector3) => {
              // CRITICAL FIX: Never apply explosion effect to the local player
              if (playerId === socket?.id) {
                return;
              }

              // Clone the position since it comes from the pool and will be released
              const clonedPosition = position.clone();
              
              // Create explosion effect at the hit player's position
              const explosionId = nextCrossentropyExplosionId.current++;
              
              setPvpCrossentropyExplosions(prev => [...prev, {
                id: explosionId,
                playerId: playerId,
                position: clonedPosition,
                startTime: Date.now(),
                duration: 1000 // 1 second explosion
              }]);
              
              // Remove explosion effect after duration
              setTimeout(() => {
                setPvpCrossentropyExplosions(prev => prev.filter(effect => effect.id !== explosionId));
              }, 1000);
            }}
          />

          {/* PVP Summon Totem Manager */}
          <PVPSummonTotemManager
            enemyData={pvpSummonTotemEnemyData}
            players={players}
            localSocketId={socket?.id}
            onDamage={(targetId, damage, impactPosition, isCritical) => {

              if (targetId === socket?.id) {
                return;
              }

              // Handle damage to other players
              const targetPlayer = players.get(targetId);
              if (targetPlayer) {
                if (broadcastPlayerDamage) {
                  broadcastPlayerDamage(targetId, damage, 'summon_totem', isCritical);
                }

                // Add damage numbers for immediate visual feedback
                if (onDamageNumbersUpdate && impactPosition) {
                  const damageNumberId = Math.random().toString(36).substr(2, 9);
                  onDamageNumbersUpdate([{
                    id: damageNumberId,
                    damage: damage,
                    position: impactPosition,
                    isCritical: !!isCritical,
                    timestamp: Date.now(),
                    damageType: 'summon_totem'
                  }]);
                }
              }
            }}
            setActiveEffects={setPvpSummonTotemEffects}
            activeEffects={pvpSummonTotemEffects}
            setDamageNumbers={smiteDamageNumbers.setDamageNumbers}
            nextDamageNumberId={smiteDamageNumbers.nextDamageNumberId}
            onHealPlayer={(healAmount) => {
              // Heal the local player
              if (playerEntityRef.current && engineRef.current) {
                const world = engineRef.current.getWorld();
                const playerEntity = world.getEntity(playerEntityRef.current);
                if (playerEntity) {
                  const health = playerEntity.getComponent(Health);
                  if (health) {
                    const currentHealth = health.currentHealth;
                    const maxHealth = health.maxHealth;
                    const newHealth = Math.min(maxHealth, currentHealth + healAmount);
                    health.currentHealth = newHealth;

                    // Create healing damage number
                    const healPosition = playerEntity.getComponent(Transform)?.position.clone() || new Vector3();
                    healPosition.y += 1.5; // Position above player's head
                    if (onDamageNumbersUpdate) {
                      onDamageNumbersUpdate([{
                        id: `summon_totem_heal_${Date.now()}_${Math.random()}`,
                        damage: healAmount,
                        position: healPosition,
                        isCritical: false,
                        timestamp: Date.now(),
                        damageType: 'summon_totem_healing'
                      }]);
                    }

                    // Broadcast healing to other players
                    if (broadcastPlayerHealing) {
                      broadcastPlayerHealing(healAmount, 'summon_totem', healPosition);
                    }
                  }
                }
              }
            }}
            playerId={socket?.id}
          />


          {/* PVP Reanimate Effects */}
          {pvpReanimateEffects.map(reanimateEffect => {
            // Find the current position of the affected player
            const affectedPlayer = players.get(reanimateEffect.playerId);
            const currentPosition = affectedPlayer
              ? new Vector3(affectedPlayer.position.x, affectedPlayer.position.y, affectedPlayer.position.z)
              : reanimateEffect.position;

            return (
              <PVPReanimateEffect
                key={reanimateEffect.id}
                position={currentPosition}
                onComplete={() => {
                  setPvpReanimateEffects(prev => prev.filter(effect => effect.id !== reanimateEffect.id));
                }}
              />
            );
          })}

          {/* PVP Smite Effects */}
          {pvpSmiteEffects.map(smiteEffect => {
            // Create enemy data from other players for PVP smite damage
            const otherPlayersData = Array.from(players.entries())
              .filter(([playerId]) => playerId !== smiteEffect.playerId)
              .map(([playerId, player]) => ({
                id: playerId,
                position: new Vector3(player.position.x, player.position.y, player.position.z),
                health: player.health
              }));


            return (
              <Smite
                key={smiteEffect.id}
                weaponType={WeaponType.RUNEBLADE}
                position={smiteEffect.position}
                onComplete={() => {
                  // Animation completed, but don't remove yet - let setTimeout handle cleanup
                }}
                onHit={(targetId, damage) => {
                  // Handle PVP damage through broadcast system
                  broadcastPlayerDamage(targetId, damage, 'smite');
                }}
                enemyData={otherPlayersData}
                onDamageDealt={smiteEffect.onDamageDealt || ((totalDamage) => {
                  // Fallback healing if no callback provided - heal for the actual damage dealt
                  if (totalDamage > 0 && playerEntity) {
                    const healthComponent = playerEntity.getComponent(Health);
                    if (healthComponent) {
                      const oldHealth = healthComponent.currentHealth;
                      const didHeal = healthComponent.heal(totalDamage); // Smite healing based on damage dealt
                      if (didHeal) {
                      }
                    }
                  }
                })}
                setDamageNumbers={smiteDamageNumbers.setDamageNumbers}
                nextDamageNumberId={smiteDamageNumbers.nextDamageNumberId}
                combatSystem={engineRef.current?.getWorld().getSystem(require('@/systems/CombatSystem').CombatSystem)}
                isCorruptedAuraActive={smiteEffect.playerId === socket?.id
                  ? controlSystemRef.current?.isCorruptedAuraActive() || false
                  : multiplayerPlayerStates.get(smiteEffect.playerId)?.isCorruptedAuraActive || false}
              />
            );
          })}

          {/* PVP Colossus Strike Effects */}
          {pvpColossusStrikeEffects.map(colossusStrikeEffect => {
            // Create enemy data from other players for PVP colossus strike damage
            const otherPlayersData = Array.from(players.entries())
              .filter(([playerId]) => playerId !== colossusStrikeEffect.playerId)
              .map(([playerId, player]) => ({
                id: playerId,
                position: new Vector3(player.position.x, player.position.y, player.position.z),
                health: player.health
              }));


            return (
              <ColossusStrike
                key={colossusStrikeEffect.id}
                weaponType={WeaponType.SWORD}
                position={colossusStrikeEffect.position}
                damage={colossusStrikeEffect.damage || 100}
                onComplete={() => {
                  // Animation completed, but don't remove yet - let setTimeout handle cleanup
                }}
                onHit={(targetId, damage, isCritical) => {
                  // Handle PVP damage through broadcast system
                  broadcastPlayerDamage(targetId, damage, 'colossusStrike');
                }}
                targetPlayerData={otherPlayersData}
                onDamageDealt={colossusStrikeEffect.onDamageDealt || ((damageDealt) => {
                  // No healing for Colossus Strike (unlike Smite)
                })}
                setDamageNumbers={smiteDamageNumbers.setDamageNumbers}
                nextDamageNumberId={smiteDamageNumbers.nextDamageNumberId}
                combatSystem={engineRef.current?.getWorld().getSystem(require('@/systems/CombatSystem').CombatSystem)}
              />
            );
          })}


          {/* PVP DeathGrasp Effects */}
          {pvpDeathGraspEffects.map(deathGraspEffect => {
            // For local player, use current transform position instead of potentially stale players map position
            let currentStartPosition: Vector3;

            if (deathGraspEffect.playerId === socket?.id && playerEntity) {
              // Local player - use current ECS position
              const transform = playerEntity.getComponent(Transform);
              if (transform) {
                currentStartPosition = transform.position.clone();
              } else {
                // Fallback to players map if ECS position unavailable
                const castingPlayer = players.get(deathGraspEffect.playerId);
                currentStartPosition = castingPlayer
                  ? new Vector3(castingPlayer.position.x, castingPlayer.position.y, castingPlayer.position.z)
                  : deathGraspEffect.startPosition;
              }
            } else {
              // Remote player - use players map position
              const castingPlayer = players.get(deathGraspEffect.playerId);
              currentStartPosition = castingPlayer
                ? new Vector3(castingPlayer.position.x, castingPlayer.position.y, castingPlayer.position.z)
                : deathGraspEffect.startPosition;
            }

            return (
              <DeathGraspProjectile
                key={deathGraspEffect.id}
                startPosition={currentStartPosition}
                direction={deathGraspEffect.direction}
                casterId={deathGraspEffect.playerId}
                onHit={(targetId: string, position: Vector3) => {
                  // Create the pulling effect when projectile hits
                  createPvpDeathGraspPull(targetId, currentStartPosition);
                }}
                onComplete={() => {
                  setPvpDeathGraspEffects(prev => prev.filter(effect => effect.id !== deathGraspEffect.id));
                }}
                players={players}
                localSocketId={socket?.id}
              />
            );
          })}

          {/* PVP DeathGrasp Pull Effects */}
          {pvpDeathGraspPulls.map(pull => {
            if (!pull.isActive) return null;

            return (
              <DeathGraspPull
                key={pull.id}
                targetPlayerId={pull.targetPlayerId}
                casterPosition={pull.casterPosition}
                isActive={pull.isActive}
                onComplete={() => {
                  setPvpDeathGraspPulls(prev => prev.map(p =>
                    p.id === pull.id ? { ...p, isActive: false } : p
                  ));
                }}
                playerEntities={serverPlayerEntities}
                getEntityPosition={(entityId) => {
                  const world = engineRef.current?.getWorld();
                  if (!world) return null;

                  const entity = world.getEntity(entityId);
                  if (!entity) return null;

                  const transform = entity.getComponent(Transform);
                  return transform ? transform.position : null;
                }}
                updateEntityPosition={(entityId, position) => {
                  const world = engineRef.current?.getWorld();
                  if (!world) return;

                  const entity = world.getEntity(entityId);
                  if (!entity) return;

                  const transform = entity.getComponent(Transform);
                  if (transform) {
                    transform.setPosition(position.x, position.y, position.z);
                  }
                }}
              />
            );
          })}

          {/* PVP Frost Nova Effects */}
          {pvpFrostNovaEffects.map(frostNovaEffect => {
            // Find the current position of the casting player
            const castingPlayer = players.get(frostNovaEffect.playerId);
            const currentPosition = castingPlayer
              ? new Vector3(castingPlayer.position.x, castingPlayer.position.y, castingPlayer.position.z)
              : frostNovaEffect.position;

            return (
              <FrostNova
                key={frostNovaEffect.id}
                position={currentPosition}
                duration={frostNovaEffect.duration}
                startTime={frostNovaEffect.startTime}
                onComplete={() => {
                  setPvpFrostNovaEffects(prev => prev.filter(effect => effect.id !== frostNovaEffect.id));
                }}
              />
            );
          })}


          {/* PVP Crossentropy Explosion Effects */}
          {pvpCrossentropyExplosions.map(explosionEffect => {
            return (
              <CrossentropyExplosion
                key={explosionEffect.id}
                position={explosionEffect.position}
                chargeTime={1.0} // Default charge time for PVP explosions
                explosionStartTime={explosionEffect.startTime}
                onComplete={() => {
                  setPvpCrossentropyExplosions(prev => prev.filter(effect => effect.id !== explosionEffect.id));
                }}
              />
            );
          })}

          {/* PVP Summon Totem Explosion Effects */}
          {pvpSummonTotemExplosions.map(explosionEffect => {
            // Find the current position of the target player
            const targetPlayer = players.get(explosionEffect.playerId);
            const currentPosition = targetPlayer
              ? new Vector3(targetPlayer.position.x, targetPlayer.position.y, targetPlayer.position.z)
              : explosionEffect.position;

            return (
              <SummonTotemExplosion
                key={explosionEffect.id}
                position={currentPosition}
                explosionStartTime={explosionEffect.startTime}
                onComplete={() => {
                  setPvpSummonTotemExplosions(prev => prev.filter(effect => effect.id !== explosionEffect.id));
                }}
              />
            );
          })}

          {/* PVP Venom Effects */}
          {pvpVenomEffects.map(venomEffect => {
            // Find the current position of the affected player
            const affectedPlayer = players.get(venomEffect.playerId);
            const currentPosition = affectedPlayer 
              ? new Vector3(affectedPlayer.position.x, affectedPlayer.position.y, affectedPlayer.position.z)
              : venomEffect.position;
            
            return (
              <VenomEffect
                key={venomEffect.id}
                position={currentPosition}
                duration={venomEffect.duration}
                startTime={venomEffect.startTime}
                enemyId={venomEffect.playerId} // Use playerId as enemyId for tracking
                enemyData={Array.from(players.values()).filter(p => p.id !== socket?.id).map(p => ({
                  id: p.id,
                  position: new Vector3(p.position.x, p.position.y, p.position.z),
                  health: p.health,
                  isDying: false
                }))}
                onComplete={() => {
                  setPvpVenomEffects(prev => prev.filter(effect => effect.id !== venomEffect.id));
                }}
              />
            );
          })}

          {/* PVP Debuff Effects */}
          {pvpDebuffEffects.map(debuffEffect => {
            // Find the current position of the affected player
            const affectedPlayer = players.get(debuffEffect.playerId);
            let currentPosition: Vector3;
            
            // Special handling for local player to use the most up-to-date position
            if (debuffEffect.playerId === socket?.id && playerEntity) {
              const transform = playerEntity.getComponent(Transform);
              if (transform) {
                currentPosition = new Vector3(transform.position.x, transform.position.y + 0.5, transform.position.z);
              } else {
                currentPosition = new Vector3(playerPosition.x, playerPosition.y + 0.5, playerPosition.z);
              }
            } else if (affectedPlayer) {
              currentPosition = new Vector3(affectedPlayer.position.x, affectedPlayer.position.y + 0.5, affectedPlayer.position.z);
            } else {
              currentPosition = new Vector3(debuffEffect.position.x, debuffEffect.position.y + 0.5, debuffEffect.position.z);
            }
            
            // Use different effects for different debuff types
            if (debuffEffect.debuffType === 'frozen') {
              return (
                <FrozenEffect
                  key={debuffEffect.id}
                  position={currentPosition}
                  duration={debuffEffect.duration}
                  startTime={debuffEffect.startTime}
                  enemyId={debuffEffect.playerId}
                  enemyData={Array.from(players.values()).filter(p => p.id !== socket?.id).map(p => {
                    // For local player, use the most current position
                    if (p.id === socket?.id && playerEntity) {
                      const transform = playerEntity.getComponent(Transform);
                      const currentPos = transform ? transform.position : playerPosition;
                      return {
                        id: p.id,
                        position: currentPos.clone(),
                        health: p.health,
                        isDying: false
                      };
                    } else {
                      return {
                        id: p.id,
                        position: new Vector3(p.position.x, p.position.y, p.position.z),
                        health: p.health,
                        isDying: false
                      };
                    }
                  })}
                  onComplete={() => {
                    // Remove from tracking map
                    const indicatorKey = `${debuffEffect.playerId}:${debuffEffect.debuffType}`;
                    activeDebuffIndicators.current.delete(indicatorKey);
                    
                    setPvpDebuffEffects(prev => prev.filter(effect => effect.id !== debuffEffect.id));
                  }}
                />
              );
            } else if (debuffEffect.debuffType === 'stunned') {
              return (
                <StunnedEffect
                  key={debuffEffect.id}
                  position={currentPosition}
                  duration={debuffEffect.duration}
                  startTime={debuffEffect.startTime}
                  enemyId={debuffEffect.playerId}
                  disableCameraRotation={debuffEffect.playerId === socket?.id} // Only disable camera for the stunned player
                  enemyData={Array.from(players.values()).filter(p => p.id !== socket?.id).map(p => {
                    // For local player, use the most current position
                    if (p.id === socket?.id && playerEntity) {
                      const transform = playerEntity.getComponent(Transform);
                      const currentPos = transform ? transform.position : playerPosition;
                      return {
                        id: p.id,
                        position: currentPos.clone(),
                        health: p.health,
                        isDying: false
                      };
                    } else {
                      return {
                        id: p.id,
                        position: new Vector3(p.position.x, p.position.y, p.position.z),
                        health: p.health,
                        isDying: false
                      };
                    }
                  })}
                  onComplete={() => {
                    // Remove from tracking map
                    const indicatorKey = `${debuffEffect.playerId}:${debuffEffect.debuffType}`;
                    activeDebuffIndicators.current.delete(indicatorKey);
                    
                    setPvpDebuffEffects(prev => prev.filter(effect => effect.id !== debuffEffect.id));
                  }}
                />
              );
            } else {
              return (
                <DebuffIndicator
                  key={debuffEffect.id}
                  position={currentPosition}
                  debuffType={debuffEffect.debuffType}
                  duration={debuffEffect.duration}
                  startTime={debuffEffect.startTime}
                  stackCount={debuffEffect.stackCount}
                  onComplete={() => {
                    // Remove from tracking map
                    const indicatorKey = `${debuffEffect.playerId}:${debuffEffect.debuffType}`;
                    activeDebuffIndicators.current.delete(indicatorKey);
                    
                    setPvpDebuffEffects(prev => prev.filter(effect => effect.id !== debuffEffect.id));
                  }}
                />
              );
            }
          })}
          
          {/* Sabre Reaper Mist Effects for Stealth */}
          {activeMistEffects.map(mistEffect => {
            return (
              <SabreReaperMistEffect
                key={mistEffect.id}
                position={mistEffect.position}
                duration={1000} // 1 second duration
                onComplete={() => {
                  setActiveMistEffects(prev => prev.filter(effect => effect.id !== mistEffect.id));
                }}
              />
            );
          })}

          {/* Haunted Soul Effects for WraithStrike */}
          {pvpHauntedSoulEffects.map(soulEffect => {
            return (
              <HauntedSoulEffect
                key={soulEffect.id}
                position={soulEffect.position}
                onComplete={() => {
                  setPvpHauntedSoulEffects(prev => prev.filter(effect => effect.id !== soulEffect.id));
                }}
              />
            );
          })}

          {/* Death Effects for Dead Players */}
          {Array.from(deathEffects.values()).map(deathEffect => {
            return (
              <DeathEffect
                key={deathEffect.playerId}
                position={deathEffect.position}
                duration={10000} // 10 seconds (respawn time)
                startTime={deathEffect.startTime}
                playerId={deathEffect.playerId}
                playerData={Array.from(players.values()).map(p => {
                  // For local player, use the most current position
                  if (p.id === socket?.id && playerEntity) {
                    const transform = playerEntity.getComponent(Transform);
                    const currentPos = transform ? transform.position : new Vector3(p.position.x, p.position.y, p.position.z);
                    return {
                      id: p.id,
                      position: currentPos.clone(),
                      health: p.health
                    };
                  } else {
                    return {
                      id: p.id,
                      position: new Vector3(p.position.x, p.position.y, p.position.z),
                      health: p.health
                    };
                  }
                })}
                onComplete={() => {
                  setDeathEffects(prev => {
                    const newEffects = new Map(prev);
                    newEffects.delete(deathEffect.playerId);
                    return newEffects;
                  });
                }}
              />
            );
          })}

          {/* PVP Summon Totem Effects */}
          {pvpSummonTotemEffects.map(effect => {
            if (effect.type === 'summonExplosion') {
              const elapsed = effect.startTime ? (Date.now() - effect.startTime) / 1000 : 0;
              const duration = effect.duration || 0.2;
              const fade = Math.max(0, 1 - (elapsed / duration));

              return (
                <group key={effect.id} position={effect.position.toArray()}>
                  <mesh>
                    <sphereGeometry args={[0.35 * (1 + elapsed * 2), 32, 32]} />
                    <meshStandardMaterial
                      color="#0099ff"
                      emissive="#0088cc"
                      emissiveIntensity={0.5 * fade}
                      transparent
                      opacity={0.8 * fade}
                      depthWrite={false}
                      blending={AdditiveBlending}
                    />
                  </mesh>

                  <mesh>
                    <sphereGeometry args={[0.25 * (1 + elapsed * 3), 24, 24]} />
                    <meshStandardMaterial
                      color="#0077aa"
                      emissive="#cceeff"
                      emissiveIntensity={0.5 * fade}
                      transparent
                      opacity={0.9 * fade}
                      depthWrite={false}
                      blending={AdditiveBlending}
                    />
                  </mesh>

                  {[0.45, 0.65, 0.85].map((size, i) => (
                    <mesh key={i} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}>
                      <torusGeometry args={[size * (1 + elapsed * 3), 0.045, 16, 32]} />
                      <meshStandardMaterial
                        color="#0099ff"
                        emissive="#0088cc"
                        emissiveIntensity={1 * fade}
                        transparent
                        opacity={0.6 * fade * (1 - i * 0.2)}
                        depthWrite={false}
                        blending={AdditiveBlending}
                      />
                    </mesh>
                  ))}

                  {[...Array(4)].map((_, i) => {
                    const angle = (i / 4) * Math.PI * 2;
                    const radius = 0.5 * (1 + elapsed * 2);
                    return (
                      <mesh
                        key={`spark-${i}`}
                        position={[
                          Math.sin(angle) * radius,
                          Math.cos(angle) * radius,
                          0
                        ]}
                      >
                        <sphereGeometry args={[0.05, 8, 8]} />
                        <meshStandardMaterial
                          color="#0077aa"
                          emissive="#cceeff"
                          emissiveIntensity={2 * fade}
                          transparent
                          opacity={0.8 * fade}
                          depthWrite={false}
                          blending={AdditiveBlending}
                        />
                      </mesh>
                    );
                  })}

                  <pointLight
                    color="#0099ff"
                    intensity={1 * fade}
                    distance={4}
                    decay={2}
                  />
                  <pointLight
                    color="#0077aa"
                    intensity={1 * fade}
                    distance={6}
                    decay={1}
                  />
                </group>
              );
            }
            return null;
          })}
        </>
      )}


        </>
      )}

    </>
  );
}

function setupPVPGame(
  engine: Engine,
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  damagePlayerCallback: (playerId: string, damage: number, damageType?: string, isCritical?: boolean) => void,
  damageTowerCallback: (towerId: string, damage: number, sourcePlayerId?: string, damageType?: string) => void,
  damagePillarCallback?: (pillarId: string, damage: number, sourcePlayerId?: string) => void,
  damageSummonedUnitCallback?: (unitId: string, unitOwnerId: string, damage: number, sourcePlayerId: string) => void,
  damageEnemyCallback?: (enemyId: string, damage: number, sourcePlayerId?: string) => void,
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null,
  cameraSystemRef?: React.MutableRefObject<CameraSystem | null>
): { player: any; controlSystem: ControlSystem; towerSystem: TowerSystem; pillarSystem: PillarSystem } {
  const world = engine.getWorld();
  const inputManager = engine.getInputManager();

  // Enable shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // Create systems
  const physicsSystem = new PhysicsSystem();
  const collisionSystem = new CollisionSystem(5); // 5 unit cell size for spatial hash
  const combatSystem = new CombatSystem(world);
  const renderSystem = new RenderSystem(scene, camera, renderer);
  const projectileSystem = new ProjectileSystem(world);
  const towerSystem = new TowerSystem(world);
  const pillarSystem = new PillarSystem(world);
  // Note: SummonedUnitSystem is disabled for PVP - using server-authoritative summoned units instead
  // const summonedUnitSystem = new SummonedUnitSystem(world);

  // Initialize Audio System (reuse if already created for UI sounds)
  const audioSystem = (window as any).audioSystem || new AudioSystem();

  // Make audio system globally available for UI sounds (if not already set)
  if (!(window as any).audioSystem) {
    (window as any).audioSystem = audioSystem;
  }

  const controlSystem = new ControlSystem(
    camera as PerspectiveCamera,
    inputManager,
    world,
    projectileSystem,
    audioSystem,
    selectedWeapons
  );
  const cameraSystem = new CameraSystem(
    camera as PerspectiveCamera,
    inputManager,
    {
      distance: 8,
      height: 2,
      mouseSensitivity: 0.005,
      smoothing: 0.15,
    }
  );

  // Store camera system reference if ref provided
  if (cameraSystemRef) {
    cameraSystemRef.current = cameraSystem;
  }

  // Expose camera system globally for StunnedEffect access
  (window as any).cameraSystem = cameraSystem;
  
  // Expose damage number manager globally for PVP abilities
  (window as any).damageNumberManager = combatSystem.getDamageNumberManager();

  const interpolationSystem = new InterpolationSystem();

  // Connect systems
  projectileSystem.setCombatSystem(combatSystem);
  towerSystem.setProjectileSystem(projectileSystem);
  // summonedUnitSystem.setCombatSystem(combatSystem); // Disabled for server-authoritative units

  // Set up combat system to route player damage through PVP system
  combatSystem.setPlayerDamageCallback(damagePlayerCallback);

  // Set up enemy damage callback (for multiplayer mode with enemies)
  if (damageEnemyCallback) {
    combatSystem.setEnemyDamageCallback(damageEnemyCallback);
  }

  // Set up summoned unit damage callback
  combatSystem.setSummonedUnitDamageCallback((unitId: string, unitOwnerId: string, damage: number, sourcePlayerId: string, damageType?: string) => {
    // Use the summoned unit damage callback from multiplayer context
    if (damageSummonedUnitCallback) {
      damageSummonedUnitCallback(unitId, unitOwnerId, damage, sourcePlayerId);
    }
  });
  
  // Set up tower damage callback
  combatSystem.setTowerDamageCallback((towerId: string, damage: number, sourcePlayerId?: string, damageType?: string) => {
    // Use the tower damage callback from multiplayer context
    if (damageTowerCallback) {
      damageTowerCallback(towerId, damage, sourcePlayerId, damageType);
    }
  });

  // Set up pillar damage callback
  combatSystem.setPillarDamageCallback((pillarId: string, damage: number, sourcePlayerId?: string) => {
    // Use the pillar damage callback from multiplayer context
    if (damagePillarCallback) {
      damagePillarCallback(pillarId, damage, sourcePlayerId);
    }
  });

  // Add systems to world (order matters for dependencies)
  world.addSystem(physicsSystem);
  world.addSystem(collisionSystem);
  world.addSystem(combatSystem);
  world.addSystem(interpolationSystem); // Add interpolation system before render system
  world.addSystem(renderSystem);
  world.addSystem(projectileSystem);
  world.addSystem(towerSystem);
  world.addSystem(pillarSystem);
  world.addSystem(audioSystem);
  // world.addSystem(summonedUnitSystem); // Disabled for server-authoritative units
  world.addSystem(controlSystem);
  world.addSystem(cameraSystem);

  // Create player entity
  const playerEntity = createPVPPlayer(world);
  
  // Set player for control system and camera system
  controlSystem.setPlayer(playerEntity);
  cameraSystem.setTarget(playerEntity);
  cameraSystem.snapToTarget();

  // Set local player entity ID for combat system damage number filtering
  combatSystem.setLocalPlayerEntityId(playerEntity.id);

  // Preload weapon sound effects
  audioSystem.preloadWeaponSounds().catch((error: any) => {
    console.warn('Failed to preload weapon sounds:', error);
  });

  return { player: playerEntity, controlSystem, towerSystem, pillarSystem };
}

function createPVPPlayer(world: World): any {
  // Create player entity
  const player = world.createEntity();

  // Add Transform component
  const transform = world.createComponent(Transform);
  transform.setPosition(0, 0.5, 0); // Position sphere center at radius height above ground
  player.addComponent(transform);

  // NOTE: Local players do NOT get interpolation buffers
  // Only remote players use interpolation for smooth movement

  // Add Movement component
  const movement = world.createComponent(Movement);
  movement.maxSpeed = 3.75; // Reduced from 8 to 3.65 for slower movement
  movement.jumpForce = 8;
  movement.friction = 0.85;
  player.addComponent(movement);

  // Add Health component with level-based max health
  const maxHealth = ExperienceSystem.getMaxHealthForLevel(1); // Start at level 1
  const health = new Health(maxHealth);
  health.enableRegeneration(2, 5); // Slower regen in PVP: 1 HP per second after 10 seconds
  player.addComponent(health);

  // Add Shield component with 100 max shield
  const shield = new Shield(250, 20, 2.5); // 100 max shield, 20/s regen, 5s delay
  player.addComponent(shield);

  // Add Collider component for environment collision and PVP damage detection
  const collider = world.createComponent(Collider);
  collider.type = ColliderType.SPHERE;
  collider.radius = 1.2; // Reduced collision radius for better player proximity in PVP
  collider.layer = CollisionLayer.PLAYER; // Use player layer for local player
  // Set collision mask to collide with environment only - NO player-to-player collision in PVP
  collider.setMask(CollisionLayer.ENVIRONMENT);
  collider.setOffset(0, 0.5, 0); // Center on player
  player.addComponent(collider);

  // Store player ID in userData for projectile source identification
  // Note: This will be updated when the socket ID becomes available
  player.userData = player.userData || {};
  player.userData.playerId = 'unknown';


  
  // const localCollider = player.getComponent(Collider);

  return player;
}

function updateFPSCounter(fps: number) {
  const fpsElement = document.getElementById('fps-counter');
  if (fpsElement) {
    fpsElement.textContent = `FPS: ${fps}`;
  }
}
