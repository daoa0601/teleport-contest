import test from 'node:test';
import assert from 'node:assert/strict';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { beginMonsterHeroAttack } from '../js/monmove.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import { AD_CURS, AT_CLAW } from '../js/monster_attack_types.js';
import { grantIntrinsicProperty, hasPermanentIntrinsicProperty } from '../js/properties.js';
import { RING_MAIL } from '../js/object_data.js';
import { d, initRng, rn2 } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('ring mail can cancel a grid bug bite after its single base damage roll', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await addInventoryObject(RING_MAIL);
    wearHeroArmor(armor);
    findArmorClass();
    const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    bug.m_lev = 30;
    bug.mux = game.u.ux;
    bug.muy = game.u.uy;
    const hp = game.u.uhp;
    initRng(2n);

    const attack = await beginMonsterHeroAttack(bug, game, rn2, () => 1, d, []);

    assert.equal(attack.heroAttackSequence?.current?.hit, true);
    assert.equal(attack.heroAttackSequence?.current?.damage, 0);
    assert.equal(game.u.uhp, hp, 'magic cancellation prevents the electric bite damage');
});

void test('a fresh room keeps ordinary wraith damage when the host clock is midnight', async context => {
    context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 10, 5) });
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const wraith = await createMonsterAt('wraith', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    wraith.m_lev = 30;
    wraith.mux = game.u.ux;
    wraith.muy = game.u.uy;

    const attack = await beginMonsterHeroAttack(wraith, game,
        range => Math.min(1, range - 1), () => 1, (count, sides) => count * sides, []);

    assert.equal(attack.heroAttackSequence?.current?.damage, 6,
        'the test room is daytime even when New York is at midnight');
});

for (const [hour, damage] of [['00', 12], ['01', 6], ['12', 6]] as const) {
    void test(`a wraith's touch deals ${damage} damage at recorded hour ${hour}`, async context => {
        context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 1, 12) });
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        game.datetime = `20000110${hour}0000`;
        const wraith = await createMonsterAt('wraith', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        wraith.m_lev = 30;
        wraith.mux = game.u.ux;
        wraith.muy = game.u.uy;

        const attack = await beginMonsterHeroAttack(wraith, game,
            range => Math.min(1, range - 1), () => 1, (count, sides) => count * sides, []);

        assert.equal(attack.heroAttackSequence?.current?.damage, damage);
    });
}

for (const [currentMonth, datetime, damage] of [
    [6, '20020115000000', 6],
    [6, '20020115010000', 12],
    [0, '20020715230000', 12],
    [0, '20020715000000', 6],
] as const) {
    void test(`wraith damage at ${datetime} follows the recorder clock inherited in month ${currentMonth + 1}`, async context => {
        context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, currentMonth, 1, 12) });
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        game.datetime = datetime;
        const wraith = await createMonsterAt('wraith', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        wraith.m_lev = 30;
        wraith.mux = game.u.ux;
        wraith.muy = game.u.uy;

        const attack = await beginMonsterHeroAttack(wraith, game,
            range => Math.min(1, range - 1), () => 1, (count, sides) => count * sides, []);

        assert.equal(attack.heroAttackSequence?.current?.damage, damage,
            'the second damage roll applies only at midnight after local-time conversion');
    });
}

for (const [hour, stolen] of [['05', true], ['06', false], ['21', false], ['22', true]] as const) {
    void test(`a gremlin ${stolen ? 'steals' : 'leaves'} an intrinsic at recorded hour ${hour}`, async context => {
        context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 1, 12) });
        freshObjectRoom();
        requirePlayingGame(game);
        game.datetime = `20000110${hour}0000`;
        const gremlin = await createMonsterAt('gremlin', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        grantIntrinsicProperty('fireResistance', 'outside');
        grantIntrinsicProperty('poisonResistance', 'outside');
        initRng(2n);
        const messages: string[] = [];
        const attack = { kind: 'hero-attack', attackType: AT_CLAW, damageType: AD_CURS,
            hit: true, damage: 0 } as const;

        await resolveMonsterContactEffect(gremlin, attack, { state: game,
            publish: async message => { messages.push(message); }, random: () => 0 });

        assert.equal(hasPermanentIntrinsicProperty('fireResistance'), !stolen);
        assert.equal(hasPermanentIntrinsicProperty('poisonResistance'), true);
        assert.equal(!!((gremlin.mintrinsics ?? 0) & 0x01), stolen);
        assert.equal(messages.includes('The gremlin chuckles.'), stolen);
    });
}
