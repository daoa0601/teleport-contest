import assert from 'node:assert/strict';
import test from 'node:test';
import { COURT, THRONE } from '../js/const.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { CHEST, GOLD_PIECE, MACE } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { objectWeight } from '../js/weight.js';
import { freshGame } from './support/game-state.js';
import { floorObjects } from './support/level-state.js';
import { createDungeon } from './support/topology.js';
async function generateCourt() {
    const state = freshGame({ moves: 0, flags: { bones: false }, hero: {
            uz: { dnum: 0, dlevel: 20 }, ulevel: 20,
        } });
    state.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30,
            themeRooms: 'themerms.lua' })];
    initRng(999);
    init_objects();
    initRng(2);
    await mklev();
    assert.ok(state.level.rooms.filter(isRoom).some(room => room.rtype === COURT));
    return state.level;
}
void test('a court adds royal gold to its stocked chest and weighs all its contents', async () => {
    const level = await generateCourt();
    const coffer = floorObjects(level).find(object => object.otyp === CHEST && object.spe === 2);
    assert.ok(coffer, 'the court needs its marked royal coffer');
    const gold = coffer.contents?.find(object => object.otyp === GOLD_PIECE);
    assert.ok(gold, 'royal gold belongs in the coffer');
    assert.equal(gold.where, 'contained');
    assert.equal(gold.container, coffer);
    assert.equal(gold.owt, objectWeight(gold));
    assert.equal(coffer.owt, objectWeight(coffer));
    assert.ok(coffer.contents?.some(object => object.otyp !== GOLD_PIECE), 'adding royal gold must preserve the chest\'s other treasure');
});
void test('a court ruler receives an enchanted sceptre and starts asleep and hostile', async () => {
    const level = await generateCourt();
    const ruler = level.monsters.find(monster => level.at(monster.mx, monster.my)?.typ === THRONE);
    assert.ok(ruler, 'the court needs a ruler on its throne');
    const sceptre = ruler.minvent?.find(object => object.otyp === MACE);
    assert.ok(sceptre, 'the ruler needs a mace as a sceptre');
    assert.ok((sceptre.spe ?? 0) >= 1, 'a prince receives a weapon of at least +1');
    assert.equal(sceptre.where, 'minvent');
    assert.ok(ruler.msleeping);
    assert.equal(ruler.mpeaceful, 0);
});
//# sourceMappingURL=court_generation.test.js.map