import test from 'node:test';
import assert from 'node:assert/strict';
import { ANTI_MAGIC, BEAR_TRAP, D_NODOOR, DOOR, FIRE_TRAP, LAVAPOOL, MM_ANGRY, NO_MINVENT, PIT, ROOM, RUST_TRAP, SLP_GAS_TRAP, STONE, TELEP_TRAP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { mfndpos } from '../js/monmove.js';
import { initializeMonsterWormBody, removeMonsterWormBody } from '../js/monster_worm.js';
import { createPoisonGasCloud, createSteamCloud } from '../js/regions.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { SCR_SCARE_MONSTER } from '../js/object_data.js';
import { monsterLearnsTrap } from '../js/trap_knowledge.js';
import { setTrack } from '../js/track.js';
import { addTrap } from './support/level-state.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function canStep(monster, x, y) {
    requirePlayingGame(game);
    return (await mfndpos(monster, game)).some(square => square.x === x && square.y === y);
}
for (const species of ['floating eye', 'air elemental']) {
    void test(`${species} ${species === 'floating eye' ? 'avoids' : 'crosses'} lava`, async () => {
        const level = freshObjectRoom({ heroX: 15, heroY: 12 });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 10, 10, MM_ANGRY | NO_MINVENT);
        level.requireAt(11, 10).typ = LAVAPOOL;
        assert.equal(await canStep(monster, 11, 10), species !== 'floating eye');
    });
}
void test('a confused peaceful monster can stumble onto the hero square', async () => {
    freshObjectRoom({ heroX: 11, heroY: 10 });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 10, 10, NO_MINVENT);
    goblin.mpeaceful = 1;
    assert.equal(await canStep(goblin, 11, 10), false);
    goblin.mconf = 1;
    assert.equal(await canStep(goblin, 11, 10), true);
});
void test('blindness lets a monster pass a scare-monster scroll', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
    await placeCreatedObject(await knownObject(SCR_SCARE_MONSTER), 11, 10);
    assert.equal(await canStep(goblin, 11, 10), false);
    goblin.mcansee = 0;
    assert.equal(await canStep(goblin, 11, 10), true);
});
void test('a blind unicorn need not avoid squares lined up with the hero', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const unicorn = await createMonsterAt('white unicorn', 10, 10, MM_ANGRY | NO_MINVENT);
    unicorn.mux = 14;
    unicorn.muy = 10;
    assert.equal(await canStep(unicorn, 11, 10), false);
    unicorn.mcansee = 0;
    assert.equal(await canStep(unicorn, 11, 10), true);
});
void test('a peaceful monster avoids the displaced image as well as the hero', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12, hero: { displaced: true } });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 10, 10, NO_MINVENT);
    goblin.mpeaceful = 1;
    goblin.mux = 11;
    goblin.muy = 10;
    assert.equal(await canStep(goblin, 11, 10), false);
});
void test('displacement carries visible scare protection to the apparent hero square', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12, hero: { displaced: true } });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
    goblin.mux = 11;
    goblin.muy = 10;
    await placeCreatedObject(await knownObject(SCR_SCARE_MONSTER), 15, 12);
    assert.equal(await canStep(goblin, 11, 10), false);
    game.u.invisibleTurns = 20;
    assert.equal(await canStep(goblin, 11, 10), true);
});
void test('ordinary pets do not select other pets as melee destinations', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    requirePlayingGame(game);
    const first = await createMonsterAt('little dog', 10, 10, NO_MINVENT);
    const second = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    initializePet(first, { state: game });
    initializePet(second, { state: game });
    assert.equal(await canStep(first, 11, 10), false);
    first.mconf = 1;
    assert.equal(await canStep(first, 11, 10), true);
});
for (const species of ['goblin', 'green dragon', 'iron golem']) {
    void test(`${species} respects its actual poison-gas tolerance when moving`, async () => {
        freshObjectRoom({ heroX: 15, heroY: 12 });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 10, 10, MM_ANGRY | NO_MINVENT);
        await createPoisonGasCloud(game, 11, 10, 1, 8);
        assert.equal(await canStep(monster, 11, 10), species !== 'goblin');
    });
}
void test('a monster already in poison gas can move within the cloud', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
    await createPoisonGasCloud(game, 10, 10, 1, 8);
    await createPoisonGasCloud(game, 11, 10, 1, 8);
    assert.equal(await canStep(goblin, 11, 10), true);
});
void test('harmless steam does not block a breathing monster', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
    await createSteamCloud(game, 11, 10, 1);
    assert.equal(await canStep(goblin, 11, 10), true);
});
void test('Rogue-level doorways forbid diagonal movement even without a door', async () => {
    const level = freshObjectRoom({ heroX: 15, heroY: 12 });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
    const location = level.requireAt(11, 11);
    location.typ = DOOR;
    location.doormask = D_NODOOR;
    assert.equal(await canStep(goblin, 11, 11), true);
    game.rogue_level = { ...game.u.uz };
    assert.equal(await canStep(goblin, 11, 11), false);
    assert.equal(await canStep(goblin, 11, 10), true);
});
void test('poison resistance alone does not make a monster willing to enter poison gas', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    requirePlayingGame(game);
    const bee = await createMonsterAt('killer bee', 10, 10, MM_ANGRY | NO_MINVENT);
    await createPoisonGasCloud(game, 11, 10, 1, 8);
    assert.equal(await canStep(bee, 11, 10), false);
});
void test('a long worm body blocks crossing between its head and the next segment', async () => {
    const level = freshObjectRoom({ left: 7, right: 18, heroX: 16, heroY: 13 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 12, 11, MM_ANGRY | NO_MINVENT);
    removeMonsterWormBody(worm);
    placeMonsterAt(worm, worm.mx, worm.my);
    for (let x = 11; x <= 13; x++) {
        for (let y = 10; y <= 12; y++)
            level.requireAt(x, y).typ = STONE;
    }
    level.requireAt(12, 11).typ = ROOM;
    level.requireAt(11, 10).typ = ROOM;
    initializeMonsterWormBody(worm, { segmentCount: 1 });
    assert.equal(worm.wormSegments?.length, 1);
    level.requireAt(12, 10).typ = ROOM;
    level.requireAt(11, 11).typ = ROOM;
    const goblin = await createMonsterAt('goblin', 12, 10, MM_ANGRY | NO_MINVENT);
    assert.equal(await canStep(goblin, 11, 11), false);
    await createMonsterAt('kobold', 11, 11, MM_ANGRY | NO_MINVENT);
    goblin.mconf = 1;
    assert.equal(await canStep(goblin, 11, 11), true, 'the worm does not prevent attacking across its body');
});
for (const [trapName, type, resistant, vulnerable] of [
    ['bear trap', BEAR_TRAP, 'ochre jelly', 'bugbear'],
    ['fire trap', FIRE_TRAP, 'fire ant', 'goblin'],
    ['sleeping gas trap', SLP_GAS_TRAP, 'elf', 'goblin'],
    ['rust trap', RUST_TRAP, 'flesh golem', 'iron golem'],
    ['pit', PIT, 'rock piercer', 'goblin'],
    ['anti-magic trap', ANTI_MAGIC, 'gray dragon', 'goblin'],
]) {
    for (const species of [resistant, vulnerable]) {
        void test(`${species} ${species === resistant ? 'can cross' : 'avoids'} a known ${trapName}`, async () => {
            const level = freshObjectRoom({ heroX: 15, heroY: 12 });
            requirePlayingGame(game);
            const monster = await createMonsterAt(species, 10, 10, MM_ANGRY | NO_MINVENT);
            const trap = addTrap(level, type, 11, 10);
            monsterLearnsTrap(monster, trap);
            assert.equal(await canStep(monster, 11, 10), species === resistant);
        });
    }
}
void test('a tracked fixed teleport remains a destination even after its type is learned', async () => {
    const level = freshObjectRoom({ heroX: 11, heroY: 10 });
    requirePlayingGame(game);
    setTrack(game);
    game.u.ux = 15;
    game.u.uy = 12;
    const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
    const trap = addTrap(level, TELEP_TRAP, 11, 10);
    monsterLearnsTrap(goblin, trap);
    assert.equal(await canStep(goblin, 11, 10), false);
    trap.teledest = { x: 13, y: 10 };
    assert.equal(await canStep(goblin, 11, 10), true);
});
//# sourceMappingURL=monster_movement_candidates.test.js.map