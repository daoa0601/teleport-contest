import type { MonsterHideUnder } from './monster_hiding.js';
import type { PetMeal } from './pet_eating.js';
import type { MonsterFormChange } from './monster_polymorph.js';
import type { WereChange } from './were.js';
import type { MessagePublisher } from './display.js';
import type { reassessMonsterArmor } from './monworn.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Position, Trap } from './map_types.js';
import type { rndcurse } from './throne.js';
import type { finishMonsterAttackDeath } from './monster_attack_death.js';
import type { DeathHandler } from './end.js';
import type { MonsterDeathHandler } from './monster_death.js';
import type { growMonster } from './monster_growth.js';
import type { MonsterSpitResult } from './monster_spit.js';
import type { MonsterOffensivePhase, MonsterOffensiveResult } from './monster_offensive_types.js';
import type { AttackMethod, DamageType, AT_EXPL, AT_GAZE, AT_ENGL, AT_WEAP, AT_BREA, AT_SPIT } from './monster_attack_types.js';
import type { HeroMonsterWeaponVolley } from './monster_projectile_types.js';
import type { finishEnvironmentalMonsterDeath } from './monster_death.js';
import type { applyMonsterContactPassive } from './monster_contact_passive.js';
import type { MonsterBearTrapEvent } from './bear_trap.js';
import type { MonsterFireTrapEvent } from './fire_trap.js';
import type { MonsterLandMineEvent } from './landmine_trap.js';
import type { MonsterPitTrap } from './monster_pit_trap.js';
import type { MonsterRockTrapEvent } from './rock_trap.js';
import type { MonsterProjectileTrapEvent } from './projectile_trap.js';
import type { MonsterSleepGasTrapEvent } from './sleep_gas_trap.js';
import type { MonsterSqueakyBoardEvent } from './squeaky_board_trap.js';
import type { MonsterVibratingSquareEvent } from './vibrating_square_trap.js';
import type { MonsterPolymorphTrapEvent } from './polymorph_trap.js';
import type { MonsterRustTrapEvent } from './rust_trap.js';
import type { MonsterAntiMagicTrapEvent } from './anti_magic_trap.js';
import type { MonsterMigrationResult } from './monster_migration.js';

export type RandomBelow = (limit: number) => number;
export type RollOne = (sides: number) => number;
export type RollDice = (count: number, sides: number) => number;
export type PublishMonsterMessage = MessagePublisher;

// Production discards the diagnostic call labels. Focused callers may retain
// them, so the turn owner requires only the operation it actually performs.
export interface MonsterCallLog {
    push(...labels: Array<string | number | { range: number; value: number }>): number;
    [Symbol.iterator](): Iterator<string | number | { range: number; value: number }>;
}

export type AttackTuple = readonly [
    attackType: AttackMethod,
    damageType: DamageType,
    dice: number,
    sides: number,
];

export interface MonsterMeleeAttack {
    type: 'claw' | 'bite' | 'kick' | 'butt' | 'touch' | 'sting' | 'hug' | 'weapon' | 'tentacle';
    attackType: AttackMethod;
    damageType: DamageType;
    damn: number;
    damd: number;
    attackIndex: number;
}

export interface MonsterMeleeHit extends MonsterMeleeAttack {
    roll: number;
    threshold: number;
    hit: boolean;
    damage: number;
}

export type MonsterSpecialHit = {
    damageType: DamageType;
    attackIndex: number;
    hit: boolean;
    damage: number;
    nativeResult: number;
} & (
    | { type: 'explosion'; attackType: typeof AT_EXPL }
    | { type: 'gaze'; attackType: typeof AT_GAZE }
    | { type: 'engulf'; attackType: typeof AT_ENGL }
);

export type MonsterRangedHit = {
    damageType: DamageType;
    attackIndex: number;
    hit: boolean;
    nativeResult: number;
    // Rays and volleys can affect several actors; there is no single damage roll.
    damage?: never;
} & (
    | { type: 'ranged-weapon'; attackType: typeof AT_WEAP }
    | { type: 'breath'; attackType: typeof AT_BREA }
    | { type: 'spit'; attackType: typeof AT_SPIT }
);

