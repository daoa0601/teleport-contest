// C mthrowu.c:thitu(). Polearms and thrown weapons share this hit rule.

import { artifactById } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_CON, A_STR } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { heroHatesSilver, heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { ACID_VENOM, OBJECT_MATERIAL, OBJECT_NAMES } from './object_data.js';
import { rnd } from './rng.js';
import { heroIsBlind } from './senses.js';

const SILVER = 14;
const GEMSTONE = 20;
const MINERAL = 21;
const RING_CLASS = 4;
const M1_WALLWALK = 0x00000008;
const M1_UNSOLID = 0x00100000;

export async function hitHeroWithObject(object, damage, accuracy, {
    state = game,
    publish = plineWithContinuation,
    rollOne = rnd,
    die = finishHeroDeath,
    name = artifactById(object.oartifact, state)?.name || OBJECT_NAMES[object.otyp],
    killer = OBJECT_NAMES[object.otyp],
} = {}) {
    const description = object.oartifact
        ? name : `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
    const terse = heroIsBlind(state) || state.flags.verbose === false;
    const threshold = state.u.uac + accuracy;
    const roll = rollOne(20);
    if (threshold <= roll) {
        if (terse) await publish('It misses.');
        else if (threshold <= roll - 2) {
            const subject = description.charAt(0).toUpperCase() + description.slice(1);
            await publish(`${subject} misses you.`);
        } else await publish(`You are almost hit by ${description}.`);
        return { hit: false, died: false };
    }

    const punctuation = damage > 4 ? '!' : '.';
    await publish(terse ? `You are hit${punctuation}`
        : `You are hit by ${description}${punctuation}`);
    const material = OBJECT_MATERIAL[object.otyp];
    const flags = MONSTER_FLAGS1[heroSpecies(state)];
    const passesRocks = (flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
    if (object.otyp === ACID_VENOM
        && (state.u.acidResistance || state.u.acid_resistance)) {
        await publish("It doesn't seem to hurt you.");
    } else if (object.oclass !== RING_CLASS
        && [GEMSTONE, MINERAL].includes(material) && passesRocks) {
        await publish("It doesn't harm you.");
    } else {
        if (material === SILVER && heroHatesSilver(state)) {
            await publish('The silver sears your flesh!');
            exerciseAttribute(A_CON, false, state);
        }
        if (object.otyp === ACID_VENOM) await publish('It burns!');
        if (await loseHeroHp(damage, killer, { state, publish, die }))
            return { hit: true, died: true };
        exerciseAttribute(A_STR, false, state);
    }
    return { hit: true, died: false };
}
