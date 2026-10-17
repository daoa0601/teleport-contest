import assert from 'node:assert/strict';
import test from 'node:test';
import { requirePlayingGame, game } from '../js/gstate.js';
import { PICK_AXE } from '../js/object_data.js';
import { usePickAxe } from '../js/pick_axe.js';
import { uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// dig.c:use_pick_axe() lists likely directions in hack.h order, where
// DIR_DOWN precedes DIR_UP; an engulfed hero is offered every direction.
void test('an engulfed hero is offered down before up when digging', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pick = await uninitializedObject(PICK_AXE, {});
    game.u.uwep = pick;
    game.u.uswallow = 1;
    const prompts: string[] = [];

    await usePickAxe(pick, {
        state: game,
        ensureWielded: async () => ({ ready: true }),
        readDirection: async prompt => { prompts.push(prompt); return null; },
        attackMonster: async () => false,
        payShopkeeper: async () => undefined,
    });

    assert.deepEqual(prompts, ['In what direction do you want to dig? [hykulnjb><]']);
});
