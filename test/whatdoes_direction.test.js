import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, D_ISOPEN, HWALL } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { selectMapPosition } from '../js/getpos.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function askWhatdoes(key) {
    const input = resetInputState();
    const operation = rhack('&'.charCodeAt(0));
    await input.waitUntilBlocked();
    const text = () => requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    if (text().includes('--More--')) {
        input.feed(' ');
        await input.waitUntilBlocked();
    }
    assert.match(text(), /What command\?/);
    input.feed(key);
    await operation;
}
void test('asking about west movement selects the west side of a doorway for area filtering', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false },
        hero: { dx: 1, dy: 0, dz: 1 } });
    for (let y = 6; y <= 14; y++)
        level.requireAt(10, y).typ = HWALL;
    const doorway = level.requireAt(10, 10);
    doorway.typ = DOOR;
    doorway.doormask = D_ISOPEN;
    await createMonsterAt('kitten', 8, 10);
    await createMonsterAt('jackal', 12, 10);
    newsym(8, 10);
    newsym(12, 10);
    game.iflags.getloc_filter = 2;
    await askWhatdoes('h');
    resetInputState().feed('m.');
    const selected = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a monster.', goal: 'a monster',
    });
    assert.equal(selected?.x, 8, 'The west room supplies the monster target after &h');
    assert.equal(selected?.y, 10);
    assert.equal(game.u.dz, 0, 'A horizontal command clears the vertical direction');
    assert.equal(game.context.move, 0);
});
for (const [key, dx, dy] of [['H', -1, 0], ['\x0c', 1, 0], ['>', 0, 0], ['s', 1, -1]]) {
    void test(`asking about ${key === '\x0c' ? '^L' : key} updates the remembered direction without taking a turn`, async () => {
        freshObjectRoom({ hero: { dx: 1, dy: -1, dz: 1 } });
        await askWhatdoes(key);
        assert.equal(game.u.dx, dx);
        assert.equal(game.u.dy, dy);
        assert.equal(game.u.dz, 0);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=whatdoes_direction.test.js.map