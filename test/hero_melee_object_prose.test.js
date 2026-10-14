import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { EXPENSIVE_CAMERA, MIRROR } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const { type, noun, seed, message } of [
    { type: MIRROR, noun: 'mirror', seed: 906n, message: /You break your mirror\.  That's bad luck!/ },
    { type: EXPENSIVE_CAMERA, noun: 'camera', seed: 2n, message: /You succeed in destroying your expensive camera\.  Congratulations!/ },
]) {
    void test(`breaking a wielded ${noun} gives the native two-sentence admonishment`, async () => {
        freshObjectRoom({ flags: { verbose: true }, hero: { uhitinc: 100 } });
        const object = await addInventoryObject(type);
        await setPrimaryWeapon(object);
        const target = await createMonsterAt('goblin', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        target.mhp = target.mhpmax = 2000;
        target.mpeaceful = false;
        target.msleeping = 0;
        const messages = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /goblin|mirror|camera|bad luck|Congratulations|appears/, limit: 8 });
        const pager = input.display;
        assert.ok(pager);
        input.display = {
            async readKey() {
                messages.push(game._pending_message);
                return pager.readKey();
            },
        };
        pushKey('l');
        initRng(seed);
        await rhack('F'.charCodeAt(0));
        messages.push(game._pending_message);
        assert.equal(object.where, 'gone');
        assert.match(messages.join('\n'), message);
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=hero_melee_object_prose.test.js.map