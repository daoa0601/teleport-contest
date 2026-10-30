import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAVE, SINK, THRONE } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
async function topline() {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
// sit.c:sit() names furniture through defsyms[] explanations; the throne
// explanation is "opulent throne" (include/defsym.h S_throne), not "throne".
void test('sitting on a throne announces the opulent throne', async () => {
    const level = await freshObjectRoom({ flags: { debug: true } });
    level.requireAt(10, 10).typ = THRONE;
    await runExtendedCommand('sit', '\x1b');
    assert.ok((await topline()).startsWith('You sit on the opulent throne.'), `topline was: ${await topline()}`);
});
void test('sitting on a sink or grave keeps the defsyms explanation', async () => {
    const sinkLevel = await freshObjectRoom({ flags: { debug: true } });
    sinkLevel.requireAt(10, 10).typ = SINK;
    await runExtendedCommand('sit', '');
    assert.ok((await topline()).startsWith('You sit on the sink.'), `topline was: ${await topline()}`);
    const graveLevel = await freshObjectRoom({ flags: { debug: true } });
    graveLevel.requireAt(10, 10).typ = GRAVE;
    await runExtendedCommand('sit', '');
    assert.ok((await topline()).startsWith('You sit on the grave.'), `topline was: ${await topline()}`);
});
//# sourceMappingURL=sit_furniture_naming.test.js.map