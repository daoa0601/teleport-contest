import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';

const CHARACTERS = [
    ['Archeologist', 'human', 'female', 'lawful'],
    ['Barbarian', 'human', 'male', 'neutral'],
    ['Caveman', 'human', 'male', 'lawful'],
    ['Healer', 'human', 'female', 'neutral'],
    ['Knight', 'human', 'male', 'lawful'],
    ['Monk', 'human', 'male', 'neutral'],
    ['Priest', 'human', 'female', 'lawful'],
    ['Rogue', 'human', 'female', 'chaotic'],
    ['Ranger', 'human', 'male', 'neutral'],
    ['Samurai', 'human', 'male', 'lawful'],
    ['Tourist', 'human', 'female', 'neutral'],
    ['Valkyrie', 'human', 'female', 'lawful'],
    ['Wizard', 'human', 'male', 'neutral'],
];

function characterConfig([role, race, gender, align]) {
    return [
        `OPTIONS=name:Generalizer,role:${role},race:${race},gender:${gender},align:${align}`,
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
        enchantment: object.spe ?? object.enchantment ?? 0,
        blessed: !!object.blessed,
        cursed: !!object.cursed,
        known: !!object.known,
        discovered: !!object.dknown,
        worn: object.owornmask ?? 0,
        contents: (object.contents || []).map(objectState),
    };
}

function startupWorld() {
    const pet = game.startingPet;
    return {
        role: game.urole?.key,
        race: game.urace?.name ?? game.urace?.noun,
        female: !!game.flags?.female,
        alignment: game.u?.ualign?.type,
        gods: game.urole?.gods,
        hero: {
            position: [game.u?.ux, game.u?.uy],
            level: game.u?.ulevel,
            hp: [game.u?.uhp, game.u?.uhpmax],
            energy: [game.u?.uen, game.u?.uenmax],
            attributes: [...(game.u?.acurr?.a || [])],
            maximumAttributes: [...(game.u?.amax?.a || [])],
            movement: game.u?.umovement,
            moves: game.moves,
        },
        inventory: (game.inventory || []).map(objectState),
        pet: pet ? {
            species: pet.mnum,
            position: [pet.mx, pet.my],
            hp: [pet.mhp, pet.mhpmax],
            tame: pet.mtame,
            peaceful: pet.mpeaceful,
            inventory: (pet.minvent || pet.inventory || []).map(objectState),
        } : null,
        discoveries: (game.discoveries || []).map(entry => ({ ...entry })),
    };
}

async function startupOutcome(character, bridgeFree) {
    const previousBridgeFree = process.env.TELEPORT_BRIDGE_FREE;
    const previousFixtures = process.env.TELEPORT_DISABLE_FIXTURES;
    if (bridgeFree) process.env.TELEPORT_BRIDGE_FREE = '1';
    else delete process.env.TELEPORT_BRIDGE_FREE;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    try {
        const result = await runSegment({
            seed: 26000 + CHARACTERS.indexOf(character),
            datetime: '20260830100000',
            nethackrc: characterConfig(character),
            moves: ' ',
        });
        return {
            world: startupWorld(),
            startupBridges: Object.keys(
                result.getBridgeUsageLedger().bridges,
            ).filter(id => id.startsWith('fastforward.pre-mklev')
                || id.startsWith('fastforward.post-mklev')
                || id.startsWith('fastforward.mineralize')),
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

test('all selectable roles share one live startup owner', async () => {
    const bridgedRoles = [];
    for (const character of CHARACTERS) {
        const normal = await startupOutcome(character, false);
        const bridgeFree = await startupOutcome(character, true);

        assert.deepEqual(normal.world, bridgeFree.world, character[0]);
        if (normal.startupBridges.length > 0)
            bridgedRoles.push(character[0]);
    }
    assert.deepEqual(bridgedRoles, []);
});
