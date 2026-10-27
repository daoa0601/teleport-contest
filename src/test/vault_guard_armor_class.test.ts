// C allmain.c runs invault() inside the once-per-turn block, before the
// once-per-player-input find_ac().  A guard arriving right after armor came
// off therefore pages its arrival message while the status line still counts
// the removed piece: find_ac() only catches up after the guard's dialog.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, MENU_PARTIAL, ROOMOFFSET, VAULT, VWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { moveloop_core } from '../js/allmain.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { LEATHER_CLOAK } from '../js/object_data.js';
import { maintainVaultResidence } from '../js/vault.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';

function vaultedLevel(): void {
    const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10,
        flags: { menu_style: MENU_PARTIAL } });
    requirePlayingGame(game);
    level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
    level.requireAt(16, 10).typ = CORR;
    level.requireAt(11, 10).typ = VWALL;
}

void test('a guard arriving over a pending removal message pages with the old armor class', async () => {
    vaultedLevel();
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const cloak = await addInventoryObject(LEATHER_CLOAK);
    await wearHeroArmor(cloak);
    findArmorClass();
    const classWithCloak: number = game.u.uac ?? 10;
    assert.ok(classWithCloak < 10, 'the worn cloak improves the armor class');

    // Remove the cloak with 'A'; its removal messages stay pending.
    pushKeys(`${cloak.invlet}\n`);
    await rhack('A'.charCodeAt(0));
    await continueCountedCommand();
    assert.ok(game._armorClassDirty, 'the removal defers its armor class');
    assert.equal(game.uarmc, null, 'the cloak is off');
    assert.match(game._pending_message ?? '', /You were wearing/);

    // The guard arrives while the removal message is still pending.
    game.u.uinvault = 29;
    assert.equal(maintainVaultResidence(), true);

    const seenClasses: number[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        if (/You were wearing/.test(game._pending_message ?? ''))
            seenClasses.push(game.u.uac ?? 10);
    };
    let coreDone = false;
    let coreFailure: unknown = null;
    const core = moveloop_core().then(
        () => { coreDone = true; },
        failure => { coreFailure = failure; });
    for (let boundaries = 0; boundaries < 8; boundaries++) {
        const done = await Promise.race([
            core.then(() => true),
            input.waitUntilBlocked().then(() => false),
        ]);
        if (done) break;
        const topRow = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '';
        if (/who are you/.test(topRow)) input.feed('Guest\n');
        else input.feed(' ');
    }
    await core;
    if (coreFailure !== null) throw coreFailure;

    assert.ok(seenClasses.length > 0, 'the guard arrival paged the removal message');
    for (const seen of seenClasses)
        assert.equal(seen, classWithCloak,
            'the pager keeps the armor class from before find_ac()');
    assert.equal(game.u.uac, 10, 'find_ac() catches up after the arrival');
    assert.equal(game._armorClassDirty, false);
});
