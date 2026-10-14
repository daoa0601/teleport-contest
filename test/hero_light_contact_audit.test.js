import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { WAN_LIGHT } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('lethal light damage is fully applied before the gremlin death message pauses', async () => {
    const level = freshObjectRoom({ flags: { verbose: true } });
    const wand = await addInventoryObject(WAN_LIGHT, { spe: 3 });
    const gremlin = await createMonsterAt('gremlin', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    setMonsterGivenName(gremlin, 'An Inordinately Long Gremlin Name');
    gremlin.mhp = 1;
    gremlin.mpeaceful = false;
    gremlin.msleeping = 0;
    const sleeper = await createMonsterAt('kobold', 12, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    sleeper.msleeping = 1;
    const healthAtInput = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /lit field|Gremlin Name|kobold|You feel/, limit: 8 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            healthAtInput.push(gremlin.mhp);
            return pager.readKey();
        },
    };
    assert.ok(wand.invlet);
    pushKey(wand.invlet);
    initRng(1n);
    await rhack('z'.charCodeAt(0));
    assert.ok(healthAtInput.some(health => health < 0), `The lethal flash must subtract its full damage before the death pager; HP at input: ${healthAtInput.join(', ')}`);
    assert.equal(level.monsters.includes(gremlin), false);
    assert.equal(sleeper.msleeping, 0, 'The gremlin cry wakes nearby creatures before the kill');
    assert.equal(game.u.uconduct?.killer, 1);
    assert.equal(wand.spe, 2);
});
//# sourceMappingURL=hero_light_contact_audit.test.js.map