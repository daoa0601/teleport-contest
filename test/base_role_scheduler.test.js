import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';

function roleConfig({ role, race, align }) {
    return [
        `OPTIONS=name:Generalizer,role:${role},race:${race},gender:female,align:${align}`,
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
        carrier: object.carrierMid ?? null,
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

function trapState() {
    return (game.level?.traps || [])
        .map(trap => ({
            type: trap.ttyp,
            position: [trap.tx ?? trap.x, trap.ty ?? trap.y],
            seen: !!trap.tseen,
        }))
        .sort((left, right) => left.position[0] - right.position[0]
            || left.position[1] - right.position[1]
            || left.type - right.type);
}

async function freshRoleOutcome({
    role, race, align, seed, bridgeFree, moves = ' ....',
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
                datetime: '20260830100000',
                nethackrc: roleConfig({ role, race, align }),
                moves,
            });
        } catch (caught) {
            error = { code: caught?.code, bridgeId: caught?.bridgeId };
        }
        return {
            error,
            world: {
                hero: [game.u?.ux, game.u?.uy],
                depth: [game.u?.uz?.dnum, game.u?.uz?.dlevel],
                hp: [game.u?.uhp, game.u?.uhpmax],
                moves: game.moves,
                heroMovement: game.u?.umovement,
                message: game._pending_message,
                actors: actorState(),
                traps: trapState(),
                floorObjects: floorObjectState(),
                inventory: (game.inventory || []).map(objectState),
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
    const label = `${input.role}/${input.race}/${input.align}`;
    const normal = await freshRoleOutcome({ ...input, bridgeFree: false });
    const bridgeFree = await freshRoleOutcome({
        ...input, bridgeFree: true,
    });

    assert.equal(normal.error, null, `${label} normal execution`);
    assert.equal(bridgeFree.error, null, `${label} bridge-free execution`);
    assert.deepEqual(normal.bridges, [], `${label} normal bridge ledger`);
    assert.deepEqual(
        bridgeFree.bridges, [], `${label} bridge-free bridge ledger`,
    );
    assert.deepEqual(
        normal.world, bridgeFree.world, `${label} cross-mode world`,
    );
    return normal.world;
}

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
