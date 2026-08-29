// artifacts.js — Named artifact identity, existence, and hero-touch policy.
// C refs: artifact.c artifact_name()/artifact_exists()/touch_artifact() and
// include/artilist.h.  Keep artifact identity separate from the base object:
// readobjnam() first resolves the artifact to an object type, mksobj() builds
// that ordinary object, and oname() then commits the named artifact.

import { game } from './gstate.js';
import { d, rnd, rn2 } from './rng.js';
import { OBJECT_NAMES } from './object_data.js';

const RAW_ARTIFACTS = [
    ['Excalibur', 'long sword', 1, 'knight', true, true, null],
    ['Stormbringer', 'runesword', -1, null, true, false, null],
    ['Mjollnir', 'war hammer', 0, 'valkyrie', false, false, null],
    ['Cleaver', 'battle-axe', 0, 'barbarian', false, false, null],
    ['Grimtooth', 'orcish dagger', -1, null, false, false, 'fling-poison'],
    ['Orcrist', 'elven broadsword', -1, null, false, false, null],
    ['Sting', 'elven dagger', -1, null, false, false, null],
    ['Magicbane', 'athame', 0, 'wizard', false, false, null],
    ['Frost Brand', 'long sword', null, null, false, false, 'snowstorm'],
    ['Fire Brand', 'long sword', null, null, false, false, 'firestorm'],
    ['Dragonbane', 'broadsword', null, null, false, false, null],
    ['Demonbane', 'silver mace', 1, 'priest', false, false, 'banish'],
    ['Werebane', 'silver saber', null, null, false, false, null],
    ['Grayswandir', 'silver saber', 1, null, false, false, null],
    ['Giantslayer', 'long sword', 0, null, false, false, null],
    ['Ogresmasher', 'war hammer', null, null, false, false, null],
    ['Trollsbane', 'morning star', null, null, false, false, null],
    ['Vorpal Blade', 'long sword', 0, null, false, false, null],
    ['Snickersnee', 'katana', 1, 'samurai', false, false, null],
    ['Sunsword', 'long sword', 1, null, false, false, 'blinding-ray'],
    [
        'The Orb of Detection', 'crystal ball', 1, 'archeologist', true, true,
        'invisibility',
    ],
    [
        'The Heart of Ahriman', 'luckstone', 0, 'barbarian', true, true,
        'levitation',
    ],
    [
        'The Sceptre of Might', 'mace', 1, 'caveman', true, true,
        'conflict',
    ],
    // The Palantir remains inside artilist.h's historical #if 0 block and is
    // not part of NetHack 5.0's artifact enum or runtime table.
    [
        'The Staff of Aesculapius', 'quarterstaff', 0, 'healer', true, true,
        'healing',
    ],
    [
        'The Magic Mirror of Merlin', 'mirror', 1, 'knight', true, true, null,
    ],
    [
        'The Eyes of the Overworld', 'lenses', 0, 'monk', true, true,
        'enlightening',
    ],
    [
        'The Mitre of Holiness', 'helm of brilliance', 1, 'priest', true,
        true, 'energy-boost',
    ],
    [
        'The Longbow of Diana', 'bow', -1, 'ranger', true, true,
        'create-ammo',
    ],
    [
        'The Master Key of Thievery', 'skeleton key', -1, 'rogue', true,
        true, 'untrap',
    ],
    [
        'The Tsurugi of Muramasa', 'tsurugi', 1, 'samurai', true, true, null,
    ],
    [
        'The Platinum Yendorian Express Card', 'credit card', 0, 'tourist',
        true, true, 'charge-object',
    ],
    [
        'The Orb of Fate', 'crystal ball', 0, 'valkyrie', true, true,
        'level-teleport',
    ],
    [
        'The Eye of the Aethiopica', 'amulet of ESP', 0, 'wizard', true,
        true, 'create-portal',
    ],
];

// C include/artilist.h attack fields.  Keep attack behavior on the artifact
// identity rather than on silver saber: ordinary and named sabers share the
// base weapon die, but only Grayswandir receives PHYS(5, 0).  Profiles are
// added here as their spec_applies() target predicates are ported; treating an
// unsupported artifact as ordinary is safer than silently applying its bonus
// to the wrong monster class or resistance.
const SUPPORTED_ATTACK_PROFILES = new Map([
    ['Grayswandir', {
        damageType: 'physical',
        toHitDie: 5,
        damageDie: 0,
        targetPredicate: 'all',
    }],
]);

