import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { SCR_SCARE_MONSTER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a monster changing form during its turn updates a stale hero position', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('soldier', 11, 10, MM_NOMSG | NO_MINVENT);
    monster.mux = 8;
    monster.muy = 9;
    game.context.mon_moving = true;
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    assert.equal(monster.mux, game.u.ux);
    assert.equal(monster.muy, game.u.uy);
});
for (const monsterMoving of [false, true]) {
    void test(`a human polymorphed next to a scare scroll ${monsterMoving ? 'flees during its turn' : 'waits until its turn to flee'}`, async () => {
        freshObjectRoom();
        const monster = await createMonsterAt('soldier', 11, 10, MM_NOMSG | NO_MINVENT);
        monster.mpeaceful = 0;
        monster.mux = game.u.ux;
        monster.muy = game.u.uy;
        await floorObject(SCR_SCARE_MONSTER, game.u.ux, game.u.uy);
        game.context.mon_moving = monsterMoving;
        await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
        assert.equal(!!monster.mflee, monsterMoving);
        if (monsterMoving)
            assert.ok((monster.mfleetim ?? 0) >= 2 && (monster.mfleetim ?? 0) <= 10);
    });
}
void test('a shapechanger born during a monster turn locates the visible hero in its new form', async () => {
    let changed = 0;
    for (let seed = 1; seed <= 12; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        game.context.mon_moving = true;
        const naturalForm = MONSTER_NAME.indexOf('chameleon');
        const monster = await makemonAt(naturalForm, 12, 10, MM_NOMSG | NO_MINVENT);
        assert.ok(monster);
        if (monster.mnum === naturalForm)
            continue;
        changed++;
        assert.equal(monster.mux, game.u.ux, `new form must locate the hero (seed ${seed})`);
        assert.equal(monster.muy, game.u.uy);
    }
    assert.ok(changed > 0, 'some births must use a different chameleon form');
});
//# sourceMappingURL=monster_shape_perception.test.js.map