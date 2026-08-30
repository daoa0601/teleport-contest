import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';

function rogueConfig(race) {
    return [
        `OPTIONS=name:Generalizer,role:Rogue,race:${race},gender:female,align:chaotic`,
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
                .sort((a, b) => a - b),
        }))
        .sort((left, right) => left.species - right.species
            || left.x - right.x || left.y - right.y);
}

async function freshRogueOutcome({ seed, race, bridgeFree }) {
    const previous = process.env.TELEPORT_BRIDGE_FREE;
    if (bridgeFree) process.env.TELEPORT_BRIDGE_FREE = '1';
    else delete process.env.TELEPORT_BRIDGE_FREE;
    try {
        const result = await runSegment({
            seed,
            datetime: '20260830060000',
            nethackrc: rogueConfig(race),
            moves: ' ....',
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
            rogueBridges: Object.keys(ledger.bridges)
                .filter(id => id.includes('rogue')),
        };
    } finally {
        if (previous == null) delete process.env.TELEPORT_BRIDGE_FREE;
        else process.env.TELEPORT_BRIDGE_FREE = previous;
    }
}

test('fresh human Rogue turns are independent of compatibility mode',
    async () => {
        // Fresh seed found by scanning generated starts, not by reading a
        // recorded session.  Its upstairs happens to be at the coordinate
        // formerly used by the public Rogue-explore classifier.
        const normal = await freshRogueOutcome({
            seed: 10325, race: 'human', bridgeFree: false,
        });
        const bridgeFree = await freshRogueOutcome({
            seed: 10325, race: 'human', bridgeFree: true,
        });

        assert.deepEqual(normal.rogueBridges, []);
        assert.deepEqual(normal.world, bridgeFree.world);
    });

test('fresh Orc Rogue waits cannot enter a scripted fight and run',
    async () => {
        // This independently generated start lands on the former Rogue-Orc
        // coordinate.  Four wait commands must remain waits in every mode.
        const normal = await freshRogueOutcome({
            seed: 12168, race: 'orc', bridgeFree: false,
        });
        const bridgeFree = await freshRogueOutcome({
            seed: 12168, race: 'orc', bridgeFree: true,
        });

        assert.deepEqual(normal.rogueBridges, []);
        assert.deepEqual(normal.world, bridgeFree.world);
        assert.deepEqual(normal.world.hero, [5, 12]);
        assert.equal(normal.world.moves, 5);
        assert.equal(normal.world.message, '');
    });
