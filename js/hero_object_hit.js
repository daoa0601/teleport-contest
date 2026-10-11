// C mthrowu.c:thitu(). Polearms and thrown weapons share this hit rule.
import { artifactById } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_CON, A_STR } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game, requirePlayingGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { heroHatesSilver, heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { ACID_VENOM, OBJECT_MATERIAL, OBJECT_NAMES } from './object_data.js';
import { rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { objectHasPersonalName } from './objnam.js';
import { AD_ACID } from './monster_attack_types.js';
import { monstersObserveHeroResistance, seenResistanceForDamage } from './monster_perception.js';
const SILVER = 14;
const GEMSTONE = 20;
const MINERAL = 21;
const RING_CLASS = 4;
const M1_WALLWALK = 0x00000008;
const M1_UNSOLID = 0x00100000;
export async function hitHeroWithObject(object, damage, accuracy, { state = game, publish = plineWithContinuation, rollOne = rnd, die = finishHeroDeath, name: requestedName, killer: requestedKiller, } = {}) {
    requirePlayingGame(state);
    const name = requestedName ?? (artifactById(object.oartifact, state)?.name
        || OBJECT_NAMES[object.otyp]);
    const killer = requestedKiller ?? OBJECT_NAMES[object.otyp];
    if (typeof name !== 'string' || typeof killer !== 'string')
        throw new Error(`Unknown object type ${object.otyp} hit the hero.`);
    const description = objectHasPersonalName(object, state)
        ? name : withIndefiniteArticle(name);
    const terse = heroIsBlind(state) || state.flags.verbose === false;
    const threshold = state.u.uac + accuracy;
    const roll = rollOne(20);
    if (threshold <= roll) {
        if (terse)
            await publish('It misses.');
        else if (threshold <= roll - 2) {
            const subject = description.charAt(0).toUpperCase() + description.slice(1);
            await publish(`${subject} misses you.`);
        }
        else
            await publish(`You are almost hit by ${description}.`);
        return { hit: false, died: false };
    }
    const punctuation = damage > 4 ? '!' : '.';
    await publish(terse ? `You are hit${punctuation}`
        : `You are hit by ${description}${punctuation}`);
    const material = OBJECT_MATERIAL[object.otyp];
    const flags = MONSTER_FLAGS1[heroSpecies(state)] ?? 0;
    const passesRocks = (flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
    if (object.otyp === ACID_VENOM
        && state.u.acidResistance) {
        await publish("It doesn't seem to hurt you.");
        monstersObserveHeroResistance(seenResistanceForDamage(AD_ACID), state);
    }
    else if (object.oclass !== RING_CLASS
        && material !== undefined && [GEMSTONE, MINERAL].includes(material) && passesRocks) {
        await publish("It doesn't harm you.");
    }
    else {
        if (material === SILVER && heroHatesSilver(state)) {
            await publish('The silver sears your flesh!');
            await exerciseAttribute(A_CON, false, state);
        }
        if (object.otyp === ACID_VENOM) {
            await publish('It burns!');
            monstersObserveHeroResistance(seenResistanceForDamage(AD_ACID), state);
        }
        if (await loseHeroHp(damage, killer, { state, publish, die }))
            return { hit: true, died: true };
        await exerciseAttribute(A_STR, false, state);
    }
    return { hit: true, died: false };
}
//# sourceMappingURL=hero_object_hit.js.map