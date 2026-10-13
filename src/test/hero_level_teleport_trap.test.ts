import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { DUST, LEVEL_TELEP } from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { answerPrompts } from './support/input-boundaries.js';

void test('stepping onto a level teleport trap wears departure engravings before travelling', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    makeEngravingAt(10, 10, '.', null, 0, DUST);
    game.level = destination;
    makeEngravingAt(10, 10, '.', null, 0, DUST);
    game.level = source;
    addTrap(source, LEVEL_TELEP, 11, 10);
    const input = resetInputState();
    input.feed('l');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /You step onto a level teleport trap!--More--/, keys: ' ' },
        { prompt: /To what level do you want to teleport\?/, keys: '2\r' },
        { prompt: /You feel disoriented\.--More--/, keys: ' ' },
    ]);

    assert.equal(game.level, destination);
    assert.equal(engravingAt(10, 10, source), null,
        'walking away erases the one-character dust engraving on the departure level');
    assert.equal(engravingAt(10, 10, destination)?.text, '.',
        'the same coordinates on the destination level are not part of the step');
});

for (const property of ['levitation', 'flying'] as const) {
    void test(`a hero with ${property} announces airborne level teleport trap contact`, async () => {
        const level = freshObjectRoom({ flags: { debug: true } });
        grantIntrinsicProperty(property, 'outside');
        const input = resetInputState();

        await answerPrompts(triggerHeroTrap(addTrap(level, LEVEL_TELEP, 10, 10)), input, [
            { prompt: property === 'levitation'
                ? /You float onto a level teleport trap!--More--/
                : /You fly onto a level teleport trap!--More--/, keys: ' ' },
            { prompt: /To what level do you want to teleport\?/, keys: '\x1b' },
        ]);
    });
}

for (const acceptDeath of [true, false]) {
    void test(`teleporting to Nowhere ${acceptDeath ? 'ends play without trap confusion' : 'confuses the hero after declining death'}`, async () => {
        const level = freshObjectRoom({ flags: {
            debug: true, bones: false, tombstone: false, disclose: '-i -a -v -g -c -o',
        } });
        requirePlayingGame(game);
        game.storage = memoryStorage();
        game.iflags.toptenwin = false;
        const input = resetInputState();
        input.feed(' 0\ry');
        input.display = {
            async readKey() {
                const row = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '';
                if (row.startsWith('Die?')) return (acceptDeath ? 'y' : 'n').charCodeAt(0);
                const screen = game.nhDisplay?.grid.map(line => line.map(cell => cell.ch).join('')).join('\n') ?? '';
                assert.match(screen, /--More--|\(end\)/);
                return 32;
            },
        };

        await triggerHeroTrap(addTrap(level, LEVEL_TELEP, 10, 10));

        assert.equal(!!game.program_state.gameover, acceptDeath);
        assert.equal(game.u.confusionTurns ?? 0, acceptDeath ? 0 : 3,
            'only a surviving hero receives the trap confusion');
        if (acceptDeath) {
            assert.doesNotMatch(game._pending_message, /disoriented/,
                'the trap must not print another message after the death display');
        } else {
            assert.match(game._pending_message, /Your body rematerializes\..*You feel disoriented\.$/);
        }
    });
}

void test('a level teleport trap pages its announcement before asking for a level', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const trap = addTrap(level, LEVEL_TELEP, 10, 10);
    const input = resetInputState();
    const operation = triggerHeroTrap(trap);

    assert.equal(await Promise.race([
        operation.then(() => 'finished'), input.waitUntilBlocked().then(() => 'input'),
    ]), 'input', 'the trap must request input before returning to the turn');
    assert.match(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '',
        /You step onto a level teleport trap!--More--/);
    assert.equal(level.traps.includes(trap), false);
    assert.equal(game.u.confusionTurns ?? 0, 0);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /^To what level do you want to teleport\?/);
    input.feed('\x1b');
    await operation;
    assert.equal(game.level, level, 'cancelling keeps the hero on this level');
    assert.equal(game.u.confusionTurns, 3, 'an uncontrolled hero is confused even after cancelling');
    assert.equal(game._pending_message, 'You feel disoriented.');
});

void test('teleport control prevents the trap from confusing the hero after cancellation', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    grantIntrinsicProperty('teleportControl', 'outside');
    const input = resetInputState();
    input.feed(' \x1b');

    await triggerHeroTrap(addTrap(level, LEVEL_TELEP, 10, 10));

    assert.equal(game.u.confusionTurns ?? 0, 0);
    assert.equal(game._pending_message, 'You briefly feel centered.');
});

void test('magic resistance leaves an unintentionally triggered level teleport trap in place', async () => {
    const level = freshObjectRoom({ hero: { antimagic: true } });
    const trap = addTrap(level, LEVEL_TELEP, 10, 10);
    const input = resetInputState();
    input.feed(' ');

    await triggerHeroTrap(trap);

    assert.equal(level.traps.includes(trap), true);
    assert.equal(trap.tseen, true);
    assert.match(game._pending_message, /You feel a wrenching sensation\.$/);
});
