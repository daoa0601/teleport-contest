import test from 'node:test';
import assert from 'node:assert/strict';
import { findArmorClass } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT, STONE, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { setMonsterApparentHeroPosition } from '../js/monster_perception.js';
import { attackHeroWithPolearm } from '../js/monster_polearm.js';
import { LANCE } from '../js/object_data.js';
import { rn2 } from '../js/rng.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjects } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function soldierWithLance(x, y) {
    const soldier = await createMonsterAt('soldier', x, y, NO_MINVENT);
    await equipMonsterObject(soldier, await knownObject(LANCE, { spe: 3 }), W_WEP);
    setMonsterApparentHeroPosition(soldier, game, rn2);
    findArmorClass();
    return soldier;
}
void test('a monster can strike at a knight\'s move distance without throwing its lance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await soldierWithLance(12, 11);
    requirePlayingGame(game);
    const lance = soldier.mw;
    assert.ok(lance);
    const health = game.u.uhp;
    const messages = [];
    pushKeys('20s');
    await rhack(0);
    await attackHeroWithPolearm(soldier, lance, game, {
        publish: async (message) => messages.push(message),
    });
    assert.ok(game.u.uhp < health, 'the lance should reach the hero');
    assert.equal(soldier.mw, lance);
    assert.ok(soldier.minvent.includes(lance));
    assert.equal(floorObjects(game.level).includes(lance), false);
    assert.ok(messages.some(message => message.includes('hit by a lance')));
    assert.ok(messages.includes('You stop searching.'));
    assert.equal(game._occupation, null);
});
for (const { obstacle, x, y, name } of [
    { x: 12, y: 12, name: 'two squares diagonally away' },
    { x: 12, y: 10, obstacle: true, name: 'behind a wall' },
]) {
    void test(`a monster cannot reach the hero with a polearm ${name}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const soldier = await soldierWithLance(x, y);
        requirePlayingGame(game);
        if (obstacle) {
            game.level.requireAt(11, 10).typ = STONE;
            vision_reset();
            vision_recalc(0);
        }
        const health = game.u.uhp;
        const messages = [];
        assert.ok(soldier.mw);
        assert.ok(soldier.mw);
        await attackHeroWithPolearm(soldier, soldier.mw, game, {
            publish: async (message) => messages.push(message),
        });
        assert.equal(game.u.uhp, health);
        assert.equal(messages.length, 0);
    });
}
void test('a polearm damages the hero\'s current monster body, not saved human health', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('minotaur', { hitPoints: 60 });
    const soldier = await soldierWithLance(12, 11);
    requirePlayingGame(game);
    const humanHealth = game.u.uhp;
    assert.ok(soldier.mw);
    await attackHeroWithPolearm(soldier, soldier.mw, game, {
        publish: async () => { },
    });
    assert.ok(game.u.mh < 60, 'the current body should take damage');
    assert.equal(game.u.uhp, humanHealth);
});
//# sourceMappingURL=monster_polearm.test.js.map