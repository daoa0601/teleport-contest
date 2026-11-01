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

export type ArtifactOrigin = 'gift' | 'wish' | 'named' | 'viadip' | 'lvldef' | 'bones' | 'random';

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
import { dragonFormForArmor, heroHasDrainResistance } from './armor.js';
import { game, requirePlayingGame } from './gstate.js';
import { LL_ARTIFACT, recordGameLogEvent } from './gamelog.js';
import { insideShopRoomAt } from './shk.js';
import { mksobj } from './mkobj.js';
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
import { questMonsterAlignment } from './role_monsters.js';
import {
    MONSTER_FLAGS2,
    MONSTER_MAGIC_RESISTANCE,
    MONSTER_NAME,
    MONSTER_SYMBOL,
    monsterIsCovetous,
    monsterIsPlayerMonster,
} from './monster_data.js';
import { monsterWieldedWeapon } from './weapon.js';
import { monsterAlignmentType } from './priest.js';
import { heroHatesSilver, heroSpecies } from './hero_species.js';
import { roles } from './roles.js';
import { monsterHasColdResistance, monsterHasDrainResistance, monsterHasFireResistance, monsterHasShockResistance } from './mondata.js';
import type { WornPropertySlot } from './property_types.js';
import { see_monsters } from './display.js';
import { OBJECT_PROPERTY } from './object_data.js';
import {
    grantWornProperty,
    hasCarriedProperty,
    removeWornProperty,
    setCarriedProperty,
} from './properties.js';
import { DOOR, D_TRAPPED, W_WEP, isok } from './const.js';
import { displayColorName, glyphAt } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { isContainer } from './container.js';
import { requireLiveGame } from './gstate.js';
import { verbForSubject } from './object_grammar.js';
import { wornObjectGrantsProperty } from './properties.js';
import { heroIsBlind } from './senses.js';
import { getRumor } from './mklev.js';
import { objectName, objectNameIsPlural } from './objnam.js';
import { exerciseAttribute } from './attrib.js';
import { A_WIS, KILLED_BY } from './const.js';
import { finishHeroDeath } from './end.js';
import { loseHeroHp } from './hero_damage.js';
import { definiteName, objectCombatName } from './objnam.js';
import type { MessagePublisher } from './pline.js';
import type { DeathHandler } from './end.js';
import { heroIsHallucinating } from './senses.js';
import { canSeeMonster } from './display.js';
import { monsterNeckName } from './body_parts.js';
import { loseHeroExperience } from './exper.js';
import { burnAwayHeroSlime } from './hack.js';
import { formatFeltMessage } from './hero_speech.js';
import { igniteItems } from './light.js';
import { healMonster, wakeMonstersNearWithMessages } from './mon.js';
import { applyMagicbaneHit } from './magicbane.js';
import {
    MONSTER_SIZE,
    monsterHasHead,
    monsterIsAmorphous,
    monsterIsNoncorporeal,
    monsterIsNonliving,
} from './monster_data.js';
import { monsterName } from './do_name.js';
import { recordObjectEncounter } from './object_knowledge.js';
import { observeDistantObjectForNaming } from './objnam.js';
import {
    destroyInventoryByElement,
    destroyMonsterInventoryByElement,
    INVENTORY_DAMAGE,
} from './zap.js';
import { cansee } from './vision.js';
import { monsterHitPointsPerLevel } from './makemon.js';
import { commandResultCancelled } from './command_state.js';
import type { ArtifactPower } from './data_types.js';
import type { UntrapOptions } from './untrap.js';
import {
    GETOBJ_EXCLUDE,
    GETOBJ_SUGGEST,
    I_SPECIAL,
    In_endgame,
    In_hell,
    In_quest,
    P_EXPERT,
    TIMEOUT,
    W_ARTI,
} from './const.js';
import { newsym } from './display.js';
import { recalculateTelepathyRange } from './worn.js';
import { hasNonArtifactConflict, syncHeroConflict } from './hero_conflict.js';
import {
    hasNonArtifactInvisibility,
    invisibilityIsBlocked,
    syncHeroInvisibility,
} from './hero_invisibility.js';
import { cureHeroSickness, heroIsSick } from './hero_illness.js';
import { showEnlightenment } from './insight.js';
import {
    ACID_VENOM,
    ARROW,
    BLINDING_VENOM,
    CRYSTAL_BALL,
    FAKE_AMULET_OF_YENDOR,
    SPE_CONE_OF_COLD,
    SPE_FIREBALL,
} from './object_data.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { retouchHeroObject } from './hero_retouch.js';
import { useCrystalBall } from './crystal_ball.js';
import { moveIntoFailedUntrap, untrap } from './untrap.js';
import {
    captureLevitationState,
    hasInvokedProperty,
    hasIntrinsicProperty,
    propertyHasOtherSources,
    refreshProperty,
    setInvokedProperty,
} from './properties.js';
import { floatHeroDown, floatHeroUp } from './terrain_movement.js';
import { applyHeroLocationEffects } from './hack.js';
import { rnz } from './rng.js';
import { heroIsBlinded, permanentBlind } from './senses.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { objectWeight } from './weight.js';
import { chooseObjectToCharge, rechargeObject } from './recharge.js';
import { doBlindingRay } from './flash.js';
import { lightDamage, lightRoom } from './light.js';
import { MONSTER_SOUND } from './monster_data.js';
import { flashBurn, makeBlinded } from './sight_change.js';
import { promptDirection } from './tty_prompts.js';
import { castSpell, spellSkillType } from './spell.js';
import { depth } from './hacklib.js';
import { gotoLevel } from './level_change.js';
import { levelTeleport } from './level_teleport.js';
import { bringLeashedFollowers, teleportMonsterByHero } from './teleport.js';
import { showPagedPickOneMenu } from './windows.js';
import { couldsee } from './vision.js';
import { throwOrdinaryObject } from './ordinary_throw.js';
import { resolveSwallowedEggPieOrVenomThrow } from './swallowed_throw.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { migrateMonsterToLevel } from './mon.js';

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
    state._artifactOrigins = new Map();
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
    { origin = 'random', knownOrigin = false, state = game }: {
        origin?: ArtifactOrigin; knownOrigin?: boolean; state?: GameState;
    } = {},
): boolean {
    if (!object || !artifact) return false;
    const exists = existenceSet(state);
    if (exists.has(artifact.id)) return false;
    object.artifact = true;
    object.oartifact = artifact.id;
    setArtifactOrigin(object, origin, { knownOrigin, state });
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

// C artifact.c:artifact_origin(). A wish or gift can replace the random
// origin assigned by mk_artifact(); knowledge is reset at the same boundary.
export function setArtifactOrigin(
    object: GameObject, origin: ArtifactOrigin,
    { knownOrigin = false, state = game }: { knownOrigin?: boolean; state?: GameState } = {},
): void {
    const id = object.oartifact;
    if (!id) return;
    existenceSet(state).add(id);
    (state._artifactOrigins ??= new Map()).set(id, origin);
    if (knownOrigin) markArtifactFound(id, state);
    else state._artifactFound?.delete(id);
}

// C artifact.c:dump_artifact_info(). This includes artifacts the hero has
// never encountered; the creation flags describe game state, not discoveries.
export function artifactInfoLines(state: GameState = game): string[] {
    return artifactList(state).map(artifact => {
        const exists = state._artifactExists?.has(artifact.id) ? 'exists;' : '';
        const found = state._artifactFound?.has(artifact.id) ? ' hero knows;' : '';
        const origin = state._artifactOrigins?.get(artifact.id);
        return `  ${artifact.name.slice(0, 36).padEnd(36)}[${exists}${found}${origin ? ` ${origin}` : ''}]`;
    });
}

export function uncreateArtifact(
    object: GameObject | null | undefined,
    state: GameState = game,
): boolean {
    if (!object?.oartifact) return false;
    const removed = state._artifactExists?.delete(object.oartifact) ?? false;
    state._artifactFound?.delete(object.oartifact);
    state._artifactOrigins?.delete(object.oartifact);
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
    recordGameLogEvent(`found ${name}${where}`, { state, flags: LL_ARTIFACT });
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

// C mondata.c:defended() — explmu()'s base immunity test for the exploding
// monster itself: a wielded artifact that defends against the damage type,
// or dragon scales — worn as body armor, or implicit in an adult dragon's
// own body. Unlike the carries-defense helpers above, items that merely
// defend while carried do not count.
const SCALE_DEFENDING_DRAGON: Partial<Record<NonNullable<ArtifactDefenseQuery>, string>> = {
    fire: 'red dragon',
    cold: 'white dragon',
    shock: 'blue dragon',
    hallucination: 'gold dragon',
};

export function monsterWieldsOrWearsDefense(
    monster: ArtifactDefender | null | undefined,
    damageType: ArtifactDefenseQuery,
    state: GameState,
): boolean {
    if (!monster || damageType == null) return false;
    const weapon = monsterWieldedWeapon(monster);
    if (artifactById(weapon?.oartifact, state)?.defense === damageType) return true;
    const dragonName = SCALE_DEFENDING_DRAGON[damageType];
    if (!dragonName) return false;
    const defender = MONSTER_NAME.indexOf(dragonName);
    if (defender < 0) return false;
    if (monster.mnum === defender) return true; /* an adult dragon is its own suit */
    const worn = (monster.minvent || monster.inventory || [])
        .find(object => ((object.owornmask ?? 0) & W_ARM) !== 0);
    return dragonFormForArmor(worn) === defender;
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
        if (damageType === 'stun' || damageType === 'magic') return !heroState.antimagic;
        return false;
    }
    if (damageType === 'fire') return !monsterHasFireResistance(defender);
    if (damageType === 'cold') return !monsterHasColdResistance(defender);
    if (damageType === 'shock') return !monsterHasShockResistance(defender);
    if (damageType === 'life-drain') return !monsterHasDrainResistance(defender);
    if (damageType === 'stun' || damageType === 'magic') {
        const resistance = MONSTER_MAGIC_RESISTANCE[defender.mnum] ?? 0;
        return random(100) >= resistance;
    }
    return false;
}

// C artifact.c:spec_applies().
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
            const alignment = hero ? state.u?.ualign?.type : questMonsterAlignment(mnum, state);
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

// C artifact.c:artifact_light().
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

// C artifact.c:is_magic_key()/has_magic_key(), for monster carriers.

const PM_ROGUE = MONSTER_NAME.indexOf('rogue');

export function isMonsterMagicKey(monster: Monster, object: GameObject, state: GameState = game): boolean {
    if (artifactById(object.oartifact, state)?.name !== 'The Master Key of Thievery') return false;
    return monster.mnum === PM_ROGUE ? !object.cursed : !!object.blessed;
}

export function heroHasMagicKey(state: GameState = game): boolean {
    return state.inventory.some(object =>
        artifactById(object.oartifact, state)?.name === 'The Master Key of Thievery'
        && (state.urole?.key === 'rogue' ? !object.cursed : object.blessed));
}

export function monsterHasMagicKey(monster: Monster, state: GameState = game): boolean {
    return (monster.minvent || []).some(object => isMonsterMagicKey(monster, object, state));
}

// C artifact.c:set_artifact_intrinsic(). Each artifact contributes its own
// property source, so removing one item preserves other carried sources.

const DEFENSE_PROPERTIES: Partial<Record<ArtifactDefense, PropertyName>> = {
    fire: 'fireResistance', cold: 'coldResistance', magic: 'antimagic',
    poison: 'poisonResistance', 'life-drain': 'drainResistance',
};
const FLAG_PROPERTIES: readonly (readonly [ArtifactFlag, PropertyName])[] = [
    ['SPFX_SEARCH', 'searching'], ['SPFX_ESP', 'telepathy'],
    ['SPFX_STLTH', 'stealth'], ['SPFX_REGEN', 'regeneration'],
    ['SPFX_TCTRL', 'teleportControl'], ['SPFX_EREGEN', 'energyRegeneration'],
    ['SPFX_HSPDAM', 'halfSpellDamage'], ['SPFX_HPHDAM', 'halfPhysicalDamage'],
    ['SPFX_PROTECT', 'protection'],
];

function conferredProperties(artifact: Artifact, carried: boolean): PropertyName[] {
    const flags = carried ? artifact.carriedFlags : artifact.flags;
    const defense = carried ? artifact.carriedDefense : artifact.defense;
    const properties: PropertyName[] = [];
    const resistance = defense && DEFENSE_PROPERTIES[defense];
    if (resistance) properties.push(resistance);
    for (const [flag, property] of FLAG_PROPERTIES)
        if (flags.includes(flag)) properties.push(property);
    if (flags.includes('SPFX_WARN') && artifact.target.kind !== 'flag2')
        properties.push('warning');
    return properties;
}

export async function setCarriedArtifactProperties(
    object: GameObject, active: boolean, state: GameState = game,
): Promise<void> {
    const artifact = artifactById(object.oartifact, state);
    if (!artifact) return;
    for (const property of conferredProperties(artifact, true)) {
        setCarriedProperty(property, object, active, state);
        if (property === 'telepathy'
            && (active || !hasCarriedProperty('telepathy', null, state))) {
            recalculateTelepathyRange(state);
            await see_monsters();
        }
    }
}

export function setWornArtifactProperties(
    object: GameObject, slot: WornPropertySlot, active: boolean, state: GameState = game,
): void {
    recalculateTelepathyRange(state);
    const artifact = artifactById(object.oartifact, state);
    if (!artifact) return;
    const properties = conferredProperties(artifact, false);
    if (slot === 'uwep') {
        if (artifact.flags.includes('SPFX_REFLECT')) properties.push('reflection');
        if (artifact.enumName === 'SUNSWORD') properties.push('blindResistance');
    }
    for (const property of properties) {
        if (active) grantWornProperty(property, object, slot, state);
        else removeWornProperty(property, object, slot, state);
    }
    if (artifact.flags.includes('SPFX_XRAY')) {
        state.u.xray_range = active ? 3 : -1;
        state.vision_full_recalc = 1;
    }
}

// C artifact.c:set_artifact_intrinsic(), Sting_effects(), glow_verb().


function glowStrength(count: number): 0 | 1 | 2 | 3 {
    return count > 12 ? 3 : count > 4 ? 2 : count > 0 ? 1 : 0;
}

// C artifact.c:glow_verb().
export function artifactGlowVerb(count: number, continuous = false): string {
    const verbs = ['quiver', 'flicker', 'glimmer', 'gleam'] as const;
    const verb = verbs[glowStrength(count)];
    return continuous ? `${verb}ing` : verb;
}

export function wieldedArtifactWarns(state: GameState = game): boolean {
    const object = state.uwep;
    return !!(
        object &&
        (object.owornmask ?? 0) & W_WEP &&
        artifactWarningMask(object, state) &&
        wornObjectGrantsProperty(object, 'warnOfMonster', state)
    );
}

export async function setArtifactWarningWielded(
    object: GameObject,
    active: boolean,
    state: GameState = game,
): Promise<void> {
    const mask = artifactWarningMask(object, state);
    if (!mask) return;
    requireLiveGame(state);
    const warning = (state.context.warntype ||= { obj: 0, polyd: 0, speciesidx: -1 });
    if (active) {
        grantWornProperty('warnOfMonster', object, 'uwep', state);
        warning.obj = (warning.obj || 0) | mask;
    } else {
        removeWornProperty('warnOfMonster', object, 'uwep', state);
        warning.obj = (warning.obj || 0) & ~mask;
    }
    await see_monsters();
}

// The census owns count commits. -1 announces a sight change without recounting.
// C artifact.c:Sting_effects().
export async function artifactWarningFeedback(
    count: number,
    { beforeGlow = null }: { beforeGlow?: (() => void | Promise<void>) | null } = {},
) {
    const object = game.uwep;
    if (!object || !artifactWarningMask(object)) return;
    const previous = game.warn_obj_cnt;
    const oldStrength = glowStrength(previous);
    const newStrength = glowStrength(count);
    const blind = heroIsBlind();
    const artifact = artifactById(object.oartifact);
    if (!artifact) throw new Error('Warning weapon requires a known artifact');
    const name = artifact.name.replace(/^the /i, '');
    if (count === -1 && previous > 0) {
        await plineWithContinuation(`${name} is ${artifactGlowVerb(blind ? 0 : previous, true)}.`);
    } else if (newStrength > 0 && newStrength !== oldStrength) {
        if (beforeGlow) await beforeGlow();
        if (!blind) {
            const verb = verbForSubject(null, artifactGlowVerb(count));
            const color = displayColorName(artifactGlowColor(object));
            await plineWithContinuation(
                `${name} ${verb} ${color}${newStrength > oldStrength ? '!' : '.'}`,
            );
        } else if (oldStrength === 0) {
            await plineWithContinuation(`${name} quivers slightly.`);
        }
    } else if (count === 0 && previous > 0) {
        await plineWithContinuation(
            `${name} stops ${artifactGlowVerb(blind ? 0 : previous, true)}.`,
        );
    }
}

// C mkot_trap_warn(): warmth counts locations whose trap is not displayed,
// including trapped doors and containers beneath other floor objects.
// C artifact.c:count_surround_traps().
export async function warnWithMasterKey(state: GameState = game): Promise<void> {
    const weapon = state.uwep;
    if (state.uarmg || artifactById(weapon?.oartifact, state)?.enumName !== 'MASTER_KEY_OF_THIEVERY') {
        state._magicKeyTrapWarningCount = 0;
        return;
    }
    requireLiveGame(state);
    let count = 0;
    for (let x = state.u.ux - 1; x <= state.u.ux + 1; x++) {
        for (let y = state.u.uy - 1; y <= state.u.uy + 1; y++) {
            if (!isok(x, y) || glyphAt(x, y, state)?.kind === 'trap') continue;
            const spot = state.level?.at(x, y);
            if (state.level?.traps.some(trap => trap.tx === x && trap.ty === y)
                || spot?.typ === DOOR && (spot.doormask & D_TRAPPED)
                || state.level?.objects[x]?.[y]?.some(object => isContainer(object) && object.otrapped))
                count++;
        }
    }
    if (count !== state._magicKeyTrapWarningCount) {
        const heat = ['cool', 'slightly warm', 'warm', 'very warm', 'hot', 'very hot', 'like fire'];
        await plineWithContinuation(`The Key feels ${heat[Math.min(count, 6)]}${count > 3 ? '!' : '.'}`);
    }
    state._magicKeyTrapWarningCount = count;
}

// C artifact.c:arti_speak(). Speaking artifacts select rumors by their BUC.


export async function speakArtifact(
    object: GameObject,
    { state = game }: { state?: GameState } = {},
): Promise<boolean> {
    requireLiveGame(state);
    if (!artifactById(object?.oartifact, state)?.flags.includes('SPFX_SPEAK')) return false;
    const truth = object.blessed ? 1 : object.cursed ? -1 : 0;
    const line = getRumor(true, truth) || 'NetHack rumors file closed for renovation.';
    // Both speaking artifacts have definite names, even when unidentified.
    const name = objectName(object, state).replace(/^the /i, '');
    await plineWithContinuation(`The ${name} ${objectNameIsPlural(object, state) ? 'whisper' : 'whispers'}:`);
    // Native arti_speak does not check deafness before verbalize.
    await plineWithContinuation(`"${line}"`);
    return true;
}

// The visible hero transaction for touching an artifact.
// C ref: artifact.c touch_artifact().


export interface HeroArtifactTouchResult extends ArtifactTouchResult {
    died: boolean;
    damage?: number;
}

function heroCarries(object: GameObject, state: GameState): boolean {
    return object?.where === 'inventory' || (state.inventory || []).includes(object);
}

export async function touchArtifactByHero(
    object: GameObject,
    artifact: Artifact | null = artifactById(object?.oartifact),
    {
        state = game,
        publish = plineWithContinuation,
        die = finishHeroDeath,
    }: {
        state?: GameState;
        publish?: MessagePublisher;
        die?: DeathHandler;
    } = {},
): Promise<HeroArtifactTouchResult> {
    const result = resolveHeroArtifactTouch(object, artifact, state);
    if (!artifact || !object?.oartifact) return { ...result, died: false };

    let died = false;
    let damage = 0;
    if (result.blasted) {
        const name = definiteName(objectCombatName(object, { state }), state);
        await publish(`You are blasted by ${name}${name.endsWith('s') ? "'" : "'s"} power!`);
        damage = rollHeroArtifactBlast(object, artifact, state);
        // C touch_artifact(): losehp(dmg, "touching <artifact>", KILLED_BY).
        died = await loseHeroHp(damage, `touching ${artifact.name}`, {
            state,
            publish,
            die,
            killerFormat: KILLED_BY,
        });
        if (!died) await exerciseAttribute(A_WIS, false, state);
    }

    if (!died && !result.allowed) {
        const name = definiteName(objectCombatName(object, { state }), state);
        const subject = name.charAt(0).toUpperCase() + name.slice(1);
        const plural = objectNameIsPlural(object, state);
        await publish(
            heroCarries(object, state)
                ? `${subject} ${plural ? 'are' : 'is'} beyond your control!`
                : `${subject} ${plural ? 'evade' : 'evades'} your grasp!`,
        );
    }
    return { ...result, damage, died };
}

// Artifact weapon damage and special-hit effects.
// C ref: artifact.c artifact_hit().


export interface ArtifactHitOptions {
    state?: GameState;
    /** Omitted for a hero attack or a falling weapon. */
    attacker?: Monster;
    visible?: boolean;
    realizesDamage?: boolean;
    describeTarget?: () => string;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    dieRoll?: number;
    hitOnHead?: boolean;
}

export type ArtifactHitDefender = Monster | 'hero';

export interface ArtifactHitDamage {
    damage: number;
    specialMessage: boolean;
    attackStopped?: boolean;
    heroDied?: false;
}

export interface ArtifactHitHeroDeath {
    heroDied: true;
    damage?: never;
    specialMessage?: never;
    attackStopped?: never;
}

export type ArtifactHitResult = ArtifactHitDamage | ArtifactHitHeroDeath;

interface BeheadingOptions {
    state: GameState;
    attacker: Monster | undefined;
    visible: boolean;
    hittee: string;
    dieRoll: number;
    hitOnHead: boolean;
    describeTarget: () => string;
    publish: MessagePublisher;
    random: typeof rn2;
}

interface LifeDrainOptions {
    state: GameState;
    attacker: Monster | undefined;
    visible: boolean;
    describeTarget: () => string;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
}

const PM_WATER_ELEMENTAL = 157;
const PM_JABBERWOCK = MONSTER_NAME.indexOf('jabberwock');
// Native fatal blows leave enough damage for the caller's AC reduction.
const FATAL_DAMAGE_MODIFIER = 200;

export async function applyArtifactHit(
    object: GameObject | null | undefined,
    defender: ArtifactHitDefender,
    baseDamage: number,
    {
        state = game,
        attacker,
        // C artifact.c:1456-1466: vis is seeing the attacker, seeing the
        // defender, or a hero attacker engulfing its defender; realizes_damage
        // is defending as the hero or vis. A Null attacker has neither an
        // attacker square nor youattack, so an engulfed thrower that cannot
        // be seen realizes nothing here.
        visible = defender !== 'hero' && cansee(defender.mx, defender.my)
            || !!attacker && cansee(attacker.mx, attacker.my),
        realizesDamage = defender === 'hero' || visible,
        describeTarget = () => defender === 'hero' ? 'you' : monsterName(defender, { state }),
        publish = async () => {},
        random = rn2,
        rollOne = rnd,
        dieRoll = 0,
        hitOnHead = true,
    }: ArtifactHitOptions = {},
): Promise<ArtifactHitResult> {
    const artifact = artifactById(object?.oartifact, state);
    if (!object || !artifact?.attack) {
        return { damage: baseDamage, specialMessage: false };
    }

    // Native hittee is captured before spec_dbon. Elemental and Magicbane
    // prose retain this noun; beheading and drain explicitly name again.
    const hittee = describeTarget();
    const target = defender === 'hero' ? { mnum: heroSpecies(state) } : defender;
    const bonus = artifactDamageBonus(object, target, baseDamage, rollOne, {
        random, state, hero: defender === 'hero',
    });
    let damage = baseDamage + bonus;
    const damageType = artifact.attack.damageType;
    const inventoryDamage = elementalDamageType(damageType);
    if (artifact.name === 'Magicbane' && dieRoll <= 8) {
        return applyMagicbaneHit(object, defender, damage, bonus > 0, {
            state,
            attacker,
            visible,
            dieRoll,
            hitOnHead,
            targetName: hittee,
            describeTarget,
            publish,
            random,
            rollOne,
        });
    }
    if (!inventoryDamage) {
        if (damageType === 'magic') {
            if (realizesDamage) await publish(bonus > 0
                ? `The imaginary widget hits!  A hail of magic missiles strikes ${hittee}!`
                : `The imaginary widget hits ${hittee}.`);
            return { damage, specialMessage: realizesDamage };
        }
        if (bonus > 0) {
            const beheading = await applyBeheading(artifact, object, defender, damage, {
                state, attacker, visible, hittee, dieRoll, hitOnHead,
                describeTarget, publish, random,
            });
            if (beheading) return beheading;
            if (artifact.flags.includes('SPFX_DRLI')) {
                return applyLifeDrain(artifact, object, defender, damage, {
                    state, attacker, visible, describeTarget, publish, random, rollOne,
                });
            }
        }
        return { damage, specialMessage: false };
    }

    const applied = bonus > 0;
    if (realizesDamage) {
        const message = elementalHitMessage(damageType, applied, target, hittee);
        if (message) await publish(message);
    }
    if (damageType === 'shock' && applied) {
        // Native youmonst's coordinates stay (0, 0), separate from u.ux/u.uy.
        const x = defender === 'hero' ? 0 : defender.mx;
        const y = defender === 'hero' ? 0 : defender.my;
        await wakeMonstersNearWithMessages(x, y, 16, state, publish);
    }

    if (random(inventoryDamageChance(damageType)) === 0) {
        if (defender === 'hero') {
            const destroyed = await destroyInventoryByElement(inventoryDamage, damage, {
                state, publish, random, rollOne,
            });
            if (destroyed.heroDied) return { heroDied: true };
            // ignite_items(youmonst.minvent) has no items; invent is separate.
        } else {
            damage += await destroyMonsterInventoryByElement(defender, inventoryDamage, damage, {
                state, publish, random, rollOne, visible: canSeeMonster(defender),
            });
            if (damageType === 'fire') {
                await igniteItems(defender.minvent || defender.inventory, {
                    state, publish, random,
                    visible: cansee(defender.mx, defender.my),
                });
            }
        }
    }
    if (defender === 'hero' && damageType === 'fire') await burnAwayHeroSlime(state, publish);

    return { damage, specialMessage: realizesDamage };
}

function elementalDamageType(damageType: ArtifactDamage) {
    if (damageType === 'cold') return INVENTORY_DAMAGE.COLD;
    if (damageType === 'fire') return INVENTORY_DAMAGE.FIRE;
    if (damageType === 'shock') return INVENTORY_DAMAGE.ELECTRIC;
    return null;
}

function elementalHitMessage(
    damageType: ArtifactDamage,
    applied: boolean,
    monster: ArtifactDefender,
    targetName: string,
) {
    if (damageType === 'fire') {
        const verb = !applied
            ? 'hits'
            : monster.mnum === PM_WATER_ELEMENTAL
              ? 'vaporizes part of'
              : 'burns';
        return `The fiery blade ${verb} ${targetName}${applied ? '!' : '.'}`;
    }
    if (damageType === 'cold') {
        return `The ice-cold blade ${applied ? 'freezes' : 'hits'} ${
            targetName
        }${applied ? '!' : '.'}`;
    }
    if (damageType === 'shock') {
        return applied
            ? `The massive hammer hits!  Lightning strikes ${targetName}!`
            : `The massive hammer hits ${targetName}.`;
    }
    return null;
}

function inventoryDamageChance(damageType: ArtifactDamage) {
    return damageType === 'shock' ? 5 : 4;
}

function observeArtifactObject(object: GameObject, state: GameState) {
    const hallucinating = heroIsHallucinating(state);
    if (hallucinating) return;
    object.dknown = true;
    recordObjectEncounter(object.otyp, state);
}

function possessiveTarget(target: string) {
    if (target === 'it') return 'its';
    return target.endsWith('s') ? `${target}'` : `${target}'s`;
}

async function applyBeheading(
    artifact: Artifact,
    object: GameObject,
    defender: ArtifactHitDefender,
    damage: number,
    { state, attacker, visible, hittee, dieRoll, hitOnHead, describeTarget, publish, random }: BeheadingOptions,
): Promise<ArtifactHitDamage | null> {
    if (!artifact.flags.includes('SPFX_BEHEAD')) return null;
    if (defender === 'hero') {
        requirePlayingGame(state);
        const species = { mnum: heroSpecies(state) };
        const fatalDamage = 2 * (Upolyd(state.u) ? state.u.mh : state.u.uhp)
            + FATAL_DAMAGE_MODIFIER;
        if (artifact.name === 'The Tsurugi of Muramasa' && dieRoll === 1) {
            if ((MONSTER_SIZE[species.mnum] ?? 2) >= 3) {
                const subject = attacker ? monsterName(attacker, { state, capitalized: true })
                    : 'The razor-sharp blade';
                await publish(`${subject} cuts deeply into you!`);
                return { damage: damage * 2, specialMessage: true };
            }
            await publish('The razor-sharp blade cuts you in half!');
            observeArtifactObject(object, state);
            return { damage: fatalDamage, specialMessage: true };
        }
        if (artifact.name !== 'Vorpal Blade'
            || (dieRoll !== 1 && species.mnum !== PM_JABBERWOCK)) return null;
        if (!monsterHasHead(species)) {
            const subject = attacker ? monsterName(attacker, { state }) : 'Vorpal Blade';
            await publish(`Somehow, ${subject} misses you wildly.`);
            return { damage: 0, specialMessage: true };
        }
        if (monsterIsNoncorporeal(species) || monsterIsAmorphous(species)) {
            await publish(`Vorpal Blade slices through your ${monsterNeckName(species.mnum)}.`);
            return { damage, specialMessage: true };
        }
        await publish(`Vorpal Blade ${random(2) === 0 ? 'beheads' : 'decapitates'} you!`);
        observeArtifactObject(object, state);
        return { damage: fatalDamage, specialMessage: true };
    }
    const monster = defender;
    const swallowed = !attacker && !!state.u.uswallow && state.u.ustuck === monster;

    if (artifact.name === 'The Tsurugi of Muramasa') {
        if (dieRoll !== 1) return null;
        if (swallowed) {
            await publish(`You slice ${describeTarget()} wide open!`);
            return {
                damage: 2 * monster.mhp + FATAL_DAMAGE_MODIFIER,
                specialMessage: true,
            };
        }
        if (!hitOnHead) return null;
        if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 3) {
            if (!attacker) await publish(`You slice deeply into ${describeTarget()}!`);
            else if (visible) {
                const attackerName = monsterName(attacker, { state, capitalized: true });
                await publish(`${attackerName} cuts deeply into ${hittee}!`);
            }
            return { damage: damage * 2, specialMessage: true };
        }
        await publish(`The razor-sharp blade cuts ${describeTarget()} in half!`);
        observeArtifactObject(object, state);
        return {
            damage: 2 * monster.mhp + FATAL_DAMAGE_MODIFIER,
            specialMessage: true,
        };
    }

    if (
        artifact.name !== 'Vorpal Blade' ||
        (dieRoll !== 1 && monster.mnum !== PM_JABBERWOCK) ||
        swallowed
    )
        return null;
    if (!monsterHasHead(monster) || !hitOnHead || state.u.uswallow) {
        if (!attacker) await publish(`Somehow, you miss ${describeTarget()} wildly.`);
        else if (visible) {
            await publish(`Somehow, ${monsterName(attacker, { state })} misses wildly.`);
        }
        return { damage: 0, specialMessage: !attacker || visible, attackStopped: true };
    }
    if (monsterIsNoncorporeal(monster) || monsterIsAmorphous(monster)) {
        await publish(`Vorpal Blade slices through ${possessiveTarget(describeTarget())} ${monsterNeckName(monster.mnum)}.`);
        return { damage, specialMessage: true };
    }

    const verb = random(2) === 0 ? 'beheads' : 'decapitates';
    await publish(`Vorpal Blade ${verb} ${describeTarget()}!`);
    if (heroIsHallucinating(state) && !state.flags.female) {
        await publish("Good job Henry, but that wasn't Anne.");
    }
    observeArtifactObject(object, state);
    return {
        damage: 2 * monster.mhp + FATAL_DAMAGE_MODIFIER,
        specialMessage: true,
    };
}

