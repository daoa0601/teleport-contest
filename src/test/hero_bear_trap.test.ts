import { monsterAtPosition } from '../js/monster_location.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { currentAttribute } from '../js/attrib.js';
import { A_DEX, BEAR_TRAP, TT_BEARTRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING, AMULET_OF_UNCHANGING,
    IRON_SHOES, KICKING_BOOTS, OBJECT_NAMES,
} from '../js/object_data.js';
import { heroIsPolymorphed } from '../js/polyself.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';
import { createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { knownObject } from './support/game-objects.js';
import { W_AMUL } from '../js/const.js';

const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');

for (const lifesaving of [false, true] as const) {
    void test(`a bear trap ${lifesaving ? 'allows life saving' : 'kills a mortally wounded hero'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 100 } });
        requireFixtureGame(game);
        const trap = addTrap(game.level, BEAR_TRAP, 10, 10);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);

        await triggerHeroTrap(trap);

        assert.equal(!!game.program_state.gameover, !lifesaving);
        if (lifesaving) {
            assert.ok(game.u.uhp > 0);
            assert.equal(game.u.utraptype, TT_BEARTRAP);
        } else assert.equal(game._deathKiller, 'bear trap');
    });
}

for (const unchanging of [false, true] as const) {
    void test(`a bear trap destroying an ogre body ${unchanging ? 'kills an unchanging hero' : 'allows rehumanization'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        installPolymorphedHero('ogre', { hitPoints: 1, maxHitPoints: 100 });
        const trap = addTrap(game.level, BEAR_TRAP, 10, 10);
        if (unchanging)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_UNCHANGING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);

        await triggerHeroTrap(trap);

        assert.equal(!!game.program_state.gameover, unchanging);
        if (unchanging) {
            assert.equal(game._deathKiller, 'killed while stuck in creature form');
        } else {
            assert.equal(heroIsPolymorphed(game), false);
            assert.equal(game.u.uhp, 100);
            assert.equal(game.u.utraptype, TT_BEARTRAP);
        }
    });
}

for (const form of ['kitten', 'gray ooze', 'fog cloud', 'ghost', 'ogre'] as const) {
    void test(`a bear trap respects the ${form} body`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        installPolymorphedHero(form, { hitPoints: 100 });
        const trap = addTrap(game.level, BEAR_TRAP, 10, 10);
        const dexterity = currentAttribute(A_DEX);
        pushKeys(' '.repeat(100));
        initRng(1n);

        await triggerHeroTrap(trap, { forceTrap: true });

        const caught = form === 'ogre';
        assert.equal(game.u.uhp, 100, 'the inactive human body is not damaged');
        assert.equal(game.u.mh < 100, caught);
        assert.equal(!!game.u.utrap, caught);
        assert.equal(currentAttribute(A_DEX), dexterity - Number(caught));
        assert.equal(trap.tseen, true);
    });
}

for (const type of [IRON_SHOES, KICKING_BOOTS, LOW_BOOTS] as const) {
    void test(`bear-trap protection depends on the boot material (${type})`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        const boots = await addInventoryObject(type);
        wearHeroArmor(boots);
        const trap = addTrap(game.level, BEAR_TRAP, 10, 10);
        const dexterity = currentAttribute(A_DEX);
        pushKeys(' '.repeat(100));
        initRng(1n);

        await triggerHeroTrap(trap);

        const protectedLeg = type !== LOW_BOOTS;
        assert.equal(game.u.utraptype, TT_BEARTRAP);
        assert.equal(game.u.uhp === 100, protectedLeg);
        assert.equal(currentAttribute(A_DEX), dexterity - Number(!protectedLeg));
    });
}

for (const outcome of ['survives', 'life saved', 'dies'] as const) {
    void test(`a bear trap injures the mount and handles a steed that ${outcome}`, async () => {
        freshObjectRoom({ role: 'knight', hero: { ulevel: 30, uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        const steed = await createSaddledSteed();
        if (outcome === 'life saved')
            await equipMonsterObject(steed, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
        await runExtendedCommand('ride', 'l');
        assert.equal(game.u.usteed, steed);
        steed.mhp = steed.mhpmax = outcome === 'survives' ? 100 : 1;
        const trap = addTrap(game.level, BEAR_TRAP, game.u.ux, game.u.uy);
        const dexterity = currentAttribute(A_DEX);
        pushKeys(' '.repeat(100));
        initRng(1n);

        await triggerHeroTrap(trap);

        assert.equal(game.u.uhp, 100);
        assert.equal(currentAttribute(A_DEX), dexterity);
        assert.equal(game.u.usteed, outcome === 'dies' ? null : steed);
        if (outcome === 'dies') {
            assert.equal(game.u.utrap, 0);
            assert.notEqual(monsterAtPosition(game.level, steed.mx, steed.my), steed);
        } else {
            assert.equal(game.u.utraptype, TT_BEARTRAP);
            assert.ok(steed.mhp > 0);
            if (outcome === 'survives') assert.ok(steed.mhp < 100);
        }
    });
}
