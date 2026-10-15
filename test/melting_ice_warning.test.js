import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { ICE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { LEVEL_TIMER_KIND, scheduleLevelTimer } from '../js/object_timers.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshObjectRoom } from './support/object-room.js';
const warnings = [
    [14, 'The ice seems very soft and slushy.'],
    [10, 'The ice seems very soft and slushy.'],
    [9, 'You feel the ice shift beneath you!'],
    [5, 'You feel the ice shift beneath you!'],
    [4, 'The ice, is gonna BREAK!'],
];
for (const [remaining, message] of warnings) {
    void test(`Warning senses ice with ${remaining} turns until it melts`, async () => {
        const level = freshObjectRoom();
        level.requireAt(11, 10).typ = ICE;
        grantIntrinsicProperty('warning', 'outside');
        scheduleLevelTimer(11, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + remaining);
        await rhack('l'.charCodeAt(0));
        assert.equal(game._pending_message, message);
    });
}
for (const warning of [false, true]) {
    void test(`ice that will not melt soon stays quiet ${warning ? 'with' : 'without'} Warning`, async () => {
        const level = freshObjectRoom();
        level.requireAt(11, 10).typ = ICE;
        if (warning)
            grantIntrinsicProperty('warning', 'outside');
        scheduleLevelTimer(11, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + (warning ? 15 : 4));
        await rhack('l'.charCodeAt(0));
        assert.equal(game._pending_message, '');
    });
}
//# sourceMappingURL=melting_ice_warning.test.js.map