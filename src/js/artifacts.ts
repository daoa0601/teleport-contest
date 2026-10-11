// artifacts.js — Named artifact identity, existence, and hero-touch policy.
// C refs: artifact.c artifact_name()/artifact_exists()/touch_artifact() and
// include/artilist.h.  Keep artifact identity separate from the base object:
// readobjnam() first resolves the artifact to an object type, mksobj() builds
// that ordinary object, and oname() then commits the named artifact.

import { ARTIFACT_DATA } from './artifact_data.js';
import type {
    ArtifactDefinition,
    ArtifactFlag,
    ArtifactDamage,
    ArtifactDefense,
} from './data_types.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { PropertyName } from './property_types.js';

export type Artifact = { -readonly [Key in keyof ArtifactDefinition]: ArtifactDefinition[Key] } & {
    baseName: string;
    selfWilled: boolean;
    restricted: boolean;
    noGeneration: boolean;
    questArtifact: boolean;
    wieldedProperties: PropertyName[];
};

export type ArtifactDefenseQuery =
    | ArtifactDefense
    | ArtifactDamage
    | 'acid'
    | 'disintegration'
    | 'sleep'
    | 'electric'
    | 'lightning'
    | 'hallucination'
    | null
    | undefined;

export type ArtifactDefender = Pick<Monster, 'mnum'> &
    Partial<Pick<Monster, 'minvent' | 'inventory' | 'mw' | 'mintrinsics' | 'mextrinsics' | 'cham'>>;

interface ArtifactAttackOptions {
    hero?: boolean;
    random?: (limit: number) => number;
    state?: GameState;
}

export interface ArtifactTouchResult {
    allowed: boolean;
    blasted: boolean;
    badClass?: boolean;
    badAlignment?: boolean;
    bane?: boolean;
}

