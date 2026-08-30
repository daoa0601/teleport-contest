import test from 'node:test';
import assert from 'node:assert/strict';

import {
    roleOutcome,
} from './support/role-outcome.js';

test('Archeologist intrinsic Searching runs inside live turn maintenance',
    async () => {
        const input = {
            seed: 31222,
            role: 'Archeologist', race: 'human', align: 'lawful',
        };
        const startup = await roleOutcome({ ...input, moves: ' ' });
        const afterTurns = await roleOutcome(input);
        const newlySeen = afterTurns.traps.filter(trap => {
            if (!trap.seen) return false;
            const prior = startup.traps.find(candidate =>
                candidate.type === trap.type
                && candidate.position[0] === trap.position[0]
                && candidate.position[1] === trap.position[1]);
            return prior && !prior.seen;
        });

        assert.equal(afterTurns.moves, 5);
        assert.equal(newlySeen.length, 1);
        assert.equal(newlySeen[0].type, 15);
        assert.ok(Math.abs(newlySeen[0].position[0] - afterTurns.hero[0]) <= 1);
        assert.ok(Math.abs(newlySeen[0].position[1] - afterTurns.hero[1]) <= 1);
    });

test('a live adjacent threat can refuse Barbarian rest without replay time',
    async () => {
        // On this independent generated start an actor becomes adjacent before
        // the fourth dot.  Source command safety refuses that ordinary wait;
        // a turn table would blindly consume the byte and advance anyway.
        const world = await roleOutcome({
            seed: 31004,
            role: 'Barbarian', race: 'human', align: 'neutral',
        });

        assert.equal(world.moves, 4);
        assert.equal(world.heroMovement, 12);
        assert.match(world.message, /force a no-op/);
    });
