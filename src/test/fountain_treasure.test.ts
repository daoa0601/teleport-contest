import type { GameObject } from '../js/object_types.js';
import { createDungeon } from './support/topology.js';
import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, F_LOOTED } from '../js/const.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DILITHIUM_CRYSTAL, GOLD_PIECE, LUCKSTONE, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function fountainUnderHero() {
    freshObjectRoom();
    requireFixtureGame(game);
    const fountain = game.level.requireAt(game.u.ux, game.u.uy);
    fountain.typ = FOUNTAIN;
    fountain.looted = 0;
    game.level.flags.nfountains = 1;
    // A town fountain warns on its first dry-up attempt and remains usable.
    game.level.flags.has_town = true;
    return fountain;
}

for (const command of ['drink', 'dip'] as const) {
    void test(`${command} discovers a real gem on the fountain floor`, async () => {
        const fountain = fountainUnderHero();
        requireFixtureGame(game);
        const stone = command === 'dip' ? await addInventoryObject(ROCK) : null;
        const input = resetInputState();
        input.feed(command === 'drink' ? 'y' + ' '.repeat(20) : '');
        // Select the gem discovery branch of drinkfountain or dipfountain.
        initRng(command === 'drink' ? 15n : 34n);
        if (command === 'drink') await rhack('q'.charCodeAt(0));
        else {
            assert.ok(stone, 'Dipping requires the inventory rock created for this case');
            await runExtendedCommand('dip', stone.invlet + 'y' + ' '.repeat(20));
        }

        const gems = floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy);
        assert.equal(gems.length, 1);
        assert.ok(gems[0]);
        assert.ok(gems[0].otyp >= DILITHIUM_CRYSTAL && gems[0].otyp < LUCKSTONE);
        assert.equal(gems[0].where, 'floor');
        assert.ok(Number(fountain.looted ?? 0) & F_LOOTED);
        assert.equal(game.context.move, 1);
    });
}

void test('dipping reveals coins before the discovery message waits for input', async () => {
    const fountain = fountainUnderHero();
    requireFixtureGame(game);
    const stone = await addInventoryObject(ROCK);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', ...{ num_dunlevs: 20 } })];
    const input = resetInputState();
    let visibleCoins: GameObject[] = [];
    input.beforeRead = () => {
        if (/coins glistening/.test(game._pending_message || '')) {
            visibleCoins = (floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy) || [])
                .filter(object => object.otyp === GOLD_PIECE);
        }
    };
    initRng(42n);

    await runExtendedCommand('dip', stone.invlet + 'y' + ' '.repeat(20));

    const coins = floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy)
        .filter(object => object.otyp === GOLD_PIECE);
    assert.equal(coins.length, 1);
    assert.ok(coins[0]);
    assert.equal(coins[0].where, 'floor');
    assert.ok(coins[0].quan >= 6 && coins[0].quan <= 31);
    assert.ok(Number(fountain.looted ?? 0) & F_LOOTED);
    assert.equal(visibleCoins?.length, 1);
});
