import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { flush_screen } from '../js/display.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
function collectLines() {
    const lines = [];
    const input = resetInputState();
    input.beforeRead = () => {
        for (const line of game._pending_message?.split('\n') ?? [])
            lines.push(line);
        game._pending_message = '';
        input.feed(' ');
    };
    return lines;
}
// C sit.c:special_throne_effect() case 8 schedules a level change whose
// "You feel extremely out of place." line is the deferred post-message of
// do.c:deferred_goto() (do.c:2096); it prints after goto_level() finishes,
// i.e. after do.c:hellish_smoke_mesg()'s "It is hot here. You smell
// smoke..." (do.c:2014) that the arrival itself produced.
void test('the throne arrival message follows the Gehennom temperature lines', async () => {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 1 } }, seed: 3n });
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 5 }),
        createDungeon({ dname: 'Gehennom', num_dunlevs: 3, flags: { hellish: true } }),
    ];
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    // Generate the destination level and mark it hot, then leave it again.
    collectLines();
    await gotoLevel({ dnum: 1, dlevel: 2 });
    collectLines();
    if (game.level)
        game.level.flags.temperature = 1;
    await gotoLevel({ dnum: 0, dlevel: 1 });
    collectLines();
    const lines = collectLines();
    await gotoLevel({ dnum: 1, dlevel: 2 }, { postMessage: 'You feel extremely out of place.' });
    await flush_screen();
    for (const line of game._pending_message?.split('\n') ?? [])
        lines.push(line);
    game._pending_message = '';
    const text = lines.join('\n');
    const deferred = text.split('You feel extremely out of place.').length - 1;
    assert.equal(deferred, 1, 'the deferred throne message prints exactly once');
    const temperature = text.indexOf('It is hot here.');
    const smoke = text.indexOf('smoke...');
    const after = text.indexOf('You feel extremely out of place.');
    assert.ok(temperature >= 0, `the Gehennom temperature line prints (got: ${text})`);
    assert.ok(smoke >= 0, 'the smoke line prints');
    assert.ok(temperature < after && smoke < after, `the deferred message follows the temperature lines (got: ${text})`);
});
//# sourceMappingURL=throne_arrival_order.test.js.map