import assert from 'node:assert/strict';
import test from 'node:test';
import { applyHeroLocationEffects } from '../js/cmd.js';
import { LAVAPOOL, TT_LAVA } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { freshObjectRoom } from './support/object-room.js';

// C polymon() calls spoteffects() for a non-levitating hero in lava.  With
// the terrainstatus option off iflags.terrain_typ stays MAX_TYPE, so
// switch_terrain() runs and float_up() reports the stuck lower body.
void test('a hero stuck in lava who becomes a floater strains upward but stays stuck', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    game.u.fireResistance = true;
    game.u.utrap = 1 << 8;
    game.u.utraptype = TT_LAVA;
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message || game._last_message || '');
        input.feed(' ');
    };
    // An earlier spot effect on this square, as when the hero sank there.
    await applyHeroLocationEffects();
    messages.length = 0;

    await polymonHero(MONSTER_NAME.indexOf('floating eye'));

    messages.push(game._pending_message || game._last_message || '');
    assert.ok(messages.some(message => /Your body pulls upward, but your .+ are still stuck\./.test(message)),
        messages.join(' | '));
    assert.equal(game.u.utraptype, TT_LAVA);
});
