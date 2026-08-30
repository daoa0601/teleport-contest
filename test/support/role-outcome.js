import assert from 'node:assert/strict';

import { game } from '../../js/gstate.js';
import { runSegment } from '../../js/jsmain.js';

export function roleConfig({
    name = 'Generalizer', role, race, gender = 'female', align,
    extraOptions = [], extraLines = [],
}) {
    return [
        `OPTIONS=name:${name},role:${role},race:${race},gender:${gender},align:${align}`,
        ...extraOptions.map(option => `OPTIONS=${option}`),
        'OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen',
        'OPTIONS=pushweapon,showexp,time,color,suppress_alert:3.3.1',
        'OPTIONS=symset:DECgraphics',
        ...extraLines,
        '',
    ].join('\n');
}

function objectState(object) {
    return {
        type: object.otyp,
        quantity: object.quan ?? object.quantity ?? 1,
        charges: object.charges?.current ?? object.spe ?? null,
    };
}

function actorState() {
    return (game.level?.monsters || [])
        .filter(monster => (monster.mhp ?? 1) > 0 && !monster.dead)
        .map(monster => ({
            species: monster.mnum,
            position: [monster.mx, monster.my],
            hp: monster.mhp,
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
    moves = ' ....', datetime = '20260830100000',
    extraOptions = [], extraLines = [],
}) {
    let error = null;
    try {
        await runSegment({
            seed,
            datetime,
            nethackrc: roleConfig({
                name, role, race, gender, align, extraOptions,
                extraLines,
            }),
            moves,
        });
    } catch (caught) {
        error = { code: caught?.code, message: caught?.message };
    }
    return {
        error,
        world: {
            hero: [game.u?.ux, game.u?.uy],
            depth: [game.u?.uz?.dnum, game.u?.uz?.dlevel],
            rooms: game.level?.nroom ?? game.level?.rooms?.length ?? 0,
            prototype: game._activeSpecialLevel?.prototype
                ?? game._specialLevelPrototype ?? null,
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
            inventory: (game.inventory || []).map(objectState),
        },
    };
}

export async function roleOutcome(input, label = null) {
    const witness = label
        ?? `${input.role}/${input.race}/${input.align}/seed${input.seed}`;
    const result = await freshRoleOutcome(input);
    assert.equal(result.error, null, `${witness} execution`);
    return result.world;
}
