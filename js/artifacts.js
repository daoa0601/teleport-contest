// artifacts.js — Named artifact identity, existence, and hero-touch policy.
// C refs: artifact.c artifact_name()/artifact_exists()/touch_artifact() and
// include/artilist.h.  Keep artifact identity separate from the base object:
// readobjnam() first resolves the artifact to an object type, mksobj() builds
// that ordinary object, and oname() then commits the named artifact.

import { ARTIFACT_DATA } from './artifact_data.js';
import { heroHasDrainResistance } from './armor.js';
import { game } from './gstate.js';
import { d, rnd, rn2 } from './rng.js';
import {
    OBJECT_MATERIAL, OBJECT_NAMES,
} from './object_data.js';
import {
    MONSTER_ALIGNMENT, MONSTER_FLAGS2, MONSTER_MAGIC_RESISTANCE,
    MONSTER_SYMBOL,
} from './monster_data.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import {
    monsterHasColdResistance, monsterHasDrainResistance,
    monsterHasFireResistance, monsterHasShockResistance,
} from './monster_resistance.js';
import { heroHatesSilver, heroSpecies } from './hero_species.js';
import { roles } from './roles.js';

const M2_UNDEAD = 0x00000002;
const M2_WERE = 0x00000004;
const M2_ELF = 0x00000010;
const M2_ORC = 0x00000080;
const M2_DEMON = 0x00000100;
const M2_GIANT = 0x00002000;
const S_DRAGON = 30;
const S_OGRE = 41;
const S_TROLL = 46;
const SILVER = 14;
const FLAG2_TARGETS = {
    M2_UNDEAD,
    M2_WERE,
    M2_ELF,
    M2_ORC,
    M2_DEMON,
    M2_GIANT,
};
const SYMBOL_TARGETS = {
    S_DRAGON,
    S_OGRE,
    S_TROLL,
};
function wieldedProperties(artifact) {
    return artifact.flags.includes('SPFX_HALRES')
        ? ['hallucinationResistance'] : [];
}

function fuzzyArtifactName(value) {
    return String(value || '')
        .trim()
        .replace(/^the\s+/i, '')
        .replace(/[\s-]+/g, '')
        .toLowerCase();
}

const QUEST_ARTIFACT_NAMES = new Set(
    roles.map(role => fuzzyArtifactName(role.artifactName)).filter(Boolean),
);

export const ARTIFACTS = ARTIFACT_DATA.map(artifact => ({
    ...artifact,
    baseName: OBJECT_NAMES[artifact.baseType],
    selfWilled: artifact.flags.includes('SPFX_INTEL'),
    restricted: artifact.flags.includes('SPFX_RESTR'),
    noGeneration: artifact.flags.includes('SPFX_NOGEN'),
    questArtifact: QUEST_ARTIFACT_NAMES.has(fuzzyArtifactName(artifact.name)),
    wieldedProperties: wieldedProperties(artifact),
}));

function artifactList(state = game) {
    return state._artifactRuntime instanceof Map
        ? [...state._artifactRuntime.values()] : ARTIFACTS;
}

export function artifactByName(value, state = game) {
    const wanted = fuzzyArtifactName(value);
    return artifactList(state).find(artifact =>
        fuzzyArtifactName(artifact.name) === wanted) || null;
}

export function artifactById(id, state = game) {
    if (state._artifactRuntime instanceof Map)
        return state._artifactRuntime.get(id) || null;
    return ARTIFACTS.find(artifact => artifact.id === id) || null;
}

// C artifact.c:init_artifacts()/hack_artifacts().  The static artilist is
// copied per game because selected role/alignment can retarget gift and quest
// artifacts.  Existence/discovery state is new-game state, not module state.
export function initializeArtifacts(state = game) {
    const role = state.urole?.key || null;
    const alignment = state.initAlignment?.value ?? 0;
    const runtime = new Map(ARTIFACTS.map(artifact => [artifact.id, {
        ...artifact,
        flags: [...artifact.flags],
        carriedFlags: [...artifact.carriedFlags],
        attack: artifact.attack ? {
            ...artifact.attack,
            target: { ...artifact.attack.target },
        } : null,
        wieldedProperties: [...artifact.wieldedProperties],
    }]));

    for (const artifact of runtime.values()) {
        if (artifact.role === role && artifact.alignment !== null)
            artifact.alignment = alignment;
    }
    const excalibur = [...runtime.values()].find(artifact =>
        artifact.name === 'Excalibur');
    if (excalibur && role !== 'knight') excalibur.role = null;

    const questName = state.urole?.artifactName;
    const questArtifact = questName
        ? [...runtime.values()].find(artifact =>
            fuzzyArtifactName(artifact.name) === fuzzyArtifactName(questName))
        : null;
    if (questArtifact) {
        questArtifact.alignment = alignment;
        questArtifact.role = role;
    }

    state._artifactRuntime = runtime;
    state._artifactExists = new Set();
    state._artifactDiscoveries = [];
    state._artifactExistByBase = new Map();
    state._artifactExistCount = 0;
    return runtime;
}

