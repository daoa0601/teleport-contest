import assert from 'node:assert/strict';
import test from 'node:test';
import { DIR_E, NO_MINVENT } from '../js/const.js';
import { clearMessageWindow, pline_dir, pline_mon, pline_xy, plineWithContinuation, set_msg_xy } from '../js/display.js';
import { applyNethackrc } from '../js/options.js';
import { game } from '../js/gstate.js';
import { triggerMonsterDoorTrap } from '../js/monster_door_trap.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
void test('accessible door explosions identify the monster square before the message', async () => {
    freshPlayableRoom({ flags: { accessiblemsg: true, verbose: true } });
    const monster = await createMonsterAt('orc', game.u.ux + 2, game.u.uy, NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    await triggerMonsterDoorTrap(monster, true);
    assert.match(game._pending_message, /^\(2east\): KABOOM!!  You see a door explode\./);
});
void test('directional messages use the chosen coordinate style', async () => {
    freshPlayableRoom({ flags: { accessiblemsg: true } });
    game.iflags.getpos_coords = 'm';
    await pline_dir(DIR_E, 'A door opens.');
    assert.equal(game._pending_message, '<11,10>: A door opens.');
});
void test('a hero message has no location prefix', async () => {
    freshPlayableRoom({ flags: { accessiblemsg: true } });
    await pline_mon(game.u, 'You stagger.');
    assert.equal(game._pending_message, 'You stagger.');
});
for (const suppressed of ['empty', 'hidden', 'starting-kit', 'disabled accessibility']) {
    void test(`a location is consumed by ${suppressed} prose`, async () => {
        freshPlayableRoom({ flags: { accessiblemsg: suppressed !== 'disabled accessibility' } });
        if (suppressed === 'hidden')
            applyNethackrc('MSGTYPE=hide "distant"');
        if (suppressed === 'starting-kit')
            game.program_state.wizkit_wishing = true;
        set_msg_xy(15, 10);
        await plineWithContinuation(suppressed === 'empty' ? '' : 'A distant sound.');
        clearMessageWindow();
        game.program_state.wizkit_wishing = false;
        game.flags.accessiblemsg = true;
        await plineWithContinuation('A bell rings.');
        assert.equal(game._pending_message, 'A bell rings.');
    });
}
void test('coordinate message prefixes follow screen coordinates and are used for filtering', async () => {
    freshPlayableRoom({ flags: { accessiblemsg: true } });
    game.iflags.getpos_coords = 's';
    applyNethackrc('MSGTYPE=hide "^\\[12,12\\]"');
    await pline_xy(12, 10, 'A bell rings.');
    assert.equal(game._pending_message, '');
});
//# sourceMappingURL=pline_location.test.js.map