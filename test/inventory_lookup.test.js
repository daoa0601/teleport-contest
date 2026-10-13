import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { docrt, flush_screen } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { CORPSE, KATANA, UNICORN_HORN } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { requireScreenCell } from './support/screen.js';
for (const overlay of [true, false]) {
    void test(`dismissing a ${overlay ? 'corner' : 'full-screen'} encyclopedia entry ${overlay ? 'preserves' : 'refreshes'} a hallucinated monster${overlay ? '' : ' once'}`, async () => {
        freshObjectRoom({
            left: 40, right: 65, top: 1, bottom: 10, heroX: 50, heroY: 2,
            flags: { menu_overlay: overlay },
        });
        const katana = await addInventoryObject(KATANA);
        await createMonsterAt('newt', 52, 2);
        game.u.hallucinationTurns = 20;
        initRng(8021n);
        await docrt();
        await flush_screen(1);
        const reference = requireScreenCell(51, 3);
        const refreshedAppearance = { ch: reference.ch, color: reference.color };
        const input = resetInputState();
        await answerPrompts(rhack('i'.charCodeAt(0)), input, [
            { prompt: /Weapons/, keys: katana.invlet },
            { prompt: /Do what with the katana\?/, keys: '/' },
        ]);
        const cached = requireScreenCell(51, 3);
        const appearance = overlay
            ? { ch: cached.ch, color: cached.color } : refreshedAppearance;
        const lookup = rhack(0);
        try {
            await input.waitUntilBlocked();
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, /samurai[\s\S]*--More--/);
        }
        finally {
            // Full-screen erasure gets the same random stream as the
            // ordinary map refresh used for the reference appearance.
            if (!overlay)
                initRng(8021n);
            input.feed(' ');
            await lookup;
        }
        const restored = requireScreenCell(51, 3);
        assert.equal(restored.ch, appearance.ch, 'dismissal must use the native monster appearance');
        assert.equal(restored.color, appearance.color, 'dismissal must use the native monster color');
    });
}
void test('inventory lookup offers and shows the species entry for a stack of kobold corpses', async () => {
    freshObjectRoom();
    const corpses = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('kobold'), quan: 2 });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Comestibles/, keys: corpses.invlet },
        { prompt: /Do what with [^\n]+\?[\s\S]*Look up information about/, keys: '/' },
    ]);
    await answerPrompts(rhack(0), input, [
        { prompt: /race of kobolds[\s\S]*--More--/i, keys: ' ' },
    ]);
    assert.equal(corpses.quan, 2);
    assert.equal(game.context.move, 0);
});
void test('inventory lookup shows the selected weapon information and consumes its letter', async () => {
    freshObjectRoom();
    const katana = await addInventoryObject(KATANA, { quan: 2 });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: katana.invlet },
        { prompt: /Do what with the katanas\?/, keys: '/' },
    ]);
    await answerPrompts(rhack(0), input, [
        { prompt: /samurai[\s\S]*--More--/i, keys: ' ' },
    ]);
    assert.equal(katana.quan, 2);
    assert.equal(game.context.move, 0);
    input.feed('s');
    await answerPrompts(rhack(0), input, []);
    assert.equal(game.context.move, 1);
});
void test('Return advances an encyclopedia prose page instead of closing its menu', async () => {
    freshObjectRoom();
    const horn = await addInventoryObject(UNICORN_HORN);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Tools/, keys: horn.invlet },
        { prompt: /Do what with the unicorn horn\?/, keys: '/' },
    ]);
    await answerPrompts(rhack(0), input, [
        { prompt: /elusive unicorn[\s\S]*--More--/, keys: '\n' },
        { prompt: /warm glow stage[\s\S]*--More--/, keys: ' ' },
    ]);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=inventory_lookup.test.js.map