function existenceSet() {
    if (!(game._artifactExists instanceof Set))
        game._artifactExists = new Set();
    return game._artifactExists;
}

// C artifact.c:artifact_exists().  The caller has already created the base
// object.  Naming commits both the object's identity and the global existence
// bit; later random-artifact ranges consume the shared count.
export function nameArtifact(object, artifact) {
    if (!object || !artifact) return false;
    const exists = existenceSet();
    if (exists.has(artifact.id)) return false;
    exists.add(artifact.id);
    game._artifactExistCount = (game._artifactExistCount ?? 0) + 1;
    object.artifact = true;
    object.oartifact = artifact.id;
    object.oextra = {
        ...(object.oextra || {}),
        oname: artifact.name,
    };
    if (artifact.invokePower === 'fling-poison') object.opoisoned = 1;
    object.age = 0;
    object.quan = 1;
    object.quantity = 1;
    return true;
}

export function uncreateArtifact(object, state = game) {
    if (!object?.artifact && !object?.oartifact) return false;

    let removed = false;
    if (object.oartifact) {
        if (state._artifactExists instanceof Set)
            removed = state._artifactExists.delete(object.oartifact);
    } else {
        const generatedByBase = state._artifactExistByBase;
        const count = generatedByBase?.get(object.otyp) ?? 0;
        if (count > 0) {
            if (count === 1) generatedByBase.delete(object.otyp);
            else generatedByBase.set(object.otyp, count - 1);
            removed = true;
        }
    }

    if (removed) {
        state._artifactExistCount = Math.max(
            0, (state._artifactExistCount ?? 0) - 1,
        );
    }
    object.artifact = false;
    object.oartifact = 0;
    return removed;
}

export function artifactExistCount() {
    return game._artifactExistCount ?? existenceSet().size;
}

function defendedByArtifact(artifact, damageType) {
    return artifact?.defense === damageType;
}

function carriedArtifactDefends(inventory, damageType, state) {
    return (inventory || []).some(object =>
        artifactById(object?.oartifact, state)?.carriedDefense === damageType);
}

function artifactDefenseApplies(defender, damageType, hero, state) {
    const weapon = hero
        ? state.uwep || state.u?.uwep
        : monsterWieldedWeapon(defender);
    if (defendedByArtifact(
        artifactById(weapon?.oartifact, state), damageType,
    )) {
        return true;
    }
    const inventory = hero
        ? state.inventory
        : defender.minvent || defender.inventory;
    return carriedArtifactDefends(inventory, damageType, state);
}

export function heroHasArtifactDefense(damageType, state = game) {
    return artifactDefenseApplies(state.u, damageType, true, state);
}

export function heroHasCarriedArtifactFlag(flag, state = game) {
    return (state.inventory || []).some(object =>
        artifactById(object?.oartifact, state)?.carriedFlags.includes(flag));
}

function resistanceAttackApplies(
    artifact, defender, { hero, random, state },
) {
    const damageType = artifact.attack.damageType;
    if (artifactDefenseApplies(defender, damageType, hero, state))
        return false;
    if (hero) {
        const heroState = state.u || {};
        const currentForm = { mnum: heroSpecies(state) };
        if (damageType === 'fire')
            return !(heroState.fireResistance || heroState.fire_resistance
                || monsterHasFireResistance(currentForm));
        if (damageType === 'cold')
            return !(heroState.coldResistance || heroState.cold_resistance
                || monsterHasColdResistance(currentForm));
        if (damageType === 'shock')
            return !(heroState.shockResistance || heroState.shock_resistance
                || monsterHasShockResistance(currentForm));
        if (damageType === 'life-drain')
            return !(heroHasDrainResistance(state)
                || monsterHasDrainResistance(currentForm)
                || (Number.isInteger(heroState.ulycn)
                    && heroState.ulycn >= 0));
        if (damageType === 'stun') return !heroState.antimagic;
        return false;
    }
    if (damageType === 'fire') return !monsterHasFireResistance(defender);
    if (damageType === 'cold') return !monsterHasColdResistance(defender);
    if (damageType === 'shock') return !monsterHasShockResistance(defender);
    if (damageType === 'life-drain')
        return !monsterHasDrainResistance(defender);
    if (damageType === 'stun') {
        if (defender.antimagic || defender.resistsMagic) return false;
        const resistance = MONSTER_MAGIC_RESISTANCE[defender.mnum] ?? 0;
        return random(100) >= resistance;
    }
    return false;
}

