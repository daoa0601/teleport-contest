import assert from 'node:assert/strict';
import test from 'node:test';
import { DISMOUNT_BONES, DISMOUNT_GENERIC, DISMOUNT_KNOCKED, DISMOUNT_POLY } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { initRng, rn2, rnd } from '../js/rng.js';
import { dismountHero, doride } from '../js/steed.js';
import { moveHeroByTeleport, relocateMonsterTo } from '../js/teleport.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('a dismount after the steed is gone still selects between landing squares', async () => {
    freshObjectRoom({ left: 9, right: 11, top: 10, bottom: 10 });
    requirePlayingGame(game);
    // C landing_spot() breaks the tie between west and east before the
    // missing-steed check. A subsequent damage roll must follow that choice.
    initRng(19);
    rn2(2);
    const expectedDamage = rnd(20);
    initRng(19);
    const result = await dismountHero(DISMOUNT_POLY);
    const damage = rnd(20);
    assert.equal(result.dismounted, false);
    assert.equal(damage, expectedDamage);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(game._pending_message, '');
});
void test('being knocked off a missing steed still chooses a side of the preferred direction', async () => {
    freshObjectRoom({ left: 9, right: 10, top: 10, bottom: 10 });
    requirePlayingGame(game);
    game.u.dx = -1;
    game.u.dy = 0;
    // Even an available preferred square follows the clockwise/counterclockwise
    // choice made while constructing landing_spot()'s candidate list.
    initRng(19);
    rn2(2);
    const expectedDamage = rnd(20);
    initRng(19);
    await dismountHero(DISMOUNT_KNOCKED);
    assert.equal(rnd(20), expectedDamage);
    assert.equal(game._pending_message, '');
});
async function hallucinatingRiderRoom() {
    freshObjectRoom({
        left: 9, right: 11, top: 10, bottom: 10,
        flags: { debug: true },
        hero: { hallucinationTurns: 20 },
    });
    return createSaddledSteed();
}
void test('mounting shows the same hallucinated steed as relocation onto its square', async () => {
    const reference = await hallucinatingRiderRoom();
    game.u.usteed = reference;
    initRng(19);
    await moveHeroByTeleport(11, 10);
    await flush_screen(1);
    const expected = requireScreenCell(10, 11);
    const steed = await hallucinatingRiderRoom();
    initRng(19);
    pushKeys('ly'); // wizard mode forces mounting while hallucinating
    await doride();
    await flush_screen(1);
    assert.equal(game.u.usteed, steed);
    assert.equal(requireScreenCell(10, 11).ch, expected.ch);
    assert.equal(requireScreenCell(10, 11).color, expected.color);
    assert.equal(requireScreenCell(9, 11).ch, '.');
});
async function hallucinatingDismountRoom() {
    freshObjectRoom({
        left: 9, right: 10, top: 10, bottom: 10,
        hero: { hallucinationTurns: 20 },
    });
    const steed = await createSaddledSteed('pony', { x: 9, y: 10 });
    placeMonsterAt(steed, 10, 10);
    return steed;
}
void test('dismounting retains the former steed appearance shown during relocation', async () => {
    await hallucinatingDismountRoom();
    initRng(19);
    await moveHeroByTeleport(9, 10);
    await flush_screen(1);
    const expected = requireScreenCell(9, 11);
    const steed = await hallucinatingDismountRoom();
    game.u.usteed = steed;
    initRng(19);
    const result = await dismountHero(DISMOUNT_GENERIC);
    await flush_screen(1);
    assert.equal(result.dismounted, true);
    assert.equal(game.u.usteed, null);
    assert.equal(game.u.ux, 9);
    assert.equal(requireScreenCell(8, 11).ch, '@');
    assert.equal(requireScreenCell(9, 11).ch, expected.ch);
    assert.equal(requireScreenCell(9, 11).color, expected.color);
});
void test('a bones dismount retains the relocated steed appearance while leaving the hero in place', async () => {
    const reference = await hallucinatingDismountRoom();
    initRng(19);
    await relocateMonsterTo(reference, 9, 10);
    await flush_screen(1);
    const expected = requireScreenCell(8, 11);
    const steed = await hallucinatingDismountRoom();
    game.u.usteed = steed;
    initRng(19);
    await dismountHero(DISMOUNT_BONES);
    await flush_screen(1);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.usteed, null);
    assert.equal(steed.mx, 9);
    assert.equal(requireScreenCell(9, 11).ch, '@');
    assert.equal(requireScreenCell(8, 11).ch, expected.ch);
    assert.equal(requireScreenCell(8, 11).color, expected.color);
});
//# sourceMappingURL=steed_relocation.test.js.map