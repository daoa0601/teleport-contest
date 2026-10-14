import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction, resumeDeferredMovementSpell } from '../js/monmove.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('infravision reveals a disappearance spell cast from a dark square', async () => {
    const level = freshObjectRoom({ hero: { infravision: true }, flags: { verbose: true } });
    requirePlayingGame(game);
    for (let x = 7; x <= 16; x++) for (let y = 6; y <= 14; y++) level.requireAt(x, y).lit = false;
    const demon = await createMonsterAt('nalfeshnee', 12, 10, NO_MINVENT);
    demon.mpeaceful = 0;
    demon.mflee = 1;
    demon.msleeping = 0;
    vision_recalc(0);
    assert.equal(canSeeMonster(demon), true);
    const random = (limit: number) => limit === demon.m_lev ? 4 : limit - 1;
    const action = await runMonsterAction(demon, game, random);
    if (!action.movement) assert.fail('The caster should take a movement action');
    assert.equal(action.movement.spellCast?.spell, 'disappear');
    const messages: string[] = [];

    await resumeDeferredMovementSpell(action, game, random, undefined, undefined,
        message => { messages.push(message); });

    assert.ok(messages.includes('The nalfeshnee suddenly disappears!'));
    assert.equal(!!demon.minvis, true);
});