// C include/artilist.h `spfx` capabilities which apply while the artifact is
// wielded.  Keep these distinct from attack and carried-property profiles:
// set_artifact_intrinsic() installs them under the weapon equipment mask.
const SUPPORTED_WIELDED_PROPERTIES = new Map([
    ['Grayswandir', ['hallucinationResistance']],
]);

function fuzzyArtifactName(value) {
    return String(value || '')
        .trim()
        .replace(/^the\s+/i, '')
        .replace(/[\s-]+/g, '')
        .toLowerCase();
}

export const ARTIFACTS = RAW_ARTIFACTS.map((
    [
        name, baseName, alignment, role, selfWilled, noGeneration,
        invokePower,
    ], index,
) => ({
    id: index + 1,
    name,
    baseName,
    baseType: OBJECT_NAMES.findIndex(candidate => candidate === baseName),
    alignment,
    role,
    selfWilled,
    // Orcrist and Sting are the two artilist.h entries without SPFX_RESTR.
    // Alignment is still metadata on them, but it must not trigger the
    // hero-touch alignment probe.
    restricted: name !== 'Orcrist' && name !== 'Sting',
    noGeneration,
    invokePower,
    attack: SUPPORTED_ATTACK_PROFILES.get(name) || null,
    wieldedProperties: SUPPORTED_WIELDED_PROPERTIES.get(name) || [],
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
        attack: artifact.attack ? { ...artifact.attack } : null,
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
    object.age = 0;
    object.quan = 1;
    object.quantity = 1;
    return true;
}

export function artifactExistCount() {
    return game._artifactExistCount ?? existenceSet().size;
}

// C artifact.c:spec_applies().  Grayswandir has neither SPFX_DBONUS nor
// SPFX_ATTK, so its physical profile applies to every defender.
function supportedAttackApplies(artifact, defender) {
    return !!defender
        && artifact?.attack?.damageType === 'physical'
        && artifact.attack.targetPredicate === 'all';
}

// C weapon.c:hitval() -> artifact.c:spec_abon().  This call belongs before
// hitum()'s ordinary d20, which is observable in the contest RNG transcript.
export function artifactToHitBonus(object, defender, roll = rnd) {
    const artifact = artifactById(object?.oartifact);
    if (!supportedAttackApplies(artifact, defender)
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
    if (!supportedAttackApplies(artifact, defender)) return 0;
    return artifact.attack.damageDie > 0
        ? roll(artifact.attack.damageDie)
        : Math.max(baseWeaponDamage, 1);
}

// C artifact.c:touch_artifact() hero branch.  The current block needs the
// alignment refusal probe even when it does not blast; retain the complete
// common damage/exercise transaction so future artifact wishes do not need a
// second owner.
export function touchArtifactByHero(object, artifact) {
    if (!object?.oartifact || !artifact) return { allowed: true, blasted: false };
    const heroRole = game.urole?.key || null;
    const heroAlignment = game.u?.ualign?.type ?? 0;
    const alignmentRecord = game.u?.ualign?.record ?? 0;
    const badClass = artifact.selfWilled
        && !!artifact.role && artifact.role !== heroRole;
    const badAlignment = artifact.restricted
        && artifact.alignment !== null
        && (artifact.alignment !== heroAlignment || alignmentRecord < 0);

    let blasted = false;
    if (((badClass || badAlignment) && artifact.selfWilled)
        || (badAlignment && rn2(4) === 0)) {
        blasted = true;
        const antimagic = !!(game.u?.antimagic || game.antimagic);
        const damage = d(antimagic ? 2 : 4, 4);
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - damage);
        if (!Array.isArray(game.u._exercise))
            game.u._exercise = Array(6).fill(0);
        game.u._exercise[4] -= rn2(2);
    }

    return {
        allowed: !(badClass && badAlignment && artifact.selfWilled),
        blasted,
        badClass,
        badAlignment,
    };
}
