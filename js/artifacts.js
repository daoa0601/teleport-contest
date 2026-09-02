// artifacts.js — Named artifact identity, existence, and hero-touch policy.
// C refs: artifact.c artifact_name()/artifact_exists()/touch_artifact() and
// include/artilist.h.  Keep artifact identity separate from the base object:
// readobjnam() first resolves the artifact to an object type, mksobj() builds
// that ordinary object, and oname() then commits the named artifact.

import { ARTIFACT_DATA } from './artifact_data.js';
import { game } from './gstate.js';
import { d, rnd, rn2 } from './rng.js';
import {
    OBJECT_MATERIAL, OBJECT_NAMES,
} from './object_data.js';
import {
    MONSTER_ALIGNMENT, MONSTER_FLAGS2, MONSTER_SYMBOL,
} from './monster_data.js';
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
const QUEST_ARTIFACT_NAMES = new Set(
    roles.map(role => role.artifactName).filter(Boolean),
);

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

export const ARTIFACTS = ARTIFACT_DATA.map(artifact => ({
    ...artifact,
    baseName: OBJECT_NAMES[artifact.baseType],
    selfWilled: artifact.flags.includes('SPFX_INTEL'),
    restricted: artifact.flags.includes('SPFX_RESTR'),
    noGeneration: artifact.flags.includes('SPFX_NOGEN'),
    questArtifact: QUEST_ARTIFACT_NAMES.has(artifact.name),
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

export function artifactExistCount() {
    return game._artifactExistCount ?? existenceSet().size;
}

function physicalAttackApplies(artifact, defender, hero = false) {
    const attack = artifact?.attack;
    if (!defender || attack?.damageType !== 'physical') return false;

    const mnum = defender.mnum;
    switch (attack.target.kind) {
    case 'all':
        return true;
    case 'flag2': {
        const flag = FLAG2_TARGETS[attack.target.value] ?? 0;
        return !!((MONSTER_FLAGS2[mnum] ?? 0) & flag)
            || (hero && attack.target.value === 'M2_WERE'
                && Number.isInteger(game.u?.ulycn) && game.u.ulycn >= 0);
    }
    case 'symbol':
        return MONSTER_SYMBOL[mnum]
            === SYMBOL_TARGETS[attack.target.value];
    case 'alignment': {
        const alignment = hero ? game.u?.ualign?.type
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
export function artifactToHitBonus(object, defender, roll = rnd) {
    const artifact = artifactById(object?.oartifact);
    if (!physicalAttackApplies(artifact, defender)
        || !(artifact.attack.toHitDie > 0)) return 0;
    return roll(artifact.attack.toHitDie);
}

// C artifact.c:artifact_hit() -> spec_dbon().  A zero damage die means "add
// the current weapon damage again", not zero bonus.  Strength and ring damage
// are added later by hmon_hitmon_dmg_recalc(), so callers pass only dmgval().
export function artifactDamageBonus(
    object, defender, baseWeaponDamage, roll = rnd,
) {
    const artifact = artifactById(object?.oartifact);
    const applies = artifact?.name === 'Grimtooth'
        || physicalAttackApplies(artifact, defender);
    if (!applies || artifact.attack.damageType !== 'physical') return 0;
    return artifact.attack.damageDie > 0
        ? roll(artifact.attack.damageDie)
        : Math.max(baseWeaponDamage, 1);
}

export function artifactDoublesWeaponDamage(object, defender) {
    const artifact = artifactById(object?.oartifact);
    return physicalAttackApplies(artifact, defender)
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
    return physicalAttackApplies(
        artifact, { mnum: heroSpecies(game) }, true,
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
