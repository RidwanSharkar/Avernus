function handlePlayerEvents(socket, gameRooms) {
  // Handle player position and rotation updates
  socket.on('player-update', (data) => {
    const { roomId, position, rotation, weapon, health, movementDirection } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const playerId = socket.id;
    const player = room.getPlayer(playerId);
    
    // Update player state
    if (position && rotation) {
      room.updatePlayerPosition(playerId, position, rotation, movementDirection);
    }
    
    if (weapon) {
      room.updatePlayerWeapon(playerId, weapon);
    }
    
    if (typeof health === 'number') {
      room.updatePlayerHealth(playerId, health);
    }
    
    // Broadcast updated position to other players in the room
    // Use authoritative server values for health and shield to prevent flickering
    socket.to(roomId).emit('player-moved', {
      playerId,
      position,
      rotation,
      weapon,
      health: player ? player.health : health,
      shield: player ? player.shield : undefined,
      maxHealth: player ? player.maxHealth : undefined,
      maxShield: player ? player.maxShield : undefined,
      movementDirection,
      timestamp: Date.now()
    });
  });

  // Handle weapon selection changes
  socket.on('weapon-changed', (data) => {
    const { roomId, weapon, subclass } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    room.updatePlayerWeapon(socket.id, weapon, subclass);
    
    // Broadcast weapon change to other players
    socket.to(roomId).emit('player-weapon-changed', {
      playerId: socket.id,
      weapon,
      subclass
    });
  });

  // Handle attack animations (visual only)
  socket.on('player-attack', (data) => {
    const { roomId, attackType, position, direction, animationData } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const player = room.getPlayer(socket.id);

    // Broadcast attack animation to other players with weapon info
    socket.to(roomId).emit('player-attacked', {
      playerId: socket.id,
      attackType,
      position,
      direction,
      weapon: player ? player.weapon : undefined,
      subclass: player ? player.subclass : undefined,
      animationData, // Include animation data (like projectile config with Cryoflame state)
      timestamp: Date.now()
    });
  });

  // Handle ability usage animations
  socket.on('player-ability', (data) => {
    const { roomId, abilityType, position, direction, target } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    // Broadcast ability usage to other players
    socket.to(roomId).emit('player-used-ability', {
      playerId: socket.id,
      abilityType,
      position,
      direction,
      target,
      timestamp: Date.now()
    });
  });

  // Handle player animation state updates (for backstab, charging, swinging, etc.)
  socket.on('player-animation-state', (data) => {
    const { roomId, animationState } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    
    // Broadcast animation state to other players in the room
    socket.to(roomId).emit('player-animation-state', {
      playerId: socket.id,
      animationState,
      timestamp: Date.now()
    });
  });

  // Handle visual effect synchronization (new)
  socket.on('player-effect', (data) => {
    const { roomId, effect } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    // Broadcast effect to other players in the room
    socket.to(roomId).emit('player-effect', {
      playerId: socket.id,
      effect,
      timestamp: Date.now()
    });
  });

  // Handle player debuff synchronization (freeze, slow, etc.)
  socket.on('player-debuff', (data) => {
    const { roomId, targetPlayerId, debuffType, duration, effectData } = data;

    if (!gameRooms.has(roomId)) {
      return;
    }

    // Broadcast debuff to all players in the room (including the target)
    const debuffData = {
      sourcePlayerId: socket.id,
      targetPlayerId,
      debuffType,
      duration,
      effectData,
      timestamp: Date.now()
    };

    // Send to all other clients in the room
    socket.to(roomId).emit('player-debuff', debuffData);
  });

  // Handle player stealth state changes
  socket.on('player-stealth', (data) => {
    const { roomId, playerId, isInvisible } = data;

    if (!gameRooms.has(roomId)) {
      return;
    }

    const room = gameRooms.get(roomId);

    // Broadcast stealth state to all other players in the room (including the sender for consistency)
    room.io.to(roomId).emit('player-stealth', {
      playerId: socket.id,
      isInvisible,
      timestamp: Date.now()
    });
  });

  socket.on('player-knockback', (data) => {
    const { roomId, playerId, targetPlayerId, direction, distance, duration } = data;

    if (!gameRooms.has(roomId)) {
      return;
    }

    const room = gameRooms.get(roomId);

    // Broadcast knockback to all other players in the room (including the sender for consistency)
    room.io.to(roomId).emit('player-knockback', {
      playerId: socket.id,
      targetPlayerId,
      direction,
      distance,
      duration,
      timestamp: Date.now()
    });
  });

  // Handle player tornado effect (WindShear ability)
  socket.on('player-tornado-effect', (data) => {
    const { roomId, playerId, position, duration } = data;

    if (!gameRooms.has(roomId)) {
      return;
    }

    const room = gameRooms.get(roomId);

    // Broadcast tornado effect to all other players in the room (including the sender for consistency)
    room.io.to(roomId).emit('player-tornado-effect', {
      playerId: socket.id,
      position,
      duration,
      timestamp: Date.now()
    });
  });

  // Handle player health changes
  socket.on('player-health-changed', (data) => {
    const { roomId, health, maxHealth } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (room.updatePlayerHealth(socket.id, health)) {
      // Broadcast health change to other players
      socket.to(roomId).emit('player-health-updated', {
        playerId: socket.id,
        health,
        maxHealth,
        timestamp: Date.now()
      });
    }
  });

  // Handle player shield changes
  socket.on('player-shield-changed', (data) => {
    const { roomId, shield, maxShield } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (room.updatePlayerShield(socket.id, shield, maxShield)) {
      // Broadcast shield change to other players
      socket.to(roomId).emit('player-shield-changed', {
        playerId: socket.id,
        shield,
        maxShield,
        timestamp: Date.now()
      });
    }
  });

  // Handle player level changes (for tertiary weapon unlocks)
  socket.on('player-level-changed', (data) => {
    const { roomId, playerId, level } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const player = room.getPlayer(playerId);

    if (player) {
      player.level = level;

      // Broadcast level change to all players in the room (including the sender for consistency)
      room.io.to(roomId).emit('player-level-changed', {
        playerId,
        level,
        timestamp: Date.now()
      });
    }
  });

  // Handle ally healing (Reanimate & Oathstrike)
  socket.on('heal-allies', (data) => {
    const { roomId, healAmount, abilityType, position } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    
    // Heal all players in the room
    room.players.forEach((player, playerId) => {
      const newHealth = Math.min(player.maxHealth, player.health + healAmount);
      room.updatePlayerHealth(playerId, newHealth);
    });

    // Broadcast healing event to all players in the room (including the healer)
    room.io.to(roomId).emit('ally-healed', {
      healerId: socket.id,
      healAmount,
      abilityType,
      position,
      timestamp: Date.now()
    });
  });

  // Handle player death
  socket.on('player-died', (data) => {
    const { roomId } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const player = room.getPlayer(socket.id);

    room.updatePlayerHealth(socket.id, 0);

    // Broadcast player death to other players
    socket.to(roomId).emit('player-died', {
      playerId: socket.id
    });
  });

  // Handle player respawn
  socket.on('player-respawned', (data) => {
    const { roomId, health, maxHealth, position } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const player = room.getPlayer(socket.id);
    const newHealth = health || maxHealth;
    
    room.updatePlayerHealth(socket.id, newHealth);
    
    if (position) {
      room.updatePlayerPosition(socket.id, position, { x: 0, y: 0, z: 0 });
    }

    // Broadcast player respawn to other players
    socket.to(roomId).emit('player-respawned', {
      playerId: socket.id,
      health: newHealth,
      maxHealth,
      position
    });
  });

  // Handle room preview request (get room info without joining)
  socket.on('preview-room', (data) => {
    const { roomId = 'default' } = data || {};
    
    if (!gameRooms.has(roomId)) {
      // Room doesn't exist yet
      socket.emit('room-preview', {
        roomId,
        exists: false,
        players: [],
        playerCount: 0,
        maxPlayers: 5,
        enemies: []
      });
      return;
    }
    
    const room = gameRooms.get(roomId);
    
    // Get room information without joining
    socket.emit('room-preview', {
      roomId,
      exists: true,
      players: room.getPlayers(),
      playerCount: room.getPlayerCount(),
      maxPlayers: 5,
      enemies: room.getEnemies()
    });
  });

  // Handle PVP damage between players
  socket.on('player-damage', (data) => {
    const { roomId, targetPlayerId, damage, damageType, isCritical } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const sourcePlayer = room.getPlayer(socket.id);
    const targetPlayer = room.getPlayer(targetPlayerId);
    
    if (!sourcePlayer || !targetPlayer) {
      return;
    }
    
    // Prevent damaging already dead players (health <= 0)
    if (targetPlayer.health <= 0) {
      return;
    }
    
    // Apply damage to target player, accounting for shields first
    const previousHealth = targetPlayer.health;
    const previousShield = targetPlayer.shield || 0;
    
    let remainingDamage = damage;
    let newShield = previousShield;
    let newHealth = previousHealth;

    if (previousShield > 0) {
      const shieldAbsorbed = Math.min(previousShield, remainingDamage);
      newShield -= shieldAbsorbed;
      remainingDamage -= shieldAbsorbed;
      targetPlayer.shield = newShield;
    }

    if (remainingDamage > 0) {
      newHealth = Math.max(0, previousHealth - remainingDamage);
      targetPlayer.health = newHealth;
    }
    
    // Simple kill detection: Player died if they had health > 0 before and health <= 0 after
    let wasActuallyKilled = previousHealth > 0 && targetPlayer.health <= 0;
    
    // Broadcast damage event to all players in the room
    room.io.to(roomId).emit('player-damaged', {
      sourcePlayerId: socket.id,
      targetPlayerId: targetPlayerId,
      damage: damage,
      damageType: damageType,
      isCritical: isCritical,
      newHealth: targetPlayer.health,
      maxHealth: targetPlayer.maxHealth,
      newShield: targetPlayer.shield,
      maxShield: targetPlayer.maxShield,
      wasKilled: wasActuallyKilled,
      timestamp: Date.now()
    });
    
    // If player was killed, broadcast kill event for scoreboard tracking
    // NOTE: Experience is now awarded by a separate death confirmation system
    if (wasActuallyKilled) {
      room.io.to(roomId).emit('player-kill', {
        killerId: socket.id,
        victimId: targetPlayerId,
        killerName: sourcePlayer.name,
        victimName: targetPlayer.name,
        timestamp: Date.now()
      });

      // Mark player as requiring death confirmation for experience award
      // The actual experience will be awarded when death is confirmed by the death system

      // Store kill data for death confirmation system
      room.setPendingKill({
        killerId: socket.id,
        victimId: targetPlayerId,
        killerName: sourcePlayer.name,
        victimName: targetPlayer.name,
        damageType: damageType,
        timestamp: Date.now()
      });
    }
    
    // NOTE: Removed redundant player-health-updated broadcast here
    // The health change is already communicated via player-damaged event with newHealth field
    // Having duplicate broadcasts caused race conditions and health bar flickering
    // Remote players receive health updates via player-damaged event handling
    // and periodic sync via player-update broadcasts
  });

  // Handle PVP healing effects
  socket.on('player-healing', (data) => {
    const { roomId, healingAmount, healingType, position } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const sourcePlayer = room.getPlayer(socket.id);
    
    if (!sourcePlayer) {
      return;
    }
    
    // Prevent healing dead players (health <= 0)
    if (sourcePlayer.health <= 0) {
      return;
    }
    
    // Apply healing to the source player (the one who cast the healing ability)
    const previousHealth = sourcePlayer.health;
    sourcePlayer.health = Math.min(sourcePlayer.maxHealth, sourcePlayer.health + healingAmount);
    
    const actualHealingAmount = sourcePlayer.health - previousHealth;

    // Only broadcast healing event if actual healing occurred
    if (actualHealingAmount > 0) {
      // Broadcast healing event to all players in the room (including source for confirmation)
      room.io.to(roomId).emit('player-healing', {
        sourcePlayerId: socket.id,
        healingAmount: actualHealingAmount,
        healingType: healingType,
        position: position,
        timestamp: Date.now()
      });
    }
  });

  // Handle summoned unit damage in PVP (server-authoritative)
  socket.on('summoned-unit-damage', (data) => {
    const { roomId, unitId, unitOwnerId, damage, sourcePlayerId } = data;

    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const sourcePlayer = room.getPlayer(socket.id);
    
    if (!sourcePlayer) {
      return;
    }

    // Validate that the source player is not trying to damage their own units
    // Use socket.id as the authoritative source since that's who sent the request
    if (socket.id === unitOwnerId) {
      return;
    }
    
    // Apply damage server-side (authoritative)
    const damageApplied = room.damageSummonedUnitDirect(unitId, damage, sourcePlayerId);
    
    if (damageApplied) {
      // Broadcast summoned unit damage to all players in the room
      room.io.to(roomId).emit('summoned-unit-damaged', {
        unitId: unitId,
        unitOwnerId: unitOwnerId,
        sourcePlayerId: sourcePlayerId,
        damage: damage,
        timestamp: Date.now()
      });
    }
  });

  // Handle ping/latency measurement
  socket.on('ping', () => {
    socket.emit('pong', Date.now());
  });

  // TEMPORARY: Test wave completion (for debugging experience system)
  socket.on('test-wave-completion', (data) => {
    const { roomId } = data;

    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    room.triggerTestWaveCompletion();
  });

  // Handle player respawn confirmation for experience award
  socket.on('player-respawn', (data) => {
    const { roomId, playerId } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const player = room.getPlayer(playerId || socket.id);
    
    if (!player) {
      return;
    }

    // Reset player health to max on respawn
    player.health = player.maxHealth;

    // Confirm death and award experience if there was a pending kill
    const confirmedKill = room.confirmPlayerDeath(playerId || socket.id);

    // Broadcast respawn to all players
    room.io.to(roomId).emit('player-respawned', {
      playerId: playerId || socket.id,
      playerName: player.name,
      health: player.health,
      maxHealth: player.maxHealth,
      timestamp: Date.now()
    });
  });

  // Handle player death effect broadcasting
  socket.on('player-death-effect', (data) => {
    const { roomId, playerId, position, isStarting, timestamp } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);

    // Broadcast death effect to other players in the room
    socket.to(roomId).emit('player-death-effect', {
      playerId,
      position,
      isStarting,
      timestamp
    });
  });

  // Handle player essence changes
  socket.on('player-essence-changed', (data) => {
    const { roomId, playerId, essence } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const player = room.getPlayer(playerId || socket.id);

    if (player) {
      // Add essence to current amount (initialize to 0 if undefined)
      const currentEssence = player.essence || 0;
      player.essence = currentEssence + essence;

      // Broadcast essence change to all players in the room (including the sender for consistency)
      room.io.to(roomId).emit('player-essence-changed', {
        playerId: playerId || socket.id,
        essence: player.essence,
        timestamp: Date.now()
      });
    }
  });

  socket.on('player-purchase', (data) => {
    const { roomId, playerId, itemId, cost, currency } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const player = room.getPlayer(playerId || socket.id);

    if (player) {
      // Initialize purchasedItems array if it doesn't exist
      if (!player.purchasedItems) {
        player.purchasedItems = [];
      }

      // Check if item is already purchased
      if (player.purchasedItems.includes(itemId)) {
        return; // Item already purchased
      }

      // Only handle essence currency
      if (currency !== 'essence') {
        return; // Invalid currency
      }

      // Check if player has enough essence
      if ((player.essence || 0) < cost) {
        return; // Not enough essence
      }

      // Deduct essence and add item
      player.essence = (player.essence || 0) - cost;
      player.purchasedItems.push(itemId);

      // Broadcast purchase to all players in the room
      room.io.to(roomId).emit('player-purchase', {
        playerId: playerId || socket.id,
        itemId,
        cost,
        currency,
        timestamp: Date.now()
      });

      // Also broadcast essence update
      room.io.to(roomId).emit('player-essence-changed', {
        playerId: playerId || socket.id,
        essence: player.essence,
        timestamp: Date.now()
      });
    }
  });
}

module.exports = { handlePlayerEvents };