async function applyLifeDrain(
    artifact: Artifact,
    object: GameObject,
    defender: ArtifactHitDefender,
    damage: number,
    { state, attacker, visible, describeTarget, publish, random, rollOne }: LifeDrainOptions,
): Promise<ArtifactHitResult> {
    if (defender === 'hero') {
        requirePlayingGame(state);
        const life = monsterIsNonliving(heroSpecies(state)) ? 'animating force' : 'life';
        if (heroIsBlind(state)) {
            await publish(formatFeltMessage(`an ${artifact.name === 'Stormbringer'
                ? 'unholy blade' : 'object'} drain your ${life}!`, state));
        } else {
            observeDistantObjectForNaming(object, state);
            const weapon = artifact.name === 'Stormbringer'
                ? `${displayColorName('black', state)} blade` : objectName(object, state);
            await publish(`The ${weapon} drains your ${life}!`);
        }
        const oldMaximum = state.u.uhpmax;
        if (await loseHeroExperience('life drainage', { state, publish })) return { heroDied: true };
        if (attacker && attacker.mhp < attacker.mhpmax) {
            healMonster(attacker, Math.trunc((Math.abs(oldMaximum - state.u.uhpmax) + 1) / 2));
        }
        return { damage, specialMessage: true };
    }
    const monster = defender;
    let drain = monsterHitPointsPerLevel(monster, {
        rollOne,
        randomBelow: random,
    });
    const level = monster.m_lev ?? 0;
    const maximumHitPoints = monster.mhpmax ?? monster.mhp ?? 1;
    if (maximumHitPoints - drain <= level) {
        drain = maximumHitPoints > level ? maximumHitPoints - (level + 1) : 0;
    }

    if (visible) {
        // Native distant_name observes the weapon even when Stormbringer's
        // special description replaces that name in the message.
        observeDistantObjectForNaming(object, state);
        const weaponName = objectName(object, state);
        const life = monsterIsNonliving(monster.mnum) ? 'animating force' : 'life';
        const weapon = artifact.name === 'Stormbringer'
            ? `The ${displayColorName('black', state)} blade`
            : `The ${weaponName}`;
        await publish(`${weapon} draws the ${life} from ${describeTarget()}!`);
    }

    if (level === 0) {
        damage = 2 * monster.mhp + FATAL_DAMAGE_MODIFIER;
    } else {
        damage += drain;
        monster.mhpmax = maximumHitPoints - drain;
        monster.m_lev = level - 1;
    }
    const healing = Math.trunc((drain + 1) / 2);
    if (healing > 0) {
        if (attacker) healMonster(attacker, healing);
        else healHeroFromDrain(state, healing);
    }
    return { damage, specialMessage: visible };
}

