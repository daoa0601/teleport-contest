import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_OBJECT, SDOOR, STRAT_WAITFORU } from '../js/const.js';
import { STATUE } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { game } from '../js/gstate.js';
import { glyphAt } from '../js/display.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a deaf hero gets the hearing refusal from an awake animal', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10);
    dog.msleeping = 0;
    dog.mstrategy = STRAT_WAITFORU;
    game.u.deafTurns = 20;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, 'Any response from the little dog falls on deaf ears.');
    assert.equal(game.context.move, 0);
    assert.equal(dog.mstrategy, 0);
});

for (const disguise of ['hidden', 'object'] as const) {
    void test(`chat does not rouse a ${disguise} monster`, async () => {
        freshObjectRoom();
        const mimic = await createMonsterAt('small mimic', 11, 10);
        mimic.msleeping = 0;
        mimic.mstrategy = STRAT_WAITFORU;
        if (disguise === 'hidden') mimic.mundetected = 1;
        else mimic.m_ap_type = M_AP_OBJECT;

        await runExtendedCommand('chat', 'l');

        assert.equal(mimic.mstrategy, STRAT_WAITFORU);
        assert.equal(game.context.move, 0);
    });
}

void test('chatting down to an awake mounted horse gets its answer and spends a turn', async () => {
    freshObjectRoom();
    const horse = await createSaddledSteed('horse', { x: 10, y: 10 });
    game.u.usteed = horse;
    horse.msleeping = 0;

    await runExtendedCommand('chat', '>');

    assert.equal(game._pending_message, 'The saddled horse whickers.');
    assert.equal(game.context.move, 1);
});

void test('chatting upward gives the native refusal without spending a turn', async () => {
    freshObjectRoom();

    await runExtendedCommand('chat', '<');

    assert.equal(game._pending_message, "They won't hear you up there.");
    assert.equal(game.context.move, 0);
});

void test('chatting at a long worm tail rouses its waiting head without a reply', async () => {
    freshObjectRoom();
    const worm = await createMonsterAt('long worm', 13, 10);
    worm.wormSegments = [{ x: 12, y: 10 }, { x: 11, y: 10 }];
    worm.mstrategy = STRAT_WAITFORU;
    worm.msleeping = 0;

    await runExtendedCommand('chat', 'l');

    assert.equal(worm.mstrategy, 0);
    assert.equal(game.context.move, 0);
});

void test('an unseen eating worm reveals its head when addressed through its tail', async () => {
    freshObjectRoom();
    const worm = await createMonsterAt('long worm', 13, 10);
    worm.wormSegments = [{ x: 12, y: 10 }, { x: 11, y: 10 }];
    worm.msleeping = 0;
    worm.mtame = 10;
    worm.minvis = true;
    worm.meating = 3;

    await runExtendedCommand('chat', 'l');

    assert.equal(glyphAt(13, 10)?.kind, 'invisible');
    assert.equal(game.context.move, 0);
});



void test('chatting at a statue gets no reaction', async () => {
    const level = freshObjectRoom();
    const statue = await knownObject(STATUE, {});
    statue.ox = 11;
    statue.oy = 10;
    (level.objects[11] ??= [])[10] = [statue];

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, 'The statue seems not to notice you.');
    assert.equal(game.context.move, 0);
});

void test('a blind hero gets no answer from a statue', async () => {
    const level = freshObjectRoom();
    const statue = await knownObject(STATUE, {});
    statue.ox = 11;
    statue.oy = 10;
    (level.objects[11] ??= [])[10] = [statue];
    game.u.blindTurns = 5;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '');
    assert.equal(game.context.move, 0);
});

void test('a hallucinating hero mistakes the statue for a monster', async () => {
    const level = freshObjectRoom();
    const statue = await knownObject(STATUE, {});
    statue.ox = 11;
    statue.oy = 10;
    (level.objects[11] ??= [])[10] = [statue];
    game.u.hallucinationTurns = 20;

    await runExtendedCommand('chat', 'l');

    assert.match(game._pending_message ?? '', /^The .+ seems not to notice you\.$/);
    assert.notEqual(game._pending_message, 'The statue seems not to notice you.');
});

void test('chatting at a wall is like talking to a wall', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = 5;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, "It's like talking to a wall.");
    assert.equal(game.context.move, 0);
});

void test('a secret door hides behind the wall chat answer', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = SDOOR;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, "It's like talking to a wall.");
});

void test('a blind hero only talks to a wall it has mapped', async () => {
    const level = freshObjectRoom();
    const wall = level.requireAt(11, 10);
    wall.typ = 5;
    wall.lastseentyp = 5;
    game.u.blindTurns = 5;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, "It's like talking to a wall.");
});

void test('a blind hero cannot talk to an unmapped wall', async () => {
    const level = freshObjectRoom();
    const wall = level.requireAt(11, 10);
    wall.typ = 5;
    wall.lastseentyp = 0;
    game.u.blindTurns = 5;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '');
    assert.equal(game.context.move, 0);
});

void test('a deaf hero keeps the wall chat to itself', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = 5;
    game.u.deafTurns = 5;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '');
});

void test('a hallucinating hero gets a wall with personality', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = 5;
    game.u.hallucinationTurns = 20;

    await runExtendedCommand('chat', 'l');

    assert.match(game._pending_message ?? '', /^The wall (gripes about its job|tells you a funny joke!|insults your heritage!|chuckles\.|guffaws merrily!|deprecates your exploration efforts\.|suggests a stint of rehab\.\.\.|doesn't seem to be interested\.)$/);
    game.u.hallucinationTurns = 0;
});

void test('chatting to yourself is a bad habit', async () => {
    const level = freshObjectRoom();

    await runExtendedCommand('chat', '.');

    assert.equal(game._pending_message, 'Talking to yourself is a bad habit for a dungeoneer.');
    assert.equal(game.context.move, 0);
});

void test('chatting while swallowed reaches no one outside', async () => {
    const level = freshObjectRoom();
    game.u.uswallow = 1;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, "They won't hear you out there.");
    assert.equal(game.context.move, 0);
});

void test('a silent hero cannot speak', async () => {
    const level = freshObjectRoom();
    game.u.umonnum = 0; // giant ant: MS_SILENT

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, 'As a giant ant, you cannot speak.');
    assert.equal(game.context.move, 0);
});
