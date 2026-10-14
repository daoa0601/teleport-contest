import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DART, EGG, LUMP_OF_ROYAL_JELLY } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

for (const dropping of [false, true]) {
    void test(`a forced inventory menu asks what to ${dropping ? 'drop' : 'ready'}`, async () => {
        const level = freshPlayableRoom({ flags: { force_invmenu: true } });
        const dart = await addInventoryObject(DART);
        let title = '';
        resetInputState().beforeRead = () => {
            for (const row of requireGameDisplay().grid) {
                const text = row.map(cell => cell.ch).join('').trim();
                if (text.startsWith('What do you want to ')) title = text;
            }
        };
        pushKeys(dart.invlet);

        await rhack((dropping ? 'd' : 'Q').charCodeAt(0));

        assert.equal(title, `What do you want to ${dropping ? 'drop' : 'ready'}?`);
        assert.equal(game.context.move, dropping ? 1 : 0);
        if (dropping) {
            assert.equal(dart.where, 'floor');
            assert.ok(level.objects[10]?.[10]?.includes(dart));
        } else {
            assert.equal(game.uquiver, dart);
            assert.equal(dart.where, 'inventory');
        }
    });
}

void test('applying royal jelly titles the forced target menu with the full action', async () => {
    freshPlayableRoom({ flags: { force_invmenu: true } });
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, { blessed: true });
    const egg = await addInventoryObject(EGG, { corpsenm: MONSTER_NAME.indexOf('killer bee') });
    const titles: string[] = [];
    resetInputState().beforeRead = () => {
        for (const row of requireGameDisplay().grid) {
            const text = row.map(cell => cell.ch).join('').trim();
            if (text.startsWith('What do you want to ')) titles.push(text);
        }
    };

    await runExtendedCommand('apply', `${jelly.invlet}${egg.invlet} `);

    assert.ok(titles.includes('What do you want to rub the royal jelly on?'),
        `The egg menu must describe applying royal jelly; shown titles: ${titles.join(', ')}`);
    assert.equal(jelly.where, 'gone');
    assert.equal(egg.corpsenm, MONSTER_NAME.indexOf('queen bee'));
    assert.equal(egg.spe, 2);
    assert.equal(game.context.move, 1);
});
