import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

for (const command of ['vision', 'wizseenv', 'wmode']) {
    void test(`${command} describes the live map without using a turn`, async () => {
        const engine = new Engine({
            seed: 13, datetime: '20000110090000', display: new GameDisplay(null), storage: memoryStorage(),
            nethackrc: 'OPTIONS=name:Inspector,role:Wizard,race:human,gender:male,align:neutral,playmode:debug,!legacy,!tutorial,!news,!tips,!menu_overlay,pettype:none\n',
        });
        try {
            await engine.runUntilInputNeeded();
            const turn = engine.state.moves;
            const hero = { x: engine.state.u.ux, y: engine.state.u.uy };
            for (const key of `#${command}\r`) {
                engine.inputGate.feed(key);
                await engine.runUntilInputNeeded();
            }
            const rows = screenText(capturedScreen(engine)).split('\n');
            assert.equal(engine.state.moves, turn, 'map inspection must take no game time');
            if (command === 'vision') {
                assert.match(rows[0] ?? '', /could see.*in sight.*temp lit/);
                assert.equal(rows[hero.y + 2]?.[hero.x - 1], '@', 'vision rows must locate the hero');
            } else if (command === 'wizseenv') {
                assert.match(rows[hero.y] ?? '', /@@/, 'seen-vector rows must mark both hero columns');
                assert.ok(rows.some(row => /[0-9a-f]{2}/.test(row)), 'seen squares must show hexadecimal vectors');
            } else {
                assert.match(rows[1] ?? '', /^x+\s*$/, 'stone across the top map edge must be marked x');
                assert.equal(rows[hero.y + 1]?.[hero.x - 1], '@', 'tty wall-mode rows must align with the map');
            }
            engine.inputGate.feed('\x1b');
            await engine.runUntilInputNeeded();
            assert.equal(engine.state.moves, turn, 'dismissing inspection must take no game time');
            assert.equal(engine.state.u.ux, hero.x);
            assert.equal(engine.state.u.uy, hero.y);
        } finally {
            await engine.lua.destroy();
        }
    });
}
