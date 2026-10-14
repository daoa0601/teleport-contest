import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, CLUB, SACK } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshPlayableRoom } from './support/playable-room.js';
for (const command of ['loot', 'tip']) {
    void test(`${command} selects the first floor container on page two with a`, async () => {
        freshPlayableRoom();
        const chests = [];
        for (let index = 0; index < 24; index++) {
            chests.push(await floorObject(CHEST, 10, 10, {
                initialize: false, olocked: false, otrapped: false, cknown: true,
            }));
        }
        // The title and blank line occupy two of tty's 23 rows on page one.
        // Floor placement prepends new objects to the pile.
        const target = chests[2];
        assert.ok(target);
        const club = await knownObject(CLUB, { where: 'contained', container: target });
        target.contents = [club];
        const input = resetInputState();
        await answerPrompts(runExtendedCommand(command), input, [
            { prompt: command === 'loot' ? /Loot which containers\?/ : /Tip which container\?/,
                keys: '>' },
            { prompt: /a - .*chest/, keys: command === 'loot' ? 'a\n' : 'a' },
            { prompt: command === 'loot' ? /Do what with/ : /Where to tip/,
                keys: command === 'loot' ? 'oa\n' : '\n' },
        ]);
        assert.equal(target.contents.length, 0);
        assert.equal(club.where, command === 'loot' ? 'inventory' : 'floor');
        assert.equal(game.context.move, 1);
    });
}
void test('tip assigns the carried-items choice the next selector on its page', async () => {
    freshPlayableRoom();
    for (let index = 0; index < 24; index++) {
        await floorObject(CHEST, 10, 10, {
            initialize: false, olocked: false, otrapped: false, cknown: false,
        });
    }
    const sack = await addInventoryObject(SACK, { invlet: 'a', initialize: false });
    const club = await knownObject(CLUB, { where: 'contained', container: sack });
    sack.contents = [club];
    const input = resetInputState();
    await answerPrompts(runExtendedCommand('tip'), input, [
        { prompt: /Tip which container\?/, keys: '>' },
        { prompt: /d \* tip something being carried/, keys: 'd' },
        { prompt: /What do you want to tip/, keys: 'a' },
        { prompt: /Where to tip/, keys: '\n' },
    ]);
    assert.equal(sack.contents.length, 0);
    assert.equal(club.where, 'floor');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=container_menu_pages.test.js.map