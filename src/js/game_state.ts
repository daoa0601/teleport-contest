// Per-game state. Construction allocates containers; native startup owns values.
import { CommandBindings } from './command_bindings.js';
import { createHeroState } from './hero_types.js';
import type { Hero, InitializedHero } from './hero_types.js';
import type { Role, Race, Alignment } from './roles.js';
import type { GameFlags, InterfaceFlags } from './flags.js';
import type { GameMap } from './game.js';
import type { GameObject } from './object_types.js';
import type { ObjectPriceQuote } from './object_knowledge.js';
import type { Monster, MonsterVital } from './monster_types.js';
import type { Shopkeeper } from './shop_types.js';
import type { Position, Rectangle, Room, Stairway, ActiveSpecialLevel, CachedLevelState } from './map_types.js';
import type { Dungeon, DungeonBranch, DungeonLocation, SpecialLevelDescriptor, OverviewRecord } from './dungeon_types.js';
import type { GameDisplay } from './game_display.js';
import type { StorageBackend } from './storage.js';
import type { Isaac64Context } from './isaac64.js';
import type { RngSeed } from './rng.js';
import type { CannedCommand, DelayedArmorAction, RunState } from './command_types.js';
import type { FoodContext, HeroOccupation } from './occupation_types.js';
import type { TakeoffContext } from './takeoff_state.js';
import type { Artifact } from './artifacts.js';
import type { LuaVariables } from './lua/runtime.js';
import type { LuaAlignmentName } from './lua/lifecycle.js';
import type { SpellCategory } from './data_types.js';
import type { PrayerTrouble } from './prayer_trouble.js';
import type { HeroGenocideCause } from './hero_genocide.js';

export interface MonsterMessageContext {
    earlierActorPager: boolean;
}

export interface ProgramState {
    beyond_savefile_load?: boolean | number;
    gameover?: boolean;
    in_docrt?: boolean | number;
    in_getlev?: boolean;
    in_impossible?: boolean;
    in_paniclog?: boolean;
    in_sanity_check?: boolean;
    panicking?: number;
    restoring?: boolean | number;
    savefile_completed?: number;
    saving?: number;
    something_worth_saving?: boolean | number;
    stopprint?: number;
    windows_exited?: boolean;
    wizkit_wishing?: boolean;
}

export interface DiggingContext {
    pos: Position;
    level: DungeonLocation;
    down: boolean;
    chew: boolean;
    warned: boolean;
    effort: number;
    lastdigtime: number;
    quiet: boolean;
}

export interface SpellbookContext {
    book: GameObject | null;
    o_id: number;
    delay: number;
}

export interface GameContext extends FoodContext {
    move: number;
    botl?: boolean | number;
    bypasses?: boolean;
    current_fruit?: number;
    digging?: DiggingContext;
    forcefight?: boolean | number;
    jingle?: string;
    lifelist?: { total_seen_upclose?: number; total_photographed?: number };
    made_amulet?: boolean;
    mon_moving?: boolean | undefined;
    mv?: boolean;
    no_of_wizards?: number;
    nopick?: boolean;
    novel?: { id: number; count: number; pasg: number[] };
    obj_zapped?: boolean;
    polearm?: { hitmonId: number | null };
    poly_zapped?: number;
    run?: number;
    snickersneeTurn?: number;
    spbook?: SpellbookContext;
    startingpet_mid?: number;
    startingpet_typ?: number;
    takeoff?: TakeoffContext;
    tips?: number;
    travel?: boolean;
    travel1?: boolean;
    warnlevel?: number;
    warntype?: { obj?: number; polyd: number; speciesidx: number };
    xlock?: { box: GameObject | null } | null;
    zap_oseen?: boolean;
    achieveo?: {
        mines_prize_oid?: number;
        mines_prize_otyp?: number;
        soko_prize_oid?: number;
        soko_prize_otyp?: number;
    };
}

export interface MemorizedSpell {
    name: string;
    level: number;
    category: SpellCategory;
    know: number;
    otyp: number;
}

export interface Fruit {
    fid: number;
    fname: string;
}

export interface QuestStatus {
    first_start: boolean;
    met_leader: boolean;
    not_ready: number;
    pissed_off: boolean;
    got_quest: boolean;
    killed_leader: boolean;
    first_locate: boolean;
    met_intermed: boolean;
    got_final: boolean;
    made_goal: number;
    met_nemesis: boolean;
    killed_nemesis: boolean;
    in_battle: boolean;
    cheater: boolean;
    touched_artifact: boolean;
    offered_artifact: boolean;
    got_thanks: boolean;
    ldrgend: number;
    nemgend: number;
    godgend: number;
    leader_is_dead: boolean;
    leader_m_id: number;
}

