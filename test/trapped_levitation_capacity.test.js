import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { TT_INFLOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { grantIntrinsicProperty, setPropertyTerrainBlocked } from '../js/properties.js';
import { LEVITATION_BOOTS, ROCK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { MOD_ENCUMBER, nearCapacity, weightCapacity } from '../js/hack.js';
import { setHeroTrap } from '../js/trap.js';
void test('levitation still supports a load while the hero is stuck in the floor', async () => {
    await freshObjectRoom({ hero: { uhp: 5 } });
    grantIntrinsicProperty('levitation', 'outside');
    // C reaches the floor hold through set_utrap() while levitating
    // (dig.c's passwall mishap), whose float_vs_flight() stores
    // BLevitation|I_SPECIAL: the hero is not floating, but weight_cap()
    // still credits the carrying capacity (hack.c:4307-4309).
    setHeroTrap(2, TT_INFLOOR, game);
    // This load is Stressed at ordinary capacity and Burdened with levitation.
    await addInventoryObject(ROCK, { quan: 120 });
    pushKeys(' '.repeat(5));
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.utrap, 1, 'the injured hero can struggle against the floor under this load');
    assert.equal(game.u.levitating, false, 'the floor still prevents floating');
    assert.equal(weightCapacity(game), 1000);
    assert.equal(game._lastPlineMessage, 'You are stuck in the floor.');
});
void test('an injured hero without levitation cannot struggle against the floor under a stressed load', async () => {
    await freshObjectRoom({ hero: { utrap: 2, utraptype: TT_INFLOOR, uhp: 5 } });
    await addInventoryObject(ROCK, { quan: 120 });
    assert.equal(nearCapacity(game), MOD_ENCUMBER);
    pushKeys(' '.repeat(5));
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.utrap, 2, 'the stamina restriction prevents the escape attempt');
});
void test('terrain that blocks levitation also blocks its carrying benefit', async () => {
    await freshObjectRoom();
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
        await freshObjectRoom({ hero: { _woundedLegSide: 'both' } });
        grantIntrinsicProperty('flying', 'outside');
        if (blockedBy === 'terrain')
            setPropertyTerrainBlocked('flying', true);
        // C: a flying hero caught by the floor arrives through set_utrap(),
        // whose float_vs_flight() stores BFlying|I_SPECIAL.
        if (blockedBy === 'floor trap')
            setHeroTrap(1, TT_INFLOOR, game);
        await addInventoryObject(LEVITATION_BOOTS, { invlet: 'a' });
        pushKeys('a     ');
        await rhack('W'.charCodeAt(0));
        assert.equal(weightCapacity(game), blockedBy === 'nothing' ? 650 : 450);
        assert.equal(game.u.flying, false, 'capacity calculations leave the worn boots suppressing flight');
        assert.equal(game.u.levitating, blockedBy !== 'floor trap');
    });
}
//# sourceMappingURL=trapped_levitation_capacity.test.js.map