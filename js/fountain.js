// Fountain messages and the hero's sitting reaction.
// C refs: fountain.c dryup() and sit.c dosit().

import { plineWithContinuation } from './display.js';
import { dryFountainAt } from './fountain_terrain.js';
import { game } from './gstate.js';
import { splitHeroMonsterForm } from './mklev.js';
import { monsterTypeName } from './monster_data.js';

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

function monsterName(monster) {
    return monster?.name
        || monsterTypeName(monster?.mnum, !!monster?.female);
}

export async function reportFountainWarning(warning) {
    if (!warning) return;
    if (warning === 'trickle') {
        await plineWithContinuation('The flow reduces to a trickle.');
        return;
    }

    const name = monsterName(warning);
    const subject = warning.name
        ? name : `${indefiniteArticle(name)} ${name}`;
    const actor = `${subject[0].toUpperCase()}${subject.slice(1)}`;
    if (game.deaf || game.u?.deaf) {
        const pronoun = warning.female ? 'her' : 'his';
        await plineWithContinuation(
            `${actor} earnestly waves ${pronoun} arms!`,
        );
        return;
    }
    await plineWithContinuation(`${actor} yells:`);
    await plineWithContinuation('"Hey, stop using that fountain!"');
}

export async function splitSittingGremlin() {
    const clone = await splitHeroMonsterForm(game);
    if (!clone) return null;
    await plineWithContinuation('You multiply!');
    const result = dryFountainAt(game.u.ux, game.u.uy);
    if (result.dried)
        await plineWithContinuation('The fountain dries up!');
    await reportFountainWarning(result.warning);
    return clone;
}
