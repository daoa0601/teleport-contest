import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGoldAmount, heroGoldAmount } from '../js/hero_gold.js';
import { AD_SGLD, AT_CLAW } from '../js/monster_attack_types.js';
import type { HeroContactAttack } from '../js/monster_action_types.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { resetInputState } from '../js/input.js';

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
});
