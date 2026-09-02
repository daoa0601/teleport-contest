// Vampire shape changing for the hero.
// C refs: cmd.c:domonability(), polyself.c:dopoly()/polyself(POLY_MONSTER).

import { exerciseAttribute } from './attrib.js';
import { A_WIS, G_GENOD } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    MONSTER_NAME, monsterIsVampire, monsterTypeName,
    validVampireShiftForm,
} from './monster_data.js';
import {
    heroCanControlPolymorph, heroIsUnchanging, polymonHero,
} from './polyself.js';
import { promptYesNo } from './query.js';
import { rn2 } from './rng.js';

const PM_WOLF = MONSTER_NAME.indexOf('wolf');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_VAMPIRE_BAT = MONSTER_NAME.indexOf('vampire bat');
const PM_VAMPIRE_LEADER = MONSTER_NAME.indexOf('vampire leader');

function indefiniteMonsterName(mnum, female = false) {
    const name = monsterTypeName(mnum, female);
    if (/^[A-Z]/u.test(name)) return name;
    return `${/^[aeiou]/iu.test(name) ? 'an' : 'a'} ${name}`;
}

function randomVampireForm(currentForm, baseForm, random) {
    let nextForm;
    if (currentForm === PM_VAMPIRE_LEADER && random(10) === 0)
        nextForm = PM_WOLF;
    else if (random(4) === 0) nextForm = PM_FOG_CLOUD;
    else nextForm = PM_VAMPIRE_BAT;

    if (validVampireShiftForm(baseForm, currentForm)
        && random(2) === 0) return baseForm;
    return nextForm;
}

export function heroCanChangeVampireShape(state = game) {
    const currentForm = state.u?.umonnum;
    return monsterIsVampire(currentForm)
        || validVampireShiftForm(state.u?.mcham, currentForm);
}

export async function useHeroVampireShift({
    random = rn2,
    publish = plineWithContinuation,
} = {}) {
    if (!heroCanChangeVampireShape(game))
        return { used: false, spentTime: false, changed: false };

    if (heroIsUnchanging(game)) {
        await publish('You fail to transform!');
        return { used: true, spentTime: true, changed: false };
    }

    const currentForm = game.u.umonnum;
    const baseForm = monsterIsVampire(currentForm)
        ? currentForm : game.u.mcham;
    const nextForm = randomVampireForm(currentForm, baseForm, random);

    if (heroCanControlPolymorph(game)) {
        const answer = await promptYesNo(
            `Become ${indefiniteMonsterName(nextForm)}? [yn] (n) `,
        );
        if (answer !== 'y')
            return { used: true, spentTime: true, changed: false };
    }

    if ((game.mvitals?.[nextForm]?.mvflags ?? 0) & G_GENOD) {
        await publish(`You feel rather ${MONSTER_NAME[nextForm]}-ish.`);
        exerciseAttribute(A_WIS, true, game);
        return { used: true, spentTime: true, changed: false };
    }

    game.u.mcham = baseForm;
    await polymonHero(nextForm);
    const changed = currentForm !== game.u.umonnum;
    if (changed) {
        const newFormName = indefiniteMonsterName(
            game.u.umonnum,
            !!game.flags?.female,
        );
        await publish(`You transform into ${newFormName}.`);
    }
    return {
        used: true,
        spentTime: true,
        changed,
        form: game.u.umonnum,
    };
}
