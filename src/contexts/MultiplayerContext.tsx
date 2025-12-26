'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { SkillPointSystem, SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';

export interface Player {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  weapon: WeaponType;
  subclass?: WeaponSubclass;
  health: number;
  maxHealth: number;
  shield?: number;
  maxShield?: number;
  movementDirection?: { x: number; y: number; z: number };
  // PVP Debuff states
  isFrozen?: boolean;
  frozenUntil?: number;
  isSlowed?: boolean;
  slowedUntil?: number;
  movementSpeedMultiplier?: number;
  isVenomed?: boolean;
  venomedUntil?: number;
  // PVP Experience system
  experience?: number;
  level?: number;
  // Essence currency system
  essence?: number;
  // Purchased items
  purchasedItems?: string[];
  // Timestamp of last authoritative health/shield update to prevent flickering
  lastHealthTimestamp?: number;
}

export interface Enemy {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
}

interface Tower {
  id: string;
  ownerId: string;
  towerIndex: number;
  position: { x: number; y: number; z: number };
  side?: 'North' | 'South'; // Tower side indicator
  health: number;
  maxHealth: number;
  isDead?: boolean;
}

interface SummonedUnit {
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

interface Pillar {
  id: string;
  ownerId: string;
  pillarIndex: number;
  position: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  isDead?: boolean;
}

interface RoomPreview {
  roomId: string;
  exists: boolean;
  players: Player[];
  playerCount: number;
  maxPlayers: number;
  enemies: Enemy[];
  towers: Tower[];
  summonedUnits: SummonedUnit[];
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

// Animation state type for better type safety
type PlayerAnimationState = {
  isCharging?: boolean;
  chargeProgress?: number;
  isSwinging?: boolean;
  swordComboStep?: 1 | 2 | 3;
  isSpinning?: boolean;
  isDeflecting?: boolean;
  isSwordCharging?: boolean;
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  isCrossentropyCharging?: boolean;
  crossentropyChargeProgress?: number;
  isSummonTotemCharging?: boolean;
  summonTotemChargeProgress?: number;
  isSmiting?: boolean;
  isColossusStriking?: boolean;
  isWindShearing?: boolean;
  isWindShearCharging?: boolean;
  windShearChargeProgress?: number;
  isDeathGrasping?: boolean;
  isWraithStriking?: boolean;
  isCorruptedAuraActive?: boolean;
  isSkyfalling?: boolean;
  isBackstabbing?: boolean;
  isSundering?: boolean;
  isStealthing?: boolean;
  isInvisible?: boolean;
};

interface MultiplayerContextType {
  // Connection state
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;

  // Room state
  isInRoom: boolean;
  currentRoomId: string | null;
  players: Map<string, Player>;
  enemies: Map<string, Enemy>;
  towers: Map<string, Tower>;
  pillars: Map<string, Pillar>;
  summonedUnits: Map<string, SummonedUnit>;
  killCount: number;
  gameStarted: boolean;
  gameMode: 'multiplayer' | 'pvp';

  // Chat state
  chatMessages: ChatMessage[];
  isChatOpen: boolean;

  // Weapon selection state
  selectedWeapons: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null;

  // Skill point system state
  skillPointData: SkillPointData;

  // Room preview
  currentPreview: RoomPreview | null;
  
  // Actions
  joinRoom: (roomId: string, playerName: string, weapon: WeaponType, subclass?: WeaponSubclass, gameMode?: 'multiplayer' | 'pvp') => Promise<void>;
  leaveRoom: () => void;
  previewRoom: (roomId: string) => void;
  clearPreview: () => void;
  startGame: () => void;
  
