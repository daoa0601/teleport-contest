import { floorObjectsAt } from './support/level-state.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { D_CLOSED, D_NODOOR, DOOR, MM_ANGRY, MM_NOGRP, NO_MINVENT, NON_PM, PIT, POOL, TT_PIT, W_AMUL, W_WEP } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroIsBlind, heroIsHallucinating } from '../js/senses.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { AMULET_OF_LIFE_SAVING, POT_HEALING, SCR_BLANK_PAPER, WATER_WALKING_BOOTS } from '../js/object_data.js';
import { addInventoryObject, artifactObject, floorObject, knownObject } from './support/game-objects.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { wearHeroArmor } from '../js/armor.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { memoryStorage } from './support/memory-storage.js';
import { loadScoreRecords } from '../js/score_records.js';
import { createStaffedShop } from './support/shop.js';
import { initRng } from '../js/rng.js';
import { polymonHero } from '../js/polyself.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { createDungeon } from './support/topology.js';
const EXPLOSION_PROSE = /^$|freaked out|seem unaffected|reconstitutes|puff of smoke|stagger under your heavy load|rebalance your load|boots smoulder|survived that attempt on your life|explodes|Boom|caught in|medallion|But wait|fatal|feel|burn|frozen|cold|hot|electri|die|destroyed|killed|potion|scroll|pit|fall|evaporat|door|turn into|armor|Goodbye|points|experience|Do not pass Go/i;
function explosionRoom() {
    const input = freshTurnRoom({ role: 'barbarian', left: 1, right: 18, top: 1, bottom: 18 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' })];
    game.u.uhp = game.u.uhpmax = 500;
    const messages = [];
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    installPagerInput(input, { expected: EXPLOSION_PROSE, limit: 48 });
    return { input, messages };
}
async function explodeNextTurn(species, input, { cancelled = false, monsterLifeSaved = false, heroDies = false, } = {}) {
    const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monster.msleeping = 0;
    monster.movement = 12;
    monster.mcan = cancelled ? 1 : 0;
    if (monsterLifeSaved)
        await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    input.feed('m.');
    const takeTurn = async () => {
        await moveloop_core();
        await moveloop_core();
        await flushPendingTopline();
    };
    if (heroDies)
        await takeTurn();
    else
        await finishAtCommandInput(input, takeTurn, EXPLOSION_PROSE);
    return monster;
}
for (const species of ['freezing sphere', 'flaming sphere', 'shocking sphere']) {
    void test(`${species} consumes itself and damages the nearby hero`, async () => {
        const { input, messages } = explosionRoom();
        requirePlayingGame(game);
        const experience = game.u.uexp;
        const kills = game.u.uconduct.killer || 0;
        const monster = await explodeNextTurn(species, input);
        assert.ok(!game.level.monsters.includes(monster));
        assert.ok(game.u.uhp < 500);
        assert.equal(game.u.uexp, experience);
        assert.equal(game.u.uconduct.killer || 0, kills);
        assert.match(messages.join(' '), /explodes!.*Boom!.*caught in/s);
    });
}
for (const [species, affected] of [
    ['yellow light', heroIsBlind], ['black light', heroIsHallucinating],
]) {
    void test(`${species} consumes itself and changes sight without HP damage`, async () => {
        const { input, messages } = explosionRoom();
        requirePlayingGame(game);
        const monster = await explodeNextTurn(species, input);
        assert.ok(!game.level.monsters.includes(monster));
        assert.equal(affected(), true);
        assert.equal(game.u.uhp, 500);
        assert.match(messages.join(' '), /explodes!/);
    });
}
for (const species of ['yellow light', 'black light', 'flaming sphere']) {
    void test(`cancellation prevents ${species} from exploding`, async () => {
        const { input, messages } = explosionRoom();
        requirePlayingGame(game);
        const monster = await explodeNextTurn(species, input, { cancelled: true });
        assert.ok(game.level.monsters.includes(monster));
        assert.equal(game.u.uhp, 500);
        assert.equal(heroIsBlind(), false);
        assert.equal(heroIsHallucinating(), false);
        assert.doesNotMatch(messages.join(' '), /explodes|Boom|misses/);
    });
}
for (const species of ['yellow light', 'black light', 'flaming sphere']) {
    void test(`${species} survives its own explosion when wearing life saving`, async () => {
        const { input } = explosionRoom();
        requirePlayingGame(game);
        const monster = await explodeNextTurn(species, input, { monsterLifeSaved: true });
        assert.ok(game.level.monsters.includes(monster));
        assert.ok(monster.mhp > 0);
        assert.ok(!monster.minvent.some(object => object.otyp === AMULET_OF_LIFE_SAVING));
    });
}
void test('Grayswandir masks a black-light dose which appears after unwielding', async () => {
    const { input, messages } = explosionRoom();
    requirePlayingGame(game);
    await setPrimaryWeapon(await addInventoryItem(await artifactObject('Grayswandir')));
    await explodeNextTurn('black light', input);
    assert.equal(heroIsHallucinating(), false);
    assert.ok((game.u.hallucinationTurns ?? 0) > 0);
    assert.match(messages.join(' '), /You seem unaffected\./);
    await setPrimaryWeapon(null);
    assert.equal(heroIsHallucinating(), true);
});
void test('evaporating the hero pool during a fiery explosion drops a water walker into the new pit', async () => {
    const { input } = explosionRoom();
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(WATER_WALKING_BOOTS));
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    await explodeNextTurn('flaming sphere', input);
    assert.ok(game.level.traps.some(trap => trap.tx === game.u.ux && trap.ty === game.u.uy && trap.ttyp === PIT));
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0);
});
for (const species of ['flaming sphere', 'freezing sphere']) {
    void test(`${species} direct blast has its own fatal line and real species attribution`, async () => {
        const { input, messages } = explosionRoom();
        requirePlayingGame(game);
        game.u.uhp = 1;
        game.storage = memoryStorage();
        game.u.urexp = 100;
        game.flags.disclose = '-i -a -v -c -o';
        await explodeNextTurn(species, input, { heroDies: true });
        assert.equal(game.program_state.gameover, true);
        assert.match(messages.join(' '), /It is fatal\./);
        assert.doesNotMatch(messages.join(' '), /You die/);
        const records = loadScoreRecords(game);
        assert.ok(records[0], 'Death records the completed game');
        assert.equal(records[0].death, `killed by a ${species}'s explosion`);
        if (species === 'flaming sphere')
            assert.equal(game.u.ugrave_arise, NON_PM - 2);
    });
}
void test('hero life saving resumes after fatal direct blast damage', async () => {
    const { input, messages } = explosionRoom();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    await explodeNextTurn('flaming sphere', input);
    assert.ok(!game.program_state.gameover);
    assert.equal(game.u.umortality, 1);
    assert.equal(game._lifeSavedCount, 1);
    assert.ok(game.u.uhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.match(messages.join(' '), /It is fatal\..*But wait.*medallion.*crumbles/s);
});
void test('fire doubles body damage to a cold-resistant bystander without crediting the hero', async () => {
    const { input } = explosionRoom();
    requirePlayingGame(game);
    const wolf = await createMonsterAt('wolf', 10, 9, MM_NOGRP | NO_MINVENT);
    const mold = await createMonsterAt('brown mold', 12, 10, MM_NOGRP | NO_MINVENT);
    for (const monster of [wolf, mold]) {
        monster.mhp = monster.mhpmax = 500;
        monster.movement = 0;
    }
    const experience = game.u.uexp;
    await explodeNextTurn('flaming sphere', input);
    const damage = 500 - wolf.mhp;
    assert.ok(damage > 0);
    assert.equal(500 - mold.mhp, damage * 2);
    assert.equal(game.u.uexp, experience);
});
void test('a burned paper golem leaves paper and changes later fire damage but not floor burning', async () => {
    const { input } = explosionRoom();
    requirePlayingGame(game);
    const paper = await createMonsterAt('paper golem', 10, 9, MM_NOGRP | NO_MINVENT);
    paper.mhp = 1;
    paper.movement = 0;
    const mold = await createMonsterAt('brown mold', 12, 10, MM_NOGRP | NO_MINVENT);
    mold.mhp = mold.mhpmax = 500;
    mold.movement = 0;
    const carried = await addInventoryObject(SCR_BLANK_PAPER, { quantity: 8 });
    await floorObject(SCR_BLANK_PAPER, 12, 11, { quantity: 8 });
    const experience = game.u.uexp;
    await explodeNextTurn('flaming sphere', input);
    assert.ok(!game.level.monsters.includes(paper));
    assert.ok(floorObjectsAt(game.level, 10, 9).some(object => object.otyp === SCR_BLANK_PAPER));
    assert.equal(500 - mold.mhp, 500 - game.u.uhp);
    assert.equal(carried.quan, 8);
    const floorPaper = floorObjectsAt(game.level, 12, 11)
        .filter(object => object.otyp === SCR_BLANK_PAPER)
        .reduce((total, object) => total + object.quan, 0);
    assert.ok(floorPaper < 8);
    assert.equal(game.u.uexp, experience);
});
void test('a sphere burns a shop door with a free repair record and no hero charge', async () => {
    const { input } = explosionRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 14, keeperY: 10, doorX: 12, doorY: 9 });
    shopkeeper.movement = 0;
    const location = game.level.requireAt(12, 9);
    location.typ = DOOR;
    location.doormask = D_CLOSED;
    await explodeNextTurn('flaming sphere', input);
    assert.equal(game.level.requireAt(12, 9).doormask, D_NODOOR);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.ok(shopkeeper.mpeaceful);
    for (let turn = 0; turn < 6; turn++) {
        input.feed('m.');
        await finishAtCommandInput(input, async () => {
            await moveloop_core();
            await moveloop_core();
            await flushPendingTopline();
        }, /^(?:$)|door|repairs|damage/i);
    }
    assert.equal(game.level.requireAt(12, 9).doormask, D_CLOSED);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.ok(shopkeeper.mpeaceful);
});
for (const lifeSaved of [false, true]) {
    void test(`shattered potions ${lifeSaved ? 'allow life saving and the rest of the blast' : 'retain their killer and stop the blast'}`, async () => {
        const { input, messages } = explosionRoom();
        requirePlayingGame(game);
        const potions = await addInventoryObject(POT_HEALING, { quantity: 64 });
        if (lifeSaved)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        game.storage = memoryStorage();
        game.flags.disclose = '-i -a -v -c -o';
        game.u.urexp = 100;
        game.u.uhp = 1;
        await explodeNextTurn('freezing sphere', input, { heroDies: !lifeSaved });
        assert.ok(potions.quan < 64);
        if (lifeSaved) {
            assert.ok(!game.program_state.gameover);
            assert.equal(game.u.umortality, 1);
            assert.ok(game.u.uhp > 0 && game.u.uhp < game.u.uhpmax);
        }
        else {
            assert.ok(game.program_state.gameover);
            const records = loadScoreRecords(game);
            assert.ok(records[0], 'Death records the completed game');
            assert.equal(records[0].death, 'killed by shattered potions');
            assert.doesNotMatch(messages.join(' '), /It is fatal/);
        }
    });
}
void test('fatal pit damage from evaporated water stops later fire damage to the floor pile', async () => {
    const { input, messages } = explosionRoom();
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(WATER_WALKING_BOOTS));
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const paper = await floorObject(SCR_BLANK_PAPER, game.u.ux, game.u.uy, { quantity: 64 });
    initRng(1n);
    game.u.uhp = 1;
    game.flags.disclose = '-i -a -v -c -o';
    await explodeNextTurn('flaming sphere', input, { heroDies: true });
    assert.ok(game.program_state.gameover);
    assert.equal(paper.quan, 64);
    assert.doesNotMatch(messages.join(' '), /You are caught in the/);
});
void test('life saving after an evaporated-pool fall allows the floor fire and blast to finish', async () => {
    const { input } = explosionRoom();
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(WATER_WALKING_BOOTS));
    await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const paper = await floorObject(SCR_BLANK_PAPER, game.u.ux, game.u.uy, { quantity: 64 });
    game.u.uhp = 1;
    initRng(1n);
    await explodeNextTurn('flaming sphere', input);
    assert.ok(!game.program_state.gameover);
    assert.equal(game.u.umortality, 1);
    assert.ok(paper.quan < 64);
    assert.ok(game.u.uhp > 0 && game.u.uhp < game.u.uhpmax);
});
for (const [form, species] of [
    ['red dragon', 'flaming sphere'],
    ['white dragon', 'freezing sphere'],
    ['blue dragon', 'shocking sphere'],
]) {
    void test(`${form} form protects the hero from a ${species}`, async () => {
        const { input } = explosionRoom();
        requirePlayingGame(game);
        const mnum = MONSTER_NAME.indexOf(form);
        await polymonHero(mnum);
        const hp = game.u.mh;
        await explodeNextTurn(species, input);
        assert.equal(game.u.umonnum, mnum);
        assert.equal(game.u.mh, hp);
    });
}
void test('Frost Brand shields a monster from a freezing sphere', async () => {
    const { input } = explosionRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
    await equipMonsterObject(monster, await artifactObject('Frost Brand'), W_WEP);
    monster.movement = 0;
    monster.mhp = monster.mhpmax = 500;
    await explodeNextTurn('freezing sphere', input);
    assert.equal(monster.mhp, 500);
});
void test('fire-resistant monster inventory can burn without damaging its carrier', async () => {
    const { input } = explosionRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('red dragon', 12, 10, MM_NOGRP | NO_MINVENT);
    const scrolls = await equipMonsterObject(monster, await knownObject(SCR_BLANK_PAPER, { quantity: 64 }), 0);
    monster.movement = 0;
    monster.mhp = monster.mhpmax = 500;
    await explodeNextTurn('flaming sphere', input);
    assert.ok(scrolls.quan < 64);
    assert.equal(monster.mhp, 500);
});
//# sourceMappingURL=monster_self_explosion.test.js.map