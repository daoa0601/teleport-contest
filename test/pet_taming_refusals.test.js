import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_EMIN, MM_EPRI, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { tameMonster } from '../js/monster_taming.js';
import { OBJECT_NAMES, TRIPE_RATION } from '../js/object_data.js';
import { ensureQuestStatus } from '../js/quest.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
const SCR_TAMING = OBJECT_NAMES.indexOf('taming');
async function hostilePetCandidate(name, x = 11, y = 10) {
    return await createMonsterAt(name, x, y, MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT);
}
async function topMessage() {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map((cell) => cell.ch).join('').trimEnd() ?? '';
}
void test('the Wizard of Yendor rejects taming before even becoming peaceful', async () => {
    freshObjectRoom({ moves: 100 });
    const wizard = await hostilePetCandidate('Wizard of Yendor');
    assert.equal(await tameMonster(wizard, await mksobj(TRIPE_RATION, false, false), {
        announce: true,
    }), false);
    assert.ok(!wizard.mpeaceful);
    assert.ok(!wizard.mtame);
    assert.equal(await topMessage(), '');
});
void test('a quest nemesis keeps its hostility against taming food', async () => {
    freshObjectRoom({ moves: 100 });
    assert.ok(game.urole?.neminum !== undefined && game.urole.neminum >= 0);
    const nemesis = await hostilePetCandidate(game.urole.neminum);
    assert.equal(await tameMonster(nemesis, await mksobj(TRIPE_RATION, false, false), {
        announce: true,
    }), false);
    assert.ok(!nemesis.mpeaceful);
    assert.ok(!nemesis.mtame);
    assert.equal(await topMessage(), '');
});
void test('an angry shopkeeper is pacified by taming magic but never becomes a pet', async () => {
    freshObjectRoom({ moves: 100 });
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.mpeaceful = 0;
    assert.equal(await tameMonster(shopkeeper, await mksobj(SCR_TAMING, false, false)), false);
    assert.ok(!shopkeeper.mtame);
    assert.equal(shopkeeper.mpeaceful, 1);
    // C's tamedog() has already pacified her before make_happy_shk() runs,
    // so an in-shop keeper neither "calms down" out loud nor wanders off.
    assert.equal(game.level?.monsters.includes(shopkeeper), true);
    assert.equal(await topMessage(), '');
});
void test('a vault guard cannot be tamed even after calming down', async () => {
    // Guards are human, so is_human() would mask the isgd rule; a duty-bound
    // guard keeps its role data across polymorph, where the rule stands alone.
    freshObjectRoom({ moves: 100 });
    const guard = await hostilePetCandidate('little dog');
    guard.isgd = 1;
    assert.equal(await tameMonster(guard, await mksobj(TRIPE_RATION, false, false), {
        announce: true,
    }), false);
    assert.ok(!guard.mtame);
    assert.equal(guard.mpeaceful, 1);
    assert.match(await topMessage(), /little dog seems more amiable\.$/);
});
void test('a temple priest hears taming magic out without adopting the hero', async () => {
    // Priests are human too; only a polymorphed priest isolates ispriest().
    freshObjectRoom({ moves: 100 });
    const priest = await createMonsterAt('little dog', 11, 10, MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT | MM_EPRI);
    priest.ispriest = 1;
    assert.equal(await tameMonster(priest, await mksobj(TRIPE_RATION, false, false), {
        announce: true,
    }), false);
    assert.ok(!priest.mtame);
    assert.equal(priest.mpeaceful, 1);
});
void test('a minion keeps its own allegiance even in a tameable body', async () => {
    // The angelic servants that carry isminion are human-shaped; polymorph
    // keeps their allegiance data, so the rule needs a non-human subject.
    freshObjectRoom({ moves: 100 });
    const minion = await createMonsterAt('little dog', 11, 10, MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT | MM_EMIN);
    minion.isminion = 1;
    assert.equal(await tameMonster(minion, await mksobj(TRIPE_RATION, false, false), {
        announce: true,
    }), false);
    assert.ok(!minion.mtame);
    assert.equal(minion.mpeaceful, 1);
});
void test('a covetous overlord settles for peace instead of adoption', async () => {
    freshObjectRoom({ moves: 100 });
    const overlord = await hostilePetCandidate('Vlad the Impaler');
    assert.equal(await tameMonster(overlord, await mksobj(TRIPE_RATION, false, false), {
        announce: true,
    }), false);
    assert.ok(!overlord.mtame);
    assert.equal(overlord.mpeaceful, 1);
    assert.match(await topMessage(), /Vlad the Impaler seems more amiable\.$/);
});
void test('humans refuse to be tamed by offered food', async () => {
    freshObjectRoom({ moves: 100 });
    const watchman = await hostilePetCandidate('watchman');
    assert.equal(await tameMonster(watchman, await mksobj(TRIPE_RATION, false, false), {
        announce: true,
    }), false);
    assert.ok(!watchman.mtame);
    assert.equal(watchman.mpeaceful, 1);
});
void test('a demon stays masterless while the hero is mortal flesh', async () => {
    freshObjectRoom({ moves: 100 });
    const devil = await hostilePetCandidate('horned devil');
    assert.equal(await tameMonster(devil, await mksobj(TRIPE_RATION, false, false), {
        announce: true,
    }), false);
    assert.ok(!devil.mtame);
    assert.equal(devil.mpeaceful, 1);
});
void test('the quest leader declines to become the hero\'s pet', async () => {
    // Every quest leader is human, so is_human() would refuse first; the
    // leader_m_id rule only stands alone once the leader has changed shape.
    freshObjectRoom({ moves: 100 });
    const leader = await hostilePetCandidate('little dog');
    ensureQuestStatus(game).leader_m_id = leader.m_id;
    assert.equal(await tameMonster(leader, await mksobj(SCR_TAMING, false, false)), false);
    assert.ok(!leader.mtame);
});
void test('a fully tame pet greets renewed taming magic with a refreshed bond', async () => {
    freshObjectRoom({ moves: 100 });
    const dog = await createMonsterAt('little dog', 11, 10, MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    assert.equal(dog.mtame, 10);
    dog.edog.apport = 0;
    dog.edog.hungrytime = 150;
    assert.equal(await tameMonster(dog, await mksobj(SCR_TAMING, false, false)), true);
    assert.equal(dog.mtame, 10);
    assert.equal(dog.edog.apport, 1);
    assert.equal(dog.edog.hungrytime, 1100);
    assert.equal(await topMessage(), '');
});
//# sourceMappingURL=pet_taming_refusals.test.js.map