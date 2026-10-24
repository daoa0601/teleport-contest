import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { BEAR_TRAP } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initializePet } from '../js/dog.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [species, peaceful, message] of [
    ['leocrotta', false, 'The leocrotta imitates you.'],
    ['red naga hatchling', false, 'The red naga hatchling mumbles incomprehensibly.'],
    ['djinni', false, '"This will teach you not to disturb me!"'],
    ['prisoner', false, '"Get me out of here."'],
    ['water demon', true, 'The water demon gurgles.'],
    ['dwarf', true, 'The dwarf talks about mining.'],
    ['dwarf', false, 'The dwarf threatens you.'],
    ['nurse', true, '"Relax, this won\'t hurt a bit."'],
    ['nalfeshnee', false, 'The nalfeshnee seems to mutter a cantrip.'],
    ['Pestilence', false, '"Who do you think you are, War?"'],
] as const) {
    void test(`chat gets the native response from a ${peaceful ? 'peaceful' : 'hostile'} ${species}`, async () => {
        freshObjectRoom();
        const monster = await createMonsterAt(species, 11, 10);
        monster.mpeaceful = peaceful;
        monster.msleeping = 0;

        await runExtendedCommand('chat', 'l');

        assert.equal(game._pending_message, message);
        assert.equal(game.context.move, 1);
    });
}

void test('a trapped humanoid tells the hero where its trap is', async () => {
    const level = freshObjectRoom();
    const dwarf = await createMonsterAt('dwarf', 11, 10);
    dwarf.mpeaceful = 1;
    dwarf.mtrapped = 1;
    const trap = addTrap(level, BEAR_TRAP, 11, 10, { tseen: false });

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '"I\'m trapped!"');
    assert.equal(trap.tseen, true);
    assert.equal(game.context.move, 1);
});

void test('a hungry tame humanoid asks for food before discussing its interests', async () => {
    freshObjectRoom();
    const dwarf = await createMonsterAt('dwarf', 11, 10);
    initializePet(dwarf, { state: game });
    assert.ok(dwarf.edog);
    dwarf.edog.hungrytime = game.moves - 1;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '"I\'m hungry."');
});

void test('a shrieker wakes sleeping monsters elsewhere on the level', async () => {
    freshObjectRoom({ right: 28 });
    await createMonsterAt('shrieker', 11, 10);
    const sleeper = await createMonsterAt('goblin', 26, 10);
    sleeper.msleeping = 1;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, 'The shrieker shrieks.');
    assert.equal(sleeper.msleeping, 0);
    assert.equal(game.context.move, 1);
});

void test('a skeleton frightens the hero into two turns of immobility', async () => {
    freshObjectRoom();
    await createMonsterAt('skeleton', 11, 10);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    await runExtendedCommand('chat', 'l');
    await flush_screen();

    assert.equal(game._helplessTurns, 2);
    assert.equal(game._helplessReason, 'scared by rattling');
    assert.equal(game.context.move, 1);
});

void test('a zombie can stay quiet while chat still spends a turn', async () => {
    freshObjectRoom();
    await createMonsterAt('human zombie', 11, 10);
    initRng(2);

    await runExtendedCommand('chat', 'l');

    assert.equal(game.context.move, 1);
});

void test('a peaceful vampire responds with its potion claim', async () => {
    freshObjectRoom({ hero: { protectionFromShapeChangers: true } });
    const vampire = await createMonsterAt('vampire', 11, 10);
    vampire.mpeaceful = 1;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '"I only drink... potions."');
    assert.equal(game.context.move, 1);
});

void test('skeleton chat holds input while two world turns pass, then restores movement', async () => {
    const level = freshObjectRoom();
    level.flags.rndmongen = false;
    const skeleton = await createMonsterAt('skeleton', 11, 10);
    skeleton.mpeaceful = 1;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    input.feed('#chat\nl          .');
    const initialMoves = game.moves;

    await moveloop_core();
    assert.equal(game._helplessTurns, 2);
    await moveloop_core();
    assert.equal(game._helplessTurns, 1);
    await moveloop_core();

    assert.equal(game.moves, initialMoves + 2);
    assert.equal(game._helplessTurns, 0);
    assert.equal(game.multi, 0);
});

void test('chat with a cancelled incubus complains about a severe headache', async () => {
    freshObjectRoom({ flags: { female: true } });
    const incubus = await createMonsterAt('amorous demon', 11, 10);
    incubus.female = false;
    incubus.mcan = 1;
    incubus.msleeping = 0;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, 'The incubus acts as though he has got a severe headache.');
    assert.equal(game.context.move, 1);
});
