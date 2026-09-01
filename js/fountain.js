// Live fountain changes shared by drinking, dipping, and sitting.
// C ref: fountain.c dryup() and sit.c dosit().

import { FOUNTAIN, F_WARNED, ROOM } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { splitHeroMonsterForm } from './mklev.js';
import { monsterTypeName } from './monster_data.js';
import { inTown } from './room.js';
import { rn2 } from './rng.js';
import { couldsee } from './vision.js';

const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

function monsterName(monster) {
    return monster?.name
        || monsterTypeName(monster?.mnum, !!monster?.female);
}

function visiblePeacefulWatchman() {
    return (game.level?.monsters || []).find(monster =>
        (monster?.mhp ?? 1) > 0
        && (monster.mnum === PM_WATCHMAN
            || monster.mnum === PM_WATCH_CAPTAIN)
        && !!monster.mpeaceful
        && couldsee(monster.mx, monster.my));
}

export function dryFountainTerrain(location, causedByHero = true) {
    if (location?.typ !== FOUNTAIN)
        return { dried: false, warning: null };
    const alreadyWarned = !!((location.looted ?? 0) & F_WARNED);
    if (rn2(3) !== 0 && !alreadyWarned)
        return { dried: false, warning: null };

    if (causedByHero
        && inTown(game.level, game.u.ux, game.u.uy)
        && !alreadyWarned) {
        location.looted = (location.looted ?? 0) | F_WARNED;
        return {
            dried: false,
            warning: visiblePeacefulWatchman() || 'trickle',
        };
    }

    location.typ = ROOM;
    location.flags = 0;
    location.looted = 0;
    location.blessedftn = 0;
    game.level.flags.nfountains = Math.max(
        0, (game.level.flags.nfountains ?? 1) - 1,
    );
    newsym(game.u.ux, game.u.uy);
    return { dried: true, warning: null };
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
    const result = dryFountainTerrain(
        game.level?.at(game.u.ux, game.u.uy), true,
    );
    await reportFountainWarning(result.warning);
    return clone;
}
