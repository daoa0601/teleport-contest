import assert from 'node:assert/strict';
import test from 'node:test';

import { createBonesFromDeath } from '../js/bones_death.js';
import { DELPHI, NO_MINVENT, ROOMOFFSET } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { init_objects } from '../js/o_init.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createRoom, createSpecialLevel } from './support/topology.js';

function dyingHero(): void {
    freshPlayableRoom({ hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.storage = memoryStorage();
    game._canMakeBones = true;
    init_objects();
}

for (const name of ['Medusa', 'Wizard of Yendor', 'Lord Carnarvon', 'Minion of Huhetotl', 'Vlad the Impaler']) {
    void test(`saving bones removes ${name} even away from home`, async () => {
        dyingHero();
        const monster = await createMonsterAt(name, 13, 10, NO_MINVENT);
        if (name === 'Vlad the Impaler')
            await changeMonsterForm(monster, MONSTER_NAME.indexOf('vampire bat'));

        assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);

        assert.equal(requireGameLevel().monsters.includes(monster), false);
    });
}

void test('saving bones removes the Oracle from a different level', async () => {
    dyingHero();
    game.oracle_level = createSpecialLevel({ dnum: 0, dlevel: 5, bonetag: 'O' });
    const oracle = await createMonsterAt('Oracle', 13, 10, NO_MINVENT);

    assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);

    assert.equal(requireGameLevel().monsters.includes(oracle), false);
});

for (const displaced of [false, true]) {
    void test(`saving bones restores the Oracle chamber${displaced ? ' and returns her to it' : ''}`, async () => {
        dyingHero();
        const level = requireGameLevel();
        game.oracle_level = createSpecialLevel({ dnum: 0, dlevel: 7, bonetag: 'O' });
        const chamber = createRoom({ lx: 8, hx: 12, ly: 8, hy: 12, orig_rtype: DELPHI });
        level.rooms = [chamber];
        for (let x = 8; x <= 12; x++)
            for (let y = 8; y <= 12; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
        const oracle = await createMonsterAt('Oracle', displaced ? 16 : 11, 10, NO_MINVENT);
        oracle.mpeaceful = 0;

        assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);

        assert.ok(level.monsters.includes(oracle));
        assert.equal(oracle.mpeaceful, 1);
        assert.equal(chamber.rtype, DELPHI);
        assert.equal(level.requireAt(oracle.mx, oracle.my).roomno, ROOMOFFSET);
    });
}
