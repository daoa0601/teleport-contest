import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { A_WIS, G_EXTINCT, NO_MINVENT } from '../js/const.js';
import { canSpotMonster, canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { findMonsterDefensiveItem, useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, POT_SPEED } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns, syncDeafness } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
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
                const wisdomExercise = game.u._exercise?.[A_WIS] ?? 0;
                assert.ok(wisdomExercise === 0 || wisdomExercise === 1,
                    'the first discovery has one chance to exercise Wisdom');
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

for (const wisdom of [3, 18]) {
    void test(`visible healing discovery ${wisdom === 3 ? 'can' : 'cannot'} increase exercise at Wisdom ${wisdom}`, async () => {
        let gains = 0;
        for (let seed = 1; seed <= 32; seed++) {
            freshObjectRoom();
            requirePlayingGame(game);
            // Exclude bottle occupants so every trial reaches healing discovery.
            for (const species of ['ghost', 'djinni']) {
                requireMonsterVital(MONSTER_NAME.indexOf(species)).mvflags |= G_EXTINCT;
            }
            const monster = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
            monster.mhp = 2;
            monster.mhpmax = 20;
            monster.mux = game.u.ux;
            monster.muy = game.u.uy;
            const potion = await knownObject(POT_HEALING, { typeKnown: false });
            await addObjectToMonsterInventory(monster, potion);
            game._knownObjectTypes = new Set();
            game.u.acurr.a[A_WIS] = game.u.amax.a[A_WIS] = wisdom;
            const choice = findMonsterDefensiveItem(monster, game);
            assert.ok(choice);
            assert.equal(choice.kind, 'healing');
            initRng(BigInt(seed));
            pushKeys(' '.repeat(20));

            await useMonsterDefensiveItem(monster, choice, { state: game });

            assert.equal(game._knownObjectTypes.has(POT_HEALING), true);
            const exercise = game.u._exercise?.[A_WIS] ?? 0;
            assert.ok(exercise === 0 || exercise === 1, `seed ${seed}: one discovery can add at most one`);
            if (wisdom === 18) assert.equal(exercise, 0, `seed ${seed}: rn2(19) cannot exceed Wisdom 18`);
            gains += exercise;
        }
        if (wisdom === 3) {
            assert.ok(gains > 0, 'some discoveries increase Wisdom exercise');
            assert.ok(gains < 32, 'a discovery does not guarantee an increase');
        }
    });
}