export interface ShopRepossession {
    shopkeeper: Shopkeeper | null;
    location: Position;
}

export type PrayerOutcome = 'moloch' | 'too-soon' | 'angry'
    | 'other-god' | 'pleased' | 'undead';

export interface TutorialState {
    moves: number;
    hero: Hero;
    inventory: GameObject[];
    spells: MemorizedSpell[];
    mvitals: MonsterVital[];
    genocided: string[] | undefined;
    discoveryOrder: number[] | undefined;
    encountered: Set<number> | undefined;
}

export interface GameState {
    // Allocated before option parsing and character selection.
    u: Hero;
    urole: Role | null;
    urace: Race | null;
    initAlignment: Alignment | null;
    context: GameContext;
    program_state: ProgramState;
    flags: GameFlags;
    iflags: InterfaceFlags;
    last_hider?: number;
    commandBindings: CommandBindings;
    moves: number;
    multi: number;
    inventory: GameObject[];
    spells: MemorizedSpell[];
    level: GameMap | null;
    dungeons: Dungeon[];
    branches: DungeonBranch[];
    stairs: Stairway | null;
    nhDisplay: GameDisplay | null;
    storage: StorageBackend | null;
    mockStorage: StorageBackend | null;
    coreCtx: Isaac64Context | null;
    displayCtx: Isaac64Context | null;
    currentSeed?: RngSeed;
    datetime: string | null;
    nethackrc: string;
    plname: string;
    displayName: string;
    name?: string;
    nh_lua_variables?: LuaVariables;
    animationFrame?: () => Promise<void>;
    getScreens?: () => string[];

    // Current ownership references remain nullable when an item leaves a slot.
    uamul?: GameObject | null;
    uarm?: GameObject | null;
    uarmc?: GameObject | null;
    uarmf?: GameObject | null;
    uarmg?: GameObject | null;
    uarmh?: GameObject | null;
    uarms?: GameObject | null;
    uarmu?: GameObject | null;
    uball?: GameObject | null;
    ublindf?: GameObject | null;
    uchain?: GameObject | null;
    uleft?: GameObject | null;
    uquiver?: GameObject | null;
    uright?: GameObject | null;
    uskin?: GameObject | null;
    uswapwep?: GameObject | null;
    uwep?: GameObject | null;
    fmon?: Monster | null;
    startingPet?: Monster | null;
    mvitals?: MonsterVital[];
    migratingObjects?: GameObject[];
    billObjects?: GameObject[];
    _migratingMonsters?: Monster[];
    _luaObjectRefs?: Set<WeakRef<GameObject>>;

    // Native initialization and level generation populate these records.
    ubirthday?: number;
    preferred_pet?: string;
    symset?: string | null;
    fruitName?: string;
    fruits?: Fruit[];
    castleTune?: string;
    specialLevels?: Map<string, SpecialLevelDescriptor>;
    oracle_level?: SpecialLevelDescriptor | undefined;
    medusa_level?: SpecialLevelDescriptor | undefined;
    knox_level?: SpecialLevelDescriptor | undefined;
    stronghold_level?: SpecialLevelDescriptor | undefined;
    valley_level?: SpecialLevelDescriptor | undefined;
    sanctum_level?: SpecialLevelDescriptor | undefined;
    rogue_level?: DungeonLocation | undefined;
    juiblex_level?: SpecialLevelDescriptor | undefined;
    astral_level?: SpecialLevelDescriptor | undefined;
    air_level?: SpecialLevelDescriptor | undefined;
    earth_level?: SpecialLevelDescriptor | undefined;
    fire_level?: SpecialLevelDescriptor | undefined;
    water_level?: SpecialLevelDescriptor | undefined;
    quest_dnum?: number;
    sokoban_dnum?: number;
    mines_dnum?: number;
    tower_dnum?: number;
    quest_status?: QuestStatus;
    in_mklev?: boolean;
    in_mk_themerooms?: boolean;
    made_branch?: boolean;
    splev_align?: LuaAlignmentName[];
    smeq?: number[];
    vault_x?: number;
    vault_y?: number;
    objectColors?: number[];
    objectDescriptionIndex?: number[];
    objectDescriptions?: Array<string | null>;
    objectMaterials?: number[];
    objectToughness?: number[];
    wandNothingDirection?: number;
    _activeSpecialLevel?: ActiveSpecialLevel | null;
    _specialLevelPrototype?: string | null | undefined;
    _levelCache?: Map<string, CachedLevelState>;
    _levelAnnotations?: Map<string, string>;
    _overviewRecords?: Map<string, OverviewRecord>;
    _heroTrack?: Position[];
    _restoredBones?: boolean;
    _rndmonstAlignment?: SpecialLevelDescriptor | null;
    _rndmonstAlignmentMove?: number;
    _prevDecorType?: number;
    _fobjSerial?: number;

