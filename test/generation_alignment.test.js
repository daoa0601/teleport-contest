import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CHAOTIC, A_LAWFUL, A_NEUTRAL } from '../js/const.js';
import { inducedAlignment, init_dungeons } from '../js/dungeon.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { freshGame } from './support/game-state.js';
import { memoryStorage } from './support/memory-storage.js';
async function loadDungeonGraph() {
    freshGame({ flags: { debug: true } });
    initRng(271n);
    await init_dungeons();
}
function specialLevel(name) {
    const level = game.specialLevels?.get(name);
    assert.ok(level, `Dungeon generation defines ${name}`);
    return level;
}
void test('Oracle and Medusa use their explicit special-level alignments', async () => {
    await loadDungeonGraph();
    requireFixtureGame(game);
    for (const [name, alignment] of [['oracle', A_NEUTRAL], ['medusa', A_CHAOTIC]]) {
        const { dnum, dlevel } = specialLevel(name);
        game.u.uz = { dnum, dlevel };
        for (let selection = 0; selection < 20; selection++)
            assert.equal(inducedAlignment(100), alignment, name);
    }
});
void test('Mines, Sokoban, and Vlad levels allow every random generation alignment', async () => {
    await loadDungeonGraph();
    requireFixtureGame(game);
    for (const name of ['minetn', 'soko1', 'tower1']) {
        const { dnum, dlevel } = specialLevel(name);
        game.u.uz = { dnum, dlevel };
        const choices = new Set();
        for (let selection = 0; selection < 100; selection++)
            choices.add(inducedAlignment(100));
        assert.equal(choices.size, 3, name);
    }
});
void test('ordinary Mines generation has no lawful alignment bias in the pinned build', async () => {
    await loadDungeonGraph();
    requireFixtureGame(game);
    const dnum = game.dungeons.findIndex(dungeon => dungeon.dname === 'The Gnomish Mines');
    game.u.uz = { dnum, dlevel: 1 };
    initRng(145n);
    let lawful = 0;
    const selections = 2000;
    for (let selection = 0; selection < selections; selection++)
        if (inducedAlignment(80) === A_LAWFUL)
            lawful++;
    assert.ok(lawful > selections * 0.28 && lawful < selections * 0.40, `lawful selections: ${lawful}/${selections}`);
});
void test('random selection still supplies every alignment on an unaligned level', async () => {
    await loadDungeonGraph();
    requireFixtureGame(game);
    game.u.uz = { dnum: 0, dlevel: 1 };
    initRng(145n);
    const choices = new Set();
    for (let selection = 0; selection < 100; selection++)
        choices.add(inducedAlignment(100));
    assert.equal(choices.size, 3);
    for (const alignment of choices)
        assert.ok([A_CHAOTIC, A_NEUTRAL, A_LAWFUL].includes(alignment));
});
void test('Tutorial inherits a chaotic generation bias from its unconnected flag', async () => {
    await loadDungeonGraph();
    requireFixtureGame(game);
    const { dnum, dlevel } = specialLevel('tut-1');
    game.u.uz = { dnum, dlevel };
    initRng(145n);
    let chaotic = 0;
    const selections = 2000;
    for (let selection = 0; selection < selections; selection++)
        if (inducedAlignment(80) === A_CHAOTIC)
            chaotic++;
    // The packed UNCONNECTED flag supplies the special-level bias only.
    assert.ok(chaotic > selections * 0.80 && chaotic < selections * 0.93, `chaotic selections: ${chaotic}/${selections}`);
});
void test('restored Oracle, Mines, and Tutorial retain their generation alignment rules', async () => {
    await loadDungeonGraph();
    requireFixtureGame(game);
    game.plname = 'GenerationAlignments';
    const { dnum, dlevel } = specialLevel('oracle');
    game.u.uz = { dnum, dlevel };
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    freshGame();
    initRng(145n);
    assert.equal(restoreGame('GenerationAlignments', storage), true);
    for (let selection = 0; selection < 20; selection++)
        assert.equal(inducedAlignment(100), A_NEUTRAL);
    game.u.uz = {
        dnum: game.dungeons.findIndex(dungeon => dungeon.dname === 'The Gnomish Mines'),
        dlevel: 1,
    };
    const choices = new Set();
    for (let selection = 0; selection < 100; selection++)
        choices.add(inducedAlignment(100));
    assert.equal(choices.size, 3);
    const tutorial = specialLevel('tut-1');
    game.u.uz = { dnum: tutorial.dnum, dlevel: tutorial.dlevel };
    for (let selection = 0; selection < 20; selection++)
        assert.equal(inducedAlignment(100), A_CHAOTIC);
});
//# sourceMappingURL=generation_alignment.test.js.map