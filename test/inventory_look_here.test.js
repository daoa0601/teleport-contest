import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ALTAR, ICE, MM_NOGRP, MM_NOWAIT, NO_MINVENT, PIT, POOL } from '../js/const.js';
import { displayLiquidName } from '../js/display.js';
import { initRng } from '../js/rng.js';
import { trapName } from '../js/trap_name.js';
import { withIndefiniteArticle } from '../js/object_grammar.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
for (const blind of [false, true]) {
    void test(`${blind ? 'feeling' : 'looking'} while swallowed inspects the stomach before any floor features`, async (t) => {
        const level = freshObjectRoom({ hero: { blindTurns: blind ? 10 : 0 } });
        const worm = await createMonsterAt('purple worm', game.u.ux, game.u.uy, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        game.u.uswallow = 1;
        game.u.ustuck = worm;
        addTrap(level, PIT, game.u.ux, game.u.uy, { tseen: true });
        const cloud = createHarmlessGasCloudSelection(game, [{ x: game.u.ux, y: game.u.uy }]);
        assert.ok(cloud);
        cloud.damage = 8;
        const dagger = await floorObject(DAGGER, game.u.ux, game.u.uy, { dknown: false });
        const input = resetInputState();
        planInput(input, t, [{
                prompt: blind ? /You try to feel what is lying in the purple worm's stomach\.--More--/
                    : /You look around to see what is lying in the purple worm's stomach\.--More--/,
                keys: ' ',
            }]);
        await rhack(':'.charCodeAt(0));
        assert.equal(game._pending_message, `You ${blind ? 'feel' : 'see'} no objects here.`);
        assert.equal(dagger.dknown, false);
        assert.equal(game.context.move, blind ? 1 : 0);
    });
}
void test('looking above a pool describes the water without revealing submerged objects', async (t) => {
    const level = freshObjectRoom({ hero: { levitationTurns: 10 } });
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const dagger = await floorObject(DAGGER, game.u.ux, game.u.uy, { dknown: false });
    const input = resetInputState();
    planInput(input, t, []);
    await rhack(':'.charCodeAt(0));
    assert.equal(game._pending_message, 'There is a pool of water here.');
    assert.equal(dagger.dknown, false);
    assert.equal(game.context.move, 0);
});
void test('blind inspection of an altar asks to feel here before describing the altar', async (t) => {
    const level = freshObjectRoom({ hero: { blindTurns: 10 } });
    const altar = level.requireAt(game.u.ux, game.u.uy);
    altar.typ = ALTAR;
    altar.flags = 0;
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /You try to feel what is here\.--More--/, keys: ' ' },
        { prompt: /There is an altar to Moloch \(unaligned\) here\.--More--/, keys: ' ' },
    ]);
    await rhack(':'.charCodeAt(0));
    assert.equal(game._pending_message, 'You feel no objects here.');
    assert.equal(game.context.move, 1);
});
void test('look-here describes a known trap before reporting an empty floor', async (t) => {
    const level = freshObjectRoom();
    addTrap(level, PIT, game.u.ux, game.u.uy, { tseen: true });
    const input = resetInputState();
    planInput(input, t, []);
    await rhack(':'.charCodeAt(0));
    assert.match(game._pending_message, /^There is a pit here\.  You see no objects here\.$/);
    assert.equal(game.context.move, 0);
});
void test('each look at hallucinated ice chooses one liquid description', async (t) => {
    const level = freshObjectRoom({ hero: { hallucinationTurns: 10 } });
    level.requireAt(game.u.ux, game.u.uy).typ = ICE;
    initRng(71);
    const liquids = [displayLiquidName('water'), displayLiquidName('water')];
    initRng(71);
    const input = resetInputState();
    planInput(input, t, []);
    for (const liquid of liquids) {
        game._pending_message = '';
        await rhack(':'.charCodeAt(0));
        assert.ok(game._pending_message.includes(`solid frozen ${liquid} here.`), game._pending_message);
    }
});
void test('looking at a seen trap on hallucinated ice chooses its name before the liquid', async (t) => {
    const level = freshObjectRoom({ hero: { hallucinationTurns: 10 } });
    level.requireAt(game.u.ux, game.u.uy).typ = ICE;
    addTrap(level, PIT, game.u.ux, game.u.uy, { tseen: true });
    initRng(71);
    const trap = withIndefiniteArticle(trapName(PIT));
    const liquid = displayLiquidName('water');
    initRng(71);
    const input = resetInputState();
    const previousDisplay = input.display;
    const messages = [];
    input.display = {
        async readKey() {
            assert.equal(messages.length, 0, 'Looking here should page at most one description');
            messages.push(game._pending_message);
            return 32;
        },
    };
    t.after(() => { input.display = previousDisplay; });
    await rhack(':'.charCodeAt(0));
    messages.push(game._pending_message);
    const descriptions = messages.join('\n');
    assert.ok(descriptions.includes(`There is ${trap} here.`), descriptions);
    assert.ok(descriptions.includes(`solid frozen ${liquid} here.`), descriptions);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=inventory_look_here.test.js.map