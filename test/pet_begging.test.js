import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { flush_screen, show_glyph_cell } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { begForFood, publishMonsterNoise } from '../js/monster_sound.js';
import { makeBlinded } from '../js/sight_change.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';
async function messageLine() {
    await flush_screen();
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
async function hungryPet(species) {
    freshObjectRoom({ moves: 1500 });
    const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(monster);
    assert.ok(monster.edog);
    monster.edog.hungrytime = game.moves - 1;
    monster.msleeping = 0;
    return monster;
}
for (const [species, message] of [
    ['little dog', 'The little dog whines.'],
    ['kitten', 'The kitten meows.'],
    ['baby red dragon', 'The baby red dragon snarls.'],
    ['crocodile', 'The crocodile bellows!'],
    ['jaguar', 'The jaguar snarls.'],
    ['sewer rat', 'The sewer rat squeaks.'],
    ['raven', 'The raven squawks.'],
    ['baby crocodile', 'The baby crocodile chirps.'],
    ['ettin', 'The ettin grunts.'],
    ['pony', 'The pony whinnies.'],
    ['rothe', 'The rothe moos.'],
    ['wumpus', 'The wumpus burbles.'],
]) {
    void test(`a hungry ${species} makes its native begging noise`, async () => {
        const monster = await hungryPet(species);
        await begForFood(monster, game);
        assert.equal(await messageLine(), message);
    });
}
for (const condition of ['sleeping', 'paralyzed', 'does not eat']) {
    void test(`a pet does not beg when ${condition}`, async () => {
        const monster = await hungryPet(condition === 'does not eat' ? 'killer bee' : 'little dog');
        if (condition === 'sleeping')
            monster.msleeping = 1;
        if (condition === 'paralyzed')
            monster.mcanmove = 0;
        await begForFood(monster, game);
        assert.equal(await messageLine(), '');
    });
}
for (const species of ['giant ant', 'red naga hatchling', 'kobold']) {
    void test(`a hungry ${species} visibly seems famished`, async () => {
        const monster = await hungryPet(species);
        game.u.deafTurns = 10;
        await begForFood(monster, game);
        assert.equal(await messageLine(), `The ${species} seems famished.`);
    });
}
void test('an unseen silent pet does not reveal itself by looking famished', async () => {
    const monster = await hungryPet('giant ant');
    monster.minvis = 1;
    await begForFood(monster, game);
    assert.equal(await messageLine(), '');
    assert.notEqual(requireScreenCell(monster.mx - 1, monster.my + 1).ch, 'I');
});
void test('hearing an unseen pet marks its location without revealing its name', async () => {
    const monster = await hungryPet('little dog');
    setMonsterGivenName(monster, 'Fido');
    monster.minvis = 1;
    await begForFood(monster, game);
    assert.equal(await messageLine(), 'It whines.');
    assert.equal(requireScreenCell(monster.mx - 1, monster.my + 1).ch, 'I');
});
void test('a deaf hero does not hear or locate an unseen animal begging', async () => {
    const monster = await hungryPet('little dog');
    monster.minvis = 1;
    game.u.deafTurns = 10;
    await begForFood(monster, game);
    assert.equal(await messageLine(), '');
    assert.notEqual(requireScreenCell(monster.mx - 1, monster.my + 1).ch, 'I');
});
void test('humanoid begging keeps native verbalize text even for a deaf hero', async () => {
    const monster = await hungryPet('hobbit');
    monster.minvis = 1;
    game.u.deafTurns = 10;
    await begForFood(monster, game);
    assert.equal(await messageLine(), '"I\'m hungry."');
    assert.equal(requireScreenCell(monster.mx - 1, monster.my + 1).ch, 'I');
});
void test('a peaceful hissing pet is silent after revealing its unseen position', async () => {
    const monster = await hungryPet('cockatrice');
    monster.minvis = 1;
    await begForFood(monster, game);
    assert.equal(await messageLine(), '');
    assert.equal(requireScreenCell(monster.mx - 1, monster.my + 1).ch, 'I');
});
for (const [hour, message] of [
    ['05', 'howls.'], ['06', 'whines.'], ['21', 'whines.'], ['22', 'howls.'],
]) {
    void test(`a hungry dog follows full-moon night rules at ${hour}:00`, async (context) => {
        context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 6, 1, 12) });
        const monster = await hungryPet('little dog');
        game.flags.moonphase = 4;
        game.datetime = `20261010${hour}0000`;
        await begForFood(monster, game);
        assert.equal(await messageLine(), `The little dog ${message}`);
    });
}
void test('a hungry mumak trumpets and wakes sleepers within its noise radius', async () => {
    const monster = await hungryPet('mumak');
    const nearby = await createMonsterAt('little dog', 12, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    nearby.msleeping = 1;
    await begForFood(monster, game);
    assert.equal(await messageLine(), 'The little dog wakes up.  The mumak trumpets!');
    assert.equal(nearby.msleeping, 0);
});
void test('a hallucinated gecko gives its sales pitch instead of begging noises', async () => {
    const monster = await hungryPet('gecko');
    game.u.hallucinationTurns = 10;
    await begForFood(monster, game);
    assert.match(await messageLine(), /^"15 minutes could save you 15 [^".]+\."$/);
});
void test('a hallucinated gecko appearance also gives the sales pitch', async () => {
    const monster = await hungryPet('little dog');
    game.u.hallucinationTurns = 10;
    show_glyph_cell(monster.mx, monster.my, ':', 2, false, 0, {
        kind: 'monster', mnum: MONSTER_NAME.indexOf('gecko'),
    });
    await begForFood(monster, game);
    assert.match(await messageLine(), /^"15 minutes could save you 15 [^".]+\."$/);
});
void test('a deaf hero cannot hear a trumpeting pet and sleepers stay asleep', async () => {
    const monster = await hungryPet('mumak');
    const nearby = await createMonsterAt('little dog', 12, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    nearby.msleeping = 1;
    game.u.deafTurns = 10;
    await begForFood(monster, game);
    assert.equal(await messageLine(), '');
    assert.equal(nearby.msleeping, 1);
});
void test('a blind hero hears a pet but does not learn its given name', async () => {
    const monster = await hungryPet('kitten');
    setMonsterGivenName(monster, 'Morris');
    await makeBlinded(10, { talk: false });
    await begForFood(monster, game);
    assert.equal(await messageLine(), 'It meows.');
});
void test('a content dingo remains silent but its animal chat still spends time', async () => {
    const monster = await hungryPet('dingo');
    assert.ok(monster.edog);
    monster.edog.hungrytime = game.moves + 500;
    const spentTime = await publishMonsterNoise(monster, game);
    assert.equal(spentTime, true);
    assert.equal(await messageLine(), '');
});
void test('an animal-form shopkeeper gestures about existing credit instead of barking', async () => {
    freshObjectRoom({ left: 4, heroX: 5 });
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.credit = 25;
    await changeMonsterForm(shopkeeper, MONSTER_NAME.indexOf('wolf'));
    await publishMonsterNoise(shopkeeper, game);
    assert.match(await messageLine(), /encourages you to use your 25 zorkmids of credit\./);
});
void test('an animal-form shopkeeper stops following the wrong customer', async () => {
    freshObjectRoom({ left: 4, heroX: 5 });
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.following = 1;
    shopkeeper.eshk.customer = 'Someone else';
    await changeMonsterForm(shopkeeper, MONSTER_NAME.indexOf('wolf'));
    await publishMonsterNoise(shopkeeper, game);
    assert.equal(shopkeeper.eshk.following, 0);
});
//# sourceMappingURL=pet_begging.test.js.map