import { P_BASIC, P_SKILLED, Upolyd, W_ARM } from './const.js';
import { heroHasDrainResistance } from './armor.js';
import { game, requirePlayingGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { insideShopRoomAt } from './shk.js';
import { mksobj } from './mklev.js';
import { ensureHeroSkills } from './skills.js';
import { races } from './roles.js';
import { objectClassForType } from './object_knowledge.js';
import { d, rnd, rn2 } from './rng.js';
import {
    GOLD_DRAGON_SCALE_MAIL,
    GOLD_DRAGON_SCALES,
    OBJECT_NAMES,
    OBJECT_SUBTYPE,
    OBJECT_UNIQUE,
    requireObjectData,
} from './object_data.js';
import { objectMaterial } from './object_material.js';
import {
    MONSTER_ALIGNMENT,
    MONSTER_FLAGS2,
    MONSTER_MAGIC_RESISTANCE,
    MONSTER_SYMBOL,
    monsterIsCovetous,
    monsterIsPlayerMonster,
} from './monster_data.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { monsterAlignmentType } from './monster_alignment.js';
import {
    monsterHasColdResistance,
    monsterHasDrainResistance,
    monsterHasFireResistance,
    monsterHasShockResistance,
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
function wieldedProperties(artifact: ArtifactDefinition): PropertyName[] {
    return artifact.flags.includes('SPFX_HALRES') ? ['hallucinationResistance'] : [];
}

function fuzzyArtifactName(value: unknown): string {
    return String(value || '')
        .trim()
        .replace(/^the\s+/i, '')
        .replace(/[\s-]+/g, '')
        .toLowerCase();
}

const QUEST_ARTIFACT_NAMES = new Set(
    roles.map((role) => fuzzyArtifactName(role.artifactName)).filter(Boolean),
);

export const ARTIFACTS: readonly Artifact[] = ARTIFACT_DATA.map((artifact) => {
    const baseName = requireObjectData(OBJECT_NAMES, artifact.baseType);
    if (baseName === null) throw new Error(`Artifact ${artifact.id} requires a named base type`);
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

export function artifactWarningMask(
    object: Pick<GameObject, 'oartifact'> | null | undefined,
    state: GameState = game,
): number {
    const artifact = artifactById(object?.oartifact, state);
    return artifact?.flags.includes('SPFX_WARN') && artifact.target.kind === 'flag2'
        ? FLAG2_TARGETS[artifact.target.value]
        : 0;
}

export function artifactGlowColor(object: GameObject, state: GameState = game): string {
    const artifact = artifactById(object.oartifact, state);
    if (!artifact) throw new Error('Artifact glow requires a known artifact');
    if (artifact.color === 'CLR_RED') return 'red';
    if (artifact.color === 'CLR_BRIGHT_BLUE') return 'light blue';
    throw new Error(`Artifact ${artifact.id} has no glow color`);
}

function artifactList(state: GameState = game): readonly Artifact[] {
    return state._artifactRuntime instanceof Map ? [...state._artifactRuntime.values()] : ARTIFACTS;
}

export function artifactByName(value: unknown, state: GameState = game): Artifact | null {
    const wanted = fuzzyArtifactName(value);
    return (
        artifactList(state).find((artifact) => fuzzyArtifactName(artifact.name) === wanted) || null
    );
}

export function artifactById(
    id: number | null | undefined,
    state: GameState = game,
): Artifact | null {
    if (id == null) return null;
    if (state._artifactRuntime instanceof Map) return state._artifactRuntime.get(id) || null;
    return ARTIFACTS.find((artifact) => artifact.id === id) || null;
}

// C artifact.c:init_artifacts()/hack_artifacts().  The static artilist is
// copied per game because selected role/alignment can retarget gift and quest
// artifacts.  Existence/discovery state is new-game state, not module state.
export function initializeArtifacts(state: GameState = game): Map<number, Artifact> {
    const role = state.urole?.key || null;
    const alignment = state.initAlignment?.value ?? 0;
    const runtime = new Map<number, Artifact>(
        ARTIFACTS.map((artifact) => [
            artifact.id,
            {
                ...artifact,
                flags: [...artifact.flags],
                carriedFlags: [...artifact.carriedFlags],
                target: { ...artifact.target },
                attack: artifact.attack ? { ...artifact.attack } : null,
                wieldedProperties: [...artifact.wieldedProperties],
            },
        ]),
    );

    for (const artifact of runtime.values()) {
        if (artifact.role === role && artifact.alignment !== null) artifact.alignment = alignment;
    }
    const excalibur = [...runtime.values()].find((artifact) => artifact.name === 'Excalibur');
    if (excalibur && role !== 'knight') excalibur.role = null;

    const questName = state.urole?.artifactName;
    const questArtifact = questName
        ? [...runtime.values()].find(
              (artifact) => fuzzyArtifactName(artifact.name) === fuzzyArtifactName(questName),
          )
        : null;
    if (questArtifact) {
        questArtifact.alignment = alignment;
        questArtifact.role = role;
    }

    state._artifactRuntime = runtime;
    state._artifactExists = new Set();
    state._artifactFound = new Set();
    state._artifactDiscoveries = [];
    return runtime;
}

function existenceSet(state: GameState): Set<number> {
    if (!(state._artifactExists instanceof Set)) state._artifactExists = new Set();
    return state._artifactExists;
}

// C artifact.c:artifact_exists().  The caller has already created the base
// object.  Naming commits both the object's identity and the global existence
// bit; later random-artifact ranges consume the shared count.
export function nameArtifact(
    object: GameObject | null | undefined,
    artifact: Artifact | null | undefined,
    { knownOrigin = false, state = game }: { knownOrigin?: boolean; state?: GameState } = {},
): boolean {
    if (!object || !artifact) return false;
    const exists = existenceSet(state);
    if (exists.has(artifact.id)) return false;
    exists.add(artifact.id);
    if (knownOrigin) markArtifactFound(artifact.id, state);
    else state._artifactFound?.delete(artifact.id);
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

export function uncreateArtifact(
    object: GameObject | null | undefined,
    state: GameState = game,
): boolean {
    if (!object?.oartifact) return false;
    const removed = state._artifactExists?.delete(object.oartifact) ?? false;
    state._artifactFound?.delete(object.oartifact);
    object.artifact = false;
    object.oartifact = 0;
    return removed;
}

export function artifactExistCount(state: GameState = game): number {
    return state._artifactExists?.size ?? 0;
}

// C found_artifact(): wishes and gifts are known without a "found" log.
export function markArtifactFound(id: number, state: GameState = game): void {
    (state._artifactFound ||= new Set()).add(id);
}

// C xname() -> find_artifact(). Only the object's real dknown flag counts,
// not a temporary full-identification view.
export function findArtifact(
    object: GameObject,
    {
        source = object,
        state = game,
    }: {
        source?: Pick<GameObject, 'where' | 'ox' | 'oy'>;
        state?: GameState;
    } = {},
): boolean {
    const id = object.oartifact;
    if (!id || !object.dknown || state._artifactFound?.has(id)) return false;
    markArtifactFound(id, state);
    let where = '';
    if (source.where === 'floor') {
        where = insideShopRoomAt(state, source.ox, source.oy) ? ' in a shop' : ' on the floor';
    } else if (source.where === 'contained') {
        where = ' in a container';
    } else if (source.where === 'minvent') {
        where = ' carried by a monster';
    }
    const artifact = artifactById(id, state);
    if (!artifact) throw new Error(`Unknown found artifact ${id}`);
    const name = artifact.name.replace(/^The /, 'the ');
    recordGameLogEvent(`found ${name}${where}`, { state });
    return true;
}

export function discoverArtifact(id: number, state: GameState = game): void {
    const discoveries = (state._artifactDiscoveries ||= []);
    if (!discoveries.includes(id)) discoveries.push(id);
}

// C mk_artifact() without an alignment: convert an existing object.
export function createRandomArtifact(
    object: GameObject,
    {
        maximumValue = 99,
        adjustEnchantment = true,
        state = game,
    }: { maximumValue?: number; adjustEnchantment?: boolean; state?: GameState } = {},
): GameObject {
    if (OBJECT_UNIQUE[object.otyp]) return object;
    const candidates = artifactList(state).filter(
        (artifact) =>
            artifact.baseType === object.otyp &&
            !artifact.noGeneration &&
            !state._artifactExists?.has(artifact.id) &&
            (artifact.giftValue <= maximumValue || artifact.role === state.urole?.key),
    );
    if (!candidates.length) return object;
    const artifact = candidates[rn2(candidates.length)];
    if (!artifact) throw new Error('Artifact selection requires a candidate');
    return finishArtifactGeneration(object, artifact, adjustEnchantment, state);
}

function finishArtifactGeneration(
    object: GameObject,
    artifact: Artifact,
    adjustEnchantment: boolean,
    state: GameState,
): GameObject {
    object.oeroded = object.oeroded2 = 0;
    nameArtifact(object, artifact, { state });
    if (adjustEnchantment) {
        const enchantment = object.spe + artifact.generationEnchantment;
        if (enchantment >= -10 && enchantment < 10) object.spe = enchantment;
    }
    return object;
}

// C artifact.c:mk_artifact(), when choosing a divine gift by alignment.
export async function createArtifactGift(
    alignment: number,
    maximumValue: number,
    state: GameState = game,
): Promise<GameObject | null> {
    requirePlayingGame(state);
    const candidates: Artifact[] = [];
    const fallback: Artifact[] = [];
    const skills = ensureHeroSkills(state);
    for (const artifact of artifactList(state)) {
        if (state._artifactExists?.has(artifact.id) || artifact.noGeneration) continue;
        const roleGift = artifact.role === state.urole?.key;
        if (artifact.giftValue > maximumValue && !roleGift) continue;
        if (artifact.alignment !== null && artifact.alignment !== alignment) continue;
        const artifactRace = races.find((race) => race.name === artifact.race);
        if (artifactRace && artifactRace.selfmask & state.urace.hatemask) continue;
        if (roleGift) {
            candidates.length = 0;
            candidates.push(artifact);
            break;
        }
        const weapon = objectClassForType(artifact.baseType) === 2;
        const skill = Math.abs(requireObjectData(OBJECT_SUBTYPE, artifact.baseType));
        const compatibility = weapon ? (skills?.[skill]?.maxSkill ?? 0) : P_SKILLED;
        if (
            (artifact.alignment !== null || (state.u.ugifts ?? 0) > 0 || !rn2(3)) &&
            (!rn2(4) || compatibility >= P_SKILLED || (compatibility >= P_BASIC && rn2(2)))
        ) {
            candidates.push(artifact);
        } else if (!candidates.length) {
            fallback.push(artifact);
        }
    }
    const choices = candidates.length ? candidates : fallback;
    if (!choices.length) return null;
    const artifact = choices[rn2(choices.length)];
    if (!artifact) throw new Error('Artifact gift selection requires a candidate');
    const object = await mksobj(artifact.baseType, true, false);
    return finishArtifactGeneration(object, artifact, true, state);
}

function defendedByArtifact(
    artifact: Artifact | null | undefined,
    damageType: ArtifactDefenseQuery,
): boolean {
    return artifact?.defense === damageType;
}

function carriedArtifactDefends(
    inventory: readonly GameObject[] | undefined,
    damageType: ArtifactDefenseQuery,
    state: GameState,
): boolean {
    return (inventory || []).some(
        (object) => artifactById(object?.oartifact, state)?.carriedDefense === damageType,
    );
}

function artifactDefenseApplies(
    defender: ArtifactDefender | null,
    damageType: ArtifactDefenseQuery,
    hero: boolean,
    state: GameState,
): boolean {
    if (!hero && !defender) return false;
    const weapon = hero ? state.uwep || state.u?.uwep : monsterWieldedWeapon(defender);
    if (defendedByArtifact(artifactById(weapon?.oartifact, state), damageType)) {
        return true;
    }
    const inventory = hero ? state.inventory : defender?.minvent || defender?.inventory;
    return carriedArtifactDefends(inventory, damageType, state);
}

export function heroHasArtifactDefense(
    damageType: ArtifactDefenseQuery,
    state: GameState = game,
): boolean {
    return artifactDefenseApplies(null, damageType, true, state);
}

export function monsterHasArtifactDefense(
    monster: ArtifactDefender,
    damageType: ArtifactDefenseQuery,
    state: GameState = game,
): boolean {
    return artifactDefenseApplies(monster, damageType, false, state);
}

export function heroHasCarriedArtifactFlag(flag: ArtifactFlag, state: GameState = game): boolean {
    return (state.inventory || []).some((object) =>
        artifactById(object?.oartifact, state)?.carriedFlags.includes(flag),
    );
}

function resistanceAttackApplies(
    artifact: Artifact,
    defender: ArtifactDefender,
    { hero, random, state }: { hero: boolean; random: (limit: number) => number; state: GameState },
): boolean {
    if (!artifact.attack) return false;
    const damageType = artifact.attack.damageType;
    if (artifactDefenseApplies(defender, damageType, hero, state)) return false;
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
            return !(
                heroHasDrainResistance(state) ||
                monsterHasDrainResistance(currentForm) ||
                (heroState.ulycn !== undefined &&
                    Number.isInteger(heroState.ulycn) &&
                    heroState.ulycn >= 0)
            );
        if (damageType === 'stun') return !heroState.antimagic;
        return false;
    }
    if (damageType === 'fire') return !monsterHasFireResistance(defender);
    if (damageType === 'cold') return !monsterHasColdResistance(defender);
    if (damageType === 'shock') return !monsterHasShockResistance(defender);
    if (damageType === 'life-drain') return !monsterHasDrainResistance(defender);
    if (damageType === 'stun') {
        const resistance = MONSTER_MAGIC_RESISTANCE[defender.mnum] ?? 0;
        return random(100) >= resistance;
    }
    return false;
}

function artifactAttackApplies(
    artifact: Artifact | null | undefined,
    defender: ArtifactDefender | null | undefined,
    { hero = false, random = rn2, state = game }: ArtifactAttackOptions = {},
): boolean {
    if (!defender || !artifact) return false;
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
            return (
                !!((MONSTER_FLAGS2[mnum] ?? 0) & flag) ||
                (hero && !Upolyd(state.u) && !!((state.urace?.selfmask ?? 0) & flag)) ||
                (hero &&
                    target.value === 'M2_WERE' &&
                    state.u.ulycn !== undefined &&
                    Number.isInteger(state.u.ulycn) &&
                    state.u.ulycn >= 0)
            );
        }
        case 'symbol':
            return MONSTER_SYMBOL[mnum] === SYMBOL_TARGETS[target.value];
        case 'alignment': {
            const alignment = hero ? state.u?.ualign?.type : MONSTER_ALIGNMENT[mnum];
            if (hero) return alignment !== artifact.alignment;
            return (
                alignment === -128 ||
                alignment === undefined ||
                Math.sign(alignment) !== artifact.alignment
            );
        }
        default:
            return false;
    }
}

// C weapon.c:hitval() calls spec_abon() before hitum() rolls its ordinary d20.
export function artifactToHitBonus(
    object: GameObject | null | undefined,
    defender: ArtifactDefender,
    roll = rnd,
    { hero = false, random = rn2, state = game }: ArtifactAttackOptions = {},
): number {
    const artifact = artifactById(object?.oartifact, state);
    if (
        !artifact?.attack ||
        !(artifact.attack.toHitDie > 0) ||
        !artifactAttackApplies(artifact, defender, { hero, random, state })
    )
        return 0;
    return roll(artifact.attack.toHitDie);
}

// C artifact.c:artifact_hit() -> spec_dbon().  A zero damage die means "add
// the current weapon damage again", not zero bonus.  Strength and ring damage
// are added later by hmon_hitmon_dmg_recalc(), so callers pass only dmgval().
export function artifactDamageBonus(
    object: GameObject | null | undefined,
    defender: ArtifactDefender,
    baseWeaponDamage: number,
    roll = rnd,
    { hero = false, random = rn2, state = game }: ArtifactAttackOptions = {},
): number {
    const artifact = artifactById(object?.oartifact, state);
    if (!artifact?.attack) return 0;
    const applies =
        artifact.name === 'Grimtooth' ||
        artifactAttackApplies(artifact, defender, { hero, random, state });
    if (!applies) return 0;
    return artifact.attack.damageDie > 0
        ? roll(artifact.attack.damageDie)
        : Math.max(baseWeaponDamage, 1);
}

export function artifactDoublesWeaponDamage(
    object: GameObject | null | undefined,
    defender: ArtifactDefender,
    { hero = false, random = rn2, state = game }: ArtifactAttackOptions = {},
): boolean {
    const artifact = artifactById(object?.oartifact, state);
    return (
        !!artifact?.attack &&
        artifactAttackApplies(artifact, defender, { hero, random, state }) &&
        artifact.attack.damageDie === 0
    );
}

export function artifactEmitsLight(
    object: Pick<GameObject, 'otyp' | 'oartifact' | 'owornmask'> | null | undefined,
): boolean {
    if (!object) return false;
    if (
        [GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES].includes(object?.otyp) &&
        (object.owornmask ?? 0) & W_ARM
    )
        return true;
    return artifactById(object?.oartifact)?.name === 'Sunsword';
}

export function artifactStrikesShade(
    object: Pick<GameObject, 'oartifact'> | null | undefined,
): boolean {
    return artifactById(object?.oartifact)?.name === 'Sunsword';
}

export function artifactBaneApplies(
    artifact: Artifact | null | undefined,
    state: GameState = game,
): boolean {
    if (!artifact) return false;
    if (!['flag2', 'symbol', 'alignment'].includes(artifact?.target.kind)) return false;
    return artifactAttackApplies(artifact, { mnum: heroSpecies(state) }, { hero: true, state });
}

// Unlike the hero, a monster refuses a hostile artifact without taking a blast.
export function monsterCanTouchArtifact(
    monster: Monster,
    object: GameObject,
    state: GameState = game,
): boolean {
    const artifact = artifactById(object.oartifact, state);
    if (!artifact) return true;
    if (!monsterIsCovetous(monster) && !monsterIsPlayerMonster(monster.mnum)) {
        if (artifact.selfWilled && artifact.role && artifact.name !== 'Excalibur') return false;
        if (
            artifact.restricted &&
            artifact.alignment !== null &&
            artifact.alignment !== monsterAlignmentType(monster)
        )
            return false;
    }
    const targetsMonsterKind = ['flag2', 'symbol', 'alignment'].includes(artifact.target.kind);
    return !targetsMonsterKind || !artifactAttackApplies(artifact, monster, { state });
}

// C artifact.c:touch_artifact() hero branch up to its blast message.
export function resolveHeroArtifactTouch(
    object: GameObject | null | undefined,
    artifact: Artifact | null | undefined,
    state: GameState = game,
): ArtifactTouchResult {
    if (!object?.oartifact || !artifact) {
        return { allowed: true, blasted: false };
    }
    const heroRole = state.urole?.key || null;
    const heroAlignment = state.u?.ualign?.type ?? 0;
    const alignmentRecord = state.u?.ualign?.record ?? 0;
    const badClass = artifact.selfWilled && !!artifact.role && artifact.role !== heroRole;
    const bane = artifactBaneApplies(artifact, state);
    let badAlignment =
        artifact.restricted &&
        artifact.alignment !== null &&
        (artifact.alignment !== heroAlignment || alignmentRecord < 0);
    if (!badAlignment) badAlignment = bane;

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

export function rollHeroArtifactBlast(
    object: GameObject,
    artifact: Artifact,
    state: GameState = game,
): number {
    const antimagic = !!state.u?.antimagic;
    let damage = d(antimagic ? 2 : 4, artifact.selfWilled ? 10 : 4);
    if (objectMaterial(object, state) === SILVER && heroHatesSilver(state)) {
        let silverDamage = rnd(10);
        if (state.u?.halfPhysicalDamage) silverDamage = Math.trunc((silverDamage + 1) / 2);
        damage += silverDamage;
    }
    return damage;
}
