import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';

function valkyrieConfig() {
    return [
        'OPTIONS=name:Generalizer,role:Valkyrie,race:human,gender:female,align:lawful',
        'OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen',
        'OPTIONS=pushweapon,showexp,time,color,suppress_alert:3.3.1',
        'OPTIONS=symset:DECgraphics',
        '',
    ].join('\n');
}

function floorObjectState() {
    const objects = [];
    for (let x = 0; x < (game.level?.objects?.length || 0); x++) {
        const column = game.level.objects[x] || [];
        for (let y = 0; y < column.length; y++) {
            for (const object of column[y] || []) {
                objects.push({
                    x,
                    y,
                    type: object.otyp,
                    quantity: object.quan ?? object.quantity ?? 1,
                    enchantment: object.spe ?? object.enchantment ?? 0,
                    blessed: !!object.blessed,
                    cursed: !!object.cursed,
                    visionBlocker: object.visionBlocker,
                });
            }
        }
    }
    return objects.sort((left, right) => left.x - right.x
        || left.y - right.y || left.type - right.type);
}

function actorState() {
    return (game.level?.monsters || [])
        .filter(monster => (monster.mhp ?? 1) > 0 && !monster.dead)
        .map(monster => ({
            species: monster.mnum,
            position: [monster.mx, monster.my],
            hp: monster.mhp,
            movement: monster.movement,
            pet: !!monster.pet,
        }))
        .sort((left, right) => left.species - right.species
            || left.position[0] - right.position[0]
            || left.position[1] - right.position[1]);
}

async function valkyrieOutcome({ seed, moves, bridgeFree }) {
    const previousBridgeFree = process.env.TELEPORT_BRIDGE_FREE;
    const previousFixtures = process.env.TELEPORT_DISABLE_FIXTURES;
    if (bridgeFree) process.env.TELEPORT_BRIDGE_FREE = '1';
    else delete process.env.TELEPORT_BRIDGE_FREE;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    try {
        const result = await runSegment({
            seed,
            datetime: '20260830110000',
            nethackrc: valkyrieConfig(),
            moves,
        });
        return {
            world: {
                hero: [game.u?.ux, game.u?.uy],
                depth: [game.u?.uz?.dnum, game.u?.uz?.dlevel],
                moves: game.moves,
                message: game._pending_message,
                objects: floorObjectState(),
                actors: actorState(),
            },
            bridges: Object.keys(result.getBridgeUsageLedger().bridges),
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

test('future chat text cannot rewrite a fresh Valkyrie start', async () => {
    // Four elapsed turns expose actor scheduling. Saving then suspends before
    // this suffix is interpreted. Those future bytes cannot be an input to
    // level construction or earlier turns.
    const input = {
        seed: 27001,
        moves: ' ....Syny#chat',
    };
    const normal = await valkyrieOutcome({ ...input, bridgeFree: false });
    const bridgeFree = await valkyrieOutcome({
        ...input, bridgeFree: true,
    });

    assert.deepEqual(normal.world, bridgeFree.world);
    assert.deepEqual(normal.bridges, []);
});

test('fresh Valkyrie movement and descent cannot select a pit replay',
    async () => {
        // This fresh seed is not a recorded session. The command sequence is
        // a regression witness for the former selector; its meaning must come
        // from current terrain and commands in both modes.
        const input = {
            seed: 27002,
            moves: '  nllllllllkkkllkk>',
        };
        const normal = await valkyrieOutcome({ ...input, bridgeFree: false });
        const bridgeFree = await valkyrieOutcome({
            ...input, bridgeFree: true,
        });

        assert.deepEqual(normal.world, bridgeFree.world);
        assert.deepEqual(normal.bridges, []);
    });