function healHeroFromDrain(state: GameState, amount: number) {
    if (amount <= 0) return;
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    const maximum = Upolyd(state.u) ? 'mhmax' : 'uhpmax';
    const currentHitPoints = state.u[hitPoints];
    const maximumHitPoints = state.u[maximum] ?? currentHitPoints;
    if (currentHitPoints === undefined || maximumHitPoints === undefined)
        throw new Error('Life drain requires initialized hero hit points.');
    state.u[hitPoints] = Math.min(maximumHitPoints, currentHitPoints + amount);
    state.context.botl = true;
}

// Artifact powers used by the #invoke command.
// C ref: artifact.c arti_invoke() and its invoke_* helpers.


type PropertyPowerName = 'conflict' | 'invisibility' | 'levitation';
type PropertyArtifact = Artifact & { invokePower: PropertyPowerName };

const M2_LORD = 0x400;
const M2_PRINCE = 0x800;
const S_IMP = 9;
const MS_NEMESIS = 37;

interface InvokedPropertyPower {
    property: PropertyName;
    hasOtherSource: (state: GameState) => boolean;
    sync: (state: GameState) => void;
}

type PropertyInvocationResult =
    | { used: true; ready: false; on: false }
    | { used: true; ready: true; on: boolean };

export type ArtifactInvocationResult =
    | PropertyInvocationResult
    | { used: false }
    | { used: true; ready: false }
    | { used: true; ready: true; spentTime?: boolean }
    | { used: true; heroDied: true };

