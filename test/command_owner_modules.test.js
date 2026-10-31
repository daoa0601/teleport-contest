import test from 'node:test';
import assert from 'node:assert/strict';
// dokick.c/fountain.c/pager.c/wizcmds.c command bodies moved out of cmd.ts
// into their C owners; these tests exercise the moved entry points through
// the same command pipeline the game uses.
import { dokick } from '../js/dokick.js';
import { dipFountain } from '../js/fountain.js';
import { showEncyclopediaInformation } from '../js/pager.js';
import { wizLevelChange } from '../js/wizcmds.js';
import { FOUNTAIN, HWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { ROCK } from '../js/object_data.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { kickDirection, runExtendedCommand } from './support/commands.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
assert.equal(typeof dokick, 'function');
assert.equal(typeof dipFountain, 'function');
assert.equal(typeof wizLevelChange, 'function');
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
// C fountain.c:dipfountain(): the bath urge takes some carried gold into the
// fountain before the pager asks for dismissal.
void test('dipFountain: the bath urge loses carried gold', async () => {
    const level = await freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const rock = await addInventoryObject(ROCK);
    setHeroGoldAmount(game, 100);
    const input = resetInputState();
    let dismissals = 0;
    input.display = {
        async readKey() {
            dismissals += 1;
            assert.ok(dismissals <= 3, 'bath, gold-loss, and drying messages bound the dip');
            return 32;
        },
    };
    initRng(52n);
    await runExtendedCommand('dip', `${rock.invlet}y`);
    assert.match(messageLog(), /An urge to take a bath overwhelms you/);
    assert.match(messageLog(), /You lost some of your gold in the fountain!/);
    assert.ok(heroGoldAmount(game) < 100, 'the bath must take some gold');
    assert.equal(game.context.move, 1);
});
// C pager.c:checkfile(): an unknown name has no database entry.
void test('showEncyclopediaInformation: unknown names have no entry', async () => {
    await freshObjectRoom();
    await showEncyclopediaInformation('qwxzzy-no-such-entry');
    assert.match(messageLog(), /You don't have any information on those things\./);
});
// C wizcmds.c:wiz_level_change(): the chosen level is reached from either
// direction and the command takes no game time.
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