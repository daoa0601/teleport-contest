import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAVE, HEADSTONE, ROOM } from '../js/const.js';
import { deleteEngravingAt, engravingAt, makeEngravingAt, wipeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { kickDirection } from './support/commands.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshGameplayRoom } from './support/playable-room.js';
void test('deleting an engraving removes a headstone but ordinary wear does not', () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    makeEngravingAt(11, 10, 'Rest in peace', null, 0, HEADSTONE);
    wipeEngravingAt(11, 10, 100);
    assert.equal(engravingAt(11, 10)?.text, 'Rest in peace');
    assert.equal(deleteEngravingAt(11, 10), true);
    assert.equal(engravingAt(11, 10), null);
});
for (const initiallyDisturbed of [false, true]) {
    void test(initiallyDisturbed ? 'kicking can break a disturbed headstone into a rock'
        : 'kicking can disturb the undead while leaving the headstone intact', async () => {
        let happened = false;
        for (let seed = 1n; seed <= 50n; seed++) {
            const level = freshGameplayRoom({ role: 'archeologist', hero: { uhp: 100, uhpmax: 100 } });
            requirePlayingGame(game);
            const grave = level.requireAt(11, 10);
            grave.typ = GRAVE;
            grave.disturbed = initiallyDisturbed ? 1 : 0;
            makeEngravingAt(11, 10, 'Rest in peace', null, 0, HEADSTONE);
            initRng(seed);
            await kickDirection('l');
            if (initiallyDisturbed && grave.typ === ROOM) {
                assert.equal(grave.disturbed, 0);
                assert.equal(engravingAt(11, 10), null);
                assert.ok(floorObjectsAt(level, 11, 10).some(object => object.otyp === ROCK));
                happened = true;
                break;
            }
            if (!initiallyDisturbed && grave.disturbed) {
                assert.equal(grave.typ, GRAVE);
                assert.ok(level.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('ghoul')));
                assert.ok(engravingAt(11, 10));
                happened = true;
                break;
            }
        }
        assert.equal(happened, true);
    });
}
//# sourceMappingURL=grave_kick.test.js.map