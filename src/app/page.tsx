'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { WeaponType, WeaponSubclass } from '../components/dragon/weapons';
import { Camera } from '../utils/three-exports';
import type { DamageNumberData } from '../components/DamageNumbers';
import DamageNumbers from '../components/DamageNumbers';
import GameUI from '../components/ui/GameUI';
import BowAimer from '../components/ui/BowAimer';
import ScytheAimer from '../components/ui/ScytheAimer';
import { getGlobalRuneCounts, getCriticalChance, getCriticalDamageMultiplier } from '../core/DamageCalculator';
import ExperienceBar from '../components/ui/ExperienceBar';
import EssenceDisplay from '../components/ui/EssenceDisplay';
import ControlsPanel from '../components/ui/ControlsPanel';
import { MultiplayerProvider, useMultiplayer } from '../contexts/MultiplayerContext';
import RoomJoin from '../components/ui/RoomJoin';
import MerchantUI from '../components/ui/MerchantUI';
import { weaponAbilities, getAbilityIcon, type AbilityData } from '../utils/weaponAbilities';

// Extend Window interface to include audioSystem
declare global {
  interface Window {
    audioSystem?: any;
  }
}

// Dynamic imports for maximum code splitting
const Canvas = dynamic(() => import('@react-three/fiber').then(mod => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen text-white">Loading 3D engine...</div>
});


// Lazy load PVP game scene
const PVPGameScene = dynamic(() => import('../components/PVPGameScene').then(mod => ({ default: mod.PVPGameScene })), {
  ssr: false,
  loading: () => null
});

// Weapon option interface
interface WeaponOption {
  type: WeaponType;
  name: string;
  icon: string;
  description: string;
  defaultSubclass: WeaponSubclass;
}

// Tooltip component for ability descriptions
interface TooltipProps {
  content: {
    name: string;
    description: string;
    cooldown?: number;
  };
  visible: boolean;
  x: number;
  y: number;
}