interface ArtifactInvocationOptions {
    state?: GameState;
    publish?: MessagePublisher;
    rollDice?: (count: number, sides: number) => number;
    rollOne?: (limit: number) => number;
    scaledRandom?: (range: number) => number;
    enterTrap?: UntrapOptions['enterTrap'];
}

const DIRECT_POWERS = [
    'healing',
    'energy-boost',
    'enlightening',
    'create-ammo',
    'untrap',
    'charge-object',
    'blinding-ray',
    'snowstorm',
    'firestorm',
    'level-teleport',
    'create-portal',
    'banish',
    'fling-poison',
] as const;

function isDirectPower(power: ArtifactPower | null): power is (typeof DIRECT_POWERS)[number] {
    return DIRECT_POWERS.some((candidate) => candidate === power);
}

// C do_wear.c-style extrinsic check: an invoked artifact is nothing special
// while an independent intrinsic (including the potion timeout), worn ring,
// or boots source also grants levitation (artifact.c:2197-2201).
function hasNonArtifactLevitation(state: GameState): boolean {
    return propertyHasOtherSources('levitation', state);
}

function syncHeroLevitation(state: GameState): void {
    refreshProperty('levitation', state);
}

const PROPERTY_POWERS = Object.freeze({
    conflict: {
        property: 'conflict',
        hasOtherSource: hasNonArtifactConflict,
        sync: syncHeroConflict,
    },
    invisibility: {
        property: 'invisible',
        hasOtherSource: hasNonArtifactInvisibility,
        sync: syncHeroInvisibility,
    },
    levitation: {
        property: 'levitation',
        hasOtherSource: hasNonArtifactLevitation,
        sync: syncHeroLevitation,
    },
} satisfies Record<PropertyPowerName, InvokedPropertyPower>);

