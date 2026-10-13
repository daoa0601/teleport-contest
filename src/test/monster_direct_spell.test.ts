import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { ICE, MM_ANGRY, MM_NOGRP, NO_MINVENT, POOL } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_PROTECTION, POT_HEALING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const protection of ['armor', 'half physical damage', 'half spell damage', 'cold resistance']) {
    void test(`Asmodeus casts level-scaled cold magic against ${protection}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: -1000, seeInvisible: true } });
        requirePlayingGame(game);
        const asmodeus = await createMonsterAt('Asmodeus', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        asmodeus.mpeaceful = false;
        asmodeus.mux = game.u.ux;
        asmodeus.muy = game.u.uy;
        asmodeus.m_lev = 30;
        wearHeroArmor(await addInventoryObject(CLOAK_OF_PROTECTION));
        const potion = await addInventoryObject(POT_HEALING);
        game.u.halfPhysicalDamage = protection === 'half physical damage';
        game.u.halfSpellDamage = protection === 'half spell damage';
        game.u.coldResistance = protection === 'cold resistance';
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Asmodeus|frost|resist/, limit: 8 });

        await performMonsterHeroAttack(asmodeus, game, {
            random: limit => limit - 1,
            rollOne: sides => sides,
            rollDice: count => count,
        });
        await flushPendingTopline();

        const damage = protection === 'cold resistance' ? 0 : protection === 'half spell damage' ? 11 : 21;
        assert.equal(game.u.uhp, 100 - damage, 'cold magic uses the caster level and spell protection');
        assert.match(messages.join('\n'), /Asmodeus casts a spell at you!/);
        assert.match(messages.join('\n'), /You're covered in frost\./);
        if (protection === 'cold resistance') assert.match(messages.join('\n'), /But you resist the effects\./);
        assert.equal(potion.where, 'inventory', 'castmu leaves carried potions intact');
        assert.equal(asmodeus.mspec_used ?? 0, 0, 'elemental spells do not set the selected-spell cooldown');
    });
}

for (const failure of ['cancelled', 'cooldown', 'zero level', 'fumble', 'confused fumble']) {
    void test(`Asmodeus cannot cast cold magic with ${failure}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: -1000, seeInvisible: true } });
        requirePlayingGame(game);
        const asmodeus = await createMonsterAt('Asmodeus', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        asmodeus.mpeaceful = false;
        asmodeus.mux = game.u.ux;
        asmodeus.muy = game.u.uy;
        asmodeus.m_lev = failure === 'zero level' ? 0 : 30;
        asmodeus.mcan = failure === 'cancelled' ? 1 : 0;
        asmodeus.mspec_used = failure === 'cooldown' ? 2 : 0;
        asmodeus.mconf = failure === 'confused fumble' ? 1 : 0;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Asmodeus|crackles/, limit: 8 });

        await performMonsterHeroAttack(asmodeus, game, {
            random: limit => limit === 300 && failure.includes('fumble')
                ? failure === 'confused fumble' ? 50 : 0 : limit - 1,
            rollOne: sides => sides,
            rollDice: count => count,
        });
        await flushPendingTopline();

        assert.equal(game.u.uhp, 100);
        assert.match(messages.join('\n'), failure.includes('fumble')
            ? /air crackles around the invisible Asmodeus\./ : /Asmodeus points at you, then curses\./);
    });
}

void test('Asmodeus freezes the hero square even when the hero resists cold', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: -1000, seeInvisible: true, coldResistance: true, waterWalking: true } });
    requirePlayingGame(game);
    const asmodeus = await createMonsterAt('Asmodeus', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    asmodeus.mpeaceful = false;
    asmodeus.mux = game.u.ux;
    asmodeus.muy = game.u.uy;
    const square = game.level.requireAt(game.u.ux, game.u.uy);
    square.typ = POOL;
    installPagerInput(resetInputState(), { expected: /Asmodeus|frost|resist|water/, limit: 8 });

    await performMonsterHeroAttack(asmodeus, game, {
        random: limit => limit - 1, rollOne: sides => sides, rollDice: count => count,
    });

    assert.equal(square.typ, ICE);
    assert.equal(game.u.uhp, 100);
});

void test('Asmodeus remembers observed cold resistance and curses instead of casting again', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: -1000, seeInvisible: true, coldResistance: true } });
    requirePlayingGame(game);
    const asmodeus = await createMonsterAt('Asmodeus', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    asmodeus.mpeaceful = false;
    asmodeus.mux = game.u.ux;
    asmodeus.muy = game.u.uy;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /Asmodeus|frost|resist/, limit: 12 });

    await performMonsterHeroAttack(asmodeus, game, {
        random: limit => limit - 1, rollOne: sides => sides, rollDice: count => count,
    });
    await flushPendingTopline();
    game.u.coldResistance = false;
    messages.length = 0;
    await performMonsterHeroAttack(asmodeus, game, {
        random: limit => limit - 1, rollOne: sides => sides, rollDice: count => count,
    });
    await flushPendingTopline();

    assert.equal(game.u.uhp, 100, 'known resistance prevents a second spell even after protection is removed');
    assert.match(messages.join('\n'), /Asmodeus points at you, then curses\./);
    assert.doesNotMatch(messages.join('\n'), /casts a spell/);
});

void test('Asmodeus wastes a cold spell at a false nearby target', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, seeInvisible: true, displaced: true } });
    requirePlayingGame(game);
    const asmodeus = await createMonsterAt('Asmodeus', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    asmodeus.mpeaceful = false;
    asmodeus.mux = 11;
    asmodeus.muy = 11;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /Asmodeus/, limit: 8 });

    await performMonsterHeroAttack(asmodeus, game, {
        random: limit => limit - 1, rollOne: sides => sides, rollDice: count => count,
    });
    await flushPendingTopline();

    assert.equal(game.u.uhp, 100);
    assert.match(messages.join('\n'), /Asmodeus casts a spell at thin air!/);
    assert.doesNotMatch(messages.join('\n'), /covered in frost/);
});

for (const antimagic of [false, true]) {
    void test(`an Angel's close-range missile shower ${antimagic ? 'bounces off antimagic' : 'uses fresh damage after the spell pre-roll'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: -1000, halfSpellDamage: true, antimagic } });
        requirePlayingGame(game);
        const angel = await createMonsterAt('Angel', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        angel.m_lev = 10;
        angel.mux = game.u.ux;
        angel.muy = game.u.uy;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Angel|missiles/, limit: 12 });

        await performMonsterHeroAttack(angel, game, {
            random: limit => limit - 1, rollOne: sides => sides, rollDice: count => count,
        });
        await flushPendingTopline();

        assert.equal(game.u.uhp, antimagic ? 100 : 94);
        assert.match(messages.join('\n'), /You are hit by a shower of missiles!/);
        if (antimagic) assert.match(messages.join('\n'), /The missiles bounce off!/);
    });
}
