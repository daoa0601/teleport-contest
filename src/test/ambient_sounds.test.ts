import test from 'node:test';
import assert from 'node:assert/strict';
import { dosounds } from '../js/ambient_sounds.js';
import { BARRACKS, BEEHIVE, COURT, MORGUE, ROOMOFFSET, SWAMP, TEMPLE, ZOO } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import type { Room } from '../js/map_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function soundRoom(type: number) {
    const level = freshObjectRoom();
    const room: Room = {
        lx: 7, hx: 9, ly: 8, hy: 12, rtype: type, rlit: 1,
        needfill: 0, doorct: 0, fdoor: 0, nsubrooms: 0, sbrooms: [],
        roomnoidx: 0, irregular: false, needjoining: false,
    };
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return level;
}

async function topline() {
    await flush_screen();
    return game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

void test('a staffed temple outside the hero room produces a prayer to its deity', async () => {
    const level = soundRoom(TEMPLE);
    requirePlayingGame(game);
    const priest = await createMonsterAt('aligned cleric', 8, 10);
    priest.ispriest = 1;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 8, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    priest.msleeping = 0;
    priest.mcanmove = 1;
    level.flags.has_temple = true;
    initRng(167);

    await dosounds();

    assert.match(await topline(), /You hear someone beseeching .+\./);
});

void test('a flying bee in a beehive produces its ambient buzzing', async () => {
    const level = soundRoom(BEEHIVE);
    await createMonsterAt('killer bee', 8, 10);
    level.flags.has_beehive = true;
    initRng(167);

    await dosounds();

    assert.match(await topline(), /You hear (a low buzzing|an angry drone)\./);
});

void test('hallucination shifts the fountain sound choices', async () => {
    const level = soundRoom(0);
    level.flags.nfountains = 1;
    game.u.hallucinationTurns = 20;
    initRng(262);

    await dosounds();

    assert.equal(await topline(), 'You hear water falling on coins.');
});

void test('deafness suppresses level ambient sounds', async () => {
    const level = soundRoom(0);
    level.flags.nfountains = 1;
    game.deaf = true;
    game.u.deafTurns = 5;
    initRng(262);

    await dosounds();

    assert.equal(await topline(), '');
});

for (const [type, species, flag, message] of [
    [COURT, 'goblin', 'has_court', /You hear a sceptre pounded in judgment\./],
    [MORGUE, 'human zombie', 'has_morgue', /(You suddenly realize it is unnaturally quiet|The hair on the back of your neck stands up)\./],
    [BARRACKS, 'soldier', 'has_barracks', /You hear loud snoring\./],
    [ZOO, 'jackal', 'has_zoo', /You hear a sound reminiscent of (a seal barking|an elephant stepping on a peanut)\./],
] as const) {
    void test(`a sleeping ${species} supplies its special room's ambient sound`, async () => {
        const level = soundRoom(type);
        const resident = await createMonsterAt(species, 8, 10);
        resident.msleeping = 1;
        level.flags[flag] = true;
        initRng(167);

        await dosounds();

        assert.match(await topline(), message);
    });
}

void test('a swamp event ends the ambient pass before a later shop flag is cleared', async () => {
    const level = soundRoom(SWAMP);
    level.flags.has_swamp = true;
    level.flags.has_shop = true;
    initRng(167);

    await dosounds();

    assert.match(await topline(), /You (hear mosquitoes|smell marsh gas)!/);
    assert.equal(level.flags.has_shop, true);
});