function isPropertyArtifact(artifact: Artifact | null | undefined): artifact is PropertyArtifact {
    const power = artifact?.invokePower;
    return power === 'conflict' || power === 'invisibility' || power === 'levitation';
}

export function artifactInvokeIsActive(
    artifact: Artifact | null | undefined,
    state: GameState = game,
): boolean {
    return (
        isPropertyArtifact(artifact) &&
        hasInvokedProperty(PROPERTY_POWERS[artifact.invokePower].property, state)
    );
}

async function nothingSpecial(
    object: GameObject,
    state: GameState,
    publish: MessagePublisher,
): Promise<void> {
    if ((state.inventory || []).includes(object)) {
        await publish(formatFeltMessage('a surge of power, but nothing seems to happen.', state));
    }
}

async function beginInvocation(
    object: GameObject,
    artifact: Artifact,
    state: GameState,
    publish: MessagePublisher,
    rollDice: (count: number, sides: number) => number,
    scaledRandom: (range: number) => number,
): Promise<boolean> {
    requirePlayingGame(state);
    const turn = state.moves ?? 0;
    if ((object.age ?? 0) > turn) {
        const energyCost = artifact.invokePower === 'blinding-ray'
            || artifact.invokePower === 'fling-poison' ? 25 : -1;
        if (energyCost < 0 || state.u.uen < energyCost) {
            await ignoringHero(object, state, publish);
            object.age += rollDice(3, 10);
            return false;
        }
        await publish(formatFeltMessage('drained...', state));
        state.u.uen -= energyCost;
        state.context.botl = true;
    } else {
        object.age = turn + scaledRandom(100);
    }
    return true;
}

