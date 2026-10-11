// C polyself.c:dopoly(): the monster ability adds feedback after polyself.
import { POLY_MONSTER } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { monsterTypeName } from './monster_data.js';
import { heroCanChangeVampireShape, polymorphHero } from './polyself.js';

export async function useHeroVampireShift() {
    const previous = game.u.umonnum;
    if (heroCanChangeVampireShape(game)) {
        const result = await polymorphHero(POLY_MONSTER);
        if (result.died) return { spentTime: true, died: true };
        if (previous !== game.u.umonnum) {
            const currentForm = game.u.umonnum;
            if (currentForm === undefined) throw new Error('vampire shape change did not install a body');
            const name = monsterTypeName(currentForm, !!game.u.mfemale);
            const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
            await plineWithContinuation(`You transform into ${article} ${name}.`);
            newsym(game.u.ux, game.u.uy);
        }
    }
    return { spentTime: true, changed: previous !== game.u.umonnum };
}
