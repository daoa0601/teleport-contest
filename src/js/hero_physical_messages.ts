// Native uhitm.c:hmon_hitmon_msg_hit(), msg_silver(), msg_lightobj(),
// shade_miss(), and the deferred poison-wearing-off message.
import { armorSlotFor } from './armor.js';
import { artifactById, artifactEmitsLight } from './artifacts.js';
import { M_AP_MONSTER, M_AP_TYPE, P_WHIP } from './const.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, map_invisible, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { objectCanTouchShade } from './hero_object_contact.js';
import { monsterIsAmorphous, monsterIsNoncorporeal, monsterIsShade } from './monster_data.js';
import { monsterName, possessiveName } from './monster_name.js';
import { HEAVY_IRON_BALL, OBJECT_SUBTYPE, TOWEL } from './object_data.js';
import { verbForSubject } from './object_grammar.js';
import { objectCombatName, objectNameIsPlural } from './objnam.js';
import { capitalizedDefiniteName, rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { d, rnd } from './rng.js';
import { cansee } from './vision.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { HeroPhysicalAttackMode, HeroProjectileVolley } from './hero_physical_types.js';
import type { Position } from './map_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

interface PhysicalMessageOptions {
    state?: GameState;
    publish?: MessagePublisher;
}

interface PhysicalHitMessageOptions extends PhysicalMessageOptions {
    mode: HeroPhysicalAttackMode;
    damage: number;
    destroyed: boolean;
    hitTextShown: boolean;
    target?: Position;
    volley?: HeroProjectileVolley;
}

interface ProjectileMessageOptions extends PhysicalMessageOptions {
    target?: Position;
    volley?: HeroProjectileVolley;
}

interface PhysicalSearingOptions extends PhysicalMessageOptions {
    // hmon's mdat: captured before contact, then updated by any hurtle.
    originalSpecies: number;
    savedObjectName: string;
}

interface PhysicalSilverOptions extends PhysicalSearingOptions {
    silverObject: boolean;
    silverRings: number;
}

interface ShadeMissOptions extends PhysicalMessageOptions {
    thrown?: boolean;
    verbose?: boolean;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
}

export function captureHeroPhysicalObjectName(object: GameObject, state: GameState = game): string {
    if (artifactEmitsLight(object) && object.lamplit && object.oartifact) {
        const artifact = artifactById(object.oartifact, state);
        if (!artifact) throw new RangeError(`Unknown light artifact ${object.oartifact}`);
        return artifact.name.replace(/^The /u, 'the ');
    }
    return objectCombatName(object, { state });
}

// Capture after clearing poison and before a death can merge/delete the object.
export function captureUnpoisonedPhysicalObjectName(object: GameObject, state: GameState = game): string {
    return objectCombatName(object, { state });
}

export function captureHeroProjectileName(
    object: GameObject, state: GameState = game, volley?: HeroProjectileVolley,
): string {
    const name = objectCombatName(object, { state, includeCorpseSpecies: false });
    return volley && volley.count > 1 && volley.objectType === object.otyp
        ? `the ${volley.index}${ordinalSuffix(volley.index)} ${name}` : name;
}

// C dothrow.c:tmiss(). Concealed targets are omitted even when sensed;
// the caller owns whether a missed throw wakes the target.
export async function reportHeroThrownMiss(monster: Monster, object: GameObject, {
    state = game, publish = plineWithContinuation, volley,
    target = { x: monster.mx, y: monster.my },
}: ProjectileMessageOptions = {}): Promise<void> {
    const name = captureHeroProjectileName(object, state, volley);
    const appearance = M_AP_TYPE(monster);
    if (!canSeeMonster(monster) || appearance !== 0 && appearance !== M_AP_MONSTER) {
        const verb = objectNameIsPlural(object, state) ? 'miss' : 'misses';
        await publish(`${capitalizedDefiniteName(name, state)} ${verb}.`);
    } else await publish(rayMissMessage(name, monster, { ...target, state }));
}

export async function showHeroPhysicalHit(monster: Monster, object: GameObject | null, {
    state = game, publish = plineWithContinuation, mode, damage, destroyed, hitTextShown,
    target = { x: monster.mx, y: monster.my }, volley,
}: PhysicalHitMessageOptions): Promise<boolean> {
    if (hitTextShown) return false;
    const ranged = mode !== 'melee';
    const volleyHit = ranged && object && volley && volley.count > 1 && volley.objectType === object.otyp;
    if (destroyed && !volleyHit) return false;
    if (ranged) {
        if (!object) throw new Error('A ranged physical hit needs its object for feedback');
        const name = captureHeroProjectileName(object, state, volley);
        await publish(rayHitMessage(name, monster, { ...target, state, damage }));
    } else if (!state.flags.verbose) {
        await publish('You hit it.');
    } else {
        const verb = object && (armorSlotFor(object.otyp) === 'uarms' || object.otyp === HEAVY_IRON_BALL)
            ? 'bash' : object && (OBJECT_SUBTYPE[object.otyp] === P_WHIP || object.otyp === TOWEL && object.spe > 0)
                ? 'lash' : state.urole?.key === 'barbarian' ? 'smite' : 'hit';
        const punctuation = canSeeMonster(monster) ? damagePunctuation(damage) : '.';
        await publish(`You ${verb} ${monsterName(monster, { state })}${punctuation}`);
    }
    return true;
}

export async function showHeroHarmlessStoneHit(monster: Monster, object: GameObject, {
    state = game, publish = plineWithContinuation, volley,
    target = { x: monster.mx, y: monster.my },
}: ProjectileMessageOptions = {}): Promise<void> {
    const name = captureHeroProjectileName(object, state, volley);
    await publish(rayHitMessage(name, monster, { ...target, state, ending: ' but does no harm.' }));
}

export async function showHeroPhysicalSilver(monster: Monster, {
    state = game, publish = plineWithContinuation, originalSpecies, savedObjectName, silverObject, silverRings,
}: PhysicalSilverOptions): Promise<void> {
    const whom = searedTarget(monster, originalSpecies, state);
    if (!canSpotMonster(monster)) {
        await publish(`${capitalize(whom)} is seared!`);
    } else if (silverRings === 1) {
        await publish(`Your silver ring sears ${whom}!`);
    } else if (silverRings === 2) {
        await publish(`Your silver rings sear ${whom}!`);
    } else if (silverObject && savedObjectName) {
        const silver = /silver/iu.test(savedObjectName) ? '' : 'silver ';
        await publish(`Your ${silver}${savedObjectName} ${verbForSubject(savedObjectName, 'sear')} ${whom}!`);
    } else await publish(`The silver sears ${whom}!`);
}

export async function showHeroPhysicalLight(monster: Monster, {
    state = game, publish = plineWithContinuation, originalSpecies, savedObjectName,
}: PhysicalSearingOptions): Promise<void> {
    const whom = searedTarget(monster, originalSpecies, state);
    if (!canSpotMonster(monster)) await publish(`${capitalize(whom)} is seared!`);
    else if (savedObjectName)
        await publish(`${possessiveName(savedObjectName)} radiance penetrates deep into ${whom}!`);
    else await publish(`The light sears ${whom}!`);
}

export async function showHeroPhysicalPoisonWoreOff(savedName: string, {
    publish = plineWithContinuation,
}: PhysicalMessageOptions = {}): Promise<void> {
    await publish(`Your ${savedName} ${verbForSubject(savedName, 'are')} no longer poisoned.`);
}

export async function showHeroShadeMiss(monster: Monster, object: GameObject | null, {
    state = game, publish = plineWithContinuation, thrown = false, verbose = true, rollOne = rnd, rollDice = d,
}: ShadeMissOptions = {}): Promise<boolean> {
    if (!monsterIsShade(monster)
        || object && rollPhysicalWeaponDamage(object, monster, { state, rollOne, rollDice }) !== 0) return false;
    const adjacent = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2 <= 2;
    if (verbose && (cansee(monster.mx, monster.my) || canSenseMonster(monster) || adjacent)) {
        const what = !object || objectCanTouchShade(object, state) ? 'attack' : objectCombatName(object, { state });
        const target = monsterName(monster, { state });
        const subject = thrown ? capitalizedDefiniteName(what, state) : `Your ${what}`;
        await publish(`${subject} ${verbForSubject(what, 'pass')} harmlessly through ${target}.`);
        if (!canSpotMonster(monster)) map_invisible(monster.mx, monster.my);
    }
    monster.msleeping = 0;
    return true;
}

function searedTarget(monster: Monster, originalSpecies: number, state: GameState): string {
    const name = monsterName(monster, { state });
    const original = { mnum: originalSpecies };
    return monsterIsNoncorporeal(original) || monsterIsAmorphous(original)
        ? name : `${possessiveName(name)} flesh`;
}

function damagePunctuation(damage: number): string {
    return damage < 0 ? '?' : damage <= 4 ? '.' : '!';
}

function ordinalSuffix(index: number): string {
    if (index % 100 >= 11 && index % 100 <= 13) return 'th';
    return index % 10 === 1 ? 'st' : index % 10 === 2 ? 'nd' : index % 10 === 3 ? 'rd' : 'th';
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
