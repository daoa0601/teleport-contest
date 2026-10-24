// C mthrowu.c:thitu(). Polearms and thrown weapons share this hit rule.

import { objectMaterial } from './object_material.js';
import { exerciseAttribute } from './attrib.js';
import { A_CON, A_STR } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import type { DeathHandler } from './end.js';
import { game, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';
import { loseHeroHp } from './hero_damage.js';
import { heroHatesSilver, heroSpecies } from './hero_species.js';
import { captureHeroProjectileName } from './hero_physical_messages.js';
import type { HeroProjectileVolley } from './hero_physical_types.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { ACID_VENOM } from './object_data.js';
import { rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { objectDescription } from './object_description.js';
import { definiteName, objectHasPersonalName, killerObjectName, observeObjectForNaming } from './objnam.js';
import { AD_ACID } from './monster_attack_types.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance, seenResistanceForDamage } from './monster_perception.js';

export interface HeroObjectHitOptions {
    state?: GameState;
    publish?: MessagePublisher;
    rollOne?: (sides: number) => number;
    die?: DeathHandler;
    name?: string;
    volley?: HeroProjectileVolley;
    /** Already formatted, as returned by C killer_xname(). */
    killer?: string;
}

export interface HeroObjectHitResult {
    hit: boolean;
    died: boolean;
}

const SILVER = 14;
const GEMSTONE = 20;
const MINERAL = 21;
const RING_CLASS = 4;
const M1_WALLWALK = 0x00000008;
const M1_UNSOLID = 0x00100000;

export async function hitHeroWithObject(object: GameObject, damage: number, accuracy: number, {
    state = game,
    publish = plineWithContinuation,
    rollOne = rnd,
    die = finishHeroDeath,
    name: requestedName,
    killer: requestedKiller,
    volley,
}: HeroObjectHitOptions = {}): Promise<HeroObjectHitResult> {
    requirePlayingGame(state);
    // C thitu() uses doname() for stacks and mshot_xname() for single objects.
    // The latter omits the monster species from a single corpse's hit name.
    const quantity = object.quan ?? object.quantity ?? 1;
    if (requestedName === undefined && quantity > 1) observeObjectForNaming(object, { state });
    const name = requestedName ?? (quantity > 1 ? await objectDescription(object, { state })
        : captureHeroProjectileName(object, state, volley));
    // C thitu() keeps an object killer's article and only adds one to an
    // explicit name when that name does not already start with an article.
    const namedKiller = requestedName === undefined ? undefined
        : /^(?:the|an?) /i.test(requestedName) ? requestedName
            : withIndefiniteArticle(requestedName);
    const killer = requestedKiller ?? namedKiller ?? killerObjectName(object, state);
    if (typeof name !== 'string' || typeof killer !== 'string')
        throw new Error(`Unknown object type ${object.otyp} hit the hero.`);
    const description = objectHasPersonalName(object, state) ? definiteName(name, state)
        : quantity > 1 ? name : withIndefiniteArticle(name);
    const terse = heroIsBlind(state) || state.flags.verbose === false;
    const threshold = state.u.uac + accuracy;
    const roll = rollOne(20);
    if (threshold <= roll) {
        if (terse) await publish('It misses.');
        else if (threshold <= roll - 2) {
            const subject = description.charAt(0).toUpperCase() + description.slice(1);
            await publish(`${subject} ${verbForSubject(subject, 'miss')} you.`);
        } else await publish(`You are almost hit by ${description}.`);
        return { hit: false, died: false };
    }

    const punctuation = damage > 4 ? '!' : '.';
    await publish(terse ? `You are hit${punctuation}`
        : `You are hit by ${description}${punctuation}`);
    const material = objectMaterial(object.otyp);
    const flags = MONSTER_FLAGS1[heroSpecies(state)] ?? 0;
    const passesRocks = (flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
    if (object.otyp === ACID_VENOM
        && state.u.acidResistance) {
        await publish("It doesn't seem to hurt you.");
        monstersObserveHeroResistance(seenResistanceForDamage(AD_ACID), state);
    } else if (object.oclass !== RING_CLASS
        && material !== undefined && [GEMSTONE, MINERAL].includes(material) && passesRocks) {
        await publish(requestedName === undefined
            ? "It doesn't harm you." : 'It passes harmlessly through you.');
    } else {
        if (material === SILVER && heroHatesSilver(state)) {
            await publish('The silver sears your flesh!');
            await exerciseAttribute(A_CON, false, state);
        }
        if (object.otyp === ACID_VENOM) {
            await publish('It burns!');
            monstersForgetHeroResistance(seenResistanceForDamage(AD_ACID), state);
        }
        if (await loseHeroHp(damage, killer, {
            state, publish, die, deathCause: `killed by ${killer}`,
        }))
            return { hit: true, died: true };
        await exerciseAttribute(A_STR, false, state);
    }
    return { hit: true, died: false };
}
