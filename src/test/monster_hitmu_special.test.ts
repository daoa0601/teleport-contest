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

for (const [hour, damage] of [['00', 12], ['01', 6], ['12', 6]] as const) {
    void test(`a wraith's touch deals ${damage} damage at recorded hour ${hour}`, async () => {
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


for (const [hour, stolen] of [['05', true], ['06', false], ['21', false], ['22', true]] as const) {
    void test(`a gremlin ${stolen ? 'steals' : 'leaves'} an intrinsic at recorded hour ${hour}`, async () => {
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
