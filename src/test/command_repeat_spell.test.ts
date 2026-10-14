import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_FULL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { SPE_LIGHT } from '../js/object_data.js';
import { forceLearnSpell } from '../js/spell.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('repeat reuses a spell selected from its menu', async () => {
    const input = freshTurnRoom({ role: 'wizard', heroLevel: 20, energy: 100,
        flags: { menu_style: MENU_FULL } });
    requirePlayingGame(game);
    forceLearnSpell(SPE_LIGHT);
    input.feed('Za');
    await rhack(0);
    const energy = game.u.uen;
    input.feed('\x01h\x1b');
    await rhack(0);
    assert.ok(game.u.uen < energy, 'repeating casts the same spell again');
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