async function ignoringHero(object: GameObject, state: GameState, publish: MessagePublisher) {
    const subject = definiteName(objectCombatName(object, { state }), state);
    await publish(formatFeltMessage(`that ${subject} ${objectNameIsPlural(object, state) ? 'are' : 'is'} ignoring you.`, state));
}

async function invokeProperty(
    object: GameObject,
    artifact: PropertyArtifact,
    state: GameState,
    publish: MessagePublisher,
    rollDice: (count: number, sides: number) => number,
    scaledRandom: (range: number) => number,
): Promise<PropertyInvocationResult> {
    // Artifact property toggles mutate the invoked source and the object's
    // invoke cooldown, then run the live float owners.
    requireLiveGame(state);
    const power = PROPERTY_POWERS[artifact.invokePower];
    const turn = state.moves ?? 0;
    const on = !hasInvokedProperty(power.property, state);
    // C toggles the artifact's extrinsic bit before every check (artifact.c
    // 2179).  Capture the levitation masks first so the shared float owners
    // can still report the pre-toggle flying and blocked state.
    const previous = power.property === 'levitation' ? captureLevitationState(state) : null;
    setInvokedProperty(power.property, object, on, state);

    if (on && (object.age ?? 0) > turn) {
        setInvokedProperty(power.property, object, false, state);
        power.sync(state);
        await ignoringHero(object, state, publish);
        object.age += rollDice(3, 10);
        return { used: true, ready: false, on: false };
    }
    if (!on) object.age = turn + scaledRandom(100);

    const hasOtherSource = power.hasOtherSource(state);
    power.sync(state);
    if (hasOtherSource) {
        await nothingSpecial(object, state, publish);
        return { used: true, ready: true, on };
    }

    if (artifact.invokePower === 'conflict') {
        await publish(
            formatFeltMessage(on ? 'like a rabble-rouser.' : 'the tension decrease around you.', state),
        );
        return { used: true, ready: true, on };
    }

    if (artifact.invokePower === 'levitation') {
        // artifact.c:2209-2215.  Unlike Ring_on(), this spoteffects() call
        // is unconditional; the other-source guard above already ensured no
        // independent levitation keeps the hero aloft.
        if (on) {
            await floatHeroUp(state, previous);
            await applyHeroLocationEffects(publish, { pick: false });
        } else {
            await floatHeroDown(I_SPECIAL | TIMEOUT, W_ARTI, state, previous);
        }
        return { used: true, ready: true, on };
    }

    if (invisibilityIsBlocked(state) || heroIsBlind(state)) {
        await nothingSpecial(object, state, publish);
        return { used: true, ready: true, on };
    }
    await newsym(state.u.ux, state.u.uy);
    if (on) {
        const transparency = heroIsHallucinating(state) ? 'normal' : 'strange';
        await publish(`Your body takes on a ${transparency} transparency...`);
    } else {
        await publish('Your body seems to unfade...');
    }
    return { used: true, ready: true, on };
}

