import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';

function priestConfig() {
    return [
        'OPTIONS=name:Generalizer,role:Priest,race:human,gender:female,align:lawful',
        'OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen',
        'OPTIONS=pushweapon,showexp,time,color,suppress_alert:3.3.1',
        'OPTIONS=symset:DECgraphics',
        '',
    ].join('\n');
}

function livingActorState() {
    return (game.level?.monsters || [])
        .filter(monster => (monster.mhp ?? 1) > 0 && !monster.dead)
        .map(monster => ({
            species: monster.mnum,
            x: monster.mx,
            y: monster.my,
            hp: monster.mhp,
            movement: monster.movement,
            pet: !!monster.pet,
            inventory: (monster.minvent || monster.inventory || [])
                .map(object => object.otyp)
                .sort((left, right) => left - right),
        }))
        .sort((left, right) => left.species - right.species
            || left.x - right.x || left.y - right.y);
}

async function freshPriestOutcome({ moves, bridgeFree }) {
    const previousBridgeFree = process.env.TELEPORT_BRIDGE_FREE;
    const previousFixtures = process.env.TELEPORT_DISABLE_FIXTURES;
    if (bridgeFree) process.env.TELEPORT_BRIDGE_FREE = '1';
    else delete process.env.TELEPORT_BRIDGE_FREE;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    try {
        const result = await runSegment({
            seed: 23501,
            datetime: '20260830090000',
            nethackrc: priestConfig(),
            moves,
        });
        const ledger = result.getBridgeUsageLedger();
        return {
            world: {
                hero: [game.u?.ux, game.u?.uy],
                moves: game.moves,
                heroMovement: game.u?.umovement,
                message: game._pending_message,
                actors: livingActorState(),
            },
            priestBridges: Object.keys(ledger.bridges)
                .filter(id => id.includes('priest')),
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

test('fresh Priest extended commands never select a replay engine',
    async () => {
        // This is a fresh generated game, not a recorded Contest session.
        // The command text is a regression witness for the former selector;
        // it must be interpreted by the same live engine in both modes.
        const moves = '  ns#pray\ny....';
        const normal = await freshPriestOutcome({ moves, bridgeFree: false });
        const bridgeFree = await freshPriestOutcome({
            moves, bridgeFree: true,
        });

        assert.deepEqual(normal.priestBridges, []);
        assert.deepEqual(normal.world, bridgeFree.world);
    });

test('fresh Priest waits are not rewritten by later command text',
    async () => {
        // The suffix follows a save request and is never needed to define the
        // four elapsed turns.  Its bytes must not retroactively change pet or
        // global-turn scheduling during that prefix.
        const moves = ' ....SynyZ#turn';
        const normal = await freshPriestOutcome({ moves, bridgeFree: false });
        const bridgeFree = await freshPriestOutcome({
            moves, bridgeFree: true,
        });

        assert.deepEqual(normal.priestBridges, []);
        assert.deepEqual(normal.world, bridgeFree.world);
    });
