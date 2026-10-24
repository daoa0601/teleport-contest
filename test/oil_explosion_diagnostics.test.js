import assert from 'node:assert/strict';
import test from 'node:test';
import { LOST_EXPLODING, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { explodeLitOilPotion } from '../js/fire_explosion.js';
import { resetInputState } from '../js/input.js';
import { POT_OIL } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
for (const lit of [false, true]) {
    void test(`exploding ${lit ? 'untimed lit' : 'unlit'} oil reports the inconsistency and still splatters burning oil`, async () => {
        freshObjectRoom();
        const potion = await floorObject(POT_OIL, 14, 10);
        potion.lamplit = lit;
        const victim = await createMonsterAt('jackal', 15, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        victim.mhp = victim.mhpmax = 100;
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(requireScreenRow(0).map(cell => cell.ch).join('')); };
        installPagerInput(input, { expected: /exploding unlit oil|end_burn:|Program in disorder|Please report/, limit: 12 });
        const result = await explodeLitOilPotion(potion, 14, 10, {
            publish: async () => { }, random: () => 1, rollDice: () => 8,
        });
        assert.equal(result.heroDied, false);
        assert.equal(victim.mhp, 92, 'The diagnosed oil still produces its blast.');
        assert.equal(potion.how_lost, LOST_EXPLODING);
        assert.ok(messages.some(message => /end_burn:/.test(message)
            && message.includes(lit ? 'not timed!' : 'not lit')), 'The burn inconsistency is reported.');
        if (!lit)
            assert.ok(messages.some(message => message.includes('exploding unlit oil')));
    });
}
//# sourceMappingURL=oil_explosion_diagnostics.test.js.map