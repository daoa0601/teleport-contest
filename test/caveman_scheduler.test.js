import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { CLUB, FLINT, SLING } from '../js/object_data.js';

function cavemanConfig() {
    return [
        'OPTIONS=name:Generalizer,role:Caveman,race:human,gender:male,align:lawful',
        'OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen',
        'OPTIONS=pushweapon,showexp,time,color,suppress_alert:3.3.1',
        'OPTIONS=symset:DECgraphics',
        '',
    ].join('\n');
}

function objectState(object) {
    return {
        type: object.otyp,
        quantity: object.quan ?? object.quantity ?? 1,
        position: [object.ox, object.oy],
        ready: !!object.ready,
        wielded: !!object.wielded,
        alternate: !!object.alternate,
    };
}

function floorObjectState() {
    const objects = [];
    for (let x = 0; x < (game.level?.objects?.length || 0); x++) {
        const column = game.level.objects[x] || [];
        for (let y = 0; y < column.length; y++) {
            for (const object of column[y] || [])
                objects.push(objectState(object));
        }
    }
    return objects.sort((left, right) => left.position[0] - right.position[0]
        || left.position[1] - right.position[1]
        || left.type - right.type);
}

function actorState() {
    return (game.level?.monsters || [])
        .filter(monster => (monster.mhp ?? 1) > 0 && !monster.dead)
        .map(monster => ({
            species: monster.mnum,
            position: [monster.mx, monster.my],
            hp: monster.mhp,
            movement: monster.movement,
            tame: monster.mtame ?? 0,
            inventory: (monster.minvent || monster.inventory || [])
                .map(objectState),
        }))
        .sort((left, right) => left.species - right.species
            || left.position[0] - right.position[0]
            || left.position[1] - right.position[1]);
}

async function cavemanOutcome({ seed, moves, bridgeFree }) {
    const previousBridgeFree = process.env.TELEPORT_BRIDGE_FREE;
    const previousFixtures = process.env.TELEPORT_DISABLE_FIXTURES;
    if (bridgeFree) process.env.TELEPORT_BRIDGE_FREE = '1';
    else delete process.env.TELEPORT_BRIDGE_FREE;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    try {
        let result;
        let error = null;
        try {
            result = await runSegment({
                seed,
                datetime: '20260830130000',
                nethackrc: cavemanConfig(),
                moves,
            });
        } catch (caught) {
            error = {
                code: caught?.code,
                bridgeId: caught?.bridgeId,
            };
        }
        return {
            error,
            world: {
                hero: [game.u?.ux, game.u?.uy],
                moves: game.moves,
                heroMovement: game.u?.umovement,
                message: game._pending_message,
                inventory: (game.inventory || []).map(objectState),
                primary: game.uwep?.otyp ?? null,
                alternate: game.uswapwep?.otyp ?? null,
                quiver: game.uquiver?.otyp ?? null,
                actors: actorState(),
                floorObjects: floorObjectState(),
            },
            cavemanBridges: result
                ? Object.keys(result.getBridgeUsageLedger().bridges)
                    .filter(id => id.includes('caveman'))
                : [],
        };
    } finally {
        if (previousBridgeFree == null)
            delete process.env.TELEPORT_BRIDGE_FREE;
        else process.env.TELEPORT_BRIDGE_FREE = previousBridgeFree;
        if (previousFixtures == null)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else process.env.TELEPORT_DISABLE_FIXTURES = previousFixtures;
    }
}

test('fresh Caveman waits use current actors and floor objects', async () => {
    // This seed and command stream are generated controls, not a Contest
    // session. The actor path is intentionally unspecified: it must emerge
    // from the current monster and object graph in both execution modes.
    const input = { seed: 28001, moves: ' ....' };
    const normal = await cavemanOutcome({ ...input, bridgeFree: false });
    const bridgeFree = await cavemanOutcome({
        ...input, bridgeFree: true,
    });

    assert.equal(normal.error, null);
    assert.equal(bridgeFree.error, null);
    assert.deepEqual(normal.cavemanBridges, []);
    assert.deepEqual(normal.world, bridgeFree.world);
    assert.equal(normal.world.moves, 5);
    assert.ok(normal.world.actors.some(actor => actor.tame > 0));
});

test('Caveman fire uses live quiver and fireassist state', async () => {
    // One physical fire command is allowed to schedule the source weapon
    // swap before it consumes the direction. No test value encodes the
    // number of shots, endpoint, RNG calls, pet path, or rendered prose.
    const seed = 28002;
    const startup = await cavemanOutcome({
        seed, moves: ' ', bridgeFree: true,
    });
    const bridgeFree = await cavemanOutcome({
        seed, moves: ' f l', bridgeFree: true,
    });

    assert.equal(startup.error, null);
    assert.equal(bridgeFree.error, null);

    const initialFlint = startup.world.inventory.find(object =>
        object.type === FLINT);
    const remainingFlint = bridgeFree.world.inventory.find(object =>
        object.type === FLINT);
    assert.ok(initialFlint);
    assert.ok((remainingFlint?.quantity ?? 0) < initialFlint.quantity);
    assert.equal(bridgeFree.world.primary, SLING);
    assert.equal(bridgeFree.world.alternate, CLUB);
    assert.deepEqual(bridgeFree.cavemanBridges, []);

    const normal = await cavemanOutcome({
        seed, moves: ' f l', bridgeFree: false,
    });
    assert.equal(normal.error, null);
    assert.deepEqual(normal.world, bridgeFree.world);
});
