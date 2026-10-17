import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { reportHeroEncumbrance } from '../js/encumbrance.js';
import { ROCK } from '../js/object_data.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

// C pickup.c:encumber_msg() uses stagger(youmonst.data, "stagger") and
// marks the status line for the next flush.
for (const [form, verb] of [
    ['human', 'stagger'],
    ['cobra', 'falter'],
    ['gray ooze', 'tremble'],
] as const) {
    void test(`a strained ${form} hero ${verb}s under a lightened load`, async () => {
        freshObjectRoom();
        if (form !== 'human') installPolymorphedHero(form);
        while (nearCapacity(game) < 3) await addInventoryObject(ROCK);
        if (nearCapacity(game) !== 3) return assert.fail(`load ended at capacity ${nearCapacity(game)}`);
        game._encumbranceLevel = 4;
        game.context.botl = false;
        const messages: string[] = [];

        await reportHeroEncumbrance(game, async message => { messages.push(message); });

        assert.deepEqual(messages, [`You ${verb} under your load.  Movement is still very hard.`]);
        assert.equal(game.context.botl, true);
    });
}
