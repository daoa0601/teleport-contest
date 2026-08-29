import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { assertRngThrough, assertScreenExact } from './parity_assertions.js';

process.env.TELEPORT_DISABLE_FIXTURES = '1';

const session = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0007-rogue-snake-swamp.session.json', import.meta.url),
    'utf8',
)).segments[0];

test('seed0007 fountain creates all six live water moccasins through input289',
    async () => {
        const lastStep = 289;
        const result = await runSegment({
            ...session,
            moves: session.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, session, lastStep, 'seed0007 snakes');
        assertScreenExact(
            decodeScreen(result.getScreens()[lastStep]),
            decodeScreen(session.steps[lastStep].screen),
            'seed0007 snakes screen',
        );
        assert.deepEqual(
            result.getCursors()[lastStep], session.steps[lastStep].cursor,
        );

        const snakes = game.level.monsters.filter(monster =>
            monster.mnum === 216 && !monster.dead);
        assert.equal(snakes.length, 6);
        assert.equal(new Set(snakes.map(monster => monster.m_id)).size, 6);
        assert.equal(new Set(snakes.map(monster =>
            `${monster.mx},${monster.my}`)).size, 6);
    });

test('seed0007 fatal second snake retains painted HP through death pager',
    async () => {
        const lastStep = 292;
        const result = await runSegment({
            ...session,
            moves: session.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, session, lastStep, 'seed0007 snake death');
        for (let step = 290; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(session.steps[step].screen),
                `seed0007 snake death screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step], session.steps[step].cursor,
                `seed0007 snake death cursor ${step}`,
            );
        }

        assert.equal(game.u.uhp, 0);
        assert.equal(game._statusHpOverride, undefined);
        assert.equal(
            game._pending_message,
            'Do you want your possessions identified? [ynq] (n)',
        );
    });
