import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
// The make-invisible wand against a monster. C zap.c:bhitm().

import { BOLT_LIM } from './const.js';
import {
    canSeeMonster, newsym, plineWithContinuation as pline,
} from './display.js';
import { game } from './gstate.js';
import { wakeMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import {
    setMonsterPermanentInvisibility,
} from './monster_invisibility.js';
import { monsterName as nameMonster } from './monster_name.js';
import { heroIsBlind } from './senses.js';
import { cansee } from './vision.js';

function knownInvisible(monster: Monster, state: GameState = game) {
    if (!monster.minvis) return false;
    const hero = state.u;
    if (cansee(monster.mx, monster.my) && (hero.seeInvisible
        || (hero.seeInvisibleTurns ?? 0) > 0
        || hero.detectMonsters || state.detectMonsters)) return true;
    const hasSightedTelepathy = (hero.unblind_telepat_range ?? -1) >= 0
        || state.uarmh?.otyp === 100 || state.uamul?.otyp === 201;
    const distance = (monster.mx - hero.ux) ** 2 + (monster.my - hero.uy) ** 2;
    return !heroIsBlind(state) && hasSightedTelepathy && distance <= BOLT_LIM ** 2;
}

export async function makeMonsterInvisible(monster: Monster) {
    const wasInvisible = !!monster.minvis;
    const wasVisible = canSeeMonster(monster);
    revealMonsterAppearance(monster);
    const name = nameMonster(monster, { capitalized: true });

    setMonsterPermanentInvisibility(monster);
    newsym(monster.mx, monster.my);

    let identified = false;
    if (!wasInvisible && knownInvisible(monster)) {
        await pline(`${name} turns transparent!`);
        identified = true;
    } else if (wasVisible
        && !canSeeMonster(monster)) {
        await pline(`${name} vanishes!`);
    }
    await wakeMonster(monster, { attacked: true });
    return identified;
}