  // Player actions
  updatePlayerPosition: (position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: { x: number; y: number; z: number }) => void;
  updatePlayerWeapon: (weapon: WeaponType, subclass?: WeaponSubclass) => void;
  updatePlayerHealth: (health: number, maxHealth?: number) => void;
  broadcastPlayerAttack: (attackType: string, position: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, animationData?: { comboStep?: 1 | 2 | 3; chargeProgress?: number; isSpinning?: boolean; isPerfectShot?: boolean; damage?: number; targetId?: number; hitPosition?: { x: number; y: number; z: number }; isSwordCharging?: boolean; sourceWeapon?: WeaponType; projectileConfig?: any }) => void;
  broadcastPlayerAbility: (abilityType: string, position: { x: number; y: number; z: number }, direction?: { x: number; y: number; z: number }, target?: string, extraData?: any) => void;
  broadcastPlayerEffect: (effect: any) => void;
  broadcastPlayerDamage: (targetPlayerId: string, damage: number, damageType?: string, isCritical?: boolean) => void;
  broadcastPlayerHealing: (healingAmount: number, healingType: string, position: { x: number; y: number; z: number }) => void;
  broadcastPlayerAnimationState: (animationState: PlayerAnimationState) => void;
  broadcastPlayerDebuff: (targetPlayerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', duration: number, effectData?: any) => void;
  broadcastPlayerStealth: (isInvisible: boolean) => void;
  broadcastPlayerKnockback: (targetPlayerId: string, direction: { x: number; y: number; z: number }, distance: number, duration: number) => void;
  broadcastPlayerTornadoEffect: (playerId: string, position: { x: number; y: number; z: number }, duration: number) => void;
  broadcastPlayerDeathEffect: (playerId: string, position: { x: number; y: number; z: number }, isStarting: boolean) => void;
  
  // Enemy actions
  damageEnemy: (enemyId: string, damage: number) => void;
  applyStatusEffect: (enemyId: string, effectType: string, duration: number) => void;

  // Tower actions
  damageTower: (towerId: string, damage: number, sourcePlayerId?: string, damageType?: string) => void;

  // Summoned unit actions
  damageSummonedUnit: (unitId: string, unitOwnerId: string, damage: number, sourcePlayerId: string) => void;

  // Pillar actions
  damagePillar: (pillarId: string, damage: number, sourcePlayerId?: string) => void;

  // Experience system actions
  updatePlayerExperience: (playerId: string, experience: number) => void;
  updatePlayerLevel: (playerId: string, level: number) => void;

  // Essence currency system actions
  updatePlayerEssence: (playerId: string, essence: number) => void;

  // Shield actions
  updatePlayerShield: (playerId: string, shield: number, maxShield?: number) => void;

  // Weapon selection actions
  setSelectedWeapons: (weapons: { primary: WeaponType; secondary: WeaponType; tertiary?: WeaponType }) => void;
  checkAndUnlockTertiaryWeapon: (currentLevel: number) => void;

  // Skill point system actions
  unlockAbility: (unlock: AbilityUnlock) => void;
  updateSkillPointsForLevel: (level: number) => void;

  // Merchant purchase actions
  purchaseItem: (itemId: string, cost: number, currency: 'essence') => boolean;

  // Chat actions
  sendChatMessage: (message: string) => void;
  openChat: () => void;
  closeChat: () => void;

  // Direct state setters for local visual updates (use with caution)
  setPlayers: React.Dispatch<React.SetStateAction<Map<string, Player>>>;
  setPillars: React.Dispatch<React.SetStateAction<Map<string, Pillar>>>;
}

const MultiplayerContext = createContext<MultiplayerContextType | null>(null);

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  }
  return context;
}

interface MultiplayerProviderProps {
  children: React.ReactNode;
}

export function MultiplayerProvider({ children }: MultiplayerProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [enemies, setEnemies] = useState<Map<string, Enemy>>(new Map());
  const [towers, setTowers] = useState<Map<string, Tower>>(new Map());
  const [pillars, setPillars] = useState<Map<string, Pillar>>(new Map());
  const [summonedUnits, setSummonedUnits] = useState<Map<string, SummonedUnit>>(new Map());
  const [killCount, setKillCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState<'multiplayer' | 'pvp'>('multiplayer');
  const [currentPreview, setCurrentPreview] = useState<RoomPreview | null>(null);
  const [selectedWeapons, setSelectedWeaponsState] = useState<{
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null>(null);
  const [skillPointData, setSkillPointData] = useState<SkillPointData>(SkillPointSystem.getInitialSkillPointData());

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Throttling refs to prevent infinite re-render loops
  const lastPlayerMoveUpdate = useRef<{ [playerId: string]: number }>({});
  const lastPlayerHealthUpdate = useRef<{ [playerId: string]: number }>({});
  const lastEnemyMoveUpdate = useRef<{ [enemyId: string]: number }>({});
  const lastEnemyDamageUpdate = useRef<{ [enemyId: string]: number }>({});
  
  // Track the latest authoritative health update timestamp per player (damage events)
  // This ref is used to filter out stale periodic health syncs that arrive after damage events
  // Using a ref instead of state ensures immediate visibility across all event handlers
  const lastAuthoritativeHealthTimestamp = useRef<{ [playerId: string]: number }>({});

  // Initialize socket connection
  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_BACKEND_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://avernus-backend.fly.dev'
        : 'http://localhost:8080');

    console.log('🔌 Connecting to multiplayer server:', serverUrl);

    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    // Store event handlers for cleanup
    const eventHandlers = new Map<string, (...args: any[]) => void>();

    // Helper function to add event handler with cleanup tracking
    const addEventHandler = (event: string, handler: (...args: any[]) => void) => {
      eventHandlers.set(event, handler);
      newSocket.on(event, handler);
    };

    // Connection event handlers
    addEventHandler('connect', () => {
      console.log('✅ Connected to multiplayer server');
      setIsConnected(true);
      setConnectionError(null);

      // Start heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      heartbeatInterval.current = setInterval(() => {
        newSocket.emit('heartbeat');
      }, 30000); // Send heartbeat every 30 seconds
    });

