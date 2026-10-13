import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, W_QUIVER } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGoldAmount, heroGoldAmount } from '../js/hero_gold.js';
import { AD_SGLD, AD_SSEX, AT_CLAW, AT_BITE } from '../js/monster_attack_types.js';
import type { HeroContactAttack } from '../js/monster_action_types.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { resetInputState } from '../js/input.js';
import { setQuiverObject } from '../js/weapon_slots.js';

void test('a leprechaun steals a small purse, keeps the gold, and flees without cancelling claw damage', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.flags.noteleport = true;
    setHeroGoldAmount(game, 20);
    const leprechaun = await createMonsterAt('leprechaun', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_CLAW,
        damageType: AD_SGLD, hit: true, damage: 2 };
    const messages: string[] = [];
    installPagerInput(resetInputState(), { expected: /leprechaun|lighter|mysterious force/, limit: 4 });

    await resolveMonsterContactEffect(leprechaun, attack, { state: game,
        publish: async message => { messages.push(message); }, random: () => 0 });

    assert.equal(heroGoldAmount(game), 0);
    assert.equal(leprechaun.minvent.find(object => object.otyp === GOLD_PIECE)?.quan, 20);
    assert.equal(leprechaun.mflee, 1);
    assert.equal(attack.damage, 2);
    assert.ok(messages.includes('Your purse feels lighter.'));
    assert.ok(messages.includes('A mysterious force prevents the leprechaun from teleporting!'));
});

for (const amount of [20, 100]) {
    void test(`a leprechaun stealing from ${amount} readied coins ${amount === 20 ? 'empties the quiver' : 'leaves the remainder readied'}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        level.flags.noteleport = true;
        const purse = setHeroGoldAmount(game, amount);
        assert.ok(purse);
        await setQuiverObject(purse);
        const leprechaun = await createMonsterAt('leprechaun', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_CLAW,
            damageType: AD_SGLD, hit: true, damage: 2 };

        await resolveMonsterContactEffect(leprechaun, attack, { state: game,
            publish: async () => {}, random: () => 0 });

        const stolen = leprechaun.minvent.find(object => object.otyp === GOLD_PIECE);
        assert.ok(stolen);
        assert.equal(stolen.quan, amount === 20 ? 20 : 50);
        assert.equal(stolen.owornmask, 0);
        assert.equal(stolen.ready, false);
        assert.equal(stolen.ocarry, leprechaun);
        const remaining = amount === 20 ? null : purse;
        assert.equal(game.uquiver, remaining);
        assert.equal(game.u.uquiver, remaining);
        if (remaining) {
            assert.equal(remaining.quan, 50);
            assert.equal(remaining.owornmask, W_QUIVER);
        }
    });
}

for (const amount of [20, 1000]) {
    void test(`paying a seducer from ${amount} readied coins ${amount === 20 ? 'empties the quiver' : 'leaves the remainder readied'}`, async () => {
        const level = freshObjectRoom({ flags: { female: true } });
        requirePlayingGame(game);
        level.flags.noteleport = true;
        const purse = setHeroGoldAmount(game, amount);
        assert.ok(purse);
        await setQuiverObject(purse);
        const incubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        incubus.female = false;
        const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_BITE,
            damageType: AD_SSEX, hit: true, damage: 0 };

        await resolveMonsterContactEffect(incubus, attack, { state: game,
            publish: async () => {}, random: range => range === 20 ? 19 : 0,
            rollOne: () => 1 });

        const payment = incubus.minvent.find(object => object.otyp === GOLD_PIECE);
        assert.ok(payment);
        assert.equal(payment.quan, amount === 20 ? 20 : 501);
        assert.equal(payment.owornmask, 0);
        assert.equal(payment.ready, false);
        assert.equal(payment.ocarry, incubus);
        const remaining = amount === 20 ? null : purse;
        assert.equal(game.uquiver, remaining);
        assert.equal(game.u.uquiver, remaining);
        if (remaining) {
            assert.equal(remaining.quan, 499);
            assert.equal(remaining.owornmask, W_QUIVER);
        }
    });
}

