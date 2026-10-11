import { requireScreenRow } from './support/screen.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRE_TRAP, NO_MINVENT, PIT, ROOM, RLOC_MSG, RLOC_NOMSG, RLOC_NONE, STRAT_APPEARMSG } from '../js/const.js';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { flush_screen, pline } from '../js/display.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { linkCreatedObjectToMonsterInventory } from '../js/monster_inventory.js';
import { APPLE, ARROW, DAGGER, DIAMOND } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { relocateMonsterTo, moveHeroByTeleport } from '../js/teleport.js';
import { maketrap } from '../js/mklev.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('relocating an engulfer carries its swallowed hero without releasing the hold', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    game.u.ux = worm.mx;
    game.u.uy = worm.my;
    game.u.ux0 = 10;
    game.u.uy0 = 10;
    game.u.ustuck = worm;
    game.u.uswallow = 1;
    game.u.uswldtim = 8;
    await relocateMonsterTo(worm, 16, 10);
    assert.deepEqual([game.u.ux, game.u.uy], [16, 10]);
    assert.ok(game.u.ustuck === worm);
    assert.equal(!!game.u.uswallow, true);
    assert.equal(game.u.uswldtim, 8);
    assert.deepEqual([game.u.ux0, game.u.uy0], [10, 10]);
});
void test('a relocated holder keeps an adjacent grip but releases a distant hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const owlbear = await createMonsterAt('owlbear', 11, 10);
    game.u.ustuck = owlbear;
    owlbear.mspec_used = 0;
    await relocateMonsterTo(owlbear, 11, 11);
    assert.ok(game.u.ustuck === owlbear);
    await relocateMonsterTo(owlbear, 16, 10);
    assert.ok(game.u.ustuck === null);
    assert.ok(owlbear.mspec_used > 0, 'the released holder cannot immediately grab again');
});
void test('relocation updates a monster’s perceived position of a visible hero', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    const orc = await createMonsterAt('hill orc', 11, 10);
    orc.mux = 10;
    orc.muy = 10;
    await moveHeroByTeleport(18, 10);
    await relocateMonsterTo(orc, 15, 10);
    assert.deepEqual([orc.mux, orc.muy], [18, 10]);
});
void test('relocation clears stale trapping but a same-square request does not attempt escape', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const orc = await createMonsterAt('hill orc', 11, 10);
    await maketrap(11, 10, PIT);
    orc.mtrapped = 1;
    const unchanged = await relocateMonsterTo(orc, 11, 10);
    assert.equal(unchanged.moved, false);
    assert.equal(!!orc.mtrapped, true);
    await relocateMonsterTo(orc, 16, 10);
    assert.equal(!!orc.mtrapped, false);
});
async function topline() {
    await flush_screen();
    return requireScreenRow(0).map(cell => cell.ch).join('').trim();
}
void test('a visible relocation describes arrival next to the hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const orc = await createMonsterAt('hill orc', 15, 10);
    await relocateMonsterTo(orc, 11, 10, { flags: RLOC_MSG });
    assert.equal(await topline(), 'The hill orc vanishes and reappears next to you.');
});
void test('a visible relocation beyond nearby range describes movement farther away', async () => {
    freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    const orc = await createMonsterAt('hill orc', 15, 10);
    await relocateMonsterTo(orc, 24, 10, { flags: RLOC_MSG });
    assert.equal(await topline(), 'The hill orc vanishes and reappears farther away.');
});
void test('an unseen marked arrival is introduced once with an indefinite name', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = ROOM;
    const orc = await createMonsterAt('hill orc', 30, 10);
    orc.mstrategy = (orc.mstrategy ?? 0) | STRAT_APPEARMSG;
    await relocateMonsterTo(orc, 11, 10, { flags: RLOC_NONE });
    assert.equal(await topline(), 'A hill orc suddenly appears next to you!');
    assert.equal((orc.mstrategy ?? 0) & STRAT_APPEARMSG, 0);
});
for (const mode of ['suppressed', 'level generation']) {
    void test(`${mode} relocation does not announce a marked arrival`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        level.requireAt(30, 10).typ = ROOM;
        const orc = await createMonsterAt('hill orc', 30, 10);
        orc.mstrategy = (orc.mstrategy ?? 0) | STRAT_APPEARMSG;
        game.in_mklev = mode === 'level generation';
        await relocateMonsterTo(orc, 11, 10, {
            flags: mode === 'suppressed' ? RLOC_MSG | RLOC_NOMSG : RLOC_MSG,
        });
        assert.equal(await topline(), '');
        assert.ok((orc.mstrategy ?? 0) & STRAT_APPEARMSG);
    });
}
void test('vanishing waits for the previous topline before changing the map', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = ROOM;
    const orc = await createMonsterAt('hill orc', 11, 10);
    await pline('You pause to watch the orc standing beside the corridor wall.');
    const input = resetInputState();
    let positionAtMore;
    input.beforeRead = () => { positionAtMore = [orc.mx, orc.my]; };
    input.feed(' ');
    await relocateMonsterTo(orc, 30, 10, { flags: RLOC_MSG });
    assert.deepEqual(positionAtMore, [11, 10]);
    assert.deepEqual([orc.mx, orc.my], [30, 10]);
    assert.equal(await topline(), 'The hill orc vanishes!');
});
void test('relocation exposes a concealed monster when its new square has no cover', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await floorObject(APPLE, 11, 10);
    const spider = await createMonsterAt('cave spider', 11, 10);
    spider.mundetected = 1;
    await relocateMonsterTo(spider, 15, 10);
    assert.equal(!!spider.mundetected, false);
});
for (const { species, peaceful, asleep, hallucinating, interrupted } of [
    { species: 'hill orc', peaceful: false, interrupted: true },
    { species: 'hill orc', peaceful: true, interrupted: false },
    { species: 'hill orc', peaceful: false, asleep: true, interrupted: true },
    { species: 'acid blob', peaceful: false, interrupted: false },
    { species: 'gas spore', peaceful: false, interrupted: false },
    { species: 'acid blob', peaceful: true, hallucinating: true, interrupted: true },
]) {
    void test(`${asleep ? 'sleeping ' : ''}${peaceful ? 'peaceful' : 'hostile'} ${species} ${interrupted ? 'interrupts' : 'does not interrupt'} searching on relocation${hallucinating ? ' while the hero hallucinates' : ''}`, async () => {
        freshObjectRoom({ right: 30 });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 26, 10);
        monster.mpeaceful = peaceful;
        monster.msleeping = !!asleep;
        pushKeys('5s');
        await rhack(0);
        assert.ok(game._occupation, 'counted searching starts an occupation');
        if (hallucinating)
            game.u.hallucinationTurns = 10;
        await relocateMonsterTo(monster, 12, 10);
        assert.equal(!!game._occupation, !interrupted);
        if (interrupted)
            assert.equal(await topline(), 'You stop searching.');
    });
}
void test('a resident keeper becomes angry when relocated out of its shop', async () => {
    freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12, keeperY: 10 });
    const dagger = await addInventoryObject(DAGGER);
    dagger.unpaid = true;
    shopkeeper.eshk.bill = [{ bo_id: dagger.o_id, bquan: 1, useup: false, price: 40 }];
    shopkeeper.eshk.billct = 1;
    shopkeeper.eshk.debit = 10;
    shopkeeper.eshk.credit = 5;
    await relocateMonsterTo(shopkeeper, 13, 10);
    assert.ok(shopkeeper.mpeaceful, 'moving inside its own shop is not an offense');
    await relocateMonsterTo(shopkeeper, 20, 10);
    assert.equal(!!shopkeeper.mpeaceful, false);
    assert.equal(shopkeeper.eshk.following, 1);
    assert.equal(shopkeeper.eshk.robbed, 45);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(!!dagger.unpaid, false);
});
void test('goods carried out of a shop settle only billed items and clear no-charge marks', async () => {
    freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12, keeperY: 10 });
    const orc = await createMonsterAt('hill orc', 13, 10);
    const billed = await knownObject(DAGGER);
    const own = await knownObject(ARROW, { no_charge: true });
    const stock = await knownObject(APPLE);
    for (const object of [billed, own, stock])
        await linkCreatedObjectToMonsterInventory(orc, object, { atFront: false });
    billed.unpaid = true;
    shopkeeper.eshk.bill = [{ bo_id: billed.o_id, bquan: 1, useup: false, price: 40 }];
    shopkeeper.eshk.billct = 1;
    await relocateMonsterTo(orc, 20, 10);
    assert.equal(shopkeeper.eshk.debit, 40);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(!!billed.unpaid, false);
    assert.equal(!!own.no_charge, false);
    assert.equal(stock.where, 'minvent');
    assert.match(await topline(), /^You owe .* 40 zorkmids for it!$/);
});
void test('goods moved between shops keep their original bill and no-charge marks', async () => {
    freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12, keeperY: 10 });
    await createStaffedShop({ left: 19, right: 25, keeperX: 22, keeperY: 10 });
    const orc = await createMonsterAt('hill orc', 13, 10);
    const billed = await knownObject(DAGGER);
    const own = await knownObject(ARROW, { no_charge: true });
    for (const object of [billed, own])
        await linkCreatedObjectToMonsterInventory(orc, object, { atFront: false });
    billed.unpaid = true;
    shopkeeper.eshk.bill = [{ bo_id: billed.o_id, bquan: 1, useup: false, price: 40 }];
    shopkeeper.eshk.billct = 1;
    await relocateMonsterTo(orc, 20, 10);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(!!billed.unpaid, true);
    assert.equal(!!own.no_charge, true);
});
void test('an untrapped monster does not trigger a trap merely by relocating onto it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const orc = await createMonsterAt('hill orc', 11, 10);
    await maketrap(15, 10, PIT);
    const hp = orc.mhp;
    await relocateMonsterTo(orc, 15, 10);
    assert.equal(!!orc.mtrapped, false);
    assert.equal(orc.mhp, hp);
});
void test('an already trapped giant can climb out of the pit at its relocation destination', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('hill giant', 11, 10);
    await maketrap(11, 10, PIT);
    giant.mtrapped = 1;
    const pit = await maketrap(15, 10, PIT);
    assert.ok(pit);
    await relocateMonsterTo(giant, 15, 10);
    assert.equal(!!giant.mtrapped, false);
    assert.ok(pit.tseen);
    assert.equal(await topline(), 'The hill giant climbs easily out of the pit.');
});
void test('relocating a trapped long worm does not run a head-only trap escape', async () => {
    freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 14, 10);
    assert.ok(worm.wormno);
    await maketrap(14, 10, PIT);
    worm.mtrapped = 1;
    await relocateMonsterTo(worm, 20, 10);
    assert.ok(worm.mtrapped);
});
void test('a relocated shopkeeper reports both its move and anger', async () => {
    freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12, keeperY: 10 });
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    input.feed('    ');
    await relocateMonsterTo(shopkeeper, 20, 10, { flags: RLOC_MSG });
    messages.push(await topline());
    const displayed = messages.join('\n');
    assert.match(displayed, /vanishes and reappears farther away\./);
    assert.match(displayed, /gets angry!/);
    assert.equal(!!shopkeeper.mpeaceful, false);
});
void test('a unicorn gift reports one relocation after its acceptance', async () => {
    freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    const unicorn = await createMonsterAt('gray unicorn', 11, 10);
    unicorn.mpeaceful = 0;
    const gem = await addInventoryObject(DIAMOND);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    initRng(1n);
    await throwInventoryObject(gem, 'l', [' ', ' ', ' ']);
    messages.push(await topline());
    const displayed = messages.join('\n');
    assert.match(displayed, /accepts your gift/);
    assert.equal((displayed.match(/vanishes/g) || []).length, 1);
    assert.ok(unicorn.mpeaceful);
    assert.equal(gem.where, 'minvent');
});
void test('a Tengu reaches its landing fire only after its teleport message is acknowledged', async () => {
    freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10 });
    requirePlayingGame(game);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const tengu = await createMonsterAt('tengu', 14, 10, NO_MINVENT);
    tengu.mpeaceful = 0;
    tengu.mcan = 0;
    tengu.msleeping = 0;
    tengu.movement = 12;
    tengu.mhp = 100;
    tengu.mhpmax = 100;
    await maketrap(11, 10, FIRE_TRAP);
    const input = resetInputState();
    const pages = [];
    const commands = ['m', '.'];
    let commandIndex = 0;
    input.beforeRead = () => {
        const line = requireScreenRow(0).map(cell => cell.ch).join('');
        const more = line.includes('--More--');
        if (more)
            pages.push({ message: line, hp: tengu.mhp });
        const response = more ? ' ' : commands[commandIndex++ % commands.length];
        assert.ok(response !== undefined);
        input.feed(response);
    };
    initRng(5n);
    await moveloop_core();
    await moveloop_core();
    const relocation = pages.find(page => /vanishes and reappears/.test(page.message));
    assert.ok(relocation, 'the teleport line waits for acknowledgement before the flame line');
    assert.equal(relocation.hp, 100);
    assert.deepEqual([tengu.mx, tengu.my], [11, 10]);
    assert.ok(tengu.mhp < 100, 'the ordinary movement tail still triggers the landing fire');
});
//# sourceMappingURL=monster_relocation.test.js.map