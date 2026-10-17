import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C hack.c domove_swap_with_pet() names the displaced creature with
// x_monnam(): "your" plus the species for any pet, "the peaceful" for an
// unnamed peaceful.
for (const [species, tame, expected] of [
    ['dog', true, 'You swap places with your dog.'],
    ['large cat', true, 'You swap places with your large cat.'],
    ['gnome', false, 'You swap places with the peaceful gnome.'],
]) {
    void test(`swapping with a ${tame ? 'pet' : 'peaceful'} ${species} names its species`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | NO_MINVENT);
        if (tame)
            initializePet(monster, { state: game });
        else
            monster.mpeaceful = 1;
        initRng(1n);
        await rhack('l'.charCodeAt(0));
        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
        assert.deepEqual([monster.mx, monster.my], [10, 10]);
        assert.equal(game._lastPlineMessage, expected);
    });
}
//# sourceMappingURL=pet_swap_names.test.js.map