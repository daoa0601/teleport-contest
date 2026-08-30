import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';

function freshSamuraiSegment(moves = ' .') {
    return runSegment({
        seed: 8123,
        datetime: '20260830044000',
        nethackrc: [
            'OPTIONS=name:Generalizer,role:Samurai,race:human,gender:female,align:lawful',
            'OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen',
            'OPTIONS=pushweapon,showexp,time,color,suppress_alert:3.3.1',
            'OPTIONS=symset:DECgraphics',
            '',
        ].join('\n'),
        moves,
    });
}

test('fresh Samurai wait uses shared hero and pet source scheduling',
    async () => {
        const result = await freshSamuraiSegment();

        assert.equal(game.urole?.key, 'samurai');
        assert.equal(game.moves, 2);
        assert.equal(game._heroActionSeq, 1);
        assert.equal(game.u?.umovement, 12);
        assert.equal(game.startingPet?.mnum, 16);
        assert.equal(game.startingPet?.movement, 12);
        assert.equal(game._samuraiTimedActions, undefined);
        assert.ok(Array.isArray(game._lastMonsterScan));
        assert.equal(
            result.getBridgeUsageLedger().bridges['fastforward.turn'],
            undefined,
        );
    });

test('fresh Samurai prayer completes through live occupation turns',
    async () => {
        const result = await freshSamuraiSegment(' #pray\ny');

        assert.equal(game.u?.uconduct?.gnostic, 1);
        assert.equal(game._prayerTurnsRemaining, 0);
        assert.equal(game.moves, 4);
        assert.equal(game._heroActionSeq, 1);
        assert.equal(
            game._pending_message,
            'You begin praying to Amaterasu Omikami.  You finish your prayer.',
        );
        assert.equal(game._samuraiTimedActions, undefined);
        assert.equal(
            result.getBridgeUsageLedger().bridges['fastforward.turn'],
            undefined,
        );
    });
