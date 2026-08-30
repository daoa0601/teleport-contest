import test from 'node:test';
import assert from 'node:assert/strict';

import { MOAT, THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateKnoxLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { GOLD_PIECE, OBJECT_NAMES } from '../js/object_data.js';
import { freshSpecialLevel } from './support/special-level.js';

function terrainCount(type) {
    let count = 0;
    for (let x = 1; x < 80; x++) {
        for (let y = 0; y < 21; y++) {
            if (game.level.at(x, y)?.typ === type) count++;
        }
    }
    return count;
}

test('Fort Ludios contains its defended treasury and Croesus court',
    async () => {
        const active = freshSpecialLevel({
            prototype: 'knox', variant: 1, seed: 2401, depth: 18,
        });
        game.knox_level = { ...game.u.uz };

        await generateKnoxLevel(active);

        assert.equal(game.level.flags.noteleport, true);
        assert.equal(game.level.flags.has_court, true);
        assert.equal(game.level.flags.has_zoo, true);
        assert.equal(game.level.flags.has_barracks, true);
        assert.ok(terrainCount(MOAT) > 80);
        assert.equal(terrainCount(THRONE), 1);

        const monsterNames = game.level.monsters.map(
            monster => MONSTER_NAME[monster.mnum],
        );
        assert.equal(monsterNames.filter(name => name === 'Croesus').length, 1);
        assert.ok(monsterNames.filter(name => name === 'soldier').length >= 16);
        assert.equal(monsterNames.filter(name => name === 'giant eel').length, 4);
        assert.ok(monsterNames.filter(name => name?.includes('dragon')).length >= 4);

        const objects = (game.level.objects || []).flat(2).filter(Boolean);
        assert.ok(objects.filter(object => object.otyp === GOLD_PIECE
            && object.quan >= 600 && object.quan <= 900).length >= 60);
        const gems = objects.map(object => OBJECT_NAMES[object.otyp]);
        for (const name of ['diamond', 'emerald', 'ruby', 'amethyst'])
            assert.equal(gems.filter(gem => gem === name).length, 3);
        assert.ok(game.level.traps.length > 0);
    });
