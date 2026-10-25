import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ICE, IRONBARS, STONE, W_ARMH, WEB } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, heroGoldObject } from '../js/hero_gold.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DIAMOND, GOLD_PIECE, HELMET } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createGoldMonster, carriedGold, throwGold, } from './support/gold-arena.js';
import { addTrap, floorObjects, floorObjectsAt, } from './support/level-state.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { withMessagePages } from './support/planned-input.js';
const PM_SHOPKEEPER = 271;
const PM_GUARD = 272;
const PM_ALIGNED_CLERIC = MONSTER_NAME.indexOf('aligned cleric');
const PM_SOLDIER = 277;
const PM_WATCHMAN = 282;
void test('gold blocked by an adjacent wall leaves later hallucinated appearances unchanged', async () => {
    const catchNames = [];
    for (const direction of ['>', 'l']) {
        const level = freshObjectRoom({ hero: { hallucinationTurns: 20 } });
        level.flags.noteleport = true;
        level.requireAt(11, 10).typ = STONE;
        const purse = await carriedGold(100);
        await createMonsterAt('gray unicorn', 10, 11);
        const gem = await addInventoryObject(DIAMOND);
        const messages = [];
        resetInputState().beforeRead = () => { messages.push(game._pending_message); };
        initRng(42n);
        await throwInventoryObject(purse, direction);
        await throwInventoryObject(gem, 'j', ' '.repeat(20));
        assert.equal(purse.where, 'floor');
        assert.equal(purse.ox, 10);
        assert.equal(purse.oy, 10);
        const text = messages.join('\n') + '\n' + game._pending_message;
        const name = text.match(/([^\n]+) catches the diamond\./)?.[1];
        assert.ok(name, text);
        catchNames.push(name);
    }
    assert.equal(catchNames[1], catchNames[0], 'a purse that cannot leave the hero has no hallucinated flight appearance');
});
function monsterGoldAmount(monster) {
    return (monster.minvent ?? [])
        .filter(object => object.otyp === GOLD_PIECE)
        .reduce((total, object) => total + (object.quantity ?? object.quan), 0);
}
void test('direct throw moves the whole purse through its strength-weight range', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(100, 29001);
    await throwGold('l');
    assert.equal(heroGoldObject(game), null);
    assert.equal(heroGoldAmount(game), 0);
    assert.equal(purse.quantity, 100);
    assert.equal(purse.where, 'floor');
    assert.deepEqual([purse.ox, purse.oy], [15, 10]);
    assert.equal(floorObjectsAt(level, 15, 10).includes(purse), true);
    assert.equal(floorObjects(level).filter(object => object.otyp === GOLD_PIECE).length, 1);
    assert.equal(game.context.move, 1);
});
void test('an adjacent blocked cell leaves the whole thrown purse at the hero', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    level.requireAt(11, 10).typ = STONE;
    const purse = await carriedGold(4000, 29002);
    await throwGold('l');
    assert.equal(heroGoldObject(game), null);
    assert.equal(purse.quantity, 4000);
    assert.deepEqual([purse.ox, purse.oy], [10, 10]);
    assert.equal(floorObjectsAt(level, 10, 10).includes(purse), true);
    assert.equal(game.context.move, 1);
});
void test('coin weight shortens direct range using source integer division', async () => {
    const level = freshGameplayRoom();
    const purse = await carriedGold(4000, 29026);
    await throwGold('l');
    assert.equal(purse.owt, 40);
    assert.deepEqual([purse.ox, purse.oy], [14, 10]);
    assert.equal(floorObjectsAt(level, 14, 10).includes(purse), true);
});
void test('a later wall leaves direct gold on the last open path cell', async () => {
    const level = freshGameplayRoom();
    level.requireAt(14, 10).typ = STONE;
    const purse = await carriedGold(100, 29027);
    await throwGold('l');
    assert.deepEqual([purse.ox, purse.oy], [13, 10]);
    assert.equal(floorObjectsAt(level, 13, 10).includes(purse), true);
});
void test('coin-class direct gold passes through iron bars', async () => {
    const level = freshGameplayRoom();
    level.requireAt(12, 10).typ = IRONBARS;
    const purse = await carriedGold(100, 29028);
    await throwGold('l');
    assert.deepEqual([purse.ox, purse.oy], [15, 10]);
    assert.equal(floorObjectsAt(level, 15, 10).includes(purse), true);
});
void test('distant iron bars can stop thrown gold on the preceding square', async () => {
    const level = freshGameplayRoom();
    level.requireAt(12, 10).typ = IRONBARS;
    const purse = await carriedGold(100, 29030);
    initRng(1n);
    await throwGold('l');
    assert.deepEqual([purse.ox, purse.oy], [11, 10]);
    assert.equal(floorObjectsAt(level, 11, 10).includes(purse), true);
});
void test('a web can stop the whole purse at its live trap identity', async () => {
    const level = freshGameplayRoom();
    const web = addTrap(level, WEB, 12, 10, { tseen: false });
    const purse = await carriedGold(100, 29029);
    initRng(1n);
    await throwGold('l');
    assert.equal(web.tseen, true);
    assert.deepEqual([purse.ox, purse.oy], [12, 10]);
    assert.equal(floorObjectsAt(level, 12, 10).includes(purse), true);
});
void test('downward gold throw moves the whole purse to the hero square', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(17, 29003);
    await throwGold('>');
    assert.equal(heroGoldObject(game), null);
    assert.equal(purse.quantity, 17);
    assert.deepEqual([purse.ox, purse.oy], [10, 10]);
    assert.equal(floorObjectsAt(level, 10, 10).includes(purse), true);
    assert.equal(game.context.move, 1);
});
void test('self-directed gold cancellation preserves the purse and spends no time', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(17, 29032);
    await throwGold('.');
    assert.equal(heroGoldObject(game), purse);
    assert.equal(heroGoldAmount(game), 17);
    assert.equal(purse.where, 'inventory');
    assert.equal(game.context.move, 0);
});
void test('a non-greedy monster wakes but does not catch thrown gold', async () => {
    const level = freshGameplayRoom();
    const purse = await carriedGold(25, 29004);
    const jackal = await createGoldMonster({
        mnum: 12, mpeaceful: 1, msleeping: 1,
    });
    await withMessagePages(() => throwGold('l'), resetInputState(), /The jackal wakes up!  The jackal growls!  The jackal growls!/, 1);
    assert.equal(jackal.msleeping, 0);
    assert.equal(jackal.mpeaceful, 0);
    assert.equal(jackal.minvent.length, 0);
    assert.equal(floorObjectsAt(level, 13, 10).includes(purse), true);
    assert.equal(purse.where, 'floor');
    assert.equal(purse.quantity, 25);
});
void test('an immobilized greedy monster is hit harmlessly and cannot catch gold', async () => {
    const level = freshGameplayRoom();
    const purse = await carriedGold(31, 29006);
    const leprechaun = await createGoldMonster({
        mcanmove: 0, mfrozen: 3,
    });
    await throwGold('l');
    assert.equal(leprechaun.mcanmove, 0);
    assert.equal(leprechaun.mfrozen, 3);
    assert.equal(leprechaun.minvent.includes(purse), false);
    assert.equal(floorObjectsAt(level, 13, 10).includes(purse), true);
    assert.equal(purse.where, 'floor');
});
void test('a sleeping greedy monster catches the purse and abandons its meal', async () => {
    const level = freshGameplayRoom();
    const purse = await carriedGold(41, 29008);
    const leprechaun = await createGoldMonster({
        msleeping: 1, meating: 4,
        m_ap_type: 1, mappearance: 30,
    });
    const startingGold = monsterGoldAmount(leprechaun);
    initRng(1n);
    await throwGold('l');
    assert.equal(leprechaun.msleeping, 0);
    assert.equal(leprechaun.meating, 0);
    assert.equal(leprechaun.m_ap_type, 0);
    assert.equal(leprechaun.mappearance, 0);
    assert.equal(monsterGoldAmount(leprechaun), startingGold + 41);
    assert.equal(purse.where, 'gone');
    assert.equal(floorObjects(level).includes(purse), false);
});
void test('the ordinary catch anger probe can turn a peaceful greedy monster hostile', async () => {
    freshGameplayRoom();
    const purse = await carriedGold(11, 29034);
    const leprechaun = await createGoldMonster({
        mpeaceful: 1,
    });
    const startingGold = monsterGoldAmount(leprechaun);
    initRng(5n);
    await withMessagePages(() => throwGold('l'), resetInputState(), /leprechaun/, 1);
    assert.equal(monsterGoldAmount(leprechaun), startingGold + 11);
    assert.equal(leprechaun.mpeaceful, 0);
});
void test('a greedy catch merges with gold already in the monster pack', async () => {
    freshGameplayRoom();
    const purse = await carriedGold(11, 29030);
    const leprechaun = await createGoldMonster();
    const startingGold = monsterGoldAmount(leprechaun);
    initRng(1n);
    await throwGold('l');
    assert.equal(monsterGoldAmount(leprechaun), startingGold + 11);
    assert.equal(purse.where, 'gone');
    assert.equal('carrierMid' in purse, false);
});
void test('covering a shopkeeper robbery restores peace and preserves payment identity', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(50, 29010);
    const shopkeeper = await createGoldMonster({
        mnum: PM_SHOPKEEPER, isshk: 1, mpeaceful: 0,
        eshk: { robbed: 30, credit: 0, following: 1, surcharge: true },
    });
    game.u.ualign.record = 0;
    const alignmentBefore = game.u.ualign.record;
    initRng(1n);
    await throwGold('l', '  ');
    assert.equal(shopkeeper.minvent.includes(purse), true);
    assert.ok(shopkeeper.eshk !== null && shopkeeper.eshk !== undefined);
    assert.equal(shopkeeper.eshk.robbed, 0);
    assert.equal(shopkeeper.eshk.following, 0);
    assert.equal(shopkeeper.mpeaceful, 1);
    assert.equal(game.u.ualign.record, alignmentBefore + 1);
});
void test('a peaceful shopkeeper turns caught gold into exact customer credit', async () => {
    freshGameplayRoom();
    const purse = await carriedGold(7, 29012);
    const shopkeeper = await createGoldMonster({
        mnum: PM_SHOPKEEPER, isshk: 1, mpeaceful: 1,
        eshk: { robbed: 0, credit: 11, following: 0 },
    });
    initRng(1n);
    await throwGold('l');
    assert.equal(shopkeeper.minvent.includes(purse), true);
    assert.ok(shopkeeper.eshk !== null && shopkeeper.eshk !== undefined);
    assert.equal(shopkeeper.eshk.credit, 18);
    assert.equal(shopkeeper.mpeaceful, 1);
});
void test('a temple priest catches the same whole-purse identity', async () => {
    freshGameplayRoom();
    const purse = await carriedGold(13, 29014);
    const priest = await createGoldMonster({
        mnum: PM_ALIGNED_CLERIC,
        ispriest: 1, mpeaceful: 1,
    });
    initRng(1n);
    await throwGold('l', ' ');
    assert.equal(priest.minvent.includes(purse), true);
    assert.equal(purse.where, 'minvent');
    assert.equal(priest.mpeaceful, 1);
});
void test('the catch anger probe applies the coaligned priest alignment penalty', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(13, 29036);
    const priest = await createGoldMonster({
        mnum: PM_ALIGNED_CLERIC,
        ispriest: 1, mpeaceful: 1,
        epri: { shralign: 1 },
    });
    game.u.ualign.record = 10;
    initRng(5n);
    await throwGold('l', '  ');
    assert.equal(priest.minvent.includes(purse), true);
    assert.equal(priest.mpeaceful, 0);
    assert.equal(game.u.ualign.record, 5);
});
void test('the catch anger probe rewards angering a cross-aligned priest', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(13, 29038);
    const priest = await createGoldMonster({
        mnum: PM_ALIGNED_CLERIC,
        ispriest: 1, mpeaceful: 1,
        epri: { shralign: -1 },
    });
    game.u.ualign.record = 0;
    initRng(5n);
    await throwGold('l', '  ');
    assert.equal(priest.minvent.includes(purse), true);
    assert.equal(priest.mpeaceful, 0);
    assert.equal(game.u.ualign.record, 2);
});
void test('a vault guard catches the purse without the ordinary anger probe', async () => {
    freshGameplayRoom();
    const purse = await carriedGold(19, 29016);
    const guard = await createGoldMonster({
        mnum: PM_GUARD, isgd: 1, mpeaceful: 1,
    });
    initRng(5n); // the ordinary one-in-four probe would make it angry
    await throwGold('l', ' ');
    assert.equal(guard.minvent.includes(purse), true);
    assert.equal(guard.mpeaceful, 1);
});
void test('a sufficient soldier bribe changes an angry soldier to peaceful', async () => {
    freshGameplayRoom();
    const purse = await carriedGold(150, 29018);
    const soldier = await createGoldMonster({
        mnum: PM_SOLDIER, mpeaceful: 0,
    });
    initRng(1n);
    await throwGold('l');
    assert.equal(soldier.minvent.includes(purse), true);
    assert.equal(soldier.mpeaceful, 1);
});
void test('an insufficient soldier bribe is still caught but leaves hostility', async () => {
    freshGameplayRoom();
    const purse = await carriedGold(50, 29020);
    const soldier = await createGoldMonster({
        mnum: PM_SOLDIER, mpeaceful: 0,
    });
    initRng(1n);
    await throwGold('l');
    assert.equal(soldier.minvent.includes(purse), true);
    assert.equal(soldier.mpeaceful, 0);
});
void test('a watchman catches gold but remains unbribable', async () => {
    freshGameplayRoom();
    const purse = await carriedGold(500, 29022);
    const watchman = await createGoldMonster({
        mnum: PM_WATCHMAN, mpeaceful: 0,
    });
    initRng(1n);
    await throwGold('l', ' ');
    assert.equal(watchman.minvent.includes(purse), true);
    assert.equal(watchman.mpeaceful, 0);
});
void test('swallowed gold moves whole into the engulfer inventory', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(29, 29024);
    const engulfer = await createGoldMonster({
        mnum: 202, mx: 10, my: 10,
    });
    game.u.uswallow = true;
    game.u.ustuck = engulfer;
    await throwGold('l');
    assert.equal(heroGoldObject(game), null);
    assert.equal(engulfer.minvent.includes(purse), true);
    assert.equal(purse.where, 'minvent');
    assert.equal(purse.quantity, 29);
});
void test('an up-thrown purse announces the ceiling bounce and helmet save', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(31, 29031);
    const helmet = await addInventoryObject(HELMET, {
        invlet: 'a', worn: true, owornmask: W_ARMH,
    });
    game.uarmh = game.u.uarmh = helmet;
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    initRng(29032n);
    await throwGold('<', ' ');
    const text = messages.join('\n') + '\n' + game._pending_message;
    assert.match(text, /The gold hits the ceiling, then falls back on top of your head\./);
    assert.match(text, /Fortunately, you are wearing a helm\!/);
    assert.deepEqual([purse.ox, purse.oy], [10, 10]);
});
void test('a down-thrown purse announces the surface it lands on', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    level.requireAt(10, 10).typ = ICE;
    const purse = await carriedGold(37, 29033);
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    initRng(29034n);
    await throwGold('>');
    assert.match(messages.join('\n') + '\n' + game._pending_message, /The gold hits the ice\./);
    assert.deepEqual([purse.ox, purse.oy], [10, 10]);
});
void test('swallowed gold vanishes into the digesting engulfer by name', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(29, 29035);
    const engulfer = await createMonsterAt('purple worm', 10, 10);
    game.u.uswallow = true;
    game.u.ustuck = engulfer;
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    initRng(29036n);
    await throwGold('l');
    assert.match(messages.join('\n') + '\n' + game._pending_message, /The gold disappears into the purple worm's entrails\./);
    assert.equal(engulfer.minvent.includes(purse), true);
});
void test('a purse too heavy for the hero drops at the hero\'s feet', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const purse = await carriedGold(25000, 29037);
    initRng(29038n);
    await throwGold('l');
    assert.equal(purse.quantity, 25000);
    assert.deepEqual([purse.ox, purse.oy], [10, 10]);
    assert.equal(floorObjectsAt(level, 10, 10).includes(purse), true);
});
//# sourceMappingURL=gold_throw.test.js.map