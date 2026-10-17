import { monsterAtPosition } from '../js/monster_location.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { runExtendedCommand } from './support/commands.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createSpecialLevel } from './support/topology.js';

void test('a clinging steed drowns on dismount when there is no ceiling', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const wumpus = await createSaddledSteed('wumpus');
    await runExtendedCommand('ride', 'l');
    assert.ok(game.u.usteed === wumpus, 'The hero mounted the wumpus');
    game.astral_level = createSpecialLevel({ dnum: game.u.uz.dnum, dlevel: 10 });
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    grantIntrinsicProperty('levitation', 'outside');
    const x = game.u.ux, y = game.u.uy;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /wumpus|kill|dungeon on|feel guilty/, limit: 8 });

    await runExtendedCommand('ride');

    assert.equal(wumpus.dead, true);
    assert.notEqual(monsterAtPosition(game.level, wumpus.mx, wumpus.my), wumpus);
    assert.equal(game.u.usteed, null);
    assert.equal(game.u.ux, x);
    assert.equal(game.u.uy, y);
    assert.match([...messages, game._pending_message].join('\n'), /falls into the water!/);
});
