import React, { useState, useEffect, useCallback } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import { SkillPointSystem, SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { weaponAbilities, getAbilityIcon, type AbilityData as BaseAbilityData } from '@/utils/weaponAbilities';

interface AbilityData extends BaseAbilityData {
  currentCooldown: number;
  isActive?: boolean;
  isLocked?: boolean;
}

interface HotkeyPanelProps {
  currentWeapon: WeaponType;
  controlSystem?: any;
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null;
  onWeaponSwitch?: (slot: 1 | 2 | 3) => void;
  skillPointData?: SkillPointData;
  onUnlockAbility?: (unlock: AbilityUnlock) => void;
  purchasedItems?: string[];
}

interface WeaponData {
  name: string;
  type: WeaponType;
  key: '1' | '2' | '3';
  icon: string;
}

interface TooltipProps {
  content: {
    name: string;
    description: string;
  };
  visible: boolean;
  x: number;
  y: number;
}

function Tooltip({ content, visible, x, y }: TooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: x,
        top: y - 90,
        transform: 'translateX(-50%)'
      }}
    >
      <div 
        className="relative px-4 py-3 rounded-xl max-w-xs"
        style={{
          background: 'linear-gradient(180deg, rgba(20,20,35,0.98) 0%, rgba(10,10,20,0.99) 100%)',
          backdropFilter: 'blur(20px)',
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.1),
            0 10px 40px rgba(0,0,0,0.5),
            0 0 30px rgba(99,102,241,0.15)
          `,
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div className="font-bold text-sm mb-1" style={{ color: '#a5b4fc' }}>{content.name}</div>
        <div className="text-xs text-gray-300 leading-relaxed">{content.description}</div>
        
        {/* Tooltip arrow */}
        <div 
          className="absolute left-1/2 -bottom-2 w-4 h-4 -translate-x-1/2 rotate-45"
          style={{
            background: 'rgba(10,10,20,0.99)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            borderBottom: '1px solid rgba(255,255,255,0.08)'
          }}
        />
      </div>
    </div>
  );
}

/**
 * Circular cooldown progress indicator with number display
 */
const CooldownRing: React.FC<{
  size: number;
  percentage: number;
  cooldownTime?: number;
  isActive?: boolean;
  color?: string;
  showNumber?: boolean;
}> = ({ size, percentage, cooldownTime, isActive, color = '#ef4444', showNumber = true }) => {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * percentage) / 100;

  return (
    <>
      {/* Ring SVG */}
      <svg
        width={size}
        height={size}
        className="absolute pointer-events-none"
        style={{ 
          zIndex: 19,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translateX(-0px) rotate(-90deg)'
        }}
      >
        {/* Background ring (dark) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={strokeWidth + 1}
          fill="none"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isActive ? '#facc15' : color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.1s ease-out',
            filter: `drop-shadow(0 0 8px ${isActive ? '#facc15' : color})`
          }}
        />
      </svg>
      
      {/* Cooldown number overlay */}
      {showNumber && cooldownTime !== undefined && cooldownTime > 0 && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ 
            zIndex: 25,
            transform: 'translateX(-2px)'
          }}
        >
          <div
            className="flex items-center justify-center rounded-md px-1"
            style={{
              background: 'rgba(0,0,0,0.7)',
              minWidth: '24px'
            }}
          >
            <span 
              className="text-white font-bold"
              style={{ 
                fontSize: cooldownTime >= 10 ? '12px' : '14px',
                textShadow: `0 0 8px ${color}, 0 2px 4px rgba(0,0,0,0.8)`
              }}
            >
              {Math.ceil(cooldownTime)}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default function HotkeyPanel({ currentWeapon, controlSystem, selectedWeapons, onWeaponSwitch, skillPointData, onUnlockAbility, purchasedItems = [] }: HotkeyPanelProps) {
  const [tooltipContent, setTooltipContent] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [weaponSwitchCooldown, setWeaponSwitchCooldown] = useState<{ current: number; max: number }>({ current: 0, max: 5 });

  // Define selected weapons for switching
  const weapons: WeaponData[] = [];

  if (selectedWeapons) {
    const primaryWeapon = {
      name: selectedWeapons.primary === WeaponType.SWORD ? 'Sword' :
            selectedWeapons.primary === WeaponType.BOW ? 'Bow' :
            selectedWeapons.primary === WeaponType.SCYTHE ? 'Scythe' :
            selectedWeapons.primary === WeaponType.SABRES ? 'Sabres' :
            selectedWeapons.primary === WeaponType.RUNEBLADE ? 'Runeblade' : 'Unknown',
      type: selectedWeapons.primary,
      key: '1' as const,
      icon: selectedWeapons.primary === WeaponType.SWORD ? '💎' :
            selectedWeapons.primary === WeaponType.BOW ? '🏹' :
            selectedWeapons.primary === WeaponType.SCYTHE ? '🦋' :
            selectedWeapons.primary === WeaponType.SABRES ? '⚔️' :
            selectedWeapons.primary === WeaponType.RUNEBLADE ? '🔮' : '❓'
    };
    weapons.push(primaryWeapon);

    const secondaryWeapon = {
      name: selectedWeapons.secondary === WeaponType.SWORD ? 'Sword' :
            selectedWeapons.secondary === WeaponType.BOW ? 'Bow' :
            selectedWeapons.secondary === WeaponType.SCYTHE ? 'Scythe' :
            selectedWeapons.secondary === WeaponType.SABRES ? 'Sabres' :
            selectedWeapons.secondary === WeaponType.RUNEBLADE ? 'Runeblade' : 'Unknown',
      type: selectedWeapons.secondary,
      key: '2' as const,
      icon: selectedWeapons.secondary === WeaponType.SWORD ? '💎' :
            selectedWeapons.secondary === WeaponType.BOW ? '🏹' :
            selectedWeapons.secondary === WeaponType.SCYTHE ? '🦋' :
            selectedWeapons.secondary === WeaponType.SABRES ? '⚔️' :
            selectedWeapons.secondary === WeaponType.RUNEBLADE ? '🔮' : '❓'
    };
    weapons.push(secondaryWeapon);

    if (purchasedItems.length > 0) {
      const firstPurchasedItem = purchasedItems[0];
      let itemName = 'Unknown Item';
      let itemIcon = '🎁';

      if (firstPurchasedItem === 'damage_boost') {
        itemName = 'Damage Boost';
        itemIcon = '💪';
      } else if (firstPurchasedItem === 'ascendant_wings') {
        itemName = 'Ascendant Wings';
        itemIcon = '🕊️';
      }

      const purchasedItemSlot = {
        name: itemName,
        type: WeaponType.SWORD,
        key: '3' as const,
        icon: itemIcon,
        isPurchasedItem: true
      };
      weapons.push(purchasedItemSlot);
    } else if (selectedWeapons.tertiary) {
      const tertiaryWeapon = {
        name: selectedWeapons.tertiary === WeaponType.SWORD ? 'Sword' :
              selectedWeapons.tertiary === WeaponType.BOW ? 'Bow' :
              selectedWeapons.tertiary === WeaponType.SCYTHE ? 'Scythe' :
              selectedWeapons.tertiary === WeaponType.SABRES ? 'Sabres' :
              selectedWeapons.tertiary === WeaponType.RUNEBLADE ? 'Runeblade' : 'Unknown',
        type: selectedWeapons.tertiary,
        key: '3' as const,
        icon: selectedWeapons.tertiary === WeaponType.SWORD ? '💎' :
              selectedWeapons.tertiary === WeaponType.BOW ? '🏹' :
              selectedWeapons.tertiary === WeaponType.SCYTHE ? '🦋' :
              selectedWeapons.tertiary === WeaponType.SABRES ? '⚔️' :
              selectedWeapons.tertiary === WeaponType.RUNEBLADE ? '🔮' : '❓'
      };
      weapons.push(tertiaryWeapon);
    }
  }

  const createAbilitiesWithState = (baseAbilities: BaseAbilityData[]): AbilityData[] => {
    return baseAbilities.map(ability => ({
      ...ability,
      currentCooldown: 0
    }));
  };

  useEffect(() => {
    if (!controlSystem || !controlSystem.getAbilityCooldowns) return;

    const updateCooldowns = () => {
      const abilityCooldowns = controlSystem.getAbilityCooldowns();
      const newCooldowns: Record<string, number> = {};

      Object.keys(abilityCooldowns).forEach(key => {
        newCooldowns[key] = abilityCooldowns[key].current;
      });

      setCooldowns(newCooldowns);

      if (controlSystem.getWeaponSwitchCooldown) {
        setWeaponSwitchCooldown(controlSystem.getWeaponSwitchCooldown());
      }
    };

    const interval = setInterval(updateCooldowns, 100);
    updateCooldowns();

    return () => clearInterval(interval);
  }, [controlSystem, currentWeapon]);

  const handleAbilityHover = useCallback((e: React.MouseEvent, ability: AbilityData) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent({
      name: ability.name,
      description: ability.description
    });
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleWeaponHover = useCallback((e: React.MouseEvent, weapon: WeaponData) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent({
      name: weapon.name,
      description: `Switch to ${weapon.name} (${weapon.key})`
    });
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleAbilityLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  const isAbilityLocked = useCallback((ability: AbilityData): boolean => {
    if (!selectedWeapons || !skillPointData) return false;
    if (ability.key === 'Q') return false;

    let weaponSlot: 'primary' | 'secondary';
    let weaponType: WeaponType;

    if (currentWeapon === selectedWeapons.primary) {
      weaponSlot = 'primary';
      weaponType = selectedWeapons.primary;
    } else if (currentWeapon === selectedWeapons.secondary) {
      weaponSlot = 'secondary';
      weaponType = selectedWeapons.secondary;
    } else {
      return false;
    }

    if (ability.key === 'E' || ability.key === 'R' || ability.key === 'F' || ability.key === 'P') {
      return !SkillPointSystem.isAbilityUnlocked(skillPointData, weaponType, ability.key, weaponSlot);
    }

    return false;
  }, [currentWeapon, selectedWeapons, skillPointData]);

  const canUnlockAbility = useCallback((ability: AbilityData): boolean => {
    if (!selectedWeapons || !skillPointData || skillPointData.skillPoints <= 0) return false;
    if (!ability.isLocked) return false;

    const availableUnlocks = SkillPointSystem.getAvailableUnlocks(skillPointData, selectedWeapons);
    return availableUnlocks.some(unlock =>
      unlock.abilityKey === ability.key &&
      (
        (currentWeapon === selectedWeapons.primary && unlock.weaponSlot === 'primary') ||
        (currentWeapon === selectedWeapons.secondary && unlock.weaponSlot === 'secondary')
      )
    );
  }, [currentWeapon, selectedWeapons, skillPointData]);

  const handleAbilityUnlock = useCallback((ability: AbilityData) => {
    if (!selectedWeapons || !onUnlockAbility) return;

    let weaponSlot: 'primary' | 'secondary';
    let weaponType: WeaponType;

    if (currentWeapon === selectedWeapons.primary) {
      weaponSlot = 'primary';
      weaponType = selectedWeapons.primary;
    } else if (currentWeapon === selectedWeapons.secondary) {
      weaponSlot = 'secondary';
      weaponType = selectedWeapons.secondary;
    } else {
      return;
    }

    onUnlockAbility({
      weaponType,
      abilityKey: ability.key as 'R' | 'F' | 'P',
      weaponSlot
    });
  }, [currentWeapon, selectedWeapons, onUnlockAbility]);

  const currentAbilities = weaponAbilities[currentWeapon] ? createAbilitiesWithState(weaponAbilities[currentWeapon]) : [];
  
  const abilitiesWithLockStatus = currentAbilities.map(ability => ({
    ...ability,
    isLocked: isAbilityLocked(ability)
  }));

  if (currentAbilities.length === 0) {
    return null;
  }

  // Get slot styling based on state
  const getSlotStyle = (isActive: boolean, isLocked: boolean, canUnlock: boolean, isPurchased: boolean, isOnCooldown: boolean, isPassive: boolean) => {
    if (isPurchased) {
      return {
        background: 'linear-gradient(180deg, rgba(147,51,234,0.2) 0%, rgba(88,28,135,0.3) 100%)',
        borderColor: 'rgba(168,85,247,0.5)',
        glowColor: 'rgba(168,85,247,0.3)'
      };
    }
    if (isActive) {
      return {
        background: 'linear-gradient(180deg, rgba(250,204,21,0.15) 0%, rgba(161,98,7,0.25) 100%)',
        borderColor: 'rgba(250,204,21,0.6)',
        glowColor: 'rgba(250,204,21,0.4)'
      };
    }
    if (isLocked && !canUnlock) {
      return {
        background: 'linear-gradient(180deg, rgba(40,40,50,0.6) 0%, rgba(30,30,40,0.7) 100%)',
        borderColor: 'rgba(100,100,120,0.3)',
        glowColor: 'transparent'
      };
    }
    if (canUnlock) {
      return {
        background: 'linear-gradient(180deg, rgba(59,130,246,0.15) 0%, rgba(29,78,216,0.25) 100%)',
        borderColor: 'rgba(96,165,250,0.6)',
        glowColor: 'rgba(96,165,250,0.3)'
      };
    }
    if (isOnCooldown) {
      return {
        background: 'linear-gradient(180deg, rgba(239,68,68,0.1) 0%, rgba(127,29,29,0.2) 100%)',
        borderColor: 'rgba(239,68,68,0.4)',
        glowColor: 'rgba(239,68,68,0.2)'
      };
    }
    if (isPassive) {
      return {
        background: 'linear-gradient(180deg, rgba(147,51,234,0.15) 0%, rgba(88,28,135,0.25) 100%)',
        borderColor: 'rgba(168,85,247,0.5)',
        glowColor: 'rgba(168,85,247,0.2)'
      };
    }
    return {
      background: 'linear-gradient(180deg, rgba(34,197,94,0.1) 0%, rgba(21,128,61,0.2) 100%)',
      borderColor: 'rgba(34,197,94,0.4)',
      glowColor: 'rgba(34,197,94,0.15)'
    };
  };

  return (
    <>
      {/* CSS for animations */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 15px var(--glow-color); }
          50% { box-shadow: 0 0 25px var(--glow-color); }
        }
        @keyframes unlockPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes activeRing {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .hotkey-slot {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hotkey-slot:hover {
          transform: translateY(-2px);
        }
        .hotkey-slot:active {
          transform: translateY(0px) scale(0.98);
        }
      `}</style>

      <div 
        className="fixed bottom-6 left-1/2 z-40" 
        style={{ 
          transform: 'translateX(-50%) scale(0.8)',
          transformOrigin: 'center bottom'
        }}
      >
        <div 
          className="relative px-5 py-4 rounded-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,25,0.95) 0%, rgba(10,10,20,0.98) 100%)',
            backdropFilter: 'blur(20px)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.05),
              0 8px 32px rgba(0,0,0,0.4),
              0 0 60px rgba(99,102,241,0.08),
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          {/* Decorative top line */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[2px] rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)'
            }}
          />

          <div className="flex items-center gap-3">
            {/* Weapon Slots */}
            {weapons.map((weapon) => {
              const isCurrentWeapon = weapon.type === currentWeapon;
              const isOnCooldown = weaponSwitchCooldown.current > 0;
              const isPurchasedItem = (weapon as any).isPurchasedItem;
              const cooldownPercentage = weaponSwitchCooldown.max > 0 ? (weaponSwitchCooldown.current / weaponSwitchCooldown.max) * 100 : 0;
              const style = getSlotStyle(isCurrentWeapon && !isPurchasedItem, false, false, isPurchasedItem, isOnCooldown && !isCurrentWeapon, false);

              const handleWeaponClick = useCallback(() => {
                if (isPurchasedItem) return;
                if (!isOnCooldown && onWeaponSwitch) {
                  const slot = weapon.key === '1' ? 1 : weapon.key === '2' ? 2 : 3;
                  onWeaponSwitch(slot as 1 | 2 | 3);
                }
              }, [isOnCooldown, onWeaponSwitch, weapon.key, isPurchasedItem]);

              return (
                <div
                  key={weapon.key}
                  className={`hotkey-slot relative w-14 h-14 rounded-xl flex items-center justify-center ${isPurchasedItem ? 'cursor-default' : 'cursor-pointer'}`}
                  style={{
                    background: style.background,
                    border: `2px solid ${style.borderColor}`,
                    boxShadow: `0 0 20px ${style.glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`
                  }}
                  onClick={handleWeaponClick}
                  onMouseEnter={(e) => handleWeaponHover(e, weapon)}
                  onMouseLeave={handleAbilityLeave}
                >
                  {/* Hotkey badge */}
                  <div 
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: 'linear-gradient(180deg, rgba(30,30,45,0.95) 0%, rgba(20,20,30,0.98) 100%)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: isCurrentWeapon ? '#facc15' : '#9ca3af',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}
                  >
                    {weapon.key}
                  </div>

                  {/* Weapon icon */}
                  <span className="text-2xl relative z-10" style={{ filter: isOnCooldown && !isCurrentWeapon ? 'grayscale(50%) brightness(0.7)' : 'none' }}>
                    {weapon.icon}
                  </span>

                  {/* Cooldown overlay */}
                  {isOnCooldown && !isCurrentWeapon && (
                    <>
                      {/* Darkened background */}
                      <div 
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ background: 'rgba(0,0,0,0.5)', zIndex: 15 }}
                      />
                      {/* Ring with number */}
                      <CooldownRing 
                        size={56} 
                        percentage={100 - cooldownPercentage} 
                        cooldownTime={weaponSwitchCooldown.current}
                        color="#ef4444" 
                      />
                    </>
                  )}

                  {/* Active indicator glow */}
                  {isCurrentWeapon && !isPurchasedItem && (
                    <div 
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{
                        boxShadow: 'inset 0 0 15px rgba(250,204,21,0.3), 0 0 20px rgba(250,204,21,0.2)'
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* Separator */}
            <div 
              className="w-[2px] h-10 mx-1 rounded-full"
              style={{
                background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.2), transparent)'
              }}
            />

            {/* Ability Slots */}
            {abilitiesWithLockStatus.map((ability) => {
              const currentCooldown = cooldowns[ability.key] || 0;
              const cooldownPercentage = ability.cooldown > 0 ? (currentCooldown / ability.cooldown) * 100 : 0;
              const isOnCooldown = currentCooldown > 0;
              const isUnassigned = ability.name === 'Not Assigned';
              const isLocked = ability.isLocked;
              const canUnlock = canUnlockAbility(ability);
              const isPassive = ability.key === 'P';
              const style = getSlotStyle(false, isLocked!, canUnlock, false, isOnCooldown && !isUnassigned, isPassive);

              // Check for active ability states
              let isAbilityActive = false;
              if (controlSystem?.getAbilityCooldowns) {
                const abilityCooldowns = controlSystem.getAbilityCooldowns();
                const abilityData = abilityCooldowns[ability.key];
                if (abilityData?.isActive) isAbilityActive = true;
              }

              // Check for special charging/active states
              let chargeProgress = 0;
              let isCharging = false;
              let chargeColor = '#facc15';

              if (ability.key === 'R' && currentWeapon === WeaponType.BOW && controlSystem?.isViperStingChargingActive?.()) {
                isCharging = true;
                chargeProgress = controlSystem.getViperStingChargeProgress?.() || 0;
                chargeColor = '#a855f7';
              }
              if (ability.key === 'Q' && currentWeapon === WeaponType.BOW && controlSystem?.isBarrageChargingActive?.()) {
                isCharging = true;
                chargeProgress = controlSystem.getBarrageChargeProgress?.() || 0;
                chargeColor = '#f97316';
              }
              if (ability.key === 'E' && currentWeapon === WeaponType.BOW && controlSystem?.isCobraShotChargingActive?.()) {
                isCharging = true;
                chargeProgress = controlSystem.getCobraShotChargeProgress?.() || 0;
                chargeColor = '#22c55e';
              }

              const isSkyfallActive = ability.key === 'R' && currentWeapon === WeaponType.SABRES && controlSystem?.isSkyfallActive?.();
              const isStealthActive = ability.key === 'F' && currentWeapon === WeaponType.SABRES && controlSystem?.isStealthActive?.();
              const isCorruptedAuraActive = ability.key === 'F' && currentWeapon === WeaponType.RUNEBLADE && controlSystem?.isCorruptedAuraActive?.();

              return (
                <div
                  key={ability.key}
                  className={`hotkey-slot relative w-14 h-14 rounded-xl flex items-center justify-center ${
                    isLocked && !canUnlock ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                  style={{
                    background: isAbilityActive || isSkyfallActive || isStealthActive || isCorruptedAuraActive
                      ? 'linear-gradient(180deg, rgba(250,204,21,0.2) 0%, rgba(161,98,7,0.3) 100%)'
                      : style.background,
                    border: `2px solid ${isAbilityActive || isSkyfallActive || isStealthActive || isCorruptedAuraActive ? 'rgba(250,204,21,0.6)' : style.borderColor}`,
                    boxShadow: `0 0 20px ${isAbilityActive ? 'rgba(250,204,21,0.4)' : style.glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`
                  }}
                  onMouseEnter={(e) => handleAbilityHover(e, ability)}
                  onMouseLeave={handleAbilityLeave}
                  onClick={canUnlock ? () => handleAbilityUnlock(ability) : undefined}
                >
                  {/* Hotkey badge */}
                  <div 
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: 'linear-gradient(180deg, rgba(30,30,45,0.95) 0%, rgba(20,20,30,0.98) 100%)',
                      border: `1px solid ${canUnlock ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.15)'}`,
                      color: canUnlock ? '#60a5fa' : isPassive ? '#a855f7' : '#9ca3af',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      animation: canUnlock ? 'unlockPulse 1.5s ease-in-out infinite' : 'none'
                    }}
                  >
                    {ability.key}
                  </div>

                  {/* Ability icon */}
                  <div 
                    className="text-2xl relative z-10 flex items-center justify-center"
                    style={{ 
                      filter: isLocked && !canUnlock ? 'grayscale(100%) brightness(0.5)' : isOnCooldown ? 'brightness(0.7)' : 'none'
                    }}
                  >
                    {isLocked
                      ? canUnlock
                        ? <span className="text-xl" style={{ animation: 'unlockPulse 1.5s ease-in-out infinite' }}>➕</span>
                        : <span className="text-lg opacity-50">🔒</span>
                      : getAbilityIcon(currentWeapon, ability.key)
                    }
                  </div>

                  {/* Cooldown ring and overlay */}
                  {isOnCooldown && !isUnassigned && !isLocked && (
                    <>
                      {/* Darkened background */}
                      <div 
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ background: 'rgba(0,0,0,0.45)', zIndex: 15 }}
                      />
                      {/* Ring with number */}
                      <CooldownRing 
                        size={56} 
                        percentage={100 - cooldownPercentage} 
                        cooldownTime={currentCooldown}
                        color="#ef4444"
                      />
                    </>
                  )}

                  {/* Charging progress bar */}
                  {isCharging && (
                    <div className="absolute inset-0 rounded-xl overflow-hidden">
                      <div 
                        className="absolute bottom-0 left-0 right-0 transition-all duration-100"
                        style={{ 
                          height: `${chargeProgress * 100}%`,
                          background: `linear-gradient(180deg, ${chargeColor}40 0%, ${chargeColor}60 100%)`,
                          boxShadow: `inset 0 0 20px ${chargeColor}40`
                        }}
                      />
                      <div 
                        className="absolute inset-0 rounded-xl"
                        style={{
                          border: `2px solid ${chargeColor}`,
                          boxShadow: `0 0 15px ${chargeColor}50`
                        }}
                      />
                    </div>
                  )}

                  {/* Active ability glow effect */}
                  {(isAbilityActive || isSkyfallActive || isStealthActive || isCorruptedAuraActive) && (
                    <div 
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{
                        boxShadow: 'inset 0 0 20px rgba(250,204,21,0.4), 0 0 25px rgba(250,204,21,0.3)',
                        animation: 'activeRing 1s ease-in-out infinite'
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {tooltipContent && (
        <Tooltip 
          content={tooltipContent}
          visible={true}
          x={tooltipPosition.x}
          y={tooltipPosition.y}
        />
      )}
    </>
  );
}
