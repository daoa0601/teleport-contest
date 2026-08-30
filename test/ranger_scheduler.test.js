import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { ARROW, BOW, DAGGER } from '../js/object_data.js';

function rangerConfig({ race = 'human', align = 'neutral' } = {}) {
    return [
        `OPTIONS=name:Generalizer,role:Ranger,race:${race},gender:female,align:${align}`,
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
        ready: object === game.uquiver,
        wielded: object === game.uwep,
        alternate: object === game.uswapwep,
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
    return objects.sort((left, right) =>
        left.position[0] - right.position[0]
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
            sleeping: !!monster.msleeping,
            inventory: (monster.minvent || monster.inventory || [])
                .map(objectState),
        }))
        .sort((left, right) => left.species - right.species
            || left.position[0] - right.position[0]
            || left.position[1] - right.position[1]);
}

async function rangerOutcome({
    seed, moves, bridgeFree, race = 'human', align = 'neutral',
}) {
    const previousBridgeFree = process.env.TELEPORT_BRIDGE_FREE;
    const previousFixtures = process.env.TELEPORT_DISABLE_FIXTURES;
    if (bridgeFree) process.env.TELEPORT_BRIDGE_FREE = '1';
    else delete process.env.TELEPORT_BRIDGE_FREE;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    try {
        let result = null;
        let error = null;
        try {
            result = await runSegment({
                seed,
                datetime: '20260830140000',
                nethackrc: rangerConfig({ race, align }),
                moves,
            });
        } catch (caught) {
            error = { code: caught?.code, bridgeId: caught?.bridgeId };
        }
        return {
            error,
            world: {
                hero: [game.u?.ux, game.u?.uy],
                moves: game.moves,
                heroMovement: game.u?.umovement,
                message: game._pending_message,
                primary: game.uwep?.otyp ?? null,
                alternate: game.uswapwep?.otyp ?? null,
                quiver: game.uquiver?.otyp ?? null,
                inventory: (game.inventory || []).map(objectState),
                floorObjects: floorObjectState(),
                actors: actorState(),
            },
            bridges: result
                ? Object.keys(result.getBridgeUsageLedger().bridges)
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

async function outcomesAcrossModes(input) {
    const normal = await rangerOutcome({ ...input, bridgeFree: false });
    const bridgeFree = await rangerOutcome({ ...input, bridgeFree: true });

    assert.equal(normal.error, null, 'normal execution');
    assert.equal(bridgeFree.error, null, 'bridge-free execution');
    assert.deepEqual(normal.bridges, [], 'normal bridge ledger');
    assert.deepEqual(bridgeFree.bridges, [], 'bridge-free bridge ledger');
    assert.deepEqual(normal.world, bridgeFree.world, 'cross-mode world');
    return normal.world;
}

test('a fresh coordinate-collision Ranger uses current actors', async () => {
    // This independently scanned seed happens to start at the coordinates and
    // sink count formerly used by the named-start classifier.  C moveloop_core
    // has no role, coordinate, or room-feature scheduler branch: four waits
    // must scan the same current fmon/fobj graph in every execution mode.
    const world = await outcomesAcrossModes({
        seed: 43333,
        moves: ' ....',
    });

    assert.equal(world.moves, 5);
    assert.equal(world.heroMovement, 12);
    assert.ok(world.actors.some(actor => actor.tame > 0));
});

test('fresh Ranger fireassist swaps, resumes, and shoots live arrows',
    async () => {
        // Pinned dothrow.c queues doswapweapon then dofire when the quivered
        // ammo matches the alternate launcher.  The physical fire command
        // must therefore spend the swap turn, resume, and detach at least one
        // arrow; a canned message/RNG replay which stops at direction input
        // cannot satisfy the inventory and actor-state oracle.
        const seed = 43333;
        const startup = await rangerOutcome({
            seed, moves: ' ', bridgeFree: true,
        });
        const world = await outcomesAcrossModes({
            seed, moves: ' f l ',
        });

        const initialArrows = startup.world.inventory
            .filter(object => object.type === ARROW)
            .reduce((total, object) => total + object.quantity, 0);
        const remainingArrows = world.inventory
            .filter(object => object.type === ARROW)
            .reduce((total, object) => total + object.quantity, 0);

        assert.equal(startup.error, null);
        assert.equal(world.primary, BOW);
        assert.equal(world.alternate, DAGGER);
        assert.equal(world.quiver, ARROW);
        assert.ok(initialArrows > remainingArrows);
        assert.equal(world.moves, 3);
    });

test('every legal Ranger race shares the live scheduler', async () => {
    for (const input of [
        { seed: 43401, race: 'human', align: 'neutral' },
        { seed: 43402, race: 'elf', align: 'chaotic' },
        { seed: 43403, race: 'gnome', align: 'neutral' },
        { seed: 43405, race: 'orc', align: 'chaotic' },
    ]) {
        const world = await outcomesAcrossModes({
            ...input,
            moves: ' ....',
        });
        assert.equal(world.heroMovement, 12);
        assert.ok(world.actors.some(actor => actor.tame > 0));
    }
});
