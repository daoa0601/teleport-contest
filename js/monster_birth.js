// Runtime completion of a monster birth.
// C refs: makemon.c:makemon(), pager.c:mhidden_description(), dochugw(FALSE).
import { BOLT_LIM, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, M_AP_TYPE, MM_NOMSG, MM_NOEXCLAM, } from './const.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, glyphAt, newsym, plineWithContinuation, } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { objectAtMapDescription } from './map_object_description.js';
import { monsterHasNoAttacks } from './monster_data.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { monsterName } from './monster_name.js';
import { verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { stopHeroOccupation } from './occupation.js';
import { visibleRegionAt } from './regions.js';
import { heroIsHallucinating } from './senses.js';
import { couldsee, monsterEmitsLight } from './vision.js';
export async function finishMonsterBirth(monster, flags = 0, state = game) {
    requireLiveGame(state);
    if (monsterEmitsLight(monster.mnum))
        state.vision_full_recalc = 1;
    if (state.in_mklev)
        return monster;
    newsym(monster.mx, monster.my);
    if (!(flags & MM_NOMSG)) {
        const appearance = M_AP_TYPE(monster);
        let exclaim = !(flags & MM_NOEXCLAM);
        let subject = null;
        if ((canSeeMonster(monster)
            && (appearance === M_AP_NOTHING || appearance === M_AP_MONSTER))
            || canSenseMonster(monster)) {
            subject = monsterName(monster, { article: 'a', capitalized: true, state });
            if (appearance === M_AP_MONSTER)
                exclaim = true;
        }
        else if (canSeeMonster(monster)) {
            const description = await disguisedBirthName(monster, state);
            subject = description.charAt(0).toUpperCase() + description.slice(1);
        }
        if (subject) {
            const dx = monster.mx - state.u.ux, dy = monster.my - state.u.uy;
            const near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? ' next to you'
                : dx * dx + dy * dy <= BOLT_LIM * BOLT_LIM ? ' close by' : '';
            await plineWithContinuation(`${subject}${exclaim ? ' suddenly' : ''} ${verbForSubject(subject, 'appear')}${near}${exclaim ? '!' : '.'}`, {
                noRepeat: true,
            });
        }
    }
    await interruptOccupationForBirth(monster, state);
    return monster;
}
async function disguisedBirthName(monster, state) {
    const appearance = M_AP_TYPE(monster);
    let name;
    if (appearance === M_AP_FURNITURE) {
        const symbol = monster.mappearance === undefined
            ? undefined : MAP_SYMBOLS[monster.mappearance];
        if (!symbol)
            throw new Error('mimic furniture appearance has no map symbol');
        name = withIndefiniteArticle(symbol.name);
    }
    else if (appearance === M_AP_OBJECT) {
        name = await objectAtMonsterDescription(monster, state);
    }
    else {
        name = 'something';
    }
    const region = visibleRegionAt(state, monster.mx, monster.my);
    const range = Math.max(state.u.xray_range ?? 1, 1);
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    if (region && distance <= range * (range + 1))
        name += `, in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`;
    return name;
}
export async function objectAtMonsterDescription(monster, state = game, { glyph = null } = {}) {
    const level = requireGameLevel(state);
    glyph ??= level.flags.hero_memory
        ? level.at(monster.mx, monster.my)?.remembered_glyph ?? null
        : glyphAt(monster.mx, monster.my, state);
    return objectAtMapDescription(monster.mx, monster.my, glyph, state, 'hidden');
}
async function interruptOccupationForBirth(monster, state) {
    if (!state._occupation)
        return;
    if (!heroIsHallucinating(state)
        && (monster.mpeaceful || monsterHasNoAttacks(monster.mnum)))
        return;
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    if (distance > (BOLT_LIM + 1) ** 2 || !canSpotMonster(monster)
        || !couldsee(monster.mx, monster.my) || !monster.mcanmove
        || monsterIsScaredAt(monster, state, state.u.ux, state.u.uy))
        return;
    await stopHeroOccupation(state);
}
//# sourceMappingURL=monster_birth.js.map