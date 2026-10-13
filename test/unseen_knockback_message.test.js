import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { tryKnockback } from '../js/knockback.js';
import { AD_PHYS, AT_CLAW } from '../js/monster_attack_types.js';
import { monsterName } from '../js/monster_name.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a blind hero feels something knocked back without naming the unseen defender', async () => {
    const level = freshObjectRoom({ hero: { blind: true, blindTurns: 20 } });
    requirePlayingGame(game);
    installPolymorphedHero('hill giant');
    const wolf = await createMonsterAt('wolf', 11, 10, NO_MINVENT);
    setHeroBlindnessTurns(20);
    vision_recalc(0);
    level.requireAt(12, 10).typ = STONE;
    const result = await tryKnockback(game.u, wolf, { attackType: AT_CLAW, damageType: AD_PHYS }, {
        random: () => 0, nameMonster: monster => monsterName(monster),
    });
    assert.equal(result.knocked, true);
    assert.equal(wolf.mx, 11);
    assert.match(game._pending_message, /You feel something be knocked back!/);
});
//# sourceMappingURL=unseen_knockback_message.test.js.map