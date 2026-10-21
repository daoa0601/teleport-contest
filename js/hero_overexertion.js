// Hero attack metabolism and heavy-load exertion.
// C ref: hack.c overexertion() and overexert_hp().
import { exerciseAttribute } from './attrib.js';
import { A_CON, Upolyd } from './const.js';
import { pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { putHeroToSleep } from './hero_sleep.js';
import { getHungry } from './hunger.js';
import { HVY_ENCUMBER, nearCapacity } from './weight.js';
function heroIsHelpless(state) {
    return (state.multi ?? 0) < 0
        || (state._helplessTurns ?? 0) > 0;
}
function activeHitPointField(hero) {
    return Upolyd(hero) ? 'mh' : 'uhp';
}
export async function checkHeroAttackOverexertion(state = game) {
    requirePlayingGame(state);
    await getHungry();
    if (state.program_state.gameover)
        return true;
    if ((state.moves ?? 0) % 3 !== 0
        && nearCapacity(state) >= HVY_ENCUMBER)
        await overexertHeroHp(state);
    return heroIsHelpless(state);
}
// C hack.c:overexert_hp(): heavy work costs a hit point, or the last one
// makes the hero pass out.
export async function overexertHeroHp(state = game) {
    requirePlayingGame(state);
    const field = activeHitPointField(state.u);
    const hitPoints = state.u?.[field] ?? 0;
    if (hitPoints > 1) {
        state.u[field] = hitPoints - 1;
        state.context.botl = true;
    }
    else {
        await pline('You pass out from exertion!');
        await exerciseAttribute(A_CON, false, state);
        putHeroToSleep(10, {
            state,
            reason: 'passed out from exertion',
            doneMessage: 'You can move again.',
        });
    }
}
//# sourceMappingURL=hero_overexertion.js.map