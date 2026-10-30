import assert from 'node:assert/strict';
import test from 'node:test';

import { farlookLocationDescription, askTeleportDestination } from '../js/cmd.js';
import { feel_location, glyphAt, newsym } from '../js/display.js';
import { NO_MINVENT, POOL, ROOM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { distantMonsterName } from '../js/monster_name.js';
import { KELP_FROND, STATUE } from '../js/object_data.js';
import { races } from '../js/roles.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('farlook describes the saddle on a tame pony', async () => {
    await freshObjectRoom();
    await createSaddledSteed('pony', { x: 11, y: 10 });
    await newsym(11, 10);

    assert.equal(await farlookLocationDescription(11, 10), 'tame saddled pony');
});

void test('farlook includes the species and given name of a saddled pet', async () => {
    await freshObjectRoom();
    const pony = await createSaddledSteed('pony', { x: 11, y: 10 });
    setMonsterGivenName(pony, 'Fido');
    await newsym(11, 10);

    assert.equal(await farlookLocationDescription(11, 10), 'tame saddled pony called Fido');
});

for (const [species, givenName, description] of [
    ['little dog', 'Fido', 'the little dog called Fido'],
    ['Medusa', 'Aster', 'Medusa called Aster'],
    ['ghost', 'James', "James' ghost"],
    ['knight', 'Alex the Gallant', 'the knight called Alex the Gallant'],
] as const) {
    void test(`distant naming preserves the ${species}'s species and name rules`, async () => {
        await freshObjectRoom();
        const monster = await createMonsterAt(species, 11, 10, NO_MINVENT);
        setMonsterGivenName(monster, givenName);

        assert.equal(distantMonsterName(monster, { article: 'the' }), description);
    });
}

void test('distant naming refers to an unspotted monster as it', async () => {
    await freshObjectRoom();
    const monster = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    setMonsterGivenName(monster, 'Fido');
    monster.minvis = true;

    assert.equal(distantMonsterName(monster), 'it');
});

for (const [female, title] of [[false, 'high priest'], [true, 'high priestess']] as const) {
    void test(`farlook conceals an invisible Astral ${title}'s identity at a distance`, async () => {
        await freshObjectRoom({ hero: { detectMonsters: true } });
        requirePlayingGame(game);
        game.astral_level = { ...game.u.uz, dlevel: 1,
            flags: { town: false }, alignment: null };
        game.u.uz.dlevel = 1;
        const priest = await createMonsterAt('high cleric', 14, 10, NO_MINVENT);
        priest.female = female;
        priest.minvis = true;
        priest.mpeaceful = true;
        priest.ispriest = 1;
        priest.epri = {
            shroom: 0, shralign: 0, shrpos: { x: 15, y: 10 },
            shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
            intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
        };
        await newsym(14, 10);

        assert.equal(await farlookLocationDescription(14, 10), `peaceful ${title}`);

        game.u.ux = 13;
        await newsym(14, 10);

        assert.match(await farlookLocationDescription(14, 10),
            new RegExp(`^peaceful invisible ${title} of .+$`));

        game.u.ux = 10;
        delete game.astral_level;
        await newsym(14, 10);

        assert.match(await farlookLocationDescription(14, 10),
            new RegExp(`^peaceful invisible ${title} of .+$`));
    });
}

void test('automatic farlook describes a hallucinated statue as a creature', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false },
        hero: { hallucination: true, hallucinationTurns: 10 } });
    await floorObject(STATUE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('vampire bat') });
    await newsym(11, 10);
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
    const level = await freshObjectRoom({ flags: { tips: false, verbose: false } });
    level.requireAt(11, 10).typ = POOL;
    await floorObject(KELP_FROND, 11, 10, { quan: 2 });
    await newsym(11, 10);
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
    await freshObjectRoom({ flags: { tips: false, verbose: false }, hero: { warning: true } });
    const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    orc.minvis = true;
    orc.mpeaceful = false;
    orc.m_lev = 4;
    await newsym(11, 10);
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
        await freshObjectRoom({
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
    const level = await freshObjectRoom();
    const floor = level.requireAt(11, 10);
    floor.typ = ROOM;
    floor.waslit = true;
    game.flags.dark_room = true;
    setHeroBlindnessTurns(10);
    await feel_location(11, 10);

    assert.equal(await farlookLocationDescription(11, 10), 'dark part of a room');
});

void test('farlook describes a remembered lit room outside sight as dark with dark_room enabled', async () => {
    const level = await freshObjectRoom({ flags: { dark_room: true, color: true } });
    await newsym(11, 10);
    level.requireAt(30, 10).typ = ROOM;
    game.u.ux = 30;
    await vision_recalc(0);
    await newsym(11, 10);
    assert.equal(cansee(11, 10), false);

    assert.equal(await farlookLocationDescription(11, 10), 'dark part of a room');
});

void test('automatic self descriptions use the racial adjective', async () => {
    const elf = races.find(race => race.name === 'elf');
    assert.ok(elf);
    await freshObjectRoom({ role: 'priest', race: elf, flags: { tips: false, verbose: false, female: true } });
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
