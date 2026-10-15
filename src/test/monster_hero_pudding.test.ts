import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB, DAGGER } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';

for (const form of ['black pudding', 'brown pudding']) {
    for (const metal of [false, true]) {
        void test(`a ${form} hero ${metal ? 'divides when cut by iron' : 'does not divide when hit by wood'}`, async () => {
            freshRoomWithPolymorphedHero(form, { polymorph: { hitPoints: 60 }, hero: { uac: 10 } });
            requirePlayingGame(game);
            const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
            goblin.mux = game.u.ux;
            goblin.muy = game.u.uy;
            await equipMonsterObject(goblin, await knownObject(metal ? DAGGER : CLUB), W_WEP);
            const input = resetInputState();
            const messages: string[] = [];
            input.beforeRead = () => { messages.push(game._pending_message); };
            installPagerInput(input, { expected: /goblin|divide|pudding|weapon/, limit: 12 });

            await performMonsterHeroAttack(goblin, game, {
                random: range => range - 1, rollOne: () => 1, rollDice: count => count,
            });

            const clone = game.level.monsters.find(monster => monster !== goblin && monster.mnum === game.u.umonnum);
            assert.equal(!!clone, metal);
            if (clone) {
                assert.ok(clone.mtame);
                assert.equal(clone.mhpmax, 60, 'Weapon division preserves the original maximum HP in both bodies');
                assert.equal(game.u.mhmax, 60);
                assert.ok(Math.abs(clone.mhp - game.u.mh) <= 1);
                assert.ok(clone.mhp + game.u.mh < 60, 'The weapon hurts before the remaining HP is divided');
                assert.match([...messages, game._pending_message].join('\n'), /You divide as the goblin hits you!/);
            }
        });
    }
}
