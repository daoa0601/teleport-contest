// A save becomes live state only after every persisted field has a checked
// domain shape. The graph decoder keeps entity identity; these checks never
// replace heroes, objects, monsters, or their ownership references.
import type { Artifact } from './artifacts.js';
import type { ArtifactTarget } from './data_types.js';
import type { GameMap } from './game.js';
import type {
    Fruit, MemorizedSpell, MonsterHelplessnessReason, QuestStatus,
} from './game_state.js';
import type { CachedLevelState } from './map_types.js';
import type { MonsterVital } from './monster_types.js';
import type { ObjectPriceQuote, ObjectPriceRange } from './object_knowledge.js';
import type { PrayerTrouble } from './prayer_trouble.js';
import type { LuaSerializedValue, LuaVariables } from './lua/runtime.js';
import type { Fields, SavedEntityContext } from './saved_validation.js';
import type { PersistentState } from './state_schema.js';
import { SAVE_VERSION } from './state_schema.js';
import { decodeSavedGraph, isSavedRecord } from './saved_graph.js';
import {
    arrayOf, boolean, closedFieldsMatch, integer, mapOf, nullable,
    numericRecordOf, oneOf, optional, setOf, string,
} from './saved_validation.js';
import { createSavedEntityChecks } from './entity_validation.js';
import { MONSTER_NAME } from './monster_data.js';
import { OBJECT_SPELL_CATEGORY } from './object_data.js';
import { ORACLE_TEXT } from './oracle_data.js';
import { validSavedHero, validSavedPropertyName } from './hero_validation.js';
import {
    validSavedAlignment, validSavedGameFlags, validSavedRace, validSavedRole,
} from './character_validation.js';
import {
    restoreSavedMap, validSavedDungeonLocation, validSavedPosition, validSavedStairways,
} from './map_validation.js';
import {
    validSavedActiveSpecialLevel, validSavedDungeon, validSavedDungeonBranch,
    validSavedGameContext, validSavedOverviewRecord, validSavedSpecialLevel,
} from './state_domain_validation.js';

export interface SavedGame {
    version: typeof SAVE_VERSION;
    state: PersistentState;
}

export function decodeSavedGame(encoded: string): SavedGame {
    const snapshot = decodeSavedGraph(encoded);
    const entities = createSavedEntityChecks();
    if (!closedFieldsMatch<SavedGame>(snapshot, {
        version: oneOf(SAVE_VERSION),
        state: (value): value is PersistentState => validPersistentState(value, entities),
    }, field => { throw new TypeError(`Saved game has invalid ${field}`); }))
        throw new TypeError('Saved game must be a versioned state record');
    return snapshot;
}

