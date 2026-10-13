import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { setQuiverObject } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

for (const quantity of [1, 50]) {
    for (const quivered of [false, true]) {
        void test(`the throw action describes ${quivered ? 'quivered' : 'unquivered'} gold ${quantity === 1 ? 'as one item' : 'as the whole purse'}`, async () => {
            freshObjectRoom();
            const coins = await addInventoryObject(GOLD_PIECE, { quan: quantity });
            if (quivered) await setQuiverObject(coins);
            const input = resetInputState();
            let throwLabel = '';
            input.beforeRead = () => {
                for (let row = 0; row < 14; row++) {
                    const text = requireScreenRow(row).map(cell => cell.ch).join('');
                    if (text.includes('t - ')) throwLabel = text.trim();
                }
            };
            await answerPrompts(rhack('i'.charCodeAt(0)), input, [
                { prompt: /Coins/, keys: coins.invlet },
                { prompt: /Do what with/, keys: '\x1b' },
            ]);

            const singleCoinAdvice = quivered
                ? "t - Throw this item (same as 'f')" : 't - Throw this item';
            assert.equal(throwLabel, quantity === 1 ? singleCoinAdvice : 't - Throw them');
        });
    }
}
