import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { BURN, ENGRAVE, HEADSTONE, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import { initializePet } from '../js/dog.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { angerMonster, wakeMonster } from '../js/monster_anger.js';
import { DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function topline() {
    await flush_screen();
    const row = requireGameDisplay().grid[0];
    assert.ok(row, 'the display has a message row');
    return row.map(cell => cell.ch).join('').trimEnd();
}
void test('attacking from a completed Elbereth engraving breaks the protection and costs alignment', async () => {
    freshObjectRoom({ hero: { uhitinc: 30, ualign: { type: 0, record: 10 } } });
    requirePlayingGame(game);
    const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    target.mpeaceful = 0;
    target.mhp = target.mhpmax = 100;
    makeEngravingAt(10, 10, 'Elbereth');
    initRng(1n);
    pushKeys(' '.repeat(30));
    await rhack('l'.charCodeAt(0));
    assert.ok(target.mhp < 100, 'the public command attacked the target');
    assert.equal(engravingAt(10, 10), null);
    assert.equal(game.u.ualign.record, 5);
});
for (const peaceful of [false, true]) {
    void test(`an Elbereth-immune human ${peaceful ? 'still punishes hypocrisy while peaceful' : 'does not punish an attack while hostile'}`, async () => {
        freshObjectRoom({ hero: { ualign: { type: 0, record: 10 } } });
        requirePlayingGame(game);
        const target = await createMonsterAt('human', 11, 10, NO_MINVENT);
        target.mpeaceful = peaceful ? 1 : 0;
        const engraving = makeEngravingAt(10, 10, 'eLbErEtH');
        target.mstrategy = (target.mstrategy ?? 0) | STRAT_WAITFORU;
        pushKeys(' '.repeat(20));
        await angerMonster(target, { attacked: true });
        assert.equal(engravingAt(10, 10), peaceful ? null : engraving);
        assert.equal(game.u.ualign.record, peaceful ? 4 : 10);
        assert.equal((target.mstrategy ?? 0) & STRAT_WAITFORU, 0);
        assert.equal(target.mpeaceful, 0);
    });
}
for (const engravingCase of ['headstone', 'unfinished', 'extra text']) {
    void test(`an attack does not treat a ${engravingCase} engraving as Elbereth protection`, async () => {
        freshObjectRoom({ hero: { ualign: { type: 0, record: 10 } } });
        requirePlayingGame(game);
        const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        target.mpeaceful = 0;
        const engraving = makeEngravingAt(10, 10, engravingCase === 'extra text' ? 'Elbereth watches' : 'Elbereth', null, engravingCase === 'unfinished' ? game.moves + 1 : game.moves, engravingCase === 'headstone' ? HEADSTONE : ENGRAVE);
        await angerMonster(target, { attacked: true });
        assert.equal(engravingAt(10, 10), engraving);
        assert.equal(game.u.ualign.record, 10);
    });
}
void test('non-attack anger leaves the hero engraving and its protection alone', async () => {
    freshObjectRoom({ hero: { ualign: { type: 0, record: 10 } } });
    requirePlayingGame(game);
    const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    target.mpeaceful = 0;
    const engraving = makeEngravingAt(10, 10, 'Elbereth');
    await angerMonster(target);
    assert.equal(engravingAt(10, 10), engraving);
    assert.equal(game.u.ualign.record, 10);
});
for (const asleep of [false, true]) {
    void test(`a missed attack ${asleep ? 'leaves a sleeping target and the engraving alone' : 'angers an awake target and breaks Elbereth'}`, async () => {
        freshObjectRoom({ hero: { uhitinc: -100, ualign: { type: 0, record: 10 } } });
        requirePlayingGame(game);
        const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        target.mpeaceful = 0;
        target.msleeping = asleep ? 1 : 0;
        const health = target.mhp;
        const engraving = makeEngravingAt(10, 10, 'Elbereth', null, 0, BURN);
        initRng(1n);
        pushKeys(' '.repeat(20));
        await rhack('l'.charCodeAt(0));
        assert.equal(target.mhp, health, 'the attack missed');
        assert.equal(Boolean(target.msleeping), asleep);
        assert.equal(engravingAt(10, 10), asleep ? engraving : null);
        assert.equal(game.u.ualign.record, asleep ? 10 : 5);
    });
}
void test('a blind hero hears the native unseen subject when a humanoid gets angry', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('gnome', 11, 10, NO_MINVENT);
    target.mpeaceful = 1;
    setHeroBlindnessTurns(5);
    vision_recalc(0);
    await angerMonster(target);
    assert.equal(await topline(), 'It gets angry!');
    assert.equal(target.mpeaceful, 0);
});
for (const lowAlignment of [false, true]) {
    void test(`Elbereth hypocrisy applies before a tame target's early return at ${lowAlignment ? 'low' : 'high'} alignment`, async () => {
        const initialAlignment = lowAlignment ? 3 : 10;
        freshObjectRoom({ hero: { ualign: { type: 0, record: initialAlignment } } });
        requirePlayingGame(game);
        const target = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
        initializePet(target);
        const tameness = target.mtame;
        makeEngravingAt(10, 10, 'Elbereth');
        initRng(1n);
        pushKeys(' '.repeat(10));
        await angerMonster(target, { attacked: true });
        assert.equal(engravingAt(10, 10), null);
        const penalty = initialAlignment - game.u.ualign.record;
        if (lowAlignment)
            assert.ok(penalty >= 1 && penalty <= 5);
        else
            assert.equal(penalty, 5);
        assert.equal(target.mtame, tameness);
        assert.equal(target.mpeaceful, 1);
    });
}
for (const attacked of [false, true]) {
    void test(`a shopkeeper outside the hero's shops ${attacked ? 'starts full pursuit when attacked' : 'does not pursue from ordinary waking'}`, async () => {
        freshObjectRoom({ right: 20 });
        requirePlayingGame(game);
        game.plname = 'Pursued';
        const { shopkeeper } = await createStaffedShop({
            left: 13, right: 18, top: 8, bottom: 12, keeperX: 14, keeperY: 10,
        });
        assert.equal(game.u.ushops.length, 0);
        const owned = await floorObject(DAGGER, 15, 10, { no_charge: true });
        assert.equal(Boolean(owned.no_charge), true);
        shopkeeper.mstrategy = (shopkeeper.mstrategy ?? 0) | STRAT_WAITFORU;
        pushKeys(' '.repeat(20));
        await wakeMonster(shopkeeper, { attacked });
        assert.equal(Boolean(shopkeeper.mpeaceful), !attacked);
        assert.equal(Boolean(shopkeeper.eshk.following), attacked);
        assert.equal(Boolean(shopkeeper.eshk.surcharge), attacked);
        assert.equal(Boolean(owned.no_charge), !attacked);
        if (attacked) {
            assert.equal(shopkeeper.eshk.customer, 'Pursued');
            assert.equal((shopkeeper.mstrategy ?? 0) & STRAT_WAITFORU, 0);
        }
    });
}
void test('direct shopkeeper anger clears waiting without pretending the keeper was woken', async () => {
    freshObjectRoom({ right: 20 });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({
        left: 13, right: 18, top: 8, bottom: 12, keeperX: 14, keeperY: 10,
    });
    shopkeeper.msleeping = 1;
    shopkeeper.mstrategy = (shopkeeper.mstrategy ?? 0) | STRAT_WAITFORU;
    pushKeys(' '.repeat(20));
    await angerMonster(shopkeeper, { attacked: true });
    assert.equal(shopkeeper.mpeaceful, 0);
    assert.equal(shopkeeper.msleeping, 1);
    assert.equal((shopkeeper.mstrategy ?? 0) & STRAT_WAITFORU, 0);
    assert.equal(Boolean(shopkeeper.eshk.following), false);
});
void test('the hypocrisy message waits before the alignment penalty and engraving deletion', async () => {
    freshObjectRoom({ hero: { ualign: { type: 0, record: 10 } } });
    requirePlayingGame(game);
    const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    target.mpeaceful = 0;
    target.mstrategy = (target.mstrategy ?? 0) | STRAT_WAITFORU;
    const engraving = makeEngravingAt(10, 10, 'Elbereth');
    await plineWithContinuation('An earlier message fills this line and waits for the next action to continue.');
    const input = resetInputState();
    const angering = angerMonster(target, { attacked: true });
    await input.waitUntilBlocked();
    assert.equal(engravingAt(10, 10), engraving);
    assert.equal(game.u.ualign.record, 10);
    assert.notEqual((target.mstrategy ?? 0) & STRAT_WAITFORU, 0);
    pushKeys(' '.repeat(10));
    await angering;
    assert.equal(engravingAt(10, 10), null);
    assert.equal(game.u.ualign.record, 5);
    assert.equal((target.mstrategy ?? 0) & STRAT_WAITFORU, 0);
});
//# sourceMappingURL=monster_anger.test.js.map