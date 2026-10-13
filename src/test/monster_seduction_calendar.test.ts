import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_SSEX, AT_BITE } from '../js/monster_attack_types.js';
import type { HeroContactAttack } from '../js/monster_action_types.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import { GAUNTLETS_OF_POWER, LEATHER_ARMOR } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const datetime of ['20000229000000', '20000301000000']) {
    void test(`a succubus uses the normalized local date for the glove demand at ${datetime}`, async context => {
        context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 6, 1, 12) });
        const level = freshObjectRoom({ flags: { female: false }, hero: { blindTurns: 20 } });
        requirePlayingGame(game);
        level.flags.noteleport = true;
        game.datetime = datetime;
        const gloves = await addInventoryObject(GAUNTLETS_OF_POWER, {
            observed: false, dknown: false, bknown: false, typeKnown: false,
        });
        const suit = await addInventoryObject(LEATHER_ARMOR);
        wearHeroArmor(suit);
        const succubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        succubus.female = true;
        const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_BITE,
            damageType: AD_SSEX, hit: true, damage: 0 };
        const messages: string[] = [];
        const input = resetInputState();

        await answerPrompts(resolveMonsterContactEffect(succubus, attack, { state: game,
            publish: async message => { messages.push(message); }, random: () => 0 }), input, [
            { prompt: /Shall I remove your suit, lover/, keys: 'n' },
        ]);

        // Inherited daylight saving time moves February/March midnight
        // back to 23:00 on the preceding local date.
        const leapDay = datetime === '20000301000000';
        assert.equal(gloves.dknown, leapDay);
        assert.equal(messages.some(message => /eleven more pairs of gloves/.test(message)), leapDay);
        assert.equal(messages.some(message => /You're such a nice guy; I wish/.test(message)), !leapDay);
    });
}

