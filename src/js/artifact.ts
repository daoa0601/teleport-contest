// artifact.js — Named artifact identity, existence, and hero-touch policy.
// C refs: artifact.c artifact_name()/artifact_exists()/touch_artifact() and
// include/artilist.h.  Keep artifact identity separate from the base object:
// readobjnam() first resolves the artifact to an object type, mksobj() builds
// that ordinary object, and oname() then commits the named artifact.

import { WEAPON_CLASS, RING_CLASS, TOOL_CLASS, WAND_CLASS } from './objclass.js';
import { OBJ_DESCR } from './o_init.js';
import { OBJ_NAME,
    objectClassForType, objectSkill, objectUnique, GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES,
    ACID_VENOM, ARROW, BLINDING_VENOM,
    CRYSTAL_BALL, FAKE_AMULET_OF_YENDOR, getObjectClassBounds, SPE_CONE_OF_COLD, SPE_FIREBALL,
    BELL_OF_OPENING, LEASH,
} from './object_data.js';
import { ARTIFACT_DATA } from './artifact_data.js';
import type { ArtifactDefinition, ArtifactFlag, ArtifactDamage, ArtifactDefense, ArtifactPower } from './data_types.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { PropertyName, WornPropertySlot } from './property_types.js';
import {
    ENL_GAMEINPROGRESS, MAGICENLIGHTENMENT, P_BASIC, P_SKILLED, Upolyd, W_ARM, DOOR, D_TRAPPED, W_WEP,
    A_WIS, A_CON, A_NONE, DISMOUNT_THROWN, IS_ALTAR, KILLED_BY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, I_SPECIAL,
    In_endgame, In_hell, In_quest, P_EXPERT, TIMEOUT, W_ART, W_ARTI, W_BALL, W_QUIVER, W_SWAPWEP,
    W_AMUL, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_RINGL, W_RINGR, W_TOOL,
    NECK, LL_ARTIFACT,
} from './const.js';
import { isok, commandResultCancelled, promptDirection } from './cmd.js';
import { dragonFormForArmor, heroHatesSilver, heroSpecies, heroIsUnchanging, returnHeroToHumanForm, mbodypart } from './polyself.js';
import { heroHasDrainResistance, removeEyewear } from './do_wear.js';
import { game, requirePlayingGame, requireInitializedGame, requireLiveGame } from './gstate.js';
import { insideShopRoomAt } from './shk.js';
import { mksobj, objectWeight, objectQuantity, isContainer, uncurseObjectState} from './mkobj.js';
import { races, roles } from './role.js';
import { recordObjectEncounter, objectMaterial, objectTypeKnown } from './o_init.js';
import { verbForSubject, objectName, objectNameIsPlural, definiteName, objectCombatName, observeDistantObjectForNaming, killerObjectName, ownedObjectName, simpleObjectTypeName } from './objnam.js';
import { d, rnd, rn2, rnz } from './rng.js';
import { questMonsterAlignment } from './role_monsters.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS2, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL } from './monster_data.js';
import { ensureHeroSkills, monsterWieldedWeapon } from './weapon.js';
import { monsterAlignmentType } from './priest.js';
import {
    monsterHasColdResistance, monsterHasDrainResistance, monsterHasFireResistance, monsterHasShockResistance,
    is_dlord, is_dprince, monsterHasHead, monsterIsAmorphous, monsterIsBig, monsterIsCovetous, monsterIsDemon,
    monsterIsNoncorporeal, monsterIsNonliving, monsterIsPlayerMonster, monsterSpeciesSticks,
} from './mondata.js';
import { see_monsters, glyphAt, canSeeMonster, canSpotMonster, map_invisible, newsym, shieldeff } from './display.js';
import { grantWornProperty, hasCarriedProperty, removeWornProperty, setCarriedProperty, wornObjectGrantsProperty, hasInvokedProperty, hasIntrinsicProperty, propertyHasOtherSources, propertyIsActive, refreshProperty, setInvokedProperty, clearLevitationMasks, restoreLevitationSources, stashLevitationSources } from './properties.js';
import { formatFeltMessage, pline, plineWithContinuation, recordGameLogEvent } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { heroIsBlind, heroIsHallucinating, heroIsBlinded, permanentBlind } from './senses.js';
import { getRumor } from './rumors.js';
import { exerciseAttribute, extrinsicPropertyMask } from './attrib.js';
import { finishHeroDeath } from './end.js';
import type { DeathHandler } from './end.js';

import { loseHeroExperience } from './exper.js';
import { burnAwayHeroSlime, applyHeroLocationEffects, loseHeroHp, heroIsOnStairs, isInvocationPosition, nomul } from './hack.js';
import { lightDamage } from './zap.js';
import { lightRoom } from './read.js';
import { healMonster, wakeMonstersNearWithMessages, migrateMonsterToLevel, setHeroGrip,
    finishHeroMonsterKillOutcome,
} from './mon.js';
import { makeMonsterFlee } from './monmove.js';
import { displayColorName, monsterName } from './do_name.js';
import { destroyInventoryByElement, destroyMonsterInventoryByElement, INVENTORY_DAMAGE, flashBurn, cancelMonster, monsterResistsEffect, probeMonster } from './zap.js';
import { cansee, couldsee } from './vision.js';
import { monsterHitPointsPerLevel } from './makemon.js';
import {
    moveIntoFailedUntrap, untrap, igniteItems, captureLevitationState, floatHeroUp, floatHeroDown,
    selfTouchPetrifyingWeapons,
} from './trap.js';
import type { UntrapOptions } from './trap.js';
import { recalculateTelepathyRange, bypassObject, clearBypasses, nextUnbypassedObject } from './worn.js';
import { hasNonArtifactConflict, syncHeroConflict } from './hero_conflict.js';
import { hasNonArtifactInvisibility, invisibilityIsBlocked, syncHeroInvisibility } from './hero_invisibility.js';
import { cureHeroSickness, heroIsSick, clearHeroSliming, heroIsSliming, makeBlinded, makeHallucinated, makeConfused, makeStunned } from './potion.js';
import { enlightenment } from './insight.js';
import { chooseInventoryObject, freeInventoryObject } from './invent.js';
import { useCrystalBall } from './detect.js';
import { chooseObjectToCharge, rechargeObject } from './read.js';
import { doBlindingRay } from './zap.js';
import { castSpell, spellSkillType } from './spell.js';
import { upstart } from './hacklib.js';
import { AT_MAGC } from './monster_attack_types.js';
import { dismountHero, monsterSaddle } from './steed.js';
import { dropInventoryObjectAtHero } from './do.js';
import { hitFloorWithObject } from './dothrow.js';
import { removeWornHeroItem } from './steal.js';
import { depth, surfaceName } from './dungeon.js';
import { gotoLevel } from './do.js';
import { levelTeleport, teleportMonsterByHero } from './teleport.js';
import { bringLeashedFollowers } from './apply.js';
import { showPagedPickOneMenu } from './windows.js';
import { throwOrdinaryObject, resolveSwallowedEggPieOrVenomThrow } from './dothrow.js';
import { holdAnotherObject } from './invent.js';

