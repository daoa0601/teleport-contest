import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGrip } from '../js/hero_grip.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('a held hero turning eyeless still shows the holder while its grip is lost', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const holder = await createMonsterAt('guardian naga', ux + 1, uy, NO_MINVENT);
    setHeroGrip(holder);
    const shown = [];
    const input = resetInputState();
    input.beforeRead = () => {
        if (/turn into an? (?:\w+ )?violet fungus/.test(game._pending_message))
            shown.push(requireScreenCell(ux, uy + 1).ch);
        input.feed(' ');
    };
    await polymonHero(MONSTER_NAME.indexOf('violet fungus'));
    assert.equal(game.u.ustuck, null);
    assert.deepEqual(shown, ['N']);
});
//# sourceMappingURL=polymorph_grip_sight.test.js.map