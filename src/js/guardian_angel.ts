import type { PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { MM_ADJACENTOK, MM_EMIN, MM_NOMSG, STRAT_APPEARMSG, W_ARMS } from './const.js';
import { canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { requireInitializedGame, requireLiveGame } from './gstate.js';
import { findMonsterNearPosition, finishSpecialRoamer, makemonAt, mksobj } from './mklev.js';
import { MONSTER_NAME } from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { monsterName } from './monster_name.js';
import { d, rn1, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';

import { heroHasConflict } from './hero_conflict.js';
import { formatFeltMessage } from './hero_speech.js';
import { regainHearingAfterHelplessness } from './hunger.js';
import { addCreatedObjectToMonsterInventory } from './monster_inventory.js';
import { giveMonsterStartingObject } from './monster_starting_inventory.js';
import { selectHandToHandWeapon } from './monster_weapon.js';
import { initializeMonsterArmor } from './monworn.js';
import { AMULET_OF_REFLECTION, SHIELD_OF_REFLECTION, OBJECT_NAMES } from './object_data.js';
import { blessObjectState } from './object_state.js';

const SILVER_SABER = OBJECT_NAMES.indexOf('silver saber');
const PM_ANGEL = MONSTER_NAME.indexOf('Angel');

// C minion.c:lose_guardian_angel(). A guardian has minion data, not pet data.
export async function loseGuardianAngel(
    monster: Monster | null,
    state: PlayingGameState = requireInitializedGame(),
): Promise<{ heroDied: boolean }> {
    requireLiveGame(state);
    if (monster) {
        if (canSpotMonster(monster)) {
            const name = monsterName(monster, { state, capitalized: true });
            if (heroIsDeaf(state)) {
                await plineWithContinuation(`${name} vanishes!`);
            } else {
                await plineWithContinuation(`${name} rebukes you, saying:`);
                await plineWithContinuation('"Since you desire conflict, have some more!"');
            }
        }
        await removeMonsterFromGame(monster);
        if (state.program_state.gameover) return { heroDied: true };
    }

    for (let remaining = rn1(3, 2); remaining > 0; remaining--) {
        await createGuardianAngel(false, state);
        if (state.program_state.gameover) return { heroDied: true };
    }
    return { heroDied: false };
}

// C minion.c:gain_guardian_angel(), called only on the first Astral arrival.
export async function gainGuardianAngel(state: PlayingGameState = requireInitializedGame()): Promise<void> {
    await regainHearingAfterHelplessness({ state });
    if (heroHasConflict(state)) {
        await plineWithContinuation(heroIsDeaf(state)
            ? formatFeltMessage('a booming voice:', state) : 'A voice booms:');
        await plineWithContinuation('"Thy desire for conflict shall be fulfilled!"');
        await loseGuardianAngel(null, state);
        return;
    }
    if (state.u.ualign.record <= 8) return;
    await plineWithContinuation(heroIsDeaf(state)
        ? formatFeltMessage('a soft voice:', state) : 'A voice whispers:');
    await plineWithContinuation('"Thou hast been worthy of me!"');
    const angel = await createGuardianAngel(true, state);
    if (!angel) return;
    angel.mstrategy = (angel.mstrategy ?? 0) & ~STRAT_APPEARMSG;
    if (state.u.uconduct.pets) {
        angel.mtame = 10;
        state.u.uconduct.pets++;
    }
    newsym(angel.mx, angel.my);
    await plineWithContinuation(heroIsBlind(state)
        ? formatFeltMessage('the presence of a friendly angel near you.', state)
        : 'An angel appears near you.');
    angel.m_lev = rn1(8, 15);
    angel.mhp = angel.mhpmax = d(angel.m_lev, 10) + 30 + rnd(30);
    let weapon = selectHandToHandWeapon(angel, state);
    if (!weapon) {
        weapon = await mksobj(SILVER_SABER, false, false);
        await addCreatedObjectToMonsterInventory(angel, weapon, state);
        if (weapon.where === 'gone') throw new Error("The guardian's new saber unexpectedly merged");
    }
    blessObjectState(weapon, state);
    if (weapon.spe < 4) weapon.spe += rnd(4);
    const shield = angel.minvent?.find(object => ((object.owornmask ?? 0) & W_ARMS) !== 0);
    if (shield?.otyp !== SHIELD_OF_REFLECTION) {
        await giveMonsterStartingObject(angel, AMULET_OF_REFLECTION);
        await initializeMonsterArmor(angel, state);
    }
}

async function createGuardianAngel(peaceful: boolean, state: PlayingGameState): Promise<Monster | null> {
    const position = findMonsterNearPosition(PM_ANGEL, state.u.ux, state.u.uy, { state });
    if (!position) return null;
    // enexto supplies an empty square before mk_roamer creates the angel.
    const angel = await makemonAt(PM_ANGEL, position.x, position.y,
        MM_ADJACENTOK | MM_EMIN | MM_NOMSG);
    if (angel && !state.program_state.gameover)
        finishSpecialRoamer(angel, state.u.ualign.type, peaceful);
    return angel;
}
