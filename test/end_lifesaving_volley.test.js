// C end.c:savelife() calls endmultishot(FALSE) (dothrow.c:590) when the
// hero survives a death during her own volley: m_shot.n becomes m_shot.i,
// so the current missile is the last one. A life-saved hero therefore
// throws no further daggers even though the volley announced more.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { P_DAGGER, P_EXPERT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setQuiverObject } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { wearHeroAccessory } from '../js/accessory.js';
void test('life saving during a volley stops the remaining missiles', async () => {
    freshObjectRoom({ role: 'rogue', recalculateVision: false });
    installHeroWeaponSkills({ [P_DAGGER]: P_EXPERT });
    game.u.uhp = game.u.uhpmax = 1;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    // The adjacent gas spore explodes when the first dagger kills it, and
    // that explosion is lethal for a one-hit-point hero.
    const spore = await createMonsterAt('gas spore', game.u.ux - 1, game.u.uy);
    spore.mhp = spore.mhpmax = 1;
    const daggers = await addInventoryObject(DAGGER, { quan: 5 });
    await setQuiverObject(daggers);
    initRng(2n);
    game._commandCount = 2;
    const input = resetInputState();
    const acknowledgements = [];
    input.display = {
        async readKey() {
            const message = game._pending_message || '';
            if (/In what direction\?/.test(message))
                return 'h'.charCodeAt(0);
            acknowledgements.push(message);
            return ' '.charCodeAt(0);
        },
    };
    await rhack('f'.charCodeAt(0));
    assert.ok(acknowledgements.some(text => /But wait\.\.\./.test(text)), 'the amulet must save the exploding death');
    assert.ok(!game.program_state.gameover, 'the hero survives the volley');
    assert.equal(game.uamul, null, 'the amulet crumbles');
    // One dagger killed the spore; the announced second shot never flies.
    assert.equal(daggers.quan, 4, 'savelife() cuts the volley back to the current missile');
});
//# sourceMappingURL=end_lifesaving_volley.test.js.map