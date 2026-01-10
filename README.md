# 🌋 AVERNUS

A competitive 1v1 multiplayer PVP 3D action game featuring fast-paced real-time combat with strategic weapon switching, dozens of ability combinations and a progression system within a semi-MOBA format.

<img width="750" height="350" alt="Avernus" src="https://github.com/user-attachments/assets/b6814125-58f3-4d51-8fa9-4f945e3ee7f1" />

**GAMEPLAY: https://www.youtube.com/watch?v=5BqoieHbZJw**

<img width="722" height="439" alt="landscape" src="https://github.com/user-attachments/assets/531931f9-d4f7-41e8-88dc-fbf2c8f5ad01" />

## Table of Contents

- [Key Features](#key-features)
  - [Technical Specs](#-technical-specs)
  - [Gameplay Systems](#-gameplay-systems)
- [How to Play](#how-to-play)
  - [Quick Start](#quick-start)
  - [Game Format and Rules](#-game-format-and-rules)
  - [Game Objectives](#-game-objectives)
  - [Leveling and Experience](#-leveling-and-experience)
- [Weapon Classes and Abilities](#weapon-classes-and-abilities)
  - [Greatsword - {IMMORTAL}](#-greatsword---immortal)
  - [Bow - {VIPER}](#-bow---viper)
  - [Sabres - {ASSASSIN}](#sabres-assassin)
  - [Scythe - {WEAVER}](#-scythe---weaver)
  - [Runeblade - {TEMPLAR}](#-runeblade---templar)
- [Custom Model Creation and Visual Effects](#custom-model-creation-and-visual-effects)
  - [Model Construction Techniques](#model-construction-techniques)
  - [Visual Effects System](#visual-effects-system)
  - [ECS Integration](#ecs-integration)
- [Technical Architecture](#technical-architecture)
  - [Frontend Stack](#frontend-stack)
  - [Backend Stack](#backend-stack)
  - [Performance Features](#performance-features)
- [Entity Component System (ECS) Architecture](#entity-component-system-ecs-architecture)
  - [Core ECS Classes](#core-ecs-classes)
  - [Component Types](#component-types)
  - [System Architecture](#system-architecture)
  - [Performance Optimizations](#performance-optimizations)
  - [Custom ECS Architecture](#custom-ecs-architecture)
- [Complex State Management Architecture](#complex-state-management-architecture)
  - [Multiplayer State Synchronization](#multiplayer-state-synchronization)
  - [Combat State Management](#combat-state-management)
  - [Player State Management](#player-state-management)
  - [Performance State Management](#performance-state-management)
  - [Network State Reliability](#network-state-reliability)
  - [State Debugging and Monitoring](#state-debugging-and-monitoring)

## Key Features

### 🔩 Technical Specs
- **Real-time Multiplayer**: Socket.io-powered networking with sub-60ms latency
- **ECS Architecture**: Entity-Component-System for optimal performance and modularity
- **Advanced 3D Rendering**: Three.js with WebGL, LOD management, and instanced rendering
- **Spatial Audio**: Howler.js-powered 3D positional audio with 30+ unique sound effects
- **Performance Optimizations**: Object pooling, state batching, and performance monitoring
- **Scalable Backend**: Node.js server with automatic scaling and health monitoring
- **In-Game Chat Functionality**: Real-time multiplayer text communication with player names

### ⚙️ Gameplay Systems
- **5 Unique Weapon Classes**: Each with distinct playstyles and 4-5 unlockable abilities
- **Dynamic Progression**: Level up to 5, unlock abilities, and master multiple weapon combinations
- **Real-time Combat**: Precise hit detection, damage numbers, and visual feedback
- **Strategic Depth**: Resource management, cooldowns, ability combos and timings

---

## How to Play

### Quick Start
1. **Choose 2 Weapons**: Select a primary and secondary weapons from 5 classes. Each weapon starts off with their 'Q' ability by default. 
3. **Level Up**: Gain experience by eliminating enemy players and their summoned units.
4. **Unlock Abilities**: Start with 2 skill points. Spend skill points every level on new abilities.
5. **Master Combat**: Switch weapons mid-fight and combine abilities for devastating combos

### 📜 Game Format and Rules
- Each player has a Tower and 3 Inhibitors.
- Each player's Tower summons 3 Units every 45 seconds.
- Player kills and Summoned Unit kills award experience points.
- Leveling up grants a Skill Point to unlock additional abilities.
- Players respawn upon 12.5 seconds after death.
- Only Summoned Units can damage the opposing player's Tower.
- Players can destroy the opposing player's Inhibitors to upgrade their Summoned Units into ELITES.
- The first player to destroy the opposing player's Tower wins.

### 🏆 Game Objectives
- Defend your Tower from the enemy player's Summoned Units.
- Defend your Inhibitors from the enemy Player.
- Use your Summoned Units to damage the enemy Player's Tower.
- Destroy the enemy Player's Inhibitors to upgrade your Summoned Units into ELITES.
- Level up to gain combat bonuses and to invest Skill Points into additional weapon abilities.
- Destroy the enemy Player's Tower to win the game.

### 📊 Leveling & Experience
- **5 Levels** with increasing health (1000 + 150 per level). The Scythe and Runeblade increase their maximum mana pool per level, while the Greatsword, Sabres, and Bow instead gain increased critical strike chance and critical strike damage per level.
- **EXP Requirements**: 50 → 100 → 200 → 400 total XP to level up. Enemy Player Kills reward 10 EXP, while the Enemy's Summoned Unit kills are worth 5 EXP each. Clearing the wave of Summoned Units before your opponent rewards an additional 10 EXP. 
- **Combat Rewards**: Players and their summoned unit kills grant experience points.
- **Skill Points**: 1 point per level + 2 starting points.
- **4 Unlockable Abilities per Weapon**: {Q} unlocked by default, {E}, {R}, {F} active hotkeys and a passive ability choice {P}. Mix and match strategic ability choices across weapon slots.

---

## Weapon Classes and Abilities

### 💎 Greatsword - {IMMORTAL}
**Playstyle**: Versatile offensive figher with distance-closing and defensive capabilities
- **🛡️ Q - Fullguard** (7s): Creates a protective barrier that blocks all incoming damage for 3 seconds. Cannot attack while shielded.
- **🔱 E - Charge** (8s): Dash forward, instantly generating 25 rage and damaging enemies in your path.
- **⚡️ R - Colossus Strike** (5s): {25+ RAGE} Consumes all rage to execute an enemy player, calling down a lightning bolt that deals increasing damage based on the amount of rage consumed.
- **🌪 F - Divine Wind** (1.5s): {10 RAGE} Charges a gust of wind that launches your sword forward, dealing 120 piercing damage to enemies hit. Hitting an enemy player reduces the cooldown of Charge by 4 seconds.
- **⚜️ P - Titan's Breath** (Passive): Increases maximum health by 350 and health regeneration to 30 HP per second outside of combat (consecutive 5 seconds of not taking damage).

![greatsword2](https://github.com/user-attachments/assets/83ca4b6e-efe1-4cb1-b93e-a001f8ad4d03)

![greatsword](https://github.com/user-attachments/assets/9a4f5757-b28d-492c-80f0-d9abe4a25d6b)

---

### 🏹 Bow - {VIPER}
**Playstyle**: Ranged sniper with burst, harass and long-range siege potential
- **🎯 Q - Frost Bite** (5s): {50 ENERGY} Fires 5 arrows in an arc, dealing 30 damage per arrow and applying a 50% SLOW effect for 5 seconds. An enemy can be hit by multiple arrows at close range.
- **🐍 E - Cobra Shot** (2s): {60 ENERGY} Fires a laced arrow that applies VENOM damage over time to the target, preventing shield regeneration for 6 seconds.
- **🐉 R - Viper Sting** (2s): {60 ENERGY} Fires a powerful piercing arrow that returns to you after a short delay. Each hit on an enemy creates a soul fragment that heals you for 20 HP each when returned.
- **🪶 F - Cloudkill** (4s): {40 ENERGY} Launches an artillery barrage of arrows from the sky that rain down on enemy locations.
- **🍃 P - Tempest Rounds** (Passive): Replaces primary attack with a 3-round burst attack. Each arrow deals 30 damage.

![bow0](https://github.com/user-attachments/assets/b1d85d1b-7d2b-4610-abe6-5bfa173c7537)

![bow](https://github.com/user-attachments/assets/b5a67b0f-b4ea-457d-9e27-bb6b7f5e4c67)

![bow1](https://github.com/user-attachments/assets/453f112c-a136-4676-82e9-cb8b53df1593)

![bow2](https://github.com/user-attachments/assets/9c6bcc77-add9-4b9f-a4ae-ee1d1a494f10)

![bow3](https://github.com/user-attachments/assets/10442056-a76e-4f72-8210-d298e8271ee2)

---

<a name="sabres-assassin"></a>
### ⚔️ Sabres - {ASSASSIN}
**Playstyle**: Stealth-based close-quarters specialist with high-risk, high-reward damage
- **🔪 Q - Backstab** (2s): {60 ENERGY} Strikes the target with both sabres, dealing 75 damage or 175 damage if attacking the target from behind. Refund 45 energy if the target is stunned.
- **💥 E - Flourish** (1.5s): {35 ENERGY} Unleash a flurry of slashes that deals increased damage with successive hits on the same target, stacking up to 3 times. Expending 3 stacks applies STUN for 4 seconds.
- **🐦‍🔥 R - Divebomb** (6s): {40 ENERGY} Leap into the air and crash down, dealing 125 damage and applying STUN for 2 seconds to enemies caught below.
- **🌒 F - Shadow Step** (10s): Fade into the shadows, becoming INVISIBLE for 5 seconds. Dealing damage does not break stealth.
- **☠️ P - Cutthroat Oath** (Passive): Permanently increases critical strike chance by 30%.

![sabres3](https://github.com/user-attachments/assets/1cab3a0e-cfc1-4c5f-aa0e-0b75bdb7481f)

![sabres](https://github.com/user-attachments/assets/49f06421-7842-45f4-9ed0-01e5eac790f6)

![sabres2](https://github.com/user-attachments/assets/2f9ebaef-4890-4897-876d-03702d638854)

---

### 🦋 Scythe - {WEAVER}
**Playstyle**: Mana-based caster with offensive and defensive fire and ice spells
- **🔆 Q - Sunwell** (1s): {30 MANA} Transmutes mana to heal you for 60 HP.
- **❄️ E - Coldsnap** (12s): {50 MANA} Conjures an explosive ice vortex that applies FREEZE to enemies, immobilizing them for 6 seconds.
- **🔥 R - Crossentropy** (2s): {40 MANA} Charges for 1 second to fire an accelerating plasma bolt that deals 10 additional damage per stack of BURNING.
- **🪬 F - Mantra** (5s): {75 MANA} Summons a totem that heals you for 20 HP per second while blasting nearby enemies that enter its range. Lasts 8 seconds.
- **💠 P - Cryoflame** (Passive): Modifies primary attack to deal increased damage but no longer apply BURNING. Cryoflame Bolts deal double damage to enemies afflicted by FREEZE.

![scythe0](https://github.com/user-attachments/assets/51fe6ba4-5ab0-4c38-87f1-85bf16f9c27a)

![scythe1](https://github.com/user-attachments/assets/6eccc6a5-489d-4370-8293-574825a7c917)

![scythe2](https://github.com/user-attachments/assets/87ed8a70-e972-4fee-b87d-399e22643e47)

![scythe3](https://github.com/user-attachments/assets/079657fb-ccc2-4730-bfa9-342c16960f65)

---

### 🔮 Runeblade - {TEMPLAR}
**Playstyle**: Mana-based knight with life-stealing, area control and debuff abilities
- **⛓️ Q - Void Grasp** (5s): {35 MANA} Fires grasping chains that latch onto the first enemy hit, pulling them towards you.
- **🪝 E - Wraithblade** (3s): {35 MANA} A swift strike that inflicts enemies hit with the CORRUPTED debuff for 8 seconds. reducing movement speed by 90%. Afflicted enemies regain 10% movement speed per second.
- **👻 R - Hexed Smite** (3s): {45 MANA} Calls down unholy energy, dealing damage to enemy players in a small area, healing you for the same amount of damage dealt.
- **💔 F - Heartrend** (Toggle): {24 MANA/S} Toggle a force-multiplier aura that increases critical strike chance by 45% and critical strike damage by 75%.
- **🩸 P - Bloodpact** (Passive): Reduces mana costs by 10% and heals for 15% of all attack damage dealt.

![runeblade](https://github.com/user-attachments/assets/d0221986-6fae-42a8-9143-8092ea6c3bcd)

![runeblade2](https://github.com/user-attachments/assets/44b3d91a-21de-4b54-be95-73d676fec0c6)

---

## Custom Model Creation and Visual Effects

**No external 3D models/assets used** - All models built from scratch using Three.js primitives and mathematical shapes, maintaining a consistent 'bone' theme throughout.

![RunebladeAssetCreation](https://github.com/user-attachments/assets/c4cfd90d-bfb0-447d-8dac-4069bd0cc77b)
![BoneWings](https://github.com/user-attachments/assets/89f7699b-3fd5-4c8f-834e-f31e7879c0be)

### Model Construction Techniques
- **Primitive Geometry Assembly**: Weapons and units built by combining cylinders, spheres, boxes, and custom geometries
- **Mathematical Shape Generation**: Three.js `Shape` class used to create complex 2D profiles extruded into 3D forms
  - **Quadratic Curves**: `quadraticCurveTo()` method creates Bézier curves for smooth, organic weapon shapes

    ```typescript
    // Runeblade shape creation using quadratic curves
    shape.lineTo(0, 0.08);
    shape.lineTo(-0.2, 0.12);
    shape.quadraticCurveTo(0.8, -0.15, -0.15, 0.12);  // Subtle curve along back
    shape.quadraticCurveTo(1.8, -0, 1.75, 0.05);      // Gentle curve towards tip
    shape.quadraticCurveTo(2.15, 0.05, 2.35, 0.225);   // Sharp point

    // Lower edge with pronounced curves
    shape.quadraticCurveTo(2.125, -0.125, 2.0, -0.25);  // Start curve from tip
    shape.quadraticCurveTo(1.8, -0.45, 1.675, -0.55);   // Peak of the curve
    shape.quadraticCurveTo(0.9, -0.35, 0.125, -0.325);  // Curve back towards guard
    ```
- **Procedural Detailing**: Bones, spikes, and organic structures generated algorithmically for visual consistency

### Visual Effects System
- **Emissive Materials**: Glowing effects achieved through Three.js emissive material properties and dynamic point lights
- **Instanced Mesh Rendering**: High-performance particle systems for trails, auras, and environmental effects
- **Material Shaders**: Custom material configurations for metallic, crystalline, and ethereal appearances
  - **Projectile Trail Shaders**: 

    ```glsl
    // Entropic Bolt Fragment Shader
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float strength = smoothstep(0.5, 0.1, d);
      vec3 glowColor;
      float emissiveMultiplier = 0.5;
      if (uIsCryoflame) {
        glowColor = mix(uColor, vec3(0.2, 0.4, 0.8), 0.4); // Cryoflame: deep navy blue
        emissiveMultiplier = 2.0;
      } else {
        glowColor = mix(uColor, vec3(1.0, 0.6, 0.0), 0.4); // Normal: orange fire effect
        emissiveMultiplier = 1.0;
      }
      gl_FragColor = vec4(glowColor * emissiveMultiplier, vOpacity * strength);
    }
    ```

  - **Ground Shader**: Procedural texturing with normal mapping, ambient occlusion, and subtle animation

    ```glsl
    // Enhanced Ground Fragment Shader
    void main() {
      vec4 colorSample = texture2D(colorMap, vUv);
      vec3 normalSample = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;

      float distanceFromCenter = length(vPosition.xz) / 29.0;
      float ao = 1.0 - smoothstep(0.0, 1.0, distanceFromCenter) * 0.2;

      float animation = sin(vPosition.x * 0.01 + time * 0.1) * sin(vPosition.z * 0.01 + time * 0.07) * 0.02 + 1.0;

      vec3 finalColor = colorSample.rgb * animation * ao;

      float rim = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0));
      rim = pow(rim, 3.0) * 0.1;
      finalColor += accentColor * rim;

      gl_FragColor = vec4(finalColor, 1.0);
    }
    ```
- **Dynamic Lighting**: Real-time light positioning and intensity modulation for atmospheric effects

### ECS Integration
- **Component-Based Rendering**: Visual components (Renderer, HealthBar, Collider) integrated with ECS architecture
- **System-Driven Animation**: Animation states managed through ECS components with React Three Fiber integration

## Technical Architecture

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


## Entity Component System (ECS) Architecture

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
player.addComponent(new Health(500));
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
  - **Instanced Rendering**: High-performance crowd rendering with individual instance control

    ```typescript
    public setupInstancing(instancedMesh: InstancedMesh, instanceId: number): void {
      this.isInstanced = true;
      this.instancedMesh = instancedMesh;
      this.instanceId = instanceId;
    }

    public updateInstanceMatrix(matrix: Matrix4): void {
      if (this.isInstanced && this.instancedMesh && this.instanceId >= 0) {
        this.instancedMesh.setMatrixAt(this.instanceId, matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }

    public setInstanceVisible(visible: boolean): void {
      if (this.isInstanced && this.instancedMesh && this.instanceId >= 0) {
        const matrix = new Matrix4();
        this.instancedMesh.getMatrixAt(this.instanceId, matrix);

        if (!visible) {
          matrix.scale(new Vector3(0, 0, 0)); // Hide by scaling to zero
        }

        this.instancedMesh.setMatrixAt(this.instanceId, matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }
    ```

  - **Dynamic Mesh Updates**: Runtime property synchronization for shadows and materials

    ```typescript
    public updateMesh(): void {
      if (!this.mesh) return;

      // Handle shadow properties for both Mesh and Group hierarchies
      if (this.mesh instanceof Mesh) {
        this.mesh.castShadow = this.castShadow;
        this.mesh.receiveShadow = this.receiveShadow;
      } else if (this.mesh instanceof Group) {
        this.mesh.traverse((child) => {
          if (child instanceof Mesh) {
            child.castShadow = this.castShadow;
            child.receiveShadow = this.receiveShadow;
          }
        });
      }

      this.mesh.frustumCulled = this.frustumCulled;
      this.mesh.visible = this.visible;
      this.mesh.renderOrder = this.renderOrder;

      if (this.needsUpdate && this.geometry && this.material && this.mesh instanceof Mesh) {
        this.mesh.geometry = this.geometry;
        this.mesh.material = this.material;
        this.needsUpdate = false;
      }
    }
    ```
- **HealthBar**: UI health display with dynamic positioning
- **Collider**: Collision detection shapes and boundaries

### System Architecture

#### **Update Systems**
- **MovementSystem**: WASD input, physics simulation, dash mechanics
- **CombatSystem**: Damage calculation, healing, death handling
- **ControlSystem**: Player input, weapon switching, ability management
- **CollisionSystem**: Spatial hash collision detection
- **AudioSystem**: Spatial audio positioning and playback

#### **Render Systems**
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

### Custom ECS Architecture

- **Modularity**: Components and systems are independent and reusable
- **Performance**: Only relevant systems process relevant entities
- **Scalability**: Easy to add new entity types and behaviors
- **Maintainability**: Clear separation of data and logic
- **Memory Efficiency**: Object pooling prevents garbage collection spikes
- **Type Safety**: Full TypeScript support with component type checking

## Complex State Management Architecture

The game's architecture manages multiple interconnected state systems simultaneously to maintain smooth real-time gameplay across multiplayer environments. Here's how complex state synchronization keeps the game running:

### Multiplayer State Synchronization

#### **Client-Server State Reconciliation**
- **Network Batching**: State updates batched per frame to reduce network overhead while maintaining real-time feel
- **Authoritative Server**: Server maintains true game state, clients interpolate for smooth visuals
- **Conflict Resolution**: Server-authoritative decisions for critical gameplay elements (damage, positioning, ability activation)

```typescript
// State batching prevents network spam while maintaining responsiveness
private batchStateUpdate(updates: any[]): void {
  if (this.stateBatch.length === 0) {
    setTimeout(() => this.flushBatch(), 16); // ~60fps batching
  }
  this.stateBatch.push(...updates);
}
```

#### **Entity State Propagation**
- **Selective Broadcasting**: Only relevant state changes broadcast to reduce bandwidth (position updates every 50ms, health changes immediate)
- **Delta Compression**: Only changed values transmitted, not full state snapshots
- **Prediction & Reconciliation**: Client-side prediction with server reconciliation for responsive feel

### Combat State Management

#### **Damage Calculation Pipeline**
```typescript
// Damage flows through multiple systems with state validation
1. DamageCalculator.calculateDamage() → base damage with crits
2. CombatSystem.queueDamage() → validation and queuing
3. DamageNumberManager.addDamageNumber() → visual feedback
4. Network broadcast → synchronize across clients
```

#### **Ability State Coordination**
- **Cooldown Tracking**: Per-weapon ability states with network synchronization
- **Charge Management**: Real-time charge progress tracking across client/server
- **State Dependencies**: Abilities check multiple state conditions (mana, cooldowns, weapon type)

```typescript
// Complex state checks prevent invalid ability usage
private canActivateAbility(abilityType: string): boolean {
  return this.checkManaCost() &&
         this.checkCooldown(abilityType) &&
         this.checkWeaponCompatibility() &&
         this.checkPlayerState();
}
```

### Player State Management

#### **Weapon & Ability States**
- **Dual Weapon System**: Primary/secondary weapon states with hotkey switching
- **Subclass Management**: Weapon subclasses with unique ability sets
- **Skill Point Progression**: Unlocked abilities tracked per weapon/slot combination

#### **Health & Resource States**
- **Multi-layered Health**: Base health + shield + regeneration mechanics
- **Mana System**: Runeblade-specific resource with consumption/regeneration
- **Debuff State Tracking**: Multiple concurrent effects (frozen, slowed, stunned, burning) with durations

### Performance State Management

#### **Object Pooling State**
```typescript
// Pooled objects maintain internal state for reuse
class ProjectilePool {
  private activeProjectiles: Map<string, ProjectileState>;
  private availablePool: ProjectileState[];

  getProjectile(): ProjectileState {
    const projectile = this.availablePool.pop() || new ProjectileState();
    projectile.reset(); // Clean state for reuse
    return projectile;
  }
}
```

#### **LOD State Management**
- **Distance-Based State**: Entities transition between detail levels automatically
- **Culling States**: Frustum culling + occlusion culling state management
- **Render State Batching**: Instanced meshes maintain individual state within optimized batches

### Network State Reliability

#### **Connection State Management**
- **Automatic Reconnection**: Socket.io with exponential backoff reconnection
- **State Synchronization**: Full state resync on reconnection to prevent desynchronization
- **Latency Compensation**: Client-side prediction with server validation

#### **Error Recovery States**
- **Graceful Degradation**: System continues operating during network issues
- **State Validation**: Server-side validation prevents invalid state transitions
- **Rollback Mechanisms**: Critical state rollbacks when network conflicts detected

### State Debugging & Monitoring

#### **Performance State Tracking**
- **FPS Monitoring**: Real-time performance metrics with automatic optimization triggers
- **Memory State**: Object pool utilization tracking to prevent memory leaks
- **Network State**: Latency, packet loss, and state synchronization monitoring

```typescript
// Performance monitoring maintains system health
private monitorSystemHealth(): void {
  if (this.fps < 30) this.enableLowPowerMode();
  if (this.memoryUsage > 0.8) this.triggerGarbageCollection();
  if (this.networkLatency > 100) this.reduceUpdateFrequency();
}
```

This multi-layered state management ensures the game maintains consistent, responsive gameplay across varying network conditions while preventing common multiplayer issues like state desynchronization, input lag, and performance degradation.
