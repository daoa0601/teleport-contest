import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { LUCKSTONE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { cursed, hitBonus, expectedHit } of [
    { cursed: false, hitBonus: 12, expectedHit: true },
    { cursed: true, hitBonus: 13, expectedHit: false },
]) {
    void test(`a carried ${cursed ? 'cursed' : 'uncursed'} luckstone ${cursed ? 'spoils' : 'rescues'} a marginal melee attack`, async () => {
        for (const carrying of [false, true]) {
            freshObjectRoom({ hero: { uhitinc: hitBonus, uluck: 0 } });
            installPolymorphedHero('newt');
            // Levitation lets this tiny body carry a stone without the
            // encumbrance penalty masking the luck bonus under test.
            game.u.levitating = true;
            if (carrying) await addInventoryObject(LUCKSTONE, { cursed });
            assert.equal(nearCapacity(game), 0);
            const goblin = await createMonsterAt('goblin', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
            goblin.mhp = goblin.mhpmax = 100;
            goblin.mpeaceful = false;
            goblin.msleeping = 0;
            goblin.mcanmove = 1;
            resetInputState();
            pushKey('l');
            initRng(10n);

            await rhack('F'.charCodeAt(0));

            assert.equal(game.u.uluck, 0, 'The stone changes the luck bonus, not base luck');
            assert.equal(goblin.mhp < 100, carrying ? expectedHit : !expectedHit,
                `The ${carrying ? 'carried stone' : 'empty inventory'} must affect whether the bite lands`);
            assert.equal(game.context.move, 1);
        }
    });
}
