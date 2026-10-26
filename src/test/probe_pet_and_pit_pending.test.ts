import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { climbOutOfPit } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { TT_PIT, W_CHAIN } from '../js/const.js';
import { IRON_CHAIN, WAN_PROBING } from '../js/object_data.js';
import { applyWandEffect } from '../js/wand_effects.js';
import { chargedWand, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshGameplayRoom, freshTurnRoom } from './support/playable-room.js';

// C zap.c:probe_monster() formats the carrier with noit_Monnam():
// ARTICLE_YOUR plus SUPPRESS_IT, so a tame animal reads "Your kitten"
// even though the hero has no ownership claim on hostiles.
void test('probing an empty-handed pet names it as yours', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    installPagerInput(resetInputState(), { expected: /kitten|Status/i, limit: 10 });
    const kitten = await createMonsterAt('kitten', 12, 10);
    kitten.mtame = 1;
    kitten.mpeaceful = true;
    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    const wand = await chargedWand(WAN_PROBING);
    await applyWandEffect(wand);
    assert.match(String(game._toplines ?? ''), /Your kitten is not carrying anything\./);
});

// C pline.c's Norep suppression returns before any tty output, so a
// suppressed repeat leaves the pending topline alone.  climb_pit() reports
// "You are still in a pit." through Norep on every failed attempt, and the
// escape message joins the still-pending line instead of replacing it.
void test('a repeated pit struggle keeps the pending topline', async () => {
    freshTurnRoom();
    game.u.utrap = 2;
    game.u.utraptype = TT_PIT;
    await climbOutOfPit();
    assert.equal(game._pending_message, 'You are still in a pit.');
    await climbOutOfPit();
    assert.equal(game.u.utrap, 0);
    assert.equal(game._pending_message, 'You are still in a pit.  You crawl to the edge of the pit.');
});

// C hack.c:pickup_checks() tests OBJ_AT, which counts the punishment
// chain.  A chain-only square never reaches the "nothing here to pick up"
// complaint; the pickup menu filters the chain into an empty selection.
void test('picking up on a chain-only square stays quiet', async () => {
    freshTurnRoom();
    resetInputState();
    const chain = await floorObject(IRON_CHAIN, game.u.ux, game.u.uy, { owornmask: W_CHAIN });
    game.uchain = chain;
    game.u.uchain = chain;
    await rhack(','.charCodeAt(0));
    assert.equal(game._pending_message, '');
    assert.equal(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim(), '');
    assert.equal(chain.where, 'floor');
    assert.equal(game.inventory.includes(chain), false);
    assert.equal(game.context.move, 0);
});
