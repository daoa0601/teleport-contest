// artifacts.js — Named artifact identity, existence, and hero-touch policy.
// C refs: artifact.c artifact_name()/artifact_exists()/touch_artifact() and
// include/artilist.h.  Keep artifact identity separate from the base object:
// readobjnam() first resolves the artifact to an object type, mksobj() builds
// that ordinary object, and oname() then commits the named artifact.
import { ARTIFACT_DATA } from './artifact_data.js';
import { P_BASIC, P_SKILLED, Upolyd, W_ARM } from './const.js';
import { dragonFormForArmor, heroHasDrainResistance } from './armor.js';
import { game, requirePlayingGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { insideShopRoomAt } from './shk.js';
import { mksobj } from './mklev.js';
import { ensureHeroSkills } from './skills.js';
import { races } from './roles.js';
import { objectClassForType } from './object_knowledge.js';
import { d, rnd, rn2 } from './rng.js';
import { GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES, OBJECT_NAMES, OBJECT_SUBTYPE, OBJECT_UNIQUE, requireObjectData, } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { questMonsterAlignment } from './role_monsters.js';
import { MONSTER_FLAGS2, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_SYMBOL, monsterIsCovetous, monsterIsPlayerMonster, } from './monster_data.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { monsterAlignmentType } from './monster_alignment.js';
import { monsterHasColdResistance, monsterHasDrainResistance, monsterHasFireResistance, monsterHasShockResistance, } from './monster_resistance.js';
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
    return artifact.flags.includes('SPFX_HALRES') ? ['hallucinationResistance'] : [];
}
function fuzzyArtifactName(value) {
    return String(value || '')
        .trim()
        .replace(/^the\s+/i, '')
        .replace(/[\s-]+/g, '')
        .toLowerCase();
}
const QUEST_ARTIFACT_NAMES = new Set(roles.map((role) => fuzzyArtifactName(role.artifactName)).filter(Boolean));
export const ARTIFACTS = ARTIFACT_DATA.map((artifact) => {
    const baseName = requireObjectData(OBJECT_NAMES, artifact.baseType);
    if (baseName === null)
        throw new Error(`Artifact ${artifact.id} requires a named base type`);
    return {
        ...artifact,
        baseName,
        selfWilled: artifact.flags.includes('SPFX_INTEL'),
        restricted: artifact.flags.includes('SPFX_RESTR'),
        noGeneration: artifact.flags.includes('SPFX_NOGEN'),
        questArtifact: QUEST_ARTIFACT_NAMES.has(fuzzyArtifactName(artifact.name)),
        wieldedProperties: wieldedProperties(artifact),
    };
});
export function artifactWarningMask(object, state = game) {
    const artifact = artifactById(object?.oartifact, state);
    return artifact?.flags.includes('SPFX_WARN') && artifact.target.kind === 'flag2'
        ? FLAG2_TARGETS[artifact.target.value]
        : 0;
}
export function artifactGlowColor(object, state = game) {
    const artifact = artifactById(object.oartifact, state);
    if (!artifact)
        throw new Error('Artifact glow requires a known artifact');
    if (artifact.color === 'CLR_RED')
        return 'red';
    if (artifact.color === 'CLR_BRIGHT_BLUE')
        return 'light blue';
    throw new Error(`Artifact ${artifact.id} has no glow color`);
}
function artifactList(state = game) {
    return state._artifactRuntime instanceof Map ? [...state._artifactRuntime.values()] : ARTIFACTS;
}
export function artifactByName(value, state = game) {
    const wanted = fuzzyArtifactName(value);
    return (artifactList(state).find((artifact) => fuzzyArtifactName(artifact.name) === wanted) || null);
}
export function artifactById(id, state = game) {
    if (id == null)
        return null;
    if (state._artifactRuntime instanceof Map)
        return state._artifactRuntime.get(id) || null;
    return ARTIFACTS.find((artifact) => artifact.id === id) || null;
}
// C artifact.c:init_artifacts()/hack_artifacts().  The static artilist is
// copied per game because selected role/alignment can retarget gift and quest
// artifacts.  Existence/discovery state is new-game state, not module state.
export function initializeArtifacts(state = game) {
    const role = state.urole?.key || null;
    const alignment = state.initAlignment?.value ?? 0;
    const runtime = new Map(ARTIFACTS.map((artifact) => [
        artifact.id,
        {
            ...artifact,
            flags: [...artifact.flags],
            carriedFlags: [...artifact.carriedFlags],
            target: { ...artifact.target },
            attack: artifact.attack ? { ...artifact.attack } : null,
            wieldedProperties: [...artifact.wieldedProperties],
        },
    ]));
    for (const artifact of runtime.values()) {
        if (artifact.role === role && artifact.alignment !== null)
            artifact.alignment = alignment;
    }
    const excalibur = [...runtime.values()].find((artifact) => artifact.name === 'Excalibur');
    if (excalibur && role !== 'knight')
        excalibur.role = null;
    const questName = state.urole?.artifactName;
    const questArtifact = questName
        ? [...runtime.values()].find((artifact) => fuzzyArtifactName(artifact.name) === fuzzyArtifactName(questName))
        : null;
    if (questArtifact) {
        questArtifact.alignment = alignment;
        questArtifact.role = role;
    }
    state._artifactRuntime = runtime;
    state._artifactExists = new Set();
    state._artifactFound = new Set();
    state._artifactOrigins = new Map();
    state._artifactDiscoveries = [];
    return runtime;
}
function existenceSet(state) {
    if (!(state._artifactExists instanceof Set))
        state._artifactExists = new Set();
    return state._artifactExists;
}
// C artifact.c:artifact_exists().  The caller has already created the base
// object.  Naming commits both the object's identity and the global existence
// bit; later random-artifact ranges consume the shared count.
export function nameArtifact(object, artifact, { origin = 'random', knownOrigin = false, state = game } = {}) {
    if (!object || !artifact)
        return false;
    const exists = existenceSet(state);
    if (exists.has(artifact.id))
        return false;
    object.artifact = true;
    object.oartifact = artifact.id;
    setArtifactOrigin(object, origin, { knownOrigin, state });
    object.oextra = {
        ...(object.oextra || {}),
        oname: artifact.name,
    };
    if (artifact.invokePower === 'fling-poison')
        object.opoisoned = 1;
    object.age = 0;
    object.quan = 1;
    object.quantity = 1;
    return true;
}
// C artifact.c:artifact_origin(). A wish or gift can replace the random
// origin assigned by mk_artifact(); knowledge is reset at the same boundary.
export function setArtifactOrigin(object, origin, { knownOrigin = false, state = game } = {}) {
    const id = object.oartifact;
    if (!id)
        return;
    existenceSet(state).add(id);
    (state._artifactOrigins ??= new Map()).set(id, origin);
    if (knownOrigin)
        markArtifactFound(id, state);
    else
        state._artifactFound?.delete(id);
}
// C artifact.c:dump_artifact_info(). This includes artifacts the hero has
// never encountered; the creation flags describe game state, not discoveries.
export function artifactInfoLines(state = game) {
    return artifactList(state).map(artifact => {
        const exists = state._artifactExists?.has(artifact.id) ? 'exists;' : '';
        const found = state._artifactFound?.has(artifact.id) ? ' hero knows;' : '';
        const origin = state._artifactOrigins?.get(artifact.id);
        return `  ${artifact.name.slice(0, 36).padEnd(36)}[${exists}${found}${origin ? ` ${origin}` : ''}]`;
    });
}
export function uncreateArtifact(object, state = game) {
    if (!object?.oartifact)
        return false;
    const removed = state._artifactExists?.delete(object.oartifact) ?? false;
    state._artifactFound?.delete(object.oartifact);
    state._artifactOrigins?.delete(object.oartifact);
    object.artifact = false;
    object.oartifact = 0;
    return removed;
}
export function artifactExistCount(state = game) {
    return state._artifactExists?.size ?? 0;
}
// C found_artifact(): wishes and gifts are known without a "found" log.
export function markArtifactFound(id, state = game) {
    (state._artifactFound ||= new Set()).add(id);
}
// C xname() -> find_artifact(). Only the object's real dknown flag counts,
// not a temporary full-identification view.
export function findArtifact(object, { source = object, state = game, } = {}) {
    const id = object.oartifact;
    if (!id || !object.dknown || state._artifactFound?.has(id))
        return false;
    markArtifactFound(id, state);
    let where = '';
    if (source.where === 'floor') {
        where = insideShopRoomAt(state, source.ox, source.oy) ? ' in a shop' : ' on the floor';
    }
    else if (source.where === 'contained') {
        where = ' in a container';
    }
    else if (source.where === 'minvent') {
        where = ' carried by a monster';
    }
    const artifact = artifactById(id, state);
    if (!artifact)
        throw new Error(`Unknown found artifact ${id}`);
    const name = artifact.name.replace(/^The /, 'the ');
    recordGameLogEvent(`found ${name}${where}`, { state });
    return true;
}
export function discoverArtifact(id, state = game) {
    const discoveries = (state._artifactDiscoveries ||= []);
    if (!discoveries.includes(id))
        discoveries.push(id);
}
// C mk_artifact() without an alignment: convert an existing object.
export function createRandomArtifact(object, { maximumValue = 99, adjustEnchantment = true, state = game, } = {}) {
    if (OBJECT_UNIQUE[object.otyp])
        return object;
    const candidates = artifactList(state).filter((artifact) => artifact.baseType === object.otyp &&
        !artifact.noGeneration &&
        !state._artifactExists?.has(artifact.id) &&
        (artifact.giftValue <= maximumValue || artifact.role === state.urole?.key));
    if (!candidates.length)
        return object;
    const artifact = candidates[rn2(candidates.length)];
    if (!artifact)
        throw new Error('Artifact selection requires a candidate');
    return finishArtifactGeneration(object, artifact, adjustEnchantment, state);
}
function finishArtifactGeneration(object, artifact, adjustEnchantment, state) {
    object.oeroded = object.oeroded2 = 0;
    nameArtifact(object, artifact, { state });
    if (adjustEnchantment) {
        const enchantment = object.spe + artifact.generationEnchantment;
        if (enchantment >= -10 && enchantment < 10)
            object.spe = enchantment;
    }
    return object;
}
// C artifact.c:mk_artifact(), when choosing a divine gift by alignment.
export async function createArtifactGift(alignment, maximumValue, state = game) {
    requirePlayingGame(state);
    const candidates = [];
    const fallback = [];
    const skills = ensureHeroSkills(state);
    for (const artifact of artifactList(state)) {
        if (state._artifactExists?.has(artifact.id) || artifact.noGeneration)
            continue;
        const roleGift = artifact.role === state.urole?.key;
        if (artifact.giftValue > maximumValue && !roleGift)
            continue;
        if (artifact.alignment !== null && artifact.alignment !== alignment)
            continue;
        const artifactRace = races.find((race) => race.name === artifact.race);
        if (artifactRace && artifactRace.selfmask & state.urace.hatemask)
            continue;
        if (roleGift) {
            candidates.length = 0;
            candidates.push(artifact);
            break;
        }
        const weapon = objectClassForType(artifact.baseType) === 2;
        const skill = Math.abs(requireObjectData(OBJECT_SUBTYPE, artifact.baseType));
        const compatibility = weapon ? (skills?.[skill]?.maxSkill ?? 0) : P_SKILLED;
        if ((artifact.alignment !== null || (state.u.ugifts ?? 0) > 0 || !rn2(3)) &&
            (!rn2(4) || compatibility >= P_SKILLED || (compatibility >= P_BASIC && rn2(2)))) {
            candidates.push(artifact);
        }
        else if (!candidates.length) {
            fallback.push(artifact);
        }
    }
    const choices = candidates.length ? candidates : fallback;
    if (!choices.length)
        return null;
    const artifact = choices[rn2(choices.length)];
    if (!artifact)
        throw new Error('Artifact gift selection requires a candidate');
    const object = await mksobj(artifact.baseType, true, false);
    return finishArtifactGeneration(object, artifact, true, state);
}
function defendedByArtifact(artifact, damageType) {
    return artifact?.defense === damageType;
}
function carriedArtifactDefends(inventory, damageType, state) {
    return (inventory || []).some((object) => artifactById(object?.oartifact, state)?.carriedDefense === damageType);
}
function artifactDefenseApplies(defender, damageType, hero, state) {
    if (!hero && !defender)
        return false;
    const weapon = hero ? state.uwep || state.u?.uwep : monsterWieldedWeapon(defender);
    if (defendedByArtifact(artifactById(weapon?.oartifact, state), damageType)) {
        return true;
    }
    const inventory = hero ? state.inventory : defender?.minvent || defender?.inventory;
    return carriedArtifactDefends(inventory, damageType, state);
}
// C mondata.c:defended() — explmu()'s base immunity test for the exploding
// monster itself: a wielded artifact that defends against the damage type,
// or dragon scales — worn as body armor, or implicit in an adult dragon's
// own body. Unlike the carries-defense helpers above, items that merely
// defend while carried do not count.
const SCALE_DEFENDING_DRAGON = {
    fire: 'red dragon',
    cold: 'white dragon',
    shock: 'blue dragon',
    hallucination: 'gold dragon',
};
export function monsterWieldsOrWearsDefense(monster, damageType, state) {
    if (!monster || damageType == null)
        return false;
    const weapon = monsterWieldedWeapon(monster);
    if (artifactById(weapon?.oartifact, state)?.defense === damageType)
        return true;
    const dragonName = SCALE_DEFENDING_DRAGON[damageType];
    if (!dragonName)
        return false;
    const defender = MONSTER_NAME.indexOf(dragonName);
    if (defender < 0)
        return false;
    if (monster.mnum === defender)
        return true; /* an adult dragon is its own suit */
    const worn = (monster.minvent || monster.inventory || [])
        .find(object => ((object.owornmask ?? 0) & W_ARM) !== 0);
    return dragonFormForArmor(worn) === defender;
}
export function heroHasArtifactDefense(damageType, state = game) {
    return artifactDefenseApplies(null, damageType, true, state);
}
export function monsterHasArtifactDefense(monster, damageType, state = game) {
    return artifactDefenseApplies(monster, damageType, false, state);
}
export function heroHasCarriedArtifactFlag(flag, state = game) {
    return (state.inventory || []).some((object) => artifactById(object?.oartifact, state)?.carriedFlags.includes(flag));
}
function resistanceAttackApplies(artifact, defender, { hero, random, state }) {
    if (!artifact.attack)
        return false;
    const damageType = artifact.attack.damageType;
    if (artifactDefenseApplies(defender, damageType, hero, state))
        return false;
    if (hero) {
        const heroState = state.u || {};
        const currentForm = { mnum: heroSpecies(state) };
        if (damageType === 'fire')
            return !(heroState.fireResistance || monsterHasFireResistance(currentForm));
        if (damageType === 'cold')
            return !(heroState.coldResistance || monsterHasColdResistance(currentForm));
        if (damageType === 'shock')
            return !(heroState.shockResistance || monsterHasShockResistance(currentForm));
        if (damageType === 'life-drain')
            return !(heroHasDrainResistance(state) ||
                monsterHasDrainResistance(currentForm) ||
                (heroState.ulycn !== undefined &&
                    Number.isInteger(heroState.ulycn) &&
                    heroState.ulycn >= 0));
        if (damageType === 'stun' || damageType === 'magic')
            return !heroState.antimagic;
        return false;
    }
    if (damageType === 'fire')
        return !monsterHasFireResistance(defender);
    if (damageType === 'cold')
        return !monsterHasColdResistance(defender);
    if (damageType === 'shock')
        return !monsterHasShockResistance(defender);
    if (damageType === 'life-drain')
        return !monsterHasDrainResistance(defender);
    if (damageType === 'stun' || damageType === 'magic') {
        const resistance = MONSTER_MAGIC_RESISTANCE[defender.mnum] ?? 0;
        return random(100) >= resistance;
    }
    return false;
}
function artifactAttackApplies(artifact, defender, { hero = false, random = rn2, state = game } = {}) {
    if (!defender || !artifact)
        return false;
    const target = artifact.target;
    if (target.kind === 'resistance') {
        return resistanceAttackApplies(artifact, defender, { hero, random, state });
    }
    const mnum = defender.mnum;
    switch (target.kind) {
        case 'all':
            return true;
        case 'flag2': {
            const flag = FLAG2_TARGETS[target.value] ?? 0;
            return (!!((MONSTER_FLAGS2[mnum] ?? 0) & flag) ||
                (hero && !Upolyd(state.u) && !!((state.urace?.selfmask ?? 0) & flag)) ||
                (hero &&
                    target.value === 'M2_WERE' &&
                    state.u.ulycn !== undefined &&
                    Number.isInteger(state.u.ulycn) &&
                    state.u.ulycn >= 0));
        }
        case 'symbol':
            return MONSTER_SYMBOL[mnum] === SYMBOL_TARGETS[target.value];
        case 'alignment': {
            const alignment = hero ? state.u?.ualign?.type : questMonsterAlignment(mnum, state);
            if (hero)
                return alignment !== artifact.alignment;
            return (alignment === -128 ||
                alignment === undefined ||
                Math.sign(alignment) !== artifact.alignment);
        }
        default:
            return false;
    }
}
// C weapon.c:hitval() calls spec_abon() before hitum() rolls its ordinary d20.
export function artifactToHitBonus(object, defender, roll = rnd, { hero = false, random = rn2, state = game } = {}) {
    const artifact = artifactById(object?.oartifact, state);
    if (!artifact?.attack ||
        !(artifact.attack.toHitDie > 0) ||
        !artifactAttackApplies(artifact, defender, { hero, random, state }))
        return 0;
    return roll(artifact.attack.toHitDie);
}
// C artifact.c:artifact_hit() -> spec_dbon().  A zero damage die means "add
// the current weapon damage again", not zero bonus.  Strength and ring damage
// are added later by hmon_hitmon_dmg_recalc(), so callers pass only dmgval().
export function artifactDamageBonus(object, defender, baseWeaponDamage, roll = rnd, { hero = false, random = rn2, state = game } = {}) {
    const artifact = artifactById(object?.oartifact, state);
    if (!artifact?.attack)
        return 0;
    const applies = artifact.name === 'Grimtooth' ||
        artifactAttackApplies(artifact, defender, { hero, random, state });
    if (!applies)
        return 0;
    return artifact.attack.damageDie > 0
        ? roll(artifact.attack.damageDie)
        : Math.max(baseWeaponDamage, 1);
}
export function artifactDoublesWeaponDamage(object, defender, { hero = false, random = rn2, state = game } = {}) {
    const artifact = artifactById(object?.oartifact, state);
    return (!!artifact?.attack &&
        artifactAttackApplies(artifact, defender, { hero, random, state }) &&
        artifact.attack.damageDie === 0);
}
export function artifactEmitsLight(object) {
    if (!object)
        return false;
    if ([GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES].includes(object?.otyp) &&
        (object.owornmask ?? 0) & W_ARM)
        return true;
    return artifactById(object?.oartifact)?.name === 'Sunsword';
}
export function artifactStrikesShade(object) {
    return artifactById(object?.oartifact)?.name === 'Sunsword';
}
export function artifactBaneApplies(artifact, state = game) {
    if (!artifact)
        return false;
    if (!['flag2', 'symbol', 'alignment'].includes(artifact?.target.kind))
        return false;
    return artifactAttackApplies(artifact, { mnum: heroSpecies(state) }, { hero: true, state });
}
// Unlike the hero, a monster refuses a hostile artifact without taking a blast.
export function monsterCanTouchArtifact(monster, object, state = game) {
    const artifact = artifactById(object.oartifact, state);
    if (!artifact)
        return true;
    if (!monsterIsCovetous(monster) && !monsterIsPlayerMonster(monster.mnum)) {
        if (artifact.selfWilled && artifact.role && artifact.name !== 'Excalibur')
            return false;
        if (artifact.restricted &&
            artifact.alignment !== null &&
            artifact.alignment !== monsterAlignmentType(monster))
            return false;
    }
    const targetsMonsterKind = ['flag2', 'symbol', 'alignment'].includes(artifact.target.kind);
    return !targetsMonsterKind || !artifactAttackApplies(artifact, monster, { state });
}
// C artifact.c:touch_artifact() hero branch up to its blast message.
export function resolveHeroArtifactTouch(object, artifact, state = game) {
    if (!object?.oartifact || !artifact) {
        return { allowed: true, blasted: false };
    }
    const heroRole = state.urole?.key || null;
    const heroAlignment = state.u?.ualign?.type ?? 0;
    const alignmentRecord = state.u?.ualign?.record ?? 0;
    const badClass = artifact.selfWilled && !!artifact.role && artifact.role !== heroRole;
    const bane = artifactBaneApplies(artifact, state);
    let badAlignment = artifact.restricted &&
        artifact.alignment !== null &&
        (artifact.alignment !== heroAlignment || alignmentRecord < 0);
    if (!badAlignment)
        badAlignment = bane;
    let blasted = false;
    if (((badClass || badAlignment) && artifact.selfWilled) || (badAlignment && rn2(4) === 0)) {
        blasted = true;
    }
    return {
        allowed: !(badClass && badAlignment && artifact.selfWilled),
        blasted,
        badClass,
        badAlignment,
        bane,
    };
}
export function rollHeroArtifactBlast(object, artifact, state = game) {
    const antimagic = !!state.u?.antimagic;
    let damage = d(antimagic ? 2 : 4, artifact.selfWilled ? 10 : 4);
    if (objectMaterial(object, state) === SILVER && heroHatesSilver(state)) {
        let silverDamage = rnd(10);
        if (state.u?.halfPhysicalDamage)
            silverDamage = Math.trunc((silverDamage + 1) / 2);
        damage += silverDamage;
    }
    return damage;
}
//# sourceMappingURL=artifacts.js.map