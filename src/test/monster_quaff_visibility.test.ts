import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { A_WIS, NO_MINVENT } from '../js/const.js';
import { canSpotMonster, canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, POT_SPEED } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns, syncDeafness } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const [kind, otyp] of [
    ['healing', POT_HEALING], ['gain level', POT_GAIN_LEVEL],
    ['invisibility', POT_INVISIBILITY], ['speed', POT_SPEED],
] satisfies [string, number][]) {
    for (const perception of ['visible', 'visible and deaf', 'sensed', 'sensed and deaf']) {
        void test(`${kind} quaff feedback when the monster is ${perception}`, async () => {
            const visible = perception.startsWith('visible');
            const quantity = visible ? 3 : 1;
            const input = freshTurnRoom({ left: 10, right: 14, top: 10, bottom: 10 });
            requirePlayingGame(game);
            const messages: string[] = [];
            input.beforeRead = () => { messages.push((game._screen_output.split('\n')[0] ?? '')); };
            if (otyp === POT_HEALING) {
                const blocker = await createMonsterAt('goblin', 13, 10, NO_MINVENT);
                blocker.mpeaceful = 0;
                blocker.msleeping = 1;
                blocker.mfrozen = 100;
                blocker.mcanmove = 0;
            }
            const monster = await createMonsterAt('goblin', 14, 10, NO_MINVENT);
            monster.mpeaceful = 0;
            monster.msleeping = 0;
            monster.movement = 12;
            monster.mhp = 2;
            monster.mhpmax = 20;
            const potion = await knownObject(otyp, {
                quan: quantity,
                dknown: false, bknown: false, known: false, typeKnown: false,
            });
            await addObjectToMonsterInventory(monster, potion);
            game._knownObjectTypes = new Set();
            game.u.acurr.a[A_WIS] = 3;
            game.u.amax.a[A_WIS] = 3;
            grantIntrinsicProperty('telepathy', 'outside');
            if (!visible) setHeroBlindnessTurns(20);
            game.u.deafTurns = perception.endsWith('and deaf') ? 20 : 0;
            syncDeafness();
            vision_recalc(0);
            assert.equal(canSpotMonster(monster), true);
            assert.equal(canSeeMonster(monster), visible);
            initRng(otyp === POT_HEALING ? 2n : 1n);
            pushKeys('m.' + ' '.repeat(80) + 'm.');

            await moveloop_core();
            await moveloop_core();

            if (quantity === 1) {
                assert.ok(!monster.minvent.includes(potion), 'the monster consumed the potion');
            } else {
                assert.ok(monster.minvent.includes(potion));
                assert.equal(potion.quan, quantity - 1, 'the monster consumed one potion');
            }
            const feedback = messages.join(' | ');
            assert.equal(potion.dknown, visible, feedback);
            assert.equal(game._knownObjectTypes.has(otyp), visible, feedback);
            if (visible) {
                assert.equal(game.u._exercise?.[A_WIS] ?? 0, 1, 'the first discovery exercises Wisdom');
                assert.match(feedback, /drinks .*potion!/);
                assert.doesNotMatch(feedback, /chugging sound/);
            } else {
                assert.doesNotMatch(feedback, /drinks|looks better|more experienced|transparency|transparent|moving .*faster/);
                if (perception === 'sensed') assert.match(feedback, /You hear a chugging sound\./);
                else assert.doesNotMatch(feedback, /chugging sound/);
            }
        });
    }
}