export type MonsterAttackHit = MonsterMeleeHit | MonsterSpecialHit | MonsterRangedHit;

export type MonsterGrowth = ReturnType<typeof growMonster>;
export type MonsterDeath = Awaited<ReturnType<typeof finishEnvironmentalMonsterDeath>>;
export type MonsterPassive = Awaited<ReturnType<typeof applyMonsterContactPassive>>;

export interface MonsterCombatDeath {
    survived: boolean;
    corpseCreated: boolean;
    corpse: GameObject | null;
    growth: MonsterGrowth | null;
    aggressor: Monster;
    heroDied?: boolean;
}

export interface MonsterCombatAttack {
    kind: 'monster-attack';
    aggressor: Monster;
    defender: Monster;
    results: MonsterAttackHit[];
    nativeResult?: number;
    struck?: boolean;
    fatalPassive?: boolean;
    heroDied?: boolean;
    aggressorDied?: boolean;
    defenderDied?: boolean;
    death?: MonsterCombatDeath | null;
    retaliationRule?: 'pet' | 'movement' | 'conflict' | null;
    counterattack?: MonsterCombatResult;
}

export interface MonsterWieldAction {
    kind: 'monster-wield';
    aggressor: Monster;
    defender: Monster;
    heroDied?: never;
    struck?: never;
    aggressorDied?: never;
    defenderDied?: never;
    fatalPassive?: never;
}

export type MonsterCombatResult = MonsterCombatAttack | MonsterWieldAction;

export interface MonsterConflictFight {
    attack: MonsterCombatResult;
    heroDied?: boolean;
    consumed?: boolean;
}

export interface MonsterRange {
    inRange: boolean;
    nearby: boolean;
    scared: boolean;
    heroDied: boolean;
}

export interface DochugContext {
    entryMnum: number;
    range: MonsterRange | null;
}

export interface MonsterMoveCandidate extends Position {
    info: number;
}

export interface PetInventoryAction {
    dropped?: GameObject[];
    pickedUp?: GameObject;
    // dog_invent() prints "picks up" while the object is still on the
    // floor; extraction and mpickobj() follow that message.
    pickupPending?: boolean;
    petMeal?: PetMeal;
}

export interface PetMovePlan {
    oldx: number;
    oldy: number;
    nix: number;
    niy: number;
    selectedInfo: number;
    reluctant: boolean;
    inventoryAction: PetInventoryAction | null;
}

export interface MonsterSpell {
    key: MonsterSpellName;
    level: number;
    flags: number;
}

export type MonsterSpellName =
    | 'psi-bolt'
    | 'cure-self'
    | 'haste-self'
    | 'stun-you'
    | 'disappear'
    | 'weaken-you'
    | 'destroy-armor'
    | 'curse-items'
    | 'aggravation'
    | 'summon-monsters'
    | 'clone-wizard'
    | 'death-touch'
    | 'open-wounds'
    | 'confuse-you'
    | 'paralyze'
    | 'blind-you'
    | 'insects'
    | 'lightning'
    | 'fire-pillar'
    | 'geyser';

export interface MonsterSpellEffect {
    count: number;
    created: Monster[];
    message: string | null;
    oldSpeed?: number;
    speed?: number;
}

export interface MovementSpellCast {
    spell: MonsterSpellName;
    cast: boolean;
    damageType: number;
    directed: false;
    blocked?: boolean;
    fumbled?: boolean;
    deferredSpellEffect?: boolean;
}

export interface MonsterAttackPaging {
    pagerOwned: boolean;
    messageAfterPager: boolean;
}

interface HeroAttackProgress {
    attackType?: number;
    damageType?: number;
    nativeResult?: number;
    hit?: boolean;
    heroDied?: boolean;
    attackerDone?: boolean;
    damage?: number;
    appliedDamage?: number;
    fatalDamage?: { hpKey: 'mh' | 'uhp'; hpBefore: number; damage: number };
    oldFormMnum?: number;
}