    // Discovery, artifacts and event history are installed by their owners.
    _knownObjectTypes?: Set<number>;
    _encounteredObjectTypes?: Set<number>;
    _objectCallNames?: Partial<Record<number, string>>;
    _objectDiscoveryOrder?: number[];
    _objectPriceQuotes?: Partial<Record<number, ObjectPriceQuote>>;
    _artifactRuntime?: Map<number, Artifact>;
    _artifactExists?: Set<number>;
    _artifactFound?: Set<number>;
    _artifactDiscoveries?: number[];
    _genocidedMonsters?: string[];
    gamelog?: Array<{ turn: number; text: string }>;
    _bonesEncountered?: boolean;
    _bonesSaved?: boolean;
    _canMakeBones?: boolean;
    _deathKiller?: string;
    _polymorphGenocideCause?: HeroGenocideCause;
    _shopRepossession?: ShopRepossession;
    _lifeSavedCount?: number;
    _nextIdent?: number;
    _nextObjectTimerId?: number;
    _initialGoldCount?: number;
    _initialPwBonus?: number;
    _startingEffectsApplied?: boolean;
    _priestPantheonIndex?: number;
    _characterPickerUsed?: boolean;
    _optionsInitialized?: boolean;
    _runtimeVersionInfoInitialized?: boolean;
    _tributeBookstock?: boolean;
    _tutorialActive?: boolean;
    _tutorialDeclined?: boolean;
    tutorial_set_in_config?: boolean;
    _tutorialState?: TutorialState;

    // Resumed commands retain actual entities, not detached copies.
    _occupation?: HeroOccupation | null;
    _delayedAction?: DelayedArmorAction | null;
    _runState?: RunState | null;
    _cannedCommands?: CannedCommand[];
    _commandCount?: number;
    _commandKey?: number;
    _alreadyFoundFlag?: number;
    _didNothingFlag?: number;
    _heroActionSeq?: number;
    _heroTimePending?: boolean;
    _heroMeleeThisCommand?: boolean;
    _cleaveClockwise?: boolean;
    _interruptedMultiActionDebt?: boolean;
    _lastPushedBoulder?: GameObject;
    _lastBoulderPushMove?: number;
    _currentWand?: GameObject | null;
    _thrownObject?: GameObject | null;
    _kickedObject?: GameObject | null;
    _kickedLoc?: Position | null;
    _travelTarget?: Position | null;
    _stethoscopeSeq?: number;
    _lastInvNr?: number;
    _capacityDirty?: boolean;
    _encumbranceLevel?: number;
    _pendingHeroShapeChange?: 'polymorph' | 'were';
    _unweapon?: boolean;
    dx?: number;
    dy?: number;
    lastStrTurn?: number;
    targetX?: number;
    targetY?: number;

