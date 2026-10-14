import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { LADDER, LA_DOWN, LA_UP, STAIRS } from '../js/const.js';
import { flushPendingTopline, newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

for (const graphics of ['ASCII', 'DECgraphics', 'Rogue']) {
    for (const ladder of [false, true]) {
        for (const branch of [false, true]) {
            for (const up of [false, true]) {
                const direction = up ? 'up' : 'down';
                const kind = ladder ? 'ladder' : 'staircase';
                const selected = `${branch ? 'branch ' : ''}${kind} ${direction}`;
                void test(`${graphics} farlook explains the displayed ${selected} symbol`, async () => {
                    const level = freshObjectRoom({ flags: { tips: false } });
                    requirePlayingGame(game);
                    game.symset = graphics === 'Rogue' ? 'DECgraphics' : graphics;
                    if (graphics === 'Rogue') game.rogue_level = { ...game.u.uz };
                    const location = level.requireAt(11, 10);
                    location.typ = ladder ? LADDER : STAIRS;
                    location.ladder = up ? LA_UP : LA_DOWN;
                    game.stairs = { sx: 11, sy: 10, up, isladder: ladder,
                        tolev: { dnum: branch ? 1 : 0, dlevel: 1 },
                        u_traversed: true, next: null };
                    newsym(11, 10);
                    const display = requireGameDisplay();
                    const messageRows = () => display.grid.slice(0, 3)
                        .map(row => row.map(cell => cell.ch).join('')).join(' ');
                    const pages: string[] = [];
                    const input = resetInputState();
                    input.feed('l.');
                    input.display = {
                        async readKey(): Promise<number> {
                            const page = messageRows();
                            assert.match(page, /--More--/);
                            assert.ok(pages.length < 2, 'The stair description must finish within three pages');
                            pages.push(page);
                            return ' '.charCodeAt(0);
                        },
                    };

                    await rhack(';'.charCodeAt(0));
                    await flushPendingTopline();

                    const text = pages.join(' ').replace(/--More--/g, '').replace(/\s+/g, ' ').trim();
                    const rogueStair = graphics === 'Rogue' && !ladder && !branch;
                    const decLadder = graphics === 'DECgraphics' && ladder;
                    const symbol = rogueStair ? '%' : decLadder ? up ? '≤' : '≥' : up ? '<' : '>';
                    assert.ok(pages[0]?.startsWith(symbol), text);
                    assert.equal(display.grid[11]?.[10]?.ch, symbol, 'The map and look message use the same symbol');
                    assert.ok(text.includes(`(${selected})`), text);
                    if (rogueStair) {
                        assert.ok(text.includes('a staircase up or a staircase down'), text);
                        assert.ok(!text.includes('ladder'), text);
                    } else {
                        const hasStairs = !decLadder;
                        const hasLadders = graphics !== 'DECgraphics' || ladder;
                        assert.equal(text.includes(`a staircase ${direction}`),
                            hasStairs && graphics !== 'Rogue', text);
                        assert.equal(text.includes(`a ladder ${direction}`), hasLadders, text);
                        assert.equal(text.includes(`a branch staircase ${direction}`), hasStairs, text);
                        assert.equal(text.includes(`a branch ladder ${direction}`), hasLadders, text);
                    }
                });
            }
        }
    }
}
