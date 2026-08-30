import test from 'node:test';
import assert from 'node:assert/strict';

import {
    outcomesAcrossModes,
} from './support/role-outcome.js';

async function assertLiveAcrossModes(input) {
    const world = await outcomesAcrossModes(input);
    assert.equal(world.moves, 5);
    assert.equal(world.heroMovement, 12);
    assert.ok(world.actors.some(actor => actor.tame > 0));
}

test('every selectable role has fresh bridge-free live turns', async () => {
    const roles = [
        ['Archeologist', 'lawful'], ['Barbarian', 'neutral'],
        ['Caveman', 'lawful'], ['Healer', 'neutral'],
        ['Knight', 'lawful'], ['Monk', 'neutral'],
        ['Priest', 'lawful'], ['Ranger', 'neutral'],
        ['Rogue', 'chaotic'], ['Samurai', 'lawful'],
        ['Tourist', 'neutral'], ['Valkyrie', 'lawful'],
        ['Wizard', 'neutral'],
    ];
    for (let index = 0; index < roles.length; index++) {
        const [role, align] = roles[index];
        await outcomesAcrossModes({
            seed: 31100 + index, role, race: 'human', align,
        });
    }
});

test('every legal Archeologist race uses live role-neutral turns', async () => {
    for (const input of [
        { seed: 31001, role: 'Archeologist', race: 'human', align: 'lawful' },
        { seed: 31002, role: 'Archeologist', race: 'dwarf', align: 'lawful' },
        { seed: 31003, role: 'Archeologist', race: 'gnome', align: 'neutral' },
    ]) {
        await assertLiveAcrossModes(input);
    }
});

test('Archeologist intrinsic Searching runs inside live turn maintenance',
    async () => {
        const input = {
            seed: 31222,
            role: 'Archeologist', race: 'human', align: 'lawful',
        };
        const startup = await outcomesAcrossModes({ ...input, moves: ' ' });
        const afterTurns = await outcomesAcrossModes(input);
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

test('both legal Barbarian races use live role-neutral turns', async () => {
    for (const input of [
        { seed: 31006, role: 'Barbarian', race: 'human', align: 'neutral' },
        { seed: 31005, role: 'Barbarian', race: 'orc', align: 'chaotic' },
    ]) {
        await assertLiveAcrossModes(input);
    }
});

test('a live adjacent threat can refuse Barbarian rest without replay time',
    async () => {
        // On this independent generated start an actor becomes adjacent before
        // the fourth dot.  Source command safety refuses that ordinary wait;
        // a turn table would blindly consume the byte and advance anyway.
        const world = await outcomesAcrossModes({
            seed: 31004,
            role: 'Barbarian', race: 'human', align: 'neutral',
        });

        assert.equal(world.moves, 4);
        assert.equal(world.heroMovement, 12);
        assert.match(world.message, /force a no-op/);
    });
