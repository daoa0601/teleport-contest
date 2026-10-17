import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, WAN_UNDEAD_TURNING } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('reviving a ghost\'s former body removes the ghost from its visible square', async () => {
    freshObjectRoom({ hero: { seeInvisible: true } });
    requirePlayingGame(game);
    const ghost = await createMonsterAt('ghost', 13, 11);
    newsym(13, 11);
    assert.equal(glyphAt(13, 11)?.kind, 'monster');
    await floorObject(CORPSE, 10, 10, {
        corpsenm: MONSTER_NAME.indexOf('troll'), oextra: { omid: ghost.m_id },
    });
    const wand = await addInventoryObject(WAN_UNDEAD_TURNING, { spe: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /corpse|former body|resurrected/, limit: 8 });
    input.feed(`${wand.invlet}>`);
    await rhack('z'.charCodeAt(0));
    assert.equal(game.level.monsters.includes(ghost), false);
    assert.equal(glyphAt(13, 11)?.kind, 'terrain');
    assert.ok(game.level.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('troll')));
});
void test('undead turning cannot merge a killed ghost into the body revived by the same zap', async () => {
    freshObjectRoom({ hero: { seeInvisible: true } });
    requirePlayingGame(game);
    const ghost = await createMonsterAt('ghost', 11, 10);
    ghost.mhp = 1;
    const troll = MONSTER_NAME.indexOf('troll');
    const corpse = await floorObject(CORPSE, 12, 10, {
        corpsenm: troll, oextra: { omid: ghost.m_id },
    });
    const wand = await addInventoryObject(WAN_UNDEAD_TURNING, { spe: 2 });
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /ghost|corpse|resurrected/, limit: 8 });
    input.feed(`${wand.invlet}l`);
    await rhack('z'.charCodeAt(0));
    assert.ok(ghost.mhp <= 0, 'the zap kills the ghost before reaching its former body');
    assert.equal(corpse.where, 'gone');
    const revived = game.level.monsters.find(monster => monster.mnum === troll);
    assert.ok(revived, 'the same zap must revive the body beyond the ghost');
    assert.equal(!!revived.mconf, false, 'a dead ghost cannot confuse its former body');
    assert.doesNotMatch([...messages, game._pending_message].join('\n'), /drawn into its former body/);
});
//# sourceMappingURL=zap_ghost_revival.test.js.map