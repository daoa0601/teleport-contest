import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { POLY_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { IRON_SHOES, KICKING_BOOTS } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { MONSTER_NAME } from '../js/monster_data.js';
for (const protection of ['antimagic', 'unchanging']) {
    void test(`${protection} leaves a revealed polymorph trap in place`, async () => {
        const level = freshObjectRoom();
        if (protection === 'antimagic')
            grantIntrinsicProperty('antimagic', 'outside');
        else
            game.u.unchanging = true;
        const originalForm = game.u.umonnum;
        const trap = addTrap(level, POLY_TRAP, 10, 10);
        const outcome = await triggerHeroTrap(trap);
        assert.equal(outcome.died, false);
        assert.equal(level.traps.includes(trap), true);
        assert.equal(trap.tseen, true);
        assert.equal(game.u.umonnum, originalForm);
        assert.equal(game._pending_message, 'You step onto a polymorph trap!  You feel momentarily different.');
    });
}
void test('a polymorph trap replaces worn iron shoes with kicking boots and vanishes', async () => {
    const level = freshObjectRoom();
    const shoes = await addInventoryObject(IRON_SHOES, { spe: 2 });
    wearHeroArmor(shoes);
    const originalForm = game.u.umonnum;
    const trap = addTrap(level, POLY_TRAP, 10, 10);
    installPagerInput(resetInputState(), { expected: /polymorph trap|warps strangely/, limit: 3 });
    await triggerHeroTrap(trap);
    assert.equal(level.traps.includes(trap), false);
    assert.equal(game.u.umonnum, originalForm);
    assert.equal(game.uarmf?.otyp, KICKING_BOOTS);
    assert.equal(game.uarmf?.spe, 2);
    assert.equal(shoes.where, 'gone');
});
void test('an unprotected hero removes the trap before choosing a new form', async () => {
    const level = freshObjectRoom({ hero: { polymorphControl: true }, gameplaySeed: 2n });
    const trap = addTrap(level, POLY_TRAP, 10, 10);
    const input = resetInputState();
    input.beforeRead = () => { assert.equal(level.traps.includes(trap), false); };
    await answerPrompts(triggerHeroTrap(trap), input, [
        { prompt: /You step onto a polymorph trap!  You feel a change coming over you\.--More--/, keys: ' ' },
        { prompt: /Become what kind of monster\?/, keys: 'hill giant\n' },
    ]);
    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('hill giant'));
});
//# sourceMappingURL=hero_polymorph_trap.test.js.map