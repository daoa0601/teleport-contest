import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { STATUE_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createCorpstatAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { STATUE } from '../js/object_data.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
for (const species of ['jackal', 'stone golem']) {
    void test(`stepping on a ${species} statue trap describes the statue ${species === 'jackal' ? 'coming to life' : 'moving'}`, async () => {
        const level = freshObjectRoom({ flags: { pickup: false } });
        requirePlayingGame(game);
        await createCorpstatAt(STATUE, null, MONSTER_NAME.indexOf(species), 11, 10, 0);
        addTrap(level, STATUE_TRAP, 11, 10);
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        await rhack('l'.charCodeAt(0));
        assert.match(game._last_message || '', species === 'jackal'
            ? /The statue comes to life!$/ : /The statue moves!$/);
        assert.ok(level.monsters.some(monster => MONSTER_NAME[monster.mnum] === species));
    });
}
//# sourceMappingURL=statue_trap_messages.test.js.map