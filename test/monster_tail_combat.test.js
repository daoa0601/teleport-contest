import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOTAIL, NO_MINVENT, ROOM, STONE } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { placeMonsterAt, monsterAtPosition } from '../js/monster_location.js';
import { initializeMonsterWormBody, removeMonsterWormBody } from '../js/monster_worm.js';
import { runMonsterAction } from '../js/monmove.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function createWormWithTail(head, tail) {
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', head.x, head.y, MM_ANGRY | NO_MINVENT | MM_NOTAIL);
    const surroundings = [];
    for (let x = head.x - 1; x <= head.x + 1; x++) {
        for (let y = head.y - 1; y <= head.y + 1; y++) {
            if (x === head.x && y === head.y)
                continue;
            const location = game.level.requireAt(x, y);
            surroundings.push([location, location.typ]);
            location.typ = x === tail.x && y === tail.y ? ROOM : STONE;
        }
    }
    removeMonsterWormBody(worm);
    placeMonsterAt(worm, worm.mx, worm.my);
    initializeMonsterWormBody(worm, { segmentCount: 1 });
    for (const [location, type] of surroundings)
        location.typ = type;
    vision_recalc(0);
    assert.equal(monsterAtPosition(game.level, tail.x, tail.y), worm);
    return worm;
}
async function watchCombat(attacker) {
    requirePlayingGame(game);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push((game._screen_output.split('\n')[0] ?? '')); };
    pushKeys(' '.repeat(80));
    await runMonsterAction(attacker, game);
    await flush_screen(1);
    messages.push((game._screen_output.split('\n')[0] ?? ''));
    return messages.join('\n');
}
for (const tame of [true, false]) {
    void test(`a ${tame ? 'pet' : 'confused'} owlbear can strike a worm tail but cannot hug it`, async () => {
        const level = freshObjectRoom({ heroX: 13, heroY: 10 });
        requirePlayingGame(game);
        const worm = await createWormWithTail({ x: 12, y: 11 }, { x: 12, y: 10 });
        const owlbear = await createMonsterAt('owlbear', 11, 10, MM_ANGRY | NO_MINVENT);
        if (tame)
            initializePet(owlbear, { state: game });
        else
            owlbear.mconf = 1;
        owlbear.m_lev = 30;
        owlbear.mhp = 200;
        owlbear.mhpmax = 200;
        worm.mhp = 200;
        worm.mhpmax = 200;
        worm.movement = 0;
        worm.mlstmv = game.moves;
        await placeCreatedObject(await knownObject(BOULDER), worm.mx, worm.my);
        for (let x = 10; x <= 12; x++) {
            for (let y = 9; y <= 11; y++) {
                if (x === 11 && y === 10 || x === 12)
                    continue;
                level.requireAt(x, y).typ = STONE;
            }
        }
        level.requireAt(11, 9).typ = STONE;
        level.requireAt(11, 11).typ = STONE;
        level.requireAt(12, 9).typ = STONE;
        vision_recalc(0);
        initRng(1n);
        const messages = await watchCombat(owlbear);
        assert.ok(worm.mhp < 200, 'the selected tail shares the worm health');
        assert.ok(worm.mhp >= 188, 'only the two claw attacks deal damage');
        assert.match(messages, /grab attempt fails to hold the long worm's tail!/);
        assert.doesNotMatch(messages, /squeezes/);
    });
}
for (const species of ['long worm', 'air elemental']) {
    void test(`an owlbear ${species === 'long worm' ? 'can hug a worm head' : 'cannot hug an unsolid defender'}`, async () => {
        freshObjectRoom({ heroX: 9, heroY: 10 });
        requirePlayingGame(game);
        const owlbear = await createMonsterAt('owlbear', 11, 10, NO_MINVENT);
        initializePet(owlbear, { state: game });
        owlbear.m_lev = 30;
        owlbear.mhp = 200;
        owlbear.mhpmax = 200;
        const defender = await createMonsterAt(species, 12, 10, MM_ANGRY | NO_MINVENT | MM_NOTAIL);
        defender.mhp = 200;
        defender.mhpmax = 200;
        defender.movement = 0;
        defender.mlstmv = game.moves;
        initRng(1n);
        const messages = await watchCombat(owlbear);
        assert.ok(defender.mhp < 200);
        if (species === 'long worm')
            assert.match(messages, /owlbear squeezes the long worm/);
        else {
            assert.ok(defender.mhp >= 188);
            assert.match(messages, /grab attempt passes right through the air elemental!/);
            assert.doesNotMatch(messages, /squeezes/);
        }
    });
}
void test('a pet cannot claw a distant worm head by standing next to its tail', async () => {
    freshObjectRoom({ heroX: 9, heroY: 10 });
    requirePlayingGame(game);
    const worm = await createWormWithTail({ x: 13, y: 10 }, { x: 12, y: 10 });
    const owlbear = await createMonsterAt('owlbear', 11, 10, NO_MINVENT);
    initializePet(owlbear, { state: game });
    owlbear.m_lev = 30;
    owlbear.mhp = 200;
    owlbear.mhpmax = 200;
    worm.mhp = 200;
    worm.mhpmax = 200;
    initRng(1n);
    const messages = await watchCombat(owlbear);
    assert.equal(worm.mhp, 200);
    assert.doesNotMatch(messages, /owlbear (hits|squeezes)/);
});
void test('an owlbear hugs automatically only after both preceding claws hit', async () => {
    let hugs = 0;
    let interruptedHugs = 0;
    for (let seed = 1; seed <= 16; seed++) {
        freshObjectRoom({ heroX: 9, heroY: 10 });
        requirePlayingGame(game);
        const owlbear = await createMonsterAt('owlbear', 11, 10, NO_MINVENT);
        initializePet(owlbear, { state: game });
        owlbear.m_lev = 1;
        owlbear.mhp = 200;
        owlbear.mhpmax = 200;
        const goblin = await createMonsterAt('goblin', 12, 10, MM_ANGRY | NO_MINVENT);
        goblin.mhp = 200;
        goblin.mhpmax = 200;
        goblin.movement = 0;
        goblin.mlstmv = game.moves;
        initRng(BigInt(seed));
        const messages = await watchCombat(owlbear);
        const claws = Array.from(messages.matchAll(/owlbear (hits|misses) the goblin/g), match => match[1]);
        assert.equal(claws.length, 2, messages);
        const bothHit = claws.every(verb => verb === 'hits');
        assert.equal(/owlbear squeezes the goblin/.test(messages), bothHit, messages);
        if (bothHit)
            hugs++;
        else
            interruptedHugs++;
    }
    assert.ok(hugs > 0 && interruptedHugs > 0, 'exercise both successful and interrupted grabs');
});
void test('a mimic cannot adhere to an unsolid monster', async () => {
    freshObjectRoom({ heroX: 9, heroY: 10 });
    requirePlayingGame(game);
    const mimic = await createMonsterAt('large mimic', 11, 10, NO_MINVENT);
    initializePet(mimic, { state: game });
    mimic.m_lev = 30;
    mimic.mhp = 200;
    mimic.mhpmax = 200;
    mimic.m_ap_type = 0;
    mimic.mappearance = 0;
    mimic.mundetected = 0;
    const elemental = await createMonsterAt('air elemental', 12, 10, MM_ANGRY | NO_MINVENT);
    elemental.mhp = 200;
    elemental.mhpmax = 200;
    elemental.movement = 0;
    elemental.mlstmv = game.moves;
    initRng(1n);
    const messages = await watchCombat(mimic);
    assert.equal(elemental.mhp, 200);
    assert.match(messages, /adhere attempt passes right through the air elemental!/);
});
void test('ordinary sticking contact still damages a solid worm tail', async () => {
    freshObjectRoom({ heroX: 9, heroY: 10 });
    requirePlayingGame(game);
    const worm = await createWormWithTail({ x: 12, y: 11 }, { x: 12, y: 10 });
    const mimic = await createMonsterAt('large mimic', 11, 10, NO_MINVENT);
    initializePet(mimic, { state: game });
    mimic.m_lev = 30;
    mimic.mhp = 200;
    mimic.mhpmax = 200;
    mimic.m_ap_type = 0;
    mimic.mappearance = 0;
    mimic.mundetected = 0;
    worm.mhp = 200;
    worm.mhpmax = 200;
    worm.movement = 0;
    worm.mlstmv = game.moves;
    await placeCreatedObject(await knownObject(BOULDER), worm.mx, worm.my);
    initRng(1n);
    const messages = await watchCombat(mimic);
    assert.ok(worm.mhp < 200);
    assert.doesNotMatch(messages, /adhere attempt|fails to hold/);
});
void test('a failed hold does not reveal an unseen unsolid defender', async () => {
    freshObjectRoom({ heroX: 9, heroY: 10 });
    requirePlayingGame(game);
    const owlbear = await createMonsterAt('owlbear', 11, 10, NO_MINVENT);
    initializePet(owlbear, { state: game });
    owlbear.m_lev = 30;
    owlbear.mhp = 200;
    owlbear.mhpmax = 200;
    const elemental = await createMonsterAt('air elemental', 12, 10, MM_ANGRY | NO_MINVENT);
    elemental.mhp = 200;
    elemental.mhpmax = 200;
    elemental.minvis = 1;
    elemental.movement = 0;
    elemental.mlstmv = game.moves;
    initRng(1n);
    const messages = await watchCombat(owlbear);
    assert.ok(elemental.mhp < 200 && elemental.mhp >= 188);
    assert.doesNotMatch(messages, /grab attempt|air elemental/);
});
void test("a blind floating eye's passive can enable a hug after a missed claw", async () => {
    let hugsAfterMiss = 0;
    for (let seed = 1; seed <= 16; seed++) {
        freshObjectRoom({ heroX: 9, heroY: 10 });
        requirePlayingGame(game);
        const owlbear = await createMonsterAt('owlbear', 11, 10, NO_MINVENT);
        initializePet(owlbear, { state: game });
        owlbear.m_lev = 1;
        owlbear.mhp = 200;
        owlbear.mhpmax = 200;
        const eye = await createMonsterAt('floating eye', 12, 10, MM_ANGRY | NO_MINVENT);
        eye.mhp = 200;
        eye.mhpmax = 200;
        eye.mcansee = 0;
        eye.mblinded = 20;
        eye.movement = 0;
        eye.mlstmv = game.moves;
        initRng(BigInt(seed));
        const messages = await watchCombat(owlbear);
        if (/owlbear misses the floating eye/.test(messages)
            && /owlbear squeezes the floating eye/.test(messages))
            hugsAfterMiss++;
    }
    assert.ok(hugsAfterMiss > 0, 'Native passivemm can report a hit even when the claw missed');
});
//# sourceMappingURL=monster_tail_combat.test.js.map