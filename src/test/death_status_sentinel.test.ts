import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishMonsterAttackDeath } from '../js/monster_attack_death.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('fatal damage of minus one retains both health numbers through the death pager', async () => {
    freshObjectRoom({ hero: { uhp: 81, uhpmax: 108 }, flags: { debug: true } });
    requirePlayingGame(game);
    const lich = await createMonsterAt('arch-lich', 11, 10);
    await bot();
    await plineWithContinuation('You feel drained...');
    game.u.uhpmax = 67;
    game.u.uhp = -1;
    const input = resetInputState();
    const dying = finishMonsterAttackDeath(lich, {
        damage: { hpKey: 'uhp', hpBefore: 67, damage: 68 },
        attribution: { kind: 'death-inflicted-by', killer: 'the touch of death', announcesDeath: true },
    });
    await input.waitUntilBlocked();
    input.feed(' ');
    await input.waitUntilBlocked();
    try {
        const status = requireGameDisplay().grid[23]?.map(cell => cell.ch).join('') ?? '';
        assert.match(status, /HP:81\(108\)/);
    } finally {
        input.feed(' n' + ' '.repeat(10));
        await dying;
    }
});
