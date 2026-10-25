import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOMSG } from '../js/const.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { LEATHER_ARMOR, LONG_SWORD, MACE, RING_MAIL, SPLINT_MAIL, TIN_WHISTLE, } from '../js/object_data.js';
// makemon.c:m_initweap()/m_initinv() sidearms and armor, kept as numeric
// constants exactly where the constructor itself uses them.
const FLAIL = 81;
const BROADSWORD = 52;
const SILVER_SABER = 51;
const PLATE_MAIL = 121;
const CRYSTAL_PLATE_MAIL = 122;
const BANDED_MAIL = 125;
const STUDDED_LEATHER_ARMOR = 131;
const K_RATION = 294;
const C_RATION = 295;
const BODY_ARMORS = new Set([
    PLATE_MAIL, CRYSTAL_PLATE_MAIL, SPLINT_MAIL, BANDED_MAIL,
    RING_MAIL, STUDDED_LEATHER_ARMOR, LEATHER_ARMOR,
]);
const OFFICER_RATIONS = new Set([K_RATION, C_RATION]);
const MERCENARY_RANKS = [
    'soldier', 'sergeant', 'lieutenant', 'captain',
    'watchman', 'watch captain', 'guard',
];
async function bornAt(name, seed, x = 12, y = 10) {
    freshObjectRoom({ gameplaySeed: seed });
    const monster = await makemonAt(MONSTER_NAME.indexOf(name), x, y, MM_NOMSG);
    assert.ok(monster, `${name} must be born (seed ${seed})`);
    return monster;
}
void test('every mercenary rank wears exactly one body armor matching its rank budget', async () => {
    for (const name of MERCENARY_RANKS) {
        for (let seed = 1n; seed <= 24n; seed++) {
            const monster = await bornAt(name, seed);
            const bodyArmors = monster.minvent.filter(item => BODY_ARMORS.has(item.otyp));
            assert.equal(bodyArmors.length, 1, `${name} must receive exactly one body armor (seed ${seed})`);
        }
    }
});
void test('soldiers and watchmen never receive officer or elite armor', async () => {
    for (const name of ['soldier', 'watchman']) {
        for (let seed = 1n; seed <= 24n; seed++) {
            const monster = await bornAt(name, seed);
            const otyps = monster.minvent.map(item => item.otyp);
            for (const forbidden of [PLATE_MAIL, CRYSTAL_PLATE_MAIL, SPLINT_MAIL, BANDED_MAIL]) {
                assert.ok(!otyps.includes(forbidden), `${name} wears armor beyond its budget (seed ${seed})`);
            }
        }
    }
});
void test('guards draw from the light body armor pool only', async () => {
    for (let seed = 1n; seed <= 24n; seed++) {
        const guard = await bornAt('guard', seed);
        const otyps = guard.minvent.map(item => item.otyp);
        for (const forbidden of [PLATE_MAIL, CRYSTAL_PLATE_MAIL]) {
            assert.ok(!otyps.includes(forbidden), `guard wears elite armor (seed ${seed})`);
        }
    }
});
void test('a vault guard always carries a cursed, unblessed tin whistle', async () => {
    for (let seed = 1n; seed <= 16n; seed++) {
        const guard = await bornAt('guard', seed);
        const whistle = guard.minvent.find(item => item.otyp === TIN_WHISTLE);
        assert.ok(whistle, `guard carries its whistle (seed ${seed})`);
        assert.equal(whistle.cursed, true, `the whistle is cursed (seed ${seed})`);
        assert.notEqual(whistle.blessed, true, `curse() clears any blessing on the guard's whistle (seed ${seed})`);
    }
});
void test('watch captains carry neither rations nor whistles', async () => {
    for (let seed = 1n; seed <= 24n; seed++) {
        const captain = await bornAt('watch captain', seed);
        const otyps = captain.minvent.map(item => item.otyp);
        assert.ok(!otyps.includes(TIN_WHISTLE), `watch captain carries a whistle (seed ${seed})`);
        for (const ration of OFFICER_RATIONS) {
            assert.ok(!otyps.includes(ration), `watch captain carries a ration (seed ${seed})`);
        }
    }
});
void test('watchmen usually carry an ordinary tin whistle', async () => {
    let whistles = 0;
    for (let seed = 1n; seed <= 24n; seed++) {
        const watchman = await bornAt('watchman', seed);
        const whistle = watchman.minvent.find(item => item.otyp === TIN_WHISTLE);
        if (whistle) {
            whistles++;
            assert.notEqual(whistle.cursed, true, `a watchman's whistle is never cursed (seed ${seed})`);
        }
    }
    assert.ok(whistles > 12, `most watchmen carry whistles (${whistles}/24)`);
});
void test('officers receive the sidearm of their rank', async () => {
    const ranks = [
        ['sergeant', [FLAIL, MACE]],
        ['lieutenant', [BROADSWORD, LONG_SWORD]],
        ['captain', [LONG_SWORD, SILVER_SABER]],
        ['watch captain', [LONG_SWORD, SILVER_SABER]],
    ];
    for (const [name, choices] of ranks) {
        for (let seed = 1n; seed <= 16n; seed++) {
            const officer = await bornAt(name, seed);
            assert.ok(officer.minvent.some(item => choices.includes(item.otyp)), `${name} lacks its rank sidearm (seed ${seed})`);
        }
    }
});
void test('officers draw campaign rations, plain soldiers rarely carry magic', async () => {
    let rations = 0;
    for (let seed = 1n; seed <= 24n; seed++) {
        const sergeant = await bornAt('sergeant', seed);
        if (sergeant.minvent.some(item => OFFICER_RATIONS.has(item.otyp)))
            rations++;
    }
    assert.ok(rations > 0, 'sergeants carry rations');
});
//# sourceMappingURL=mercenary_birth_loadouts.test.js.map