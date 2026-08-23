// mondeath.js — shared monster fatality interception.
// C refs: mon.c mlifesaver(), lifesaved_monster(), mondead().

import { W_AMUL } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { flush_screen, pline } from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import { MONSTER_NAME } from './monster_data.js';
import { recordObjectKnowledge } from './object_knowledge.js';

async function lifeSavingPage(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
}

// which_armor(mon, W_AMUL) is the eligibility boundary: carrying an amulet
// without wearing it must never intercept monster death.
export function wornMonsterLifeSaver(monster) {
    return (monster?.minvent || monster?.inventory || []).find(object =>
        object.otyp === 202 && ((object.owornmask ?? 0) & W_AMUL));
}

// Run the source pre-detach revival transaction.  The fatal caller owns the
// credited kill phrase and supplies it as the first pager; this owner consumes
// the amulet and restores the actor before mondead() could detach it.
export async function lifeSaveMonster(
    monster, amulet, { firstPage, retainCursor = false } = {},
) {
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    const subject = `The ${name}`;
    await lifeSavingPage(firstPage || 'But wait...--More--');

    exerciseAttribute(4, true);
    recordObjectKnowledge(amulet.otyp);
    await lifeSavingPage(
        `${subject}'s medallion begins to glow!--More--`,
    );
    await lifeSavingPage(`${subject} looks much better!--More--`);

    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(amulet);
    if (index >= 0) inventory.splice(index, 1);
    amulet.owornmask = 0;
    amulet.worn = false;
    amulet.wornSlot = null;
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) & ~W_AMUL;
    checkMonsterGearNextTurn(monster);
    monster.dead = false;
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    monster.mhpmax = Math.max(
        monster.mhpmax ?? 1, (monster.m_lev ?? 0) + 1, 10,
    );
    monster.mhp = monster.mhpmax;
    await pline('The medallion crumbles to dust!');
    if (retainCursor)
        game._cursorOverride = [monster.mx - 1, monster.my + 1];
}
