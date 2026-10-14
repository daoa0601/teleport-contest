import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD, STATUE_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { maketrap } from '../js/mklev.js';
import { MONSTER_NAME, SPECIAL_PM } from '../js/monster_data.js';
import { STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a statue trap can choose a pony when the alternative is a co-aligned unicorn', async () => {
    const level = freshObjectRoom();
    const pony = MONSTER_NAME.indexOf('pony');
    const unicorn = MONSTER_NAME.indexOf('gray unicorn');
    game.mvitals = Array.from({ length: SPECIAL_PM }, (_, species) => ({
        mvflags: species === pony || species === unicorn ? 0 : G_GENOD,
        born: 0, died: 0,
    }));
    initRng(4n);
    await maketrap(12, 10, STATUE_TRAP);
    const statue = level.objects[12]?.[10]?.find(object => object.otyp === STATUE);
    assert.ok(statue);
    assert.equal(statue.corpsenm, pony, 'the horse class does not make a pony a unicorn');
});
//# sourceMappingURL=statue_trap_species.test.js.map