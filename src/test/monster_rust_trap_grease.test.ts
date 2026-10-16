import assert from 'node:assert/strict';
import test from 'node:test';

import { RUST_TRAP, W_ARMH } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { placeMonsterAt } from '../js/monster_location.js';
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
            const messages: string[] = [];

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
            assert.equal(monsterName(monster), nextName,
                'Silent grease protection must preserve the next perceived monster name');
        });
    }
}

// C trapeffect_rust_trap(): an unseen rust trap is revealed by seetrap(),
// whose newsym() draws the monster that just stepped onto it before the
// gush message appears.
void test('a monster stepping onto an unseen rust trap is drawn there before the gush', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(RUST_TRAP, { x: 12, y: 10 });
    trap.tseen = false;
    placeMonsterAt(monster, 13, 10);
    newsym(12, 10);
    newsym(13, 10);
    placeMonsterAt(monster, 12, 10);
    newsym(13, 10);
    const cell = () => requireGameDisplay().grid[10 + 1]?.[12 - 1]?.ch;
    assert.notEqual(cell(), 'H');
    let shownAtMessage: string | undefined;

    const event = await beginMonsterRustTrap(monster, trap, game, { random: () => 4 });
    await finishMonsterRustTrap(monster, event, game, {
        publish: async () => {
            await flush_screen(1);
            shownAtMessage ??= cell();
        },
    });

    assert.equal(trap.tseen, true);
    assert.equal(shownAtMessage, 'H');
});
