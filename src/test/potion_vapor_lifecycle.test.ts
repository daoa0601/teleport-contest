import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { hitHeroWithThrownPotion } from '../js/hero_potion_hit.js';
import { resetInputState } from '../js/input.js';
import { POT_CONFUSION, TOWEL } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

for (const shielded of [false, true]) {
    void test(`${shielded ? 'shielded' : 'inhaled'} potion vapor releases an idle bottle before naming it`, async () => {
        freshObjectRoom();
        if (shielded) {
            const towel = await addInventoryObject(TOWEL, { spe: 1 });
            game.ublindf = towel;
        }
        const potion = await knownObject(POT_CONFUSION, { typeKnown: false, dknown: true, in_use: false });
        const input = resetInputState();
        let named = false;
        input.display = {
            async readKey() {
                const prompt = requireScreenRow(0).map(cell => cell.ch).join('');
                if (prompt.includes('--More--')) return 32;
                assert.match(prompt, /^Call an? .+ potion:/);
                assert.equal(potion.in_use, false, 'The vapor effect must release the bottle before the naming prompt');
                assert.equal(potion.where, 'free', 'The caller must keep the bottle until naming finishes');
                named = true;
                return 27;
            },
        };

        await hitHeroWithThrownPotion(potion);

        assert.equal(named, true);
        assert.equal((game.u.confusionTurns ?? 0) > 0, !shielded);
        assert.equal(potion.where, 'gone');
    });
}
