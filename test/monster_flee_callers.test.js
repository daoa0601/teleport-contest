import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { moveloop_core } from '../js/allmain.js';
import { freshTurnRoom } from './support/playable-room.js';
import { initializePet } from '../js/dog.js';
import { flush_screen, newsym, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { makeMonsterFlee } from '../js/monster_flee.js';
import { resolveMonsterLiquid } from '../js/mon.js';
import { finishMonsterLiquidDeath } from '../js/monster_death.js';
import { AMULET_OF_LIFE_SAVING, CLOVE_OF_GARLIC, DAGGER, OBJECT_NAMES, PICK_AXE, } from '../js/object_data.js';
import { PIT, P_POLEARMS, P_BASIC } from '../js/const.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { installHeroWeaponSkills, installPolymorphedHero, installSwallowedHero, } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const command of ['walk', 'pick']) {
    for (const alreadyFleeing of [false, true]) {
        void test(`${command}: a blocked pet ${alreadyFleeing ? 'keeps untimed fear' : 'starts a timed flight'}`, async () => {
            freshObjectRoom();
            requirePlayingGame(game);
            const pet = await createMonsterAt('little dog', 11, 10);
            initializePet(pet, { state: game });
            if (alreadyFleeing)
                await makeMonsterFlee(pet, { announce: false });
            const pick = command === 'pick'
                ? await addInventoryObject(PICK_AXE) : null;
            if (pick)
                await setPrimaryWeapon(pick, game);
            initRng(7n);
            if (pick)
                await applyInventoryObject(pick, 'l' + ' '.repeat(8));
            else
                await rhack('l'.charCodeAt(0));
            assert.equal(game.u.ux, 10);
            assert.equal(pet.mx, 11);
            assert.equal(pet.mflee, 1);
            if (alreadyFleeing)
                assert.equal(pet.mfleetim, 0);
            else
                assert.ok((pet.mfleetim ?? 0) >= 2 && (pet.mfleetim ?? 0) <= 6);
        });
    }
}
void test('a wounded melee opponent releases its grip when it loses courage', async () => {
    freshObjectRoom({ hero: { uhitinc: 30 } });
    requirePlayingGame(game);
    const bear = await createMonsterAt('owlbear', 11, 10);
    bear.mhp = 40;
    bear.mhpmax = 100;
    game.u.ustuck = bear;
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger, game);
    initRng(30n);
    pushKeys(' '.repeat(16));
    await rhack('l'.charCodeAt(0));
    assert.ok(bear.mhp < 40);
    assert.equal(bear.mflee, 1);
    assert.equal(game.u.ustuck, null);
    await flush_screen();
    const row = requireGameDisplay().grid[0];
    assert.ok(row, 'The display must contain its message row');
    const line = row.map(cell => cell.ch).join('');
    assert.match(line, /The owlbear turns to flee\./);
});
for (const saved of [false, true]) {
    void test(`garlic breath ${saved ? 'resumes eating after life saving' : 'stops eating and later scares after fatal expulsion'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhunger: 900 } });
        requirePlayingGame(game);
        const later = await createMonsterAt('little dog', 12, 10);
        const worm = await createMonsterAt('purple worm', 11, 10);
        installSwallowedHero(worm);
        addTrap(game.level, PIT, game.u.ux, game.u.uy);
        let amulet;
        if (saved) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
            assert.equal(game.uamul, amulet);
        }
        const garlic = await addInventoryObject(CLOVE_OF_GARLIC, { age: game.moves });
        initRng(17n);
        pushKeys(garlic.invlet + ' '.repeat(40));
        await rhack('e'.charCodeAt(0));
        assert.equal(Boolean(game.u.uswallow), false);
        assert.equal(Boolean(game.program_state.gameover), !saved);
        assert.equal(Boolean(worm.mflee), saved);
        assert.equal(Boolean(later.mflee), saved);
        assert.equal(game.u.uhunger, saved ? 940 : 900);
        if (saved) {
            assert.equal(game.inventory.includes(garlic), false);
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet);
            assert.equal(game.inventory.includes(amulet), false);
        }
    });
}
for (const untimed of [false, true]) {
    void test(`a drying eel releases its grip and ${untimed ? 'keeps untimed fear' : 'starts a two-turn flight'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const eel = await createMonsterAt('giant eel', 11, 10);
        if (untimed)
            await makeMonsterFlee(eel, { announce: false });
        game.u.ustuck = eel;
        await resolveMonsterLiquid(eel, game, {
            announce: plineWithContinuation,
            finishDeath: finishMonsterLiquidDeath,
        });
        assert.equal(game.u.ustuck, null);
        assert.equal(eel.mflee, 1);
        assert.equal(eel.mfleetim, untimed ? 0 : 2);
        await flush_screen();
        assert.match(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '', /You get released!/);
    });
}
void test('garlic makes an undead hero nauseated instead of frightening nearby monsters', async () => {
    freshObjectRoom({ hero: { uhunger: 900 } });
    requirePlayingGame(game);
    installPolymorphedHero('vampire');
    const worm = await createMonsterAt('purple worm', 11, 10);
    installSwallowedHero(worm);
    const garlic = await addInventoryObject(CLOVE_OF_GARLIC, { age: game.moves });
    initRng(17n);
    pushKeys(garlic.invlet + ' '.repeat(16));
    await rhack('e'.charCodeAt(0));
    assert.equal(Boolean(game.u.uswallow), true);
    assert.equal(Boolean(worm.mflee), false);
    assert.equal(game.u.vomitingTurns, 5);
    assert.equal(game.u.uhunger, 940);
    assert.equal(game.inventory.includes(garlic), false);
});
void test('a successful thief replaces timed fear with untimed flight', async () => {
    freshTurnRoom({ left: 10, right: 11, top: 10, bottom: 10 });
    requirePlayingGame(game);
    const dagger = await addInventoryObject(DAGGER);
    const nymph = await createMonsterAt('wood nymph', 11, 10);
    nymph.mpeaceful = 0;
    nymph.msleeping = 0;
    nymph.movement = 12;
    nymph.m_lev = 20;
    await makeMonsterFlee(nymph, { turns: 40, announce: false });
    initRng(1n);
    pushKeys('m.' + ' '.repeat(50) + 'm.');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(nymph.minvent.includes(dagger), true);
    assert.equal(nymph.mflee, 1);
    assert.equal(nymph.mfleetim, 0);
});
void test('low health alone does not make an engulfer release the hero after melee', async () => {
    freshObjectRoom({ hero: { uhitinc: 30 } });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    worm.mhp = 40;
    worm.mhpmax = 100;
    installSwallowedHero(worm);
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger, game);
    initRng(30n);
    pushKeys(' '.repeat(16));
    await rhack('l'.charCodeAt(0));
    assert.ok(worm.mhp > 0 && worm.mhp < 40);
    assert.equal(Boolean(worm.mflee), false);
    assert.equal(Boolean(game.u.uswallow), true);
});
void test('an applied polearm does not frighten a wounded foe through melee morale', async () => {
    freshObjectRoom({ hero: { uhitinc: 30 }, flags: { verbose: false } });
    requirePlayingGame(game);
    const bear = await createMonsterAt('owlbear', 12, 10);
    newsym(bear.mx, bear.my);
    bear.mhp = 40;
    bear.mhpmax = 100;
    const pole = await addInventoryObject(OBJECT_NAMES.indexOf('halberd'));
    await setPrimaryWeapon(pole, game);
    installHeroWeaponSkills({ [P_POLEARMS]: P_BASIC });
    initRng(30n);
    await applyInventoryObject(pole, '.' + ' '.repeat(16));
    assert.ok(bear.mhp > 0 && bear.mhp < 40);
    assert.equal(Boolean(bear.mflee), false);
});
//# sourceMappingURL=monster_flee_callers.test.js.map