// Contact effects retain their own mutable progress across a tty pause. These
// fields belong to contact attacks, not arbitrary payloads on a generic event.
export interface HeroContactAttack extends HeroAttackProgress {
    kind: 'hero-attack';
    attackType: AttackMethod;
    damageType: DamageType;
    hit: boolean;
    roll?: number | null;
    threshold?: number;
    attackIndex?: number;
    nearMiss?: boolean;
    effect?: string;
    passive?: { heroDied?: boolean; attackerStopped?: boolean };
    negated?: boolean;
    deferredPostHit?: boolean;
    deferredSpecialContact?: boolean;
    contactDone?: boolean;
    deferredRevealUnder?: boolean;
    revealUnderMessage?: string;
    poison?: { attribute: number; fatal?: number; chance?: number } | null;
    deferredAmuletTheftGate?: boolean;
    deferredAmuletTheft?: boolean;
    amuletTheftTarget?: GameObject | null;
    deferredStickingAfterHit?: boolean;
    stuckHero?: boolean;
    stickingMessage?: string | null;
    effectMessage?: string | null;
    theftResolved?: boolean;
    deferredItemTheft?: boolean;
    stolenObject?: GameObject | null;
    theftWeight?: number;
    theftTicket?: number | null;
    monsterDisappeared?: boolean;
    deferredEngulf?: 'capture' | 'effect' | false;
    engulfDamage?: number;
    engulfOldX?: number;
    engulfOldY?: number;
    engulfResolved?: boolean;
    deferredFireNegation?: boolean;
    deferredColdNegation?: boolean;
    deferredElectricNegation?: boolean;
    deferredFireInventory?: boolean;
    deferredColdInventory?: boolean;
    deferredElectricInventory?: boolean;
    fireOriginalDamage?: number;
    coldOriginalDamage?: number;
    electricOriginalDamage?: number;
    fireEffectMessage?: string | null;
    coldEffectMessage?: string | null;
    electricEffectMessage?: string | null;
    fireResistanceMessage?: string | null;
    coldResistanceMessage?: string | null;
    electricResistanceMessage?: string | null;
    slimeBurnedMessage?: string | null;
    deferredElementalInventory?: {
        damageType: 'cold' | 'fire' | 'electric';
        sourceDamage: number;
    } | null;
    deferredLifeDrainGate?: boolean;
    deferredLifeDrain?: boolean;
    deferredStunGate?: boolean;
    stunSelected?: boolean;
    stunDuration?: number;
    stunMessage?: string | null;
    stunnedHero?: boolean;
    deferredLegEffect?: boolean;
    legSide?: 'left' | 'right';
    legContact?: 'reach' | 'nuzzle' | 'prick' | 'exposed-prick' | 'boot-prick' | 'boot-scratch';
    deferredBlindEffect?: boolean;
    blindIncrement?: number;
    blindApplicable?: boolean;
    blindMessage?: boolean;
    blindResolved?: boolean;
    toggledBlindness?: boolean;
    deferredSlimeEffect?: boolean;
    slimeNegated?: boolean;
    slimeCancelled?: boolean;
    slimeKiller?: string;
    slimeEffectMessage?: string | null;
    slimeStartPending?: boolean;
    deferredRustRehumanize?: boolean;
    deferredRustArmor?: boolean;
    deferredCorrosionArmor?: boolean;
    deferredDecayRehumanize?: boolean;
    deferredDecayArmor?: boolean;
    rehumanize?: boolean;
    drainedObject?: GameObject | null;
    drainMessage?: string | null;
}

