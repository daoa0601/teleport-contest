import assert from 'node:assert/strict';
import test from 'node:test';
import { placeObject } from '../js/floor_object.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { mksobj } from '../js/mklev.js';
import { AD_SGLD, AT_CLAW } from '../js/monster_attack_types.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { resetInputState } from '../js/input.js';
import type { HeroContactAttack } from '../js/monster_action_types.js';

// C steal.c:stealgold() prefers the larger floor pile without rolling, and
// only flees when the purse is gone or the second one-in-five roll allows.
void test('a leprechaun snatching floor gold over a smaller purse stays for more', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    setHeroGoldAmount(game, 20);
    const floor = await mksobj(GOLD_PIECE, true, false);
    floor.quan = 100;
    await placeObject(floor, game.u.ux, game.u.uy, game);
    const leprechaun = await createMonsterAt('leprechaun', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_CLAW,
        damageType: AD_SGLD, hit: true, damage: 2 };
    const messages: string[] = [];
    installPagerInput(resetInputState(), { expected: /leprechaun|snatches/, limit: 4 });

    await resolveMonsterContactEffect(leprechaun, attack, { state: game,
        publish: async message => { messages.push(message); }, random: () => 4 });

    assert.equal(leprechaun.minvent.find(object => object.otyp === GOLD_PIECE)?.quan, 100,
        'the larger floor pile wins without a random roll');
    assert.ok(!messages.includes('Your purse feels lighter.'), 'the purse keeps its coins');
    assert.match(messages.join('\n'), /The leprechaun quickly snatches some gold from between your feet!/);
    assert.equal(leprechaun.mx, 11, 'a failed one-in-five roll leaves the thief in place');
    assert.equal(leprechaun.my, 10);
    assert.ok(!leprechaun.mflee, 'the leprechaun has not been sent fleeing');
    assert.equal(floor.where, 'minvent');
});

// C steal.c:stealgold() skips both rolls when the hero carries no purse, so
// the thief always teleports away and flees after picking up floor gold.
void test('a leprechaun snatching floor gold from a penniless hero flees', async () => {
    freshObjectRoom({ hero: { levitating: true } });
    requirePlayingGame(game);
    const floor = await mksobj(GOLD_PIECE, true, false);
    floor.quan = 100;
    await placeObject(floor, game.u.ux, game.u.uy, game);
    const leprechaun = await createMonsterAt('leprechaun', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_CLAW,
        damageType: AD_SGLD, hit: true, damage: 2 };
    const messages: string[] = [];
    installPagerInput(resetInputState(), { expected: /leprechaun|snatches|spot/, limit: 6 });

    await resolveMonsterContactEffect(leprechaun, attack, { state: game,
        publish: async message => { messages.push(message); }, random: () => 4 });

    assert.equal(leprechaun.minvent.find(object => object.otyp === GOLD_PIECE)?.quan, 100);
    assert.match(messages.join('\n'),
        /The leprechaun quickly snatches some gold from beneath your feet!/);
    const moved = leprechaun.mx !== 11 || leprechaun.my !== 10;
    assert.ok(moved || leprechaun.mflee,
        'a penniless hero always sends the leprechaun teleporting or fleeing');
});
