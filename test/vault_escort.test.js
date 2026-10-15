import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { CORR, ROOMOFFSET, STONE, VAULT, VWALL, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { monsterGoldAmount } from '../js/shop_money.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng, rn2 } from '../js/rng.js';
import { moveHeroByTeleport } from '../js/teleport.js';
import { finishTeleportArrival } from '../js/location_effects.js';
import { moveVaultGuard } from '../js/vault.js';
import { runMonsterAction } from '../js/monmove.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';
async function escort() {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.flags.rndmongen = false;
    const vault = createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT });
    level.rooms = [vault];
    level.nroom = 1;
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const guard = await createMonsterAt('guard', 11, 10, NO_MINVENT);
    guard.isgd = 1;
    guard.mpeaceful = 1;
    guard.msleeping = 0;
    guard._egd = {
        gdlevel: { ...game.u.uz }, vault, gddone: 0,
        ogx: 11, ogy: 10, gdx: 16, gdy: 10, warncnt: 1, dropgoldcnt: 1,
        fcbeg: 0, fcend: 1, fakecorr: [{ x: 11, y: 10, typ: VWALL, flags: 0 }],
    };
    const input = resetInputState();
    input.beforeRead = () => {
        const top = game.nhDisplay?.grid.slice(0, 3).map(row => row.map(cell => cell.ch).join('')).join('') ?? '';
        input.feed(top.includes('--More--') ? ' ' : '.');
    };
    return { level, guard };
}
void test('a guard eventually attacks a hero who keeps the vault gold through repeated turns', async () => {
    const { guard } = await escort();
    setHeroGoldAmount(game, 50);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    for (let turn = 0; turn < 10 && guard.mpeaceful; turn++)
        await moveloop_core();
    assert.equal(guard.mpeaceful, 0);
});
void test('an escort recovers dropped corridor gold without advancing past the hero', async () => {
    const { level, guard } = await escort();
    assert.ok(guard._egd);
    guard.mx = guard._egd.ogx = 13;
    guard._egd.fcend = 3;
    guard._egd.fakecorr.push({ x: 12, y: 10, typ: STONE, flags: 0 }, { x: 13, y: 10, typ: STONE, flags: 0 });
    for (let x = 11; x <= 13; x++)
        level.requireAt(x, 10).typ = CORR;
    game.u.ux = 12;
    const coins = await floorObject(GOLD_PIECE, 12, 10, { quan: 71 });
    await moveVaultGuard(guard, game, rn2);
    assert.equal(coins.where, 'minvent');
    assert.equal(monsterGoldAmount(guard), 71);
    assert.equal(guard.mx, 13);
    assert.equal(guard._egd.warncnt, 5);
});
void test('recovering unseen gold gives a telepathically sensed guard the same hallucinated appearance as waiting', async () => {
    const appearanceAfterTurn = async (pickup) => {
        const { level, guard } = await escort();
        requirePlayingGame(game);
        assert.ok(guard._egd);
        guard._egd.fcend = 2;
        guard._egd.fakecorr.push({ x: 12, y: 10, typ: STONE, flags: 0 });
        level.requireAt(12, 10).typ = CORR;
        game.u.ux = 9;
        game.blind = true;
        game.u.blindTurns = 20;
        game.u.telepathy = true;
        game.u.hallucinationTurns = 20;
        vision_recalc(0);
        const coins = pickup
            ? await floorObject(GOLD_PIECE, guard.mx, guard.my, { quan: 71 })
            : await knownObject(GOLD_PIECE, { quan: 71 });
        if (!pickup)
            await addObjectToMonsterInventory(guard, coins);
        initRng(1n);
        newsym(guard.mx, guard.my);
        assert.equal(cansee(guard.mx, guard.my), false);
        await runMonsterAction(guard, game);
        assert.equal(coins.where, 'minvent');
        assert.equal(monsterGoldAmount(guard), 71);
        assert.equal(guard.mx, 11);
        const appearance = glyphAt(guard.mx, guard.my);
        assert.ok(appearance?.kind === 'monster');
        return appearance.mnum;
    };
    const waitingAppearance = await appearanceAfterTurn(false);
    const pickupAppearance = await appearanceAfterTurn(true);
    assert.equal(pickupAppearance, waitingAppearance, 'Unseen gold must not add an extra hallucinated appearance change.');
});
void test('a finished parked escort removes its corridor on a later world turn', async () => {
    const { level, guard } = await escort();
    assert.ok(guard._egd);
    guard.mx = guard.my = 0;
    guard._egd.ogx = guard._egd.ogy = 0;
    guard._egd.gddone = 1;
    guard._egd.fcend = 2;
    guard._egd.fakecorr.push({ x: 12, y: 10, typ: STONE, flags: 0 });
    level.requireAt(12, 10).typ = CORR;
    game.u.ux = 14;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    await moveloop_core();
    await moveloop_core();
    assert.equal(level.monsters.includes(guard), false);
    assert.equal(level.requireAt(12, 10).typ, STONE);
});
void test('teleporting away with vault gold releases an angry guard immediately', async () => {
    const { guard } = await escort();
    setHeroGoldAmount(game, 50);
    const movement = await moveHeroByTeleport(15, 10);
    await finishTeleportArrival(movement);
    assert.equal(guard.mpeaceful, 0);
});
void test('teleporting into rock blocks levitation before the vault guard reacts', async () => {
    const { level, guard } = await escort();
    game.flags.debug = true;
    game.flags.tips = false;
    game.flags.verbose = false;
    installPolymorphedHero('xorn');
    grantIntrinsicProperty('levitation', 'outside');
    setHeroGoldAmount(game, 50);
    level.requireAt(15, 10).typ = STONE;
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        const message = game.nhDisplay?.grid.slice(0, 3)
            .map(row => row.map(cell => cell.ch).join('')).join('') ?? '';
        messages.push(message);
        input.feed(message.includes('Where do you want to be teleported') ? 'lllll.' : ' ');
    };
    await rhack(20);
    messages.push(game._pending_message);
    const text = messages.join('\n');
    const terrain = text.indexOf("You can't levitate in here.");
    const alarm = text.search(/guard becomes irate|angry guard|angry shouting/);
    assert.ok(terrain >= 0 && alarm > terrain, `Terrain feedback must precede the guard's reaction:\n${text}`);
    assert.equal(game.u.ux, 15);
    assert.equal(game.u.levitation, false);
    assert.equal(guard.mpeaceful, 0);
});
void test('a live parked guard reports its invalid map update before other monsters act', async () => {
    const { level, guard } = await escort();
    requirePlayingGame(game);
    assert.ok(guard._egd);
    guard.mx = guard._egd.ogx = 13;
    guard._egd.fcend = 3;
    guard._egd.fakecorr.push({ x: 12, y: 10, typ: STONE, flags: 0 }, { x: 13, y: 10, typ: STONE, flags: 0 });
    for (let x = 8; x <= 11; x++) {
        for (let y = 8; y <= 11; y++) {
            if (x === 8 || x === 11 || y === 8 || y === 11)
                level.requireAt(x, y).typ = VWALL;
        }
    }
    for (let x = 11; x <= 13; x++)
        level.requireAt(x, 10).typ = CORR;
    game.u.ux = 12;
    const input = resetInputState();
    const turn = runMonsterAction(guard, game);
    const paused = await Promise.race([
        turn.then(() => false), input.waitUntilBlocked().then(() => true),
    ]);
    try {
        assert.equal(paused, true, 'A live parked guard must acknowledge its disappearance before continuing.');
        const message = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '';
        assert.match(message, /Suddenly, the guard disappears\.--More--/);
        assert.equal(guard.mx, 0);
        assert.ok(guard.mhp > 0);
        input.feed(' ');
        await input.waitUntilBlocked();
        const diagnostic = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '';
        assert.match(diagnostic, /newsym: attempting screen update for <0,0>/);
    }
    finally {
        input.beforeRead = () => input.feed(' ');
        input.feed(' ');
        await turn;
    }
});
//# sourceMappingURL=vault_escort.test.js.map