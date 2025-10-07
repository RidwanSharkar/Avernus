# 🎮 AVERNUS - Multiplayer PVP Game

A fast-paced, competitive 1v1 multiplayer 3D action game featuring real-time combat, strategic weapon switching, and deep progression systems. Built with modern web technologies for smooth, scalable gameplay.


## 🌟 Key Features  

### ⚡ Technical Specs
- **Real-time Multiplayer**: Socket.io-powered networking with sub-60ms latency
- **ECS Architecture**: Entity-Component-System for optimal performance and modularity
- **Advanced 3D Rendering**: Three.js with WebGL, LOD management, and instanced rendering
- **Spatial Audio**: Howler.js-powered 3D positional audio with 30+ unique sound effects
- **Performance Optimizations**: Object pooling, state batching, and performance monitoring
- **Scalable Backend**: Node.js server with automatic scaling and health monitoring

### 🎯 Gameplay Systems
- **5 Unique Weapon Classes**: Each with distinct playstyles and 4-5 unlockable abilities
- **Dynamic Progression**: Level up to 5, unlock abilities, and master multiple weapon combinations
- **Real-time Combat**: Precise hit detection, damage numbers, and visual feedback
- **Strategic Depth**: Resource management, cooldowns, and ability combos
- **Competitive Balance**: Health scaling, experience rewards, and skill-based matchmaking

## 🎮 How to Play

### Quick Start
1. **Choose Your Weapons**: Select primary and secondary weapons from 5 classes
2. **Level Up**: Gain experience by dealing damage and eliminating enemies/players
3. **Unlock Abilities**: Spend skill points on powerful abilities (Q, E, R, F keys)
4. **Master Combat**: Switch weapons mid-fight and combine abilities for devastating combos

### Game Modes
- **Multiplayer**: Co-op against AI enemies with up to 4 players
- **PVP**: 1v1-4v4 competitive matches with player-vs-player combat
- **Single Player**: Practice mode with endless waves of enemies

## ⚔️ Weapon Classes & Abilities

### 💎 Greatsword - IMMORTAL
**Playstyle**: Balanced melee fighter with charge attacks and defensive capabilities
- **🛡️ Q - Fullguard** (7s): Creates a protective barrier that blocks all incoming damage for 3 seconds. Cannot attack while shielded.
- **🔱 E - Charge** (8s): Dash forward, instantly generating 25 rage and damaging enemies in your path.
- **⚡️ R - Colossus Strike** (5s): {25+ RAGE} Consumes all rage to execute an enemy player, calling down a lightning bolt that deals increasing damage based on the amount of rage consumed.
- **🌪 F - Divine Wind** (1.5s): {10 RAGE} Charges a gust of wind that launches your sword forward, dealing 120 piercing damage to enemies hit. Hitting an enemy player reduces the cooldown of Charge by 4 seconds.
- **⚜️ P - Titan's Breath** (Passive): Increases maximum health by 350 and health regeneration to 30 HP per second outside of combat.
  
