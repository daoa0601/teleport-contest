import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MAGIC_FLUTE, WOODEN_FLUTE, WOODEN_HARP } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('an applied magic flute puts a grabbing monster into wakeable sleep and releases its grip', async () => {
    const input = freshTurnRoom({ heroLevel: 5 });
    const owlbear = await createMonsterAt('owlbear', 11, 10);
    game.u.ustuck = owlbear;
    const flute = await addInventoryObject(MAGIC_FLUTE, { spe: 2 });
    installPagerInput(input, { expected: /playing|music|grip relaxes/, limit: 8 });
    pushKeys(`a${flute.invlet}y`);

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|music|grip relaxes|^$/);

    assert.equal(flute.spe, 1);
    assert.equal(owlbear.msleeping, 1);
    assert.equal(owlbear.mcanmove, 0);
    assert.ok((owlbear.mfrozen ?? 0) > 0);
    assert.equal(game.u.ustuck, null);
});

for (const [species, instrument] of [['snake', 'flute'], ['water nymph', 'harp']] as const) {
    void test(`playing a wooden ${instrument} calms an invisible ${species} without describing it`, async () => {
        const input = freshTurnRoom({ heroLevel: 30 });
        const target = await createMonsterAt(species, 11, 10);
        target.minvis = true;
        target.mpeaceful = 0;
        const object = await addInventoryObject(instrument === 'flute' ? WOODEN_FLUTE : WOODEN_HARP);
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /playing|trills|melody|sways|listens/, limit: 8 });
        pushKeys(`a${object.invlet}y`);

        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /playing|trills|melody|sways|listens|^$/);
        messages.push(game._pending_message);

        assert.equal(target.mpeaceful, 1);
        assert.doesNotMatch(messages.join('\n'), /sways with the music|listens cheerfully/);
    });
}
