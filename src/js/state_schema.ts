// state_schema.js — Versioned boundary between saved game data and runtime state.
// C refs: save.c, restore.c, decl.h, you.h, rm.h.

import type { GameContext, GameState } from './game_state.js';

export const SAVE_VERSION = 37;

const persistentNames = [
    'Luck', '_activeSpecialLevel', '_armorClassDirty', '_artifactDiscoveries',
    '_artifactExists', '_artifactFound', '_artifactRuntime', '_bonesEncountered',
    '_deathKiller', '_encounteredObjectTypes', '_fobjSerial', '_heroTrack',
    '_initialGoldCount', '_knownObjectTypes', '_last_message', '_levelAnnotations',
    '_levelCache', '_lifeSavedCount', '_migratingMonsters', '_nextAttribCheck', '_nextIdent',
    '_nextObjectTimerId', '_objectCallNames', '_objectDiscoveryOrder', '_objectPriceQuotes',
    '_overviewRecords', '_polymorphGenocideCause', '_priestPantheonIndex',
    '_questExpulsionPending', '_stethoscopeSeq', '_tipSwimShown', '_travelTipShown',
    '_tributeBookstock', '_tutorialActive', 'aggravateMonster', 'aggravate_monster',
    'air_level', 'antimagic', 'astral_level', 'billObjects', 'blind', 'branches',
    'castleTune', 'context', 'deaf', 'detectMonsters', 'discover', 'displaced', 'displayName',
    'dungeons', 'dx', 'dy', 'earth_level', 'fire_level', 'flags', 'flying', 'fruitName',
    'fruits', 'gamelog', 'initAlignment', 'inventory', 'invisible', 'juiblex_level',
    'knox_level', 'lastStrTurn', 'level', 'levitating', 'medusa_level', 'migratingObjects',
    'mines_dnum', 'moves', 'mvitals', 'name', 'nh_lua_variables', 'objectColors',
    'objectDescriptionIndex', 'objectDescriptions', 'objectMaterials', 'objectToughness',
    'oracle_level', 'oracleRemaining', 'plname', 'polymorphControl',
    'protectionFromShapeChangers', 'quest_dnum', 'quest_status', 'rndencode', 'rogue_level',
    'sanctum_level', 'seer_turn', 'sokoban_dnum', 'specialLevels', 'spells', 'stairs',
    'stronghold_level', 'tower_dnum', 'u', 'uamul', 'uarm', 'uarmc', 'uarmf', 'uarmg',
    'uarmh', 'uarms', 'uarmu', 'uball', 'ubirthday', 'ublindf', 'uchain', 'udaminc', 'uleft',
    'unchanging', 'underwater', 'uquiver', 'urace', 'uright', 'urole', 'uskin', 'uswallow',
    'uswapwep', 'uwep', 'valley_level', 'wandNothingDirection', 'water_level',
] as const satisfies readonly (keyof GameState)[];

export type PersistentStateKey = typeof persistentNames[number];
// These port fields live beside svc.context data, but C stores them in
// display state, instance globals, or eat.c:newuhs()'s static meal buffer.
export type PersistentGameContext = Omit<GameContext,
    'botl' | 'time_botl' | 'obj_zapped' | 'poly_zapped' | 'zap_oseen'
    | 'forceSaveHungerState' | 'hungerStateBeforeMeal'>;
export type PersistentState = Omit<Pick<GameState, PersistentStateKey>, 'context'>
    & { context: PersistentGameContext };

