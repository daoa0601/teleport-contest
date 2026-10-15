import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { TT_INFLOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { grantIntrinsicProperty, setPropertyTerrainBlocked } from '../js/properties.js';
import { LEVITATION_BOOTS, ROCK } from '../js/object_data.js';
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

for (const blockedBy of ['nothing', 'terrain', 'floor trap']) {
    const behavior = blockedBy === 'nothing'
        ? 'flight prevents wounded-leg carrying penalties during levitation boot wear'
        : `flight blocked by ${blockedBy} keeps wounded-leg carrying penalties during boot wear`;
    void test(behavior, async () => {
        freshObjectRoom({ hero: {
            _woundedLegSide: 'both',
            utrap: blockedBy === 'floor trap' ? 1 : 0,
            utraptype: TT_INFLOOR,
        } });
        grantIntrinsicProperty('flying', 'outside');
        if (blockedBy === 'terrain') setPropertyTerrainBlocked('flying', true);
        await addInventoryObject(LEVITATION_BOOTS, { invlet: 'a' });
        pushKeys('a     ');

        await rhack('W'.charCodeAt(0));

        assert.equal(weightCapacity(game), blockedBy === 'nothing' ? 650 : 450);
        assert.equal(game.u.flying, false, 'capacity calculations leave the worn boots suppressing flight');
        assert.equal(game.u.levitating, blockedBy !== 'floor trap');
    });
}
