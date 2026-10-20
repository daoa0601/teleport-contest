import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, POOL } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a fountain announces overflowing water before creatures drown in the new pools', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const victims = [];
    for (const [x, y] of [[9, 9], [9, 11], [11, 9], [11, 11]] as const)
        victims.push(await createMonsterAt('goblin', x, y));
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed('y' + ' '.repeat(30));
    initRng(8n);

    await rhack('q'.charCodeAt(0));

    assert.ok(victims.some(monster => monster.mhp <= 0
        && level.requireAt(monster.mx, monster.my).typ === POOL));
    const text = [...messages, game._pending_message].join('\n');
    const overflow = text.indexOf('Water gushes forth');
    const drowning = text.indexOf('drown');
    assert.ok(overflow >= 0 && drowning > overflow,
        `Overflow must be announced before drowning: ${text}`);
});

void test('a pet drowned by a hero-made fountain overflow is the hero\'s kill', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = FOUNTAIN;
    const pets = [];
    for (const [x, y] of [[9, 9], [9, 11], [11, 9], [11, 11]] as const) {
        const pet = await createMonsterAt('little dog', x, y);
        initializePet(pet, { state: game });
        pets.push(pet);
    }
    const alignment = game.u.ualign.record;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed('y' + ' '.repeat(30));
    initRng(8n);

    await rhack('q'.charCodeAt(0));

    const drowned = pets.filter(monster => monster.mhp <= 0);
    assert.ok(drowned.length > 0);
    // minliquid_core() uses xkilled() when no monster is moving.
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /You hear the rumble of distant thunder/);
    assert.ok(game.u.ualign.record < alignment);
});