function validPersistentState(value: unknown, entities: SavedEntityContext): value is PersistentState {
    function map(candidate: unknown): candidate is GameMap {
        restoreSavedMap(candidate, entities);
        return true;
    }
    function cachedLevel(candidate: unknown): candidate is CachedLevelState {
        return closedFieldsMatch<CachedLevelState>(candidate, {
            level: map,
            stairs: validSavedStairways,
            heroTrack: optional(arrayOf(validSavedPosition)),
            savedAt: integer,
            activeSpecialLevel: optional(nullable(activeSpecial)),
        });
    }
    function activeSpecial(candidate: unknown): candidate is NonNullable<PersistentState['_activeSpecialLevel']> {
        return validSavedActiveSpecialLevel(candidate, entities);
    }
    function helplessReason(candidate: unknown): candidate is string | MonsterHelplessnessReason {
        return string(candidate) || closedFieldsMatch<MonsterHelplessnessReason>(candidate, {
            monsterId: (id): id is number => integer(id) && id >= 0,
            text: string,
        });
    }
    const fields: Fields<PersistentState> = {
        Luck: optional(integer),
        _activeSpecialLevel: optional(nullable(activeSpecial)),
        _armorClassDirty: optional(boolean),
        _artifactDiscoveries: optional(arrayOf(integer)),
        _artifactExists: optional(setOf(integer)),
        _artifactFound: optional(setOf(integer)),
        _artifactRuntime: optional(mapOf(integer, validArtifact)),
        _bonesEncountered: optional(boolean),
        _bonesSaved: optional(boolean),
        _bubbleTraversalUp: optional(boolean),
        _characterPickerUsed: optional(boolean),
        _deathKiller: optional(string),
        _polymorphGenocideCause: optional(oneOf('scroll', 'confusion', 'throne')),
        _digestedMonsterSpecies: optional(nullable((species): species is number =>
            integer(species) && species >= 0 && species < MONSTER_NAME.length)),
        _encounteredObjectTypes: optional(setOf(integer)),
        _encumbranceLevel: optional(integer),
        _farMonsterNoise: optional(boolean),
        _fobjSerial: optional(integer),
        _helplessAfter: optional(nullable(oneOf('end-mimic-meal', 'hear-again', 'unfaint', 'finish-digestion',
            'steal-armor', 'unstolen-armor', 'finish-prayer'))),
        _helplessDoneMessage: optional(nullable(string)),
        _helplessReason: optional(nullable(helplessReason)),
        _helplessTurns: optional(integer),
        _heroActionSeq: optional(integer),
        _heroTrack: optional(arrayOf(validSavedPosition)),
        _initialGoldCount: optional(integer),
        _initialPwBonus: optional(integer),
        _knownObjectTypes: optional(setOf(integer)),
        _lastBoulderPushMove: optional(integer),
        _lastDemigodAggravation: optional(arrayOf(integer)),
        _lastDemigodNasty: optional(arrayOf(integer)),
        _lastInvNr: optional(integer),
        _lastPushedBoulder: optional(entities.object),
        _last_message: string,
        _levelAnnotations: optional(mapOf(string, string)),
        _levelCache: optional(mapOf(string, cachedLevel)),
        _lifeSavedCount: optional(integer),
        _migratingMonsters: optional(arrayOf(entities.monster)),
        _mimicMealMessage: optional(nullable(string)),
        _monsterNoiseTime: optional(integer),
        _moveloopStarted: optional(boolean),
        _nextAttribCheck: optional(integer),
        _nextIdent: optional(integer),
        _nextObjectTimerId: optional(integer),
        _objectCallNames: optional(numericRecordOf(string)),
        _objectDiscoveryOrder: optional(arrayOf(integer)),
        _objectPriceQuotes: optional(numericRecordOf(validPriceQuote)),
        _overviewRecords: optional(mapOf(string, validSavedOverviewRecord)),
        _prayerAlignment: optional(integer),
        _prayerOutcome: optional(oneOf('moloch', 'too-soon', 'angry', 'other-god', 'pleased', 'undead')),
        _prayerTrouble: optional(validPrayerTrouble),
        _preserveLeadingStyledBlanks: optional(boolean),
        _prevDecorType: optional(integer),
        _priestPantheonIndex: optional(integer),
        _questExpulsionPending: optional(nullable((pending): pending is { seal: boolean; portal?: boolean } =>
            closedFieldsMatch(pending, { seal: boolean, portal: optional(boolean) }))),
        _restoredBones: optional(boolean),
        _rndmonstAlignment: optional(nullable(validSavedSpecialLevel)),
        _rndmonstAlignmentMove: optional(integer),
        _runtimeVersionInfoInitialized: optional(boolean),
        _specialLevelPrototype: optional(nullable(string)),
        _startingEffectsApplied: optional(boolean),
        _stethoscopeSeq: optional(integer),
        _tipSwimShown: optional(boolean),
        _travelTipShown: optional(boolean),
        _tributeBookstock: optional(boolean),
        _tutorialActive: optional(boolean),
        _tutorialDeclined: optional(boolean),
        _unresolvedDemigodIntervention: optional(integer),
        _unweapon: optional(boolean),
        aggravateMonster: optional(boolean),
        aggravate_monster: optional(boolean),
        air_level: optional(validSavedSpecialLevel),
        antimagic: optional(boolean),
        astral_level: optional(validSavedSpecialLevel),
        billObjects: optional(arrayOf(entities.object)),
        blind: optional(boolean),
        branches: arrayOf(validSavedDungeonBranch),
        castleTune: optional(string),
        context: (context): context is PersistentState['context'] => validSavedGameContext(context, entities),
        deaf: optional(boolean),
        detectMonsters: optional(boolean),
        discover: optional(boolean),
        displaced: optional(boolean),
        displayName: string,
        dungeons: arrayOf(validSavedDungeon),
        dx: optional(integer),
        dy: optional(integer),
        earth_level: optional(validSavedSpecialLevel),
        fire_level: optional(validSavedSpecialLevel),
        flags: validSavedGameFlags,
        flying: optional(boolean),
        fruitName: optional(string),
        fruits: optional(arrayOf(validFruit)),
        gamelog: optional(arrayOf((entry): entry is { turn: number; text: string } =>
            closedFieldsMatch(entry, { turn: integer, text: string }))),
        in_mk_themerooms: optional(boolean),
        in_mklev: optional(boolean),
        initAlignment: nullable(validSavedAlignment),
        inventory: arrayOf(entities.object),
        invisible: optional(boolean),
        juiblex_level: optional(validSavedSpecialLevel),
        knox_level: optional(validSavedSpecialLevel),
        lastStrTurn: optional(integer),
        level: nullable(map),
        levitating: optional(boolean),
        made_branch: optional(boolean),
        medusa_level: optional(validSavedSpecialLevel),
        migratingObjects: optional(arrayOf(entities.object)),
        mines_dnum: optional(integer),
        moves: integer,
        mvitals: optional(arrayOf(validMonsterVital)),
        name: optional(string),
        nethackrc: string,
        nh_lua_variables: optional(validLuaVariables),
        objectColors: optional(arrayOf(integer)),
        objectDescriptionIndex: optional(arrayOf(integer)),
        objectDescriptions: optional(arrayOf(nullable(string))),
        objectMaterials: optional(arrayOf(integer)),
        objectToughness: optional(arrayOf(integer)),
        oracle_level: optional(validSavedSpecialLevel),
        oracleRemaining: optional((records): records is number[] =>
            arrayOf(integer)(records) && records.length > 0 && records[0] === 0
            && new Set(records).size === records.length
            && records.every(record => record >= 0 && record < ORACLE_TEXT.length)),
        plname: string,
        polymorphControl: optional(boolean),
        preferred_pet: optional(string),
        protectionFromShapeChangers: optional(boolean),
        quest_dnum: optional(integer),
        quest_status: optional(validQuestStatus),
        rndencode: optional(integer),
        rogue_level: optional(validSavedDungeonLocation),
        sanctum_level: optional(validSavedSpecialLevel),
        seer_turn: optional(integer),
        smeq: optional(arrayOf(integer)),
        sokoban_dnum: optional(integer),
        specialLevels: optional(mapOf(string, validSavedSpecialLevel)),
        spells: arrayOf(validSpell),
        splev_align: optional(arrayOf(oneOf('law', 'neutral', 'chaos'))),
        stairs: validSavedStairways,
        stronghold_level: optional(validSavedSpecialLevel),
        symset: optional(nullable(string)),
        targetX: optional(integer),
        targetY: optional(integer),
        tower_dnum: optional(integer),
        tutorial_set_in_config: optional(boolean),
        u: (hero): hero is PersistentState['u'] => validSavedHero(hero, entities),
        uamul: optional(nullable(entities.object)),
        uarm: optional(nullable(entities.object)),
        uarmc: optional(nullable(entities.object)),
        uarmf: optional(nullable(entities.object)),
        uarmg: optional(nullable(entities.object)),
        uarmh: optional(nullable(entities.object)),
        uarms: optional(nullable(entities.object)),
        uarmu: optional(nullable(entities.object)),
        uball: optional(nullable(entities.object)),
        ubirthday: optional(integer),
        ublindf: optional(nullable(entities.object)),
        uchain: optional(nullable(entities.object)),
        udaminc: optional(integer),
        uleft: optional(nullable(entities.object)),
        unchanging: optional(boolean),
        underwater: optional(boolean),
        uquiver: optional(nullable(entities.object)),
        urace: nullable(validSavedRace),
        uright: optional(nullable(entities.object)),
        urole: nullable(validSavedRole),
        uskin: optional(nullable(entities.object)),
        uswallow: optional(integer),
        uswapwep: optional(nullable(entities.object)),
        uwep: optional(nullable(entities.object)),
        valley_level: optional(validSavedSpecialLevel),
        vault_x: optional(integer),
        vault_y: optional(integer),
        wandNothingDirection: optional(integer),
        water_level: optional(validSavedSpecialLevel),
        were_changes: optional(integer),
    };
    if (!closedFieldsMatch<PersistentState>(value, fields, field => {
        throw new TypeError(`Saved state has invalid ${field}`);
    })) return false;
    if (value._helplessAfter === 'finish-digestion' && value._digestedMonsterSpecies == null)
        throw new TypeError('Saved digestion is missing the swallowed monster species');
    return true;
}

