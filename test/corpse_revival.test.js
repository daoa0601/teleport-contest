import test from 'node:test';
import assert from 'node:assert/strict';
import { reviveCorpseByMagic, reviveCorpseImmediately, runClaimedCorpseRevivalTimer, } from '../js/corpse_revival.js';
import { MFAST, MM_NOTAIL, NO_MINVENT, ROOM } from '../js/const.js';
import { pline } from '../js/display.js';
import { doeat } from '../js/eat.js';
import { initializePet } from '../js/dog.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { createCorpstatAt, mksobj, set_corpsenm, } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { CORPSE, CRYSKNIFE, SACK } from '../js/object_data.js';
import { claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopAllObjectTimers, } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { runDueTimers } from '../js/timer_effects.js';
import { vision_recalc } from '../js/vision.js';
import { untimedCorpse } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
function terrainAt(x, y) {
    const location = requireGameLevel().at(x, y);
    assert.ok(location, `map location ${x},${y} exists`);
    return location;
}
function objectsAt(x, y) {
    const objects = requireGameLevel().objects[x]?.[y];
    assert.ok(objects, `object square ${x},${y} exists`);
    return objects;
}
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
async function trollCorpse() {
    return await untimedCorpse(PM_TROLL, { age: game.moves });
}
async function reviveNow(corpse, seed = 12) {
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.REVIVE_MON, game.moves, game);
    const claimed = claimNextDueObjectTimer(game, game.moves);
    initRng(BigInt(seed));
    return runClaimedCorpseRevivalTimer(claimed, game, game.moves);
}
void test('a new troll corpse can receive the missing revival timer', async () => {
    freshState();
    requirePlayingGame(game);
    const corpse = await createCorpstatAt(CORPSE, null, PM_TROLL, 12, 10, 8);
    const [timer] = objectTimers(corpse);
    assert.ok(timer);
    assert.equal(timer.kind, OBJECT_TIMER_KIND.REVIVE_MON);
    assert.ok(timer.deadline >= game.moves + 2);
    assert.ok(timer.deadline <= game.moves + 50);
});
void test('a troll corpse on the floor rises as a live troll', async () => {
    freshState();
    requirePlayingGame(game);
    const corpse = await trollCorpse();
    placeCreatedObject(corpse, 12, 10);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.kind, 'revived');
    assert.equal(event.monster.mnum, PM_TROLL);
    assert.equal(event.monster.mrevived, 1);
    assert.equal(event.messages.at(-1), 'The troll rises from the dead!');
    assert.equal(corpse.where, 'gone');
});
void test('explicit revival magic overrides a corpse no-revive flag', async () => {
    freshState();
    requirePlayingGame(game);
    const corpse = await trollCorpse();
    placeCreatedObject(corpse, 12, 10);
    corpse.norevive = true;
    const event = await reviveCorpseByMagic(corpse, game);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.kind, 'revived');
    assert.equal(event.monster.mnum, PM_TROLL);
    assert.equal(corpse.where, 'gone');
});
void test('a named corpse revives with a fresh identity and its saved name and health', async () => {
    freshState();
    requirePlayingGame(game);
    const troll = await createMonsterAt(PM_TROLL, 12, 10);
    troll.name = 'Grond';
    troll.mhp = troll.mhpmax = 1000;
    initRng(4n);
    await finishHeroMonsterKill(troll, troll.mx, troll.my, {
        showKillMessage: false,
        recordConduct: false,
    });
    const corpse = objectsAt(12, 10).find(object => object.otyp === CORPSE);
    assert.ok(corpse);
    stopAllObjectTimers(corpse);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.notEqual(event.monster.m_id, troll.m_id);
    assert.equal(event.monster.name, troll.name);
    assert.equal(event.monster.mhpmax, troll.mhpmax);
    assert.equal(event.monster.mhp, troll.mhpmax);
});
void test('a pet killed by the hero does not revive tame', async () => {
    freshState();
    requirePlayingGame(game);
    const troll = await createMonsterAt(PM_TROLL, 12, 10);
    initializePet(troll, { state: game });
    troll.meating = 4;
    assert.ok(troll.edog);
    troll.edog.mhpmax_penalty = 5;
    troll.edog.ogoal = { x: 8, y: 8 };
    const deadHitPointMaximum = troll.mhpmax;
    initRng(7n);
    await finishHeroMonsterKill(troll, troll.mx, troll.my, {
        showKillMessage: false,
        recordConduct: false,
    });
    const corpse = objectsAt(12, 10).find(object => object.otyp === CORPSE);
    assert.ok(corpse);
    stopAllObjectTimers(corpse);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.ok(event.monster.edog);
    assert.equal(event.monster.mtame, 0);
    assert.equal(event.monster.pet, false);
    assert.equal(event.monster.mpeaceful, 1);
    assert.equal(event.monster.meating, 0);
    assert.ok(event.monster.mhpmax > deadHitPointMaximum);
    assert.equal(event.monster.mhp, event.monster.mhpmax);
    assert.equal(event.monster.edog.mhpmax_penalty, 0);
});
void test('a reviving corpse stops being the hero\'s meal', async () => {
    freshState();
    requirePlayingGame(game);
    const corpse = await trollCorpse();
    placeCreatedObject(corpse, 12, 10);
    game.u.ux = 12;
    game.u.uy = 10;
    const input = resetInputState();
    let choosingFood = true;
    input.beforeRead = () => {
        if (choosingFood) {
            choosingFood = false;
            return;
        }
        const display = game.nhDisplay;
        assert.ok(display);
        const text = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.ok(text.includes('--More--'), `unexpected meal prompt: ${text}`);
        input.feed(' ');
    };
    input.feed('y');
    initRng(71n);
    await doeat();
    assert.equal(game._occupation?.key, 'eat-food');
    assert.equal(game.context.victual?.piece, corpse);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(game._occupation, null);
    assert.equal(corpse.where, 'gone');
    assert.ok(event.monster.mhp < event.monster.mhpmax);
});
void test('a revived body receives its ghost inventory without dropping it', async () => {
    freshState();
    requirePlayingGame(game);
    const ghost = await createMonsterAt(PM_GHOST, 13, 10);
    const knife = await mksobj(CRYSKNIFE, false, false);
    await addObjectToMonsterInventory(ghost, knife);
    const corpse = await trollCorpse();
    corpse.oextra = { ...(corpse.oextra || {}), omid: ghost.m_id };
    placeCreatedObject(corpse, 12, 10);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.kind, 'revived');
    assert.ok(!game.level.monsters.includes(ghost));
    assert.equal(ghost.minvent?.length, 0);
    assert.ok(event.monster.minvent?.includes(knife));
    assert.equal(knife.where, 'minvent');
    assert.equal(knife.carrierMid, event.monster.m_id);
    assert.equal(knife.otyp, CRYSKNIFE);
});
void test('a substitute revival does not absorb the linked ghost', async () => {
    freshState();
    requirePlayingGame(game);
    const ghost = await createMonsterAt(PM_GHOST, 12, 10);
    initializePet(ghost, { state: game });
    const sack = await mksobj(SACK, false, false);
    await addObjectToMonsterInventory(ghost, sack, game);
    const corpse = await mksobj(CORPSE, true, false);
    set_corpsenm(corpse, PM_GUARD);
    assert.ok(corpse);
    stopAllObjectTimers(corpse);
    corpse.oextra = { ...(corpse.oextra || {}), omid: ghost.m_id };
    placeCreatedObject(corpse, 12, 10);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.monster.mnum, PM_HUMAN_ZOMBIE);
    assert.equal(event.monster.permspeed, MFAST);
    assert.ok(!event.monster.mtame);
    assert.ok(game.level.monsters.includes(ghost));
    assert.ok(ghost.minvent?.includes(sack));
    assert.ok(!event.monster.minvent?.includes(sack));
});
void test('shapechanger protection keeps a unique corpse as a doppelganger', async () => {
    freshState();
    requirePlayingGame(game);
    game.u.protectionFromShapeChangers = true;
    const corpse = await mksobj(CORPSE, true, false);
    set_corpsenm(corpse, PM_WIZARD_OF_YENDOR);
    assert.ok(corpse);
    stopAllObjectTimers(corpse);
    placeCreatedObject(corpse, 12, 10);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.monster.mnum, PM_DOPPELGANGER);
    assert.ok(!Number.isInteger(event.monster.cham)
        || (event.monster.cham !== undefined && event.monster.cham < 0));
});
void test('reviving the quest leader clears the dead-leader state', async () => {
    freshState();
    requirePlayingGame(game);
    const leader = await createMonsterAt(game.urole.ldrnum, 12, 10);
    assert.ok(game.quest_status);
    assert.equal(game.quest_status.leader_m_id, leader.m_id);
    pushKeys(' '.repeat(100));
    initRng(2n);
    await finishHeroMonsterKill(leader, leader.mx, leader.my, {
        showKillMessage: false,
        recordConduct: false,
    });
    assert.equal(game.quest_status.leader_is_dead, true);
    const corpse = game.level.objects[12]?.[10]?.find(object => object.otyp === CORPSE);
    assert.ok(corpse, 'the dead role leader left a corpse');
    assert.ok(corpse);
    stopAllObjectTimers(corpse);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.notEqual(event.monster.m_id, leader.m_id);
    assert.equal(game.quest_status.leader_m_id, event.monster.m_id);
    assert.equal(game.quest_status.leader_is_dead, false);
    assert.equal(game.quest_status.killed_leader, true);
});
void test('shapechanger protection keeps a revived chameleon in its natural form', async () => {
    freshState();
    requirePlayingGame(game);
    game.u.protectionFromShapeChangers = true;
    const corpse = await untimedCorpse(PM_CHAMELEON);
    placeCreatedObject(corpse, 12, 10);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.monster.mnum, PM_CHAMELEON);
    assert.equal(event.monster.cham, -1);
});
void test('a troll corpse in the pack revives beside the hero', async () => {
    freshState();
    requirePlayingGame(game);
    const corpse = await trollCorpse();
    corpse.where = 'inventory';
    game.inventory.push(corpse);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.kind, 'revived');
    assert.equal(event.messages.at(-1), 'You feel squirming in your backpack!');
    assert.equal(game.inventory.includes(corpse), false);
    assert.equal(Math.max(Math.abs(event.monster.mx - game.u.ux), Math.abs(event.monster.my - game.u.uy)), 1);
});
void test('a troll corpse revives from a sack in the hero pack', async () => {
    freshState();
    requirePlayingGame(game);
    const sack = await mksobj(SACK, false, false);
    sack.where = 'inventory';
    sack.contents = [];
    game.inventory.push(sack);
    const corpse = await trollCorpse();
    corpse.where = 'contained';
    corpse.container = sack;
    sack.contents.push(corpse);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.kind, 'revived');
    assert.equal(event.messages.at(-1), 'A troll writhes out of a sack in your pack!');
    assert.equal(sack.contents.length, 0);
});
void test('a monster drops a corpse when it revives from its pack', async () => {
    freshState();
    requirePlayingGame(game);
    const carrier = await createMonsterAt(PM_LEOCROTTA, 12, 10);
    const corpse = await trollCorpse();
    await addObjectToMonsterInventory(carrier, corpse, game);
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.kind, 'revived');
    assert.equal(event.messages.at(-1), 'Startled, the leocrotta drops a troll corpse as it revives!');
    assert.equal(carrier.minvent?.includes(corpse), false);
});
void test('a buried troll corpse claws out through a new pit', async () => {
    freshState();
    requirePlayingGame(game);
    const corpse = await trollCorpse();
    corpse.where = 'buried';
    corpse.buried = true;
    corpse.ox = 12;
    corpse.oy = 10;
    game.level.buriedObjects = [corpse];
    const event = await reviveNow(corpse);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.kind, 'revived');
    assert.equal(event.buried, true);
    assert.ok(event.trap);
    assert.equal(event.trap.tx, event.monster.mx);
    assert.equal(event.trap.ty, event.monster.my);
    assert.equal(game.level.buriedObjects.includes(corpse), false);
});
void test('a buried human corpse on a zombify timer rises as a zombie', async () => {
    freshState();
    requirePlayingGame(game);
    const corpse = await mksobj(CORPSE, true, false);
    set_corpsenm(corpse, PM_HUMAN);
    assert.ok(corpse);
    stopAllObjectTimers(corpse);
    corpse.where = 'buried';
    corpse.buried = true;
    corpse.ox = 12;
    corpse.oy = 10;
    game.level.buriedObjects = [corpse];
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, game.moves, game);
    const event = await runClaimedCorpseRevivalTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.kind, 'revived');
    assert.equal(event.monster.mnum, PM_HUMAN_ZOMBIE);
    assert.equal(event.buried, true);
    assert.equal(corpse.where, 'gone');
});
void test('a zombifying kill leaves a corpse which will rise', async () => {
    freshState();
    requirePlayingGame(game);
    const victim = await createMonsterAt(PM_GIANT, 12, 10);
    victim.name = 'Gorm';
    victim.mgivenname = 'Gorm';
    initRng(6n);
    await finishHeroMonsterKill(victim, victim.mx, victim.my, {
        showKillMessage: false,
        recordConduct: false,
        zombifyCorpse: true,
    });
    const corpse = objectsAt(12, 10).find(object => object.otyp === CORPSE);
    assert.ok(corpse);
    const [timer] = objectTimers(corpse);
    assert.ok(timer);
    assert.equal(timer.kind, OBJECT_TIMER_KIND.ZOMBIFY_MON);
    assert.ok(timer.deadline >= game.moves + 5);
    assert.ok(timer.deadline <= game.moves + 19);
    assert.equal(corpse.oextra?.omonst, undefined);
    game.moves = timer.deadline;
    const event = await runClaimedCorpseRevivalTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.monster.mnum, PM_GIANT_ZOMBIE);
    assert.equal(event.monster.name, victim.name);
});
for (const mode of ['magic', 'immediate', 'timer', 'timer in stasis']) {
    void test(`${mode} Rider revival ${mode === 'timer' ? 'relocates' : 'does not relocate'} an occupying monster`, async () => {
        freshState();
        requirePlayingGame(game);
        const blocker = await createMonsterAt('goblin', 12, 10);
        const corpse = await untimedCorpse(MONSTER_NAME.indexOf('Death'));
        placeCreatedObject(corpse, 12, 10);
        if (mode === 'timer in stasis')
            game.level.flags.stasis_until = game.moves;
        initRng(12n);
        pushKeys(' '.repeat(100));
        const revival = mode === 'magic'
            ? await reviveCorpseByMagic(corpse, game)
            : mode === 'immediate'
                ? await reviveCorpseImmediately(corpse, game)
                : await reviveNow(corpse);
        assert.ok(revival);
        assert.ok(revival.monster);
        assert.equal(revival.kind, 'revived');
        if (mode === 'timer') {
            assert.notDeepEqual([blocker.mx, blocker.my], [12, 10]);
            assert.equal(monsterAtPosition(game.level, 12, 10), revival.monster);
        }
        else {
            assert.deepEqual([blocker.mx, blocker.my], [12, 10]);
            assert.equal(monsterAtPosition(game.level, 12, 10), blocker);
            assert.notDeepEqual([revival.monster.mx, revival.monster.my], [12, 10]);
        }
    });
}
void test('timer displacement feedback finishes before the corpse revives', async () => {
    freshObjectRoom({ left: 11, right: 12, top: 10, bottom: 10,
        heroX: 11, heroY: 10 });
    requirePlayingGame(game);
    terrainAt(20, 10).typ = ROOM;
    vision_recalc(0);
    const worm = await createMonsterAt('long worm', 12, 10, MM_NOTAIL | NO_MINVENT);
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('Death'));
    placeCreatedObject(corpse, 12, 10);
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.REVIVE_MON, game.moves, game);
    await pline('You examine the corpse beside the long worm, but hesitate to touch it.');
    const input = resetInputState();
    const running = runDueTimers();
    await input.waitUntilBlocked();
    try {
        assert.deepEqual([worm.mx, worm.my], [20, 10]);
        assert.equal(corpse.where, 'floor');
        assert.equal(monsterAtPosition(game.level, 12, 10), null);
        assert.equal(game.level.monsters.some(monster => monster.mnum === corpse.corpsenm), false);
    }
    finally {
        input.feed(' '.repeat(20));
        await running;
    }
    assert.equal(corpse.where, 'gone');
    assert.equal(monsterAtPosition(game.level, 12, 10)?.mnum, corpse.corpsenm);
});
//# sourceMappingURL=corpse_revival.test.js.map