    // Native movement, helplessness and prayer scheduling.
    _moveloopStarted?: boolean;
    _nextAttribCheck?: number;
    rndencode?: number;
    seer_turn?: number;
    _helplessTurns?: number;
    _helplessReason?: string | null;
    _helplessDoneMessage?: string | null;
    _helplessAfter?: 'end-mimic-meal' | 'hear-again' | 'unfaint' | 'finish-digestion' | null;
    _digestedMonsterSpecies?: number | null;
    _mimicMealMessage?: string | null;
    _queuedHelplessRecoveryMessage?: string | null;
    _helplessRunmodeDelayPending?: number | null;
    _deathSurvivalHeroTookTimePending?: number | null;
    _deathSurvivalRunmodeDelayPending?: boolean;
    _deathSurvivedMessagePending?: boolean;
    _prayerAlignment?: number;
    _prayerTrouble?: PrayerTrouble;
    _prayerOutcome?: PrayerOutcome;
    _prayerTurnsRemaining?: number;
    _prayerLastTickMove?: number;
    _prayerCompletionMessage?: string;
    _prayerHeroTookTimePending?: number | null;
    _pendingDemigodIntervention?: { kind: 2 | 4 | 5; sourceTurn: number } | null;
    _unresolvedDemigodIntervention?: number;
    _lastDemigodAggravation?: number[];
    _lastDemigodNasty?: number[];
    _questExpulsionPending?: { seal: boolean } | null;
    _vaultGuardArrivalPending?: { vault: Room } | null;
    _vaultMaintenanceContinuation?: { sourceTurn: number } | null;
    _vaultHeroTookTimePending?: number | null;
    _bubbleTraversalUp?: boolean;
    _emptyShops?: number[];
    _shopFollowMessageTurn?: number;
    _monsterNoiseTime?: number;
    lastMonsterWeaponReturnMessage?: number;
    _farMonsterNoise?: boolean;
    _monsterSwallower: Monster | { kind: 'hero' } | null;
    _monsterEngulf: { attacker: Monster; defender: Monster; defenderExposed: boolean } | null;
    _deferVisibleMonsterContact?: boolean | undefined;
    _monsterMessageContext?: MonsterMessageContext;
    _steedDismounting?: boolean;
    _elementalClogMessageMove?: number;
    _cannibalCheckMove?: number;
    were_changes?: number;
    _tipSwimShown?: boolean;
    _travelTipShown?: boolean;
    _monTelecontrol?: boolean;
    _inTeleportTrap?: boolean;

    // Display and vision data are transient, except the saved topline.
    bhitpos: Position;
    notonhead: boolean;
    warn_obj_cnt: number;
    _pending_message: string;
    _retained_message: string;
    _last_message: string;
    _lastPlineMessage: string;
    _lastPlineKind?: number;
    _screen_output: string;
    _mapFlushPaused?: boolean;
    _statusUpdatesDisabled?: boolean;
    _cursorOverride?: [number, number] | null;
    _statusAcOverride?: number;
    _statusDeafOverride?: boolean;
    _statusGoldOverride?: number;
    _statusHpOverride?: number;
    _statusProjectedAc?: number;
    _armorClassDirty?: boolean;
    _armorClassDirtyAfterDelayedFrame?: boolean;
    _preserveLeadingStyledBlanks?: boolean;
    _suppressMapStatusForFlush?: boolean;
    _suppressMessagesUntilInput?: boolean;
    _silentPrefixRetainedTopline?: boolean;
    _transientLights?: Array<Position & { range: number }>;
    viz_array?: Uint8Array[];
    vision_full_recalc?: number;
    active_buf?: number;
    _viz_rmin?: Int16Array | null;
    _viz_rmax?: Int16Array | null;
    nhrect?: Rectangle[] | null;
    n_rects?: number;
    rect_cnt?: number;

    // Existing C-facing property projections. Property owners synchronize them.
    Luck?: number;
    aggravateMonster?: boolean;
    aggravate_monster?: boolean;
    antimagic?: boolean;
    blind?: boolean;
    deaf?: boolean;
    detectMonsters?: boolean;
    discover?: boolean;
    displaced?: boolean;
    flying?: boolean;
    invisible?: boolean;
    levitating?: boolean;
    polymorphControl?: boolean;
    protectionFromShapeChangers?: boolean;
    unchanging?: boolean;
    underwater?: boolean;
    uswallow?: number;
    udaminc?: number;
}

export interface PlayingGameState extends GameState {
    u: InitializedHero;
    urole: Role;
    urace: Race;
    level: GameMap;
}

export function createGameState(): GameState {
    return {
        u: createHeroState(), urole: null, urace: null, initAlignment: null,
        context: { move: 0 }, program_state: {}, flags: {}, iflags: {},
        commandBindings: new CommandBindings(), moves: 0, multi: 0,
        inventory: [], spells: [],
        level: null, dungeons: [], branches: [], stairs: null,
        nhDisplay: null, storage: null, mockStorage: null,
        coreCtx: null, displayCtx: null, datetime: null,
        nethackrc: '', plname: '', displayName: '',
        _monsterSwallower: null, _monsterEngulf: null, warn_obj_cnt: 0,
        bhitpos: { x: 0, y: 0 }, notonhead: false,
        _pending_message: '', _retained_message: '', _last_message: '',
        _lastPlineMessage: '', _screen_output: '',
    };
}