function validSpell(value: unknown): value is MemorizedSpell {
    return closedFieldsMatch<MemorizedSpell>(value, {
        name: string, level: integer,
        category: oneOf('attack', 'healing', 'divination', 'enchantment', 'clerical', 'escape', 'matter'),
        know: integer,
        otyp: (type): type is number => integer(type) && OBJECT_SPELL_CATEGORY[type] != null,
    });
}

function validFruit(value: unknown): value is Fruit {
    return closedFieldsMatch<Fruit>(value, { fid: integer, fname: string });
}

function validPriceQuote(value: unknown): value is ObjectPriceQuote {
    return closedFieldsMatch<ObjectPriceQuote>(value, {
        buy: optional(validPriceRange), sell: optional(validPriceRange),
    }) && (value.buy !== undefined || value.sell !== undefined);
}

function validPriceRange(value: unknown): value is ObjectPriceRange {
    return closedFieldsMatch<ObjectPriceRange>(value, {
        min: integer, max: integer,
    }) && value.min >= 0 && value.max >= value.min;
}

function validPrayerTrouble(value: unknown): value is PrayerTrouble {
    return integer(value) && value >= -11 && value <= 14;
}

function validMonsterVital(value: unknown): value is MonsterVital {
    return closedFieldsMatch<MonsterVital>(value, {
        born: integer, died: integer, mvflags: integer,
        seen_close: optional(oneOf(false, true, 0, 1)),
        photographed: optional(oneOf(false, true, 0, 1)),
    });
}

