import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { IRONBARS, W_NONDIGGABLE } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const form of ['human', 'garter snake', 'ghost', 'python', 'brown pudding']) {
    void test(`iron bars ${form === 'human' || form === 'python' ? 'block' : 'admit'} a ${form}`, async () => {
        const level = freshObjectRoom({ flags: { mention_walls: true } });
        requirePlayingGame(game);
        level.requireAt(11, 10).typ = IRONBARS;
        if (form !== 'human')
            installPolymorphedHero(form);
        await rhack('l'.charCodeAt(0));
        const admitted = form === 'ghost' || form === 'garter snake' || form === 'brown pudding';
        assert.equal(game.u.ux, admitted ? 11 : 10);
        assert.equal(game.context.move, admitted ? 1 : 0);
        assert.equal(level.requireAt(11, 10).typ, IRONBARS);
        if (!admitted)
            assert.equal(game._pending_message, 'You cannot pass through the bars.');
    });
}
for (const form of ['garter snake', 'rust monster', 'ghost']) {
    void test(`underwater iron bars ${form === 'ghost' ? 'admit' : 'block'} a ${form}`, async () => {
        const level = freshObjectRoom({ hero: { uinwater: true } });
        requirePlayingGame(game);
        installPolymorphedHero(form);
        level.requireAt(11, 10).typ = IRONBARS;
        // Exercise the obstacle itself on a step that water does not divert.
        initRng(2n);
        // Surfacing redraws the screen, which first pages pending messages.
        installPagerInput(resetInputState(), { expected: /[Bb]ack (?:on|over) solid ground/, limit: 2 });
        await rhack('l'.charCodeAt(0));
        const admitted = form === 'ghost';
        assert.equal(game.u.ux, admitted ? 11 : 10);
        assert.equal(game.context.move, admitted ? 1 : 0);
        assert.equal(level.requireAt(11, 10).typ, IRONBARS);
        assert.ok(!game.context.digging?.chew, 'an underwater obstacle cannot be chewed');
        if (!admitted)
            assert.equal(game._pending_message, 'There is an obstacle there.');
    });
}
for (const form of ['rock mole', 'rust monster', 'black pudding']) {
    void test(`a ${form} must chew through iron bars before moving into them`, async () => {
        const level = freshObjectRoom({ flags: { verbose: true } });
        requirePlayingGame(game);
        installPolymorphedHero(form);
        level.requireAt(11, 10).typ = IRONBARS;
        const hunger = game.u.uhunger;
        const input = resetInputState();
        installPagerInput(input, { expected: /chewing|bars/, limit: 5 });
        for (let attempt = 0; attempt < 3; attempt++) {
            await rhack('l'.charCodeAt(0));
            await flushPendingTopline();
            assert.equal(game.u.ux, attempt < 2 ? 10 : 11);
        }
        assert.notEqual(level.requireAt(11, 10).typ, IRONBARS);
        assert.equal(game.u.uconduct.food, 1);
        assert.equal(game.context.digging?.chew, false);
        assert.ok(game.u.uhunger > hunger, 'finishing the chew supplies nutrition');
    });
}
for (const obstacle of ['too full', 'nondiggable']) {
    void test(`a ${obstacle} rock mole cannot chew through bars`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        installPolymorphedHero('rock mole');
        const bars = level.requireAt(11, 10);
        bars.typ = IRONBARS;
        if (obstacle === 'too full')
            game.u.uhunger = 1501;
        else
            bars.wall_info |= W_NONDIGGABLE;
        await rhack('l'.charCodeAt(0));
        assert.equal(game.u.ux, 10);
        assert.equal(game.context.move, 0);
        assert.equal(bars.typ, IRONBARS);
        assert.match(game._pending_message, obstacle === 'too full' ? /too full to eat/ : /hurt your teeth/);
    });
}
//# sourceMappingURL=hero_bars_movement.test.js.map