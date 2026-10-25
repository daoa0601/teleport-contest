import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { BEAR_TRAP, HWALL, TT_BEARTRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { maketrap } from '../js/mklev.js';
import { PICK_AXE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';
void test('chewing a shop wall never starts a real dig', async () => {
    const level = freshObjectRoom();
    await createStaffedShop({
        left: 8, right: 14, top: 8, bottom: 12,
        keeperX: 11, keeperY: 11, doorX: 8, doorY: 10,
    });
    level.requireAt(11, 10).typ = HWALL;
    const pick = await addInventoryObject(PICK_AXE, { spe: 0 });
    game.uwep = game.u.uwep = pick;
    const input = resetInputState();
    installPagerInput(input, { expected: /dig|wall|hard/, limit: 10 });
    input.feed(`${pick.invlet}l`);
    initRng(31n);
    await rhack('a'.charCodeAt(0));
    await continueCountedCommand();
    assert.match(String(game._pending_message), /You start digging\.  This wall seems too hard to dig into\.$/);
    assert.equal(level.requireAt(11, 10).typ, HWALL);
    assert.equal(game._occupation, null);
});
// C dig.c dig() downward branch: a trapped hero digs at the bear trap holding
// her; rnl(7) either drives the pick into her own foot or wrecks the trap.
void test('digging down inside a bear trap hits the hero or frees her', async () => {
    for (const [seed, expectHit] of [[2n, true], [4n, false]]) {
        const level = freshObjectRoom();
        const trap = await maketrap(10, 10, BEAR_TRAP);
        assert.ok(trap);
        game.u.utrap = 4;
        game.u.utraptype = TT_BEARTRAP;
        const pick = await addInventoryObject(PICK_AXE, { spe: 0 });
        game.uwep = game.u.uwep = pick;
        const input = resetInputState();
        installPagerInput(input, { expected: /dig|trap|foot/, limit: 10 });
        input.feed(`${pick.invlet}>`);
        initRng(seed);
        await rhack('a'.charCodeAt(0));
        let swings = 0;
        for (; game._occupation && swings < 20; swings++)
            await continueCountedCommand();
        assert.ok(swings < 20, 'Digging down should resolve the bear trap.');
        if (expectHit) {
            assert.match(String(game._pending_message), /You hit yourself in the foot\.$/);
            assert.ok((game.u.uhp ?? 40) < 40, 'The self-inflicted strike must cost HP.');
            assert.ok(level.traps.includes(trap), 'A foot hit leaves the trap set.');
            assert.ok((game.u.utrap ?? 0) > 0, 'A foot hit leaves the hero trapped.');
        }
        else {
            assert.match(String(game._pending_message), /You destroy the bear trap with your pick-axe\.$/);
            assert.ok(!level.traps.includes(trap), 'The trap must be gone.');
            assert.equal(game.u.utrap ?? 0, 0, 'Destroying the trap frees the hero.');
        }
    }
});
//# sourceMappingURL=audit2_dig_effort.test.js.map