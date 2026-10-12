import test from 'node:test';
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { saveGame } from '../js/save.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';

for (const [role, greeting] of [
    ['knight', 'Salutations'], ['samurai', 'Konnichi wa'],
    ['tourist', 'Aloha'], ['valkyrie', 'Velkommen'], ['wizard', 'Hello'],
] as const) {
    void test(`${role} receives its role greeting on a new game`, async () => {
        const engine = await runSegment({ seed: 31, datetime: '20260801120000',
            nethackrc: `OPTIONS=name:Traveler,role:${role},race:human,gender:male,align:${['knight', 'samurai', 'valkyrie'].includes(role) ? 'lawful' : 'neutral'},!legacy,!tutorial,!autopickup,pettype:none`,
            moves: '', storage: memoryStorage() });
        assert.ok(engine.display);
        const screen = engine.display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(screen, new RegExp(`${greeting} Traveler, welcome to NetHack!`));
    });

    void test(`${role} retains its role greeting after restoring`, async () => {
        freshPlayableRoom({ role });
        game.plname = game.displayName = 'Traveler';
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const engine = await runSegment({ seed: 32, datetime: '20260801120000',
            nethackrc: 'OPTIONS=name:Traveler,!tutorial', moves: '', storage });
        assert.ok(engine.display);
        const screen = engine.display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(screen, new RegExp(`${greeting} Traveler, the human`));
        assert.match(screen, /welcome back to NetHack!/);
    });
}
