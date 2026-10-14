import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const lighting of [false, true]) {
    void test(`a monster polymorph ${lighting ? 'lights' : 'darkens'} nearby dungeon squares`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        for (let x = 7; x <= 16; x++)
            for (let y = 6; y <= 14; y++)
                level.requireAt(x, y).lit = false;
        const monster = await createMonsterAt(lighting ? 'jackal' : 'fire elemental', 13, 10, NO_MINVENT);
        vision_recalc(0);
        assert.equal(cansee(14, 10), !lighting);
        await changeMonsterForm(monster, MONSTER_NAME.indexOf(lighting ? 'fire elemental' : 'jackal'), game, { showMessage: true });
        await pline('You look around.');
        assert.equal(cansee(14, 10), lighting);
    });
}
//# sourceMappingURL=monster_polymorph_light.test.js.map