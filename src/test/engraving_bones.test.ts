import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT } from '../js/const.js';
import { engravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { WAN_FIRE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

void test('an ancestor Elbereth is already complete when the next hero attacks from it', async () => {
    const input = freshTurnRoom({ moves: 1000, hero: { uz: { dnum: 0, dlevel: 8 } } });
    requireFixtureGame(game);
    const storage = memoryStorage();
    game.storage = storage;
    const wand = await addInventoryObject(WAN_FIRE, { spe: 3, typeKnown: true });
    input.feed('E');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: wand.invlet },
        { prompt: /You burn into the floor with/, keys: ' ' },
        { prompt: /What do you want to burn into the floor here\?/, keys: 'Elbereth\r' },
    ]);
    await moveloop_core();
    assert.equal(engravingAt(10, 10)?.text, 'Elbereth');
    assert.equal(saveBonesLevel(), true);

    freshObjectRoom({ hero: { uhitinc: 30, ualign: { type: 0, record: 10 } } });
    requireFixtureGame(game);
    game.storage = storage;
    game.flags.debug = true;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    const nextInput = resetInputState();
    nextInput.feed('yn');
    await mklev();
    const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    target.mpeaceful = false;
    target.mhp = target.mhpmax = 100;
    installPagerInput(nextInput, { expected: /goblin|hit|miss|hypocrite|engraving|begin/, limit: 20 });

    await rhack('l'.charCodeAt(0));

    assert.ok(target.mhp < 100, 'the public movement command attacked the goblin');
    assert.equal(game.u.ualign.record, 5, 'attacking from the restored Elbereth breaks its promise of peace');
    assert.equal(engravingAt(10, 10), null);
});