export interface HeroSpellAttack extends HeroAttackProgress {
    kind: 'hero-spell';
    attackType: number;
    damageType: number;
    threshold: number;
    attackIndex: number;
    cast: boolean;
    spell?: MonsterSpellName;
    spellDice?: number;
    spellSides?: number;
    directed?: boolean;
    blocked?: boolean;
    fumbled?: boolean;
    misdirected?: boolean;
    curseKind?: 'visible-undirected' | 'visible-directed' | 'visible-general' | 'visible-displaced' | 'audible' | null;
    deferredSpellDamage?: boolean;
    deferredSpellEffect?: boolean;
    effectDamage?: number;
    spellEffectMessage?: string | null;
    deferredStrengthLoss?: { amount: number; killer: string };
    deferredFirePillar?: boolean;
    deferredLightningSpell?: boolean;
    deferredInsectSpell?: boolean;
    deferredCurseItems?: boolean;
    deferredSummonMonsters?: boolean;
    deferredCloneWizard?: boolean;
    deferredHasteSelf?: boolean;
    deferredAggravation?: boolean;
    deferredDeathTouch?: boolean;
    deferredDestroyArmor?: boolean;
    deferredGeyserSpell?: boolean;
    unimplementedSpellEffect?: boolean;
    healedMonster?: number;
    stunDuration?: number;
    monsterDisappeared?: boolean;
    reflectedLightning?: boolean;
    summonedInsects?: Monster[];
    fatalAttribution?: { kind: 'death-inflicted-by'; killer: string; announcesDeath: boolean };
    rehumanize?: boolean;
    deathTouchDamage?: number;
    deathTouchDrain?: number;
    destroyedArmor?: Array<{ armor: GameObject; destroyed: boolean }>;
    cursedInventory?: Awaited<ReturnType<typeof rndcurse>>;
    confusedHero?: boolean;
    paralyzed?: boolean;
    stunnedHero?: boolean;
    toggledBlindness?: boolean;
    cloneWizard?: Monster;
    summonedMonsters?: Monster[];
    aggravatedMonsters?: Monster[];
    hasteSelf?: { message: string | null; oldSpeed: number; speed: number };
}

export type HeroBreath = {
    nativeResult: number;
    attempted?: boolean;
} & (
    | { launched: false; cough?: boolean; damageType?: number; dice?: number; sides?: number }
    | {
          launched: true;
          damageType: number;
          dice: number;
          sides: number;
          targetX: number;
          targetY: number;
          x: number;
          y: number;
          dx: number;
          dy: number;
          deferredRay: boolean;
          finished?: boolean;
          heroDied?: boolean;
          cough?: never;
      }
);

export type HeroProjectile = HeroMonsterWeaponVolley;

export type HeroAttack =
    | HeroContactAttack
    | HeroSpellAttack
    | (HeroAttackProgress & { kind: 'hero-breath'; breath: HeroBreath })
    | (HeroAttackProgress & { kind: 'hero-spit'; spit: MonsterSpitResult })
    | (HeroAttackProgress & { kind: 'hero-projectile'; projectile: HeroProjectile })
    | (HeroAttackProgress & {
          kind: 'hero-gaze';
          attackType: number;
          damageType: number;
          dice: number;
          sides: number;
      })
    | (HeroAttackProgress & {
          kind: 'hero-magic-ray';
          attackType: number;
          damageType: number;
          dice: number;
          sides: number;
      })
    | (HeroAttackProgress & {
          kind: 'hero-explosion';
          attackType: number;
          damageType: number;
          dice: number;
          sides: number;
          foundHero: boolean;
      });

export interface HeroAttackSlot {
    attackIndex: number;
    effectiveAttack: AttackTuple;
    oldFormMnum: number;
}

export interface HeroAttackSequence {
    monster: Monster;
    cachedMnum: number;
    threshold: number;
    nextSlot: number;
    current: (HeroAttack & HeroAttackSlot) | null;
    results: number[];
    lastAttackRoll: number;
    firstFoundYou: boolean;
    paging: MonsterAttackPaging;
    offensive: MonsterOffensivePhase | null;
    skipNonMagic: boolean;
    done: boolean;
}

interface MiscItemProgress {
    object: GameObject;
    index: number;
    deferredEffect?: boolean;
    effectApplied?: boolean;
}