    addEventHandler('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      setIsConnected(false);
      setIsInRoom(false);
      setCurrentRoomId(null);
      setPlayers(new Map());
      setEnemies(new Map());
      setTowers(new Map());

      // Clear heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    });

    addEventHandler('connect_error', (error) => {
      console.error('🔥 Connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Room event handlers
    addEventHandler('room-joined', (data) => {
      console.log('🏠 Joined room:', data);
      setIsInRoom(true);
      setCurrentRoomId(data.roomId);
      setKillCount(data.killCount);
      setGameStarted(data.gameStarted);
      setGameMode(data.gameMode || 'multiplayer'); // Set game mode from server

      // Update players
      const playersMap = new Map();
      data.players.forEach((player: Player) => {
        playersMap.set(player.id, player);
      });
      setPlayers(playersMap);

      // Update enemies (only for multiplayer mode)
      if (data.gameMode !== 'pvp') {
        const enemiesMap = new Map();
        data.enemies.forEach((enemy: Enemy) => {
          enemiesMap.set(enemy.id, enemy);
        });
        setEnemies(enemiesMap);
        setTowers(new Map()); // Clear towers for multiplayer mode
        setPillars(new Map()); // Clear pillars for multiplayer mode
        setSummonedUnits(new Map()); // Clear summoned units for multiplayer mode
      } else {
        setEnemies(new Map()); // Clear enemies for PVP mode
        // Update towers (only for PVP mode)
        const towersMap = new Map();
        if (data.towers) {
          data.towers.forEach((tower: Tower) => {
            towersMap.set(tower.id, tower);
          });
        }
        setTowers(towersMap);

        // Update pillars (only for PVP mode)
        const pillarsMap = new Map();
        if (data.pillars) {
          data.pillars.forEach((pillar: Pillar) => {
            pillarsMap.set(pillar.id, pillar);
          });
        }
        setPillars(pillarsMap);

        // Update summoned units (only for PVP mode)
        const summonedUnitsMap = new Map();
        if (data.summonedUnits) {
          data.summonedUnits.forEach((unit: SummonedUnit) => {
            summonedUnitsMap.set(unit.unitId, unit);
          });
        }
        setSummonedUnits(summonedUnitsMap);
      }
    });

    addEventHandler('room-full', () => {
      setConnectionError('Room is full (max 5 players)');
    });

    // Handle player level changes (for tertiary weapon unlocks)
    addEventHandler('player-level-changed', (data) => {
      const { playerId, level } = data;
      console.log(`📈 Player ${playerId} leveled up to ${level}`);

      setPlayers(prev => {
        const updated = new Map(prev);
        const player = updated.get(playerId);
        if (player) {
          updated.set(playerId, { ...player, level });
        }
        return updated;
      });
    });

    addEventHandler('player-joined', (data) => {
      console.log('👤 Player joined:', data);
      const playersMap = new Map();
      data.players.forEach((player: Player) => {
        playersMap.set(player.id, player);
      });
      setPlayers(playersMap);
    });

    addEventHandler('player-left', (data) => {
      console.log('👋 Player left:', data);
      const playersMap = new Map();
      data.players.forEach((player: Player) => {
        playersMap.set(player.id, player);
      });
      setPlayers(playersMap);
    });

    addEventHandler('player-moved', (data) => {
      // Throttle player movement updates to prevent infinite re-renders
      const now = Date.now();
      const lastUpdate = lastPlayerMoveUpdate.current[data.playerId] || 0;
      if (now - lastUpdate < 16) { // Throttle to ~60fps
        return;
      }
      lastPlayerMoveUpdate.current[data.playerId] = now;

      unstable_batchedUpdates(() => {
        setPlayers(prev => {
          const updated = new Map(prev);
          const player = updated.get(data.playerId);
          if (player) {
            updated.set(data.playerId, {
              ...player,
              position: data.position,
              rotation: data.rotation,
              movementDirection: data.movementDirection
            });
          }
          return updated;
        });
      });
    });

    addEventHandler('player-weapon-changed', (data) => {
      unstable_batchedUpdates(() => {
        setPlayers(prev => {
          const updated = new Map(prev);
          const player = updated.get(data.playerId);
          if (player) {
            updated.set(data.playerId, {
              ...player,
              weapon: data.weapon,
              subclass: data.subclass
            });
          }
          return updated;
        });
      });
    });

    // Track damage events to filter out stale health updates
    // This handler ONLY updates the authoritative timestamp ref - actual health updates
    // are handled by PVPGameScene's handlePlayerDamaged for full damage processing
    addEventHandler('player-damaged', (data) => {
      if (data.targetPlayerId && data.timestamp) {
        // Update the ref immediately (synchronous, not subject to React batching)
        lastAuthoritativeHealthTimestamp.current[data.targetPlayerId] = data.timestamp;
      }
    });

    addEventHandler('player-health-updated', (data) => {
      // Skip health updates for the local player - local Health component is authoritative
      // This prevents health bar flickering from race conditions between local and server state
      if (data.playerId === newSocket.id) {
        return;
      }

      // CRITICAL FIX: Check the ref-based authoritative timestamp BEFORE any React state access
      // This ensures we catch stale updates even if React hasn't processed the damage event's
      // state update yet (which would update player.lastHealthTimestamp in state)
      const lastDamageTimestamp = lastAuthoritativeHealthTimestamp.current[data.playerId];
      if (lastDamageTimestamp && data.timestamp && data.timestamp < lastDamageTimestamp) {
        // This health update is older than the last damage event - ignore it
        return;
      }

      // Throttle player health updates to prevent infinite re-renders
      const now = Date.now();
      const lastUpdate = lastPlayerHealthUpdate.current[data.playerId] || 0;
      if (now - lastUpdate < 100) { // Throttle to 10fps for health updates
        return;
      }
      lastPlayerHealthUpdate.current[data.playerId] = now;

      unstable_batchedUpdates(() => {
        setPlayers(prev => {
          const updated = new Map(prev);
          const player = updated.get(data.playerId);
          if (player) {
            // Double-check with state-based timestamp as a fallback
            if (player.lastHealthTimestamp && data.timestamp && data.timestamp < player.lastHealthTimestamp) {
              return prev;
            }
            
            // In PVP, also ignore health increases that aren't clearly heals or respawns
            if (gameMode === 'pvp' && data.health > player.health) {
              const diff = data.health - player.health;
              const isRegen = diff < 15;
              const isRespawn = data.health >= (data.maxHealth || player.maxHealth) - 5;
              if (!isRegen && !isRespawn) {
                return prev;
              }
            }

            updated.set(data.playerId, {
              ...player,
              health: data.health,
              maxHealth: data.maxHealth || player.maxHealth,
              lastHealthTimestamp: data.timestamp || Date.now()
            });
          }
          return updated;
        });
      });
    });

    // Enemy event handlers (only for multiplayer mode)
    addEventHandler('enemy-spawned', (data) => {
      // Only process enemy events in multiplayer mode, not PVP
      setGameMode(currentMode => {
        if (currentMode === 'pvp') {
          return currentMode;
        }
        setEnemies(prev => {
          const updated = new Map(prev);
          updated.set(data.enemy.id, data.enemy);
          return updated;
        });
        return currentMode;
      });
    });

    addEventHandler('enemy-damaged', (data) => {
      // Only process enemy events in multiplayer mode, not PVP
      setGameMode(currentMode => {
        if (currentMode === 'pvp') {
          return currentMode;
        }

        // Throttle enemy damage updates to prevent infinite re-renders
        const now = Date.now();
        const lastUpdate = lastEnemyDamageUpdate.current[data.enemyId] || 0;
        if (now - lastUpdate < 50) { // Throttle to 20fps for damage updates
          return currentMode;
        }
        lastEnemyDamageUpdate.current[data.enemyId] = now;

        setEnemies(prev => {
          const updated = new Map(prev);
          const enemy = updated.get(data.enemyId);
          if (enemy) {
            updated.set(data.enemyId, {
              ...enemy,
              health: data.newHealth,
              isDying: data.wasKilled
            });
          }
          return updated;
        });
        return currentMode;
      });
    });

    addEventHandler('enemy-moved', (data) => {
      // Only process enemy events in multiplayer mode, not PVP
      setGameMode(currentMode => {
        if (currentMode === 'pvp') {
          return currentMode;
        }

        // Throttle enemy movement updates to prevent infinite re-renders
        const now = Date.now();
        const lastUpdate = lastEnemyMoveUpdate.current[data.enemyId] || 0;
        if (now - lastUpdate < 33) { // Throttle to ~30fps for enemy movements
          return currentMode;
        }
        lastEnemyMoveUpdate.current[data.enemyId] = now;

        setEnemies(prev => {
          const updated = new Map(prev);
          const enemy = updated.get(data.enemyId);
          if (enemy) {
            updated.set(data.enemyId, {
              ...enemy,
              position: data.position,
              rotation: data.rotation
            });
          }
          return updated;
        });
        return currentMode;
      });
    });

    addEventHandler('kill-count-updated', (data) => {
      setKillCount(data.killCount);
    });

    addEventHandler('game-started', (data) => {
      setGameStarted(true);
      setKillCount(data.killCount);
    });

    addEventHandler('room-preview', (data) => {
      setCurrentPreview(data);
    });

    // Player action event handlers
    addEventHandler('player-attack', (data) => {
      // console.log('⚔️ Player attack received:', data);
      // This will be handled by the game scene to trigger animations
    });

    addEventHandler('player-used-ability', (data) => {
      // console.log('✨ Player ability received:', data);
      // This will be handled by the game scene to trigger ability effects
    });

    addEventHandler('player-effect', (data) => {
      // console.log('💫 Player effect received:', data);
      // This will be handled by the game scene to show visual effects
    });


    addEventHandler('player-animation-state', (data) => {
      // This will be handled by the game scene to update animation states
    });

    // Tower event handlers
    addEventHandler('tower-spawned', (data) => {
      // console.log('🏰 Tower spawned:', data.tower);
      setTowers(prev => {
        const updated = new Map(prev);
        updated.set(data.tower.id, data.tower);
        return updated;
      });
    });

    addEventHandler('tower-damaged', (data) => {
      setTowers(prev => {
        const updated = new Map(prev);
        const tower = updated.get(data.towerId);
        if (tower) {
          updated.set(data.towerId, {
            ...tower,
            health: data.newHealth,
            isDead: data.wasDestroyed
          });
        }
        return updated;
      });
    });

    addEventHandler('tower-destroyed', (data) => {
      // console.log('💥 Tower destroyed:', data.towerId);
      setTowers(prev => {
        const updated = new Map(prev);
        const tower = updated.get(data.towerId);
        if (tower) {
          updated.set(data.towerId, {
            ...tower,
            health: 0,
            isDead: true
          });
        }
        return updated;
      });
    });

    // Pillar event handlers
    addEventHandler('pillar-spawned', (data) => {
      setPillars(prev => {
        const updated = new Map(prev);
        updated.set(data.pillar.id, data.pillar);
        return updated;
      });
    });

    addEventHandler('pillar-damaged', (data) => {
      setPillars(prev => {
        const updated = new Map(prev);
        const pillar = updated.get(data.pillarId);
        if (pillar) {
          updated.set(data.pillarId, {
            ...pillar,
            health: data.newHealth,
            isDead: data.wasDestroyed
          });
        }
        return updated;
      });
    });

    addEventHandler('pillar-destroyed', (data) => {
      setPillars(prev => {
        const updated = new Map(prev);
        updated.delete(data.pillarId);
        return updated;
      });
    });

    // Summoned unit event handlers
    addEventHandler('summoned-unit-damaged', (data) => {      
      // Store the damage event for the game scene to process
      (window as any).pendingSummonedUnitDamage = (window as any).pendingSummonedUnitDamage || [];
      (window as any).pendingSummonedUnitDamage.push(data);
    });

    // Server-authoritative summoned unit updates
    addEventHandler('summoned-units-updated', (data) => {
      // console.log('🤖 Received summoned units update:', data.units.length, 'units');

      // Debug: Check for elite units
      const eliteUnits = data.units.filter((unit: SummonedUnit) => unit.isElite);
      if (eliteUnits.length > 0) {
        console.log(`🤖 Received ${eliteUnits.length} elite units:`, eliteUnits.map((u: SummonedUnit) => `${u.unitId} (owner: ${u.ownerId}, health: ${u.health}/${u.maxHealth})`));
      }

      unstable_batchedUpdates(() => {
        const summonedUnitsMap = new Map();
        data.units.forEach((unit: SummonedUnit) => {
          summonedUnitsMap.set(unit.unitId, unit);
        });
        setSummonedUnits(summonedUnitsMap);
      });``
    });

    // Wave completion handler
    addEventHandler('wave-completed', (data) => {
      
      // Check if this is PVP mode with specific winner
      if (data.winnerPlayerId && data.defeatedPlayerId) {
        // Trigger PVP-specific experience rewards through a global event
        window.dispatchEvent(new CustomEvent('pvp-wave-completed', { 
          detail: {
            ...data,
            isLocalPlayerWinner: data.winnerPlayerId === newSocket.id
          }
        }));
      } else {
        // Legacy multiplayer mode - award to all players
        window.dispatchEvent(new CustomEvent('wave-completed', { detail: data }));
      }
    });

    // Experience system event handlers
    addEventHandler('player-experience-updated', (data) => {
      setPlayers(prev => {
        const updated = new Map(prev);
        const player = updated.get(data.playerId);
        if (player) {
          updated.set(data.playerId, {
            ...player,
            experience: data.experience,
            level: data.level
          });
        }
        return updated;
      });
    });

    // Purchase system event handler
    addEventHandler('player-purchase', (data) => {
      setPlayers(prev => {
        const updated = new Map(prev);
        const player = updated.get(data.playerId);
        if (player) {
          updated.set(data.playerId, {
            ...player,
            essence: data.currency === 'essence' ? (player.essence || 0) - data.cost : player.essence,
            purchasedItems: [...(player.purchasedItems || []), data.itemId]
          });
        }
        return updated;
      });
    });

    // Chat system event handler
    addEventHandler('chat-message', (data) => {
      const chatMessage = data.message as ChatMessage;
      setChatMessages(prev => [...prev.slice(-49), chatMessage]); // Keep last 50 messages
    });

    setSocket(newSocket);

    return () => {
      // Remove all event handlers
      eventHandlers.forEach((handler, event) => {
        newSocket.off(event, handler);
      });
      eventHandlers.clear();

      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      newSocket.close();
    };
  }, []);

  // Actions
  const joinRoom = useCallback(async (roomId: string, playerName: string, weapon: WeaponType, subclass?: WeaponSubclass, gameMode: 'multiplayer' | 'pvp' = 'multiplayer') => {
    if (!socket || !isConnected) {
      throw new Error('Not connected to server');
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Join room timeout'));
      }, 10000);

      socket.once('room-joined', () => {
        clearTimeout(timeout);
        resolve();
      });

      socket.once('room-full', () => {
        clearTimeout(timeout);
        reject(new Error('Room is full'));
      });

      socket.emit('join-room', {
        roomId,
        playerName,
        weapon,
        subclass,
        gameMode
      });
    });
  }, [socket, isConnected]);

  const leaveRoom = useCallback(() => {
    if (socket) {
      socket.emit('leave-room');
      setIsInRoom(false);
      setCurrentRoomId(null);
      setPlayers(new Map());
      setEnemies(new Map());
      setTowers(new Map());
      setSummonedUnits(new Map());
      setKillCount(0);
      setGameStarted(false);
      setGameMode('multiplayer');
    }
  }, [socket]);

  const previewRoom = useCallback((roomId: string) => {
    if (socket && isConnected) {
      socket.emit('preview-room', { roomId });
    }
  }, [socket, isConnected]);

  const clearPreview = useCallback(() => {
    setCurrentPreview(null);
  }, []);

  const startGame = useCallback(() => {
    if (socket && currentRoomId) {
      socket.emit('start-game', { roomId: currentRoomId });
    }
  }, [socket, currentRoomId]);

  const updatePlayerPosition = useCallback((position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, movementDirection?: { x: number; y: number; z: number }) => {
    if (socket && currentRoomId) {
      socket.emit('player-update', {
        roomId: currentRoomId,
        position,
        rotation,
        movementDirection
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerWeapon = useCallback((weapon: WeaponType, subclass?: WeaponSubclass) => {
    if (socket && currentRoomId) {
      socket.emit('weapon-changed', {
        roomId: currentRoomId,
        weapon,
        subclass
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerHealth = useCallback((health: number, maxHealth?: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-health-changed', {
        roomId: currentRoomId,
        health,
        maxHealth
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerAttack = useCallback((attackType: string, position: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, animationData?: { comboStep?: 1 | 2 | 3; chargeProgress?: number; isSpinning?: boolean; isPerfectShot?: boolean; damage?: number; targetId?: number; hitPosition?: { x: number; y: number; z: number }; isSwordCharging?: boolean; sourceWeapon?: WeaponType; projectileConfig?: any }) => {
    if (socket && currentRoomId) {
      socket.emit('player-attack', {
        roomId: currentRoomId,
        attackType,
        position,
        direction,
        animationData
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerAbility = useCallback((abilityType: string, position: { x: number; y: number; z: number }, direction?: { x: number; y: number; z: number }, target?: string, extraData?: any) => {
    if (socket && currentRoomId) {
      socket.emit('player-ability', {
        roomId: currentRoomId,
        abilityType,
        position,
        direction,
        target,
        extraData
      });
    } else {
      // console.log('🔍 DEBUG: Cannot broadcast - missing socket or roomId');
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerEffect = useCallback((effect: any) => {
    if (socket && currentRoomId) {
      socket.emit('player-effect', {
        roomId: currentRoomId,
        effect
      });
    }
  }, [socket, currentRoomId]);

  const damageEnemy = useCallback((enemyId: string, damage: number) => {
    if (socket && currentRoomId) {
      socket.emit('enemy-damage', {
        roomId: currentRoomId,
        enemyId,
        damage
      });
    }
  }, [socket, currentRoomId]);

  const applyStatusEffect = useCallback((enemyId: string, effectType: string, duration: number) => {
    if (socket && currentRoomId) {
      socket.emit('apply-status-effect', {
        roomId: currentRoomId,
        enemyId,
        effectType,
        duration
      });
    }
  }, [socket, currentRoomId]);

  const damageTower = useCallback((towerId: string, damage: number, sourcePlayerId?: string, damageType?: string) => {
    if (socket && currentRoomId) {
      socket.emit('tower-damage', {
        roomId: currentRoomId,
        towerId,
        damage,
        sourcePlayerId,
        damageType
      });
    }
  }, [socket, currentRoomId]);

  const damageSummonedUnit = useCallback((unitId: string, unitOwnerId: string, damage: number, sourcePlayerId: string) => {


    if (socket && currentRoomId) {
      socket.emit('summoned-unit-damage', {
        roomId: currentRoomId,
        unitId,
        unitOwnerId,
        damage,
        sourcePlayerId
      });
    }
  }, [socket, currentRoomId]);

  const damagePillar = useCallback((pillarId: string, damage: number, sourcePlayerId?: string) => {
    if (socket && currentRoomId) {
      socket.emit('pillar-damage', {
        roomId: currentRoomId,
        pillarId,
        damage,
        sourcePlayerId
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerDamage = useCallback((targetPlayerId: string, damage: number, damageType?: string, isCritical?: boolean) => {
    if (socket && currentRoomId) {

      socket.emit('player-damage', {
        roomId: currentRoomId,
        targetPlayerId,
        damage,
        damageType,
        isCritical
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerHealing = useCallback((healingAmount: number, healingType: string, position: { x: number; y: number; z: number }) => {
    if (socket && currentRoomId) {
      socket.emit('player-healing', {
        roomId: currentRoomId,
        healingAmount,
        healingType,
        position
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerAnimationState = useCallback((animationState: PlayerAnimationState) => {
    if (socket && currentRoomId) {
      socket.emit('player-animation-state', {
        roomId: currentRoomId,
        animationState
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerDebuff = useCallback((targetPlayerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'burning', duration: number, effectData?: any) => {
    if (socket && currentRoomId) {
      socket.emit('player-debuff', {
        roomId: currentRoomId,
        targetPlayerId,
        debuffType,
        duration,
        effectData,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerStealth = useCallback((isInvisible: boolean) => {

    if (socket && currentRoomId) {
      socket.emit('player-stealth', {
        roomId: currentRoomId,
        playerId: socket.id,
        isInvisible,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerTornadoEffect = useCallback((playerId: string, position: { x: number; y: number; z: number }, duration: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-tornado-effect', {
        roomId: currentRoomId,
        playerId,
        position,
        duration,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerDeathEffect = useCallback((playerId: string, position: { x: number; y: number; z: number }, isStarting: boolean) => {
    if (socket && currentRoomId) {
      socket.emit('player-death-effect', {
        roomId: currentRoomId,
        playerId,
        position,
        isStarting,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const broadcastPlayerKnockback = useCallback((targetPlayerId: string, direction: { x: number; y: number; z: number }, distance: number, duration: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-knockback', {
        roomId: currentRoomId,
        playerId: socket.id,
        targetPlayerId,
        direction,
        distance,
        duration,
        timestamp: Date.now()
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerExperience = useCallback((playerId: string, experience: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-experience-changed', {
        roomId: currentRoomId,
        playerId,
        experience
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerEssence = useCallback((playerId: string, essence: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-essence-changed', {
        roomId: currentRoomId,
        playerId,
        essence
      });
    }
  }, [socket, currentRoomId]);

  const updatePlayerShield = useCallback((playerId: string, shield: number, maxShield?: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-shield-changed', {
        roomId: currentRoomId,
        playerId,
        shield,
        maxShield
      });
    }
  }, [socket, currentRoomId]);

  // Weapon selection functions (moved before updatePlayerLevel to avoid forward reference)
  const setSelectedWeapons = useCallback((weapons: { primary: WeaponType; secondary: WeaponType; tertiary?: WeaponType }) => {
    setSelectedWeaponsState(weapons);
  }, []);

  const checkAndUnlockTertiaryWeapon = useCallback((currentLevel: number) => {
    if (currentLevel >= 3 && selectedWeapons && !selectedWeapons.tertiary) {
      // Get all available weapons
      const allWeapons = Object.values(WeaponType);
      // Filter out already selected weapons
      const availableWeapons = allWeapons.filter(weapon =>
        weapon !== selectedWeapons.primary && weapon !== selectedWeapons.secondary
      );

      // Randomly select one of the remaining weapons
      const randomIndex = Math.floor(Math.random() * availableWeapons.length);
      const tertiaryWeapon = availableWeapons[randomIndex];


      setSelectedWeaponsState({
        ...selectedWeapons,
        tertiary: tertiaryWeapon
      });
    }
  }, [selectedWeapons]);

  const updatePlayerLevel = useCallback((playerId: string, level: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-level-changed', {
        roomId: currentRoomId,
        playerId,
        level
      });

      // Check for tertiary weapon unlock in PVP mode
      if (gameMode === 'pvp') {
        checkAndUnlockTertiaryWeapon(level);
        // Update skill points when leveling up
        updateSkillPointsForLevel(level);
      }
    }
  }, [socket, currentRoomId, gameMode, checkAndUnlockTertiaryWeapon]);

  // Skill point system functions
  const unlockAbility = useCallback((unlock: AbilityUnlock) => {
    try {
      const newSkillPointData = SkillPointSystem.unlockAbility(skillPointData, unlock.weaponType, unlock.abilityKey, unlock.weaponSlot);
      setSkillPointData(newSkillPointData);
    } catch (error) {
      // console.error('Failed to unlock ability:', error);
    }
  }, [skillPointData]);

  const updateSkillPointsForLevel = useCallback((level: number) => {
    const newSkillPointData = SkillPointSystem.updateSkillPointsForLevel(skillPointData, level);
    setSkillPointData(newSkillPointData);
  }, [skillPointData]);

  const purchaseItem = useCallback((itemId: string, cost: number, currency: 'essence'): boolean => {
    // Try to find local player by socket ID first, then by looking for any player (for single-player mode)
    let localPlayer = players.get(socket?.id || '');
    if (!localPlayer) {
      // If no player found by socket ID, try to find any player (for cases where socket isn't connected)
      const allPlayers = Array.from(players.values());
      localPlayer = allPlayers.find(p => p.id) || undefined;
    }

    if (!localPlayer) {
      return false;
    }

    // Check if item is already purchased
    if (localPlayer.purchasedItems?.includes(itemId)) {
      return false;
    }

    // Check if player has enough essence
    const currentEssence = localPlayer.essence || 0;
    if (currentEssence < cost) {
      return false;
    }

    // Deduct essence and add item to purchased items
    const updatedPlayer = {
      ...localPlayer,
      essence: currentEssence - cost,
      purchasedItems: [...(localPlayer.purchasedItems || []), itemId]
    };

    setPlayers(prev => new Map(prev).set(localPlayer.id, updatedPlayer));

    // Broadcast to other players
    if (socket && currentRoomId) {
      socket.emit('player-purchase', {
        roomId: currentRoomId,
        playerId: localPlayer.id,
        itemId,
        cost,
        currency
      });
    }

    return true;
  }, [players, socket, currentRoomId]);

  // Chat functions
  const sendChatMessage = useCallback((message: string) => {
    if (!socket || !currentRoomId || !socket.id) return;

    const chatMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      playerId: socket.id,
      playerName: players.get(socket.id)?.name || 'Unknown',
      message: message.trim(),
      timestamp: Date.now()
    };

    // Add to local chat messages immediately
    setChatMessages(prev => [...prev.slice(-49), chatMessage]); // Keep last 50 messages

    // Broadcast to other players
    socket.emit('chat-message', {
      roomId: currentRoomId,
      message: chatMessage
    });
  }, [socket, currentRoomId, players]);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const contextValue: MultiplayerContextType = {
    socket,
    isConnected,
    connectionError,
    isInRoom,
    currentRoomId,
    players,
    enemies,
    towers,
    pillars,
    summonedUnits,
    setPillars,
    killCount,
    gameStarted,
    gameMode,
    currentPreview,
    joinRoom,
    leaveRoom,
    previewRoom,
    clearPreview,
    startGame,
    updatePlayerPosition,
    updatePlayerWeapon,
    updatePlayerHealth,
    broadcastPlayerAttack,
    broadcastPlayerAbility,
    broadcastPlayerEffect,
    broadcastPlayerDamage,
    broadcastPlayerHealing,
    broadcastPlayerAnimationState,
    broadcastPlayerDebuff,
    broadcastPlayerStealth,
    broadcastPlayerKnockback,
    broadcastPlayerTornadoEffect,
    broadcastPlayerDeathEffect,
    damageEnemy,
    applyStatusEffect,
    damageTower,
    damageSummonedUnit,
    damagePillar,
    updatePlayerExperience,
    updatePlayerLevel,
    updatePlayerEssence,
    updatePlayerShield,
    selectedWeapons,
    setSelectedWeapons,
    checkAndUnlockTertiaryWeapon,
    skillPointData,
    unlockAbility,
    updateSkillPointsForLevel,
    purchaseItem,
    chatMessages,
    isChatOpen,
    sendChatMessage,
    openChat,
    closeChat,
    setPlayers
  };

  return (
    <MultiplayerContext.Provider value={contextValue}>
      {children}
    </MultiplayerContext.Provider>
  );
}
