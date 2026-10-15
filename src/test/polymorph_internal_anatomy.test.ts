import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createHarmlessGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { runExtendedCommand } from './support/commands.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';

for (const [form, eyes, lungs] of [
    ['long worm', 'light sensitive cells', 'skins'],
    ['floating eye', 'corneas', 'retinas'],
] as const) {
    void test(`a gas cloud stings the eyes and breathing surfaces of a ${form}`, async () => {
        freshRoomWithPolymorphedHero(form, { polymorph: { hitPoints: 100, maxHitPoints: 100 } });
        const cloud = await createHarmlessGasCloudSelection(game, [{ x: game.u.ux, y: game.u.uy }], { ttl: 5 });
        assert.ok(cloud);
        cloud.damage = 1;
        cloud.heroFault = false;
        const messages: string[] = [];

        await runLevelRegions(game, { publish: async message => { messages.push(message); } });

        assert.ok(messages.includes(`Your ${eyes} sting.`), messages.join('\n'));
        assert.ok(messages.includes(`Something is burning your ${lungs}!`), messages.join('\n'));
    });
}

void test('attributes describes a wolf as normally right-handed', async () => {
    freshRoomWithPolymorphedHero('wolf');
    game.u.rightHanded = true;
    const input = resetInputState();
    const report = runExtendedCommand('attributes');
    let text = '';
    for (let pages = 0; ; pages++) {
        const blocked = await Promise.race([
            input.waitUntilBlocked().then(() => true), report.then(() => false),
        ]);
        if (!blocked) break;
        assert.ok(pages < 8, 'The attributes report must finish within eight pages');
        text += requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        input.feed(' ');
    }
    await report;

    assert.match(text, /You are normally right-handed\./);
});
