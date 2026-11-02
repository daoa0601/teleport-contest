// C do.c:dodrop() calls reset_occupations() for every nonzero result:
// drop() returns ECMD_FAIL not only when a drop is refused but also when
// getobj() is cancelled, and ECMD_TIME on success.  cmd.c:reset_occupations()
// clears do_wear.c's interrupted 'A' state, so a later inventory name says
// "(being worn)" rather than "(being doffed)" and a fresh 'A' starts over
// from its menu and works through the whole removal delay again.
import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { MENU_PARTIAL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { RING_MAIL } from '../js/object_data.js';
import { removeMonsterFromGame } from '../js/mon.js';
import { wornObjectDescription } from '../js/objnam.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { wearHeroArmor } from '../js/armor.js';
// An interrupted bulk takeoff: the adjacent monster stops the occupation the
// way allmain.c's monster_nearby() check does, which leaves the 'A' context
// behind in C (svc.context.takeoff).
async function interruptBulkTakeoff(armorInvlet) {
    const newt = await createMonsterAt('newt', game.u.ux + 1, game.u.uy);
    pushKeys(`${armorInvlet}\n`);
    await rhack('A'.charCodeAt(0));
    await continueCountedCommand();
    assert.ok(game.context.takeoff, 'interrupted bulk takeoff leaves its context');
    const worn = game.uarm;
    assert.ok(worn);
    assert.equal(wornObjectDescription(worn), ' (being doffed)');
    return newt;
}
void test('a refused drop ends an interrupted bulk takeoff', async () => {
    await freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const mail = await addInventoryObject(RING_MAIL);
    await wearHeroArmor(mail);
    await interruptBulkTakeoff(mail.invlet ?? 'a');
    pushKeys(mail.invlet ?? 'a');
    await rhack('d'.charCodeAt(0));
    assert.equal(game._pending_message, 'You cannot drop something you are wearing.');
    assert.equal(game.context.takeoff, undefined, 'dodrop clears the interrupted takeoff context (reset_occupations)');
    assert.equal(wornObjectDescription(mail), ' (being worn)');
});
void test('a cancelled drop prompt also clears the interrupted takeoff', async () => {
    await freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const mail = await addInventoryObject(RING_MAIL);
    await wearHeroArmor(mail);
    await interruptBulkTakeoff(mail.invlet ?? 'a');
    pushKeys('\x1b');
    await rhack('d'.charCodeAt(0));
    assert.equal(game.context.takeoff, undefined, 'drop(NULL) is ECMD_FAIL, so dodrop still resets occupations');
});
void test('after a refused drop a new takeoff-all restarts the full removal', async () => {
    await freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const mail = await addInventoryObject(RING_MAIL);
    await wearHeroArmor(mail);
    const newt = await interruptBulkTakeoff(mail.invlet ?? 'a');
    pushKeys(mail.invlet ?? 'a');
    await rhack('d'.charCodeAt(0));
    // Without the interrupting newt the restarted takeoff runs to completion.
    await removeMonsterFromGame(newt);
    pushKeys(`${mail.invlet ?? 'a'}\n`);
    await rhack('A'.charCodeAt(0));
    assert.equal(game.context.takeoff?.delay, 4, 'the new selection restarts the ring mail delay from its beginning');
    pushKeys(' '.repeat(30));
    for (let turn = 0; turn < 5; turn++)
        await continueCountedCommand();
    assert.equal(game.uarm, null, 'the restarted removal takes the mail off');
    assert.match(game._pending_message ?? '', /You finish disrobing\./);
});
//# sourceMappingURL=drop_clears_interrupted_takeoff.test.js.map