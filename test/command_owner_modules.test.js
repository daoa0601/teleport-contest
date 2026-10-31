import test from 'node:test';
import assert from 'node:assert/strict';
// dokick.c/fountain.c/pager.c/wizcmds.c command bodies moved out of cmd.ts
// into their C owners; these tests exercise the moved mechanics through the
// command pipeline the game itself uses.
import { showEncyclopediaInformation } from '../js/pager.js';
import { FOUNTAIN, HWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { kickDirection, runExtendedCommand } from './support/commands.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
function messageLog() {
    return [...game._messageHistory, game._toplines, game._pending_message].join('\n');
}
// C dokick.c:dokick()/kick_ouch(): kicking solid rock hurts the hero and
// spends the command's turn.
void test('dokick: kicking a wall draws Ouch and spends the turn', async () => {
    const level = freshGameplayRoom({ role: 'valkyrie', hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = HWALL;
    initRng(7n);
    await kickDirection('l');
    assert.match(messageLog(), /Ouch!  That hurts!/);
    assert.ok((game.u.uhp ?? 0) < 100, 'kicking a wall must cost the hero hit points');
    assert.equal(game.context.move, 1);
});
// C fountain.c:dipfountain() fate 28 with steal.c:somegold(): the bath urge
// takes somegold(money)/10 of the carried gold, and somegold() caps its
// roll at LARGEST_INT (32767), so at most 3276 gold is lost no matter how
// much the hero carries.  The fate is one roll of rnd(30), so search seeds
// for it instead of depending on one seed's earlier draws.
void test('dipFountain: the bath urge loses gold capped by LARGEST_INT', async () => {
    let bathed = false;
    for (let seed = 1n; seed <= 80n && !bathed; seed++) {
        const level = await freshObjectRoom();
        level.requireAt(10, 10).typ = FOUNTAIN;
        const rock = await addInventoryObject(ROCK);
        setHeroGoldAmount(game, 250000);
        resetInputState().display = { async readKey() { return 32; } };
        initRng(seed);
        await runExtendedCommand('dip', `${rock.invlet}y`);
        if (!/An urge to take a bath overwhelms you/.test(messageLog()))
            continue;
        bathed = true;
        const lost = 250000 - heroGoldAmount(game);
        assert.ok(lost >= 500 && lost <= 3276, `somegold()/10 must lie in [500, 3276] at LARGEST_INT, lost ${lost}`);
        assert.match(messageLog(), /You lost some of your gold in the fountain!/);
        assert.equal(game.context.move, 1);
    }
    assert.equal(bathed, true, 'some seed must roll dipfountain fate 28');
});
// C pager.c:checkfile(): an unknown name has no database entry.
void test('showEncyclopediaInformation: unknown names have no entry', async () => {
    await freshObjectRoom();
    await showEncyclopediaInformation('qwxzzy-no-such-entry');
    assert.match(messageLog(), /You don't have any information on those things\./);
});
// C wizcmds.c:wiz_level_change(): the chosen level is reached from either
// direction, ulevelmax follows (wizcmds.c:486), and the command takes no
// game time.
void test('wizLevelChange: lowering the experience level takes no time', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.u.ulevel = 10;
    game.u.ulevelmax = 10;
    await runExtendedCommand('levelchange', `3\n${' '.repeat(50)}`);
    assert.equal(game.u.ulevel, 3);
    assert.equal(game.u.ulevelmax, 3);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=command_owner_modules.test.js.map