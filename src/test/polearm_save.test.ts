import type { InventoryObjectOverrides } from './support/game-objects.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { P_BASIC, P_LONG_SWORD, P_POLEARMS, W_WEP } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const HALBERD = OBJECT_NAMES.indexOf('halberd');

async function wieldReachWeapon(type: number, properties: InventoryObjectOverrides = {}) {
    const weapon = await addInventoryObject(type, {
        spe: 20, wielded: true, owornmask: W_WEP, ...properties,
    });
    game.uwep = game.u.uwep = weapon;
    installHeroWeaponSkills({ [P_POLEARMS]: P_BASIC, [P_LONG_SWORD]: P_BASIC });
    return weapon;
}

async function sturdyJackalAt(x: number, y: number) {
    const monster = await createMonsterAt('jackal', x, y);
    monster.mhp = monster.mhpmax = 1000;
    monster.mpeaceful = false;
    newsym(x, y);
    return monster;
}

void test('saving preserves the last sensed polearm target when several targets are in reach',
    async () => {
        freshObjectRoom({ hero: { detectMonsters: true } });
        requirePlayingGame(game);
        game.plname = 'Reach';
        await wieldReachWeapon(HALBERD);
        const first = await sturdyJackalAt(12, 10);
        await rhack('f'.charCodeAt(0));
        assert.ok(first.mhp < 1000);
        const firstId = first.m_id;
        const firstHp = first.mhp;
        await sturdyJackalAt(10, 12);
        const storage = memoryStorage();

        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame('Reach', storage), true);
        await rhack('f'.charCodeAt(0));

        const restoredFirst = requireGameLevel().monsters.find(monster => monster.m_id === firstId);
        const other = requireGameLevel().monsters.find(monster => monster.m_id !== firstId);
        assert.ok(restoredFirst != null);
        assert.ok(restoredFirst.mhp < firstHp);
        assert.ok(other != null);
        assert.equal(other.mhp, 1000);
        assert.equal(game.context.move, 1);
    });

void test('saving cannot reset the once-per-turn distant strike from Snickersnee',
    async () => {
        freshObjectRoom({ moves: 0 });
        requirePlayingGame(game);
        game.plname = 'Snickersnee';
        const artifact = artifactByName('Snickersnee');
    assert.ok(artifact);
        await wieldReachWeapon(artifact.baseType, { oartifact: artifact.id });
        const target = await sturdyJackalAt(12, 10);
        await rhack('f'.charCodeAt(0));
        assert.ok(target.mhp < 1000);
        assert.equal(game.context.move, 0);
        const hpAfterFirst = target.mhp;
        const storage = memoryStorage();

        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame('Snickersnee', storage), true);
        const hungerBeforeRepeat = game.u.uhunger;
        await rhack('f'.charCodeAt(0));
        const restoredTarget = requireGameLevel().monsters[0];
        assert.ok(game.u.uhunger < hungerBeforeRepeat);
        assert.ok(restoredTarget != null);
        assert.equal(restoredTarget.mhp, hpAfterFirst);
        assert.equal(game.context.move, 0);

        game.moves++;
        await rhack('f'.charCodeAt(0));
        assert.ok(restoredTarget != null);
        assert.ok(restoredTarget.mhp < hpAfterFirst);
        assert.equal(game.context.move, 0);
    });
