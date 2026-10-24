import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { DOOR, D_LOCKED, D_WARNED, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { pickLock } from '../js/lock_pick.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { LOCK_PICK, MUMMY_WRAPPING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const condition of ['visible', 'invisible', 'wrapped', 'blind watch'] as const) {
    const canWitness = condition === 'visible' || condition === 'wrapped';
    const situation = condition === 'wrapped' ? 'mummy wrapping blocks invisibility'
        : condition === 'blind watch' ? 'the watchman is blind' : `the hero is ${condition}`;
    void test(`a town watchman ${canWitness ? 'warns' : 'does not warn'} a lock picker when ${situation}`, async () => {
        const level = freshObjectRoom({ flags: { verbose: true },
            hero: { invisibleTurns: condition === 'invisible' || condition === 'wrapped' ? 50 : 0 } });
        requirePlayingGame(game);
        level.flags.has_town = true;
        const watchman = await createMonsterAt('watchman', 8, 10, NO_MINVENT);
        watchman.mpeaceful = 1;
        watchman.msleeping = 0;
        watchman.mcansee = condition === 'blind watch' ? 0 : 1;
        if (condition === 'wrapped') wearHeroArmor(await addInventoryObject(MUMMY_WRAPPING));
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        vision_note_blocker_change(11, 10);
        vision_recalc(0);
        const input = resetInputState();
        pushKeys('y');
        await pickLock(await addInventoryObject(LOCK_PICK), { target: { x: 11, y: 10 } });
        assert.ok(game._occupation, 'Applying the pick must start unlocking the door');
        const occupation = game._occupation;
        installPagerInput(input, { expected: /watchman|picking|Halt|stop/i, limit: 10 });
        // Repeated turns allow the watch its ordinary one-in-three chance
        // to notice the crime without replacing its random decisions.
        initRng(13n);

        for (let turn = 0; turn < 20 && game._occupation; turn++)
            await takeMonsterTurn(watchman, game);

        assert.equal(!!((door.looted ?? 0) & D_WARNED), canWitness);
        assert.equal(game._occupation, canWitness ? null : occupation);
        assert.equal(!!watchman.mpeaceful, true, 'The first warning does not make an arrest');
    });
}
