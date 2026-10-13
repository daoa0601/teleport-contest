import assert from 'node:assert/strict';
import test from 'node:test';
import { MOAT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { init_dungeons } from '../js/dungeon.js';
import { pushKeys } from '../js/input.js';
import { loadScoreRecords } from '../js/score_records.js';
import { waterbodyName } from '../js/terrain_name.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
void test('entering a moat announces that body of water', async () => {
    const level = freshObjectRoom({ hero: { magicalBreathing: true } });
    level.requireAt(10, 10).typ = MOAT;
    const messages = [];
    await heroLiquidEffects({ publish: text => { messages.push(text); } });
    assert.equal(messages[0], 'You fall into the moat.');
    assert.equal(game.u.uinwater, 1);
});
void test('drowning names the moat in the death record', async () => {
    const level = freshObjectRoom({
        left: 10, right: 10, top: 10, bottom: 10,
        hero: { urexp: 100 },
        flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = MOAT;
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    pushKeys(' '.repeat(100));
    const result = await heroLiquidEffects();
    assert.equal(result?.died, true);
    assert.equal(loadScoreRecords()[0]?.death, 'drowned in a moat');
});
void test("water on Juiblex's assigned level is described as a swamp", async () => {
    freshObjectRoom();
    await init_dungeons();
    const juiblex = game.specialLevels?.get('juiblex');
    assert.ok(juiblex);
    game.u.uz = { dnum: juiblex.dnum, dlevel: juiblex.dlevel };
    const location = game.level?.at(10, 10);
    assert.ok(location);
    location.typ = MOAT;
    assert.equal(waterbodyName(10, 10), 'swamp');
});
//# sourceMappingURL=pool_terrain_naming.test.js.map