import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { assertRngThrough } from './parity_assertions.js';
import { DAGGER } from '../js/object_data.js';
import { NEED_WEAPON } from '../js/const.js';

process.env.TELEPORT_DISABLE_FIXTURES = '1';

const session = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0006-wizard-water-demon.session.json', import.meta.url),
    'utf8',
)).segments[0];

const isRng = call => /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(call);
const withoutSource = call => call.replace(/\s+@.*$/, '');
const expectedThrough = lastStep => session.steps.slice(0, lastStep + 1)
    .flatMap(step => (step.rng || []).filter(isRng).map(withoutSource));

test('depth-two shop and fountain demon retain live scheduler state', async () => {
    const result = await runSegment({
        ...session,
        moves: session.moves.slice(0, 102),
        storage: new Map(),
    });

    assertRngThrough(result, session, 102, 'seed0006');
    for (let step = 8; step <= 12; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.deepEqual(
        decodeScreen(result.getScreens()[31]),
        decodeScreen(session.steps[31].screen),
    );
    assert.deepEqual(result.getCursors()[31], session.steps[31].cursor);
    assert.equal(game.u.uz.dlevel, 2);
    assert.equal(game.level.flags.has_shop, true);

    const shopkeeper = game.level.monsters.find(monster => monster.mnum === 271);
    const mimic = game.level.monsters.find(monster => monster.mnum === 65);
    const demon = game.level.monsters.find(monster => monster.mnum === 289);
    assert.ok(shopkeeper?.isshk);
    assert.equal(shopkeeper.mpeaceful, 1);
    assert.equal(mimic?.m_ap_type, 2);
    assert.equal(mimic?.mappearance, 0);
    assert.deepEqual([demon?.mx, demon?.my], [26, 15]);
    const daggers = demon?.minvent?.find(object => object.otyp === DAGGER);
    assert.equal(daggers?.quan, 5);
    assert.equal(daggers?.wielded, undefined);
    assert.equal(demon?.weaponCheck, NEED_WEAPON);
});

test('ordinary return and water-demon death preserve every C RNG boundary', async () => {
    const result = await runSegment({ ...session, storage: new Map() });
    const expected = expectedThrough(session.steps.length - 1);

    assertRngThrough(result, session, undefined, 'seed0006');
    assert.equal(result.getRngLog().length, 6736);
    for (let step = 102; step <= 108; step++) {
        const expectedSlice = (session.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expectedSlice);
    }
    for (let step = 102; step <= 122; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.equal(game.u.uz.dlevel, 1);
    assert.deepEqual([game.u.ux, game.u.uy], [72, 2]);
    assert.equal(game.u.uhp, 0);
    assert.equal(game.program_state.gameover, true);
});
