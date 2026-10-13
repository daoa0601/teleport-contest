import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_PROTECTION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const resistant of [false, true]) {
    void test(`an ice troll's cold claw ${resistant ? 'cannot chill a cold-resistant hero' : 'damages and chills the hero'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10, coldResistance: resistant } });
        requirePlayingGame(game);
        const troll = await createMonsterAt('ice troll', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        troll.mux = game.u.ux;
        troll.muy = game.u.uy;
        const input = resetInputState();
        const messages: string[] = [];
        installPagerInput(input, { expected: /ice troll|frost/, limit: 8 });
        input.beforeRead = () => { messages.push(game._pending_message); };

        await performMonsterHeroAttack(troll, game, {
            random: limit => limit - 1, rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();

        assert.equal(game.u.uhp, resistant ? 96 : 94,
            'the weapon and bite hurt; only cold resistance prevents the claw damage');
        assert.match(messages.join('\n'), /You're covered in frost!/);
        if (resistant) assert.match(messages.join('\n'), /The frost doesn't seem cold!/);
    });
}

for (const removeCloak of [false, true]) {
    void test(`a protection cloak ${removeCloak ? 'stops cancelling cold when removed, before AC updates' : 'cancels a cold claw while worn'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        const cloak = await addInventoryObject(CLOAK_OF_PROTECTION);
        wearHeroArmor(cloak);
        findArmorClass();
        if (removeCloak) await rhack('T'.charCodeAt(0));
        assert.equal(game.u.uac, 7, 'armor class still belongs to the preceding hero turn');
        const troll = await createMonsterAt('ice troll', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        troll.mux = game.u.ux;
        troll.muy = game.u.uy;
        const input = resetInputState();
        const messages: string[] = [];
        installPagerInput(input, { expected: /ice troll|frost|avoid harm|cloak/, limit: 10 });
        input.beforeRead = () => { messages.push(game._pending_message); };

        await performMonsterHeroAttack(troll, game, {
            random: limit => limit === 10 ? 0 : limit - 1,
            rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();

        assert.equal(game.u.uhp, removeCloak ? 94 : 96,
            'only currently worn protection can prevent the cold claw damage');
        if (removeCloak) assert.match(messages.join('\n'), /You're covered in frost!/);
        else assert.match(messages.join('\n'), /You avoid harm\./);
    });
}
