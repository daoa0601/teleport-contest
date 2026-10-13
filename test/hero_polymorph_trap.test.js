import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { POLY_TRAP } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { flush_screen } from '../js/display.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { IRON_SHOES, KICKING_BOOTS } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
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
void test('wielded Magicbane resists a polymorph trap without consuming it', async () => {
    const level = freshObjectRoom();
    const weapon = await addInventoryItem(await artifactObject('Magicbane'));
    await setPrimaryWeapon(weapon);
    const originalForm = game.u.umonnum;
    const trap = addTrap(level, POLY_TRAP, 10, 10);
    const input = resetInputState();
    input.beforeRead = () => {
        assert.fail(`A resisted polymorph trap must not ask for input: ${game._pending_message}`);
    };
    await triggerHeroTrap(trap);
    assert.equal(level.traps.includes(trap), true);
    assert.equal(trap.tseen, true);
    assert.equal(game.u.umonnum, originalForm);
    assert.equal(game._pending_message, 'You step onto a polymorph trap!  You feel momentarily different.');
});
void test('a priest recognizes blessed replacement boots when a polymorph trap prints them', async () => {
    const level = freshObjectRoom({ role: 'priest' });
    const shoes = await addInventoryObject(IRON_SHOES, { blessed: true });
    wearHeroArmor(shoes);
    const trap = addTrap(level, POLY_TRAP, 10, 10);
    installPagerInput(resetInputState(), { expected: /polymorph trap|warps strangely/, limit: 3 });
    await triggerHeroTrap(trap);
    const replacement = game.uarmf;
    assert.ok(replacement);
    assert.equal(replacement.otyp, KICKING_BOOTS);
    assert.equal(replacement.blessed, true);
    assert.equal(replacement.bknown, true);
    assert.match(game._pending_message, / - a blessed pair of .+ \(being worn\)\./);
});
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
for (const known of [false, true]) {
    void test(`a ${known ? 'known' : 'newly revealed'} polymorph trap keeps the hero visible while changing iron shoes`, async () => {
        const level = freshObjectRoom();
        const shoes = await addInventoryObject(IRON_SHOES);
        wearHeroArmor(shoes);
        const trap = addTrap(level, POLY_TRAP, game.u.ux, game.u.uy, { tseen: known });
        const input = resetInputState();
        input.beforeRead = () => {
            assert.equal(requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '@', 'The trap message must leave the hero visible.');
        };
        installPagerInput(input, { expected: /polymorph trap|warps strangely/, limit: 3 });
        await flush_screen(1);
        await triggerHeroTrap(trap);
        await flush_screen(1);
        assert.equal(level.traps.includes(trap), false);
        assert.equal(game.uarmf?.otyp, KICKING_BOOTS);
        assert.equal(requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '@', 'The hero must remain visible after the shoes change.');
    });
}
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