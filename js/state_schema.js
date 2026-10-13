// state_schema.js — Versioned boundary between saved game data and runtime state.
// C refs: save.c, restore.c, decl.h, you.h, rm.h.
export const SAVE_VERSION = 24;
const persistentNames = [
    'Luck', '_activeSpecialLevel', '_armorClassDirty', '_artifactDiscoveries',
    '_artifactExists', '_artifactFound', '_artifactRuntime', '_bonesEncountered',
    '_bonesSaved', '_bubbleTraversalUp', '_characterPickerUsed',
    '_deathKiller', '_digestedMonsterSpecies', '_encounteredObjectTypes',
    '_encumbranceLevel', '_farMonsterNoise', '_fobjSerial',
    '_helplessAfter', '_helplessDoneMessage', '_helplessReason', '_helplessTurns',
    '_heroActionSeq', '_heroTrack', '_initialGoldCount', '_initialPwBonus',
    '_knownObjectTypes', '_lastBoulderPushMove', '_lastDemigodAggravation',
    '_lastDemigodNasty', '_lastInvNr', '_lastPushedBoulder', '_last_message',
    '_levelAnnotations', '_levelCache', '_lifeSavedCount', '_migratingMonsters',
    '_mimicMealMessage', '_monsterNoiseTime', '_moveloopStarted', '_nextAttribCheck',
    '_nextIdent', '_nextObjectTimerId', '_objectCallNames', '_objectDiscoveryOrder',
    '_objectPriceQuotes', '_optionsInitialized', '_overviewRecords', '_polymorphGenocideCause', '_prayerAlignment',
    '_prayerCompletionMessage', '_prayerOutcome', '_prayerTrouble', '_prayerLastTickMove',
    '_prayerTurnsRemaining', '_preserveLeadingStyledBlanks', '_prevDecorType',
    '_priestPantheonIndex', '_questExpulsionPending', '_restoredBones', '_rndmonstAlignment',
    '_rndmonstAlignmentMove', '_runtimeVersionInfoInitialized', '_specialLevelPrototype',
    '_startingEffectsApplied', '_stethoscopeSeq', '_tipSwimShown',
    '_travelTipShown', '_tributeBookstock', '_tutorialActive', '_tutorialDeclined',
    '_unresolvedDemigodIntervention', '_unweapon',
    'aggravateMonster', 'aggravate_monster',
    'air_level', 'antimagic', 'astral_level', 'billObjects', 'blind', 'branches', 'castleTune',
    'context', 'deaf', 'detectMonsters', 'discover', 'displaced', 'displayName',
    'dungeons', 'dx', 'dy', 'earth_level', 'fire_level', 'flags', 'flying', 'fruitName',
    'fruits', 'gamelog', 'in_mk_themerooms', 'in_mklev', 'initAlignment', 'inventory',
    'invisible', 'juiblex_level', 'knox_level', 'lastStrTurn', 'level', 'levitating',
    'made_branch', 'medusa_level', 'migratingObjects', 'mines_dnum',
    'moves', 'mvitals', 'name', 'nethackrc', 'nh_lua_variables', 'objectColors',
    'objectDescriptionIndex', 'objectDescriptions', 'objectMaterials', 'objectToughness',
    'oracle_level', 'plname', 'polymorphControl', 'preferred_pet',
    'protectionFromShapeChangers', 'quest_dnum', 'quest_status',
    'rndencode', 'rogue_level', 'sanctum_level', 'seer_turn', 'smeq', 'sokoban_dnum',
    'specialLevels', 'spells', 'splev_align', 'stairs', 'startingPet', 'stronghold_level',
    'symset', 'targetX', 'targetY', 'tower_dnum', 'tutorial_set_in_config', 'u', 'uamul',
    'uarm', 'uarmc', 'uarmf', 'uarmg', 'uarmh', 'uarms', 'uarmu', 'uball', 'ubirthday',
    'ublindf', 'uchain', 'udaminc', 'uleft', 'unchanging', 'underwater', 'uquiver', 'urace',
    'uright', 'urole', 'uskin', 'uswallow', 'uswapwep', 'uwep', 'valley_level', 'vault_x',
    'vault_y', 'wandNothingDirection', 'water_level', 'were_changes',
];
// Every remaining GameState field must be transient. Adding, removing, or
// reclassifying a field requires an explicit persistence decision at compile time.
const transientFields = {
    _canMakeBones: true,
    _wailMessageMove: true,
    bhitpos: true,
    notonhead: true,
    _currentWand: true,
    _elementalClogMessageMove: true,
    _cannibalCheckMove: true,
    _armorClassDirtyAfterDelayedFrame: true,
    _cannedCommands: true,
    _capacityDirty: true,
    _cleaveClockwise: true,
    _cursorOverride: true,
    _deathSurvivalHeroTookTimePending: true,
    _deathSurvivalRunmodeDelayPending: true,
    _deathSurvivedMessagePending: true,
    _commandCount: true,
    _commandKey: true,
    _kickedLoc: true,
    _helplessRunmodeDelayPending: true,
    multi: true,
    _alreadyFoundFlag: true,
    _didNothingFlag: true,
    _emptyShops: true,
    _deferVisibleMonsterContact: true,
    _monsterMessageContext: true,
    _delayedAction: true,
    _heroMeleeThisCommand: true,
    _heroTimePending: true,
    _interruptedMultiActionDebt: true,
    _lastPlineKind: true,
    _lastPlineMessage: true,
    _luaObjectRefs: true,
    _mapFlushPaused: true,
    _inTeleportTrap: true,
    lastMonsterWeaponReturnMessage: true,
    _monTelecontrol: true,
    _monsterSwallower: true,
    _monsterEngulf: true,
    _occupation: true,
    _pendingDemigodIntervention: true,
    _pendingHeroShapeChange: true,
    _pending_message: true,
    _prayerHeroTookTimePending: true,
    _queuedHelplessRecoveryMessage: true,
    _retained_message: true,
    _runState: true,
    _screen_output: true,
    _shopFollowMessageTurn: true,
    _shopRepossession: true,
    _silentPrefixRetainedTopline: true,
    _statusAcOverride: true,
    _statusDeafOverride: true,
    _statusGoldOverride: true,
    _statusHpOverride: true,
    _statusProjectedAc: true,
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
    rect_cnt: true,
    storage: true,
    vision_full_recalc: true,
    viz_array: true,
    warn_obj_cnt: true,
};
const persistentStateKeys = new Set(persistentNames);
const persistentKeyNames = persistentStateKeys;
function isPersistentStateKey(key) {
    return persistentKeyNames.has(key);
}
function copyStateKey(snapshot, state, key) {
    snapshot[key] = state[key];
}
// Install only fields admitted by the saved-state schema. Keep the live state
// object and the decoded graph references; process-only fields stay in place.
export function restorePersistentState(state, snapshot) {
    // An absent optional field must clear its previous live value too.
    for (const key of persistentStateKeys)
        restoreStateKey(state, snapshot, key);
}
function restoreStateKey(state, snapshot, key) {
    state[key] = snapshot[key];
}
export function copyPersistentState(state) {
    const snapshot = {
        u: state.u, urole: state.urole, urace: state.urace,
        initAlignment: state.initAlignment, context: state.context,
        flags: state.flags, moves: state.moves, inventory: state.inventory,
        spells: state.spells,
        level: state.level, dungeons: state.dungeons, branches: state.branches,
        stairs: state.stairs, nethackrc: state.nethackrc,
        plname: state.plname, displayName: state.displayName,
        _last_message: state._last_message,
    };
    const unknown = [];
    for (const key of Object.keys(state)) {
        if (isPersistentStateKey(key)) {
            copyStateKey(snapshot, state, key);
        }
        else if (!Object.hasOwn(transientFields, key)) {
            unknown.push(key);
        }
    }
    if (unknown.length) {
        throw new Error(`Save schema does not classify: ${unknown.sort().join(', ')}`);
    }
    return snapshot;
}
//# sourceMappingURL=state_schema.js.map