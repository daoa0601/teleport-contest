import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactByName } from '../js/artifacts.js';
import { invokeArtifactPower } from '../js/artifact_invoke.js';
import { LANDMINE } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount } from '../js/hero_gold.js';
import { freeInventoryObject } from '../js/hero_inventory.js';
import { consumeInventoryItem } from '../js/invent.js';
import { resetInputState } from '../js/input.js';
import { doneObjectCleanup } from '../js/object_cleanup.js';
import { GOLD_PIECE, POT_HEALING, SCR_IDENTIFY } from '../js/object_data.js';
import { propertyIsActive } from '../js/properties.js';
import { addInventoryItem } from '../js/u_init.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';

void test('consuming the last item after game over deletes its actual inventory identity', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_HEALING, { in_use: true });
    game.program_state.gameover = true;

    await consumeInventoryItem(potion);

    assert.equal(game.inventory.includes(potion), false);
    assert.equal(potion.where, 'gone');
});

void test('postmortem object cleanup consumes active items and one unit of an active stack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_HEALING, { in_use: true });
    const scrolls = await addInventoryObject(SCR_IDENTIFY, { in_use: true, quan: 3 });
    const spare = await addInventoryObject(POT_HEALING, { blessed: true });
    game.program_state.gameover = true;

    await doneObjectCleanup();

    assert.equal(potion.where, 'gone');
    assert.equal(game.inventory.includes(potion), false);
    assert.equal(scrolls.where, 'inventory');
    assert.equal(scrolls.quan, 2);
    assert.equal(scrolls.quantity, 2);
    assert.equal(scrolls.in_use, false);
    assert.equal(spare.where, 'inventory');
    assert.equal(spare.quan, 1);
});

async function invokedHeart() {
    freshObjectRoom({ role: 'barbarian', gameplaySeed: 37n,
        flags: { disclose: '-i -a -v -c -o' } });
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /float|levitat|ground|land|mine|explos|pit|die|Goodbye|points|experience|REST|PEACE/i,
        limit: 24,
    });
    const heart = await artifactObject('The Heart of Ahriman');
    await addInventoryItem(heart);
    const artifact = artifactByName('The Heart of Ahriman');
    assert.ok(artifact);
    await invokeArtifactPower(heart, artifact);
    assert.equal(propertyIsActive('levitation'), true);
    assert.equal(game.u.moreluck, 3);
    return heart;
}

void test('postmortem artifact removal completes carried luck and invocation cleanup', async () => {
    const heart = await invokedHeart();
    requirePlayingGame(game);
    game.program_state.gameover = true;

    await consumeInventoryItem(heart);

    assert.equal(heart.where, 'gone');
    assert.equal(propertyIsActive('levitation'), false);
    assert.equal(game.u.moreluck, 0);
    assert.equal(game.u.uhave.questart, false);
});

void test('a new fatal landing during carried artifact removal interrupts consumption', async () => {
    const heart = await invokedHeart();
    requirePlayingGame(game);
    game.u.uhp = 1;
    game.u.uhpmax = 1;
    game.storage = memoryStorage();
    addTrap(game.level, LANDMINE, game.u.ux, game.u.uy, { tseen: true });

    await consumeInventoryItem(heart);

    assert.equal(game.program_state.gameover, true);
    assert.equal(game.inventory.includes(heart), false);
    assert.equal(heart.where, 'free', 'A fatal carried effect must stop before object deletion');
});

void test('freeing carried coins removes the purse and updates the displayed gold', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const coins = await addInventoryObject(GOLD_PIECE, { quan: 237 });
    await flush_screen(1);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\$:237\b/);

    await freeInventoryObject(coins);

    assert.equal(coins.where, 'free');
    assert.equal(coins.quan, 237);
    assert.equal(heroGoldAmount(game), 0);
    await flush_screen(1);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\$:0\b/);
});
