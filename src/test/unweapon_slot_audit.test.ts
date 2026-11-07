// C uhitm.c:539-549 do_attack(): the one-time "You begin bashing monsters
// with ..." reminder follows gu.unweapon, which only setuwep(), uwepgone(),
// and the direct writes in wield.c/weapon.c/steed.c/uhitm.c/restore.c ever
// change.  These tests pin the sites whose port helper used to differ.

import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { useMirror } from '../js/apply.js';
import { setPrimaryWeapon } from '../js/wield.js';
import { changeTutorialState } from '../js/tutorial_state.js';
import { finishGlobTimer, mksobj, runClaimedGlobTimer } from '../js/mkobj.js';
import { claimNextDueObjectTimer, objectTimers } from '../js/timeout.js';
import { OBJECT_TIMER_KIND, W_WEP } from '../js/const.js';
import { GLOB_OF_BLACK_PUDDING, MIRROR } from '../js/object_data.js';
import type { GameObject } from '../js/object_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';

function turnMessages(): string {
    return [...game._messageHistory, game._pending_message ?? ''].join('\n');
}

// C apply.c:1163 use_mirror(): a nymph's theft unwields the mirror through
// setnotworn(), which leaves gu.unweapon at its stale value instead of
// arming the bare-hands notice the way steal.c:remove_worn_item() would.
void test('a nymph stealing a wielded mirror leaves the bare-hands notice stale', async () => {
    const level = await freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    level.flags.noteleport = true;
    const mirror = await addInventoryObject(MIRROR);
    game.uwep = game.u.uwep = mirror;
    mirror.wielded = true;
    const nymph = await createMonsterAt('wood nymph', 12, 10);
    nymph.msleeping = 0;
    await createMonsterAt('newt', 10, 11);

    resetInputState().feed('l' + ' '.repeat(30));
    await useMirror(mirror);
    assert.equal(game.uwep, null);
    assert.equal(game.u.uwep, null);

    pushKeys(' '.repeat(30));
    await rhack('j'.charCodeAt(0));

    assert.doesNotMatch(turnMessages(), /begin bashing monsters with your bare hands/);
});

// C mkobj.c:1678-1681 shrinking_glob_gone(): a wielded glob that shrinks to
// nothing unwields through remove_worn_item(), whose uwepgone() arms the
// bare-hands notice for the next attack.
void test('a wielded glob dissolving away arms the bare-hands notice', async () => {
    await freshObjectRoom({
        left: 8, right: 16, top: 7, bottom: 13,
        flags: { verbose: true }, gameplaySeed: 19,
    });
    requirePlayingGame(game);
    const glob = await mksobj(GLOB_OF_BLACK_PUDDING, true, false);
    glob.where = 'inventory';
    glob.owt = 1;
    glob.owornmask = W_WEP;
    glob.wielded = true;
    game.inventory = [glob];
    game.uwep = game.u.uwep = glob;
    await createMonsterAt('newt', 11, 10);
    const [timer] = objectTimers(glob);
    assert.ok(timer && timer.kind === OBJECT_TIMER_KIND.SHRINK_GLOB,
        'a fresh glob must carry its shrink timer');
    game.moves = timer.deadline;

    const event = await runClaimedGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.ok(event, 'The due object timer must produce its effect.');
    await finishGlobTimer(event, game, game.moves, async () => {});
    assert.equal(game.uwep, null);
    assert.equal(game.u.uwep, null);

    pushKeys(' '.repeat(30));
    await rhack('l'.charCodeAt(0));

    assert.match(turnMessages(), /begin bashing monsters with your bare hands/);
});

// C nhlua.c:1898-1904 nhl_gamestate(): exiting the tutorial re-wears the
// sequestered gear with setworn(), which never recomputes gu.unweapon; a
// notice armed before the tutorial stays armed after it.
void test('exiting the tutorial keeps a bashing notice armed on the restored weapon', async () => {
    await freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const mirror: GameObject = await addInventoryObject(MIRROR);
    // Wielding a mirror is wielding a non-weapon tool: setuwep() arms the
    // first-fight notice for it (wield.c:128-132).
    await setPrimaryWeapon(mirror, game);
    await createMonsterAt('newt', 11, 10);

    resetInputState().feed(' '.repeat(30));
    await changeTutorialState(game, false);
    await changeTutorialState(game, true);
    assert.equal(game.uwep, mirror);

    pushKeys(' '.repeat(30));
    await rhack('l'.charCodeAt(0));

    assert.match(turnMessages(), /begin bashing monsters with your mirror/);
});
