import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, W_AMUL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
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
for (const deathOwner of ['hero', 'dungeon']) {
    void test(`a hero escapes a petrified digestive engulfer during a ${deathOwner} kill`, async () => {
        const level = freshObjectRoom();
        const worm = await createMonsterAt('purple worm', 11, 10, NO_MINVENT);
        await installSwallowedHero(worm);
        const x = worm.mx, y = worm.my;
        const messages = [];
        const publish = async (message) => {
            if (message.includes('opening in the new'))
                assert.equal(game.u.uswallow, 0, 'the escape is described after releasing the hero');
            messages.push(message);
        };
        if (deathOwner === 'hero') {
            await finishHeroMonsterKill(worm, worm.mx, worm.my, {
                petrified: true, showKillMessage: false, publish,
            });
        }
        else {
            await petrifyMonsterImmediately(worm, {
                publish,
                finishDeath: (monster, options) => finishEnvironmentalMonsterDeath(monster, game, options),
            });
        }
        assert.equal(game.u.uswallow, 0);
        assert.equal(worm.dead, true);
        assert.ok(floorObjectsAt(level, x, y).some(object => object.otyp === STATUE));
        assert.ok(messages.includes('You jump through an opening in the new statue of a purple worm.'), `expected the statue escape; messages: ${messages.join(' | ')}`);
    });
}
for (const scenario of ['non-digestive', 'shapeshifter', 'life-saved']) {
    void test(`a ${scenario} engulfer does not announce escape through stone`, async () => {
        freshObjectRoom();
        const engulfer = await createMonsterAt(scenario === 'non-digestive' ? 'energy vortex' : 'purple worm', 11, 10, NO_MINVENT);
        if (scenario === 'shapeshifter')
            engulfer.cham = MONSTER_NAME.indexOf('chameleon');
        if (scenario === 'life-saved')
            await equipMonsterObject(engulfer, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
        await installSwallowedHero(engulfer);
        const messages = [];
        await finishHeroMonsterKill(engulfer, engulfer.mx, engulfer.my, {
            petrified: true, showKillMessage: false,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(game.u.uswallow, scenario === 'life-saved' ? 1 : 0);
        assert.equal(messages.some(message => message.includes('opening in the new')), false);
    });
}
for (const visible of [false, true]) {
    void test(`${visible ? 'visible hero-caused' : 'unseen dungeon-caused'} petrification omits unseen kill-credit feedback after life saving`, async () => {
        freshObjectRoom();
        const worm = await createMonsterAt('purple worm', 11, 10, NO_MINVENT);
        await equipMonsterObject(worm, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
        if (!visible)
            await installSwallowedHero(worm);
        const messages = [];
        pushKeys(' '.repeat(20));
        const result = await petrifyMonsterImmediately(worm, {
            creditHero: visible,
            publish: async (message) => { messages.push(message); },
            finishDeath: (monster, options) => finishEnvironmentalMonsterDeath(monster, game, options),
        });
        assert.equal(result.survived, true);
        assert.equal(messages.includes('Maybe not...'), false);
    });
}
//# sourceMappingURL=monster_stone_escape.test.js.map