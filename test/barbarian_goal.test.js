import test from 'node:test';
import assert from 'node:assert/strict';

import { ALTAR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { freshSpecialLevel } from './support/special-level.js';

test('the Barbarian quest ends at Thoth Amon and the Heart of Ahriman',
    async () => {
        freshSpecialLevel({
            prototype: 'Bar-goal', variant: 1, seed: 2501, depth: 5,
        });
        game._specialLevelPrototype = 'Bar-goal';
        game._activeSpecialLevel = null;
        game.u.ualignbase = [0, 0];

        await mklev();

        assert.equal(game._activeSpecialLevel.prototype, 'Bar-goal');
        const monsters = game.level.monsters.map(
            monster => MONSTER_NAME[monster.mnum],
        );
        assert.equal(monsters.filter(name => name === 'Thoth Amon').length, 1);
        assert.ok(monsters.filter(name => name === 'ogre').length >= 16);
        assert.ok(monsters.filter(name => name === 'rock troll').length >= 8);

        const objects = (game.level.objects || []).flat(2).filter(Boolean);
        const heart = objects.find(
            object => object.oextra?.oname === 'The Heart of Ahriman',
        );
        assert.equal(OBJECT_NAMES[heart?.otyp], 'luckstone');
        assert.equal(heart?.blessed, true);
        assert.equal(heart?.questArtifact, true);

        let altars = 0;
        for (let x = 1; x < 80; x++)
            for (let y = 0; y < 21; y++)
                if (game.level.at(x, y)?.typ === ALTAR) altars++;
        assert.equal(altars, 1);
        assert.equal(game.level.traps.length, 6);
    });

test('the Barbarian filler levels have both stairways', async () => {
    for (const prototype of ['Bar-fila', 'Bar-filb']) {
        freshSpecialLevel({ prototype, variant: 1, seed: 2601, depth: 5 });
        game._specialLevelPrototype = prototype;
        game._activeSpecialLevel = null;

        await mklev();

        let stairways = 0;
        for (let stair = game.stairs; stair; stair = stair.next) stairways++;
        assert.equal(stairways, 2, prototype);
    }
});
