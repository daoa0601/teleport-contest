import assert from 'node:assert/strict';
import test from 'node:test';
import { glyphAt, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { finishMonsterAttackDeath } from '../js/monster_attack_death.js';
import { WAX_CANDLE } from '../js/object_data.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function remembered(x: number, y: number): string | undefined {
    const glyph = glyphAt(x, y);
    return glyph?.kind === 'terrain' ? glyph.terrainName : glyph?.kind;
}

void test('a light lit just before a fatal blow shows its area before the death pager', async () => {
    const level = freshObjectRoom({ left: 2, right: 30, flags: { debug: true } });
    requirePlayingGame(game);
    for (let x = 2; x <= 30; x++) {
        for (let y = 6; y <= 14; y++) {
            level.requireAt(x, y).lit = false;
            level.requireAt(x, y).waslit = false;
        }
    }
    vision_reset();
    vision_recalc(0);
    const far = { x: game.u.ux + 2, y: game.u.uy };
    assert.equal(remembered(far.x, far.y), 'dark part of a room');
    const killer = await createMonsterAt('arch-lich', game.u.ux - 1, game.u.uy);
    const candles = await addInventoryObject(WAX_CANDLE, { quantity: 9, age: 200 });
    assert.ok(candles);
    await plineWithContinuation('Your candles catch light!');
    beginObjectBurn(candles);
    game.u.uhp = 0;
    const input = resetInputState();

    // You("die...") runs vpline(), which applies the pending vision change
    // before tty pages the older message.
    const dying = finishMonsterAttackDeath(killer, {
        attribution: { kind: 'death-inflicted-by', killer: 'the touch of death', announcesDeath: true },
    });
    await input.waitUntilBlocked();
    try {
        assert.equal(remembered(far.x, far.y), 'floor of a room');
    } finally {
        input.feed(' n' + ' '.repeat(10));
        await dying;
    }
});
