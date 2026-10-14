import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { flushPendingTopline } from '../js/display.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireScreenRow } from './support/screen.js';
for (const recovery of ['life saving', 'explore refusal']) {
    void test(`${recovery} announces survival once after the remaining movement ration is spent`, async () => {
        freshObjectRoom({ flags: { explore: recovery === 'explore refusal' },
            hero: { uhp: 1, uhpmax: 40 } });
        requirePlayingGame(game);
        if (recovery === 'life saving')
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        const input = resetInputState();
        const messages = [];
        let commands = 0;
        let reads = 0;
        input.display = { async readKey() {
                assert.ok(++reads <= 12, 'Death recovery must reach command input');
                const top = requireScreenRow(0).map(cell => cell.ch).join('');
                if (top.includes('Die?'))
                    return 110;
                messages.push(game._pending_message);
                if (top.includes('--More--'))
                    return 32;
                commands++;
                return 27;
            } };
        assert.equal(await loseHeroHp(2, 'acid'), false);
        await flushPendingTopline();
        game._moveloopStarted = true;
        game.u.umovement = 24;
        const started = game.moves;
        await moveloop_core();
        assert.equal(game.moves, started, 'The remaining movement ration has not advanced global time');
        assert.doesNotMatch(game._pending_message, /survived that attempt/, 'Survival feedback waits for the one-turn recovery to finish');
        while (commands === 0)
            await moveloop_core();
        assert.equal(game.moves - started, 1, 'Recovery lasts one global turn');
        assert.equal(messages.join('\n').match(/You survived that attempt on your life\./g)?.length, 1, 'Recovery publishes a single survival announcement');
    });
}
//# sourceMappingURL=hero_survival_cadence.test.js.map