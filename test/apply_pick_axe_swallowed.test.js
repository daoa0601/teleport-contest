import assert from 'node:assert/strict';
import test from 'node:test';
// C dig.c:use_pick_axe2() attacks the swallower with do_attack() directly, so
// the dig direction vector is not reset the way domove_core() resets it for
// movement. hitum() therefore finds no monster at u.ux+u.dx,u.uy+u.dy and
// uhitm.c:797-799 suppresses the second two-weapon swing.
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { placeMonsterAt } from '../js/steed.js';
import { BULLWHIP, PICK_AXE } from '../js/object_data.js';
import { W_SWAPWEP, W_WEP } from '../js/const.js';
import { setTwoWeaponCombat } from '../js/wield.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
async function engulfedTwoWeaponHero() {
    const input = freshTurnRoom();
    game.u.uhp = game.u.uhpmax = 500;
    (game.u.uconduct ??= {}).weaphit = 0;
    const pick = await addInventoryObject(PICK_AXE, {
        invlet: 'a', wielded: true, owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = pick;
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'b', wielded: true, owornmask: W_SWAPWEP,
    });
    game.uswapwep = game.u.uswapwep = whip;
    setTwoWeaponCombat(true, game);
    const vortex = await createMonsterAt('dust vortex', 11, 10);
    placeMonsterAt(vortex, game.u.ux, game.u.uy);
    vortex.mhp = vortex.mhpmax = 500;
    game.u.uswallow = game.uswallow = 1;
    game.u.ustuck = vortex;
    return { input, pick, whip, vortex };
}
void test('a swallowed hero applying a pick-axe swings only once', async () => {
    const { input, pick } = await engulfedTwoWeaponHero();
    input.feed(`a${pick.invlet}l`);
    await rhack(0);
    // Being swallowed forces the hit for the first swing; the missing second
    // swing is the observable difference from the movement attack below.
    assert.equal(game.u.uconduct?.weaphit ?? 0, 1);
});
void test('a swallowed hero attacking by movement swings both weapons', async () => {
    await engulfedTwoWeaponHero();
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.uconduct?.weaphit ?? 0, 2);
});
//# sourceMappingURL=apply_pick_axe_swallowed.test.js.map