// Every remaining GameState field must be transient. Adding, removing, or
// reclassifying a field requires an explicit persistence decision at compile time.
// C instance globals and function statics restart in the restored process.
const transientFields = {
    _bonesSaved: true,
    _bubbleTraversalUp: true,
    _characterPickerUsed: true,
    _digestedMonsterSpecies: true,
    _encumbranceLevel: true,
    _farMonsterNoise: true,
    _helplessDoneMessage: true,
    _helplessReason: true,
    _helplessTurns: true,
    _heroActionSeq: true,
    _initialPwBonus: true,
    _lastBoulderPushMove: true,
    _lastDemigodAggravation: true,
    _lastDemigodNasty: true,
    _lastInvNr: true,
    _lastPushedBoulder: true,
    _mimicMealMessage: true,
    _monsterNoiseTime: true,
    _moveloopStarted: true,
    _prayerAlignment: true,
    _prayerOutcome: true,
    _prayerTrouble: true,
    _preserveLeadingStyledBlanks: true,
    _prevDecorType: true,
    _restoredBones: true,
    _rndmonstAlignment: true,
    _rndmonstAlignmentMove: true,
    _runtimeVersionInfoInitialized: true,
    _specialLevelPrototype: true,
    _startingEffectsApplied: true,
    _tutorialDeclined: true,
    _unresolvedDemigodIntervention: true,
    _unweapon: true,
    in_mk_themerooms: true,
    in_mklev: true,
    made_branch: true,
    nethackrc: true,
    preferred_pet: true,
    smeq: true,
    splev_align: true,
    symset: true,
    targetX: true,
    targetY: true,
    tutorial_set_in_config: true,
    vault_x: true,
    vault_y: true,
    were_changes: true,

    _ballChainRestriction: true,
    _heroBubble: true,
    _domoveSucceeded: true,
    _wishHistory: true,
    _pickWarningMove: true,
    _pickupEncumbrance: true,
    _canMakeBones: true,
    _wailMessageMove: true,
    bhitpos: true,
    notonhead: true,
    _currentWand: true,
    _elementalClogMessageMove: true,
    _cannibalCheckMove: true,
    _mapPositionHighlight: true,
    _cannedCommands: true,
    _cleaveClockwise: true,
    _cursorOverride: true,
    _commandCount: true,
    _commandKey: true,
    _repeatCommands: true,
    _inDoAgain: true,
    _ynNumber: true,
    _movementAttempt: true,
    _whatdoesShown: true,
    _kickedLoc: true,
    _helplessRunmodeDelayPending: true,
    multi: true,
    _alreadyFoundFlag: true,
    _didNothingFlag: true,
    _emptyShops: true,
    _deferVisibleMonsterContact: true,
    _afterMove: true,
    _armorTheft: true,
    _heroMeleeThisCommand: true,
    _heroTimePending: true,
    _interruptedMultiActionDebt: true,
    _lastPlineKind: true,
    _lastPlineMessage: true,
    _luaObjectRefs: true,
    _mapFlushPaused: true,
    _underwaterView: true,
    _undergroundView: true,
    _inTeleportTrap: true,
    lastMonsterWeaponReturnMessage: true,
    _monTelecontrol: true,
    _monsterSwallower: true,
    _monsterEngulf: true,
    _occupation: true,
    _lockAttempt: true,
    _trapSetting: true,
    _pendingDemigodIntervention: true,
    _pendingHeroShapeChange: true,
    _pending_message: true,
    _queuedHelplessRecoveryMessage: true,
    _retained_message: true,
    _runState: true,
    _scheduledLevelChange: true,
    _screen_output: true,
    _shopFollowMessageTurn: true,
    _shopRepossession: true,
    _silentPrefixRetainedTopline: true,
    _statusGoldOverride: true,
    _statusUpdatesDisabled: true,
    _steedDismounting: true,
    _suppressMapStatusForFlush: true,
    _suppressMessagesUntilInput: true,
    _transientLights: true,
    _thrownObject: true,
    _kickedObject: true,
    _travelTarget: true,
    _tutorialState: true,
    _vaultGuardArrivalPending: true,
    _vaultHeroTookTimePending: true,
    _vaultMaintenanceContinuation: true,
    _viz_rmax: true,
    _viz_rmin: true,
    active_buf: true,
    animationFrame: true,
    coreCtx: true,
    commandBindings: true,
    currentSeed: true,
    datetime: true,
    displayCtx: true,
    fmon: true,
    iflags: true,
    last_hider: true,
    getScreens: true,
    mockStorage: true,
    n_rects: true,
    nhDisplay: true,
    nhrect: true,
    program_state: true,
    _autoAllHintShown: true,
    _autoAllImpliedHintShown: true,
    rect_cnt: true,
    storage: true,
    vision_full_recalc: true,
    viz_array: true,
    warn_obj_cnt: true,
    _magicKeyTrapWarningCount: true,
} satisfies Record<Exclude<keyof GameState, PersistentStateKey>, true>;

const persistentStateKeys = new Set<PersistentStateKey>(persistentNames);
const persistentKeyNames: ReadonlySet<string> = persistentStateKeys;

function isPersistentStateKey(key: string): key is PersistentStateKey {
    return persistentKeyNames.has(key);
}

function copyStateKey<Key extends PersistentStateKey>(
    snapshot: PersistentState, state: GameState, key: Key,
): void {
    snapshot[key] = state[key];
}

// Install only fields admitted by the saved-state schema. Keep the live state
// object and the decoded graph references; process-only fields stay in place.
export function restorePersistentState(state: GameState, snapshot: PersistentState): void {
    // An absent optional field must clear its previous live value too.
    for (const key of persistentStateKeys) restoreStateKey(state, snapshot, key);
}

function restoreStateKey<Key extends PersistentStateKey>(
    state: PersistentState, snapshot: PersistentState, key: Key,
): void {
    state[key] = snapshot[key];
}

export function copyPersistentState(state: GameState): PersistentState {
    const snapshot: PersistentState = {
        u: state.u, urole: state.urole, urace: state.urace,
        initAlignment: state.initAlignment, context: copyPersistentContext(state.context),
        flags: state.flags, moves: state.moves, inventory: state.inventory,
        spells: state.spells,
        level: state.level, dungeons: state.dungeons, branches: state.branches,
        stairs: state.stairs,
        plname: state.plname, displayName: state.displayName,
        _last_message: state._last_message,
    };
    const unknown: string[] = [];
    for (const key of Object.keys(state)) {
        if (key === 'context') continue;
        if (isPersistentStateKey(key)) {
            copyStateKey(snapshot, state, key);
        } else if (!Object.hasOwn(transientFields, key)) {
            unknown.push(key);
        }
    }
    if (unknown.length) {
        throw new Error(
            `Save schema does not classify: ${unknown.sort().join(', ')}`,
        );
    }
    return snapshot;
}

function copyPersistentContext(context: GameContext): PersistentGameContext {
    const snapshot = { ...context };
    delete snapshot.botl;
    delete snapshot.time_botl;
    delete snapshot.obj_zapped;
    delete snapshot.poly_zapped;
    delete snapshot.zap_oseen;
    delete snapshot.forceSaveHungerState;
    delete snapshot.hungerStateBeforeMeal;
    return snapshot;
}
