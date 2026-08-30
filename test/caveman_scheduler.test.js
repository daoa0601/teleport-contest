import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { CLUB, FLINT, ROCK, SLING } from '../js/object_data.js';

function cavemanConfig({ pushweapon = true } = {}) {
    return [
        'OPTIONS=name:Generalizer,role:Caveman,race:human,gender:male,align:lawful',
        'OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen',
        `OPTIONS=${pushweapon ? '' : '!'}pushweapon,showexp,time,color,suppress_alert:3.3.1`,
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

async function cavemanOutcome({ seed, moves, pushweapon = true }) {
    const previousBridgeFree = process.env.TELEPORT_BRIDGE_FREE;
    const previousFixtures = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_BRIDGE_FREE = '1';
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    try {
        let result;
        let error = null;
        try {
            result = await runSegment({
                seed,
                datetime: '20260830130000',
                nethackrc: cavemanConfig({ pushweapon }),
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

test('fresh Caveman waits schedule current actors and floor objects', async () => {
    // This seed and command stream are generated controls, not a Contest
    // session. The actor path is intentionally unspecified: it must emerge
    // from the current monster and object graph.
    const outcome = await cavemanOutcome({ seed: 28001, moves: ' ....' });

    assert.equal(outcome.error, null);
    assert.deepEqual(outcome.cavemanBridges, []);
    assert.equal(outcome.world.moves, 5);
    assert.equal(outcome.world.heroMovement, 12);
    assert.ok(outcome.world.actors.some(actor => actor.tame > 0));
});

test('Caveman fire uses live quiver and fireassist state', async () => {
    // One physical fire command is allowed to schedule the source weapon
    // swap before it consumes the direction. The shot count below comes from
    // pinned C; no endpoint, later RNG calls, pet path, or prose is encoded.
    // Pinned dothrow.c selects two shots for this fresh seed: a level-one
    // Caveman has Basic sling skill (no proficiency bonus), the role's
    // low-tech bonus raises the maximum to two, and the source rnd(2) is 2.
    const seed = 28003;
    const startup = await cavemanOutcome({
        seed, moves: ' ',
    });
    const outcome = await cavemanOutcome({
        seed, moves: ' f l',
    });

    assert.equal(startup.error, null);
    assert.equal(outcome.error, null);

    const initialFlint = startup.world.inventory.find(object =>
        object.type === FLINT);
    const remainingFlint = outcome.world.inventory.find(object =>
        object.type === FLINT);
    const initialFloorFlint = startup.world.floorObjects
        .filter(object => object.type === FLINT)
        .reduce((total, object) => total + object.quantity, 0);
    const landedFlint = outcome.world.floorObjects
        .filter(object => object.type === FLINT)
        .reduce((total, object) => total + object.quantity, 0);
    assert.ok(initialFlint);
    assert.equal(
        initialFlint.quantity - (remainingFlint?.quantity ?? 0),
        2,
    );
    assert.equal(landedFlint - initialFloorFlint, 2);
    assert.equal(outcome.world.primary, SLING);
    assert.equal(outcome.world.alternate, CLUB);
    assert.deepEqual(outcome.cavemanBridges, []);
});

test('a count prefix caps the live Caveman volley', async () => {
    // The same fresh source roll as the two-shot witness remains observable,
    // but dothrow.c applies an explicit command count after that roll. The
    // limit survives the fireassist weapon-swap turn and caps the volley at 1.
    const seed = 28003;
    const startup = await cavemanOutcome({
        seed, moves: ' ',
    });
    const outcome = await cavemanOutcome({
        seed, moves: ' 1f l',
    });

    assert.equal(startup.error, null);
    assert.equal(outcome.error, null);

    const initialFlint = startup.world.inventory.find(object =>
        object.type === FLINT);
    const remainingFlint = outcome.world.inventory.find(object =>
        object.type === FLINT);
    const initialFloorFlint = startup.world.floorObjects
        .filter(object => object.type === FLINT)
        .reduce((total, object) => total + object.quantity, 0);
    const landedFlint = outcome.world.floorObjects
        .filter(object => object.type === FLINT)
        .reduce((total, object) => total + object.quantity, 0);

    assert.ok(initialFlint);
    assert.equal(
        initialFlint.quantity - (remainingFlint?.quantity ?? 0),
        1,
    );
    assert.equal(landedFlint - initialFloorFlint, 1);
    assert.equal(outcome.world.primary, SLING);
    assert.equal(outcome.world.alternate, CLUB);
    assert.deepEqual(outcome.cavemanBridges, []);
});

test('fireassist finds a live launcher outside both weapon slots', async () => {
    // These ordinary commands first swap to the sling, then wield the rock
    // stack with pushweapon disabled.  That leaves the sling in inventory,
    // the club alternate, and matching flint readied.  Source find_launcher()
    // must discover and wield that live sling before the shot; no fixed slot,
    // launcher letter, queue shape, endpoint, or screen is the oracle.
    const input = {
        seed: 28100,
        moves: ' x wdf l',
        pushweapon: false,
    };
    const startup = await cavemanOutcome({
        seed: input.seed,
        moves: ' ',
        pushweapon: input.pushweapon,
    });
    const outcome = await cavemanOutcome(input);

    assert.equal(startup.error, null);
    assert.equal(outcome.error, null);
    const initialFlint = startup.world.inventory.find(object =>
        object.type === FLINT);
    const remainingFlint = outcome.world.inventory.find(object =>
        object.type === FLINT);
    assert.ok(initialFlint);
    assert.ok(
        initialFlint.quantity > (remainingFlint?.quantity ?? 0),
        'the discovered launcher must fire the readied flint',
    );
    assert.equal(outcome.world.primary, SLING);
    assert.equal(outcome.world.alternate, ROCK);
    assert.deepEqual(outcome.cavemanBridges, []);
});
