import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { TT_INFLOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { grantIntrinsicProperty, setPropertyTerrainBlocked } from '../js/properties.js';
import { ROCK } from '../js/object_data.js';
import { weightCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('levitation still supports a load while the hero is stuck in the floor', async () => {
    freshObjectRoom({ hero: { utrap: 1, utraptype: TT_INFLOOR, uhp: 5 } });
    grantIntrinsicProperty('levitation', 'outside');
    await addInventoryObject(ROCK, { quan: 90 });
    pushKeys(' '.repeat(5));

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.utrap, 0, 'the hero can spend its movement escaping instead of collapsing');
    assert.equal(weightCapacity(game), 1000);
    assert.match(game._lastPlineMessage ?? '', /finally wriggle free/);
});

void test('terrain that blocks levitation also blocks its carrying benefit', () => {
    freshObjectRoom();
    const ordinaryCapacity = weightCapacity(game);
    grantIntrinsicProperty('levitation', 'outside');
    setPropertyTerrainBlocked('levitation', true);

    assert.equal(weightCapacity(game), ordinaryCapacity);
});