export type MonsterMiscItem =
    | (MiscItemProgress & {
          kind: 'potion-gain-level';
          riseDestination?: DungeonLocation;
          growth?: MonsterGrowth;
          increase?: number;
      })
    | (MiscItemProgress & { kind: 'potion-invisibility' | 'wand-invisibility' | 'container' | 'wand-polymorph' | 'potion-polymorph' })
    | { kind: 'polymorph-trap'; trap: Trap; deferredEffect: true; effectApplied?: boolean }
    | (MiscItemProgress & {
          kind: 'wand-speed-monster' | 'potion-speed';
          oldSpeed?: number;
          speedChanged?: boolean;
          speedMuch?: boolean;
      })
    | (MiscItemProgress & {
          kind: 'bullwhip-disarm';
          heroWeapon: GameObject;
          heroSwapWeapon: GameObject | null;
          target?: GameObject | null;
          whereTo?: number;
      })
    | (MiscItemProgress & { kind: 'item-result'; nativeResult: 0 | 1 | 2; heroDied: boolean });

export type MonsterTrapEvent =
    | MonsterBearTrapEvent
    | MonsterFireTrapEvent
    | MonsterLandMineEvent
    | MonsterPitTrap
    | MonsterRockTrapEvent
    | MonsterProjectileTrapEvent
    | MonsterSleepGasTrapEvent
    | MonsterSqueakyBoardEvent
    | MonsterVibratingSquareEvent
    | MonsterPolymorphTrapEvent
    | MonsterRustTrapEvent
    | (MonsterAntiMagicTrapEvent & {
          trap: Trap;
          inSight: boolean;
          seeSquare: boolean;
          visible: boolean;
      })
    | MonsterMigrationResult<Trap>
    | MonsterTeleportTrapEvent
    | MonsterRollingBoulderEvent
    | { kind: 'known-trap-avoided'; trap: Trap; damage: 0 }
    | { kind: 'web-trap'; trap: Trap; visible: boolean; damage: number; killed: boolean }
    | { kind: 'magic-trap'; trap: Trap; damage: number; killed: boolean };

export interface MonsterRelocation {
    oldx: number;
    oldy: number;
    x: number;
    y: number;
    moved: boolean;
    died?: boolean;
}

export interface MonsterTeleportTrapEvent {
    kind: 'teleport-trap';
    trap: Trap;
    trapSquare: Position;
    visible: boolean;
    relocation: MonsterRelocation | null;
    damage: 0;
    killed: false;
    restricted?: boolean;
}

export interface MonsterAttackInitiation {
    heroAttackSequence?: HeroAttackSequence;
}

// Native postmov retains these decisions across input pauses. Its species
// is refreshed after a movement trap, before the floor actions begin.
export interface MonsterMovementCapabilities {
    species: number;
    canOpen: boolean;
    canUnlock: boolean;
    canTunnel: boolean;
    wasSeen: boolean;
    wasSpotted: boolean;
}

