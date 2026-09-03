// state_schema.js — Versioned boundary between saved game data and runtime state.
// C refs: save.c, restore.c, decl.h, you.h, rm.h.

export const SAVE_VERSION = 3;

const persistentNames = `
    Luck _activeSpecialLevel _armorClassDirty _artifactDiscoveries _artifactExistByBase _artifactExistCount _artifactExists
    _artifactRuntime _blindFromMonsterForm _bonesEncountered _bonesSaved _bubbleTraversalUp _canMakeBones _characterPickerUsed
    _commandCount _deathKiller _deathShopSettlement _deepestLevel _encounteredObjectTypes _encumbranceLevel _farMonsterNoise
    _fobjSerial _genocidedMonsters _helplessAfter _helplessDoneMessage _helplessReason
    _helplessRunmodeDelayPending _helplessTurns _heroActionSeq _heroTrack _initialGoldCount _initialPwBonus _kickedLoc
    _knownObjectTypes _lastBoulderPushMove _lastDemigodAggravation _lastDemigodNasty _lastInvNr _lastPushedBoulder _lastRandomMonsterGeneration
    _last_message _levelAnnotations _levelCache _lifeSavedCount _maintenanceMove _monsterMovementInitialized
    _monsterNoiseTime _moveloopStarted _nextAttribCheck _nextIdent _nextObjectTimerId _objectCallNames
    _objectDiscoveryOrder _objectPriceQuotes _optionsInitialized _overviewRecords _prayerAlignment _prayerCompletionMessage _prayerDeity
    _prayerForced _prayerLastTickMove _prayerOpeningMessage _prayerTurnsRemaining _preserveLeadingStyledBlanks _prevDecorType _priestPantheonIndex
    _questExpulsionPending _restoredBones _rndmonstAlignment _rndmonstAlignmentMove _runtimeVersionInfoInitialized _shopRooms _specialLevelPrototype
    _specialRooms _startingEffectsApplied _startingPwMinimum _stethoscopeSeq _templeRooms _tipSwimShown
    _travelTipShown _tributeBookstock _tutorialActive _tutorialDeclined _tutorialState _unresolvedDemigodIntervention _unweapon
    _useInitialMaintenance _vaultGuard _vaultHiddenGold _wailmsg advance aggravateMonster
    aggravate_monster air_level antimagic astral_level blind branches castleTune
    commandBindings context deaf detectMonsters discover discoveries displaced
    displayName dungeons dx dy earth_level fire_level flags
    flying fruitName gamelog iflags in_mk_themerooms in_mklev initAlignment
    inventory invisible js juiblex_level knox_level lastStrTurn level
    levitating made_branch maxSkill medusa_level mines_dnum mode moves
    multi mvitals name nethackrc nh_lua_variables objectColors objectDescriptionIndex objectDescriptions
    oracle_level plname polymorphControl preferred_pet protectionFromShapeChangers quest_dnum quest_status
    race reflecting rndencode rogue_level sanctum_level seer_turn skill
    smeq sokoban_dnum specialLevels spells splev_align stairs startingPet
    stronghold_level symset targetX targetY tower_dnum tutorial_set_in_config twoweap
    u uamul uarm uarmc uarmf uarmg uarmh
    uarms uarmu uball ublindf uchain udaminc uleft
    unaware unchanging underwater uquiver urace uright urole
    uskin uswallow uswapwep uwep valley_level vault_x vault_y
    wandNothingDirection water_level were_changes
`;

const transientNames = `
    _armorClassDirtyAfterDelayedFrame _cannedCommands _capacityDirty _cursorOverride _deathSurvivalHeroTookTimePending _deathSurvivalRunmodeDelayPending _deathSurvivedMessagePending
    _deferVisibleMonsterContact _delayedAction _heroMeleeThisCommand _heroTimePending _interruptedMultiActionDebt _lastMonsterAllocations
    _lastMonsterScan _liveQuietTurnConsumed _liveQuietTurnRequested _migratingMonsters _multi _occupation _ordinaryDescentLive
    _pendingAngryGodOutcome _pendingDemigodIntervention _pendingFireRayDamage _pendingNewmanPolymorph _pendingOffensivePotionEffect _pending_message _prayerHeroTookTimePending
    _queuedHelplessRecoveryMessage _retained_message _runState _samuraiLiveScheduler _saveExitPending _screen_output _silentPrefixRetainedTopline
    _statusAcOverride _statusDeafOverride _statusGoldOverride _statusHpOverride _statusProjectedAc _statusTurnOverride _suppressMapStatusForFlush
    _suppressMessagesUntilInput _thrownObject _travelTarget _vaultGuardArrivalPending _vaultHeroTookTimePending _vaultMaintenanceContinuation _viz_rmax
    _viz_rmin active_buf animationFrame coreCtx cs_left cs_right cs_rows
    currentSeed datetime displayCtx fmon getScreens mockStorage n_rects
    nhDisplay nhrect program_state rect_cnt storage vis_func vis_start_col
    vis_start_row vis_step vision_full_recalc viz_array
`;

export const PERSISTENT_STATE_KEYS = new Set(
    persistentNames.trim().split(/\s+/u),
);

export const TRANSIENT_STATE_KEYS = new Set(
    transientNames.trim().split(/\s+/u),
);

export function copyPersistentState(state) {
    const snapshot = {};
    const unknown = [];
    for (const [key, value] of Object.entries(state)) {
        if (PERSISTENT_STATE_KEYS.has(key)) {
            snapshot[key] = value;
        } else if (!TRANSIENT_STATE_KEYS.has(key)) {
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