![greatsword](https://github.com/user-attachments/assets/9a4f5757-b28d-492c-80f0-d9abe4a25d6b)

### 🏹 Bow - VIPER
**Playstyle**: Ranged damage dealer with burst potential and area control
- **🎯 Q - Frost Bite** (5s): {50 ENERGY} Fires 5 arrows in an arc, dealing 30 damage per arrow and applying a 50% SLOW effect for 5 seconds. An enemy can be hit by multiple arrows at close range.
- **🐍 E - Cobra Shot** (2s): {60 ENERGY} Fires a laced arrow that applies VENOM damage over time to the target, preventing shield regeneration for 6 seconds.
- **🐉 R - Viper Sting** (2s): {60 ENERGY} Fires a powerful piercing arrow that returns to you after a short delay. Each hit on an enemy creates a soul fragment that heals you for 20 HP each when returned.
- **🪶 F - Cloudkill** (4s): {40 ENERGY} Launches an artillery barrage of arrows from the sky that rain down on enemy locations.
- **🍃 P - Tempest Rounds** (Passive): Replaces primary attack with a 3-round burst attack. Each arrow deals 30 damage.

![bow](https://github.com/user-attachments/assets/b5a67b0f-b4ea-457d-9e27-bb6b7f5e4c67)

![bow1](https://github.com/user-attachments/assets/453f112c-a136-4676-82e9-cb8b53df1593)

![bow2](https://github.com/user-attachments/assets/9c6bcc77-add9-4b9f-a4ae-ee1d1a494f10)


### ⚔️ Sabres - ASSASSIN
**Playstyle**: Stealth-based fighter with mobility and high-risk, high-reward damage
- **🔪 Q - Backstab** (2s): {60 ENERGY} Strikes the target with both sabres, dealing 75 damage or 175 damage if attacking the target from behind. Refund 45 energy if the target is stunned.
- **💥 E - Flourish** (1.5s): {35 ENERGY} Unleash a flurry of slashes that deals increased damage with successive hits on the same target, stacking up to 3 times. Expending 3 stacks applies STUN for 4 seconds.
- **🐦‍🔥 R - Divebomb** (6s): {40 ENERGY} Leap into the air and crash down, dealing 125 damage and applying STUN for 2 seconds to enemies caught below.
- **🌒 F - Shadow Step** (10s): Fade into the shadows, becoming INVISIBLE for 5 seconds.
- **☠️ P - Cutthroat Oath** (Passive): Permanently increases critical strike chance by 30%.

![sabres](https://github.com/user-attachments/assets/49f06421-7842-45f4-9ed0-01e5eac790f6)



### 🦋 Scythe - WEAVER
**Playstyle**: Mana-based mage with crowd control and burst damage
- **🔆 Q - Sunwell** (1s): {30 MANA} Transmutes mana to heal you for 60 HP.
- **❄️ E - Coldsnap** (12s): {50 MANA} Conjures an explosive ice vortex that applies FREEZE to enemies, immobilizing them for 6 seconds.
- **🔥 R - Crossentropy** (2s): {40 MANA} Charges for 1 second to fire an accelerating plasma bolt that deals 10 additional damage per stack of BURNING.
- **🪬 F - Mantra** (5s): {75 MANA} Summons a totem that heals you for 20 HP per second while blasting nearby enemies that enter its range. Lasts 8 seconds.
- **💠 P - Cryoflame** (Passive): Modifies primary attack to deal increased damage but no longer apply BURNING. Cryoflame Bolts deal double damage to enemies afflicted by FREEZE.

![scythe](https://github.com/user-attachments/assets/ec0ff71c-5e34-459d-a959-9fe2197ecb96)

![scythe1](https://github.com/user-attachments/assets/6eccc6a5-489d-4370-8293-574825a7c917)

![scythe2](https://github.com/user-attachments/assets/87ed8a70-e972-4fee-b87d-399e22643e47)


### 🔮 Runeblade - TEMPLAR
**Playstyle**: Dark magic user with life-stealing and debuff abilities
- **⛓️ Q - Void Grasp** (5s): {35 MANA} Fires grasping chains that latch onto the first enemy hit, pulling them towards you.
- **🪝 E - Wraithblade** (3s): {35 MANA} A swift strike that inflicts enemies hit with the CORRUPTED debuff for 8 seconds. reducing movement speed by 90%. Afflicted enemies regain 10% movement speed per second.
- **👻 R - Hexed Smite** (3s): {45 MANA} Calls down unholy energy, dealing damage to enemy players in a small area, healing you for the same amount of damage dealt.
- **💔 F - Heartrend** (Toggle): {24 MANA/S} Toggle a force-multiplier aura that increases critical strike chance by 45% and critical strike damage by 75%.
- **🩸 P - Bloodpact** (Passive): Reduces mana costs by 10% and heals for 15% of all attack damage dealt.

![runeblade](https://github.com/user-attachments/assets/d0221986-6fae-42a8-9143-8092ea6c3bcd)




## 📊 Progression System

### Leveling & Experience
- **5 Levels** with increasing health (1000 + 150 per level)
- **Exponential XP Requirements**: 50 → 100 → 200 → 400 total XP
- **Combat Rewards**: Damage dealt and eliminations grant experience
- **Skill Points**: 1 point per level + 2 starting points

### Ability Unlocking
- **4 Abilities per Weapon**: Q, E, R, F (plus passive P)
- **Strategic Choices**: Mix and match abilities across weapon slots
- **Persistent Unlocks**: Abilities remain unlocked across games

## 🛠️ Technical Architecture

### Frontend Stack
- **Framework**: Next.js 14 with React 18
- **3D Engine**: Three.js with React Three Fiber
- **Networking**: Socket.io client with automatic reconnection
- **Audio**: Howler.js with spatial audio processing
- **UI**: Tailwind CSS with custom components
- **State**: React Context with optimized updates

### Backend Stack
- **Runtime**: Node.js with Express
- **WebSocket**: Socket.io with CORS support
- **Deployment**: Fly.io with auto-scaling
- **Monitoring**: Health checks and performance metrics

### Performance Features
- **Entity Component System**: Modular game object management with 13 specialized components
- **Object Pooling**: Pre-allocated objects for projectiles and effects with automatic cleanup
- **State Batching**: Optimized network updates with frame-based batching
- **Level-of-Detail**: Distance-based rendering optimization
- **Instanced Rendering**: Efficient crowd rendering for enemies
- **Spatial Hashing**: Fast collision detection for hundreds of entities

## 🏗️ Entity Component System (ECS) Architecture

Nocturne's core architecture is built around a high-performance Entity Component System that enables modular, scalable game development. This pattern separates data (Components) from logic (Systems) and provides flexible entity composition.

### Core ECS Classes

#### **Entity** (`Entity.ts`)
- **Unique Identification**: Each entity has a unique auto-incrementing ID
- **Component Container**: Map-based storage of components with type-safe access
- **Component Queries**: Efficient checking for required component combinations
- **Lifecycle Management**: Active/inactive states and cleanup callbacks
- **User Data**: Arbitrary data storage for game-specific information

```typescript
const player = world.createEntity();
player.addComponent(new Transform(new Vector3(0, 0, 0)));
player.addComponent(new Movement(3.75, 0.8)); // speed, friction
player.addComponent(new Health(1000));
```

#### **Component** (`Component.ts`)
- **Abstract Base Class**: All components inherit from `Component`
- **Reset Method**: Required for object pooling cleanup
- **Enabled Flag**: Runtime component activation/deactivation
- **Explicit Type Identifiers**: String-based component identification for performance

#### **System** (`System.ts`)
- **Component Requirements**: Array of required component types for entity filtering
- **Priority System**: Lower numbers execute first (0-100 range)
- **Lifecycle Callbacks**: `onEntityAdded`, `onEntityRemoved`, `onEnable`, `onDisable`
- **Specialized Subclasses**: `RenderSystem`, `PhysicsSystem` for different update types

#### **World** (`World.ts`)
- **Entity Registry**: Central management of all entities
- **System Orchestration**: Priority-sorted system execution
- **Component Pooling**: Automatic object pooling for performance
- **Event System**: Inter-system communication
- **Query System**: Efficient entity filtering by component combinations

```typescript
const world = new World();

// Add systems in priority order
world.addSystem(new MovementSystem(inputManager)); // priority 10
world.addSystem(new CollisionSystem());           // priority 20
world.addSystem(new CombatSystem(world));         // priority 30

// Main game loop
world.update(deltaTime);
world.fixedUpdate(fixedDeltaTime);
world.render(deltaTime);
```

### Component Types

#### **Core Components**
- **Transform**: Position, rotation, scale with matrix caching and parent-child hierarchies
- **Movement**: Physics simulation with velocity, acceleration, friction, and movement flags
- **Health**: Damage/healing system with regeneration, invulnerability, and death states
- **Shield**: Damage absorption with regeneration mechanics

#### **Gameplay Components**
- **Enemy**: AI behavior, target tracking, and enemy-specific properties
- **Projectile**: Bullet/projectile simulation with lifetime and collision detection
- **Tower**: Defensive structures with health and ownership
- **Pillar**: Destructible map objectives with health tracking
- **SummonedUnit**: Temporary allied units with ownership and targeting

#### **Rendering Components**
- **Renderer**: Visual representation with material and geometry management
- **HealthBar**: UI health display with dynamic positioning
- **Collider**: Collision detection shapes and boundaries

### System Architecture

#### **Update Systems** (60 FPS)
- **MovementSystem**: WASD input, physics simulation, dash mechanics
- **CombatSystem**: Damage calculation, healing, death handling
- **ControlSystem**: Player input, weapon switching, ability management
- **CollisionSystem**: Spatial hash collision detection
- **AudioSystem**: Spatial audio positioning and playback

#### **Render Systems** (60 FPS)
- **RenderSystem**: Three.js rendering with LOD management
- **CameraSystem**: Dynamic camera positioning and smoothing
- **HealthBarSystem**: Health bar positioning and updates

#### **Physics Systems** (Fixed Timestep)
- **PhysicsSystem**: Fixed-timestep physics simulation for consistency

### Performance Optimizations

#### **Component Pooling**
```typescript
// World automatically pools components for reuse
const transform = world.createComponent(Transform); // Reused from pool
world.returnComponent(transform); // Returned to pool for next use
```

#### **Entity Queries**
```typescript
// Query entities with specific component combinations
const enemies = world.queryEntities([Transform, Movement, Enemy]);
const projectiles = world.queryEntities([Transform, Projectile]);
```

#### **System Matching**
```typescript
// Systems only process entities with required components
class MovementSystem extends System {
  readonly requiredComponents = [Transform, Movement];

  update(entities: Entity[], deltaTime: number) {
    // Only entities with Transform AND Movement components
    entities.forEach(entity => { /* process */ });
  }
}
```

#### **Event-Driven Communication**
```typescript
// Systems communicate through world events
world.emitEvent('player_damaged', { playerId, damage, source });
world.emitEvent('enemy_killed', { enemyId, killerId });

// Other systems can listen for these events
const events = world.getEvents('enemy_killed');
```

### ECS Benefits

- **Modularity**: Components and systems are independent and reusable
- **Performance**: Only relevant systems process relevant entities
- **Scalability**: Easy to add new entity types and behaviors
- **Maintainability**: Clear separation of data and logic
- **Memory Efficiency**: Object pooling prevents garbage collection spikes
- **Type Safety**: Full TypeScript support with component type checking

This ECS architecture enables Nocturne to handle hundreds of entities simultaneously while maintaining smooth 60 FPS performance and providing a foundation for easy feature expansion.

