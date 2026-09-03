import test from 'node:test';
import assert from 'node:assert/strict';

import {
    reviveCorpseByMagic, runClaimedCorpseRevivalTimer,
} from '../js/corpse_revival.js';
import { MFAST } from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { place_object } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import {
    mkcorpstat, mksobj, set_corpsenm,
} from '../js/mklev.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { CORPSE, SACK } from '../js/object_data.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
    scheduleObjectTimer, stopAllObjectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { untimedCorpse } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_TROLL = 220;
const PM_HUMAN = 260;
const PM_HUMAN_ZOMBIE = 244;
const PM_LEOCROTTA = 83;
const PM_GIANT = 169;
const PM_GIANT_ZOMBIE = 247;
const PM_CHAMELEON = 327;
const PM_GUARD = 272;
const PM_GHOST = 287;
const PM_DOPPELGANGER = 270;
const PM_WIZARD_OF_YENDOR = 285;

function freshState() {
    freshObjectRoom({ objectInitializationSeed: 900n });
}

function trollCorpse() {
    return untimedCorpse(PM_TROLL, { age: game.moves });
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

test('explicit revival magic overrides a corpse no-revive flag', async () => {
    freshState();
    const corpse = place_object(trollCorpse(), 12, 10);
    corpse.norevive = true;

    const event = await reviveCorpseByMagic(corpse, game);

    assert.equal(event.kind, 'revived');
    assert.equal(event.monster.mnum, PM_TROLL);
    assert.equal(corpse.where, 'gone');
});

test('a corpse made from a named monster restores that monster', async () => {
    freshState();
    const troll = await createMonsterAt(PM_TROLL, 12, 10);
    troll.name = 'Grond';
    initRng(4n);
    await finishHeroMonsterKill(troll, troll.mx, troll.my, {
        showKillMessage: false,
        recordConduct: false,
    });
    const corpse = game.level.objects[12][10].find(
        object => object.otyp === CORPSE,
    );
    stopAllObjectTimers(corpse);

    const event = await reviveNow(corpse);

    assert.equal(event.monster.m_id, troll.m_id);
    assert.equal(event.monster.name, troll.name);
    assert.equal(event.monster.mhpmax, troll.mhpmax);
    assert.equal(event.monster.mhp, troll.mhpmax);
});

test('a pet killed by the hero does not revive tame', async () => {
    freshState();
    const troll = await createMonsterAt(PM_TROLL, 12, 10);
    tameMonster(troll, game);
    troll.meating = 4;
    troll.edog.mhpmax_penalty = 5;
    troll.edog.ogoal = { x: 8, y: 8 };
    const deadHitPointMaximum = troll.mhpmax;
    initRng(7n);
    await finishHeroMonsterKill(troll, troll.mx, troll.my, {
        showKillMessage: false,
        recordConduct: false,
    });
    const corpse = game.level.objects[12][10].find(
        object => object.otyp === CORPSE,
    );
    stopAllObjectTimers(corpse);

    const event = await reviveNow(corpse);

    assert.equal(event.monster.mtame, 0);
    assert.equal(event.monster.pet, false);
    assert.equal(event.monster.mpeaceful, 1);
    assert.equal(event.monster.meating, 0);
    assert.ok(event.monster.mhpmax > deadHitPointMaximum);
    assert.equal(event.monster.mhp, event.monster.mhpmax);
    assert.equal(event.monster.edog.mhpmax_penalty, 0);
});

test('a reviving corpse stops being the hero\'s meal', async () => {
    freshState();
    const corpse = place_object(trollCorpse(), 12, 10);
    corpse.oeaten = 30;
    game._occupation = {
        key: 'eat-food',
        object: corpse,
        remaining: 3,
    };

    const event = await reviveNow(corpse);

    assert.equal(game._occupation, null);
    assert.equal(corpse.where, 'gone');
    assert.ok(event.monster.mhp < event.monster.mhpmax);
});

test('a substitute revival does not absorb the linked ghost', async () => {
    freshState();
    const ghost = await createMonsterAt(PM_GHOST, 12, 10);
    tameMonster(ghost, game);
    const sack = mksobj(SACK, false, false);
    addObjectToMonsterInventory(ghost, sack, game);
    const corpse = mksobj(CORPSE, true, false);
    set_corpsenm(corpse, PM_GUARD);
    stopAllObjectTimers(corpse);
    corpse.oextra = { ...(corpse.oextra || {}), omid: ghost.m_id };
    place_object(corpse, 12, 10);

    const event = await reviveNow(corpse);

    assert.equal(event.monster.mnum, PM_HUMAN_ZOMBIE);
    assert.equal(event.monster.permspeed, MFAST);
    assert.ok(!event.monster.mtame);
    assert.ok(game.level.monsters.includes(ghost));
    assert.ok(ghost.minvent.includes(sack));
    assert.ok(!event.monster.minvent.includes(sack));
});

test('shapechanger protection keeps a unique corpse as a doppelganger',
    async () => {
        freshState();
        game.u.protectionFromShapeChangers = true;
        const corpse = mksobj(CORPSE, true, false);
        set_corpsenm(corpse, PM_WIZARD_OF_YENDOR);
        stopAllObjectTimers(corpse);
        place_object(corpse, 12, 10);

        const event = await reviveNow(corpse);

        assert.equal(event.monster.mnum, PM_DOPPELGANGER);
        assert.ok(!Number.isInteger(event.monster.cham)
            || event.monster.cham < 0);
    });

test('reviving the quest leader clears the dead-leader state', async () => {
    freshState();
    const leader = await createMonsterAt(PM_GIANT, 12, 10);
    leader.mpeaceful = 1;
    game.quest_status = {
        leader_m_id: leader.m_id,
        leader_is_dead: false,
    };
    initRng(8n);

    await finishHeroMonsterKill(leader, leader.mx, leader.my, {
        showKillMessage: false,
        recordConduct: false,
    });
    assert.equal(game.quest_status.leader_is_dead, true);
    const corpse = game.level.objects[12][10].find(
        object => object.otyp === CORPSE,
    );
    stopAllObjectTimers(corpse);

    const event = await reviveNow(corpse);

    assert.equal(event.monster.m_id, leader.m_id);
    assert.equal(game.quest_status.leader_is_dead, false);
});

test('shapechanger protection keeps a revived chameleon in its natural form',
    async () => {
        freshState();
        game.u.protectionFromShapeChangers = true;
        const corpse = place_object(
            untimedCorpse(PM_CHAMELEON), 12, 10,
        );

        const event = await reviveNow(corpse);

        assert.equal(event.monster.mnum, PM_CHAMELEON);
        assert.equal(event.monster.cham, -1);
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
    const carrier = await createMonsterAt(PM_LEOCROTTA, 12, 10);
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
    const victim = await createMonsterAt(PM_GIANT, 12, 10);
    victim.name = 'Gorm';
    victim.mgivenname = 'Gorm';
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
