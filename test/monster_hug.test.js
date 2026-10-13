import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { MM_ANGRY, NO_MINVENT, W_ARM, W_ARMC } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { releaseHold } from '../js/hero_expulsion.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_PROTECTION, LEATHER_ARMOR, OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');
async function attacker(species = 'carnivorous ape') {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | NO_MINVENT);
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    return monster;
}
function attackMessages() {
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, {
        expected: /ape|golem|grab|hold|crush|chok|grease|slippery|pull free|released/,
        limit: 30,
    });
    input.beforeRead = () => { messages.push(game._pending_message); };
    return { messages, input };
}
const hits = {
    random: (range) => range - 1,
    rollOne: () => 1,
    rollDice: (count) => count,
};
void test('a physical hug grabs the hero after two successful claws', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    const { messages } = attackMessages();
    await performMonsterHeroAttack(ape, game, hits);
    messages.push(game._pending_message);
    await flushPendingTopline();
    assert.equal(game.u.ustuck, ape);
    assert.equal(game.u.uhp, 97);
    assert.match(messages.join('\n'), /The carnivorous ape grabs you!/);
});
void test('the grab is established before its pager, and hug damage follows the message', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    const { messages, input } = attackMessages();
    let observedGrab = false;
    input.beforeRead = () => {
        messages.push(game._pending_message);
        if (!game._pending_message.includes('ape hits again!'))
            return;
        observedGrab = true;
        assert.ok(game.u.ustuck === ape, 'the incoming grab already holds the hero during the claw pager');
        assert.equal(game.u.uhp, 98, 'the hug has not dealt damage while its message waits');
    };
    await performMonsterHeroAttack(ape, game, hits);
    assert.equal(observedGrab, true);
    assert.equal(game.u.uhp, 97);
});
void test('a missed preceding claw prevents a new hug', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    const { messages } = attackMessages();
    game.u.uac = 0;
    await performMonsterHeroAttack(ape, game, { ...hits, rollOne: () => 20 });
    messages.push(game._pending_message);
    await flushPendingTopline();
    assert.ok(!game.u.ustuck);
    assert.equal(game.u.uhp, 100);
    assert.doesNotMatch(messages.join('\n'), /grabs|crushed/);
});
void test('a hug can hurt without establishing a hold or printing a hit message', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    const { messages } = attackMessages();
    await performMonsterHeroAttack(ape, game, { ...hits, random: () => 0 });
    messages.push(game._pending_message);
    await flushPendingTopline();
    assert.ok(!game.u.ustuck);
    assert.equal(game.u.uhp, 97);
    assert.doesNotMatch(messages.join('\n'), /grabs|crushed/);
    assert.match(messages.at(-1) ?? '', /ape hits again!$/);
});
for (const [species, word] of [['carnivorous ape', 'crushed'], ['rope golem', 'choked']]) {
    void test(`an established ${species} hold keeps the hero ${word} even when its claws miss`, async () => {
        const monster = await attacker(species);
        requirePlayingGame(game);
        const { messages } = attackMessages();
        await performMonsterHeroAttack(monster, game, hits);
        assert.equal(game.u.ustuck, monster);
        const hp = game.u.uhp;
        game.u.uac = 0;
        await performMonsterHeroAttack(monster, game, { ...hits, rollOne: () => 20 });
        messages.push(game._pending_message);
        await flushPendingTopline();
        assert.equal(game.u.ustuck, monster);
        assert.ok(game.u.uhp < hp);
        assert.match(messages.join('\n'), new RegExp(`You are being ${word}\\.`));
    });
}
void test('a sticky hero takes ordinary hug damage without being grabbed', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    installPolymorphedHero('lichen', { hitPoints: 100 });
    const { messages } = attackMessages();
    await performMonsterHeroAttack(ape, game, hits);
    messages.push(game._pending_message);
    await flushPendingTopline();
    assert.ok(!game.u.ustuck);
    assert.equal(game.u.mh, 97);
    assert.doesNotMatch(messages.join('\n'), /grabs|crushed/);
});
for (const wearsOff of [false, true]) {
    void test(`greased outer armor prevents a hug${wearsOff ? ' and can lose its grease' : ''}`, async () => {
        const ape = await attacker();
        requirePlayingGame(game);
        const armor = await addInventoryObject(LEATHER_ARMOR, { greased: true });
        armor.owornmask = W_ARM;
        game.uarm = armor;
        const { messages } = attackMessages();
        initRng(wearsOff ? 11n : 1n);
        await performMonsterHeroAttack(ape, game, {
            rollOne: hits.rollOne, rollDice: hits.rollDice,
        });
        messages.push(game._pending_message);
        await flushPendingTopline();
        assert.ok(!game.u.ustuck);
        assert.equal(game.u.uhp, 98, 'the claws hurt but the slippery hug does not');
        assert.equal(!!armor.greased, !wearsOff);
        assert.match(messages.join('\n'), /grabs you, but cannot hold onto your greased leather armor!/);
        assert.equal(/The grease wears off\./.test(messages.join('\n')), wearsOff);
    });
}
for (const { blind, oilskin } of [
    { blind: false, oilskin: false },
    { blind: true, oilskin: false },
    { blind: false, oilskin: true },
]) {
    void test(`slipping out of a hug ${blind ? 'leaves unseen armor unnamed' : 'observes and names the armor'} with ${oilskin ? 'a known oilskin cloak' : 'greased leather armor'}`, async () => {
        const ape = await attacker();
        requirePlayingGame(game);
        game.u.blindTurns = blind ? 10 : 0;
        const armor = await addInventoryObject(oilskin ? OILSKIN_CLOAK : LEATHER_ARMOR, {
            greased: !oilskin, typeKnown: true, oname: 'Escape coat',
        });
        armor.dknown = false;
        armor.owornmask = oilskin ? W_ARMC : W_ARM;
        if (oilskin)
            game.uarmc = armor;
        else
            game.uarm = armor;
        const { messages } = attackMessages();
        await performMonsterHeroAttack(ape, game, hits);
        messages.push(game._pending_message);
        await flushPendingTopline();
        assert.ok(!game.u.ustuck);
        assert.equal(game.u.uhp, 98);
        assert.equal(armor.dknown, !blind);
        if (blind)
            assert.doesNotMatch(messages.join('\n'), /Escape coat/);
        else
            assert.match(messages.join('\n'), /cannot hold onto your .+ named Escape coat!/);
    });
}
void test('an undiscovered oilskin cloak prevents a hug without revealing its type', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    const cloak = await addInventoryObject(OILSKIN_CLOAK, {
        typeKnown: false, oname: 'Escape coat',
    });
    cloak.dknown = false;
    game._knownObjectTypes?.delete(OILSKIN_CLOAK);
    cloak.owornmask = W_ARMC;
    game.uarmc = cloak;
    const { messages } = attackMessages();
    await performMonsterHeroAttack(ape, game, hits);
    messages.push(game._pending_message);
    await flushPendingTopline();
    assert.ok(!game.u.ustuck);
    assert.equal(game.u.uhp, 98);
    assert.match(messages.join('\n'), /cannot hold onto your slippery cloak!/);
    assert.doesNotMatch(messages.join('\n'), /oilskin|slippery slippery|Escape coat/);
    assert.equal(cloak.dknown, false);
});
void test('cursed slippery armor can fail to protect against a hug', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    const armor = await addInventoryObject(LEATHER_ARMOR, { cursed: true, greased: true });
    game.uarm = armor;
    const { messages } = attackMessages();
    await performMonsterHeroAttack(ape, game, {
        ...hits, random: range => range === 3 ? 0 : range - 1,
    });
    messages.push(game._pending_message);
    await flushPendingTopline();
    assert.equal(game.u.ustuck, ape);
    assert.equal(game.u.uhp, 97);
    assert.equal(armor.greased, true);
    assert.doesNotMatch(messages.join('\n'), /cannot hold onto/);
});
void test('a cloak covers greased body armor, leaving the hero vulnerable to a hug', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    game.uarm = await addInventoryObject(LEATHER_ARMOR, { greased: true });
    game.uarmc = await addInventoryObject(CLOAK_OF_PROTECTION);
    const { messages } = attackMessages();
    await performMonsterHeroAttack(ape, game, hits);
    messages.push(game._pending_message);
    await flushPendingTopline();
    assert.equal(game.u.ustuck, ape);
    assert.equal(game.u.uhp, 97);
    assert.match(messages.join('\n'), /ape grabs you!/);
});
void test('an acquired hug blocks escape and magical opening releases it', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    const { messages } = attackMessages();
    await performMonsterHeroAttack(ape, game, hits);
    assert.equal(game.u.ustuck, ape);
    initRng(1n);
    await rhack('h'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.ustuck, ape);
    await releaseHold();
    await rhack('h'.charCodeAt(0));
    assert.equal(game.u.ustuck, null);
    assert.equal(game.u.ux, 9);
    assert.ok(ape.mspec_used === 1 || ape.mspec_used === 2);
    assert.match(messages.join('\n'), /cannot escape from the carnivorous ape/);
});
void test('killing a monster releases its acquired hug', async () => {
    const ape = await attacker();
    requirePlayingGame(game);
    attackMessages();
    await performMonsterHeroAttack(ape, game, hits);
    assert.equal(game.u.ustuck, ape);
    await finishHeroMonsterKill(ape, ape.mx, ape.my, { showKillMessage: false, noCorpse: true });
    assert.equal(game.u.ustuck, null);
    assert.equal(ape.dead, true);
});
//# sourceMappingURL=monster_hug.test.js.map