async function invokeHealing(
    object: GameObject,
    state: GameState,
    publish: MessagePublisher,
): Promise<void> {
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const hitPoints = polymorphed ? 'mh' : 'uhp';
    const maximumHitPoints = polymorphed ? 'mhmax' : 'uhpmax';
    const current = hero[hitPoints] ?? 0;
    const maximum = hero[maximumHitPoints] ?? current;
    const healing = Math.trunc((maximum + 1 - current) / 2);
    const cream = hero.ucreamed ?? 0;
    const curesBlindness = (hero.blindTurns ?? 0) > cream;
    const permanent = permanentBlind(state) || hasIntrinsicProperty('blinded', null, state);
    const treatsIllness = heroIsSick(state) || heroIsSliming(state);
    // The first native check compares boolean Blinded (0 or 1) with cream;
    // the second compares the blindness timeout.
    if (healing !== 0 || treatsIllness || Number(heroIsBlinded(state)) > cream)
        await publish(formatFeltMessage('better.', state));
    const helps = healing !== 0 || treatsIllness || curesBlindness;

    if (!helps) {
        await nothingSpecial(object, state, publish);
        return;
    }
    await publish(formatFeltMessage(!healing && !treatsIllness && permanent ? 'slightly better.' : 'better.', state));
    if (healing > 0) hero[hitPoints] = current + healing;
    cureHeroSickness(state);
    clearHeroSliming(state);
    if (curesBlindness) await makeBlinded(cream, { state, talk: false, publish });
    state.context.botl = true;
}

async function invokeEnergyBoost(
    object: GameObject,
    state: GameState,
    publish: MessagePublisher,
): Promise<void> {
    const hero = state.u;
    const missing = Math.max(0, (hero.uenmax ?? 0) - (hero.uen ?? 0));
    let restored = Math.trunc((missing + 1) / 2);
    if (restored > 120) restored = 120;
    else if (restored < 12) restored = missing;

    if (!restored) {
        await nothingSpecial(object, state, publish);
        return;
    }
    hero.uen = (hero.uen ?? 0) + restored;
    state.context.botl = true;
    await publish(formatFeltMessage('re-energized.', state));
}

async function invokeCreateAmmo(
    object: GameObject,
    rollOne: (limit: number) => number,
    state: GameState,
    publish: MessagePublisher,
): Promise<void> {
    const arrows = await mksobj(ARROW, true, false);
    arrows.blessed = !!object.blessed;
    arrows.cursed = !!object.cursed;
    arrows.bknown = !!object.bknown;
    arrows.oeroded = 0;
    arrows.oeroded2 = 0;
    if (object.blessed) {
        if (arrows.spe < 0) arrows.spe = 0;
        arrows.quan += rollOne(10);
    } else if (object.cursed) {
        if (arrows.spe > 0) arrows.spe = 0;
    } else {
        arrows.quan += rollOne(5);
    }
    arrows.quantity = arrows.quan;
    arrows.owt = objectWeight(arrows);
    await holdAnotherObject(arrows, {
        state, publish,
        dropMessage: `Suddenly ${arrows.quan} ${objectCombatName(arrows, { state })} fall out.`,
    });
}

async function invokeBlindingRay(object: GameObject, state: GameState, publish: MessagePublisher) {
    requireLiveGame(state);
    const direction = await promptDirection();
    if (!direction) {
        await publish('Never mind.');
        object.age = state.moves;
        // artifact.c:invoke_blinding_ray() returns ECMD_CANCEL.
        commandResultCancelled(state);
        return false;
    }
    if (direction.dx || direction.dy) {
        await doBlindingRay(object, direction, { state });
    } else if (direction.dz) {
        await lightRoom(true, { radius: 0, source: object,
            finishMonsterKill: finishHeroMonsterKillOutcome });
        const spot = state.level?.at(state.u.ux, state.u.uy);
        await publish(!heroIsBlind(state) && spot?.lit && !spot.waslit
            ? 'It is lit here now.' : 'Nothing seems to happen.');
    } else {
        const vulnerable = heroSpecies(state) === MONSTER_NAME.indexOf('gremlin');
        const damage = object.blessed ? 15 : object.cursed ? 5 : 10;
        if (vulnerable) await lightDamage(object, true, 2 * damage, { state });
        if (!state.program_state.gameover
            && !await flashBurn(damage + rnd(damage), false, { state, publish }) && !vulnerable)
            await publish('Nothing seems to happen.');
    }
    return true;
}

async function invokeStorm(power: 'snowstorm' | 'firestorm', state: GameState) {
    const spell = power === 'snowstorm' ? SPE_CONE_OF_COLD : SPE_FIREBALL;
    const skill = ensureHeroSkills(state)?.[spellSkillType(spell, state)];
    if (!skill) throw new Error('Artifact storm requires initialized spell skills');
    const previous = skill.skill;
    skill.skill = P_EXPERT;
    try {
        await castSpell(spell, { force: true, state });
    } finally {
        skill.skill = previous;
    }
}

async function invokeCreatePortal(object: GameObject, state: GameState, publish: MessagePublisher) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const tutorial = state.specialLevels?.get('tut-1')?.dnum;
    const choices = new Map<string, number>();
    const rows: string[] = [];
    let destinationIndex = 0;
    for (const [index, dungeon] of state.dungeons.entries()) {
        if (!dungeon.dunlev_ureached || index === tutorial) continue;
        const letter = String.fromCharCode(97 + choices.size);
        choices.set(letter, index);
        rows.push(`${letter} - ${dungeon.dname}`);
        destinationIndex = index;
    }
    if (choices.size > 1) {
        const selected = await showPagedPickOneMenu({
            rows, choices, prompt: 'Open a portal to which dungeon?',
        });
        if (selected === null) {
            await nothingSpecial(object, state, publish);
            return;
        }
        destinationIndex = selected;
    }
    const dungeon = state.dungeons[destinationIndex];
    if (!dungeon) throw new Error('Artifact portal requires an initialized destination dungeon');
    const destination = {
        dnum: destinationIndex,
        dlevel: dungeon.depth_start >= depth(state.u.uz, state.dungeons)
            ? dungeon.entry_lev : dungeon.dunlev_ureached,
    };
    if (state.u.uhave.amulet || In_endgame(state.u.uz) || In_endgame(destination)
        || destination.dnum === state.u.uz.dnum || !await bringLeashedFollowers(state)) {
        await publish(formatFeltMessage('very disoriented for a moment.', state));
        return;
    }
    await publish(heroIsBlind(state)
        ? formatFeltMessage('weightless for a moment.', state)
        : 'You are surrounded by a shimmering sphere!');
    await gotoLevel(destination);
}

async function invokeBanish(state: GameState, publish: MessagePublisher) {
    requirePlayingGame(state);
    const hell = state.valley_level;
    const dungeon = hell && state.dungeons[hell.dnum];
    if (!hell || !dungeon) throw new Error('Demon banishment requires initialized Gehennom');
    let vanished = 0;
    let stayed = 0;
    // fmon is newest first; removals and migration must preserve that order.
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0 || !isok(monster.mx, monster.my)) continue;
        const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
        if (!(flags & M2_DEMON) && MONSTER_SYMBOL[monster.mnum] !== S_IMP) continue;
        if (!couldsee(monster.mx, monster.my) || MONSTER_SOUND[monster.mnum] === MS_NEMESIS) continue;
        let chance = 1;
        if (In_quest(state.u.uz) && !state.quest_status?.killed_nemesis) chance += 10;
        if ((flags & (M2_DEMON | M2_PRINCE)) === (M2_DEMON | M2_PRINCE)) chance += 2;
        if ((flags & (M2_DEMON | M2_LORD)) === (M2_DEMON | M2_LORD)) chance++;
        monster.msleeping = monster.mtame = monster.mpeaceful = 0;
        monster.pet = false;
        if (chance > 1 && rn2(chance)) {
            stayed++;
            continue;
        }
        if (In_hell(state.u.uz, state)) {
            await teleportMonsterByHero(monster, { state, giveFeedback: false });
        } else {
            vanished++;
            const rolledLevel = rn2(dungeon.num_dunlevs);
            // C passes this through ledger_no() and migrate_to_level().
            // Local level zero is the preceding dungeon's final ledger entry.
            const dnum = rolledLevel === 0 ? hell.dnum - 1 : hell.dnum;
            const destinationDungeon = state.dungeons[dnum];
            if (!destinationDungeon)
                throw new Error('Demon banishment requires a valid ledger destination');
            await migrateMonsterToLevel(monster, {
                dnum, dlevel: rolledLevel || destinationDungeon.num_dunlevs,
            }, state);
        }
    }
    if (vanished) {
        const subject = vanished === 1 ? 'demon' : 'demons';
        const amount = !stayed ? 'The' : vanished > stayed ? 'Most of the' : 'Some of the';
        await publish(`${amount} ${subject} ${vanished === 1 ? 'disappears' : 'disappear'} in a cloud of brimstone!`);
    }
}