function validQuestStatus(value: unknown): value is QuestStatus {
    return closedFieldsMatch<QuestStatus>(value, {
        first_start: boolean, met_leader: boolean, not_ready: integer,
        pissed_off: boolean, got_quest: boolean, killed_leader: boolean,
        first_locate: boolean, met_intermed: boolean, got_final: boolean,
        made_goal: integer, met_nemesis: boolean, killed_nemesis: boolean,
        in_battle: boolean, cheater: boolean, touched_artifact: boolean,
        offered_artifact: boolean, got_thanks: boolean, ldrgend: integer,
        nemgend: integer, godgend: integer, leader_is_dead: boolean, leader_m_id: integer,
    });
}

function validArtifactTarget(value: unknown): value is ArtifactTarget {
    if (!isSavedRecord(value)) return false;
    if (value.kind === 'flag2')
        return closedFieldsMatch(value, {
            kind: oneOf('flag2'),
            value: oneOf('M2_ELF', 'M2_ORC', 'M2_DEMON', 'M2_WERE', 'M2_GIANT', 'M2_UNDEAD'),
        });
    if (value.kind === 'symbol')
        return closedFieldsMatch(value, {
            kind: oneOf('symbol'), value: oneOf('S_DRAGON', 'S_OGRE', 'S_TROLL'),
        });
    return closedFieldsMatch(value, { kind: oneOf('all', 'resistance', 'alignment') });
}

