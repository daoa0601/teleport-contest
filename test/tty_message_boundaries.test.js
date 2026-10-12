import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { beginHeroEngulf } from '../js/hero_engulf.js';
import { resetInputState } from '../js/input.js';
import { AT_ENGL } from '../js/monster_attack_types.js';
import { MONSTER_ATTACKS } from '../js/monster_data.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function messageRow() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
void test('leaving the terrain browser clears Done after its acknowledgment and restores the hero', async () => {
    freshObjectRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    const input = resetInputState();
    const browsing = runExtendedCommand('terrain');
    try {
        await input.waitUntilBlocked();
        assert.match(messageRow(), /View which\?/);
        input.feed('a');
        await input.waitUntilBlocked();
        assert.match(messageRow(), /Move cursor|Showing known terrain/);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.equal(messageRow(), 'Done.--More--');
    }
    finally {
        input.feed(' ');
        await browsing;
    }
    await flush_screen(1);
    assert.equal(messageRow(), '');
    assert.equal(requireGameDisplay().getChar(game.u.ux, game.u.uy + 2), '@');
    assert.equal(game.context.move, 0);
});
void test('engulf entry clears the acknowledged announcement before drawing the stomach', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('purple worm', 11, 10, NO_MINVENT);
    const attack = MONSTER_ATTACKS[monster.mnum]?.find(entry => entry[0] === AT_ENGL);
    assert.ok(attack, 'The purple worm must have an engulf attack');
    const oldX = monster.mx;
    const oldY = monster.my;
    placeMonsterAt(monster, game.u.ux, game.u.uy);
    game.u.ustuck = monster;
    await plineWithContinuation('You hit the purple worm.');
    const input = resetInputState();
    const capture = beginHeroEngulf(monster, {
        kind: 'hero-attack', attackType: AT_ENGL, hit: true,
        damageType: attack[1], engulfOldX: oldX, engulfOldY: oldY,
    });
    try {
        await input.waitUntilBlocked();
        assert.match(messageRow(), /swallows you whole!--More--$/);
        assert.equal(!!game.u.uswallow, false, 'Capture waits for the announcement acknowledgment');
    }
    finally {
        input.feed(' ');
        assert.equal((await capture).captured, true);
    }
    await flush_screen(1);
    assert.equal(messageRow(), '');
    assert.equal(game.u.uswallow, 1);
    assert.equal(requireGameDisplay().getChar(game.u.ux - 1, game.u.uy + 1), '/');
});
void test('a cancelled vortex can engulf without leaving its acknowledged announcement', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('fire vortex', 11, 10, MM_ANGRY | NO_MINVENT);
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    monster.mcan = 1;
    const input = resetInputState();
    const attack = performMonsterHeroAttack(monster, game, {
        random: () => 0, rollOne: () => 1, rollDice: () => 1,
    });
    try {
        const boundary = await Promise.race([
            input.waitUntilBlocked().then(() => 'announcement'),
            attack.then(() => 'finished'),
        ]);
        assert.equal(boundary, 'announcement', 'The vortex must wait for its capture announcement');
        assert.match(messageRow(), /The fire vortex engulfs you!--More--$/);
    }
    finally {
        input.feed(' ');
        assert.equal((await attack).heroDied, false);
    }
    await flush_screen(1);
    assert.equal(game.u.uswallow, 1);
    assert.equal(messageRow(), '');
    assert.equal(game.u.uhp, game.u.uhpmax);
});
//# sourceMappingURL=tty_message_boundaries.test.js.map