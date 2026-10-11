import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, G_GENOD, LAVAPOOL, MM_NOMSG, MM_NOTAIL, NO_MINVENT, POOL, WATER, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { glyphAt } from '../js/display.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { initRng } from '../js/rng.js';
import { requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const species = (name) => MONSTER_NAME.indexOf(name);
for (const name of ['vampire', 'vampire leader']) {
    void test(`${name} stays in its native form when its alternate forms are genocided`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        for (const alternate of ['wolf', 'fog cloud', 'vampire bat'])
            requireMonsterVital(species(alternate)).mvflags = G_GENOD;
        initRng(3n);
        const vampire = await makemonAt(species(name), 11, 10, MM_NOMSG | NO_MINVENT);
        assert.ok(vampire);
        assert.equal(vampire.mnum, species(name));
        assert.equal(vampire.cham, species(name));
    });
}
void test('an unchanged vampire birth still receives ordinary native inventory', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    for (const alternate of ['wolf', 'fog cloud', 'vampire bat'])
        requireMonsterVital(species(alternate)).mvflags = G_GENOD;
    initRng(3n);
    const vampire = await makemonAt(species('vampire leader'), 11, 10, MM_NOMSG);
    assert.ok(vampire);
    assert.equal(vampire.mnum, species('vampire leader'));
    assert.ok(vampire.minvent.length > 0);
    assert.equal(vampire.hasInventory, true);
});
void test('vampire births use the uppercase bat form on the Rogue level', async () => {
    for (const name of ['vampire', 'vampire leader']) {
        for (let seed = 1; seed <= 16; seed++) {
            freshObjectRoom();
            requirePlayingGame(game);
            game.rogue_level = { ...game.u.uz };
            initRng(BigInt(seed));
            const vampire = await makemonAt(species(name), 11, 10, MM_NOMSG | NO_MINVENT);
            assert.ok(vampire);
            assert.equal(vampire.mnum, species('vampire bat'), `${name}, seed ${seed}`);
        }
    }
});
for (const [name, terrain, underlay] of [
    ['pool', POOL], ['water wall', WATER], ['lava', LAVAPOOL],
    ['raised bridge over water', DRAWBRIDGE_UP, DB_MOAT],
    ['raised bridge over lava', DRAWBRIDGE_UP, DB_LAVA],
]) {
    void test(`a vampire leader born over ${name} does not choose wolf form`, async () => {
        for (let seed = 1; seed <= 32; seed++) {
            const level = freshObjectRoom();
            requirePlayingGame(game);
            const location = level.requireAt(11, 10);
            location.typ = terrain;
            if (underlay != null)
                location.drawbridgemask = underlay;
            initRng(BigInt(seed));
            const vampire = await makemonAt(species('vampire leader'), 11, 10, MM_NOMSG | NO_MINVENT);
            assert.ok(vampire);
            assert.notEqual(vampire.mnum, species('wolf'), `${name}, seed ${seed}`);
        }
    });
}
for (const noTail of [false, true]) {
    void test(`a chameleon born in long-worm form has a working body ${noTail ? 'despite MM_NOTAIL' : 'with default flags'}`, async () => {
        const level = freshObjectRoom({ left: 7, right: 30, top: 5, bottom: 17 });
        requirePlayingGame(game);
        initRng(242n);
        const worm = await makemonAt(species('chameleon'), 18, 10, MM_NOMSG | NO_MINVENT | (noTail ? MM_NOTAIL : 0));
        assert.ok(worm);
        assert.equal(worm.mnum, species('long worm'));
        assert.ok(worm.wormSegments && worm.wormSegments.length > 0);
        for (const segment of worm.wormSegments) {
            assert.equal(monsterAtPosition(level, segment.x, segment.y), worm);
            assert.equal(glyphAt(segment.x, segment.y)?.kind, 'monster');
        }
    });
}
//# sourceMappingURL=monster_birth_form.test.js.map