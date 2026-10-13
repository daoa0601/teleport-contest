import assert from 'node:assert/strict';
import test from 'node:test';

import { farlookLocationDescription, askTeleportDestination } from '../js/cmd.js';
import { feel_location, glyphAt, newsym } from '../js/display.js';
import { NO_MINVENT, POOL, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { KELP_FROND, STATUE } from '../js/object_data.js';
import { races } from '../js/roles.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('farlook describes the saddle on a tame pony', async () => {
    freshObjectRoom();
    await createSaddledSteed('pony', { x: 11, y: 10 });
    newsym(11, 10);

    assert.equal(await farlookLocationDescription(11, 10), 'tame saddled pony');
});

void test('automatic farlook describes a hallucinated statue as a creature', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false },
        hero: { hallucination: true, hallucinationTurns: 10 } });
    await floorObject(STATUE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('vampire bat') });
    newsym(11, 10);
    assert.equal(glyphAt(11, 10)?.kind, 'monster');
    const input = resetInputState();
    const choosing = askTeleportDestination();
    await input.waitUntilBlocked();
    input.feed('l');
    await input.waitUntilBlocked();
    const description = game._pending_message;
    input.feed('\x1b');
    await choosing;

    assert.ok(description.length > 0);
    assert.doesNotMatch(description, /statue/);
});

void test('automatic farlook describes water covering objects on the bottom', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false } });
    level.requireAt(11, 10).typ = POOL;
    await floorObject(KELP_FROND, 11, 10, { quan: 2 });
    newsym(11, 10);
    const input = resetInputState();
    const choosing = askTeleportDestination();
    await input.waitUntilBlocked();
    input.feed('l');
    await input.waitUntilBlocked();
    const description = game._pending_message;
    input.feed('\x1b');
    await choosing;

    assert.equal(description, 'pool of water');
});

void test('automatic position descriptions identify a warning glyph', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false }, hero: { warning: true } });
    const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    orc.minvis = true;
    orc.mpeaceful = false;
    orc.m_lev = 4;
    newsym(11, 10);
    assert.equal(glyphAt(11, 10)?.kind, 'warning');
    const input = resetInputState();
    const choosing = askTeleportDestination();
    await input.waitUntilBlocked();
    input.feed('l');
    await input.waitUntilBlocked();
    const description = game._pending_message;
    input.feed('\x1b');
    await choosing;

    assert.equal(description, 'unknown creature causing you concern');
});

for (const [female, name] of [[true, 'elf-lady'], [false, 'elf-lord']] as const) {
    void test(`automatic self descriptions use the polymorphed gender for ${name}`, async () => {
        freshObjectRoom({
            flags: { tips: false, verbose: false, female: !female },
            hero: { mfemale: female },
        });
        setHeroSpecies(MONSTER_NAME.indexOf('elf-noble'));
        game.plname = 'Aster';
        const input = resetInputState();
        const choosing = askTeleportDestination();
        await input.waitUntilBlocked();
        input.feed('l');
        await input.waitUntilBlocked();
        input.feed('h');
        await input.waitUntilBlocked();
        const description = game._pending_message;
        input.feed('\x1b');
        await choosing;

        assert.equal(description, `${name} called Aster`);
    });
}

void test('farlook describes a blind-touch darkroom glyph even when the room was lit', async () => {
    const level = freshObjectRoom();
    const floor = level.requireAt(11, 10);
    floor.typ = ROOM;
    floor.waslit = true;
    game.flags.dark_room = true;
    setHeroBlindnessTurns(10);
    feel_location(11, 10);

    assert.equal(await farlookLocationDescription(11, 10), 'dark part of a room');
});

void test('farlook describes a remembered lit room outside sight as dark with dark_room enabled', async () => {
    const level = freshObjectRoom({ flags: { dark_room: true, color: true } });
    newsym(11, 10);
    level.requireAt(30, 10).typ = ROOM;
    game.u.ux = 30;
    vision_recalc(0);
    newsym(11, 10);
    assert.equal(cansee(11, 10), false);

    assert.equal(await farlookLocationDescription(11, 10), 'dark part of a room');
});

void test('automatic self descriptions use the racial adjective', async () => {
    const elf = races.find(race => race.name === 'elf');
    assert.ok(elf);
    freshObjectRoom({ role: 'priest', race: elf, flags: { tips: false, verbose: false, female: true } });
    game.plname = 'Aster';
    const input = resetInputState();
    const choosing = askTeleportDestination();
    await input.waitUntilBlocked();
    input.feed('l');
    await input.waitUntilBlocked();
    input.feed('h');
    await input.waitUntilBlocked();
    const description = game._pending_message;
    input.feed('\x1b');
    await choosing;

    assert.equal(description, 'elven priestess called Aster');
});
