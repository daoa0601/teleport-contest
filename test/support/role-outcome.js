import assert from 'node:assert/strict';

import { game } from '../../js/gstate.js';
import { runSegment } from '../../js/jsmain.js';

export function roleConfig({
    name = 'Generalizer', role, race, gender = 'female', align,
}) {
    return [
        `OPTIONS=name:${name},role:${role},race:${race},gender:${gender},align:${align}`,
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
        charges: object.charges?.current ?? object.spe ?? null,
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

export async function freshRoleOutcome({
    role, race, align, gender = 'female', name = 'Generalizer', seed,
    bridgeFree, moves = ' ....', datetime = '20260830100000',
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
                datetime,
                nethackrc: roleConfig({
                    name, role, race, gender, align,
                }),
                moves,
            });
        } catch (caught) {
            error = { code: caught?.code, bridgeId: caught?.bridgeId };
        }
        return {
            error,
            world: {
                role: game.urole?.key ?? null,
                race: game.urace?.name ?? game.urace?.noun ?? null,
                hero: [game.u?.ux, game.u?.uy],
                depth: [game.u?.uz?.dnum, game.u?.uz?.dlevel],
                hp: [game.u?.uhp, game.u?.uhpmax],
                gnosticConduct: game.u?.uconduct?.gnostic ?? 0,
                moves: game.moves,
                heroMovement: game.u?.umovement,
                helplessTurns: game._helplessTurns ?? 0,
                message: game._pending_message,
                primary: game.uwep?.otyp ?? null,
                alternate: game.uswapwep?.otyp ?? null,
                quiver: game.uquiver?.otyp ?? null,
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

export async function bridgeFreeRoleOutcome(input, label = null) {
    const witness = label
        ?? `${input.role}/${input.race}/${input.align}/seed${input.seed}`;
    const result = await freshRoleOutcome({ ...input, bridgeFree: true });

    assert.equal(result.error, null, `${witness} bridge-free execution`);
    assert.deepEqual(result.bridges, [], `${witness} bridge-free ledger`);
    return result.world;
}
