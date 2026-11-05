import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/do_wear.js';
import { game } from '../js/gstate.js';
import { MENU_PARTIAL, NO_MINVENT, TELEP_TRAP } from '../js/const.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES, SMALL_SHIELD } from '../js/object_data.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
// C monmove.c:dochugw() interrupts an occupation only when dochug()
// returned 0. A monster that steps onto a teleport trap makes m_move()
// report MMOVE_DIED — monmove.c:1509-1514 maps mintrap()'s
// Trap_Moved_Mon to MMOVE_DIED, and trap.c:2081-2083 returns
// Trap_Moved_Mon even when mtele_trap() could not relocate the monster
// because its destination square is occupied — so the hero keeps
// disrobing however threatening the monster's square looks. A monster
// that merely walks into threat range has dochug() return 0 and does
// interrupt (monmove.c:218-233).
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
const ROOM = { left: 8, right: 18, top: 8, bottom: 14, heroX: 17, heroY: 11 };
// (8,13) sits 9 columns west and 2 rows south of the hero: d2 = 85,
// one square outside dochugw()'s (BOLT_LIM+1)^2 = 81 threat radius,
// and lit rooms keep the rat spotable there.
const RAT_X = 8;
const RAT_Y = 13;
async function startDisrobing() {
    const input = freshTurnRoom({ ...ROOM, flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const shield = await addInventoryObject(SMALL_SHIELD);
    const boots = await addInventoryObject(LOW_BOOTS);
    await wearHeroArmor(shield);
    await wearHeroArmor(boots);
    input.feed(`A${boots.invlet}${shield.invlet}\n`);
    await moveloop_core();
    assert.equal(game._occupation?.key, 'takeoff');
    await moveloop_core();
    assert.equal(game._occupation?.key, 'takeoff');
}
async function placeRat() {
    const rat = await createMonsterAt('sewer rat', RAT_X, RAT_Y, NO_MINVENT);
    rat.mpeaceful = false;
    return rat;
}
function capturePagerMessages() {
    const messages = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return 32;
        },
    };
    return messages;
}
void test('a rat stranded on a blocked teleport trap does not stop disrobing', async () => {
    await startDisrobing();
    const rat = await placeRat();
    // Teleport traps whose fixed destination is the hero's own square:
    // mtele_trap() cannot relocate the rat there (teleport.c:1986-1990),
    // so it stays on the trap and "seems disoriented"
    // (teleport.c:1994-1999).
    const level = game.level;
    if (!level)
        throw new Error('the takeoff trap test needs a level');
    for (const y of [RAT_Y - 1, RAT_Y, RAT_Y + 1]) {
        addTrap(level, TELEP_TRAP, RAT_X + 1, y, { teledest: { x: ROOM.heroX, y: ROOM.heroY } });
    }
    const messages = capturePagerMessages();
    for (let turn = 0; turn < 6 && game._occupation; turn++) {
        await moveloop_core();
        messages.push(game._pending_message);
    }
    const lines = messages.filter(Boolean).join('\n');
    assert.match(lines, /The sewer rat seems disoriented\./);
    assert.doesNotMatch(lines, /You stop disrobing\./);
    assert.equal(game._occupation, null, 'the take-off runs to completion');
    assert.match(lines, /You finish disrobing\./);
    assert.equal(rat.mx, RAT_X + 1, 'the failed teleport leaves the rat on the trap');
});
void test('a rat walking into threat range still stops disrobing', async () => {
    await startDisrobing();
    const rat = await placeRat();
    assert.ok((rat.mx - game.u.ux) ** 2 + (rat.my - game.u.uy) ** 2 > 81);
    const messages = capturePagerMessages();
    for (let turn = 0; turn < 6 && game._occupation; turn++) {
        await moveloop_core();
        messages.push(game._pending_message);
    }
    const lines = messages.filter(Boolean).join('\n');
    assert.ok((rat.mx - game.u.ux) ** 2 + (rat.my - game.u.uy) ** 2 <= 81, 'the rat crossed into the threat radius');
    assert.match(lines, /You stop disrobing\./);
    assert.equal(game._occupation, null);
    assert.doesNotMatch(lines, /You finish disrobing\./);
    assert.equal(game.uarms, null, 'the shield already came off before the interruption');
});
//# sourceMappingURL=takeoff_trap_interrupt.test.js.map