import test from 'node:test';
import assert from 'node:assert/strict';

import { resetBridgeUsageLedger, getBridgeUsageLedger } from '../js/bridge_policy.js';
import { rhack } from '../js/cmd.js';
import { ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { CLUB, FLINT, SLING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { installLiveCommandHero } from './support/live-command-state.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

function inventoryObject(otyp, invlet, overrides = {}) {
    const names = new Map([
        [CLUB, ['club', 'clubs', 2]],
        [SLING, ['sling', 'slings', 2]],
        [FLINT, ['flint stone', 'flint stones', 13]],
    ]);
    const [name, plural, oclass] = names.get(otyp);
    return {
        otyp, invlet, name, plural, oclass,
        quan: 1, quantity: 1,
        where: 'inventory',
        cursed: false, blessed: false, bknown: true,
        worn: false, wielded: false, alternate: false, ready: false,
        owornmask: 0,
        contents: [], objectTimers: [], timed: 0,
        ...overrides,
    };
}

function freshWeaponArena() {
    resetGame();
    const level = new GameMap();
    for (let x = 8; x <= 18; x++) {
        for (let y = 8; y <= 12; y++) {
            Object.assign(level.at(x, y), {
                typ: ROOM, lit: true, waslit: true, seenv: 255,
            });
        }
    }
    installLiveCommandHero({ role: 'caveman', level, x: 10, y: 10 });
    game.flags = {
        fireassist: true,
        pushweapon: true,
        verbose: true,
        pickup: false,
    };
    game.inventory = [];
    game.uwep = game.uswapwep = game.uquiver = null;
    game.animationFrame = async () => {};
    resetInputState();
    resetBridgeUsageLedger();
    initRng(28101n);
    return level;
}

test('fireassist prefers a known-safe launcher over unknown and known-cursed matches',
    async () => {
        const level = freshWeaponArena();
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: 1,
        });
        const unknown = inventoryObject(SLING, 'b', { bknown: false });
        const knownCursed = inventoryObject(SLING, 'c', { cursed: true });
        const knownSafe = inventoryObject(SLING, 'd');
        const flint = inventoryObject(FLINT, 'e', {
            ready: true, owornmask: 4,
        });
        game.inventory = [club, unknown, knownCursed, knownSafe, flint];
        game.uwep = club;
        game.uquiver = flint;

        await rhack('f'.charCodeAt(0));
        await rhack(0);
        pushKey('l');
        await rhack(0);

        assert.equal(game.uwep, knownSafe);
        assert.equal(game.uswapwep, club);
        assert.equal(game.inventory.includes(flint), false);
        assert.ok(
            (level.objects || []).some(column =>
                (column || []).some(pile =>
                    (pile || []).some(object => object === flint))),
            'the selected launcher must fire and settle the readied identity',
        );
        assert.deepEqual(getBridgeUsageLedger(), {
            bridgeFree: true,
            totalHits: 0,
            forbiddenHits: 0,
            bridges: {},
        });
    });

test('swapping a sole primary makes it the alternate and leaves bare hands',
    async () => {
        freshWeaponArena();
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: 1,
        });
        game.inventory = [club];
        game.uwep = club;

        pushKey(' ');
        await rhack('x'.charCodeAt(0));

        assert.equal(game.uwep, null);
        assert.equal(game.uswapwep, club);
        assert.equal(club.wielded, false);
        assert.equal(club.alternate, true);
        assert.equal(game.context.move, 1);
    });
