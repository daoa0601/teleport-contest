import test from 'node:test';
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
function topRow(engine) {
    assert.ok(engine.display);
    return (engine.display.grid[0] ?? []).map(cell => cell.ch).join('').trimEnd();
}
// C do_wear.c:off_msg() is silent without flags.verbose, so removing a
// zero-delay jacket prints nothing. A letter typed at the getobj() query
// leaves that query painted; choosing from the '?' menu does not, because
// tty cleared the message window to display the menu.
for (const [how, keys, expected] of [
    ['typed at the query', ['R', 'J'], /^What do you want to remove\? \[\*\]/],
    ['chosen from the menu', ['R', '?', 'J'], /^$/],
]) {
    void test(`a silent jacket removal ${how} leaves the expected top line`, async () => {
        const engine = await runSegment({
            seed: 29371,
            datetime: '20260801120000',
            nethackrc: 'OPTIONS=name:Ann,role:Archeologist,race:human,gender:female,align:lawful,'
                + '!legacy,!tutorial,!autopickup,pettype:none,!verbose',
            moves: '', storage: memoryStorage(),
        });
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
        const jacket = engine.state.inventory.find(object => object === engine.state.uarm);
        assert.ok(jacket?.invlet);
        for (const key of keys) {
            engine.inputGate.feed(key === 'J' ? jacket.invlet : key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(engine.state.uarm, null);
        assert.match(topRow(engine), expected);
    });
}
//# sourceMappingURL=silent_remove_topline.test.js.map