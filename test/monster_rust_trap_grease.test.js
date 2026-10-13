import assert from 'node:assert/strict';
import test from 'node:test';
import { RUST_TRAP, W_ARMH } from '../js/const.js';
import { game } from '../js/gstate.js';
import { monsterName } from '../js/monster_name.js';
import { HELMET } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { beginMonsterRustTrap, finishMonsterRustTrap } from '../js/rust_trap.js';
import { knownObject } from './support/game-objects.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { equipMonsterObject } from './support/monsters.js';
for (const hallucinating of [false, true]) {
    for (const greaseRoll of [0, 1]) {
        void test(`a rust trap silently protects greased monster armor when grease ${greaseRoll ? 'stays' : 'washes off'}${hallucinating ? ' during hallucination' : ''}`, async () => {
            const { monster, trap } = await freshMonsterTrapRoom(RUST_TRAP);
            const helmet = await knownObject(HELMET, { greased: true });
            await equipMonsterObject(monster, helmet, W_ARMH);
            game.u.hallucinationTurns = hallucinating ? 20 : 0;
            initRng(33n);
            const hitName = monsterName(monster);
            const nextName = monsterName(monster);
            initRng(33n);
            const messages = [];
            const event = await beginMonsterRustTrap(monster, trap, game, {
                random: limit => limit === 5 ? 0 : greaseRoll,
            });
            await finishMonsterRustTrap(monster, event, game, {
                publish: text => { messages.push(text); },
            });
            assert.equal(messages.length, 1, `Only the water hit should be announced; saw ${messages.join(' | ')}`);
            assert.equal(messages[0], `A gush of water hits ${hitName} on the head!`);
            assert.equal(helmet.greased, greaseRoll !== 0);
            assert.equal(helmet.oeroded ?? 0, 0);
            assert.equal(monsterName(monster), nextName, 'Silent grease protection must preserve the next perceived monster name');
        });
    }
}
//# sourceMappingURL=monster_rust_trap_grease.test.js.map