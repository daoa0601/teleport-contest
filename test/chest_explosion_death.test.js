import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, CHEST } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const lifeSaving of [false, true]) {
    void test(`disarming an exploding chest ${lifeSaving ? 'uses life saving and resumes the command' : 'kills a hero who cannot survive the blast'}`, async () => {
        freshObjectRoom({ hero: {
                uluck: -13, uhp: 1, uhpmax: 80, fumbling: true,
            } });
        requirePlayingGame(game);
        const chest = await floorObject(CHEST, 10, 10, {
            otrapped: true, tknown: true, dknown: true,
        });
        let amulet = null;
        if (lifeSaving) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        const input = resetInputState();
        input.feed('untrap\n.y');
        input.beforeRead = () => input.feed(' ');
        initRng(1n);
        await rhack('#'.charCodeAt(0));
        assert.equal(chest.where, 'gone');
        assert.equal(!!game.program_state.gameover, !lifeSaving);
        assert.equal(game.u.umortality, 1);
        if (lifeSaving) {
            assert.equal(amulet?.where, 'gone');
            assert.ok(game.u.uhp > 0);
        }
        else
            assert.equal(game._deathKiller, 'exploding chest');
    });
}
void test('disarming a named chest preserves its name in the fatal explosion', async () => {
    freshObjectRoom({ hero: { uluck: -13, uhp: 1, uhpmax: 80, fumbling: true } });
    requirePlayingGame(game);
    await floorObject(CHEST, 10, 10, {
        otrapped: true, tknown: true, dknown: true, oname: 'Treasure',
    });
    const input = resetInputState();
    input.feed('untrap\n.y');
    input.beforeRead = () => input.feed(' ');
    initRng(1n);
    await rhack('#'.charCodeAt(0));
    assert.equal(game.program_state.gameover, true);
    assert.equal(game._deathKiller, 'exploding chest named Treasure');
});
//# sourceMappingURL=chest_explosion_death.test.js.map