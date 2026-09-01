import test from 'node:test';
import assert from 'node:assert/strict';

import { runClaimedCorpseRevivalTimer } from '../js/corpse_revival.js';
import { ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import {
    mkcorpstat, mksobj, place_object, set_corpsenm,
} from '../js/mklev.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { CORPSE, SACK } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
    scheduleObjectTimer, stopAllObjectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';

const PM_TROLL = 220;
const PM_HUMAN = 260;
const PM_HUMAN_ZOMBIE = 244;
const PM_LEOCROTTA = 83;
const PM_GIANT = 169;
const PM_GIANT_ZOMBIE = 247;

function freshState() {
    resetGame();
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 8 },
        ulevel: 8,
        uhp: 40, uhpmax: 40,
        ualign: { type: 0, record: 0 },
        uconduct: {}, uhave: {},
        blindTurns: 0,
    };
    game.moves = 40;
    game.mvitals = [];
    game.inventory = [];
    game.flags = {};
    game.context = {};
    game.level = new GameMap();
    game.level.monsters = [];
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) {
            const location = game.level.at(x, y);
            location.typ = ROOM;
            location.lit = true;
        }
    }
    game.in_mklev = false;
    vision_reset_new_level();
    vision_recalc(0);
    initRng(900n);
    init_objects();
}

function trollCorpse() {
    const corpse = mksobj(CORPSE, true, false);
    set_corpsenm(corpse, PM_TROLL);
    stopAllObjectTimers(corpse);
    corpse.age = game.moves;
    return corpse;
}

async function reviveNow(corpse, seed = 12) {
    scheduleObjectTimer(
        corpse, OBJECT_TIMER_KIND.REVIVE_MON, game.moves, game,
    );
    const claimed = claimNextDueObjectTimer(game, game.moves);
    initRng(BigInt(seed));
    return runClaimedCorpseRevivalTimer(claimed, game, game.moves);
}

test('a new troll corpse can receive the missing revival timer', () => {
    freshState();
    const corpse = mkcorpstat(CORPSE, null, PM_TROLL, 12, 10, 8);

    const [timer] = objectTimers(corpse);

    assert.equal(timer.kind, OBJECT_TIMER_KIND.REVIVE_MON);
    assert.ok(timer.deadline >= game.moves + 2);
    assert.ok(timer.deadline <= game.moves + 50);
});

test('a troll corpse on the floor rises as a live troll', async () => {
    freshState();
    const corpse = place_object(trollCorpse(), 12, 10);

    const event = await reviveNow(corpse);

    assert.equal(event.kind, 'revived');
    assert.equal(event.monster.mnum, PM_TROLL);
    assert.equal(event.monster.mrevived, 1);
    assert.equal(event.messages.at(-1), 'The troll rises from the dead!');
    assert.equal(corpse.where, 'gone');
});

test('a corpse made from a named monster restores that monster', async () => {
    freshState();
    const deadTroll = {
        m_id: 91,
        mnum: PM_TROLL,
        mx: 12, my: 10,
        m_lev: 9,
        mhp: 0, mhpmax: 47,
        female: true,
        mpeaceful: 0,
        mtame: 0,
        name: 'Grond',
        minvent: [], inventory: [],
    };
    const corpse = mkcorpstat(
        CORPSE, deadTroll, PM_TROLL, 12, 10, 8,
    );
    stopAllObjectTimers(corpse);

    const event = await reviveNow(corpse);

    assert.equal(event.monster.m_id, deadTroll.m_id);
    assert.equal(event.monster.name, deadTroll.name);
    assert.equal(event.monster.mhpmax, deadTroll.mhpmax);
    assert.equal(event.monster.mhp, deadTroll.mhpmax);
});

test('a pet killed by the hero does not revive tame', async () => {
    freshState();
    const deadPet = {
        m_id: 92,
        mnum: PM_TROLL,
        mx: 12, my: 10,
        m_lev: 9,
        mhp: 0, mhpmax: 20,
        mpeaceful: 1,
        mtame: 10,
        pet: true,
        meating: 4,
        minvent: [], inventory: [],
        edog: {
            abuse: 0,
            killed_by_u: 1,
            mhpmax_penalty: 5,
            revivals: 0,
            ogoal: { x: 8, y: 8 },
        },
    };
    const corpse = mkcorpstat(
        CORPSE, deadPet, PM_TROLL, 12, 10, 8,
    );
    stopAllObjectTimers(corpse);

    const event = await reviveNow(corpse);

    assert.equal(event.monster.mtame, 0);
    assert.equal(event.monster.pet, false);
    assert.equal(event.monster.mpeaceful, 1);
    assert.equal(event.monster.meating, 0);
    assert.equal(event.monster.mhpmax, 25);
    assert.equal(event.monster.edog.mhpmax_penalty, 0);
});

