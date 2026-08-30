import test from 'node:test';
import assert from 'node:assert/strict';

import { ROOM } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { installLiveCommandHero } from './support/live-command-state.js';

function installLichenArena(role) {
    resetGame();
    const level = new GameMap();
    for (const [x, y] of [[10, 10], [11, 10]]) {
        Object.assign(level.at(x, y), {
            typ: ROOM, lit: true, waslit: true, seenv: 255,
        });
    }
    const lichen = {
        mnum: 158, m_id: 77, mx: 11, my: 10,
        mhp: 100, mhpmax: 100, m_lev: 0, mac: 10,
        mpeaceful: 0, mtame: 0, mcanmove: 1, msleeping: 0,
        mstrategy: 0, minvis: 0, mundetected: 0,
    };
    level.monsters = [lichen];
    installLiveCommandHero({ role, level, x: 10, y: 10 });
    return { level, lichen };
}

function equipKatana() {
    const katana = {
        otyp: OBJECT_NAMES.indexOf('katana'), oclass: 2, name: 'katana',
        spe: 0, enchantment: 0, worn: true, owornmask: 1,
    };
    game.inventory = [katana];
    game.uwep = katana;
    return katana;
}

async function lichenMeleeOutcome(role) {
    const { level, lichen } = installLichenArena(role);
    equipKatana();

    initRng(901n);
    await rhack('l'.charCodeAt(0));
    return {
        retained: level.monsters.includes(lichen),
        hp: lichen.mhp,
        experience: game.u.uexp ?? 0,
        message: game._pending_message,
    };
}

async function twoWeaponLichenOutcome(role) {
    const { level, lichen } = installLichenArena(role);
    const katana = equipKatana();
    const wakizashi = {
        // NetHack represents the Samurai's wakizashi as a short sword with a
        // role-specific display name.
        otyp: OBJECT_NAMES.indexOf('short sword'),
        oclass: 2, name: 'wakizashi',
        spe: 0, enchantment: 0, worn: true, owornmask: 2,
    };
    game.u.acurr.a[0] = 18;
    game.u.acurr.a[1] = 14;
    game.u.weaponSkills = Array.from({ length: 38 }, () => ({
        skill: 0, maxSkill: 0, advance: 0,
    }));
    for (const skill of [5, 7, 36]) {
        game.u.weaponSkills[skill] = {
            skill: 1, maxSkill: 4, advance: 0,
        };
    }
    game.inventory = [katana, wakizashi];
    game.uswapwep = wakizashi;
    game.u.twoweap = true;

    // This seed makes the primary d20 miss and the off-hand d20 hit.  The
    // assertions below describe the source outcome, not the RNG transcript.
    initRng(2n);
    await rhack('l'.charCodeAt(0));
    return {
        retained: level.monsters.includes(lichen),
        hp: lichen.mhp,
        message: game._pending_message,
    };
}

test('equipped lichen melee is role-independent shared combat', async () => {
    const ordinary = await lichenMeleeOutcome('tourist');
    const samurai = await lichenMeleeOutcome('samurai');

    assert.deepEqual(samurai, ordinary);
    assert.equal(samurai.retained, true);
    assert.equal(samurai.hp, 100);
    assert.equal(samurai.experience, 0);
    assert.equal(samurai.message, 'You miss the lichen.');
});

test('two-weapon combat attempts an off-hand strike for every role',
    async () => {
        const ordinary = await twoWeaponLichenOutcome('tourist');
        const samurai = await twoWeaponLichenOutcome('samurai');

        assert.deepEqual(samurai, ordinary);
        assert.equal(samurai.retained, true);
        assert.ok(samurai.hp < 100);
        assert.match(samurai.message, /You miss the lichen\./);
        assert.match(samurai.message, /You hit the lichen\./);
    });
