import assert from 'node:assert/strict';
import test from 'node:test';
import { RUST_TRAP, SQKY_BOARD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { triggerImmediateMonsterTrap, resumeDeferredMonsterTrap } from '../js/monmove.js';
import { beginMonsterRustTrap, finishMonsterRustTrap } from '../js/rust_trap.js';
import { parseNethackrc } from '../js/options.js';
import { makedog } from '../js/u_init.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [target, message] of [
    [3, 'A gush of water hits Sirius!'],
    [1, "A gush of water hits Sirius's left foreleg!"],
]) {
    void test(`a rust trap preserves a pet's given name when targeting ${target}`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(RUST_TRAP, {
            monster: { species: 'little dog' },
        });
        setMonsterGivenName(monster, 'Sirius');
        const messages = [];
        const event = await beginMonsterRustTrap(monster, trap, game, { random: () => target });
        await finishMonsterRustTrap(monster, event, game, { publish: text => { messages.push(text); } });
        assert.equal(messages[0], message);
    });
}
void test('a squeaky board addresses a named pet without a species article', async () => {
    const { monster } = await freshMonsterTrapRoom(SQKY_BOARD, {
        monster: { species: 'little dog' }, trap: { tnote: 10 },
    });
    setMonsterGivenName(monster, 'Idefix');
    requirePlayingGame(game);
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, { publish: text => { messages.push(text); } });
    assert.equal(messages[0], 'A board beneath Idefix squeaks a B flat loudly.');
});
void test('a configured dog name overrides the role default and preserves its case', async () => {
    const settings = parseNethackrc('OPTIONS=dogname:Sir Wags');
    freshObjectRoom({ role: 'ranger', flags: settings.flags });
    game.preferred_pet = 'd';
    const pet = await makedog();
    assert.ok(pet);
    assert.equal(pet.mgivenname, 'Sir Wags');
});
//# sourceMappingURL=pool_pet_naming.test.js.map