function artifactAttackApplies(
    artifact,
    defender,
    { hero = false, random = rn2, state = game } = {},
) {
    const attack = artifact?.attack;
    if (!defender || !attack) return false;

    if (attack.target.kind === 'resistance') {
        return resistanceAttackApplies(
            artifact, defender, { hero, random, state },
        );
    }

    const mnum = defender.mnum;
    switch (attack.target.kind) {
    case 'all':
        return true;
    case 'flag2': {
        const flag = FLAG2_TARGETS[attack.target.value] ?? 0;
        return !!((MONSTER_FLAGS2[mnum] ?? 0) & flag)
            || (hero && attack.target.value === 'M2_WERE'
                && Number.isInteger(state.u?.ulycn) && state.u.ulycn >= 0);
    }
    case 'symbol':
        return MONSTER_SYMBOL[mnum]
            === SYMBOL_TARGETS[attack.target.value];
    case 'alignment': {
        const alignment = hero ? state.u?.ualign?.type
            : defender.maligntyp ?? MONSTER_ALIGNMENT[mnum];
        if (hero) return alignment !== artifact.alignment;
        return alignment === -128
            || Math.sign(alignment) !== artifact.alignment;
    }
    default:
        return false;
    }
}

// C weapon.c:hitval() calls spec_abon() before hitum() rolls its ordinary d20.
export function artifactToHitBonus(
    object, defender, roll = rnd, { random = rn2, state = game } = {},
) {
    const artifact = artifactById(object?.oartifact, state);
    if (!artifactAttackApplies(artifact, defender, { random, state })
        || !(artifact.attack.toHitDie > 0)) return 0;
    return roll(artifact.attack.toHitDie);
}

// C artifact.c:artifact_hit() -> spec_dbon().  A zero damage die means "add
// the current weapon damage again", not zero bonus.  Strength and ring damage
// are added later by hmon_hitmon_dmg_recalc(), so callers pass only dmgval().
export function artifactDamageBonus(
    object, defender, baseWeaponDamage, roll = rnd,
    { random = rn2, state = game } = {},
) {
    const artifact = artifactById(object?.oartifact, state);
    const applies = artifact?.name === 'Grimtooth'
        || artifactAttackApplies(artifact, defender, { random, state });
    if (!applies) return 0;
    return artifact.attack.damageDie > 0
        ? roll(artifact.attack.damageDie)
        : Math.max(baseWeaponDamage, 1);
}

export function artifactDoublesWeaponDamage(
    object, defender, { random = rn2, state = game } = {},
) {
    const artifact = artifactById(object?.oartifact, state);
    return artifactAttackApplies(artifact, defender, { random, state })
        && artifact.attack.damageDie === 0;
}

export function artifactEmitsLight(object) {
    return artifactById(object?.oartifact)?.name === 'Sunsword';
}

export function artifactStrikesShade(object) {
    return artifactById(object?.oartifact)?.name === 'Sunsword';
}

function artifactBaneApplies(artifact) {
    if (!['flag2', 'symbol', 'alignment']
        .includes(artifact?.attack?.target?.kind)) return false;
    return artifactAttackApplies(
        artifact, { mnum: heroSpecies(game) }, { hero: true },
    );
}

// C artifact.c:touch_artifact() hero branch up to its blast message.
export function resolveHeroArtifactTouch(object, artifact) {
    if (!object?.oartifact || !artifact) {
        return { allowed: true, blasted: false };
    }
    const heroRole = game.urole?.key || null;
    const heroAlignment = game.u?.ualign?.type ?? 0;
    const alignmentRecord = game.u?.ualign?.record ?? 0;
    const badClass = artifact.selfWilled
        && !!artifact.role && artifact.role !== heroRole;
    let badAlignment = artifact.restricted
        && artifact.alignment !== null
        && (artifact.alignment !== heroAlignment || alignmentRecord < 0);
    if (!badAlignment) badAlignment = artifactBaneApplies(artifact);

    let blasted = false;
    if (((badClass || badAlignment) && artifact.selfWilled)
        || (badAlignment && rn2(4) === 0)) {
        blasted = true;
    }

    return {
        allowed: !(badClass && badAlignment && artifact.selfWilled),
        blasted,
        badClass,
        badAlignment,
    };
}

export function applyHeroArtifactBlast(object, artifact) {
    const antimagic = !!game.u?.antimagic;
    let damage = d(antimagic ? 2 : 4, artifact.selfWilled ? 10 : 4);
    if (OBJECT_MATERIAL[object.otyp] === SILVER && heroHatesSilver(game)) {
        let silverDamage = rnd(10);
        if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
            silverDamage = Math.trunc((silverDamage + 1) / 2);
        damage += silverDamage;
    }
    game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - damage);
    return damage;
}