function AbilityTooltip({ content, visible, x, y }: TooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm max-w-xs pointer-events-none"
      style={{
        left: x - 150, // Center tooltip above cursor
        top: y - 100,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="font-semibold text-blue-300 mb-1">{content.name}</div>
      {content.cooldown !== undefined && (
        <div className="text-yellow-400 text-xs mb-1">Cooldown: {content.cooldown}s</div>
      )}
      <div className="text-gray-300">{content.description}</div>
    </div>
  );
}

function HomeContent() {
  const { selectedWeapons, setSelectedWeapons, skillPointData, unlockAbility, updateSkillPointsForLevel, purchaseItem, players, socket, winner } = useMultiplayer();

  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [cameraInfo, setCameraInfo] = useState<{
    camera: Camera | null;
    size: { width: number; height: number };
  }>({
    camera: null,
    size: { width: 0, height: 0 }
  });
  const [localPurchasedItems, setLocalPurchasedItems] = useState<string[]>([]);
  const [gameState, setGameState] = useState({
    playerHealth: 200,
    maxHealth: 200,
    playerShield: 100,
    maxShield: 100,
    currentWeapon: WeaponType.BOW,
    currentSubclass: WeaponSubclass.ELEMENTAL,
    mana: 150,
    maxMana: 150
  });

  // Helper function to get default subclass for a weapon
  const getDefaultSubclassForWeapon = (weapon: WeaponType): WeaponSubclass => {
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
  };

  // Update gameState when selectedWeapons changes
  useEffect(() => {
    if (selectedWeapons?.primary) {
      setGameState(prev => ({
        ...prev,
        currentWeapon: selectedWeapons.primary,
        // Update subclass based on weapon type
        currentSubclass: getDefaultSubclassForWeapon(selectedWeapons.primary)
      }));
    }
  }, [selectedWeapons]);

  const [controlSystem, setControlSystem] = useState<any>(null);
  const [gameMode, setGameMode] = useState<'menu' | 'singleplayer' | 'multiplayer' | 'pvp'>('menu');
  const [showRoomJoin, setShowRoomJoin] = useState(false);
  const [roomJoinMode, setRoomJoinMode] = useState<'multiplayer' | 'pvp'>('multiplayer');
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerEssence, setPlayerEssence] = useState(50); // Start with 50 essence
  const [showMerchantUI, setShowMerchantUI] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  
  // Tower info state for PVP mode
  const [towerInfo, setTowerInfo] = useState<{
    side: 'North' | 'South' | null;
    health: number;
    maxHealth: number;
    towerPosition: { x: number; y: number; z: number } | null;
    playerPosition: { x: number; y: number; z: number } | null;
  }>({
    side: null,
    health: 0,
    maxHealth: 0,
    towerPosition: null,
    playerPosition: null
  });
  
  // Bow aimer state - tracks charging state, visibility, vertical aim, and zoom for the aimer UI
  const [bowAimerState, setBowAimerState] = useState({
    isCharging: false,
    chargeProgress: 0,
    isBowEquipped: false,
    verticalAim: 0, // -1 (looking up) to 1 (looking down)
    cameraDistance: 8 // 2 (zoomed in) to 12.5 (zoomed out)
  });

  // Scythe aimer state - tracks firing state, visibility, vertical aim, and zoom for the aimer UI
  const [scytheAimerState, setScytheAimerState] = useState({
    isFiring: false,
    isScytheEquipped: false,
    hasCryoflame: false,
    verticalAim: 0, // -1 (looking up) to 1 (looking down)
    cameraDistance: 8 // 2 (zoomed in) to 12.5 (zoomed out)
  });

  // Local weapon selection state
  const [tempSelectedWeapons, setTempSelectedWeapons] = useState<WeaponType[]>([]);
  // Track weapon positions to maintain consistent primary/secondary assignment
  const [weaponPositions, setWeaponPositions] = useState<{ [key: string]: 'primary' | 'secondary' }>({});

  // Tooltip state for ability descriptions
  const [tooltipContent, setTooltipContent] = useState<{
    name: string;
    description: string;
    cooldown?: number;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Get weapon position for consistent display
  const getWeaponPosition = (weaponType: WeaponType): 'primary' | 'secondary' | null => {
    return weaponPositions[weaponType] || null;
  };

  // Get weapon color scheme for selection styling
  const getWeaponColorScheme = (weaponType: WeaponType) => {
    switch (weaponType) {
      case WeaponType.BOW:
        return {
          border: 'border-green-500',
          background: 'bg-green-500/20',
          shadow: 'shadow-green-500/30',
          badge: 'bg-green-600'
        };
      case WeaponType.SWORD:
        return {
          border: 'border-sky-400',
          background: 'bg-sky-400/20',
          shadow: 'shadow-sky-400/30',
          badge: 'bg-sky-500'
        };
      case WeaponType.SCYTHE:
        return {
          border: 'border-blue-500',
          background: 'bg-blue-500/20',
          shadow: 'shadow-blue-500/30',
          badge: 'bg-blue-600'
        };
      case WeaponType.RUNEBLADE:
        return {
          border: 'border-purple-500',
          background: 'bg-purple-500/20',
          shadow: 'shadow-purple-500/30',
          badge: 'bg-purple-600'
        };
      case WeaponType.SABRES:
        return {
          border: 'border-red-500',
          background: 'bg-red-500/20',
          shadow: 'shadow-red-500/30',
          badge: 'bg-red-600'
        };
      default:
        return {
          border: 'border-green-500',
          background: 'bg-green-500/20',
          shadow: 'shadow-green-500/30',
          badge: 'bg-green-600'
        };
    }
  };

  // Weapon options
  const weapons: WeaponOption[] = [
    {
      type: WeaponType.SCYTHE,
      name: 'Scythe',
      icon: '🦋',
      description: 'WEAVER',
      defaultSubclass: WeaponSubclass.CHAOS
    },
    {
      type: WeaponType.BOW,
      name: 'Bow',
      icon: '🏹',
      description: 'VIPER',
      defaultSubclass: WeaponSubclass.ELEMENTAL
    },
    {
      type: WeaponType.SABRES,
      name: 'Sabres',
      icon: '⚔️',
      description: 'ASSASSIN',      defaultSubclass: WeaponSubclass.FROST
    },
    {
      type: WeaponType.RUNEBLADE,
      name: 'Runeblade',
      icon: '🔮',
      description: 'TEMPLAR',
      defaultSubclass: WeaponSubclass.ARCANE
    },
    {
      type: WeaponType.SWORD,
      name: 'Greatsword',
      icon: '💎',
      description: 'IMMORTAL',
      defaultSubclass: WeaponSubclass.DIVINITY
    }
  ];

  const handleWeaponToggle = (weaponType: WeaponType) => {
    // Play selection sound when weapon is clicked
    if (window.audioSystem) {
      window.audioSystem.playUISelectionSound();
    }

    const isSelected = tempSelectedWeapons.includes(weaponType);

    if (isSelected) {
      // Remove weapon if already selected
      const newSelectedWeapons = tempSelectedWeapons.filter(w => w !== weaponType);

      // Create new positions object
      const newPositions: { [key: string]: 'primary' | 'secondary' } = {};

      // If we have weapons remaining, ensure proper primary/secondary assignment
      if (newSelectedWeapons.length === 1) {
        // Only one weapon left - it becomes primary
        newPositions[newSelectedWeapons[0]] = 'primary';
      } else if (newSelectedWeapons.length === 2) {
        // Two weapons - preserve existing positions if possible, otherwise reassign
        const remainingPositions = Object.entries(weaponPositions)
          .filter(([weapon]) => weapon !== weaponType && newSelectedWeapons.includes(weapon as WeaponType));

        if (remainingPositions.length === 2) {
          // Both remaining weapons had positions - preserve them
          remainingPositions.forEach(([weapon, position]) => {
            newPositions[weapon] = position;
          });
        } else if (remainingPositions.length === 1) {
          // Only one had a position - assign it as primary, other as secondary
          const [weaponWithPosition, position] = remainingPositions[0];
          newPositions[weaponWithPosition] = position;

          // Find the weapon without a position
          const weaponWithoutPosition = newSelectedWeapons.find(w => w !== weaponWithPosition);
          if (weaponWithoutPosition) {
            // Assign secondary to the weapon that doesn't have a position
            newPositions[weaponWithoutPosition] = position === 'primary' ? 'secondary' : 'primary';
          }
        } else {
          // No positions preserved - assign first as primary, second as secondary
          newSelectedWeapons.forEach((weapon, index) => {
            newPositions[weapon] = index === 0 ? 'primary' : 'secondary';
          });
        }
      }

      // Update state with new arrays
      setTempSelectedWeapons(newSelectedWeapons);
      setWeaponPositions(newPositions);
    } else {
      // Add weapon if not selected and we haven't reached the limit
      if (tempSelectedWeapons.length < 2) {
        const newSelectedWeapons = [...tempSelectedWeapons, weaponType];

        // Create new positions
        const newPositions = { ...weaponPositions };

        if (newSelectedWeapons.length === 1) {
          // First weapon - always primary
          newPositions[weaponType] = 'primary';
        } else if (newSelectedWeapons.length === 2) {
          // Second weapon - always secondary
          newPositions[weaponType] = 'secondary';
        }

        setTempSelectedWeapons(newSelectedWeapons);
        setWeaponPositions(newPositions);
      }
    }
  };

  // Tooltip handlers
  const handleAbilityHover = useCallback((
    e: React.MouseEvent,
    ability: AbilityData
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent({
      name: ability.name,
      description: ability.description,
      cooldown: ability.cooldown
    });
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleAbilityLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  const handleDamageNumberComplete = (id: string) => {
    // Use the global handler set by GameScene
    if ((window as any).handleDamageNumberComplete) {
      (window as any).handleDamageNumberComplete(id);
    }
  };

  const handleCameraUpdate = (camera: Camera, size: { width: number; height: number }) => {
    setCameraInfo({ camera, size });
  };

  const handleGameStateUpdate = (newGameState: {
    playerHealth: number;
    maxHealth: number;
    playerShield: number;
    maxShield: number;
    currentWeapon: WeaponType;
    currentSubclass: WeaponSubclass;
    mana?: number;
    maxMana?: number;
  }) => {
    setGameState({
      ...newGameState,
      mana: newGameState.mana ?? 150,
      maxMana: newGameState.maxMana ?? 150
    });
  };

  const handleControlSystemUpdate = (newControlSystem: any) => {
    setControlSystem(newControlSystem);
  };

  // Sync skill point data with control system
  useEffect(() => {
    if (controlSystem && skillPointData) {
      controlSystem.setSkillPointData(skillPointData);
    }
  }, [controlSystem, skillPointData]);

  // Poll control system for bow charging state (for the aimer UI)
  useEffect(() => {
    if (!controlSystem || gameMode === 'menu') return;

    const pollBowState = () => {
      const currentWeapon = controlSystem.getCurrentWeapon?.();
      const isBowEquipped = currentWeapon === WeaponType.BOW;
      const isCharging = isBowEquipped ? (controlSystem.isWeaponCharging?.() || false) : false;
      const chargeProgress = isBowEquipped ? (controlSystem.getChargeProgress?.() || 0) : 0;
      const verticalAim = isBowEquipped ? (controlSystem.getCameraVerticalAim?.() || 0) : 0;
      const cameraDistance = isBowEquipped ? (controlSystem.getCameraDistance?.() || 8) : 8;
      
      setBowAimerState(prev => {
        // Only update if values changed to prevent unnecessary re-renders
        if (prev.isCharging !== isCharging || 
            prev.chargeProgress !== chargeProgress || 
            prev.isBowEquipped !== isBowEquipped ||
            Math.abs(prev.verticalAim - verticalAim) > 0.001 ||
            Math.abs(prev.cameraDistance - cameraDistance) > 0.01) {
          return { isCharging, chargeProgress, isBowEquipped, verticalAim, cameraDistance };
        }
        return prev;
      });
    };

    // Poll at 60fps for smooth aimer updates
    const intervalId = setInterval(pollBowState, 16);
    return () => clearInterval(intervalId);
  }, [controlSystem, gameMode]);

  // Poll control system for scythe firing state (for the aimer UI)
  useEffect(() => {
    if (!controlSystem || gameMode === 'menu') return;

    const pollScytheState = () => {
      const currentWeapon = controlSystem.getCurrentWeapon?.();
      const isScytheEquipped = currentWeapon === WeaponType.SCYTHE;
      // For scythe, "charging" means actively firing Entropic bolts
      const isFiring = isScytheEquipped ? (controlSystem.isWeaponCharging?.() || false) : false;
      const verticalAim = isScytheEquipped ? (controlSystem.getCameraVerticalAim?.() || 0) : 0;
      const cameraDistance = isScytheEquipped ? (controlSystem.getCameraDistance?.() || 8) : 8;
      
      // Check if Cryoflame (passive 'P') ability is unlocked for scythe
      // Need to check which slot the scythe is in (primary or secondary)
      let hasCryoflame = false;
      if (isScytheEquipped && selectedWeapons) {
        const weaponSlot = selectedWeapons.primary === WeaponType.SCYTHE ? 'primary' : 'secondary';
        const key = `${WeaponType.SCYTHE}_${weaponSlot}`;
        const unlockedForWeapon = skillPointData.unlockedAbilities[key] || new Set();
        hasCryoflame = unlockedForWeapon.has('P');
      }
      
      setScytheAimerState(prev => {
        // Only update if values changed to prevent unnecessary re-renders
        if (prev.isFiring !== isFiring || 
            prev.isScytheEquipped !== isScytheEquipped ||
            prev.hasCryoflame !== hasCryoflame ||
            Math.abs(prev.verticalAim - verticalAim) > 0.001 ||
            Math.abs(prev.cameraDistance - cameraDistance) > 0.01) {
          return { isFiring, isScytheEquipped, hasCryoflame, verticalAim, cameraDistance };
        }
        return prev;
      });
    };

    // Poll at 60fps for smooth aimer updates
    const intervalId = setInterval(pollScytheState, 16);
    return () => clearInterval(intervalId);
  }, [controlSystem, gameMode, skillPointData, selectedWeapons]);

  const handleExperienceUpdate = (experience: number, level: number) => {
    // Check if this is a level up before updating state
    const isLevelUp = level > playerLevel;

    setPlayerExperience(experience);
    setPlayerLevel(level);

    // Update skill points when level changes
    if (isLevelUp) {
      updateSkillPointsForLevel(level);
    }
  };

  const handleEssenceUpdate = (essence: number) => {
    setPlayerEssence(essence);
  };

  const handleTowerInfoUpdate = (info: { 
    side: 'North' | 'South' | null; 
    health: number; 
    maxHealth: number;
    towerPosition: { x: number; y: number; z: number } | null;
    playerPosition: { x: number; y: number; z: number } | null;
  }) => {
    setTowerInfo(info);
  };

  // Initialize tempSelectedWeapons and weapon positions when selectedWeapons changes
  useEffect(() => {
    if (selectedWeapons) {
      const weapons = [selectedWeapons.primary, selectedWeapons.secondary];
      setTempSelectedWeapons(weapons);

      // Set up weapon positions
      const positions: { [key: string]: 'primary' | 'secondary' } = {};
      positions[selectedWeapons.primary] = 'primary';
      positions[selectedWeapons.secondary] = 'secondary';
      setWeaponPositions(positions);
    }
  }, [selectedWeapons]);

  // Auto-confirm selection when exactly 2 weapons are selected
  useEffect(() => {
    if (tempSelectedWeapons.length === 2) {
      // Find primary and secondary based on weapon positions
      const primaryWeapon = tempSelectedWeapons.find(w => weaponPositions[w] === 'primary');
      const secondaryWeapon = tempSelectedWeapons.find(w => weaponPositions[w] === 'secondary');

      if (primaryWeapon && secondaryWeapon) {
        // Only update if the weapons have actually changed
        if (!selectedWeapons ||
            selectedWeapons.primary !== primaryWeapon ||
            selectedWeapons.secondary !== secondaryWeapon) {
          setSelectedWeapons({
            primary: primaryWeapon,
            secondary: secondaryWeapon
          });
        }
      }
    }
  }, [tempSelectedWeapons, weaponPositions]);

  // Clear weapon positions when no weapons are selected
  useEffect(() => {
    if (tempSelectedWeapons.length === 0) {
      setWeaponPositions({});
    }
  }, [tempSelectedWeapons]);

  // Sync localPurchasedItems with multiplayer context player data
  useEffect(() => {
    if (players.size > 0) {
      // Find the local player (either by socket ID or first player if in single-player mode)
      let localPlayer = players.get(socket?.id || '');
      if (!localPlayer) {
        // If no player found by socket ID, try to find any player (for cases where socket isn't connected)
        const allPlayers = Array.from(players.values());
        localPlayer = allPlayers.find(p => p.id) || undefined;
      }

      if (localPlayer?.purchasedItems) {
        setLocalPurchasedItems(localPlayer.purchasedItems);
      }
    }
  }, [players, socket?.id]);

  // Initialize audio system for UI sounds
  useEffect(() => {
    const initAudioSystem = async () => {
      try {
        const { AudioSystem } = await import('../systems/AudioSystem');
        const audioSystem = new AudioSystem();
        (window as any).audioSystem = audioSystem;

        // Only preload weapon sounds (fast loading)
        await audioSystem.preloadWeaponSounds();

        // Lazy load background music in the background (doesn't block UI)
        audioSystem.preloadBackgroundMusic().then(() => {
          // Start background music once loaded (35% volume for subtle background)
          audioSystem.startBackgroundMusic();
        }).catch((error) => {
          console.warn('Background music failed to load:', error);
        });

      } catch (error) {
        console.warn('Failed to initialize audio system:', error);
      }
    };

    initAudioSystem();
  }, []);

  return (
    <MultiplayerProvider>
      <main className="w-full h-screen bg-black relative">
        {/* Main Menu */}
        {gameMode === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center z-50 overflow-y-auto">
            <div className="relative">
              {/* Animated background glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 rounded-xl blur-lg animate-pulse"></div>

              {/* Main panel with glassmorphism */}
              <div className="relative bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl p-6 rounded-xl border border-blue-500/30 shadow-2xl shadow-blue-500/10 text-white max-w-4xl w-11/12 my-4">
              <button
                onClick={() => setShowRulesPanel(true)}
                className="absolute top-3 right-3 text-xl hover:scale-110 transition-transform cursor-pointer text-yellow-400 hover:text-yellow-300"
                title="Rulebook"
              >
                📜
              </button>
              {/* Enhanced title section */}
              <div className="text-center mb-6 relative">
                {/* Decorative background elements */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50"></div>
                </div>

                <h1 className="text-2xl font-black mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent relative">
                  SELECT 2 WEAPONS
                </h1>

                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-8 h-px bg-gradient-to-r from-transparent to-blue-400/60"></div>
                  <div className="text-xs font-medium text-blue-300/80 tracking-wider uppercase">
                    Choose Your Arsenal
                  </div>
                  <div className="w-8 h-px bg-gradient-to-l from-transparent to-blue-400/60"></div>
                </div>
              </div>

              {/* Weapon Selection Section */}
              <div className="mb-6">
                <div className="text-center mb-4">
                  <p className="text-xs text-gray-300/90 leading-relaxed">
                    <span className="font-semibold text-blue-300">Primary Weapon</span> becomes the '1' key |
                    <span className="font-semibold text-purple-300 ml-1">Secondary Weapon</span> becomes the '2' key
                  </p>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
                  {weapons.slice(0, 5).map((weapon) => {
                    const isSelected = tempSelectedWeapons.includes(weapon.type);
                    const canSelect = !isSelected && tempSelectedWeapons.length < 2;
                    const colorScheme = getWeaponColorScheme(weapon.type);
                    const weaponPosition = getWeaponPosition(weapon.type);

                    return (
                      <div
                        key={weapon.type}
                        onClick={() => handleWeaponToggle(weapon.type)}
                        className={`
                          group relative overflow-hidden rounded-xl cursor-pointer transition-all duration-500 transform
                          ${isSelected
                            ? `ring-2 ${colorScheme.border} ring-opacity-75 shadow-2xl ${colorScheme.shadow} scale-105`
                            : canSelect
                              ? 'hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20'
                              : 'opacity-50 cursor-not-allowed'
                          }
                        `}
                      >
                        {/* Animated background glow */}
                        <div className={`
                          absolute inset-0 transition-all duration-500 rounded-xl
                          ${isSelected
                            ? `${colorScheme.background} blur-sm`
                            : canSelect
                              ? 'bg-gradient-to-br from-gray-800/30 to-gray-900/30 group-hover:from-gray-700/40 group-hover:to-gray-800/40'
                              : 'bg-gray-900/20'
                          }
                        `}></div>

                        {/* Card content */}
                        <div className="relative bg-gradient-to-br from-gray-800/80 via-gray-900/90 to-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 h-full">
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute top-3 right-3">
                              <div className={`w-3 h-3 rounded-full ${colorScheme.badge} shadow-lg animate-pulse`}></div>
                            </div>
                          )}

                          {/* Weapon icon with enhanced styling */}
                          <div className="text-center mb-3 relative">
                            <div className={`
                              inline-flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 mb-2
                              ${isSelected
                                ? `${colorScheme.background} ring-2 ${colorScheme.border} ring-opacity-50 shadow-lg`
                                : canSelect
                                  ? 'bg-gray-700/50 ring-1 ring-gray-600/50 group-hover:ring-gray-500/70'
                                  : 'bg-gray-800/50 ring-1 ring-gray-700/30'
                              }
                            `}>
                              <span className="text-2xl filter drop-shadow-sm">{weapon.icon}</span>
                            </div>

                            <h3 className={`
                              text-sm font-bold mb-1 transition-colors duration-300
                              ${isSelected ? 'text-white' : canSelect ? 'text-gray-200 group-hover:text-white' : 'text-gray-400'}
                            `}>
                              {weapon.name}
                            </h3>
                          </div>

                          {/* Weapon class/description */}
                          <div className="text-center mb-3">
                            <span className={`
                              inline-block px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all duration-300
                              ${isSelected
                                ? `${colorScheme.badge} text-white shadow-md`
                                : canSelect
                                  ? 'bg-gray-700/60 text-gray-300 group-hover:bg-gray-600/60'
                                  : 'bg-gray-800/60 text-gray-500'
                              }
                            `}>
                              {weapon.description}
                            </span>
                          </div>

                          {/* Enhanced abilities section */}
                          <div className="mb-3">
                            <div className="text-xs text-gray-400 text-center mb-2 font-medium">ABILITIES</div>
                            <div className="flex justify-center gap-2">
                              {weaponAbilities[weapon.type]?.map((ability) => (
                                <div
                                  key={ability.key}
                                  className={`
                                    relative group/ability transition-all duration-200
                                    ${isSelected || canSelect ? 'cursor-pointer' : 'cursor-not-allowed'}
                                  `}
                                  onMouseEnter={(e) => handleAbilityHover(e, ability)}
                                  onMouseLeave={handleAbilityLeave}
                                >
                                  {/* Ability button with enhanced styling */}
                                  <div className={`
                                    w-7 h-7 rounded border flex items-center justify-center transition-all duration-200
                                    ${isSelected || canSelect
                                      ? 'bg-gray-700/80 border-gray-600 hover:bg-gray-600/80 hover:border-gray-500 hover:scale-110'
                                      : 'bg-gray-800/60 border-gray-700/50'
                                    }
                                  `}>
                                    <span className="text-xs font-medium">
                                      {getAbilityIcon(weapon.type, ability.key)}
                                    </span>
                                  </div>

                                  {/* Hotkey badge */}
                                  <div className={`
                                    absolute -top-1 -right-1 w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-bold transition-all duration-200
                                    ${isSelected
                                      ? `${colorScheme.badge} text-white shadow-md`
                                      : canSelect
                                        ? 'bg-gray-600 text-gray-200 group-hover/ability:bg-gray-500'
                                        : 'bg-gray-700 text-gray-500'
                                    }
                                  `}>
                                    {ability.key}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Selection status */}
                          {isSelected && weaponPosition && (
                            <div className="text-center">
                              <div className={`
                                inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300
                                ${weaponPosition === 'primary'
                                  ? 'bg-blue-600/80 text-blue-100 border border-blue-500/50'
                                  : 'bg-purple-600/80 text-purple-100 border border-purple-500/50'
                                }
                              `}>
                                <div className={`
                                  w-2 h-2 rounded-full
                                  ${weaponPosition === 'primary' ? 'bg-blue-300' : 'bg-purple-300'}
                                `}></div>
                                {weaponPosition === 'primary' ? 'PRIMARY (1)' : 'SECONDARY (2)'}
                              </div>
                            </div>
                          )}

                          {/* Hover effect overlay */}
                          {canSelect && !isSelected && (
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Enhanced Game Mode Buttons */}
              <div className="flex flex-col gap-3 items-center mt-6">
                <div className="relative group">
                  {/* Button glow effect */}
                  <div className={`
                    absolute -inset-1.5 rounded-lg blur-md transition-all duration-500
                    ${selectedWeapons
                      ? 'bg-gradient-to-r from-red-500/30 via-orange-500/30 to-red-500/30 opacity-75 group-hover:opacity-100'
                      : 'bg-gray-600/20 opacity-50'
                    }
                  `}></div>

                  <button
                    className={`
                      relative px-6 py-3 text-lg font-bold rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 w-full min-w-[240px] max-w-[320px]
                      ${selectedWeapons
                        ? 'bg-gradient-to-r from-red-600 via-red-500 to-orange-600 text-white border-red-400/50 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-500 hover:via-red-400 hover:to-orange-500 hover:border-red-300/70'
                        : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border-gray-600/50 cursor-not-allowed shadow-md'
                      }
                    `}
                    onClick={() => {
                      // Play interface sound
                      if (window.audioSystem) {
                        window.audioSystem.playUIInterfaceSound();
                      }

                      if (selectedWeapons) {
                        setRoomJoinMode('pvp');
                        setShowRoomJoin(true);
                      }
                    }}
                    disabled={!selectedWeapons}
                  >
                    <div className="flex items-center justify-center gap-3">
                      <span className={selectedWeapons ? 'text-white' : 'text-gray-400'}>
                        ⚔️ ENTER AVERNUS
                      </span>
                      {selectedWeapons && (
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      )}
                    </div>

                    {!selectedWeapons && (
                      <div className="text-sm text-gray-300 mt-1 font-normal opacity-75">
                        Select 2 Weapons First
                      </div>
                    )}
                  </button>
                </div>

                {/* Subtle hint text */}
                {selectedWeapons && (
                  <div className="text-center">
         
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Rules Panel */}
        {showRulesPanel && (
          <div
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowRulesPanel(false)}
          >
            <div
              className="bg-gray-900 border-2 border-yellow-400 rounded-xl p-8 max-w-2xl w-11/12 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-yellow-400 mb-2">📜 RULEBOOK</h2>
              </div>

              <div className="text-white space-y-4">
                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">🎯 OVERVIEW</h3>
                  <p className="text-gray-300">
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Each player has a Tower and 3 Inhibitors.</li>
                    <li>• Each player's Tower summons 3 Units every 45 seconds.</li>
                    <li>• Player kills and Summoned Unit kills award experience points.</li>
                    <li>• Leveling up grants a Skill Point to unlock additional abilities.</li>
                    <li>• Players respawn upon 10 seconds after death.</li>
                    <li>• Only Summoned Units can damage the opposing player's Tower.</li>
                    <li>• Players can destroy the opposing player's Inhibitors to upgrade their Summoned Units into ELITES.</li>
                    <li>• The first player to destroy the opposing player's Tower wins.</li>
                  </ul>
                  </p>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">⚔️ WEAPON SYSTEM</h3>
                  <p className="text-gray-300 mb-2">
                    Choose 2 weapons to equip. Each weapon has their 'Q' ability unlocked by default; all other abilities are unlocked by spending Skill Points. Each weapon has unique abilities and playstyles:
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• <strong className="text-green-400">Bow (VIPER) Ranged sniper with burst, harass and long-range siege potential</strong>:</li>
                    <li>• <strong className="text-sky-400">Greatsword (IMMORTAL) Versatile offensive figher with distance-closing and defensive capabilities</strong>:</li>
                    <li>• <strong className="text-blue-400">Scythe (WEAVER) Mana-based caster with offensive and defensive fire and ice spells</strong>:</li>
                    <li>• <strong className="text-purple-400">Runeblade (TEMPLAR) Mana-based knight with life-stealing, area control and debuff abilities</strong>: </li>
                    <li>• <strong className="text-red-400">Sabres (ASSASSIN) Stealth-based close-quarters specialist with high-risk, high-reward damage</strong>:</li>
                  </ul>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">🎮 CONTROLS</h3>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• <strong>WASD</strong>: Movement (Double-tap to dash)</li>
                    <li>• <strong>Left Click</strong>: Attack</li>
                    <li>• <strong>Right Click</strong>: Camera control</li>
                    <li>• <strong>Space</strong>: Jump</li>
                    <li>• <strong>1/2</strong>: Switch between primary/secondary weapons</li>
                    <li>• <strong>Q/E/R/F</strong>: Weapon abilities (hover over abilities to see details)</li>
                  </ul>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">🏆 OBJECTIVE</h3>
                  <p className="text-gray-300 mb-2">
                    Level up by killing enemy Players and their Summoned Units. Unlock skill points to enhance your abilities.
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Defend your Tower from the enemy player's Summoned Units</li>
                    <li>• Defend your Inhibitors from the enemy Player</li>
                    <li>• Use your Summoned Units to damage the enemy Player's Tower</li>
                    <li>• Destroy the enemy Player's Inhibitors to upgrade your Summoned Units into ELITES</li>
                    <li>• Level up to gain combat bonuses and to invest Skill Points into additional weapon abilities</li>
                    <li>• Destroy the enemy Player's Tower to win the game</li>
                  </ul>
                </div>

              
              </div>
            </div>
          </div>
        )}

        {/* Room Join UI */}
        {showRoomJoin && selectedWeapons && (
          <RoomJoin
            onJoinSuccess={() => {
              setShowRoomJoin(false);
              setGameMode(roomJoinMode);
            }}
            onBack={() => {
              setShowRoomJoin(false);
            }}
            currentWeapon={selectedWeapons.primary}
            currentSubclass={gameState.currentSubclass}
            gameMode={roomJoinMode}
          />
        )}

        <Canvas
          camera={{ 
            position: [0, 5, 10], 
            fov: 75,
            near: 0.1,
            far: 1000 
          }}
          shadows
          gl={{ 
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
          }}
        >


          {gameMode === 'pvp' && (
            <PVPGameScene
              onDamageNumbersUpdate={setDamageNumbers}
              onDamageNumberComplete={handleDamageNumberComplete}
              onCameraUpdate={handleCameraUpdate}
              onGameStateUpdate={handleGameStateUpdate}
              onControlSystemUpdate={handleControlSystemUpdate}
              onExperienceUpdate={handleExperienceUpdate}
              onEssenceUpdate={handleEssenceUpdate}
              onMerchantUIUpdate={setShowMerchantUI}
              onTowerInfoUpdate={handleTowerInfoUpdate}
              selectedWeapons={selectedWeapons}
              skillPointData={skillPointData}
            />
          )}
        </Canvas>
      
        {/* UI Overlay - Only show during gameplay */}
        {gameMode !== 'menu' && (
          <>
            {/* Bow Aimer - Only show when bow is equipped */}
            <BowAimer
              isVisible={bowAimerState.isBowEquipped}
              isCharging={bowAimerState.isCharging}
              chargeProgress={bowAimerState.chargeProgress}
              verticalAim={bowAimerState.verticalAim}
              cameraDistance={bowAimerState.cameraDistance}
            />

            {/* Scythe Aimer - Only show when scythe is equipped */}
            <ScytheAimer
              isVisible={scytheAimerState.isScytheEquipped}
              isFiring={scytheAimerState.isFiring}
              hasCryoflame={scytheAimerState.hasCryoflame}
              verticalAim={scytheAimerState.verticalAim}
              cameraDistance={scytheAimerState.cameraDistance}
            />
            
            {/* Controls Panel */}
            <div className="absolute top-4 left-4">
              <ControlsPanel />
            </div>
            
            {/* Performance Stats */}
            <div className="absolute top-2 right-4 text-white font-mono text-xs">
              <div id="fps-counter">FPS: --</div>

              {gameMode === 'pvp' && (
                <div className="mt-0.5 text-red-400">
                  <div>PVP Mode</div>
                </div>
              )}
            </div>
            
            {/* Damage Numbers Display - Outside Canvas */}
            {damageNumbers.length > 0 && cameraInfo.camera && cameraInfo.size && (
              <div className="absolute inset-0 pointer-events-none">
                <DamageNumbers
                  damageNumbers={damageNumbers}
                  onDamageNumberComplete={handleDamageNumberComplete}
                  camera={cameraInfo.camera}
                  size={cameraInfo.size}
                />
              </div>
            )}
            
            {/* Game UI - Outside Canvas */}
            <div className="absolute bottom-4 left-4">
              <GameUI
                key={`gameui-${localPurchasedItems.length}-${localPurchasedItems.join(',')}`}
                currentWeapon={controlSystem?.getCurrentWeapon() || selectedWeapons?.primary || gameState.currentWeapon}
                playerHealth={gameState.playerHealth}
                maxHealth={gameState.maxHealth}
                playerShield={gameState.playerShield}
                maxShield={gameState.maxShield}
                mana={gameState.mana || 150}
                maxMana={gameState.maxMana || 150}
                level={playerLevel}
                controlSystem={controlSystem}
                selectedWeapons={selectedWeapons}
                onWeaponSwitch={(slot) => {
                  if (controlSystem?.switchWeaponBySlot) {
                    controlSystem.switchWeaponBySlot(slot);
                  }
                }}
                skillPointData={skillPointData}
                onUnlockAbility={unlockAbility}
                purchasedItems={localPurchasedItems}
                criticalRuneCount={getGlobalRuneCounts().criticalRunes}
                critDamageRuneCount={getGlobalRuneCounts().critDamageRunes}
                criticalChance={getCriticalChance()}
                criticalDamageMultiplier={getCriticalDamageMultiplier()}
                towerSide={towerInfo.side}
                towerHealth={towerInfo.health}
                towerMaxHealth={towerInfo.maxHealth}
                towerPosition={towerInfo.towerPosition}
                playerPosition={towerInfo.playerPosition}
                winner={winner}
              />
            </div>

            {/* Experience Bar - Only show in PVP mode */}
            {gameMode === 'pvp' && (
              <ExperienceBar
                experience={playerExperience}
                level={playerLevel}
                isLocalPlayer={true}
              />
            )}



            {/* Merchant UI - Only show in PVP mode */}
            {gameMode === 'pvp' && (
              <MerchantUI
                isVisible={showMerchantUI}
                onClose={() => setShowMerchantUI(false)}
                onPurchase={(itemId) => {
                  // Find the item details
                  const MERCHANT_ITEMS = [
                    {
                      id: 'damage_boost',
                      name: 'Damage Boost',
                      description: 'Permanently increases your weapon damage by 15%',
                      cost: 75,
                      currency: 'essence' as const
                    },
                    {
                      id: 'ascendant_wings',
                      name: 'Ascendant Wings',
                      description: 'Beautiful angelic wings that replace your dragon wings with a celestial appearance',
                      cost: 50,
                      currency: 'essence' as const
                    }
                  ];

                  const item = MERCHANT_ITEMS.find(item => item.id === itemId);
                  if (item) {
                    const success = purchaseItem(item.id, item.cost, item.currency);
                    if (success) {
                      // Update local state for immediate UI feedback
                      setLocalPurchasedItems(prev => {
                        if (!prev.includes(item.id)) {
                          return [...prev, item.id];
                        }
                        return prev;
                      });
                    }
                  }
                }}
              />
            )}
          </>
        )}

        {/* Ability Tooltip - Show during weapon selection */}
        {gameMode === 'menu' && tooltipContent && (
          <AbilityTooltip 
            content={tooltipContent}
            visible={true}
            x={tooltipPosition.x}
            y={tooltipPosition.y}
          />
        )}

      </main>
    </MultiplayerProvider>
  );
}

export default function Home() {
  return (
    <MultiplayerProvider>
      <HomeContent />
    </MultiplayerProvider>
  );
}