test('a troll corpse in the pack revives beside the hero', async () => {
    freshState();
    const corpse = trollCorpse();
    corpse.where = 'inventory';
    game.inventory.push(corpse);

    const event = await reviveNow(corpse);

    assert.equal(event.kind, 'revived');
    assert.equal(event.messages.at(-1), 'You feel squirming in your backpack!');
    assert.equal(game.inventory.includes(corpse), false);
    assert.equal(Math.max(
        Math.abs(event.monster.mx - game.u.ux),
        Math.abs(event.monster.my - game.u.uy),
    ), 1);
});

test('a troll corpse revives from a sack in the hero pack', async () => {
    freshState();
    const sack = mksobj(SACK, false, false);
    sack.where = 'inventory';
    sack.contents = [];
    game.inventory.push(sack);
    const corpse = trollCorpse();
    corpse.where = 'contained';
    corpse.container = sack;
    sack.contents.push(corpse);

    const event = await reviveNow(corpse);

    assert.equal(event.kind, 'revived');
    assert.equal(
        event.messages.at(-1),
        'A troll writhes out of a sack in your pack!',
    );
    assert.equal(sack.contents.length, 0);
});

test('a monster drops a corpse when it revives from its pack', async () => {
    freshState();
    const carrier = {
        m_id: 700,
        mnum: PM_LEOCROTTA,
        mx: 12, my: 10,
        mhp: 30, mhpmax: 30,
        female: false,
        minvis: 0, mundetected: 0,
        minvent: [], inventory: [],
    };
    game.level.monsters.push(carrier);
    const corpse = trollCorpse();
    addObjectToMonsterInventory(carrier, corpse, game);

    const event = await reviveNow(corpse);

    assert.equal(event.kind, 'revived');
    assert.equal(
        event.messages.at(-1),
        'Startled, the leocrotta drops a troll corpse as it revives!',
    );
    assert.equal(carrier.minvent.includes(corpse), false);
});

test('a buried troll corpse claws out through a new pit', async () => {
    freshState();
    const corpse = trollCorpse();
    corpse.where = 'buried';
    corpse.buried = true;
    corpse.ox = 12;
    corpse.oy = 10;
    game.level.buriedObjects = [corpse];

    const event = await reviveNow(corpse);

    assert.equal(event.kind, 'revived');
    assert.equal(event.buried, true);
    assert.equal(event.trap.tx, event.monster.mx);
    assert.equal(event.trap.ty, event.monster.my);
    assert.equal(game.level.buriedObjects.includes(corpse), false);
});

test('a buried human corpse on a zombify timer rises as a zombie', async () => {
    freshState();
    const corpse = mksobj(CORPSE, true, false);
    set_corpsenm(corpse, PM_HUMAN);
    stopAllObjectTimers(corpse);
    corpse.where = 'buried';
    corpse.buried = true;
    corpse.ox = 12;
    corpse.oy = 10;
    game.level.buriedObjects = [corpse];
    scheduleObjectTimer(
        corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, game.moves, game,
    );

    const event = await runClaimedCorpseRevivalTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );

    assert.equal(event.kind, 'revived');
    assert.equal(event.monster.mnum, PM_HUMAN_ZOMBIE);
    assert.equal(event.buried, true);
    assert.equal(corpse.where, 'gone');
});

test('a zombifying kill leaves a corpse which will rise', async () => {
    freshState();
    const victim = {
        m_id: 801,
        mnum: PM_GIANT,
        mx: 12, my: 10,
        m_lev: 6,
        mhp: 0, mhpmax: 36,
        mpeaceful: 0,
        mtame: 0,
        name: 'Gorm',
        minvent: [], inventory: [],
    };
    game.level.monsters.push(victim);
    initRng(6n);

    await finishHeroMonsterKill(victim, victim.mx, victim.my, {
        showKillMessage: false,
        recordConduct: false,
        zombifyCorpse: true,
    });

    const corpse = game.level.objects[12][10].find(
        object => object.otyp === CORPSE,
    );
    const [timer] = objectTimers(corpse);
    assert.equal(timer.kind, OBJECT_TIMER_KIND.ZOMBIFY_MON);
    assert.ok(timer.deadline >= game.moves + 5);
    assert.ok(timer.deadline <= game.moves + 19);
    assert.equal(corpse.oextra?.omonst, undefined);

    game.moves = timer.deadline;
    const event = await runClaimedCorpseRevivalTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.equal(event.monster.mnum, PM_GIANT_ZOMBIE);
    assert.equal(event.monster.name, victim.name);
});
