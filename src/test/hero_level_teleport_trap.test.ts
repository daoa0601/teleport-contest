import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { DUST, LEVEL_TELEP, NO_MINVENT } from '../js/const.js';
import { newsym, plineWithContinuation } from '../js/display.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { LEVITATION_BOOTS } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireScreenCell } from './support/screen.js';

void test('taking off levitation boots completes trap travel before the next command', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    const boots = await addInventoryObject(LEVITATION_BOOTS);
    wearHeroArmor(boots);
    grantIntrinsicProperty('teleportControl', 'outside');
    addTrap(source, LEVEL_TELEP, 10, 10);
    const input = resetInputState();
    input.feed('T');

    await moveloop_core();
    assert.equal(boots.worn, true, 'the boots stay worn during delayed removal');
    let nextCommandRead = false;
    let acknowledgements = 0;
    input.display = {
        async readKey() {
            const topline = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '';
            if (game._pending_message && /--More--/.test(topline)) {
                assert.ok(++acknowledgements <= 8, 'boot removal and travel must finish their pagers');
                assert.match(topline, /taking off|float gently|level teleport trap|centered|materialize/);
                return 32;
            }
            if (/To what level do you want to teleport\?/.test(topline)) {
                input.feed('\r');
                return '2'.charCodeAt(0);
            }
            assert.ok(game.level === destination, 'delayed removal must finish travel before reading a command');
            assert.equal(nextCommandRead, false, 'the next movement reads one command');
            nextCommandRead = true;
            return 'l'.charCodeAt(0);
        },
    };

    for (let turns = 0; turns < 4 && !nextCommandRead; turns++)
        await moveloop_core();

    assert.equal(nextCommandRead, true, 'removal and travel must reach the next command');
    assert.equal(boots.worn, false);
    assert.equal(game.level, destination);
    assert.equal(game.u.ux, 14, 'the next movement runs from the arrival square');
    assert.equal(game.u.uy, 10);
});

for (const laterMonster of [false, true]) {
    void test(`boots theft completes level teleport before command input${laterMonster ? ' and stops the next monster' : ''}`, async () => {
        const { source, destination } = freshConnectedLevels();
        requirePlayingGame(game);
        game.flags.debug = true;
        game.flags.safe_wait = false;
        game._moveloopStarted = true;
        game.u.umovement = 12;
        game.u.uhp = game.u.uhpmax = 100;
        destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
        const giant = laterMonster
            ? await createMonsterAt('hill giant', 10, 11, NO_MINVENT) : null;
        if (giant) {
            giant.mpeaceful = 0;
            giant.msleeping = 0;
            giant.m_lev = 30;
            giant.movement = 12;
        }
        const nymph = await createMonsterAt('wood nymph', 11, 10, NO_MINVENT);
        nymph.mpeaceful = 0;
        nymph.msleeping = 0;
        nymph.m_lev = 30;
        nymph.movement = 12;
        const boots = await addInventoryObject(LEVITATION_BOOTS);
        wearHeroArmor(boots);
        addTrap(source, LEVEL_TELEP, 10, 10);
        const input = resetInputState();
        input.feed('.');
        initRng(1n);

        await moveloop_core();
        const response = moveloop_core();
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /nymph takes off your.*boots/);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /float gently to the stairs.*level teleport trap/);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.match(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '',
            /To what level do you want to teleport\?/);
        input.feed('2\r');
        installPagerInput(input, {
            expected: /disoriented|stole|nymph|materialize/, limit: 12,
        });
        const pager = input.display;
        assert.ok(pager);
        input.display = {
            async readKey() {
                const topline = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '';
                if (game._pending_message && /--More--/.test(topline)) return pager.readKey();
                assert.ok(game.level === destination, 'travel finishes before another command');
                return 27;
            },
        };
        await response;

        assert.equal(game.inventory.includes(boots), false, 'the nymph completes her theft');
        assert.ok(game.level === destination, 'travel finishes before another command');
        assert.equal(game.u.uhp, 100, 'departure monsters stop moving when travel is scheduled');
        if (giant) assert.equal(giant.movement, 12, 'the later monster keeps its unused movement');
    });
}

void test('a level teleport trap step gives destination monsters their response before another command', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    game.u.uhp = game.u.uhpmax = 100;
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    game.level = destination;
    const giant = await createMonsterAt('hill giant', 14, 10, NO_MINVENT);
    giant.mpeaceful = 0;
    giant.msleeping = 0;
    giant.m_lev = 30;
    giant.movement = 12;
    game.level = source;
    addTrap(source, LEVEL_TELEP, 11, 10);
    const input = resetInputState();
    input.feed('l');
    const turn = game.moves;

    await answerPrompts(moveloop_core(), input, [
        { prompt: /You step onto a level teleport trap!--More--/, keys: ' ' },
        { prompt: /To what level do you want to teleport\?/, keys: '2\r' },
        { prompt: /You feel disoriented\.--More--/, keys: ' ' },
    ]);
    installPagerInput(input, { expected: /materialize|hill giant/, limit: 8 });
    await finishAtCommandInput(input, moveloop_core, /materialize|hill giant/);

    assert.equal(game.level, destination);
    assert.ok(game.u.uhp < 100, 'the giant attacks after the timed step');
    assert.equal(game.moves, turn + 1, 'the step consumes one world turn');
});

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

void test('discovering a level teleport trap displays it beneath an invisible hero before acknowledgment', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    grantIntrinsicProperty('invisible', 'outside');
    const trap = addTrap(level, LEVEL_TELEP, 10, 10);
    newsym(10, 10);
    await plineWithContinuation('You hear footsteps approaching along the corridor.');
    const input = resetInputState();

    const operation = triggerHeroTrap(trap);
    await input.waitUntilBlocked();
    const displayedSquare = requireScreenCell(9, 11).ch;
    await answerPrompts(operation, input, [
        { prompt: /You hear footsteps approaching along the corridor\.--More--/, keys: ' ' },
        { prompt: /You step onto a level teleport trap!--More--/, keys: ' ' },
        { prompt: /To what level do you want to teleport\?/, keys: '\x1b' },
    ]);

    assert.equal(displayedSquare, '^',
        'discovering the trap replaces the floor while the unread message waits');
});

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
