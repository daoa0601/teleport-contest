import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { AIR, COLNO, NO_MINVENT, ROWNO, WATER } from '../js/const.js';
import { moveElementalBubbles } from '../js/elemental.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { generateWaterLevel } from '../js/mklev.js';
import { CRYSKNIFE, WORM_TOOTH } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { floorObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshSpecialLevel } from './support/special-level.js';
import { createSpecialLevel } from './support/topology.js';
import { memoryStorage } from './support/memory-storage.js';
async function waterPlane() {
    const active = freshSpecialLevel({ prototype: 'water', seed: 1907, depth: 2 });
    requirePlayingGame(game);
    game.water_level = createSpecialLevel({ ...game.u.uz });
    game.specialLevels = new Map([['astral', createSpecialLevel({ dnum: 0, dlevel: 1 })]]);
    await generateWaterLevel(active);
    game.in_mklev = false;
    game.u.uz0 = { ...game.u.uz };
    game.level.monsters = [];
    const bubble = game.level.elementalBubbles?.[0];
    assert.ok(bubble);
    game.level.elementalBubbles = [bubble];
    bubble.x = 20;
    bubble.y = 10;
    bubble.width = 2;
    bubble.height = 1;
    bubble.rows = [3];
    bubble.dx = 1;
    bubble.dy = 0;
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            game.level.requireAt(x, y).typ = WATER;
    game.level.requireAt(20, 10).typ = AIR;
    game.level.requireAt(21, 10).typ = AIR;
    game.u.ux = 20;
    game.u.uy = 10;
    return bubble;
}
void test('a water bubble transports a floor crysknife and can revert it to a worm tooth', async () => {
    const bubble = await waterPlane();
    requirePlayingGame(game);
    initRng(2n);
    const knife = await floorObject(CRYSKNIFE, 20, 10, {
        initialize: false, oerodeproof: true,
    });
    assert.equal(knife.otyp, CRYSKNIFE, 'the fixed knife survives its initial floor placement');
    initRng(1n);
    await moveElementalBubbles();
    assert.equal(knife.otyp, WORM_TOOTH, 'bubble placement applies the fixed knife reversion chance');
    assert.equal(knife.oerodeproof, false);
    assert.equal(knife.where, 'floor');
    assert.equal(knife.ox, bubble.x);
    assert.equal(knife.oy, bubble.y);
    assert.ok(game.level.objects[bubble.x]?.[bubble.y]?.includes(knife));
    assert.ok(!game.level.objects[20]?.[10]?.includes(knife), 'the old floor pile no longer owns the knife');
});
void test('a water bubble carries a mounted hero and exposes their hiding place', async () => {
    const bubble = await waterPlane();
    requirePlayingGame(game);
    const horse = await createMonsterAt('horse', 20, 10, NO_MINVENT);
    game.u.usteed = horse;
    game.u.uundetected = 1;
    initRng(2n);
    await moveElementalBubbles();
    assert.equal(game.u.ux, bubble.x);
    assert.equal(game.u.uy, bubble.y);
    assert.deepEqual([horse.mx, horse.my], [game.u.ux, game.u.uy], 'the mount follows the transported rider');
    assert.equal(game.u.uundetected, 0, 'arrival at a new position reveals the hero');
});
void test('a swallowed hero travels with the monster carried by a water bubble', async () => {
    const bubble = await waterPlane();
    const swallower = await createMonsterAt('purple worm', 20, 10, NO_MINVENT);
    installSwallowedHero(swallower);
    initRng(2n);
    await moveElementalBubbles();
    assert.equal(swallower.mx, bubble.x);
    assert.equal(swallower.my, bubble.y);
    assert.deepEqual([game.u.ux, game.u.uy], [swallower.mx, swallower.my], 'swallowing remains attached during transport');
    assert.equal(game.u.ustuck, swallower);
});
void test('walking inside a water bubble can steer its next drift', async () => {
    const bubble = await waterPlane();
    requirePlayingGame(game);
    bubble.width = 3;
    bubble.height = 2;
    bubble.rows = [7, 7];
    for (let x = 20; x <= 22; x++)
        for (let y = 10; y <= 11; y++)
            game.level.requireAt(x, y).typ = AIR;
    game.u.ux = 21;
    initRng(2n);
    await moveElementalBubbles();
    for (let attempt = 0; attempt < 20 && bubble.dx !== -1; attempt++) {
        await rhack('h'.charCodeAt(0));
        if (bubble.dx !== -1)
            await rhack('l'.charCodeAt(0));
    }
    assert.equal(bubble.dx, -1, 'a successful westward step can turn the occupied bubble west');
    assert.equal(bubble.dy, 0);
});
void test('restoring a water level applies the initial border bounce to its bubbles', async () => {
    const bubble = await waterPlane();
    requirePlayingGame(game);
    bubble.x = 4;
    bubble.dx = -1;
    game.plname = 'BubbleSaver';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('BubbleSaver', storage), true);
    const restored = game.level.elementalBubbles?.[0];
    assert.ok(restored);
    assert.equal(restored.x, 4, 'restoration paints the bubble without translating it');
    assert.equal(restored.dx, 1, 'the initial draw bounces a bubble touching the western border');
    assert.equal(game.level.requireAt(4, 10).typ, AIR);
});
void test('the initial water plane remembers water beyond its bubbles', async () => {
    await waterPlane();
    requirePlayingGame(game);
    const memory = game.level.requireAt(1, 0).remembered_glyph;
    assert.ok(memory?.kind === 'terrain');
    assert.equal(memory.terrainName, 'water');
});
void test('water replacing a moving bubble clears the old terrain flags', async () => {
    await waterPlane();
    requirePlayingGame(game);
    const oldCell = game.level.requireAt(20, 10);
    oldCell.candig = true;
    oldCell.altarmask = 7;
    initRng(2n);
    await moveElementalBubbles();
    assert.equal(oldCell.typ, WATER);
    assert.equal(!!oldCell.candig, false, 'water cannot retain the digging exception of a former trapdoor');
    assert.equal(oldCell.altarmask, 0, 'the replacement cell has no former altar alignment');
});
//# sourceMappingURL=elemental_transport.test.js.map