const M2_GIANT = 0x00002000;
const M2_DEMON = 0x00000100;
const M2_ORC = 0x00000080;
const M2_ELF = 0x00000010;
const M2_WERE = 0x00000004;
const M2_UNDEAD = 0x00000002;

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
// Part of C artifact.c:set_artifact_intrinsic(): the SPFX_HALRES
// hallucination-resistance property.
function wieldedProperties(artifact: ArtifactDefinition): PropertyName[] {
    return artifact.flags.includes('SPFX_HALRES') ? ['hallucinationResistance'] : [];
}

// Part of C artifact.c:artifact_name(): the fuzzymatch() normalization
// ("the" prefix, spaces, dashes, case) used for name lookup.
function fuzzyArtifactName(value: unknown): string {
    return String(value || '')
        .trim()
        .replace(/^the\s+/i, '')
        .replace(/[\s-]+/g, '')
        .toLowerCase();
}

// C ref: role.c roles[].artifact — each role's quest artifact name.
// Computed on first use, not at module load: the role tables live in
// role.js, whose selection-UI imports reach this module before role.js
// finishes initializing.
let questArtifactNames: ReadonlySet<string> | undefined;

// Port only: any-role quest-artifact membership computed from the role
// table (C compares the single urole.questarti index).
function isQuestArtifactName(name: string): boolean {
    questArtifactNames ??= new Set(
        roles.map((role) => fuzzyArtifactName(role.artifactName)).filter(Boolean),
    );
    return questArtifactNames.has(name);
}

export const ARTIFACTS: readonly Artifact[] = ARTIFACT_DATA.map((artifact) => {
    const baseName = OBJ_NAME(artifact.baseType);
    if (baseName === null) throw new Error(`Artifact ${artifact.id} requires a named base type`);
    const fuzzyName = fuzzyArtifactName(artifact.name);
    return {
        ...artifact,
        baseName,
        selfWilled: artifact.flags.includes('SPFX_INTEL'),
        restricted: artifact.flags.includes('SPFX_RESTR'),
        noGeneration: artifact.flags.includes('SPFX_NOGEN'),
        // Deferred: reading roles[] at load time would run before the
        // role-table module finishes initializing (see above).
        get questArtifact() {
            return isQuestArtifactName(fuzzyName);
        },
        wieldedProperties: wieldedProperties(artifact),
    };
});

// C artifact.c:spec_m2(). The artifact's mtype mask; its only C use is
// set_artifact_intrinsic's SPFX_WARN branch, so this form returns the mask
// only for a warning artifact that targets monster flags.
export function artifactWarningMask(
    object: Pick<GameObject, 'oartifact'> | null | undefined,
    state: GameState = game,
): number {
    const artifact = artifactById(object?.oartifact, state);
    return artifact?.flags.includes('SPFX_WARN') && artifact.target.kind === 'flag2'
        ? FLAG2_TARGETS[artifact.target.value]
        : 0;
}

// C artifact.c:glow_color(). The warning-glow color for Sting, Orcrist, and
// Grimtooth, as Sting_effects names it in the start-glowing message.
export function artifactGlowColor(object: GameObject, state: GameState = game): string {
    const artifact = artifactById(object.oartifact, state);
    if (!artifact) throw new Error('Artifact glow requires a known artifact');
    if (artifact.color === 'CLR_RED') return 'red';
    if (artifact.color === 'CLR_BRIGHT_BLUE') return 'light blue';
    throw new Error(`Artifact ${artifact.id} has no glow color`);
}

// Port only: accessor for the per-game artifact table versus the static
// artilist.
function artifactList(state: GameState = game): readonly Artifact[] {
    return state._artifactRuntime instanceof Map ? [...state._artifactRuntime.values()] : ARTIFACTS;
}

// C artifact.c:artifact_name()
export function artifactByName(value: unknown, state: GameState = game): Artifact | null {
    const wanted = fuzzyArtifactName(value);
    return (
        artifactList(state).find((artifact) => fuzzyArtifactName(artifact.name) === wanted) || null
    );
}

// Port only: accessor for the artilist index an object's oartifact carries.
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

// Port only: lazy accessor for the per-game artifact existence set.
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

