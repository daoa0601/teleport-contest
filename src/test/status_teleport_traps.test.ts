import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVEL_TELEP, MAGIC_PORTAL } from '../js/const.js';
import { bot, flush_screen, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { finishScheduledLevelChange, gotoLevel } from '../js/level_change.js';
import { activateMagicPortal } from '../js/magic_portal.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('cancelling a level teleport trap displays the resulting confusion', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    const trap = addTrap(level, LEVEL_TELEP, 10, 10);
    const input = resetInputState();
    await bot();

    await answerPrompts(triggerHeroTrap(trap), input, [
        { prompt: /level teleport trap!--More--/, keys: ' ' },
        { prompt: /To what level do you want to teleport\?/, keys: '\x1b' },
    ]);
    await flush_screen(1);

    assert.equal(game.u.confusionTurns, 3);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bConf\b/);
});

void test('a magic portal displays stun while its activation awaits acknowledgment', async () => {
    const { source, destination } = freshConnectedLevels();
    const portal = addTrap(source, MAGIC_PORTAL, 10, 10, { dst: { dnum: 0, dlevel: 2 } });
    addTrap(destination, MAGIC_PORTAL, 12, 10, { dst: { dnum: 0, dlevel: 1 } });
    await bot();
    await plineWithContinuation('You see here 2000 gold pieces.');
    const input = resetInputState();
    let activationSeen = false;
    input.display = {
        async readKey() {
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            assert.match(message, /magic portal!--More--|slightly dizzy.--More--/);
            if (/magic portal!/.test(message)) {
                activationSeen = true;
                assert.equal(game.level, source);
                assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bStun\b/);
            }
            return 32;
        },
    };

    await activateMagicPortal(portal, gotoLevel);
    await finishScheduledLevelChange();

    assert.equal(activationSeen, true);
    assert.equal(game.level, destination);
});
