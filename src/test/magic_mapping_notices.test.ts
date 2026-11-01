import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { noticeAllMonsters } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { SCR_MAGIC_MAPPING } from '../js/object_data.js';
import { applyScrollEffects } from '../js/read.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const wizard of [false, true]) {
    void test(`${wizard ? 'wizard' : 'scroll'} mapping redraws without announcing monsters`, async () => {
        const level = await freshObjectRoom({
            flags: { debug: true, tips: false, spot_monsters: true },
        });
        requirePlayingGame(game);
        level.flags.hero_memory = false;
        await createMonsterAt('jackal', 12, 10);
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        // Finish any prose pager, then leave the temporary map browser.
        let replies = 0;
        input.display = { async readKey() {
            assert.ok(++replies <= 10, 'mapping must finish its prose and map browser');
            const pager = requireGameDisplay().grid.some(row =>
                row.map(cell => cell.ch).join('').includes('--More--'));
            return pager ? 32 : 27;
        } };

        if (wizard) await runExtendedCommand('wizmap');
        else await applyScrollEffects(await addInventoryObject(SCR_MAGIC_MAPPING));

        messages.push(...game._messageHistory, game._toplines, game._pending_message);
        assert.equal(level.requireAt(40, 10).seenv, 255, 'mapping reveals distant terrain');
        assert.doesNotMatch(messages.join(' | '), /You see a jackal\./,
            'mapping suppresses the redraw notice and does not catch up when it finishes');

        await noticeAllMonsters(game);

        assert.match(game._pending_message, /You see a jackal\./,
            'the next vision catch-up can announce the visible monster');
    });
}
