import { isRoom } from '../js/map_types.js';
import type { Position } from '../js/map_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ALTAR, AM_SHRINE, Align2amask, MM_ANGRY, NO_MINVENT, NO_ROOM, ROOM, TEMPLE } from '../js/const.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mklev } from '../js/mklev.js';
import { mfndpos, takeMonsterTurn } from '../js/monmove.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { initRng } from '../js/rng.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshSpecialLevel } from './support/special-level.js';

async function shrineEncounter(species = 'goblin') {
    freshSpecialLevel({ prototype: 'Kni-loca', seed: 2501, depth: 11 });
    requirePlayingGame(game);
    game._specialLevelPrototype = 'Kni-loca';
    game._activeSpecialLevel = null;
    await mklev();
    const level = game.level;
    const priest = [...level.monsters].reverse().find(monster => monster.ispriest && monster.epri
        && level.requireAt(monster.epri.shrpos.x, monster.epri.shrpos.y).typ === ALTAR);
    assert.ok(priest, 'the Lua shrine creates its own resident');
    assert.ok(priest.epri);
    const shrine = priest.epri;
    const room = game.level.rooms.filter(isRoom).find(candidate => candidate.rtype === TEMPLE);
    assert.ok(room);
    const occupied = (x: number, y: number) => level.monsters.some(monster =>
        monster.mx === x && monster.my === y);
    let spot: Position | undefined;
    for (let x = room.lx; x < room.hx && !spot; x++) {
        for (let y = room.ly; y <= room.hy && !spot; y++) {
            if (game.level.requireAt(x, y).typ === ROOM
                && game.level.requireAt(x + 1, y).typ === ROOM
                && !occupied(x, y) && !occupied(x + 1, y)) spot = { x, y };
        }
    }
    assert.ok(spot, 'the temple has two free neighboring floor squares');
    game.u.ux = spot.x;
    game.u.uy = spot.y;
    game.u.uhp = 2000;
    game.u.uhpmax = 2000;
    const alignment = shrine.shralign;
    assert.ok(alignment === -1 || alignment === 0 || alignment === 1);
    game.u.ualign = { type: alignment, record: 10 };
    updateHeroRoomMembership(game);
    vision_reset();
    vision_recalc(0);
    game.nhDisplay = new GameDisplay(null);
    const monster = await createMonsterAt(species, spot.x + 1, spot.y,
        MM_ANGRY | NO_MINVENT);
    monster.msleeping = 0;
    pushKeys(' '.repeat(100));
    initRng(1n);
    return { monster, priest, shrine,
        altar: level.requireAt(shrine.shrpos.x, shrine.shrpos.y) };
}

void test('a peaceful resident frightens an adjacent intruder away from a faithful hero', async () => {
    const { monster } = await shrineEncounter();
    requirePlayingGame(game);

    await takeMonsterTurn(monster, game);

    assert.equal(monster.mflee, 1);
    assert.equal(game.u.uhp, 2000);
});

void test('a blind sleeping resident still protects the intact shrine', async () => {
    const { monster, priest } = await shrineEncounter();
    requirePlayingGame(game);
    priest.mcansee = 0;
    priest.msleeping = 1;

    await takeMonsterTurn(monster, game);

    assert.equal(monster.mflee, 1);
});

for (const condition of ['sinned', 'different alignment', 'angry resident', 'no shrine', 'converted altar']) {
    void test(`the temple provides no sanctuary with ${condition}`, async () => {
        const { monster, priest, shrine, altar } = await shrineEncounter();
        requirePlayingGame(game);
        if (condition === 'sinned') game.u.ualign.record = -4;
        if (condition === 'different alignment')
            game.u.ualign.type = shrine.shralign === 1 ? -1 : 1;
        if (condition === 'angry resident') priest.mpeaceful = 0;
        if (condition === 'no shrine') altar.flags &= ~AM_SHRINE;
        if (condition === 'converted altar')
            altar.flags = AM_SHRINE | Align2amask(shrine.shralign === 1 ? -1 : 1);

        await takeMonsterTurn(monster, game);

        assert.equal(Boolean(monster.mflee), false);
    });
}

for (const species of ['Angel', 'Famine']) {
    void test(`${species} ignores sanctuary protection`, async () => {
        const { monster } = await shrineEncounter(species);
        requirePlayingGame(game);

        await takeMonsterTurn(monster, game);

        assert.equal(Boolean(monster.mflee), false);
    });
}


void test('sanctuary blocks entry from outside but does not block a melee destination', async () => {
    const { monster } = await shrineEncounter();
    requirePlayingGame(game);
    const room = game.level.rooms.filter(isRoom).find(candidate => candidate.rtype === TEMPLE);
    assert.ok(room);
    const x = room.lx;
    let y: number | undefined;
    for (let row = room.ly; row <= room.hy; row++) {
        const occupied = game.level.monsters.some(other => other !== monster
            && (other.mx === x || other.mx === x - 1) && other.my === row);
        if (!occupied && game.level.requireAt(x, row).typ === ROOM
            && !(game.u.ux === x && game.u.uy === row)) {
            y = row;
            break;
        }
    }
    assert.ok(y !== undefined, 'the shrine has a free boundary floor square');
    const location = game.level.requireAt(x - 1, y);
    location.typ = ROOM;
    location.roomno = NO_ROOM;
    placeMonsterAt(monster, x - 1, y);
    const canEnter = () => {
        requirePlayingGame(game);
        return mfndpos(monster, game).some(square => square.x === x && square.y === y);
    };

    assert.equal(canEnter(), false);
    game.u.ualign.record = -4;
    assert.equal(canEnter(), true);

    game.u.ualign.record = 10;
    game.u.ux = x;
    game.u.uy = y;
    updateHeroRoomMembership(game);
    assert.equal(canEnter(), true, 'an adjacent hero can be attacked across the boundary');
});
