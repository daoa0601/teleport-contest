import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_MINVENT, W_AMUL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { petrifyMonsterImmediately } from '../js/monster_stoning.js';
import { AMULET_OF_LIFE_SAVING, STATUE } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const deathOwner of ['hero', 'dungeon'] as const) {
    void test(`a hero escapes a petrified digestive engulfer during a ${deathOwner} kill`, async () => {
        const level = freshObjectRoom();
        const worm = await createMonsterAt('purple worm', 11, 10, NO_MINVENT);
        await installSwallowedHero(worm);
        const x = worm.mx, y = worm.my;
        const messages: string[] = [];
        const publish = async (message: string) => {
            if (message.includes('opening in the new'))
                assert.equal(game.u.uswallow, 0, 'the escape is described after releasing the hero');
            messages.push(message);
        };

        if (deathOwner === 'hero') {
            await finishHeroMonsterKill(worm, worm.mx, worm.my, {
                petrified: true, showKillMessage: false, publish,
            });
        } else {
            await petrifyMonsterImmediately(worm, {
                publish,
                finishDeath: (monster, options) => finishEnvironmentalMonsterDeath(monster, game, options),
            });
        }

        assert.equal(game.u.uswallow, 0);
        assert.equal(worm.dead, true);
        assert.ok(floorObjectsAt(level, x, y).some(object => object.otyp === STATUE));
        assert.ok(messages.includes('You jump through an opening in the new statue of a purple worm.'),
            `expected the statue escape; messages: ${messages.join(' | ')}`);
    });
}

for (const scenario of ['non-digestive', 'shapeshifter', 'life-saved'] as const) {
    void test(`a ${scenario} engulfer does not announce escape through stone`, async () => {
        freshObjectRoom();
        const engulfer = await createMonsterAt(scenario === 'non-digestive' ? 'energy vortex' : 'purple worm',
            11, 10, NO_MINVENT);
        if (scenario === 'shapeshifter') engulfer.cham = MONSTER_NAME.indexOf('chameleon');
        if (scenario === 'life-saved')
            await equipMonsterObject(engulfer, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
        await installSwallowedHero(engulfer);
        const messages: string[] = [];

        await finishHeroMonsterKill(engulfer, engulfer.mx, engulfer.my, {
            petrified: true, showKillMessage: false,
            publish: async (message: string) => { messages.push(message); },
        });

        assert.equal(game.u.uswallow, scenario === 'life-saved' ? 1 : 0);
        assert.equal(messages.some(message => message.includes('opening in the new')), false);
    });
}