function validArtifact(value: unknown): value is Artifact {
    const artifactFlag = oneOf(
        'SPFX_NOGEN', 'SPFX_RESTR', 'SPFX_SEEK', 'SPFX_DEFN', 'SPFX_INTEL',
        'SPFX_SEARCH', 'SPFX_ATTK', 'SPFX_DRLI', 'SPFX_WARN', 'SPFX_DFLAG2',
        'SPFX_DCLAS', 'SPFX_REFLECT', 'SPFX_HALRES', 'SPFX_REGEN', 'SPFX_BEHEAD',
        'SPFX_DALIGN', 'SPFX_SPEAK', 'SPFX_XRAY', 'SPFX_PROTECT', 'SPFX_LUCK',
        'SPFX_ESP', 'SPFX_HSPDAM', 'SPFX_STLTH', 'SPFX_TCTRL', 'SPFX_HPHDAM', 'SPFX_EREGEN',
    );
    const defense = nullable(oneOf('life-drain', 'poison', 'magic', 'cold', 'fire', 'lycanthropy', 'blindness'));
    return closedFieldsMatch<Artifact>(value, {
        id: integer, name: string, enumName: string, baseType: integer,
        flags: arrayOf(artifactFlag), carriedFlags: arrayOf(artifactFlag),
        target: validArtifactTarget,
        attack: nullable((attack): attack is NonNullable<Artifact['attack']> =>
            closedFieldsMatch<NonNullable<Artifact['attack']>>(attack, {
                damageType: oneOf('physical', 'life-drain', 'shock', 'stun', 'cold', 'fire'),
                toHitDie: integer, damageDie: integer,
            })),
        defense, carriedDefense: defense,
        invokePower: nullable(oneOf('fling-poison', 'snowstorm', 'firestorm', 'banish',
            'blinding-ray', 'invisibility', 'levitation', 'conflict', 'healing', 'enlightening',
            'energy-boost', 'create-ammo', 'untrap', 'charge-object', 'level-teleport', 'create-portal')),
        alignment: nullable(integer),
        role: nullable(oneOf('archeologist', 'barbarian', 'caveman', 'healer', 'knight',
            'monk', 'priest', 'ranger', 'rogue', 'samurai', 'tourist', 'valkyrie', 'wizard')),
        race: nullable(oneOf('human', 'elf', 'dwarf', 'gnome', 'orc')),
        generationEnchantment: integer, giftValue: integer, cost: integer,
        color: oneOf('NO_COLOR', 'CLR_RED', 'CLR_BRIGHT_BLUE'),
        baseName: string, selfWilled: boolean, restricted: boolean,
        noGeneration: boolean, questArtifact: boolean,
        wieldedProperties: arrayOf(validSavedPropertyName),
    });
}

function validLuaVariables(value: unknown): value is LuaVariables {
    const active = new WeakSet<object>();
    function variable(entry: unknown): entry is LuaSerializedValue {
        if (entry === null || typeof entry === 'boolean' || typeof entry === 'string') return true;
        if (typeof entry === 'number') return Number.isFinite(entry);
        if (typeof entry !== 'object' || active.has(entry)) return false;
        active.add(entry);
        try {
            return Array.isArray(entry) ? arrayOf(variable)(entry)
                : isSavedRecord(entry) && Object.values(entry).every(variable);
        } finally {
            active.delete(entry);
        }
    }
    return isSavedRecord(value) && Object.values(value).every(variable);
}
