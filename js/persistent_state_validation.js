import { SAVE_VERSION } from './state_schema.js';
import { decodeSavedGraph, isSavedRecord } from './saved_graph.js';
import { arrayOf, boolean, closedFieldsMatch, integer, mapOf, nullable, numericRecordOf, oneOf, optional, setOf, string, } from './saved_validation.js';
import { createSavedEntityChecks } from './entity_validation.js';
import { OBJECT_SPELL_CATEGORY } from './object_data.js';
import { ORACLE_TEXT } from './oracle_data.js';
import { validSavedHero, validSavedPropertyName } from './hero_validation.js';
import { validSavedAlignment, validSavedGameFlags, validSavedRace, validSavedRole, } from './character_validation.js';
import { restoreSavedMap, validSavedDungeonLocation, validSavedPosition, validSavedStairways, } from './map_validation.js';
import { validSavedActiveSpecialLevel, validSavedDungeon, validSavedDungeonBranch, validSavedGameContext, validSavedOverviewRecord, validSavedSpecialLevel, } from './state_domain_validation.js';
export function decodeSavedGame(encoded) {
    const snapshot = decodeSavedGraph(encoded);
    const entities = createSavedEntityChecks();
    if (!closedFieldsMatch(snapshot, {
        version: oneOf(SAVE_VERSION),
        state: (value) => validPersistentState(value, entities),
    }, field => { throw new TypeError(`Saved game has invalid ${field}`); }))
        throw new TypeError('Saved game must be a versioned state record');
    return snapshot;
}
function validPersistentState(value, entities) {
    function map(candidate) {
        restoreSavedMap(candidate, entities);
        return true;
    }
    function cachedLevel(candidate) {
        return closedFieldsMatch(candidate, {
            level: map,
            stairs: validSavedStairways,
            heroTrack: optional(arrayOf(validSavedPosition)),
            savedAt: integer,
            activeSpecialLevel: optional(nullable(activeSpecial)),
        });
    }
    function activeSpecial(candidate) {
        return validSavedActiveSpecialLevel(candidate, entities);
    }
    const fields = {
        Luck: optional(integer),
        _activeSpecialLevel: optional(nullable(activeSpecial)),
        _armorClassDirty: optional(boolean),
        _artifactDiscoveries: optional(arrayOf(integer)),
        _artifactExists: optional(setOf(integer)),
        _artifactFound: optional(setOf(integer)),
        _artifactRuntime: optional(mapOf(integer, validArtifact)),
        _bonesEncountered: optional(boolean),
        _deathKiller: optional(string),
        _polymorphGenocideCause: optional(oneOf('scroll', 'confusion', 'throne')),
        _encounteredObjectTypes: optional(setOf(integer)),
        _fobjSerial: optional(integer),
        _heroTrack: optional(arrayOf(validSavedPosition)),
        _initialGoldCount: optional(integer),
        _knownObjectTypes: optional(setOf(integer)),
        _last_message: string,
        _levelAnnotations: optional(mapOf(string, string)),
        _levelCache: optional(mapOf(string, cachedLevel)),
        _lifeSavedCount: optional(integer),
        _migratingMonsters: optional(arrayOf(entities.monster)),
        _nextAttribCheck: optional(integer),
        _nextIdent: optional(integer),
        _nextObjectTimerId: optional(integer),
        _objectCallNames: optional(numericRecordOf(string)),
        _objectDiscoveryOrder: optional(arrayOf(integer)),
        _objectPriceQuotes: optional(numericRecordOf(validPriceQuote)),
        _overviewRecords: optional(mapOf(string, validSavedOverviewRecord)),
        _priestPantheonIndex: optional(integer),
        _questExpulsionPending: optional(nullable((pending) => closedFieldsMatch(pending, { seal: boolean, portal: optional(boolean) }))),
        _stethoscopeSeq: optional(integer),
        _tipSwimShown: optional(boolean),
        _travelTipShown: optional(boolean),
        _tributeBookstock: optional(boolean),
        _tutorialActive: optional(boolean),
        aggravateMonster: optional(boolean),
        aggravate_monster: optional(boolean),
        air_level: optional(validSavedSpecialLevel),
        antimagic: optional(boolean),
        astral_level: optional(validSavedSpecialLevel),
        billObjects: optional(arrayOf(entities.object)),
        blind: optional(boolean),
        branches: arrayOf(validSavedDungeonBranch),
        castleTune: optional(string),
        context: (context) => validSavedGameContext(context, entities),
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
        gamelog: optional(arrayOf((entry) => closedFieldsMatch(entry, { turn: integer, text: string }))),
        initAlignment: nullable(validSavedAlignment),
        inventory: arrayOf(entities.object),
        invisible: optional(boolean),
        juiblex_level: optional(validSavedSpecialLevel),
        knox_level: optional(validSavedSpecialLevel),
        lastStrTurn: optional(integer),
        level: nullable(map),
        levitating: optional(boolean),
        medusa_level: optional(validSavedSpecialLevel),
        migratingObjects: optional(arrayOf(entities.object)),
        mines_dnum: optional(integer),
        moves: integer,
        mvitals: optional(arrayOf(validMonsterVital)),
        name: optional(string),
        nh_lua_variables: optional(validLuaVariables),
        objectColors: optional(arrayOf(integer)),
        objectDescriptionIndex: optional(arrayOf(integer)),
        objectDescriptions: optional(arrayOf(nullable(string))),
        objectMaterials: optional(arrayOf(integer)),
        objectToughness: optional(arrayOf(integer)),
        oracle_level: optional(validSavedSpecialLevel),
        oracleRemaining: optional((records) => arrayOf(integer)(records) && records.length > 0 && records[0] === 0
            && new Set(records).size === records.length
            && records.every(record => record >= 0 && record < ORACLE_TEXT.length)),
        plname: string,
        polymorphControl: optional(boolean),
        protectionFromShapeChangers: optional(boolean),
        quest_dnum: optional(integer),
        quest_status: optional(validQuestStatus),
        rndencode: optional(integer),
        rogue_level: optional(validSavedDungeonLocation),
        sanctum_level: optional(validSavedSpecialLevel),
        seer_turn: optional(integer),
        sokoban_dnum: optional(integer),
        specialLevels: optional(mapOf(string, validSavedSpecialLevel)),
        spells: arrayOf(validSpell),
        stairs: validSavedStairways,
        stronghold_level: optional(validSavedSpecialLevel),
        tower_dnum: optional(integer),
        u: (hero) => validSavedHero(hero, entities),
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
        wandNothingDirection: optional(integer),
        water_level: optional(validSavedSpecialLevel),
    };
    if (!closedFieldsMatch(value, fields, field => {
        throw new TypeError(`Saved state has invalid ${field}`);
    }))
        return false;
    return true;
}
function validSpell(value) {
    return closedFieldsMatch(value, {
        name: string, level: integer,
        category: oneOf('attack', 'healing', 'divination', 'enchantment', 'clerical', 'escape', 'matter'),
        know: integer,
        otyp: (type) => integer(type) && OBJECT_SPELL_CATEGORY[type] != null,
    });
}
function validFruit(value) {
    return closedFieldsMatch(value, { fid: integer, fname: string });
}
function validPriceQuote(value) {
    return closedFieldsMatch(value, {
        buy: optional(validPriceRange), sell: optional(validPriceRange),
    }) && (value.buy !== undefined || value.sell !== undefined);
}
function validPriceRange(value) {
    return closedFieldsMatch(value, {
        min: integer, max: integer,
    }) && value.min >= 0 && value.max >= value.min;
}
function validMonsterVital(value) {
    return closedFieldsMatch(value, {
        born: integer, died: integer, mvflags: integer,
        seen_close: optional(oneOf(false, true, 0, 1)),
        photographed: optional(oneOf(false, true, 0, 1)),
    });
}
function validQuestStatus(value) {
    return closedFieldsMatch(value, {
        first_start: boolean, met_leader: boolean, not_ready: integer,
        pissed_off: boolean, got_quest: boolean, killed_leader: boolean,
        first_locate: boolean, met_intermed: boolean, got_final: boolean,
        made_goal: integer, met_nemesis: boolean, killed_nemesis: boolean,
        in_battle: boolean, cheater: boolean, touched_artifact: boolean,
        offered_artifact: boolean, got_thanks: boolean, ldrgend: integer,
        nemgend: integer, godgend: integer, leader_is_dead: boolean, leader_m_id: integer,
    });
}
function validArtifactTarget(value) {
    if (!isSavedRecord(value))
        return false;
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
function validArtifact(value) {
    const artifactFlag = oneOf('SPFX_NOGEN', 'SPFX_RESTR', 'SPFX_SEEK', 'SPFX_DEFN', 'SPFX_INTEL', 'SPFX_SEARCH', 'SPFX_ATTK', 'SPFX_DRLI', 'SPFX_WARN', 'SPFX_DFLAG2', 'SPFX_DCLAS', 'SPFX_REFLECT', 'SPFX_HALRES', 'SPFX_REGEN', 'SPFX_BEHEAD', 'SPFX_DALIGN', 'SPFX_SPEAK', 'SPFX_XRAY', 'SPFX_PROTECT', 'SPFX_LUCK', 'SPFX_ESP', 'SPFX_HSPDAM', 'SPFX_STLTH', 'SPFX_TCTRL', 'SPFX_HPHDAM', 'SPFX_EREGEN');
    const defense = nullable(oneOf('life-drain', 'poison', 'magic', 'cold', 'fire', 'lycanthropy', 'blindness'));
    return closedFieldsMatch(value, {
        id: integer, name: string, enumName: string, baseType: integer,
        flags: arrayOf(artifactFlag), carriedFlags: arrayOf(artifactFlag),
        target: validArtifactTarget,
        attack: nullable((attack) => closedFieldsMatch(attack, {
            damageType: oneOf('physical', 'life-drain', 'shock', 'stun', 'cold', 'fire'),
            toHitDie: integer, damageDie: integer,
        })),
        defense, carriedDefense: defense,
        invokePower: nullable(oneOf('fling-poison', 'snowstorm', 'firestorm', 'banish', 'blinding-ray', 'invisibility', 'levitation', 'conflict', 'healing', 'enlightening', 'energy-boost', 'create-ammo', 'untrap', 'charge-object', 'level-teleport', 'create-portal')),
        alignment: nullable(integer),
        role: nullable(oneOf('archeologist', 'barbarian', 'caveman', 'healer', 'knight', 'monk', 'priest', 'ranger', 'rogue', 'samurai', 'tourist', 'valkyrie', 'wizard')),
        race: nullable(oneOf('human', 'elf', 'dwarf', 'gnome', 'orc')),
        generationEnchantment: integer, giftValue: integer, cost: integer,
        color: oneOf('NO_COLOR', 'CLR_RED', 'CLR_BRIGHT_BLUE'),
        baseName: string, selfWilled: boolean, restricted: boolean,
        noGeneration: boolean, questArtifact: boolean,
        wieldedProperties: arrayOf(validSavedPropertyName),
    });
}
function validLuaVariables(value) {
    const active = new WeakSet();
    function variable(entry) {
        if (entry === null || typeof entry === 'boolean' || typeof entry === 'string')
            return true;
        if (typeof entry === 'number')
            return Number.isFinite(entry);
        if (typeof entry !== 'object' || active.has(entry))
            return false;
        active.add(entry);
        try {
            return Array.isArray(entry) ? arrayOf(variable)(entry)
                : isSavedRecord(entry) && Object.values(entry).every(variable);
        }
        finally {
            active.delete(entry);
        }
    }
    return isSavedRecord(value) && Object.values(value).every(variable);
}
//# sourceMappingURL=persistent_state_validation.js.map