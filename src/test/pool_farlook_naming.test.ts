import assert from 'node:assert/strict';
import test from 'node:test';

import { farlookLocationDescription, askTeleportDestination } from '../js/cmd.js';
import { feel_location, glyphAt, newsym } from '../js/display.js';
import { NO_MINVENT, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { races } from '../js/roles.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

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

void test('farlook describes a blind-touch darkroom glyph even when the room was lit', () => {
    const level = freshObjectRoom();
    const floor = level.requireAt(11, 10);
    floor.typ = ROOM;
    floor.waslit = true;
    game.flags.dark_room = true;
    setHeroBlindnessTurns(10);
    feel_location(11, 10);

    assert.equal(farlookLocationDescription(11, 10), 'dark part of a room');
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