async function invokeFlingPoison(object: GameObject, state: GameState, publish: MessagePublisher) {
    requireLiveGame(state);
    const direction = await promptDirection();
    if (!direction) {
        await publish('Never mind.');
        object.age = state.moves;
        // artifact.c:invoke_fling_poison() returns ECMD_CANCEL.
        commandResultCancelled(state);
        return false;
    }
    const venom = await mksobj(rn2(2) ? BLINDING_VENOM : ACID_VENOM, true, false);
    venom.spe = 1;
    if (!await resolveSwallowedEggPieOrVenomThrow({
        state, item: venom, selectedQuantity: 1,
        finishKill: monster => finishHeroMonsterKillOutcome(monster, monster.mx, monster.my),
    })) {
        await throwOrdinaryObject({
            state, item: venom, quantity: 1, dx: direction.dx, dy: direction.dy,
        });
    }
    return true;
}

// C artifact.c:invoke_charge_obj().
// C artifact.c:invoke_untrap().
export async function invokeArtifactPower(
    object: GameObject,
    artifact: Artifact | null | undefined,
    {
        state = game,
        publish = pline,
        rollDice = d,
        rollOne = rnd,
        scaledRandom = rnz,
        enterTrap = null,
    }: ArtifactInvocationOptions = {},
): Promise<ArtifactInvocationResult> {
    if (!artifact) return { used: false };
    if (isPropertyArtifact(artifact)) {
        return invokeProperty(object, artifact, state, publish, rollDice, scaledRandom);
    }
    const power = artifact.invokePower;
    if (!isDirectPower(power)) return { used: false };
    const ready = await beginInvocation(object, artifact, state, publish, rollDice, scaledRandom);
    if (!ready) return { used: true, ready: false };

    switch (power) {
        case 'fling-poison': {
            const spentTime = await invokeFlingPoison(object, state, publish);
            if (state.program_state.gameover) return { used: true, heroDied: true };
            return { used: true, ready: true, spentTime };
        }
        case 'banish':
            await invokeBanish(state, publish);
            break;
        case 'level-teleport':
            await levelTeleport({ state });
            if (state.program_state.gameover) return { used: true, heroDied: true };
            break;
        case 'create-portal':
            await invokeCreatePortal(object, state, publish);
            if (state.program_state.gameover) return { used: true, heroDied: true };
            break;
        case 'snowstorm':
        case 'firestorm':
            await invokeStorm(power, state);
            if (state.program_state.gameover) return { used: true, heroDied: true };
            break;
        case 'blinding-ray': {
            const spentTime = await invokeBlindingRay(object, state, publish);
            if (state.program_state.gameover) return { used: true, heroDied: true };
            return { used: true, ready: true, spentTime };
        }
        case 'charge-object': {
            const target = await chooseObjectToCharge(state);
            if (!target) {
                object.age = 0;
                // artifact.c:invoke_charge_obj() returns ECMD_CANCEL when
                // getobj() for the charge target is declined.
                commandResultCancelled(state);
                return { used: true, ready: true, spentTime: false };
            }
            const heroRole = state.urole;
            if (object.blessed && artifact.role && !heroRole)
                throw new Error('Artifact recharging requires a chosen hero role');
            const blessedEffect =
                object.blessed && (!artifact.role || artifact.role === heroRole?.key);
            const charged = await rechargeObject(
                target,
                blessedEffect ? 1 : object.cursed ? -1 : 0,
                state,
            );
            if (charged.heroDied) return { used: true, heroDied: true };
            break;
        }
        case 'healing':
            await invokeHealing(object, state, publish);
            break;
        case 'energy-boost':
            await invokeEnergyBoost(object, state, publish);
            break;
        case 'enlightening':
            await showEnlightenment({ basic: false, magic: true });
            break;
        case 'create-ammo':
            await invokeCreateAmmo(object, rollOne, state, publish);
            break;
        case 'untrap': {
            const spentTime = await untrap({
                state,
                force: true,
                enterTrap,
                publish,
            });
            if (state.program_state.gameover) return { used: true, heroDied: true };
            // artifact.c:invoke_untrap() returns ECMD_CANCEL when untrap()
            // reports that nothing was done.
            if (!spentTime) { object.age = 0; commandResultCancelled(state); }
            return { used: true, ready: true, spentTime };
        }
    }
    if (state.program_state.gameover) return { used: true, heroDied: true };
    return { used: true, ready: true };
}

export async function deactivateArtifactProperty(
    object: GameObject,
    artifact: Artifact | null | undefined,
    {
        state = game,
        publish = pline,
        rollDice = d,
        scaledRandom = rnz,
    }: Pick<ArtifactInvocationOptions, 'state' | 'publish' | 'rollDice' | 'scaledRandom'> = {},
): Promise<boolean> {
    if (!isPropertyArtifact(artifact) || !artifactInvokeIsActive(artifact, state)) return false;
    await invokeProperty(object, artifact, state, publish, rollDice, scaledRandom);
    return true;
}

// C refs: artifact.c:doinvoke(), invoke_ok(), arti_invoke().  getobj()
// suggests artifacts and other unique objects; an artifact with inv_prop 0
// still consumes a turn after retouching, but its only effect is the ordinary
// "Nothing happens." line.
export async function doinvoke() {
    const object = await chooseInventoryObject('invoke', candidate =>
        candidate.oartifact || OBJECT_UNIQUE[candidate.otyp] || candidate.otyp === CRYSTAL_BALL
            || candidate.otyp === FAKE_AMULET_OF_YENDOR && !candidate.known
            ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE, { forcePrompt: true });
    if (!object) {
        commandResultCancelled(); // artifact.c:doinvoke() returns ECMD_CANCEL.
        return;
    }

    game._pending_message = '';
    const touch = await retouchHeroObject(object);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }
    const artifact = object.oartifact
        ? artifactById(object.oartifact) : null;
    if (!artifact || artifact.invokePower === null) {
        if (object.otyp === CRYSTAL_BALL) await useCrystalBall(object);
        else await pline('Nothing happens.');
        game.context.move = 1;
        return;
    }

    const invocation = await invokeArtifactPower(object, artifact, {
        enterTrap: moveIntoFailedUntrap,
    });
    if ('heroDied' in invocation && invocation.heroDied) return;
    if (invocation.used) {
        game.context.move = 'spentTime' in invocation && invocation.spentTime === false ? 0 : 1;
        return;
    }
    await pline('Nothing happens.');
    game.context.move = 1;
}
