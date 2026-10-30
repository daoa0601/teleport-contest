import { resetInputState } from '../js/input.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { THRONE } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a throne updates the displayed purse after taking carried gold', async () => {
    const level = await freshObjectRoom();
    level.requireAt(10, 10).typ = THRONE;
    setHeroGoldAmount(game, 250);
    await bot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\$:250\b/);
    initRng(125n);
    await runExtendedCommand('sit', ' '.repeat(10));
    await flush_screen(1);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\$:0\b/);
});
void test('gold confiscation refreshes the purse before its announcement pages', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    level.requireAt(10, 10).typ = THRONE;
    setHeroGoldAmount(game, 250);
    await bot();
    initRng(125n);
    const input = resetInputState();
    let sawAnnouncement = false;
    let answeringEffect = false;
    input.display = {
        async readKey() {
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            if (message.startsWith('Throne sit effect')) {
                if (!answeringEffect) {
                    answeringEffect = true;
                    return '5'.charCodeAt(0);
                }
                return 13;
            }
            if (message.startsWith('Analyze throne?'))
                return 'n'.charCodeAt(0);
            assert.match(message, /--More--/);
            if (message.includes('You notice you have no gold!')) {
                assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\$:0\b/);
                sawAnnouncement = true;
            }
            return 32;
        },
    };
    try {
        await runExtendedCommand('sit');
    }
    finally {
        input.display = null;
    }
    assert.equal(sawAnnouncement, true);
});
//# sourceMappingURL=throne_gold_status.test.js.map