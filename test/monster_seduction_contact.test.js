import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_SSEX, AT_BITE } from '../js/monster_attack_types.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import { monsterName } from '../js/monster_name.js';
import { GAUNTLETS_OF_POWER, LEATHER_ARMOR, LEATHER_GLOVES, OBJECT_NAMES } from '../js/object_data.js';
import { setPropertyTimeout } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const RIN_ADORNMENT = OBJECT_NAMES.indexOf('adornment');
for (const blind of [false, true]) {
    void test(`a ${blind ? 'blind' : 'sighted'} hero ${blind ? 'does not learn' : 'learns'} an unseen adornment ring's appearance from the seduction prompt`, async () => {
        const level = freshObjectRoom({ flags: { female: true }, hero: { blindTurns: blind ? 20 : 0 } });
        requirePlayingGame(game);
        level.flags.noteleport = true;
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[RIN_ADORNMENT] = 'jade';
        const ring = await addInventoryObject(RIN_ADORNMENT, {
            observed: false, dknown: false, typeKnown: false,
        });
        const suit = await addInventoryObject(LEATHER_ARMOR);
        wearHeroArmor(suit);
        const incubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        incubus.female = false;
        const attack = { kind: 'hero-attack', attackType: AT_BITE,
            damageType: AD_SSEX, hit: true, damage: 0 };
        const input = resetInputState();
        await answerPrompts(resolveMonsterContactEffect(incubus, attack, { state: game,
            publish: async () => { }, random: () => 0 }), input, [
            { prompt: blind ? /"That ring looks pretty/ : /"That jade ring looks pretty/, keys: 'n' },
            { prompt: /Shall I remove your suit, lover/, keys: 'n' },
        ]);
        assert.equal(ring.dknown, !blind);
        assert.equal(game.inventory.includes(ring), true);
        assert.notEqual(game.uright, ring);
        assert.notEqual(game.uleft, ring);
    });
}
void test('a leap-day demand reveals a blind hero\'s carried gloves', async () => {
    const level = freshObjectRoom({ flags: { female: false }, hero: { blindTurns: 20 } });
    requirePlayingGame(game);
    level.flags.noteleport = true;
    game.datetime = '20000229120000';
    const gloves = await addInventoryObject(GAUNTLETS_OF_POWER, {
        observed: false, dknown: false, typeKnown: false, oextra: { oname: 'winter mittens' },
    });
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const succubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    succubus.female = true;
    const attack = { kind: 'hero-attack', attackType: AT_BITE,
        damageType: AD_SSEX, hit: true, damage: 0 };
    const messages = [];
    const input = resetInputState();
    await answerPrompts(resolveMonsterContactEffect(succubus, attack, { state: game,
        publish: async (message) => { messages.push(message); }, random: () => 0 }), input, [
        { prompt: /Shall I remove your suit, lover/, keys: 'n' },
    ]);
    assert.equal(gloves.dknown, true);
    assert.ok(game._encounteredObjectTypes?.has(GAUNTLETS_OF_POWER));
    assert.match(messages.join('\n'), /named winter mittens and eleven more pairs of gloves/);
});
void test('a leap-day demand names worn gloves before other carried gloves', async () => {
    const level = freshObjectRoom({ flags: { female: false } });
    requirePlayingGame(game);
    level.flags.noteleport = true;
    game.datetime = '20000229120000';
    await addInventoryObject(LEATHER_GLOVES, { oextra: { oname: 'spare mittens' } });
    const wornGloves = await addInventoryObject(GAUNTLETS_OF_POWER, { oextra: { oname: 'working mittens' } });
    wearHeroArmor(wornGloves);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const succubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    succubus.female = true;
    const attack = { kind: 'hero-attack', attackType: AT_BITE,
        damageType: AD_SSEX, hit: true, damage: 0 };
    const messages = [];
    const input = resetInputState();
    await answerPrompts(resolveMonsterContactEffect(succubus, attack, { state: game,
        publish: async (message) => { messages.push(message); }, random: () => 0 }), input, [
        { prompt: /Shall I remove your suit, lover/, keys: 'n' },
        { prompt: /Shall I remove your gloves, lover/, keys: 'n' },
    ]);
    assert.equal(game.uarmg, wornGloves);
    assert.match(messages.join('\n'), /named working mittens and eleven more pairs of gloves/);
    assert.doesNotMatch(messages.join('\n'), /spare mittens/);
});
for (const female of [false, true]) {
    for (const goodOutcome of [false, true]) {
        const species = female ? 'succubus' : 'incubus';
        void test(`a tame ${species} is called yours during ${goodOutcome ? 'successful' : 'unsuccessful'} seduction`, async () => {
            const level = freshObjectRoom({ flags: { female: !female } });
            requirePlayingGame(game);
            level.flags.noteleport = true;
            const demon = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
            demon.female = female;
            demon.mtame = 10;
            const attack = { kind: 'hero-attack', attackType: AT_BITE,
                damageType: AD_SSEX, hit: true, damage: 0 };
            const messages = [];
            await resolveMonsterContactEffect(demon, attack, { state: game,
                publish: async (message) => { messages.push(message); },
                random: range => range === 35 ? (goodOutcome ? 0 : 34) : 2,
                rollOne: () => 4 });
            assert.ok(messages.includes(`Time stands still while you and your ${species} lie in each other's arms...`), messages.join('\n'));
            if (goodOutcome) {
                assert.ok(messages.includes(`You seem to have enjoyed it more than your ${species}...`), messages.join('\n'));
                assert.ok(messages.includes(`You will always remember your ${species}...`), messages.join('\n'));
            }
            else {
                assert.ok(messages.includes(`Your ${species} seems to have enjoyed it more than you...`), messages.join('\n'));
            }
        });
    }
}
void test('a bad seduction outcome displays the next hallucinated demon identity', async () => {
    const level = freshObjectRoom({ flags: { female: true },
        hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    level.flags.noteleport = true;
    const incubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    incubus.female = false;
    incubus.minvis = true;
    const attack = { kind: 'hero-attack', attackType: AT_BITE,
        damageType: AD_SSEX, hit: true, damage: 0 };
    initRng(2n);
    const partner = monsterName(incubus, { suppressIt: true });
    const satisfiedDemon = monsterName(incubus, { suppressIt: true, capitalized: true });
    initRng(2n);
    const messages = [];
    await resolveMonsterContactEffect(incubus, attack, { state: game,
        publish: async (message) => { messages.push(message); },
        random: range => range === 35 ? 34 : 1 });
    assert.ok(messages.includes(`Time stands still while you and ${partner} lie in each other's arms...`), messages.join('\n'));
    assert.ok(messages.includes(`${satisfiedDemon} seems to have enjoyed it more than you...`), messages.join('\n'));
});
void test('declining an incubus armor-removal prompt keeps the suit and ends seduction', async () => {
    const level = freshObjectRoom({ flags: { female: true } });
    requirePlayingGame(game);
    level.flags.noteleport = true;
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const incubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    incubus.female = false;
    const attack = { kind: 'hero-attack', attackType: AT_BITE,
        damageType: AD_SSEX, hit: true, damage: 0 };
    const input = resetInputState();
    const messages = [];
    await answerPrompts(resolveMonsterContactEffect(incubus, attack, { state: game,
        publish: async (message) => { messages.push(message); }, random: () => 0 }), input, [
        { prompt: /Shall I remove your suit, lover/, keys: 'n' },
    ]);
    assert.equal(game.uarm, suit);
    assert.ok(suit.owornmask);
    assert.equal(attack.attackerDone, true);
    assert.match(messages.join('\n'), /You're such a sweet lady; I wish/);
});
void test('successful seduction raises energy, tires the demon, and ends its attack sequence', async () => {
    const level = freshObjectRoom({ flags: { female: true }, hero: { uen: 3, uenmax: 10, uenpeak: 10 } });
    requirePlayingGame(game);
    level.flags.noteleport = true;
    const incubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    incubus.female = false;
    const attack = { kind: 'hero-attack', attackType: AT_BITE,
        damageType: AD_SSEX, hit: true, damage: 0 };
    await resolveMonsterContactEffect(incubus, attack, { state: game,
        publish: async () => { }, random: () => 0, rollOne: () => 4 });
    assert.equal(game.u.uen, 14);
    assert.equal(game.u.uenmax, 14);
    assert.equal(game.u.uenpeak, 14);
    assert.equal(incubus.mspec_used, 4);
    assert.equal(attack.attackerDone, true);
});
void test('a same-sex incubus contact leaves the hero alone and keeps later claw attacks available', async () => {
    freshObjectRoom({ flags: { female: false } });
    requirePlayingGame(game);
    const incubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    incubus.female = false;
    const attack = { kind: 'hero-attack', attackType: AT_BITE,
        damageType: AD_SSEX, hit: true, damage: 0 };
    const messages = [];
    await resolveMonsterContactEffect(incubus, attack, { state: game,
        publish: async (message) => { messages.push(message); } });
    assert.equal(attack.attackerDone, undefined);
    assert.equal(attack.damage, 0);
    assert.equal(messages.length, 0);
});
void test('a deaf hero loses an adornment ring to a succubus without a confirmation prompt', async () => {
    const level = freshObjectRoom({ flags: { female: false } });
    requirePlayingGame(game);
    level.flags.noteleport = true;
    setPropertyTimeout('deaf', 20);
    const ring = await addInventoryObject(RIN_ADORNMENT);
    const succubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    succubus.female = true;
    const attack = { kind: 'hero-attack', attackType: AT_BITE,
        damageType: AD_SSEX, hit: true, damage: 0 };
    await resolveMonsterContactEffect(succubus, attack, { state: game,
        publish: async () => { }, random: () => 0, rollOne: () => 4 });
    assert.equal(game.inventory.includes(ring), false);
    assert.equal(succubus.minvent.includes(ring), true);
    assert.equal(ring.ocarry, succubus);
    assert.equal(ring.where, 'minvent');
});
//# sourceMappingURL=monster_seduction_contact.test.js.map