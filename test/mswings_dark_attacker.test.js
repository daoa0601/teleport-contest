import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { NO_MINVENT, W_WEP } from '../js/const.js';
import { canSeeMonster, monsterVisible } from '../js/display.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { vision_recalc, cansee } from '../js/vision.js';
// C mhitu.c:mswings() gates its swing line on flags.verbose && !Blind
// && mon_visible(mtmp), not canseemon().  When the hero has just stepped
// next to a wielder, the attack can run while vision still describes the
// previous position (C allmain.c recalculates after domove()), so an
// unlit-room attacker is named "It" (Monnam of an unspot-able monster,
// mhis() degrading to "its") while its swing is still announced.
void test('a wielder attacking from a square the hero cannot see is introduced as "It"', async () => {
    await freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const level = requireGameLevel();
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) {
            level.requireAt(x, y).lit = false;
            level.requireAt(x, y).waslit = false;
        }
    }
    await vision_recalc(0);
    const elf = await createMonsterAt('Green-elf', 12, 10, NO_MINVENT);
    await equipMonsterObject(elf, await knownObject(OBJECT_NAMES.indexOf('broadsword'), {
        typeKnown: false, known: false,
    }), W_WEP);
    elf.mpeaceful = 0;
    // The elf's square is two steps from the hero, outside night vision's
    // adjacent ring, so the current vision array does not cover it.
    assert.equal(game.u.ux, 10);
    assert.equal(cansee(12, 10), false);
    // The hero completes a step east without a vision refresh yet, and the
    // elf strikes the new position: mon_visible() is true, canseemon() is
    // not, and the swing line still prints.
    game.u.ux = 11;
    elf.mux = 11;
    elf.muy = 10;
    assert.equal(monsterVisible(elf), true);
    assert.equal(canSeeMonster(elf), false);
    await performMonsterHeroAttack(elf, game, {
        random: () => 0, rollOne: () => 1, rollDice: () => 0,
    });
    assert.match(game._pending_message ?? '', /^It swings its broadsword\./, 'the unspot-able wielder announces its swing');
});
//# sourceMappingURL=mswings_dark_attacker.test.js.map