// C artifact.c:restrict_name(). Artifacts.js owns the artilist flags; the
// same-type test covers undiscovered siblings sharing this description
// (weapons share no shuffled pool, so equal descriptions are the range).
export function restrictName(object: GameObject, name: string, state: GameState) {
    if (!name) return false;
    let wanted = name;
    if (/^the /iu.test(wanted)) wanted = wanted.slice(4);
    const otyp = object.otyp;
    const sameTypes = new Set([otyp]);
    const description = OBJ_DESCR(otyp, state);
    if (!objectTypeKnown(object, state) && description) {
        const oclass = objectClassForType(otyp);
        const { first, last } = getObjectClassBounds(oclass);
        for (let candidate = first; candidate <= last; candidate++) {
            const other = OBJ_DESCR(candidate, state);
            if (candidate !== otyp && other === description
                && !state._knownObjectTypes?.has(candidate)) {
                sameTypes.add(candidate);
            }
        }
    }
    for (const artifact of ARTIFACTS) {
        if (!sameTypes.has(artifact.baseType)) continue;
        let artifactName = artifact.name;
        if (/^the /iu.test(artifactName)) artifactName = artifactName.slice(4);
        if (artifactName === wanted) {
            /* don't name multiple elven daggers "Sting" */
            return artifact.noGeneration || artifact.restricted
                || objectQuantity(object) > 1;
        }
    }
    return false;
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

// C artifact.c:disp_artifact_discoveries()
// The discovered-artifact rows of the #discoveries list.
// C artifact.c:disp_artifact_discoveries(): each identified artifact with
// its alignment (align_str(), unaligned printed as "non-aligned") and
// simple type name; artiname() is the record's name field.
export function discoveredArtifacts(state: GameState = game): string[] {
    return (state._artifactDiscoveries ?? []).map(id => {
        const artifact = artifactById(id, state);
        if (!artifact) throw new Error(`Unknown discovered artifact ${id}`);
        const alignment = artifact.alignment === 1 ? 'lawful'
            : artifact.alignment === 0 ? 'neutral'
                : artifact.alignment === -1 ? 'chaotic' : 'non-aligned';
        return `  ${artifact.name} [${alignment} ${simpleObjectTypeName(artifact.baseType)}]`;
    });
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

// Part of C artifact.c:artifact_exists(): the un-create (mod=FALSE) path.
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

// C artifact.c:nartifact_exist()
export function artifactExistCount(state: GameState = game): number {
    return state._artifactExists?.size ?? 0;
}

// C artifact.c:found_artifact()
// Wishes and gifts are known without a "found" log.
export function markArtifactFound(id: number, state: GameState = game): void {
    (state._artifactFound ||= new Set()).add(id);
}

// C artifact.c:find_artifact()
// Only the object's real dknown flag counts, not a temporary
// full-identification view (the xname() gate).
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

// C artifact.c:discover_artifact()
export function discoverArtifact(id: number, state: GameState = game): void {
    const discoveries = (state._artifactDiscoveries ||= []);
    if (!discoveries.includes(id)) discoveries.push(id);
}

// C artifact.c:mk_artifact()'s caller contract (artifact.c:166-167): every
// C caller passes either an existing object with A_NONE (mkobj.c:891,1100,
// 1255; mplayer.c:266) or no object with a real alignment (pray.c:1798).
// The union makes the other combinations unwritable, so C's
// dispose_of_orig_obj() branches — by_align with a nonnull otmp, which C's
// own comment calls unexpected — cannot run and are not ported.
export type MkArtifactSource =
    | { object: GameObject; alignment: typeof A_NONE }
    | { object: null; alignment: number };

// C artifact.c:mk_artifact().  Make an artifact.  With an alignment, an
// object of the appropriate alignment is created from scratch, or null is
// returned if none is available; with A_NONE, the passed object is converted
// into an artifact of matching type, or returned as-is if that's not
// possible.  max_giftvalue is the value of the sacrifice for an artifact
// obtained by sacrificing, or 99 otherwise.
export async function mk_artifact(
    source: MkArtifactSource,
    maxGiftValue: number,
    adjustSpe: boolean,
    state: GameState = game,
): Promise<GameObject | null> {
    const byAlign = source.alignment !== A_NONE;
    const otmp = source.object;
    const oTyp = byAlign || !otmp ? 0 : otmp.otyp;
    const unique = !byAlign && !!otmp && !!objectUnique(oTyp);
    // The divine-gift caller (pray.c) always plays a started game; the
    // conversion callers (mkobj.c, mplayer.c) also run before the hero exists.
    const playing = byAlign ? requireInitializedGame(state) : null;
    const skills = byAlign ? ensureHeroSkills(state) : null;

    const eligible: Artifact[] = [];
    const fallback: Artifact[] = [];
    /* gather eligible artifacts */
    for (const artifact of artifactList(state)) {
        if (state._artifactExists?.has(artifact.id)) continue;
        if (artifact.noGeneration || unique) continue;
        if (artifact.giftValue > maxGiftValue && artifact.role !== state.urole?.key) continue;

        if (!byAlign) {
            /* looking for a particular type of item; not producing a
               divine gift so we don't care about role's first choice */
            if (artifact.baseType === oTyp) eligible.push(artifact);
            continue; /* move on to next possibility */
        }

        /* we're looking for an alignment-specific item
           suitable for hero's role+race */
        if (artifact.alignment !== null && artifact.alignment !== source.alignment) continue;
        /* avoid enemies' equipment */
        const artifactRace = races.find((race) => race.name === artifact.race);
        if (artifactRace && playing && artifactRace.selfmask & playing.urace.hatemask) continue;

        /* when a role-specific first choice is available, use it */
        if (artifact.role === state.urole?.key) {
            /* make this be the only possibility in the list */
            eligible.length = 0;
            eligible.push(artifact);
            break; /* skip all other candidates */
        }

        /* check if this is skill-compatible */
        const weapon = objectClassForType(artifact.baseType) === WEAPON_CLASS;
        const skill = Math.abs(objectSkill(artifact.baseType));
        const skillCompatibility = weapon ? skills?.[skill]?.maxSkill ?? 0 : P_SKILLED;

        /* right alignment, or non-aligned with at least one previous gift
           bestowed, makes this one viable; unaligned artifacts are possible
           even as the first gift, but less likely; if it's a bad weapon type
           for the role that also makes it less likely */
        if (
            (artifact.alignment !== null || (state.u.ugifts ?? 0) > 0 || !rn2(3)) &&
            (!rn2(4) || skillCompatibility >= P_SKILLED || (skillCompatibility >= P_BASIC && rn2(2)))
        ) {
            eligible.push(artifact);
        } else if (!eligible.length) {
            /* if no candidates have been found yet, record this one as a
               fallback possibility in case all aligned candidates have been
               used up or failed the randomized compatibility checks */
            fallback.push(artifact);
        }
    }

    /* resort to fallback list if main list was empty */
    const choices = eligible.length ? eligible : fallback;
    if (!choices.length) {
        /* nothing appropriate could be found; return original object */
        return byAlign ? null : otmp;
    }

    /* found at least one candidate; pick one at random */
    const artifact = choices[rn2(choices.length)];
    if (!artifact) throw new Error('Artifact selection requires a candidate');

    let object = otmp;
    if (byAlign) {
        /* make an appropriate object if necessary, then christen it */
        object = await mksobj(artifact.baseType, true, false);
    }
    if (!object) throw new Error('Converting an object into an artifact requires the object');
    /* prevent erosion from generating */
    object.oeroded = object.oeroded2 = 0;
    nameArtifact(object, artifact, { state });
    /* set existence and reason for creation bits; 'random' is default */
    if (adjustSpe) {
        /* Adjust object.spe by generationEnchantment (a no-op for
           non-weapons). The result is clamped into the normal range to
           prevent an outside chance of +12 artifacts generating. */
        const newSpe = object.spe + artifact.generationEnchantment;
        if (newSpe >= -10 && newSpe < 10) object.spe = newSpe;
    }
    return object;
}

// C artifact.c:defends(): the artifact's own defn field resists this
// damage type.  C also converts dragon scale mail to scales by color here;
// that table lives with the dragon-armor property map in do_wear.ts and
// mondata.c:defended().
// get_artifact() is the caller's artifactById().
function defendedByArtifact(
    artifact: Artifact | null | undefined,
    damageType: ArtifactDefenseQuery,
): boolean {
    return artifact?.defense === damageType;
}

// C artifact.c:defends_when_carried(): the artifact's cary field resists
// this damage type while merely carried.
function carriedArtifactDefends(
    inventory: readonly GameObject[] | undefined,
    damageType: ArtifactDefenseQuery,
    state: GameState,
): boolean {
    return (inventory || []).some(
        (object) => artifactById(object?.oartifact, state)?.carriedDefense === damageType,
    );
}

// Part of C artifact.c:defends(), artifact.c:defends_when_carried(): the
// wielded-or-carried defense query.
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

// Part of C artifact.c:defends(), artifact.c:defends_when_carried(): the
// hero entry (uwep plus inventory).
export function heroHasArtifactDefense(
    damageType: ArtifactDefenseQuery,
    state: GameState = game,
): boolean {
    return artifactDefenseApplies(null, damageType, true, state);
}

// Part of C artifact.c:defends(), artifact.c:defends_when_carried(): the
// monster entry (weapon plus minvent).
export function monsterHasArtifactDefense(
    monster: ArtifactDefender,
    damageType: ArtifactDefenseQuery,
    state: GameState = game,
): boolean {
    return artifactDefenseApplies(monster, damageType, false, state);
}

// Part of C artifact.c:set_artifact_intrinsic(): querying a carried cspfx
// through the property source it installs.
export function heroHasCarriedArtifactFlag(flag: ArtifactFlag, state: GameState = game): boolean {
    return (state.inventory || []).some((object) =>
        artifactById(object?.oartifact, state)?.carriedFlags.includes(flag),
    );
}

// Part of C artifact.c:spec_applies(): the resistance/damage-type tests
// of the phys-attack branch.
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
                // C artifact.c:spec_applies() intersects the artifact mtype mask with mflags2.
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

// C artifact.c:spec_abon()
// weapon.c's hitval() calls spec_abon() before hitum() rolls its ordinary d20.
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

// C artifact.c:spec_dbon().  A zero damage die means "add the current
// weapon damage again", not zero bonus.  Strength and ring damage are added
// later by hmon_hitmon_dmg_recalc(), so callers pass only dmgval().
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

// Part of C artifact.c:spec_dbon(): the zero-damage-die case that doubles
// base weapon damage.
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

// Part of C artifact.c:shade_glare(): the artifact half (Sunsword's
// undead bane); the silver-material half stays with callers.
export function artifactStrikesShade(
    object: Pick<GameObject, 'oartifact'> | null | undefined,
): boolean {
    return artifactById(object?.oartifact)?.name === 'Sunsword';
}

// C artifact.c:bane_applies(). The artifact's bane targets the carrier.
export function artifactBaneApplies(
    artifact: Artifact | null | undefined,
    state: GameState = game,
): boolean {
    if (!artifact) return false;
    if (!['flag2', 'symbol', 'alignment'].includes(artifact?.target.kind)) return false;
    return artifactAttackApplies(artifact, { mnum: heroSpecies(state) }, { hero: true, state });
}

// Part of C artifact.c:touch_artifact(): the monster branch — refusal
// without a blast.
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


const PM_ROGUE = MONSTER_NAME.indexOf('rogue');

// C's is_magic_key()/has_magic_key() take a struct monst * that may be
// &gy.youmonst; mondata.ts's BlindCombatant is the established union for
// that hero-or-monster parameter.
export type MagicKeyCarrier =
    | { readonly youmonst: true }
    | { readonly monster: Monster };

// C artifact.c:is_magic_key(). The Master Key of Thievery is magic when not
// cursed for a rogue — the hero's role, or a rogue monster — and must be
// blessed for anyone else.
export function isMagicKey(
    carrier: MagicKeyCarrier,
    object: GameObject,
    state: GameState = game,
): boolean {
    if (artifactById(object.oartifact, state)?.name !== 'The Master Key of Thievery') return false;
    const rogue = 'youmonst' in carrier
        ? state.urole?.key === 'rogue'
        : carrier.monster.mnum === PM_ROGUE;
    return rogue ? !object.cursed : !!object.blessed;
}

// C artifact.c:has_magic_key(). Whether 'mon' (usually youmonst) carries
// the magic key. C walks only objects of the key's otyp with nxtobj(); the
// artifact identity test in isMagicKey() subsumes that filter.
export function hasMagicKey(carrier: MagicKeyCarrier, state: GameState = game): boolean {
    const inventory = 'youmonst' in carrier
        ? state.inventory
        : carrier.monster.minvent || [];
    return inventory.some(object => isMagicKey(carrier, object, state));
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

// Part of C artifact.c:set_artifact_intrinsic(): the spfx/cspfx-to-
// property table walk.
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

// Part of C artifact.c:set_artifact_intrinsic(): the W_ART (carried) pass.
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

// Part of C artifact.c:set_artifact_intrinsic(): the worn-slot pass.
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

// C artifact.c:set_artifact_intrinsic() for the wielded slot: the conferred
// properties plus the talkative wielded-only SPFX (hallucination, warning).
export async function setWieldedArtifactProperties(
    object: GameObject, active: boolean, state: GameState,
): Promise<void> {
    const artifact = artifactById(object.oartifact, state);
    setWornArtifactProperties(object, 'uwep', active, state);
    if (artifact?.flags.includes('SPFX_HALRES')) {
        await makeHallucinated(Number(!active), {
            state, talk: !state.program_state?.restoring,
            resistanceSource: { object, slot: 'uwep' },
        });
    }
    await setArtifactWarningWielded(object, active, state);
}

// C artifact.c:set_artifact_intrinsic(), Sting_effects(), glow_verb().

// Part of C artifact.c:Sting_effects(): the warn-count-to-strength
// mapping.
function glowStrength(count: number): 0 | 1 | 2 | 3 {
    return count > 12 ? 3 : count > 4 ? 2 : count > 0 ? 1 : 0;
}

// C artifact.c:glow_verb().
export function artifactGlowVerb(count: number, continuous = false): string {
    const verbs = ['quiver', 'flicker', 'glimmer', 'gleam'] as const;
    const verb = verbs[glowStrength(count)];
    return continuous ? `${verb}ing` : verb;
}

// Part of C artifact.c:set_artifact_intrinsic(): whether the wielded
// weapon carries the SPFX_WARN warning mask.
export function wieldedArtifactWarns(state: GameState = game): boolean {
    const object = state.uwep;
    return !!(
        object &&
        (object.owornmask ?? 0) & W_WEP &&
        artifactWarningMask(object, state) &&
        wornObjectGrantsProperty(object, 'warnOfMonster', state)
    );
}

// Part of C artifact.c:set_artifact_intrinsic(): the SPFX_WARN
// warntype.obj mask set and clear.
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

// C artifact.c:Sting_effects()
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

// Hero contact with an object: the touch test for one object, the per-item
// in-use test, and the post-change equipment pass (artifact.c's retouch
// trio, in C source order).

type RetouchSlot = 'uarmg' | 'uswapwep' | 'uwep' | 'uleft' | 'uright' | 'ublindf';

interface RetouchOptions {
    state?: GameState;
    publish?: MessagePublisher;
    die?: DeathHandler;
}

interface RetouchContext {
    state: GameState;
    publish: MessagePublisher;
    die: DeathHandler;
}

export interface HeroRetouchResult {
    died: boolean;
    rejected: boolean;
}

// Losing a form while handling an item can enter this routine again.
// Nested passes share C's bypass marks until the outer pass finishes.
const activeChecks = new WeakSet<GameState>();

// C artifact.c:retouch_object()
// Explicit handling (apply, wield, invoke) also checks carried items which
// are not currently equipped. retouch_equipment() keeps its in-use filter.
// C artifact.c:retouch_object(): the touch test for one object — the
// invocation-position bell exception, the blast and bane damage, unwearing,
// and the optional drop.
export async function retouchHeroObject(object: GameObject, {
    dropRejected = false, state = game,
    publish = plineWithContinuation, die = finishHeroDeath,
}: RetouchOptions & { dropRejected?: boolean } = {}): Promise<HeroRetouchResult> {
    if (object.otyp === BELL_OF_OPENING
        && isInvocationPosition(state.u.ux, state.u.uy, state)
        && !heroIsOnStairs(state)) return { died: false, rejected: false };
    const artifact = artifactById(object.oartifact, state);

    const touch = await touchArtifactByHero(object, artifact, {
        state, publish, die,
    });
    if (touch.died) return { died: true, rejected: true };
    // The blast can end a monster form, changing both of these weaknesses.
    const silver = objectMaterial(object, state) === SILVER
        && heroHatesSilver(state);
    const bane = artifactBaneApplies(artifact, state);
    if (touch.allowed && !silver && !bane) return { died: false, rejected: false };
    if (touch.allowed) {
        const anymore = object.owornmask ? ' anymore' : '';
        await publish(`You can't handle ${ownedObjectName(object, state, { capitalized: false })}${anymore}!`);
        if (!touch.blasted) {
            let damage = silver ? rnd(10) : 0;
            if (state.u.halfPhysicalDamage)
                damage = Math.trunc((damage + 1) / 2);
            if (bane) damage += rnd(10);
            const cause = silver && !artifact && !bane && [RING_CLASS, WAND_CLASS].includes(object.oclass)
                ? object.oclass === RING_CLASS ? 'a silver ring' : 'a silver wand'
                : killerObjectName(object, state);
            const died = await loseHeroHp(
                damage, `handling ${cause}`,
                { state, publish, die },
            );
            if (died) return { died: true, rejected: true };
            await exerciseAttribute(A_CON, false, state);
        }
    }

    if (object.owornmask) {
        if (slotObject('ublindf', state) === object)
            await removeEyewear(object, { state, publish });
        else
            await removeWornHeroItem(object, state);
    }
    if (state.program_state?.gameover) return { died: true, rejected: true };
    if (!state.inventory?.includes(object)) return { died: false, rejected: true };
    if (dropRejected) {
        if (propertyIsActive('levitation', state)) {
            await freeInventoryObject(object, state);
            if (!state.program_state.gameover)
                await hitFloorWithObject(object, { state, publish, verbose: true });
        } else {
            const spot = state.level?.at(state.u.ux, state.u.uy);
            if (spot && !IS_ALTAR(spot.typ)) {
                const name = definiteName(objectCombatName(object, { state }), state);
                const verb = objectNameIsPlural(object, state) ? 'fall' : 'falls';
                await publish(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verb} to the ${surfaceName(state.u.ux, state.u.uy, state)}.`);
            }
            await dropInventoryObjectAtHero(object, { state, publish });
        }
    }
    return { died: !!state.program_state.gameover, rejected: true };
}

// C artifact.c:untouchable(): the per-item test — worn, active tool,
// carried effect, or invoked artifact triggers retouch_object(), and a
// rejected invocation is reversed.
async function checkItem(object: GameObject | null, dropRejected: boolean, context: RetouchContext): Promise<HeroRetouchResult> {
    const { state, publish, die } = context;
    if (!object) return { died: false, rejected: false };
    const artifact = artifactById(object.oartifact, state);
    const excluded = W_QUIVER | W_BALL | (state.u.twoweap ? 0 : W_SWAPWEP);
    const worn = ((object.owornmask ?? 0) & ~excluded) !== 0;
    const activeTool = object.oclass === TOOL_CLASS
        && (object.lamplit || object.otyp === LEASH && object.leashmon
            || (object.contents?.length ?? 0) > 0);
    const invoked = artifactInvokeIsActive(artifact, state);
    const carryEffect = !!artifact?.carriedDefense
        || (artifact?.carriedFlags.length ?? 0) > 0;
    if (!(worn || activeTool || carryEffect || invoked))
        return { died: false, rejected: false };

    const result = await retouchHeroObject(object, { dropRejected, state, publish, die });
    if (result.rejected && !result.died && invoked && state.inventory.includes(object)) {
        await deactivateArtifactProperty(object, artifact, { state, publish });
        if (state.program_state.gameover) return { died: true, rejected: true };
    }
    return result;
}

// C artifact.c:retouch_equipment(): the post-change pass over items in
// use, with the bypass marks shared across nested checks.
export async function retouchEquipment(dropFlag = 0, {
    state = game, publish = plineWithContinuation, die = finishHeroDeath,
}: RetouchOptions = {}): Promise<{ died: boolean }> {
    const nested = activeChecks.has(state);
    if (!nested) clearBypasses(state);
    activeChecks.add(state);
    const context = { state, publish, die };
    const hadGloves = !!slotObject('uarmg', state);
    const oldRingCount = ringCount(state);
    try {
        if (state.u.twoweap) {
            const secondary = slotObject('uswapwep', state);
            if (secondary) bypassObject(secondary, state);
            const result = await checkItem(
                secondary, dropFlag > 0, context,
            );
            if (result.died) return result;
        }
        const primary = slotObject('uwep', state);
        if (primary) bypassObject(primary, state);
        const weapon = await checkItem(primary, dropFlag > 0, context);
        if (weapon.died) return weapon;

        const saddle = await checkItem(
            monsterSaddle(state.u.usteed), false, context,
        );
        if (saddle.died) return saddle;
        if (saddle.rejected) {
            await dismountHero(DISMOUNT_THROWN, { state, announce: publish });
            if (state.program_state?.gameover) return { died: true };
        }

        let object;
        while ((object = nextUnbypassedObject(state.inventory, state))) {
            const result = await checkItem(object, dropFlag === 1, context);
            if (result.died) return result;
        }
        const gloves = slotObject('uarmg', state);
        if (ringCount(state) !== oldRingCount && gloves?.cursed)
            uncurseObjectState(gloves);
        if (hadGloves && !gloves) {
            return await selfTouchPetrifyingWeapons({
                state, publish, die,
                messageStart: 'After losing your gloves, you',
            });
        }
        return { died: false };
    } finally {
        if (!nested) {
            activeChecks.delete(state);
            clearBypasses(state);
        }
    }
}

// Port only: equipment-slot accessor over both state shapes.
function slotObject(slot: RetouchSlot, state: GameState): GameObject | null {
    return state[slot] || state.u?.[slot] || null;
}

// Part of C artifact.c:retouch_equipment(): the worn-ring count around
// the equipment pass.
function ringCount(state: GameState): number {
    return Number(!!slotObject('uleft', state))
        + Number(!!slotObject('uright', state));
}

// C artifact.c:mkot_trap_warn()
// Warmth counts locations whose trap is not displayed, including trapped
// doors and containers beneath other floor objects.
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

// C artifact.c:arti_speak()
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

// C artifact.c:touch_artifact()
// The hero branch of C's touch_artifact(); the monster branch (refusal
// without a blast) is monsterCanTouchArtifact() above.
export interface HeroArtifactTouchResult {
    allowed: boolean;
    blasted: boolean;
    badClass?: boolean;
    badAlignment?: boolean;
    bane?: boolean;
    died: boolean;
    damage?: number;
}

// Port only: local carried() macro duplicate (obj.h) with the
// inventory-list fallback.
function heroCarries(object: GameObject, state: GameState): boolean {
    return object?.where === 'inventory' || (state.inventory || []).includes(object);
}

// C artifact.c:touch_artifact()
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
    if (!object?.oartifact || !artifact) {
        return { allowed: true, blasted: false, died: false };
    }
    // C: yours = (mon == &gy.youmonst); this is the hero branch, so yours.
    const heroRole = state.urole?.key || null;
    const heroAlignment = state.u?.ualign?.type ?? 0;
    const alignmentRecord = state.u?.ualign?.record ?? 0;
    const selfWilled = artifact.selfWilled;
    const badClass = selfWilled && !!artifact.role && artifact.role !== heroRole;
    const bane = artifactBaneApplies(artifact, state);
    let badAlignment =
        artifact.restricted &&
        artifact.alignment !== null &&
        (artifact.alignment !== heroAlignment || alignmentRecord < 0);
    if (!badAlignment) badAlignment = bane;

    let died = false;
    let damage = 0;
    const blasted =
        ((badClass || badAlignment) && selfWilled) || (badAlignment && rn2(4) === 0);
    if (blasted) {
        const name = definiteName(objectCombatName(object, { state }), state);
        await publish(`You are blasted by ${name}${name.endsWith('s') ? "'" : "'s"} power!`);
        damage = d(state.u?.antimagic ? 2 : 4, selfWilled ? 10 : 4);
        // add half (maybe quarter) of the usual silver damage bonus
        if (objectMaterial(object, state) === SILVER && heroHatesSilver(state)) {
            let silverDamage = rnd(10);
            if (state.u?.halfPhysicalDamage) silverDamage = Math.trunc((silverDamage + 1) / 2);
            damage += silverDamage;
        }
        // C touch_artifact(): losehp(dmg, "touching <artifact>", KILLED_BY).
        died = await loseHeroHp(damage, `touching ${artifact.name}`, {
            state,
            publish,
            die,
            killerFormat: KILLED_BY,
        });
        if (!died) await exerciseAttribute(A_WIS, false, state);
    }

    // can pick it up unless you're totally non-synch'd with the artifact
    const allowed = !(badClass && badAlignment && selfWilled);
    if (!died && !allowed) {
        const name = definiteName(objectCombatName(object, { state }), state);
        const subject = name.charAt(0).toUpperCase() + name.slice(1);
        const plural = objectNameIsPlural(object, state);
        await publish(
            heroCarries(object, state)
                ? `${subject} ${plural ? 'are' : 'is'} beyond your control!`
                : `${subject} ${plural ? 'evade' : 'evades'} your grasp!`,
        );
    }
    return { allowed, blasted, badClass, badAlignment, bane, damage, died };
}

// Options for the Magicbane hit below.

export interface MagicbaneHitOptions {
    state: GameState;
    attacker: Monster | undefined;
    visible: boolean;
    dieRoll: number;
    hitOnHead: boolean;
    targetName: string;
    describeTarget: () => string;
    publish: MessagePublisher;
    random: (limit: number) => number;
    rollOne: (sides: number) => number;
}

type MagicbaneEffect = 'probe' | 'stun' | 'scare' | 'cancel';

const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');

// C artifact.c:Mb_hit(): effect index, damage dice, and every defender case.
export async function applyMagicbaneHit(
    object: GameObject,
    defender: ArtifactHitDefender,
    damage: number,
    bonusApplied: boolean,
    {
        state, attacker, visible, dieRoll, hitOnHead, targetName,
        describeTarget, publish, random, rollOne,
    }: MagicbaneHitOptions,
): Promise<ArtifactHitResult> {
    const enchantment = object.spe ?? object.enchantment ?? 0;
    let scareDieRoll = 4;
    if (enchantment >= 3) {
        scareDieRoll = Math.trunc(scareDieRoll / 2 ** Math.trunc(enchantment / 3));
    }
    if (!bonusApplied) dieRoll++;

    let stun = Math.max(enchantment, 0) < random(bonusApplied ? 11 : 7);
    let effect: MagicbaneEffect = 'probe';
    damage += rollOne(4);
    if (stun) {
        effect = 'stun';
        damage += rollOne(4);
    }
    if (dieRoll <= scareDieRoll) {
        effect = 'scare';
        damage += rollOne(4);
    }
    if (dieRoll <= Math.trunc(scareDieRoll / 2)) {
        effect = 'cancel';
        damage += rollOne(4);
    }

    const hallucinating = heroIsHallucinating(state);
    const verb = {
        probe: hallucinating ? 'prod' : 'probe',
        stun: hallucinating ? 'amaze' : 'stun',
        scare: hallucinating ? 'tickle' : 'scare',
        cancel: hallucinating ? 'purge' : 'cancel',
    }[effect];
    const showEffects = defender === 'hero' || !attacker || visible;
    if (showEffects) {
        await publish(`The magic-absorbing blade ${verb}s ${targetName}!`);
        if (effect === 'probe' && defender !== 'hero' && !canSpotMonster(defender)) {
            await map_invisible(defender.mx, defender.my);
        }
    }

    let resisted = false;
    if (effect === 'cancel' && defender === 'hero') {
        requirePlayingGame(state);
        resisted = !!state.u.antimagic;
        if (!resisted) {
            const oldSpecies = heroSpecies(state);
            if (Upolyd(state.u)) {
                if (oldSpecies === PM_CLAY_GOLEM) {
                    await publish(heroIsBlind(state)
                        ? formatFeltMessage(`${heroIsHallucinating(state) ? 'dark' : 'light'} headed.`, state)
                        : 'Some writing vanishes from your head!');
                    state.u.mh = 0;
                }
                if (heroIsUnchanging(state) && state.u.mh > 0)
                    await publish('Your amulet grows hot for a moment, then cools.');
                else if ((await returnHeroToHumanForm(state, { publish })).died)
                    return { heroDied: true };
            }
            stun = false;
            if (heroSpecies(state) !== oldSpecies) damage = 0;
            if ((state.u.uenmax ?? 0) > 0) {
                state.u.uenmax = (state.u.uenmax ?? 0) - 1;
                if ((state.u.uen ?? 0) > 0) state.u.uen = (state.u.uen ?? 0) - 1;
                state.context.botl = true;
                await publish('You lose magical energy!');
            }
        }
    } else if (effect === 'cancel' && defender !== 'hero') {
        const monster = defender;
        const oldSpecies = monster.mnum;
        const cancellation = await cancelMonster(monster, {
            state,
            attackLevel: 10,
            random,
            allowKill: false,
            publish,
        });
        if (cancellation.heroDied) return { heroDied: true };
        if (cancellation.resisted) {
            resisted = true;
        } else {
            stun = false;
            if (monster.mnum !== oldSpecies) targetName = describeTarget();
            if (monster.mnum === PM_CLAY_GOLEM) monster.mhp = 1;
            if (!attacker && (MONSTER_ATTACKS[monster.mnum] || []).some(([attackType]) => attackType === AT_MAGC)) {
                state.u.uenmax = (state.u.uenmax ?? 0) + 1;
                state.u.uenpeak = Math.max(state.u.uenpeak ?? 0, state.u.uenmax);
                state.u.uen = (state.u.uen ?? 0) + 1;
                state.context.botl = true;
                await publish('You absorb magical energy!');
            }
        }
    } else if (effect === 'scare' && defender === 'hero') {
        resisted = !!state.u.antimagic;
        if (!resisted) {
            nomul(-3, state);
            state._helplessReason = 'being scared stiff';
            state._helplessDoneMessage = '';
            if (attacker && state.u.ustuck === attacker && monsterSpeciesSticks(heroSpecies(state))) {
                setHeroGrip(null, state);
                await publish(`You release ${monsterName(attacker, { state })}!`);
            }
            stun = false;
        }
    } else if (effect === 'scare' && defender !== 'hero') {
        const monster = defender;
        if (random(2) && monsterResistsEffect(monster, 10, random)) {
            resisted = true;
        } else {
            const flight = await makeMonsterFlee(monster, {
                state,
                turns: 3,
                announce: (monster.mhp ?? 1) > damage,
                publish,
                random,
                rollOne,
            });
            if (flight.heroDied) return { heroDied: true };
            stun = false;
        }
    } else if (effect === 'stun') {
        stun = true;
    } else if (defender !== 'hero' && !attacker
        && (enchantment === 0 || random(3 * Math.abs(enchantment)) === 0)) {
        await publish(`The ${verb} is insightful.`);
        await probeMonster(defender, { state, onHead: hitOnHead, publish });
    }

    if (stun) {
        if (defender === 'hero')
            await makeStunned((state.u.stunnedTurns ?? 0) + 3, { state, talk: false });
        else defender.mstun = 1;
        if (effect === 'stun') stun = false;
    }
    const confused = random(12) === 0;
    if (confused) {
        if (defender === 'hero')
            await makeConfused((state.u.confusionTurns ?? 0) + 4, { state, talk: false });
        else defender.mconf = 1;
    }

    if (showEffects) {
        const target = upstart(targetName);
        if (resisted) {
            await publish(`${target} ${defender === 'hero' ? 'resist' : 'resists'}!`);
            await shieldeff(defender === 'hero' ? state.u.ux : defender.mx,
                defender === 'hero' ? state.u.uy : defender.my, state);
        }
        if ((stun || confused) && state.flags?.verbose !== false) {
            const conditions = [...(stun ? ['stunned'] : []), ...(confused ? ['confused'] : [])];
            await publish(
                `${target} ${defender === 'hero' ? 'are' : 'is'} ${conditions.join(' and ')}${conditions.length > 1 ? '!' : '.'}`,
            );
        }
    }
    return { damage, specialMessage: showEffects };
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

// C artifact.c:artifact_hit()
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

// Part of C artifact.c:artifact_hit(): the adtyp-to-inventory-damage
// mapping.
function elementalDamageType(damageType: ArtifactDamage) {
    if (damageType === 'cold') return INVENTORY_DAMAGE.COLD;
    if (damageType === 'fire') return INVENTORY_DAMAGE.FIRE;
    if (damageType === 'shock') return INVENTORY_DAMAGE.ELECTRIC;
    return null;
}

// Part of C artifact.c:artifact_hit(): the elemental blade messages.
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

// Part of C artifact.c:artifact_hit(): the per-element inventory damage
// chance (rn2(4), rn2(5) for shock).
function inventoryDamageChance(damageType: ArtifactDamage) {
    return damageType === 'shock' ? 5 : 4;
}

// Part of C artifact.c:artifact_hit(): dknown and encounter bookkeeping
// for the attacking artifact.
function observeArtifactObject(object: GameObject, state: GameState) {
    const hallucinating = heroIsHallucinating(state);
    if (hallucinating) return;
    object.dknown = true;
    recordObjectEncounter(object.otyp, state);
}

// Part of C artifact.c:artifact_hit(): the possessive forms of the drain
// messages.
function possessiveTarget(target: string) {
    if (target === 'it') return 'its';
    return target.endsWith('s') ? `${target}'` : `${target}'s`;
}

// Part of C artifact.c:artifact_hit(): the Vorpal/Tsurugi beheading
// branch.
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
            if (monsterIsBig(species.mnum)) {
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
            await publish(`Vorpal Blade slices through your ${mbodypart(species.mnum, NECK)}.`);
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
        if (monsterIsBig(monster.mnum)) {
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
        await publish(`Vorpal Blade slices through ${possessiveTarget(describeTarget())} ${mbodypart(monster.mnum, NECK)}.`);
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

// Part of C artifact.c:artifact_hit(): the SPFX_DRLI life-drain branch.
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

// Part of C artifact.c:artifact_hit(): healing the hero attacker by the
// drained amount.
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

// Part of C artifact.c:arti_invoke(): the direct-power dispatch table.
function isDirectPower(power: ArtifactPower | null): power is (typeof DIRECT_POWERS)[number] {
    return DIRECT_POWERS.some((candidate) => candidate === power);
}

// Part of C artifact.c:arti_invoke(): the levitation independence check.
// C do_wear.c-style extrinsic check: an invoked artifact is nothing special
// while an independent intrinsic (including the potion timeout), worn ring,
// or boots source also grants levitation (artifact.c:2197-2201).
// Part of C artifact.c:arti_invoke(): the levitation independence check.
function hasNonArtifactLevitation(state: GameState): boolean {
    return propertyHasOtherSources('levitation', state);
}

// Part of C artifact.c:arti_invoke(): the levitation refresh after the
// toggle.
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

// Part of C artifact.c:arti_invoke(): the property-power artifact test.
function isPropertyArtifact(artifact: Artifact | null | undefined): artifact is PropertyArtifact {
    const power = artifact?.invokePower;
    return power === 'conflict' || power === 'invisibility' || power === 'levitation';
}

// Part of C artifact.c:arti_invoke(): querying whether a property
// artifact's invocation is currently active.
export function artifactInvokeIsActive(
    artifact: Artifact | null | undefined,
    state: GameState = game,
): boolean {
    return (
        isPropertyArtifact(artifact) &&
        hasInvokedProperty(PROPERTY_POWERS[artifact.invokePower].property, state)
    );
}

// C artifact.c:nothing_special()
async function nothingSpecial(
    object: GameObject,
    state: GameState,
    publish: MessagePublisher,
): Promise<void> {
    if ((state.inventory || []).includes(object)) {
        await publish(formatFeltMessage('a surge of power, but nothing seems to happen.', state));
    }
}

// C artifact.c:arti_invoke_cost_pw(): fling-poison and blinding-ray invoke
// powers cost a level-5 spell's power; nothing else can be paid with Pw.
// C artifact.c:arti_invoke_cost(): a tired artifact demands power or
// ignores the hero for another 3d10 turns after this attempt.
// get_artifact() is the caller's artifactById().
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

// Part of C artifact.c:arti_invoke(): the "ignoring you" message.
async function ignoringHero(object: GameObject, state: GameState, publish: MessagePublisher) {
    const subject = definiteName(objectCombatName(object, { state }), state);
    await publish(formatFeltMessage(`that ${subject} ${objectNameIsPlural(object, state) ? 'are' : 'is'} ignoring you.`, state));
}

// Part of C artifact.c:arti_invoke(): the conflict/invisibility/
// levitation property toggles.
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

// C artifact.c:invoke_healing()
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

// C artifact.c:invoke_energy_boost()
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

// C artifact.c:invoke_create_ammo()
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

// C artifact.c:invoke_blinding_ray()
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

// C artifact.c:invoke_storm_spell()
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

// C artifact.c:invoke_create_portal()
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

// C artifact.c:invoke_banish()
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

        if (!monsterIsDemon(monster.mnum) && MONSTER_SYMBOL[monster.mnum] !== S_IMP) continue;
        if (!couldsee(monster.mx, monster.my) || MONSTER_SOUND[monster.mnum] === MS_NEMESIS) continue;
        let chance = 1;
        if (In_quest(state.u.uz) && !state.quest_status?.killed_nemesis) chance += 10;
        if (is_dprince(monster.mnum)) chance += 2;
        if (is_dlord(monster.mnum)) chance++;
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

// C artifact.c:invoke_fling_poison()
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
            await enlightenment(MAGICENLIGHTENMENT, ENL_GAMEINPROGRESS);
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

// Part of C artifact.c:set_artifact_intrinsic(): the drop-side off-toggle
// of an invoked property.
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

// C artifact.c:finesse_ahriman()
// Finesse for the do.c drop caller: dropping an invoked levitation
// artifact while unable to reach the floor.  finesse_ahriman() (artifact.c)
// decides whether freeinv() would end levitation, pins a carried W_ART
// source so the hero stays aloft through freeinv()/hitfloor(), and the
// caller lands the hero afterwards with the explicit float-down below.

// C artifact.c:finesse_ahriman()
// C finesse_ahriman(): true when dropping `object` would toggle levitation
// off inside freeinv().  On true, the invoked source is replaced by an
// explicit carried source (C `ELevitation = W_ART`), so set_artifact_
// intrinsic()'s `(ELevitation & W_ARTI)` test fails, arti_invoke() never
// runs, no invoke downtime is rolled, and levitation survives until
// finishLevitatingArtifactDrop().  Timeouts and intrinsics are retained.
export function beginLevitatingArtifactDrop(object: GameObject | null | undefined, state: GameState = game): boolean {
    requireLiveGame(state);
    if (!object) return false;
    // if we aren't levitating or this isn't an artifact which confers
    // levitation via #invoke then freeinv() won't toggle levitation
    if (!propertyIsActive('levitation', state)) return false;
    const artifact = object?.oartifact != null
        ? artifactById(object.oartifact, state) : null;
    if (artifact?.invokePower !== 'levitation'
        || !hasInvokedProperty('levitation', state)) return false;

    // Probe ahead, exactly as C does: save the whole property, clear
    // I_SPECIAL|TIMEOUT and W_ARTI, and see whether levitation would end.
    // Any other source - worn, innate, carried - keeps the hero aloft, so
    // the drop needs no finesse; the potion timeout does not count because
    // the probe clears it with the masks the finish call will apply.
    const stash = stashLevitationSources(state);
    clearLevitationMasks(I_SPECIAL | TIMEOUT, W_ARTI, state);
    const wouldEnd = !propertyIsActive('levitation', state);
    restoreLevitationSources(stash, state);
    if (!wouldEnd) return false;

    // C `ELevitation = W_ART`: the invoked source is replaced by the
    // carried one, so the artifact's deactivation no longer sees it.
    setInvokedProperty('levitation', null, false, state);
    setCarriedProperty('levitation', object, true, state);
    return true;
}

// C do.c:771 `float_down(I_SPECIAL | TIMEOUT, W_ARTI | W_ART)` after
// hitfloor(): the pinned carried source and the retained timed bits end
// here, and the shared landing owner reports the touchdown.
export async function finishLevitatingArtifactDrop(state: GameState = game): Promise<0 | 1> {
    requireLiveGame(state);
    return floatHeroDown(I_SPECIAL | TIMEOUT, W_ARTI | W_ART, state);
}

const DEFENSES: Readonly<Partial<Record<PropertyName, ArtifactDefense>>> = {
    fireResistance: 'fire', coldResistance: 'cold', antimagic: 'magic',
    poisonResistance: 'poison', drainResistance: 'life-drain',
};
const FLAGS: Readonly<Partial<Record<PropertyName, ArtifactFlag>>> = {
    searching: 'SPFX_SEARCH', hallucinationResistance: 'SPFX_HALRES', telepathy: 'SPFX_ESP',
    stealth: 'SPFX_STLTH', regeneration: 'SPFX_REGEN', teleportControl: 'SPFX_TCTRL',
    warnOfMonster: 'SPFX_WARN', warning: 'SPFX_WARN', energyRegeneration: 'SPFX_EREGEN',
    halfSpellDamage: 'SPFX_HSPDAM', halfPhysicalDamage: 'SPFX_HPHDAM', reflection: 'SPFX_REFLECT',
};

// C artifact.c:what_gives()
// The first item conveying a particular intrinsic.
// C artifact.c:abil_to_adtyp(): the C extrinsic-pointer table became the
// DEFENSES map above.
// C artifact.c:abil_to_spfx(): likewise the FLAGS map for spfx bits.
export function whatGives(property: PropertyName, state: GameState = game): GameObject | null {
    const wornmask = W_ARM | W_ARMC | W_ARMH | W_ARMS | W_ARMG | W_ARMF | W_ARMU
        | W_AMUL | W_RINGL | W_RINGR | W_TOOL | W_ART | W_ARTI
        | (state.u.twoweap ? W_SWAPWEP : 0);
    const extrinsic = extrinsicPropertyMask(property, state);
    const wornbits = wornmask & extrinsic;
    for (const object of state.inventory) {
        if (object.oartifact && (property !== 'warnOfMonster' || state.context.warntype?.obj)) {
            const artifact = artifactById(object.oartifact, state);
            if (!artifact) continue;
            const defense = DEFENSES[property];
            const flag = FLAGS[property];
            if (defense && (artifact.carriedDefense === defense
                || artifact.defense === defense && ((object.owornmask ?? 0) & ~(W_ART | W_ARTI))))
                return object;
            if (flag && (artifact.carriedFlags.includes(flag)
                || artifact.flags.includes(flag) && object.owornmask)) return object;
            if (object === state.uwep && property === 'blindResistance' && (extrinsic & W_WEP)) return object;
        } else if (wornbits && wornbits === (wornmask & (object.owornmask ?? 0))) return object;
    }
    return null;
}

// C artifact.c:doinvoke()
// C refs: artifact.c:doinvoke(), invoke_ok(), arti_invoke().  getobj()
// suggests artifacts and other unique objects; an artifact with inv_prop 0
// still consumes a turn after retouching, but its only effect is the ordinary
// "Nothing happens." line.
export async function doinvoke() {
    const object = await chooseInventoryObject('invoke', candidate =>
        candidate.oartifact || objectUnique(candidate.otyp) || candidate.otyp === CRYSTAL_BALL
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

// C artifact.c:arti_reflects()
// ── moved from src/js/ray.ts ──
// C artifact.c:arti_reflects(): a monster gets reflection from an
// artifact — the wielded/worn SPFX_REFLECT bit, or a carried cspfx one
// (no current artifact carries reflection).
export function weaponReflects(object: GameObject | null | undefined, state: GameState): object is GameObject {
    if (!object) return false;
    return !!artifactById(object?.oartifact, state)?.flags.includes('SPFX_REFLECT');
}

// C artifact.c:permapoisoned(): Grimtooth is the permanently poisoned
// artifact; it is also the only record with the fling-poison invoke power.
export function isPermanentlyPoisonedObject(object: {
    oartifact?: number | null;
} | null | undefined): boolean {
    if (!object) return false;
    return artifactById(object.oartifact)?.invokePower === 'fling-poison';
}
