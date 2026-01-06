const { broadcastEnemySpawn } = require('./enemyHandler');
const EnemyAI = require('./enemyAI');

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.players = new Map();
    this.enemies = new Map();
    this.towers = new Map(); // PVP towers
    this.pillars = new Map(); // PVP pillars
    this.summonedUnits = new Map(); // Server-authoritative summoned units
    this.lastUpdate = Date.now();
    this.io = io; // Store io reference for broadcasting

    // Sky theme selection (randomly chosen when room is created)
    this.skyTheme = this.selectRandomSkyTheme();

    // Game state management
    this.gameStarted = false;
    this.killCount = 0; // Shared kill count for all players
    this.gameMode = 'multiplayer'; // Default to multiplayer mode
    
    // Status effect tracking for enemies
    this.enemyStatusEffects = new Map(); // enemyId -> { stun: expiration, freeze: expiration, slow: expiration }
    
    // Summoned unit management
    this.lastGlobalSpawnTime = 0; // Global spawn time for all towers (synchronized)
    this.spawnInterval = 45; // 45 seconds between spawns
    this.currentWaveId = null;
    this.waveUnits = new Set(); // Unit IDs in current wave (legacy for multiplayer)
    this.playerWaves = new Map(); // PVP mode: playerId -> { waveId, units: Set<unitId>, startTime }
    this.waveStartTime = 0;
    this.lastWaveCompletionTime = 0;
    this.lastWaveDebugTime = 0;
    this.lastUpdateSkipLog = 0;
    this.summonedUnitUpdateTimer = null;
    
    // Initialize enemy AI system but don't start it yet
    this.enemyAI = new EnemyAI(roomId, io);
    this.enemyAI.setRoom(this);
    
    // Timer references for cleanup
    this.skeletonTimer = null;
    this.mageTimer = null;
    this.abominationTimer = null;
    this.reaperTimer = null;
    this.deathKnightTimer = null;
    this.ascendantTimer = null;
    this.fallenTitanTimer = null;
    
    // PVP Death confirmation system
    this.pendingKills = new Map(); // victimId -> { killerId, killerName, victimName, damageType, timestamp }

    // Elite unit tracking for PVP - track destroyed pillars per player
    this.destroyedEnemyPillars = new Map(); // playerId -> number of their own pillars that have been destroyed
  }

  // Randomly select sky theme when room is created
  selectRandomSkyTheme() {
    const themes = ['purple', 'lightBlue', 'lightGreen', 'red'];
    return themes[Math.floor(Math.random() * themes.length)];
  }

  // Start the actual game
  startGame(initiatingPlayerId) {
    if (this.gameStarted) {
      return false;
    }
    
    this.gameStarted = true;
    
    // Only initialize enemies and AI for multiplayer mode, not PVP
    if (this.gameMode === 'multiplayer') {
      // Initialize with some basic enemies like the single-player version
      this.initializeEnemies();
      
      // Start enemy spawning timers
      this.startEnemySpawning();
      
      // Start enemy AI
      this.startEnemyAI();
      
    } else if (this.gameMode === 'pvp') {
      this.startSummonedUnitSystem();
    }
    
    // Broadcast game start to all players
    if (this.io) {
      this.io.to(this.roomId).emit('game-started', {
        roomId: this.roomId,
        initiatingPlayerId,
        killCount: this.killCount,
        timestamp: Date.now()
      });
    }
    
    return true;
  }

  // Player management
  addPlayer(playerId, playerName, weapon = 'scythe', subclass, gameMode = 'multiplayer') {
    // Set game mode for the room based on the first player who joins or the requested mode
    if (this.players.size === 0) {
      this.gameMode = gameMode;
    }

    // In PVP mode, players start with fixed health. In multiplayer, health scales with kill count
    const baseHealth = 200;
    const maxHealth = gameMode === 'pvp' ? baseHealth : baseHealth + this.killCount;

    // Create player object first
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      position: { x: 0, y: 1, z: 0 }, // Temporary position, will be updated for PVP
      rotation: { x: 0, y: 0, z: 0 }, // Temporary rotation, will be updated for PVP
      weapon: weapon,
      subclass: subclass,
      health: maxHealth, // Start with full health
      maxHealth: maxHealth,
      shield: 0, // Initialize shield
      maxShield: 250, // Default max shield
      level: 1, // Start at level 1
      essence: 50, // Start with 50 essence
      movementDirection: { x: 0, y: 0, z: 0 },
      joinedAt: Date.now()
    });

    // Calculate player position and rotation for PVP mode (after player is added)
    if (gameMode === 'pvp') {
      // Position players closer to their tower and facing the opposing tower
      const playerIndex = this.players.size - 1; // Current player index (0-based, after adding)
      const totalPlayers = 2; // Max players for positioning
      const mapRadius = 29;
      const baseRadius = mapRadius * 0.6; // Base radius for pillars (about 11.6 units from center)
      const towerOffset = 3; // Towers are positioned 3 units further out than pillars
      const playerSpawnDistance = baseRadius * 0.3; // Players spawn closer to their tower side (about 3.5 units from center)

      // Calculate angle for this player's position (same as tower positioning)
      const angleStep = (Math.PI * 2) / Math.max(totalPlayers, 2);
      const angle = playerIndex * angleStep;

      // Position player closer to their tower
      const spawnX = Math.sin(angle) * playerSpawnDistance;
      const spawnZ = Math.cos(angle) * playerSpawnDistance;

      const playerPosition = { x: spawnX, y: 1, z: spawnZ };

      // Calculate rotation to face the opposing tower
      // For 2 players: Player 1 faces Player 2 (angle π), Player 2 faces Player 1 (angle 0)
      const opposingAngle = (playerIndex + 1) % totalPlayers * angleStep;
      const rotationY = opposingAngle; // Y rotation in radians to face opposing tower

      const playerRotation = { x: 0, y: rotationY, z: 0 };

      // Update player object with correct position and rotation
      const player = this.players.get(playerId);
      if (player) {
        player.position = playerPosition;
        player.rotation = playerRotation;
      }
    }
    
    // Create tower and pillars for PVP mode
    if (gameMode === 'pvp') {
      this.createTowerForPlayer(playerId, playerName);
      this.createPillarsForPlayer(playerId, playerName);

      // Sync existing towers and pillars (from other players) to the newly joined player
      this.syncExistingTowersToPlayer(playerId);
      this.syncExistingPillarsToPlayer(playerId);
    }
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    
    // Remove player's tower and pillars in PVP mode
    if (this.gameMode === 'pvp') {
      this.removeTowerForPlayer(playerId);
      this.removePillarsForPlayer(playerId);
    }
    
    // Stop game if no players left
    if (this.players.size === 0 && this.gameStarted) {
      this.stopGame();
    }
  }

  // Stop the game
  stopGame() {
    this.gameStarted = false;
    this.stopEnemySpawning();
    this.stopEnemyAI();
    this.stopSummonedUnitSystem();
    
    // Clear all enemies
    this.enemies.clear();
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  getPlayerCount() {
    return this.players.size;
  }

  // Tower management for PVP mode
  createTowerForPlayer(playerId, playerName) {
    // Only allow 2 towers maximum, even if more players join
    const towerCount = Array.from(this.towers.values()).length;
    if (towerCount >= 2) {
      return;
    }

    const playerIndex = this.players.size - 1; // Current player index (0-based)
    const totalPlayers = 2; // Max players for positioning
    const mapRadius = 29;
    const baseRadius = mapRadius * 0.6; // Base radius for pillars (about 11.6 units from center)
    const towerOffset = 3; // Towers are positioned 3 units further out than pillars

    // Calculate angle for this player's position
    const angleStep = (Math.PI * 2) / Math.max(totalPlayers, 2);
    const angle = playerIndex * angleStep;

    // Calculate position - place towers in front of pillars
    const x = Math.sin(angle) * (baseRadius + towerOffset);
    const z = Math.cos(angle) * (baseRadius + towerOffset);
    const y = 0; // Ground level
    
    // Determine tower side based on Z position
    // Player 0: angle = 0, z = positive (South)
    // Player 1: angle = π, z = negative (North)
    const side = z >= 0 ? 'South' : 'North';
    
    const towerId = `tower_${playerId}`;
    const tower = {
      id: towerId,
      ownerId: playerId,
      ownerName: playerName,
      towerIndex: playerIndex,
      playerNumber: playerIndex + 1, // 1-based player number (1 or 2)
      position: { x, y, z },
      side: side, // Add side information
      health: 10000,
      maxHealth: 10000,
      isDead: false,
      isActive: true,
      createdAt: Date.now()
    };
    
    this.towers.set(towerId, tower);
    
    // Broadcast tower spawn to all players in the room
    if (this.io) {
      this.io.to(this.roomId).emit('tower-spawned', {
        roomId: this.roomId,
        tower: tower
      });
    }
    return tower;
  }

  removeTowerForPlayer(playerId) {
    const towerId = `tower_${playerId}`;
    const tower = this.towers.get(towerId);
    
    if (tower) {
      // Mark tower as destroyed
      tower.isDead = true;
      tower.health = 0;
      
      // Broadcast tower destruction
      if (this.io) {
        this.io.to(this.roomId).emit('tower-destroyed', {
          roomId: this.roomId,
          towerId: towerId,
          ownerId: playerId
        });
      }
      
      // Remove from map after a delay to allow clients to process
      setTimeout(() => {
        this.towers.delete(towerId);
      }, 1000);
    }
  }

  damageTower(towerId, damage, sourcePlayerId = null, damageType = null) {
    const tower = this.towers.get(towerId);
    if (!tower || tower.isDead) {
      return false;
    }
    
    const oldHealth = tower.health;
    tower.health = Math.max(0, tower.health - damage);
    const wasDestroyed = tower.health <= 0 && oldHealth > 0;
    
    if (wasDestroyed) {
      tower.isDead = true;
    }
    
    // Broadcast tower damage
    if (this.io) {
      this.io.to(this.roomId).emit('tower-damaged', {
        roomId: this.roomId,
        towerId: towerId,
        damage: damage,
        sourcePlayerId: sourcePlayerId,
        damageType: damageType,
        newHealth: tower.health,
        wasDestroyed: wasDestroyed
      });
      
      if (wasDestroyed) {
        this.io.to(this.roomId).emit('tower-destroyed', {
          roomId: this.roomId,
          towerId: towerId,
          ownerId: tower.ownerId
        });

        // Check for victory condition in PVP mode
        if (this.gameMode === 'pvp') {
          // Determine the winner based on which tower was destroyed
          // North tower = Red, South tower = Blue
          const winner = tower.side === 'North' ? 'Blue' : 'Red';

          // Emit victory event to all players
          this.io.to(this.roomId).emit('game-victory', {
            roomId: this.roomId,
            winner: winner,
            defeatedTowerSide: tower.side,
            defeatedPlayerId: tower.ownerId,
            timestamp: Date.now()
          });

          console.log(`🏆 PVP Victory: ${winner} wins! (Tower destroyed: ${tower.side})`);
        }
      }
    }
    return true;
  }

  getTowers() {
    return Array.from(this.towers.values());
  }

  getTower(towerId) {
    return this.towers.get(towerId);
  }

  createPillarsForPlayer(playerId, playerName) {
    // Get the tower position to position pillars relative to it
    const towerId = `tower_${playerId}`;
    const tower = this.towers.get(towerId);
    if (!tower) return;

    // Use the actual tower position that was already calculated
    const towerX = tower.position.x;
    const towerZ = tower.position.z;
    const towerY = tower.position.y;

    // Calculate direction from center to tower
    const centerToTowerX = towerX;
    const centerToTowerZ = towerZ;
    const length = Math.sqrt(centerToTowerX * centerToTowerX + centerToTowerZ * centerToTowerZ);
    const normalizedX = centerToTowerX / length;
    const normalizedZ = centerToTowerZ / length;

    // Calculate perpendicular vector for left/right positioning
    const perpX = -normalizedZ;
    const perpZ = normalizedX;

    // Position pillars 3 units behind tower (closer to center), spread out evenly
    const frontOffset = -6; // Negative to place behind tower
    const pillarSpacing = 8.5; // Spacing between pillars

    // Create 3 pillars: left, center, right
    const pillars = [];

    // Left pillar
    const leftPillarId = `pillar_${playerId}_0`;
    const leftPillar = {
      id: leftPillarId,
      ownerId: playerId,
      ownerName: playerName,
      pillarIndex: 0,
      position: {
        x: towerX + (normalizedX * frontOffset) + (perpX * -pillarSpacing),
        y: towerY + 0.275, // Raise pillar so base sits on ground (half of scaled base height)
        z: towerZ + (normalizedZ * frontOffset) + (perpZ * -pillarSpacing)
      },
      health: 5000,
      maxHealth: 5000,
      isDead: false,
      isActive: true,
      isCorrupted: false, // Whether pillar has corrupted aura effect
      corruptedStartTime: 0, // When corruption started
      createdAt: Date.now()
    };
    pillars.push(leftPillar);

    // Center pillar
    const centerPillarId = `pillar_${playerId}_1`;
    const centerPillar = {
      id: centerPillarId,
      ownerId: playerId,
      ownerName: playerName,
      pillarIndex: 1,
      position: {
        x: towerX + (normalizedX * frontOffset),
        y: towerY + 0.275, // Raise pillar so base sits on ground (half of scaled base height)
        z: towerZ + (normalizedZ * frontOffset)
      },
      health: 6000,
      maxHealth: 6000,
      isDead: false,
      isActive: true,
      isCorrupted: false, // Whether pillar has corrupted aura effect
      corruptedStartTime: 0, // When corruption started
      createdAt: Date.now()
    };
    pillars.push(centerPillar);

    // Right pillar
    const rightPillarId = `pillar_${playerId}_2`;
    const rightPillar = {
      id: rightPillarId,
      ownerId: playerId,
      ownerName: playerName,
      pillarIndex: 2,
      position: {
        x: towerX + (normalizedX * frontOffset) + (perpX * pillarSpacing),
        y: towerY + 0.275, // Raise pillar so base sits on ground (half of scaled base height)
        z: towerZ + (normalizedZ * frontOffset) + (perpZ * pillarSpacing)
      },
      health: 5000,
      maxHealth: 5000,
      isDead: false,
      isActive: true,
      isCorrupted: false, // Whether pillar has corrupted aura effect
      corruptedStartTime: 0, // When corruption started
      createdAt: Date.now()
    };
    pillars.push(rightPillar);

    // Store all pillars
    pillars.forEach(pillar => {
      this.pillars.set(pillar.id, pillar);
    });

    // Broadcast pillar spawn to all players in the room
    if (this.io) {
      pillars.forEach(pillar => {
        this.io.to(this.roomId).emit('pillar-spawned', {
          roomId: this.roomId,
          pillar: pillar
        });
      });
    }
  }

  removePillarsForPlayer(playerId) {
    // Find and remove all pillars for this player
    for (const [pillarId, pillar] of this.pillars) {
      if (pillar.ownerId === playerId) {
        pillar.isDead = true;
        pillar.health = 0;

        // Broadcast pillar destruction
        if (this.io) {
          this.io.to(this.roomId).emit('pillar-destroyed', {
            roomId: this.roomId,
            pillarId: pillarId,
            ownerId: playerId
          });
        }

        // Remove from map after a delay
        setTimeout(() => {
          this.pillars.delete(pillarId);
        }, 1000);
      }
    }
  }

  damagePillar(pillarId, damage, sourcePlayerId = null) {
    const pillar = this.pillars.get(pillarId);
    if (!pillar || pillar.isDead) {
      return false;
    }

    // Prevent players from damaging their own pillars
    if (sourcePlayerId === pillar.ownerId) {
      return false;
    }

    const oldHealth = pillar.health;
    pillar.health = Math.max(0, pillar.health - damage);
    const wasDestroyed = pillar.health <= 0 && oldHealth > 0;

    // Handle corruption state - activate when health drops below 50%
    const healthPercent = pillar.health / pillar.maxHealth;
    if (!pillar.isCorrupted && healthPercent < 0.5 && pillar.health > 0) {
      pillar.isCorrupted = true;
      pillar.corruptedStartTime = Date.now();
    } else if (pillar.isCorrupted && healthPercent >= 0.5) {
      // Remove corruption if health is restored above 50%
      pillar.isCorrupted = false;
      pillar.corruptedStartTime = 0;
    }

    if (wasDestroyed) {
      pillar.isDead = true;

      // Track destroyed enemy pillars for elite unit spawning (destroyer gets elite units)
      this.onEnemyPillarDestroyed(sourcePlayerId, pillar.ownerId);

      console.log(`💥 Pillar destroyed! ${sourcePlayerId} destroyed ${pillar.ownerId}'s pillar. ${pillar.ownerId} has lost ${this.destroyedEnemyPillars.get(pillar.ownerId) || 0} pillars. Opponent gets ${this.getEliteUnitCount(sourcePlayerId)} elite units`);
    }

    // Broadcast pillar damage
    if (this.io) {
      this.io.to(this.roomId).emit('pillar-damaged', {
        roomId: this.roomId,
        pillarId: pillarId,
        damage: damage,
        sourcePlayerId: sourcePlayerId,
        newHealth: pillar.health,
        isCorrupted: pillar.isCorrupted,
        corruptedStartTime: pillar.corruptedStartTime,
        wasDestroyed: wasDestroyed
      });

      if (wasDestroyed) {
        this.io.to(this.roomId).emit('pillar-destroyed', {
          roomId: this.roomId,
          pillarId: pillarId,
          ownerId: pillar.ownerId,
          destroyerId: sourcePlayerId
        });
      }
    }
    return true;
  }

  onEnemyPillarDestroyed(destroyerPlayerId, pillarOwnerId) {
    // Track destroyed pillars for each player (pillars they've lost to opponents)
    // Players get elite units when their opponent's pillars are destroyed
    const currentCount = this.destroyedEnemyPillars.get(pillarOwnerId) || 0;
    this.destroyedEnemyPillars.set(pillarOwnerId, currentCount + 1);
  }

  getEliteUnitCount(playerId) {
    // In 1v1 PVP, elite units are granted when the opponent's pillars are destroyed
    // Find the opponent (the other player in the room)
    const playerIds = Array.from(this.players.keys());
    const opponentId = playerIds.find(id => id !== playerId);

    if (!opponentId) {
      return 0; // No opponent found (shouldn't happen in 1v1)
    }

    // Return how many pillars the opponent has lost
    const opponentLostPillars = this.destroyedEnemyPillars.get(opponentId) || 0;
    return Math.min(opponentLostPillars, 3); // Max 3 elite units (one per opponent pillar destroyed)
  }

  getPillars() {
    return Array.from(this.pillars.values());
  }

  getPillar(pillarId) {
    return this.pillars.get(pillarId);
  }

  syncExistingTowersToPlayer(playerId) {
    // Send all existing towers to the newly joined player
    // Include all towers since the frontend needs to know about them all
    if (this.io) {
      for (const tower of this.towers.values()) {
        this.io.to(playerId).emit('tower-spawned', {
          roomId: this.roomId,
          tower: tower
        });
      }
    }
  }

  syncExistingPillarsToPlayer(playerId) {
    // Send all existing pillars to the newly joined player, including their own
    // The frontend will handle this appropriately
    if (this.io) {
      for (const pillar of this.pillars.values()) {
        this.io.to(playerId).emit('pillar-spawned', {
          roomId: this.roomId,
          pillar: pillar
        });
      }
    }
  }

  // ===== SUMMONED UNIT SYSTEM =====
  
  // Start the summoned unit system for PVP mode
  startSummonedUnitSystem() {
    if (this.gameMode !== 'pvp') {
      return;
    }
    
    // Start the update loop for summoned units (60 FPS)
    this.summonedUnitUpdateTimer = setInterval(() => {
      this.updateSummonedUnits();
    }, 1000 / 60); // 60 FPS
  }
  
  // Stop the summoned unit system
  stopSummonedUnitSystem() {
    if (this.summonedUnitUpdateTimer) {
      clearInterval(this.summonedUnitUpdateTimer);
      this.summonedUnitUpdateTimer = null;
    }
    
    // Clear all summoned units
    this.summonedUnits.clear();
    this.waveUnits.clear();
    this.destroyedEnemyPillars.clear(); // Clear enemy pillar destruction tracking
    this.lastGlobalSpawnTime = 0;
    this.currentWaveId = null;
  }
  
  // Main update loop for summoned units
  updateSummonedUnits() {
    if (!this.gameStarted || this.gameMode !== 'pvp') {
      // Debug logging every 30 seconds to see why updates are skipped
      if (Math.floor(Date.now() / 1000) % 30 === 0 && Math.floor(Date.now() / 1000) !== this.lastUpdateSkipLog) {
        this.lastUpdateSkipLog = Math.floor(Date.now() / 1000);
      }
      return;
    }
    
    const currentTime = Date.now() / 1000;
    const deltaTime = 1 / 60; // 60 FPS
    const unitsToDestroy = [];
    
    
    // Process existing units
    for (const [unitId, unit] of this.summonedUnits) {
      // Check if unit is expired
      if (this.isUnitExpired(unit, currentTime)) {
        this.removeUnitFromWave(unitId, unit.ownerId);
        unitsToDestroy.push(unitId);
        continue;
      }
      
      // Check if unit is dead
      if (unit.health <= 0 && !unit.isDead) {
        unit.isDead = true;
        unit.deathTime = currentTime;
        this.removeUnitFromWave(unitId, unit.ownerId);
        unitsToDestroy.push(unitId);
        continue;
      }
      
      // Check if unit is already dead (from damage) - add to cleanup
      if (unit.isDead || !unit.isActive) {
        this.removeUnitFromWave(unitId, unit.ownerId);
        unitsToDestroy.push(unitId);
        continue;
      }
      
      // Update unit behavior
      this.updateUnitBehavior(unit, currentTime, deltaTime);
    }
    
    // Check for wave completion
    this.checkWaveCompletion(currentTime);
    
    // Handle spawning new units
    this.handleUnitSpawning(currentTime);
    
    // Destroy expired units
    for (const unitId of unitsToDestroy) {
      this.destroySummonedUnit(unitId);
    }
    
    // Broadcast unit updates to all clients (throttled to 20 FPS for network efficiency)
    if (Math.floor(currentTime * 20) !== Math.floor((currentTime - deltaTime) * 20)) {
      this.broadcastSummonedUnitUpdates();
    }
  }
  
  // Update individual unit behavior (AI logic)
  updateUnitBehavior(unit, currentTime, deltaTime) {
    // Search for targets periodically
    if (this.canUnitSearchForTargets(unit, currentTime)) {
      this.findTargetForUnit(unit);
      unit.lastTargetSearchTime = currentTime;
    }
    
    // Move towards target position if no specific target
    if (!unit.currentTarget && unit.targetPosition) {
      this.moveUnitTowardsPosition(unit, deltaTime);
    }
    
    // Handle combat with current target
    if (unit.currentTarget && this.canUnitAttack(unit, currentTime)) {
      this.handleUnitAttack(unit, currentTime);
    }
  }
  
  // Find target for unit (same logic as client-side)
  findTargetForUnit(unit) {
    // Priority 1: Find enemy units to attack
    const enemyUnits = this.findEnemyUnitsForUnit(unit);
    if (enemyUnits.length > 0) {
      const closestUnit = this.findClosestUnitToPosition(enemyUnits, unit.position);
      if (closestUnit) {
        unit.currentTarget = closestUnit.unitId;
        return;
      }
    }
    
    // Priority 2: If no enemy units, target enemy tower
    const enemyTower = this.findEnemyTowerForUnit(unit);
    if (enemyTower) {
      unit.currentTarget = `tower_${enemyTower.ownerId}`;
      return;
    }
    
    // No targets found, clear target
    unit.currentTarget = null;
  }
  
  // Find enemy units for a given unit
  findEnemyUnitsForUnit(unit) {
    const enemyUnits = [];
    
    for (const [unitId, otherUnit] of this.summonedUnits) {
      if (otherUnit.ownerId !== unit.ownerId && 
          otherUnit.isActive && 
          !otherUnit.isDead && 
          otherUnit.health > 0) {
        enemyUnits.push(otherUnit);
      }
    }
    
    return enemyUnits;
  }
  
  // Find enemy tower for a given unit
  findEnemyTowerForUnit(unit) {
    for (const [towerId, tower] of this.towers) {
      if (tower.ownerId !== unit.ownerId && 
          !tower.isDead && 
          tower.health > 0) {
        return tower;
      }
    }
    return null;
  }
  
  // Find closest unit to a position
  findClosestUnitToPosition(units, position) {
    let closestUnit = null;
    let closestDistance = Infinity;
    
    for (const unit of units) {
      const distance = this.calculateDistance(position, unit.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestUnit = unit;
      }
    }
    
    return closestUnit;
  }
  
  // Move unit towards target position
  moveUnitTowardsPosition(unit, deltaTime) {
    if (!unit.targetPosition) return;
    
    const direction = {
      x: unit.targetPosition.x - unit.position.x,
      y: unit.targetPosition.y - unit.position.y,
      z: unit.targetPosition.z - unit.position.z
    };
    
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    
    // If close enough to target position, stop moving
    if (distance < 0.5) {
      unit.targetPosition = null;
      return;
    }
    
    // Normalize and move
    const normalizedDirection = {
      x: direction.x / distance,
      y: direction.y / distance,
      z: direction.z / distance
    };
    
    const moveDistance = unit.moveSpeed * deltaTime;
    
    if (moveDistance < distance) {
      // Move towards target
      unit.position.x += normalizedDirection.x * moveDistance;
      unit.position.y += normalizedDirection.y * moveDistance;
      unit.position.z += normalizedDirection.z * moveDistance;
    } else {
      // Arrived at target
      unit.position.x = unit.targetPosition.x;
      unit.position.y = unit.targetPosition.y;
      unit.position.z = unit.targetPosition.z;
      unit.targetPosition = null;
    }
  }
  
  // Handle unit attack
  handleUnitAttack(unit, currentTime) {
    if (!unit.currentTarget) return;
    
    let target = null;
    let targetPosition = null;
    
    // Check if target is a tower
    if (unit.currentTarget.startsWith('tower_')) {
      const towerId = unit.currentTarget;
      target = this.towers.get(towerId);
      if (target) {
        targetPosition = target.position;
      }
    } else {
      // Target is another summoned unit
      target = this.summonedUnits.get(unit.currentTarget);
      if (target) {
        targetPosition = target.position;
      }
    }
    
    if (!target || !targetPosition) {
      unit.currentTarget = null;
      return;
    }
    
    // Check if target is still in range
    const distance = this.calculateDistance(unit.position, targetPosition);
    if (distance > unit.attackRange) {
      unit.currentTarget = null;
      return;
    }
    
    // Check if target is still alive
    if (target.isDead || target.health <= 0) {
      unit.currentTarget = null;
      return;
    }
    
    // Perform attack
    if (unit.currentTarget.startsWith('tower_')) {
      // Attack tower
      this.damageTower(unit.currentTarget, unit.attackDamage);
    } else {
      // Attack summoned unit
      this.damageSummonedUnitDirect(unit.currentTarget, unit.attackDamage, unit.ownerId);
    }
    
    unit.lastAttackTime = currentTime;
  }
  
  // Manual wave completion trigger for testing (temporary)
  triggerTestWaveCompletion() {
    
    // Broadcast wave completion
    if (this.io) {
      this.io.to(this.roomId).emit('wave-completed', {
        waveId: `test_wave_${Date.now()}`,
        timestamp: Date.now()
      });
    }
  }

  // Helper method to remove unit from appropriate wave tracking
  removeUnitFromWave(unitId, unitOwnerId) {
    if (this.gameMode === 'pvp') {
      // PVP mode: Remove from player's wave
      const playerWave = this.playerWaves.get(unitOwnerId);
      if (playerWave) {
        const hadUnit = playerWave.units.has(unitId);
        playerWave.units.delete(unitId);
        
        // DEBUG: Check if this triggers wave completion
        if (playerWave.units.size === 0) {
        }
      } 
    } else {
      // Legacy multiplayer mode: Remove from global wave
      this.waveUnits.delete(unitId);
    }
  }

  // Check wave completion
  checkWaveCompletion(currentTime) {
    if (this.gameMode === 'pvp') {
      // PVP mode: Check each player's wave separately
      // DEBUG: Log current wave state every few seconds
      if (Math.floor(currentTime) % 5 === 0 && Math.floor(currentTime) !== this.lastWaveDebugTime) {
        this.lastWaveDebugTime = Math.floor(currentTime);
        for (const [playerId, playerWave] of this.playerWaves) {
        }
      }
      
      for (const [playerId, playerWave] of this.playerWaves) {
        if (playerWave.units.size === 0) {
          // This player's wave is complete - award experience to the OPPOSING player
          const opposingPlayerId = this.getOpposingPlayerId(playerId);
          
          if (opposingPlayerId) {
            
            // DEBUG: Log all players in the room
            
            // Broadcast wave completion and award EXP using the new event format
            if (this.io) {
              const waveCompletionData = {
                waveId: playerWave.waveId,
                defeatedPlayerId: playerId, // The player whose units were killed
                winnerPlayerId: opposingPlayerId, // The player who should get experience
                timestamp: Date.now()
              };
              
              this.io.to(this.roomId).emit('wave-completed', waveCompletionData);
              
              // Award +10 EXP to the winner for completing the wave
              this.io.to(this.roomId).emit('player-experience-gained', {
                playerId: opposingPlayerId,
                experienceGained: 10,
                source: 'pvp_wave_completion',
                defeatedPlayerId: playerId,
                waveId: playerWave.waveId,
                timestamp: Date.now()
              });
            }
          } else {
          }
          
          // Remove the completed wave
          this.playerWaves.delete(playerId);
        }
      }
    } else {
      // Legacy multiplayer mode: Use global wave tracking
      // Debug logging every 10 seconds to track wave state
      if (Math.floor(currentTime) % 10 === 0 && Math.floor(currentTime) !== this.lastWaveDebugTime) {
        this.lastWaveDebugTime = Math.floor(currentTime);
        
        if (this.waveUnits.size > 0) {
        }
      }
      
      // Check if current wave is complete (all units dead or expired)
      if (this.currentWaveId && this.waveUnits.size === 0) {
        // Ensure we don't spam the callback (minimum 30 seconds between wave completions)
        if (currentTime - this.lastWaveCompletionTime >= 30) {
          
          // Broadcast wave completion
          if (this.io) {
            this.io.to(this.roomId).emit('wave-completed', {
              waveId: this.currentWaveId,
              timestamp: Date.now()
            });
          }
          
          this.lastWaveCompletionTime = currentTime;
          this.currentWaveId = null;
        } else {
        }
      }
    }
  }

  // Helper method to get the opposing player ID in PVP
  getOpposingPlayerId(playerId) {
    for (const [otherPlayerId] of this.players) {
      if (otherPlayerId !== playerId) {
        return otherPlayerId;
      }
    }
    return null;
  }
  
  // Handle unit spawning
  handleUnitSpawning(currentTime) {
    // Check if we have at least 2 towers (both players joined)
    if (this.towers.size < 2) {
      // Don't start spawning until both players have joined
      return;
    }
    
    // Check if it's time for global spawn (synchronized for all towers)
    const timeSinceLastSpawn = currentTime - this.lastGlobalSpawnTime;
    
    // For the first spawn, start immediately when both players are present
    const shouldSpawn = this.lastGlobalSpawnTime === 0 || timeSinceLastSpawn >= this.spawnInterval;
    
    if (!shouldSpawn) {
      return;
    }
    
    
    // Spawn units for ALL active towers simultaneously
    let towersSpawned = 0;
    for (const [towerId, tower] of this.towers) {
      if (!tower.isActive || tower.isDead) {
        continue;
      }
      
      this.spawnUnitsForTower(tower, currentTime);
      towersSpawned++;
    }
    
    if (towersSpawned > 0) {
      // Update global spawn time only if we actually spawned units
      this.lastGlobalSpawnTime = currentTime;
    }
  }
  
  // Spawn units for a tower
  spawnUnitsForTower(tower, currentTime) {
    
    if (this.gameMode === 'pvp') {
      // PVP mode: Track waves per player
      const playerId = tower.ownerId;
      const waveId = `wave_${playerId}_${currentTime}`;
      
      // Initialize player wave if not exists
      if (!this.playerWaves.has(playerId)) {
        this.playerWaves.set(playerId, {
          waveId: waveId,
          units: new Set(),
          startTime: currentTime
        });
      }
      
      const playerWave = this.playerWaves.get(playerId);
      
      // Find the opposing tower position for targeting
      let opposingTowerPosition = this.findOpposingTowerPosition(tower.ownerId);
      
      // If no opposing tower found, use a default position in front of current tower
      if (!opposingTowerPosition) {
        opposingTowerPosition = {
          x: tower.position.x,
          y: tower.position.y,
          z: tower.position.z + 20
        };
      }
      
      // Spawn 3 units: some normal, some elite based on how many of the opponent's pillars have been destroyed
      const eliteCount = this.getEliteUnitCount(tower.ownerId);
      const normalCount = 3 - eliteCount;

      // Find opponent for logging
      const playerIds = Array.from(this.players.keys());
      const opponentId = playerIds.find(id => id !== tower.ownerId);

      console.log(`🎯 [${tower.ownerId}] Spawning units: ${normalCount} normal, ${eliteCount} elite (opponent lost pillars: ${this.destroyedEnemyPillars.get(opponentId) || 0})`);

      // Spawn normal units first
      for (let i = 0; i < normalCount; i++) {
        const unitId = this.spawnSummonedUnit(tower.ownerId, tower.position, opposingTowerPosition, i, currentTime, false);
        if (unitId) {
          playerWave.units.add(unitId);
        }
      }

      // Spawn elite units
      for (let i = 0; i < eliteCount; i++) {
        const unitId = this.spawnSummonedUnit(tower.ownerId, tower.position, opposingTowerPosition, normalCount + i, currentTime, true);
        if (unitId) {
          playerWave.units.add(unitId);
        }
      }
      
    } else {
      // Legacy multiplayer mode: Use global wave tracking
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
        opposingTowerPosition = {
          x: tower.position.x,
          y: tower.position.y,
          z: tower.position.z + 20
        };
      }
      
      // Spawn 3 units and track them in the wave
      for (let i = 0; i < 3; i++) {
        const unitId = this.spawnSummonedUnit(tower.ownerId, tower.position, opposingTowerPosition, i, currentTime);
        if (unitId) {
          this.waveUnits.add(unitId);
        } else {
        }
      }
    }
  }
  
  // Find opposing tower position
  findOpposingTowerPosition(ownerId) {
    for (const [towerId, tower] of this.towers) {
      if (tower.ownerId !== ownerId) {
        return tower.position;
      }
    }
    return null;
  }
  
  // Spawn a summoned unit
  spawnSummonedUnit(ownerId, spawnPosition, targetPosition, unitIndex, currentTime, isElite = false) {
    const unitId = `${ownerId}_unit_${currentTime}_${unitIndex}`;
    
    // Add offset to spawn position to avoid stacking
    const offset = {
      x: (unitIndex - 1) * 2, // Spread units left/right
      y: 0,
      z: 0
    };
    
    const actualSpawnPosition = {
      x: spawnPosition.x + offset.x,
      y: spawnPosition.y + offset.y,
      z: spawnPosition.z + offset.z
    };
    
    // Get player number from the tower
    const tower = Array.from(this.towers.values()).find(t => t.ownerId === ownerId);
    const playerNumber = tower ? tower.playerNumber : 1;

    const unit = {
      unitId: unitId,
      ownerId: ownerId,
      playerNumber: playerNumber, // Include player number for color determination
      position: actualSpawnPosition,
      targetPosition: targetPosition,
      health: isElite ? 1500 : 1000, // Elite units have 1.5x health
      maxHealth: isElite ? 1500 : 1000,
      attackRange: 4,
      attackDamage: isElite ? 120 : Math.floor(Math.random() * 41) + 40, // Elite units have fixed 120 damage (2x)
      attackCooldown: 2.0,
      lastAttackTime: 0,
      moveSpeed: 2.25,
      currentTarget: null,
      lastTargetSearchTime: 0,
      targetSearchCooldown: 0.5,
      isActive: true,
      isDead: false,
      isElite: isElite,
      deathTime: 0,
      summonTime: currentTime,
      lifetime: 120, // 2 minutes
      lastDamageTime: 0
    };
    
    this.summonedUnits.set(unitId, unit);
    
    
    return unitId;
  }
  
  // Damage a summoned unit directly (server-side)
  damageSummonedUnitDirect(unitId, damage, sourceOwnerId) {
    const unit = this.summonedUnits.get(unitId);
    if (!unit) {
      return false;
    }
    if (unit.isDead) {
      return false;
    }
    
    const previousHealth = unit.health;
    unit.health = Math.max(0, unit.health - damage);
    unit.lastDamageTime = Date.now() / 1000; // Record damage time for visual effects
    const wasKilled = previousHealth > 0 && unit.health <= 0;
    
    if (wasKilled) {
      unit.isDead = true;
      unit.isActive = false;
      unit.deathTime = Date.now() / 1000;
      
      // FIXED: Use proper wave removal method that handles both PVP and multiplayer modes
      this.removeUnitFromWave(unitId, unit.ownerId);

      // Broadcast summoned unit death to all players so they can play death sound
      if (this.io) {
        this.io.to(this.roomId).emit('summoned-unit-death', {
          unitId: unitId,
          unitOwnerId: unit.ownerId,
          sourcePlayerId: sourceOwnerId,
          timestamp: Date.now()
        });
      }

      if (this.gameMode === 'pvp') {
        const playerWave = this.playerWaves.get(unit.ownerId);
        const remainingUnits = playerWave ? playerWave.units.size : 0;
        
        // Award +5 EXP for killing blows on enemy summoned units in PVP mode
        if (sourceOwnerId && sourceOwnerId !== unit.ownerId && sourceOwnerId !== 'unknown') {
          
          // Broadcast summoned unit kill experience to the killer using the new event format
          if (this.io) {
            this.io.to(this.roomId).emit('player-experience-gained', {
              playerId: sourceOwnerId,
              experienceGained: 5,
              source: 'summoned_unit_kill',
              unitId: unitId,
              unitOwnerId: unit.ownerId,
              timestamp: Date.now()
            });
          }
        }
      } else {
      }
    }
    
    
    return true;
  }
  
  // Destroy a summoned unit
  destroySummonedUnit(unitId) {
    const unit = this.summonedUnits.get(unitId);
    if (unit) {
      this.summonedUnits.delete(unitId);
      this.waveUnits.delete(unitId);
    } 
  }
  
  // Broadcast summoned unit updates to all clients
  broadcastSummonedUnitUpdates() {
    const unitUpdates = [];
    
    // Only broadcast active, living units - dead units should be cleaned up by the main loop
    for (const [unitId, unit] of this.summonedUnits) {
      // Skip dead or inactive units - they should be cleaned up
      if (unit.isDead || !unit.isActive) {
        continue;
      }
      
      unitUpdates.push({
        unitId: unit.unitId,
        ownerId: unit.ownerId,
        playerNumber: unit.playerNumber,
        position: unit.position,
        health: unit.health,
        maxHealth: unit.maxHealth,
        isDead: unit.isDead,
        isActive: unit.isActive,
        isElite: unit.isElite,
        currentTarget: unit.currentTarget,
        targetPosition: unit.targetPosition,
        lastDamageTime: unit.lastDamageTime
      });
    }
    
    if (this.io && unitUpdates.length > 0) {
      this.io.to(this.roomId).emit('summoned-units-updated', {
        units: unitUpdates,
        timestamp: Date.now()
      });
    }
  }
  
  // Get summoned units
  getSummonedUnits() {
    return Array.from(this.summonedUnits.values());
  }
  
  // Utility functions
  isUnitExpired(unit, currentTime) {
    return unit.isDead || (currentTime - unit.summonTime) >= unit.lifetime;
  }
  
  canUnitSearchForTargets(unit, currentTime) {
    return (currentTime - unit.lastTargetSearchTime) >= unit.targetSearchCooldown;
  }
  
  canUnitAttack(unit, currentTime) {
    if (!unit.isActive || unit.isDead || !unit.currentTarget) {
      return false;
    }
    return (currentTime - unit.lastAttackTime) >= unit.attackCooldown;
  }
  
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  getKillCount() {
    return this.killCount;
  }

  getGameStarted() {
    return this.gameStarted;
  }

  updatePlayerPosition(playerId, position, rotation, movementDirection) {
    const player = this.players.get(playerId);
    if (player) {
      player.position = position;
      player.rotation = rotation;
      if (movementDirection) {
        player.movementDirection = movementDirection;
      }
      player.lastUpdate = Date.now();
    }
  }

  updatePlayerWeapon(playerId, weapon, subclass) {
    const player = this.players.get(playerId);
    if (player) {
      player.weapon = weapon;
      player.subclass = subclass;
    }
  }

  updatePlayerHealth(playerId, health) {
    const player = this.players.get(playerId);
    if (player) {
      // In PVP mode, health changes are server-authoritative for damage and healing.
      // Periodic syncs from clients can be stale and cause flickering if they
      // overwrite a more recent damage event with an older (higher) health value.
      if (this.gameMode === 'pvp' && health > player.health) {
        const diff = health - player.health;
        // Only allow small increases (regeneration, up to 15 HP) 
        // or significant jumps that look like a full respawn/heal
        const isRegen = diff < 15;
        const isRespawn = health >= player.maxHealth - 5;
        
        if (!isRegen && !isRespawn) {
          // Ignore potentially stale health increase
          return false;
        }
      }
      
      player.health = Math.max(0, Math.min(player.maxHealth, health));
      return true;
    }
    return false;
  }

  updatePlayerShield(playerId, shield, maxShield) {
    const player = this.players.get(playerId);
    if (player) {
      // Apply similar logic to shield updates in PVP to prevent flickering
      if (this.gameMode === 'pvp' && shield > (player.shield || 0)) {
        const diff = shield - (player.shield || 0);
        const isRegen = diff < 15;
        const isRespawn = shield >= (maxShield || player.maxShield || 250) - 5;
        
        if (!isRegen && !isRespawn) {
          return false;
        }
      }
      
      player.shield = Math.max(0, Math.min(maxShield || player.maxShield || 250, shield));
      if (maxShield !== undefined) {
        player.maxShield = maxShield;
      }
      return true;
    }
    return false;
  }

  // Enemy management
  initializeEnemies() {
    if (!this.gameStarted) return;
    
    // Don't initialize enemies in PVP mode
    if (this.gameMode === 'pvp') {
      return;
    }
    
    // Create initial enemies similar to single-player
    // Spawn 2 elite enemies to match the original local spawning
    this.spawnEnemy('elite');
    this.spawnEnemy('elite');
  }

  spawnEnemy(type) {
    if (!this.gameStarted) return null;
    
    // Don't spawn enemies in PVP mode
    if (this.gameMode === 'pvp') {
      return null;
    }
    
    const enemyId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate random spawn position (same logic as single-player)
    const position = this.generateRandomPosition();
    
    const maxHealth = this.getEnemyMaxHealth(type);
    const enemyData = {
      id: enemyId,
      type,
      position,
      initialPosition: { ...position },
      rotation: 0,
      health: maxHealth,
      maxHealth: maxHealth,
      spawnedAt: Date.now(),
      isDying: false
    };
    

    this.enemies.set(enemyId, enemyData);
    
    // Broadcast enemy spawn to all players in the room
    if (this.io) {
      broadcastEnemySpawn(this.io, this.roomId, enemyData);
    }
    
    return enemyData;
  }

  getEnemyMaxHealth(type) {
    // Use level-based health calculation like single player
    const currentLevel = this.getLevel(this.killCount);
    
    switch (type) {
      case 'elite':
        // Elite enemies have base health of 1000, multiplied by level (like single player EnemyFactory)
        // Base health is 1000, level 2 = 2000 HP
        return 1000 * currentLevel;
      case 'skeleton':
        switch (currentLevel) {
          case 1: return 725;
          case 2: return 1084;
          case 3: return 1241;
          case 4: return 1361;
          case 5: return 1424;
          default: return 925;
        }
      case 'mage':
        switch (currentLevel) {
          case 1: return 684;
          case 2: return 829;
          case 3: return 925;
          case 4: return 1029;
          case 5: return 1141;
          default: return 684;
        }
      case 'reaper':
        switch (currentLevel) {
          case 2: return 1084;
          case 3: return 1241;
          case 4: return 1361;
          case 5: return 1424;
          default: return 1084;
        }
      case 'abomination':
        switch (currentLevel) {
          case 3: return 2304;
          case 4: return 2500;
          case 5: return 2704;
          default: return 2304;
        }
      case 'ascendant':
        switch (currentLevel) {
          case 4: return 2081;
          case 5: return 2249;
          default: return 2081;
        }
      case 'death-knight':
        switch (currentLevel) {
          case 3: return 1681;
          case 4: return 1849;
          case 5: return 2081;
          default: return 1681;
        }
      case 'fallen-titan':
        return 9704; // Fixed health for fallen titans
      default:
        return 9704; // Fallback health
    }
  }

  generateRandomPosition() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 5 + Math.random() * 15; // Spawn 15-40 units away
    return {
      x: Math.cos(angle) * distance,
      y: 0,
      z: Math.sin(angle) * distance
    };
  }

  damageEnemy(enemyId, damage, fromPlayerId) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying) {
      return null;
    }

    const previousHealth = enemy.health;
    enemy.health = Math.max(0, enemy.health - damage);
    
    const result = {
      enemyId,
      newHealth: enemy.health,
      maxHealth: enemy.maxHealth,
      damage,
      fromPlayerId,
      wasKilled: previousHealth > 0 && enemy.health <= 0
    };

    if (result.wasKilled) {
      enemy.isDying = true;
      enemy.deathTime = Date.now();
      
      // Increment shared kill count
      this.killCount++;
      
      // Award +10 EXP for enemy kills to the killer in PVP/multiplayer mode
      if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
        
        // Broadcast enemy kill experience to the killer using the new event format
        this.io.to(this.roomId).emit('player-experience-gained', {
          playerId: fromPlayerId,
          experienceGained: 10,
          source: 'enemy_kill',
          enemyId: enemyId,
          timestamp: Date.now()
        });
      }
      
      // Update all players' max health and heal them by 1
      this.players.forEach((player, playerId) => {
        const newMaxHealth = 200 + this.killCount;
        const newHealth = Math.min(newMaxHealth, player.health + 1);
        player.maxHealth = newMaxHealth;
        player.health = newHealth;
      });
      
      // Broadcast kill count update to all players
      if (this.io) {
        this.io.to(this.roomId).emit('kill-count-updated', {
          killCount: this.killCount,
          killedBy: fromPlayerId,
          enemyType: enemy.type,
          timestamp: Date.now()
        });
        
        // Also broadcast player health updates
        this.players.forEach((player, playerId) => {
          this.io.to(this.roomId).emit('player-health-updated', {
            playerId: playerId,
            health: player.health,
            maxHealth: player.maxHealth
          });
        });
      }
      
      // Clean up aggro when enemy dies
      if (this.enemyAI) {
        this.enemyAI.removeEnemyAggro(enemyId);
      }
      
      // Schedule enemy removal after death animation
      setTimeout(() => {
        this.enemies.delete(enemyId);
      }, 1500); // Match death animation duration
    }

    return result;
  }

  getEnemies() {
    return Array.from(this.enemies.values());
  }

  getEnemy(enemyId) {
    return this.enemies.get(enemyId);
  }

  // Function to calculate level based on kill count (same as Scene.tsx)
  getLevel(kills) {
    if (kills < 10) return 1;    
    if (kills < 25) return 2;     
    if (kills < 45) return 3;    
    if (kills < 70) return 4;   
    return 5;                      // Level 5: 70+ kills
  }

  // Enemy spawning system with level restrictions
  startEnemySpawning() {
    if (!this.gameStarted) return;
    
    // Don't start enemy spawning in PVP mode
    if (this.gameMode === 'pvp') {
      return;
    }
    
    const MAX_ENEMIES = 5; // Match single player cap

    // Timer for regular skeletons: 2 every 13.5 seconds (matches Scene.tsx timing)
    this.skeletonTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Regular skeletons only spawn at levels 1-5 (no upper limit like single player had)
      
      const currentEnemyCount = this.enemies.size;
      if (currentEnemyCount >= MAX_ENEMIES) return;

      // Spawn up to 2 skeletons or fill remaining slots
      const spawnCount = Math.min(2, MAX_ENEMIES - currentEnemyCount);
      for (let i = 0; i < spawnCount; i++) {
        this.spawnEnemy('skeleton');
      }
    }, 13500); // Match Scene.tsx timing

    // Timer for skeletal mages: 1 every 20.5 seconds (matches Scene.tsx timing)
    this.mageTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Skeletal mages spawn at all levels (1-5)
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      // Check if there are already 2 skeletal mages on the map (maximum allowed)
      const existingMages = Array.from(this.enemies.values()).filter(enemy => enemy.type === 'mage' && !enemy.isDying);
      if (existingMages.length >= 2) return; // Don't spawn if 2 already exist
      
      this.spawnEnemy('mage');
    }, 20500); // Match Scene.tsx timing

    // Timer for abominations: 1 every 45 seconds (matches Scene.tsx timing)
    this.abominationTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Abominations only spawn at levels 3-5
      if (currentLevel < 3) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      this.spawnEnemy('abomination');
    }, 45000); // Match Scene.tsx timing

    // Timer for reapers: 1 every 22.5 seconds (matches Scene.tsx timing)
    this.reaperTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Reapers only spawn at levels 2-5
      if (currentLevel < 2) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      this.spawnEnemy('reaper');
    }, 22500); // Match Scene.tsx timing

    // Timer for death knights: 1 every 17.5 seconds (matches Scene.tsx timing)
    this.deathKnightTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Death Knights only spawn at levels 3-5
      if (currentLevel < 3) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      this.spawnEnemy('death-knight');
    }, 17500); // Match Scene.tsx timing

    // Timer for ascendants: 1 every 35 seconds (matches Scene.tsx timing)
    this.ascendantTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Ascendants only spawn at levels 4-5
      if (currentLevel < 4) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      this.spawnEnemy('ascendant');
    }, 35000); // Match Scene.tsx timing

    // Timer for fallen titans: 1 every 60 seconds (matches Scene.tsx timing)
    this.fallenTitanTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Fallen Titans only spawn at level 5
      if (currentLevel < 5) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      // Check if there's already a Fallen Titan on the map (only one allowed)
      const existingFallenTitan = Array.from(this.enemies.values()).find(enemy => enemy.type === 'fallen-titan' && !enemy.isDying);
      if (existingFallenTitan) return; // Don't spawn if one already exists
      
      this.spawnEnemy('fallen-titan');
    }, 60000); // Match Scene.tsx timing
    
  }

  // Stop enemy spawning
  stopEnemySpawning() {
    if (this.skeletonTimer) {
      clearInterval(this.skeletonTimer);
      this.skeletonTimer = null;
    }
    if (this.mageTimer) {
      clearInterval(this.mageTimer);
      this.mageTimer = null;
    }
    if (this.abominationTimer) {
      clearInterval(this.abominationTimer);
      this.abominationTimer = null;
    }
    if (this.reaperTimer) {
      clearInterval(this.reaperTimer);
      this.reaperTimer = null;
    }
    if (this.deathKnightTimer) {
      clearInterval(this.deathKnightTimer);
      this.deathKnightTimer = null;
    }
    if (this.ascendantTimer) {
      clearInterval(this.ascendantTimer);
      this.ascendantTimer = null;
    }
    if (this.fallenTitanTimer) {
      clearInterval(this.fallenTitanTimer);
      this.fallenTitanTimer = null;
    }
  }

  // Start enemy AI system
  startEnemyAI() {
    if (this.gameStarted && this.players.size > 0) {
      // Don't start enemy AI in PVP mode
      if (this.gameMode === 'pvp') {
        return;
      }
      
      this.enemyAI.startAI();
    }
  }

  // Stop enemy AI system
  stopEnemyAI() {
    this.enemyAI.stopAI();
  }

  // Status effect management methods
  applyStatusEffect(enemyId, effectType, duration) {
    if (!this.enemies.has(enemyId)) return false;
    
    if (!this.enemyStatusEffects.has(enemyId)) {
      this.enemyStatusEffects.set(enemyId, {});
    }
    
    const effects = this.enemyStatusEffects.get(enemyId);
    effects[effectType] = Date.now() + duration;
    
    // Broadcast status effect to all players
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-status-effect', {
        enemyId,
        effectType,
        duration,
        timestamp: Date.now()
      });
    }
    
    return true;
  }

  isEnemyAffectedBy(enemyId, effectType) {
    const effects = this.enemyStatusEffects.get(enemyId);
    if (!effects || !effects[effectType]) return false;
    
    const now = Date.now();
    if (now > effects[effectType]) {
      // Effect expired, clean it up
      delete effects[effectType];
      return false;
    }
    
    return true;
  }

  getEnemyStatusEffects(enemyId) {
    const effects = this.enemyStatusEffects.get(enemyId);
    if (!effects) return {};
    
    const now = Date.now();
    const activeEffects = {};
    
    // Check each effect and remove expired ones
    Object.keys(effects).forEach(effectType => {
      if (now <= effects[effectType]) {
        activeEffects[effectType] = effects[effectType] - now; // Remaining duration
      } else {
        delete effects[effectType]; // Clean up expired effect
      }
    });
    
    return activeEffects;
  }

  // Cleanup when room is destroyed
  destroy() {
    this.stopEnemySpawning();
    this.stopEnemyAI();
    this.stopSummonedUnitSystem();
    
    this.players.clear();
    this.enemies.clear();
    this.towers.clear();
    this.summonedUnits.clear();
    this.enemyStatusEffects.clear();
    this.lastGlobalSpawnTime = 0;
    this.gameStarted = false;
    this.killCount = 0;
  }

  // Get room summary for debugging
  getSummary() {
    return {
      roomId: this.roomId,
      playerCount: this.players.size,
      enemyCount: this.enemies.size,
      gameStarted: this.gameStarted,
      killCount: this.killCount,
      lastUpdate: this.lastUpdate
    };
  }

  // PVP Death Confirmation System Methods

  setPendingKill(killData) {
    const { victimId, killerId, killerName, victimName, damageType, timestamp } = killData;
    
    // Store pending kill for death confirmation
    this.pendingKills.set(victimId, {
      killerId,
      killerName,
      victimName,
      damageType,
      timestamp
    });
    
    
    // Clean up old pending kills (older than 10 seconds)
    this.cleanupOldPendingKills();
  }

  confirmPlayerDeath(victimId) {
    const pendingKill = this.pendingKills.get(victimId);
    
    if (!pendingKill) {
      return null;
    }
    
    // Award experience to the killer
    const { killerId, killerName, victimName, damageType, timestamp } = pendingKill;
    
    
    // Broadcast experience award
    this.io.to(this.roomId).emit('player-experience-gained', {
      playerId: killerId,
      experienceGained: 10,
      source: 'pvp_player_kill',
      killerName: killerName,
      victimName: victimName,
      damageType: damageType,
      timestamp: Date.now()
    });
    
    // Remove the pending kill
    this.pendingKills.delete(victimId);
    
    return pendingKill;
  }

  cleanupOldPendingKills() {
    const now = Date.now();
    const maxAge = 10000; // 10 seconds
    
    for (const [victimId, killData] of this.pendingKills.entries()) {
      if (now - killData.timestamp > maxAge) {
        this.pendingKills.delete(victimId);
      }
    }
  }

  getPendingKill(victimId) {
    return this.pendingKills.get(victimId);
  }

  clearPendingKill(victimId) {
    const existed = this.pendingKills.delete(victimId);
    if (existed) {
    }
    return existed;
  }
}

module.exports = GameRoom;
