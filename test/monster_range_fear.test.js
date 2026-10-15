import test from 'node:test';
import assert from 'node:assert/strict';
import { ALTAR, MM_ANGRY, NO_MINVENT, PIT } from '../js/const.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { checkMonsterHeroRange } from '../js/monster_flee.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { applyArmorOnEffects, wearHeroArmor } from '../js/armor.js';
import { AMULET_OF_LIFE_SAVING, GOLD_DRAGON_SCALES, SCR_SCARE_MONSTER } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function engravingEncounter(x) {
    freshObjectRoom({ left: 8, right: 15, top: 10, bottom: 10,
        hero: { uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth');
    const goblin = await createMonsterAt('goblin', x, 10, MM_ANGRY | NO_MINVENT);
    goblin.msleeping = 0;
    pushKeys(' '.repeat(40));
    initRng(1n);
    return goblin;
}
void test('an adjacent hostile flees a protective engraving instead of attacking', async () => {
    const goblin = await engravingEncounter(11);
    requirePlayingGame(game);
    await takeMonsterTurn(goblin, game);
    assert.equal(goblin.mflee, 1);
    assert.ok((goblin.mfleetim ?? 0) > 0);
    assert.equal(game.u.uhp, 200);
    assert.ok(goblin.mx > 11);
});
void test('a monster becomes frightened after moving within reach of the engraving', async () => {
    const goblin = await engravingEncounter(12);
    requirePlayingGame(game);
    await takeMonsterTurn(goblin, game);
    assert.equal(goblin.mx, 11);
    assert.equal(goblin.mflee, 1);
    assert.ok((goblin.mfleetim ?? 0) > 0);
    assert.equal(game.u.uhp, 200);
});
void test('the engraving does not frighten a monster that remains out of reach', async () => {
    const goblin = await engravingEncounter(13);
    requirePlayingGame(game);
    await takeMonsterTurn(goblin, game);
    assert.equal(goblin.mx, 12);
    assert.equal(Boolean(goblin.mflee), false);
});
void test('a blind monster does not read Elbereth', async () => {
    const goblin = await engravingEncounter(11);
    requirePlayingGame(game);
    goblin.mcansee = 0;
    goblin.mblinded = 20;
    await takeMonsterTurn(goblin, game);
    assert.equal(Boolean(goblin.mflee), false);
});
for (const invisible of [false, true]) {
    void test(`a ${invisible ? 'hidden' : 'visible'} hero controls which square is checked for fear`, async () => {
        const goblin = await engravingEncounter(11);
        requirePlayingGame(game);
        goblin.mux = 12;
        goblin.muy = 10;
        game.u.invisibleTurns = invisible ? 10 : 0;
        await checkMonsterHeroRange(goblin);
        assert.equal(Boolean(goblin.mflee), !invisible);
    });
}
void test('repeated sightings of a scary square do not extend an existing flight', async () => {
    const goblin = await engravingEncounter(11);
    requirePlayingGame(game);
    goblin.mux = game.u.ux;
    goblin.muy = game.u.uy;
    await checkMonsterHeroRange(goblin);
    const turns = goblin.mfleetim;
    await checkMonsterHeroRange(goblin);
    assert.ok(turns !== undefined && turns > 0);
    assert.equal(goblin.mfleetim, turns);
});
void test('bright armor usually frightens a gremlin but sometimes it stays brave', async () => {
    const reactions = new Set();
    for (let seed = 1; seed <= 32 && reactions.size < 2; seed++) {
        freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
        requirePlayingGame(game);
        const gremlin = await createMonsterAt('gremlin', 11, 10, MM_ANGRY | NO_MINVENT);
        gremlin.mux = game.u.ux;
        gremlin.muy = game.u.uy;
        const scales = await addInventoryObject(GOLD_DRAGON_SCALES);
        wearHeroArmor(scales);
        pushKeys(' '.repeat(40));
        await applyArmorOnEffects(scales);
        assert.equal(Boolean(scales.lamplit), true);
        initRng(BigInt(seed));
        await checkMonsterHeroRange(gremlin);
        reactions.add(Boolean(gremlin.mflee));
    }
    assert.ok(reactions.has(true), 'the bright armor can cause flight');
    assert.ok(reactions.has(false), 'the gremlin sometimes resists its fear');
});
for (const lifesaving of [false, true]) {
    void test(`fearful expulsion ${lifesaving ? 'continues after life saving' : 'stops the actor after fatal landing'}`, async () => {
        const level = freshObjectRoom({ hero: { uhp: 1, uhpmax: 80 } });
        requirePlayingGame(game);
        const worm = await createMonsterAt('purple worm', 11, 10, MM_ANGRY | NO_MINVENT);
        addTrap(level, PIT, game.u.ux, game.u.uy);
        await floorObject(SCR_SCARE_MONSTER, game.u.ux, game.u.uy);
        await installSwallowedHero(worm);
        let amulet;
        if (lifesaving) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        pushKeys(' '.repeat(100));
        initRng(1n);
        await takeMonsterTurn(worm, game);
        assert.equal(Boolean(game.u.uswallow), false);
        assert.equal(Boolean(game.program_state.gameover), !lifesaving);
        if (lifesaving) {
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet);
            assert.equal(game.inventory.includes(amulet), false);
            assert.equal(worm.mflee, 1);
        }
        else {
            assert.equal(game.u.uhp, 0);
            assert.equal(Boolean(worm.mflee), false, 'fatal expulsion stops before flight starts');
        }
    });
}
void test('a frightened monster with no escape can still attack in panic', async () => {
    freshObjectRoom({ left: 10, right: 11, top: 10, bottom: 10,
        hero: { uhp: 200, uhpmax: 200, uac: 30 } });
    requirePlayingGame(game);
    makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth');
    const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | NO_MINVENT);
    goblin.msleeping = 0;
    pushKeys(' '.repeat(40));
    initRng(1n);
    await takeMonsterTurn(goblin, game);
    assert.equal(goblin.mflee, 1);
    assert.equal(goblin.mx, 11);
    assert.ok(game.u.uhp < 200);
});
void test('a diagonally adjacent grid bug cannot reach a frightening engraving', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth');
    const bug = await createMonsterAt('grid bug', 11, 11, MM_ANGRY | NO_MINVENT);
    bug.mux = game.u.ux;
    bug.muy = game.u.uy;
    await checkMonsterHeroRange(bug);
    assert.equal(Boolean(bug.mflee), false);
});
for (const species of ['couatl', 'Angel', 'Archon']) {
    for (const scarySquare of ['Elbereth', 'scroll']) {
        void test(`an ordinary ${species} ignores ${scarySquare}`, async () => {
            freshObjectRoom();
            requirePlayingGame(game);
            const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | NO_MINVENT);
            if (scarySquare === 'Elbereth')
                makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth');
            else
                await floorObject(SCR_SCARE_MONSTER, game.u.ux, game.u.uy);
            monster.mux = game.u.ux;
            monster.muy = game.u.uy;
            pushKeys(' '.repeat(40));
            await checkMonsterHeroRange(monster);
            assert.equal(Boolean(monster.mflee), false);
        });
    }
}
for (const [form, alignment, frightened] of [
    ['Aleax', -1, true],
    ['Aleax', 1, false],
    ['Angel', -1, false],
    ['goblin', 1, true],
]) {
    void test(`a polymorphed ${alignment > 0 ? 'lawful' : 'chaotic'} minion in ${form} form ${frightened ? 'fears' : 'ignores'} a scare scroll`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const minion = await createMonsterAt('aligned cleric', 11, 10, MM_ANGRY | NO_MINVENT);
        assert.equal(minion.isminion, 1);
        assert.ok(minion.emin);
        minion.emin.min_align = alignment;
        pushKeys(' '.repeat(40));
        const formNumber = MONSTER_NAME.indexOf(form);
        await changeMonsterForm(minion, formNumber);
        assert.equal(minion.mnum, formNumber);
        await floorObject(SCR_SCARE_MONSTER, game.u.ux, game.u.uy);
        minion.mux = game.u.ux;
        minion.muy = game.u.uy;
        await checkMonsterHeroRange(minion);
        assert.equal(Boolean(minion.mflee), frightened);
    });
}
for (const species of ['vampire leader', 'Vlad the Impaler']) {
    void test(`${species} still fears an altar after taking vampire bat form`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        level.requireAt(game.u.ux, game.u.uy).typ = ALTAR;
        const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | NO_MINVENT);
        const bat = MONSTER_NAME.indexOf('vampire bat');
        await changeMonsterForm(monster, bat);
        assert.equal(monster.mnum, bat);
        monster.mux = game.u.ux;
        monster.muy = game.u.uy;
        pushKeys(' '.repeat(10));
        await checkMonsterHeroRange(monster);
        assert.equal(monster.mflee, 1);
        assert.ok((monster.mfleetim ?? 0) > 0);
    });
}
void test('an ordinary vampire bat does not fear an altar', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(game.u.ux, game.u.uy).typ = ALTAR;
    const bat = await createMonsterAt('vampire bat', 11, 10, MM_ANGRY | NO_MINVENT);
    bat.mux = game.u.ux;
    bat.muy = game.u.uy;
    await checkMonsterHeroRange(bat);
    assert.equal(Boolean(bat.mflee), false);
});
//# sourceMappingURL=monster_range_fear.test.js.map