// Movement may finish without changing coordinates. Native MMOVE status and
// the currently suspended phase are independent of the coordinate delta.
export interface MonsterMovement extends PetInventoryAction, MonsterAttackInitiation {
    oldx: number;
    oldy: number;
    x: number;
    y: number;
    moved: boolean;
    postMoveStatus?: number;
    movementStage?: 'postmov' | 'dochug';
    postMoveCapabilities?: MonsterMovementCapabilities;
    actionCompleted?: boolean;
    actorDied?: boolean;
    actorLeftLevel?: boolean;
    heroDied?: boolean;
    hidden?: boolean;
    guardFinished?: boolean;
    message?: string;
    waiting?: boolean;
    immobile?: boolean;
    sleeping?: boolean;
    eating?: boolean;
    retainedHidingPlace?: boolean;
    swallowedAttackSkipped?: boolean;
    fleeingRelocation?: boolean;
    fleeingTeleportFailed?: boolean;
    tenguTeleportFailed?: boolean;
    swallowedHold?: boolean;
    attemptedHero?: boolean;
    trapped?: boolean;
    priest?: boolean;
    shopkeeper?: boolean;
    immediateTrap?: boolean;
    forcedTrapLanding?: boolean;
    // FORCEBUNGLE retains the avoidance roll but makes its result ineffective.
    forcedTrapBungle?: boolean;
    escapingTrap?: boolean;
    reluctant?: boolean;
    attack?: MonsterCombatResult;
    usedDefense?: MonsterOffensiveResult;
    usedMisc?: MonsterMiscItem;
    trap?: MonsterTrapEvent | null;
    petMovePlan?: PetMovePlan;
    equipment?: Awaited<ReturnType<typeof reassessMonsterArmor>>;
    spellCast?: MovementSpellCast;
    spellEffect?: MonsterSpellEffect;
    postMoveWasVisible?: boolean;
    postMoveDestinationPainted?: boolean;
    postMoveOldSquarePainted?: boolean;
    hideUnder?: MonsterHideUnder;
    deferredAfterHideUnder?: boolean;
    deferredAfterMonsterTrap?: boolean;
    deferredAfterMovementSpell?: boolean;
    deferredAfterPetAttack?: boolean;
    deferredAfterRestrictedTenguTeleport?: boolean;
    deferredAfterRollingBoulderMessage?: boolean;
    deferredAfterSpecialAttack?: boolean;
    deferredCovetousRelocation?: boolean;
    covetousRelocation?: { appearMessage: boolean };
    deferredPetEating?: boolean;
    deferredPetMove?: boolean;
    deferredPetReluctance?: boolean;
    deferredCuss?: boolean;
}

export type MonsterAction = {
    monster: Monster;
    calls: MonsterCallLog;
    dochugContext?: DochugContext;
} & (
    | { movement: MonsterMovement; conflictFight?: never; event?: MonsterTrapEvent | null }
    | { movement?: never; conflictFight: MonsterConflictFight; event?: never }
);

export type MonsterMovementAction = Extract<MonsterAction, { movement: MonsterMovement }>;

export interface MonsterMoveResult {
    calls: MonsterCallLog;
    movement: MonsterMovement;
    dochugContext?: DochugContext;
}

export interface MonsterTurnResult extends MonsterMoveResult {
    dochugContext: DochugContext;
}

export interface MonsterTurnOptions {
    dochugContext?: DochugContext;
    afterCovetousRelocation?: boolean;
}

export interface MonsterRandomOptions {
    random?: RandomBelow;
    rollOne?: RollOne;
    rollDice?: RollDice;
}

export interface MonsterDamageOptions extends MonsterRandomOptions {
    publish?: PublishMonsterMessage;
    die?: DeathHandler;
}

export interface ImmediateMonsterTrapOptions extends MonsterRandomOptions {
    inAir?: boolean;
    force?: boolean;
    forceBungle?: boolean;
    publish?: PublishMonsterMessage;
}

export interface MonsterTrapResumeOptions extends MonsterRandomOptions {
    publish?: PublishMonsterMessage;
    monsterName?: (monster: Monster) => string;
    describeMonster?: (monster: Monster) => string;
    revealTrap?: (trap: Trap) => void;
    finishDeath?: MonsterDeathHandler;
}

export interface MonsterEngulfOptions extends Omit<MonsterDamageOptions, 'die'> {
    die?: typeof finishMonsterAttackDeath;
    flushMessages?: () => void | Promise<unknown>;
}

export type MonsterRollingBoulderEvent = {
    kind: 'rolling-boulder';
    trap: Trap;
    visible: boolean;
    wasSeen: boolean;
    damage: number;
    killed: boolean;
} & (
    | { released: false }
    | {
          released: true;
          boulder: GameObject;
          launch: Position;
          endpoint: Position;
          hitRoll: number;
          hitThreshold: number;
          hit: boolean;
          monsterHpBefore: number;
          monsterHpAfter: number;
          deferredDeath: boolean;
          deferredPlacement: boolean;
          inSight: boolean;
          seeSquare: boolean;
          death?: MonsterDeath;
      }
);

export type MonsterDistressEvent =
    | { kind: 'stationary-liquid'; monster: Monster }
    | { kind: 'shape-change'; monster: Monster; change: MonsterFormChange }
    | { kind: 'were-change'; monster: Monster; change: WereChange };
