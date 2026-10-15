import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_CHAOTIC, A_LAWFUL, COURT, FILL_NORMAL, MM_ANGRY, MM_NOMSG,
    NO_MINVENT, ROOMOFFSET,
} from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { fillSpecialRoom, makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import type { AlignmentValue } from '../js/roles.js';
import type { Room } from '../js/map_types.js';
import { makedog } from '../js/u_init.js';
import { createMonsterAt } from './support/monsters.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';
import { freshObjectRoom } from './support/object-room.js';

for (const peaceful of [true, false]) {
    for (const changesAlignment of [false, true]) {
        void test(`killing a pony born ${peaceful ? 'peaceful' : 'hostile'} and co-aligned ${changesAlignment ? 'retains its birth alignment value after the hero changes alignment' : 'adjusts the hero alignment record'}`, async () => {
            freshObjectRoom({ gameplaySeed: 3n });
            requirePlayingGame(game);
            const pony = await createMonsterAt('pony', 11, 10,
                NO_MINVENT | (peaceful ? 0 : MM_ANGRY));
            assert.equal(!!pony.mpeaceful, peaceful);
            if (changesAlignment) game.u.ualign.type = A_LAWFUL;

            await finishHeroMonsterKill(pony, pony.mx, pony.my, {
                showKillMessage: false, noCorpse: true,
            });

            assert.equal(game.u.ualign.record, peaceful ? -14 : 3);
        });
    }
}

void test('killing a chameleon born in coyote form gives the lawful hero credit for that form', async () => {
    freshObjectRoom({
        gameplaySeed: 1n,
        hero: { ualign: { type: A_LAWFUL, record: 0 } },
    });
    requirePlayingGame(game);
    const chameleon = await createMonsterAt('chameleon', 11, 10, NO_MINVENT);
    assert.equal(chameleon.mnum, MONSTER_NAME.indexOf('coyote'));
    assert.equal(chameleon.mpeaceful, 0);

    await finishHeroMonsterKill(chameleon, chameleon.mx, chameleon.my, {
        showKillMessage: false, noCorpse: true,
    });

    assert.equal(game.u.ualign.record, 5);
});

void test('killing a co-aligned ape forced hostile by group creation rewards the hero', async () => {
    const level = freshObjectRoom({ gameplaySeed: 470n });
    requirePlayingGame(game);
    game.in_mklev = true;
    const leader = await makemonAt(null, 12, 10, NO_MINVENT | MM_NOMSG);
    assert.ok(leader, 'random generation should create the group leader');
    const ape = level.monsters.find(monster => monster !== leader);
    assert.ok(ape, 'the birth should create a group member');
    assert.equal(MONSTER_NAME[ape.mnum], 'ape');
    assert.equal(ape.mpeaceful, 0);
    game.in_mklev = false;

    await finishHeroMonsterKill(ape, ape.mx, ape.my, {
        showKillMessage: false, noCorpse: true,
    });

    assert.equal(game.u.ualign.record, 3);
});

async function stockCourt(alignment: AlignmentValue, seed: bigint) {
    const level = freshObjectRoom({
        left: 10, right: 12, top: 10, bottom: 11, gameplaySeed: seed,
        hero: { ualign: { type: alignment, record: 0 } },
    });
    requirePlayingGame(game);
    game.in_mklev = true;
    const room: Room = {
        lx: 10, hx: 12, ly: 10, hy: 11, rtype: COURT, rlit: 1,
        needfill: FILL_NORMAL, doorct: 0, fdoor: 0,
        nsubrooms: 0, sbrooms: [], roomnoidx: 0, irregular: false, needjoining: false,
    };
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    }
    await fillSpecialRoom(room);
    game.in_mklev = false;
    return level;
}

void test('killing a co-aligned elven monarch forced hostile by court creation rewards the hero', async () => {
    const level = await stockCourt(A_CHAOTIC, 7n);
    requirePlayingGame(game);
    const monarch = level.monsters.find(monster =>
        MONSTER_NAME[monster.mnum] === 'elven monarch');
    assert.ok(monarch, 'the court should create its elven ruler');
    assert.equal(monarch.mpeaceful, 0);

    await finishHeroMonsterKill(monarch, monarch.mx, monarch.my, {
        showKillMessage: false, noCorpse: true,
    });

    assert.equal(game.u.ualign.record, 10);
});

void test('killing a co-aligned centaur forced hostile by court stocking rewards the hero', async () => {
    const level = await stockCourt(0, 5n);
    requirePlayingGame(game);
    const centaur = level.monsters.find(monster =>
        MONSTER_NAME[monster.mnum] === 'plains centaur');
    assert.ok(centaur, 'the court should create a plains centaur');
    assert.equal(centaur.mpeaceful, 0);

    await finishHeroMonsterKill(centaur, centaur.mx, centaur.my, {
        showKillMessage: false, noCorpse: true,
    });

    assert.equal(game.u.ualign.record, 3);
});

void test('killing a co-aligned elemental forced hostile by nasty summoning rewards the hero', async () => {
    let killedElemental = false;
    // Both the spell and species are random; the alignment rule must not
    // depend on one fixed draw producing an elemental during level creation.
    for (let seed = 1; seed <= 1024 && !killedElemental; seed++) {
        await prepareSpellCaster('arch-lich', 17);
        requirePlayingGame(game);
        await finishSpellTurn(seed);
        const elemental = game.level.monsters.find(monster =>
            !monster.dead && MONSTER_NAME[monster.mnum] === 'fire elemental');
        if (!elemental) continue;
        assert.equal(elemental.mpeaceful, 0);

        await finishHeroMonsterKill(elemental, elemental.mx, elemental.my, {
            showKillMessage: false, noCorpse: true,
        });

        assert.equal(game.u.ualign.record, 3);
        killedElemental = true;
    }
    assert.ok(killedElemental, 'The hero should encounter a summoned fire elemental');
});

for (const species of ['little dog', 'kitten', 'pony']) {
    void test(`killing a co-aligned starting ${species} applies both tame and peaceful alignment penalties`, async () => {
        freshObjectRoom({ role: species === 'pony' ? 'knight'
            : species === 'little dog' ? 'caveman' : 'wizard' });
        requirePlayingGame(game);
        game.preferred_pet = species === 'kitten' ? 'c' : 'd';
        const pet = await makedog();
        assert.ok(pet, 'the hero should start with a pet');
        assert.equal(MONSTER_NAME[pet.mnum], species);
        assert.equal(pet.mtame, 10);
        assert.equal(pet.mpeaceful, 1);

        await finishHeroMonsterKill(pet, pet.mx, pet.my, {
            showKillMessage: false, noCorpse: true,
        });

        assert.equal(game.u.ualign.record, -24);
    });
}
