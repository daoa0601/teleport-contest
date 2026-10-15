import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { CORPSTAT_FEMALE, GRAVE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, WAN_DIGGING } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { saveScoreRecords } from '../js/score_records.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('digging a grave unearths the named corpse of a recorded adventurer', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = GRAVE;
    game.storage = memoryStorage();
    saveScoreRecords([{
        name: 'Ada', role: 'Val', race: 'Hum', gender: 'Fem', align: 'Neu',
        points: 100, deathdnum: 0, deathlev: 8, maxlvl: 8, hp: 0, maxhp: 40,
        dungeon: 'The Dungeons of Doom', outcome: 'died', death: 'a troll',
    }]);
    grantIntrinsicProperty('levitation', 'outside');
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /dig|pit|grave|corpse|robber/, limit: 10 });
    input.feed(`${wand.invlet}>`);
    initRng(1n);

    await rhack('z'.charCodeAt(0));

    const corpse = level.objects[10]?.[10]?.find(object => object.otyp === CORPSE);
    assert.ok(corpse, 'Grave digging should leave the unearthed corpse on the floor.');
    assert.equal(corpse.oextra?.oname, 'Ada');
    assert.equal(corpse.corpsenm, MONSTER_NAME.indexOf('valkyrie'));
    assert.equal(corpse.spe, CORPSTAT_FEMALE);
    assert.ok(corpse.age <= game.moves - 51, 'The grave corpse is already old.');
});
