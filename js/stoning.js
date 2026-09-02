// Hero contact with petrifying species and corpses.
// C refs: mondata.c touch_petrifies()/poly_when_stoned(),
// pickup.c fatal_corpse_mistake(), and trap.c instapetrify().

import { G_GENOD, STONING } from './const.js';
import { pline } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { CORPSE } from './object_data.js';
import { heroIsPolymorphed, polymonHero } from './polyself.js';

const PM_CHICKATRICE = 9;
const PM_COCKATRICE = 10;
const PM_STONE_GOLEM = 257;
const S_GOLEM = 55;

export function touchPetrifies(mnum) {
    return mnum === PM_CHICKATRICE || mnum === PM_COCKATRICE;
}

function heroResistsStoning() {
    return !!(game.u?.stoneResistance || game.u?.stone_resistance);
}

function heroCanBecomeStoneGolem() {
    const form = game.u?.umonnum;
    const stoneGolemGenocided = !!(
        (game.mvitals?.[PM_STONE_GOLEM]?.mvflags ?? 0) & G_GENOD
    );
    return heroIsPolymorphed(game)
        && MONSTER_SYMBOL[form] === S_GOLEM
        && form !== PM_STONE_GOLEM
        && !stoneGolemGenocided;
}

function corpseWithArticle(object) {
    const species = MONSTER_NAME[object.corpsenm] || 'monster';
    const name = object.oextra?.oname || object.oname;
    const noun = `${species} corpse${name ? ` named ${name}` : ''}`;
    return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

export async function touchPetrifyingCorpse(object, {
    action = 'Touching', beforeDeath = null,
} = {}) {
    const gloves = game.uarmg || game.u?.uarmg;
    if (object?.otyp !== CORPSE || !touchPetrifies(object.corpsenm)
        || gloves || heroResistsStoning()) return null;

    if (heroCanBecomeStoneGolem()) {
        await polymonHero(PM_STONE_GOLEM);
        return null;
    }

    const corpse = corpseWithArticle(object);
    await pline(`${action} ${corpse} is a fatal mistake.`);
    await beforeDeath?.();
    await pline('You turn to stone...');
    const died = await finishHeroDeath({
        killer: corpse,
        deathVerb: 'turned to stone',
        deathLineShown: true,
        deathType: STONING,
    });
    return { died };
}
