import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroHitAftermath, shouldAngerGuardsAfterHeroHit } from '../js/hero_hit_aftermath.js';
import { finishHeroMonsterKillOutcome } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, WAN_COLD } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';
async function createTemple({ hitPoints = 100 } = {}) {
    const level = freshObjectRoom({
        hero: { uhp: hitPoints, uhpmax: 100, uac: 30 },
        flags: { disclose: '-i -a -v -c -o' },
    });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    const room = {
        lx: 7, hx: 16, ly: 6, hy: 14, rtype: TEMPLE, rlit: 1,
        doorct: 0, fdoor: 0, irregular: false, needjoining: false,
        nsubrooms: 0, sbrooms: [], roomnoidx: 0, needfill: 0,
    };
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const altar = level.requireAt(8, 10);
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE | Align2amask(0);
    const priest = await createMonsterAt('aligned cleric', 11, 11, NO_MINVENT);
    priest.ispriest = 1;
    priest.mpeaceful = 0;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 8, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    updateHeroRoomMembership(game);
    vision_recalc(0);
    return { priest, altar, level };
}
void test('an already hostile priest can call down lightning after a hit', async () => {
    const { priest } = await createTemple();
    requirePlayingGame(game);
    const wand = await addInventoryObject(WAN_COLD);
    game._currentWand = wand;
    installPagerInput(resetInputState(), {
        expected: /Thou|How darest|lightning|blind/, limit: 8,
    });
    initRng(1n);
    const result = await finishHeroHitAftermath(priest, {
        angerGuards: shouldAngerGuardsAfterHeroHit(priest), random: () => 0,
    });
    assert.equal(result.heroDied, false);
    assert.ok(game.u.uhp < 100);
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.equal(game._currentWand, wand);
});
void test('killing a priest does not prevent the shrine from retaliating afterward', async () => {
    const { priest, level } = await createTemple();
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /priest|experience level|Thou|How darest|lightning|blind/, limit: 10,
    });
    const angerGuards = shouldAngerGuardsAfterHeroHit(priest);
    await finishHeroMonsterKillOutcome(priest, priest.mx, priest.my, { noCorpse: true });
    assert.notEqual(monsterAtPosition(level, priest.mx, priest.my), priest);
    initRng(1n);
    const result = await finishHeroHitAftermath(priest, { angerGuards, random: () => 0 });
    assert.equal(result.heroDied, false);
    assert.ok(game.u.uhp < 100);
    assert.ok((game.u.blindTurns ?? 0) > 0);
});
for (const protectedShrine of [false, true]) {
    void test(`${protectedShrine ? 'an untriggered' : 'a desecrated'} shrine leaves the hero unharmed after a hit`, async () => {
        const { priest, altar } = await createTemple();
        if (!protectedShrine)
            altar.flags &= ~AM_SHRINE;
        const result = await finishHeroHitAftermath(priest, {
            angerGuards: false, random: () => protectedShrine ? 1 : 0,
        });
        assert.equal(result.heroDied, false);
        assert.equal(game.u.uhp, 100);
        assert.equal(game.u.blindTurns, 0);
    });
}
for (const target of ['watchman', 'shopkeeper', 'goblin', 'hostile watchman']) {
    void test(`a hit on a ${target} ${target === 'watchman' || target === 'shopkeeper' ? 'alerts' : 'does not alert'} the Minetown watch`, async () => {
        freshObjectRoom({ right: 22 });
        const defender = target === 'shopkeeper'
            ? (await createStaffedShop({ left: 15, right: 20, keeperX: 16 })).shopkeeper
            : await createMonsterAt(target === 'hostile watchman' ? 'watchman' : target, 11, 10, NO_MINVENT);
        defender.mpeaceful = target === 'hostile watchman' ? 0 : 1;
        const guard = await createMonsterAt('watch captain', 14, 13, NO_MINVENT);
        guard.mpeaceful = 1;
        guard.msleeping = 1;
        const angerGuards = shouldAngerGuardsAfterHeroHit(defender);
        defender.mpeaceful = 0;
        installPagerInput(resetInputState(), { expected: /guard/, limit: 3 });
        const result = await finishHeroHitAftermath(defender, { angerGuards });
        assert.equal(result.heroDied, false);
        const alerted = target === 'watchman' || target === 'shopkeeper';
        assert.equal(guard.mpeaceful, alerted ? 0 : 1);
        assert.equal(guard.msleeping, alerted ? 0 : 1);
    });
}
void test('a deaf hero still angers the watch without guard announcement', async () => {
    freshObjectRoom({ hero: { deafTurns: 20 } });
    const defender = await createMonsterAt('watchman', 11, 10, NO_MINVENT);
    defender.mpeaceful = 1;
    const guard = await createMonsterAt('watch captain', 14, 13, NO_MINVENT);
    guard.mpeaceful = 1;
    guard.msleeping = 1;
    await pline('You strike the watchman.');
    await finishHeroHitAftermath(defender, {
        angerGuards: shouldAngerGuardsAfterHeroHit(defender),
    });
    assert.equal(guard.mpeaceful, 0);
    assert.equal(guard.msleeping, 0);
    assert.equal(game._pending_message, 'You strike the watchman.');
});
for (const lifesaving of [false, true]) {
    void test(`fatal shrine retaliation ${lifesaving ? 'continues to guard anger after life saving' : 'stops before guard anger'}`, async () => {
        const { priest } = await createTemple({ hitPoints: 1 });
        requirePlayingGame(game);
        const guard = await createMonsterAt('watch captain', 14, 13, NO_MINVENT);
        guard.mpeaceful = 1;
        guard.msleeping = 1;
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        installPagerInput(resetInputState(), {
            expected: /amulet of life saving \(being worn\)|Thou|How darest|lightning|blind|die|medallion|better|guard|REST|PEACE|points/,
            limit: 16,
        });
        initRng(1n);
        const result = await finishHeroHitAftermath(priest, { angerGuards: true, random: () => 0 });
        assert.equal(result.heroDied, !lifesaving);
        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.equal(guard.mpeaceful, lifesaving ? 0 : 1);
        assert.equal(guard.msleeping, lifesaving ? 0 : 1);
        if (lifesaving)
            assert.ok(game.u.uhp > 0);
    });
}
void test('guard anger waits for the shrine warning and lightning to finish', async () => {
    const { priest } = await createTemple();
    const guard = await createMonsterAt('watch captain', 14, 13, NO_MINVENT);
    guard.mpeaceful = 1;
    guard.msleeping = 1;
    await pline('You strike the priest.');
    const input = resetInputState();
    initRng(1n);
    const aftermath = finishHeroHitAftermath(priest, { angerGuards: true, random: () => 0 });
    await input.waitUntilBlocked();
    try {
        assert.equal(game.u.uhp, 100);
        assert.equal(guard.mpeaceful, 1);
        assert.equal(guard.msleeping, 1);
    }
    finally {
        installPagerInput(input, {
            expected: /priest|Thou|How darest|lightning|blind|guard/, limit: 10,
        });
        input.feed(' ');
        await aftermath;
    }
    assert.ok(game.u.uhp < 100);
    assert.equal(guard.mpeaceful, 0);
    assert.equal(guard.msleeping, 0);
});
//# sourceMappingURL=hero_hit_aftermath.test.js.map