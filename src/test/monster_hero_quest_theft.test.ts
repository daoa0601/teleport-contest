import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { AMULET_OF_YENDOR, RING_MAIL } from '../js/object_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const worn of [false, true]) {
    void test(`Scorpius steals a ${worn ? 'cursed worn' : 'carried'} quest artifact before the Amulet and still hurts the hero`, async () => {
        freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: 10, sicknessResistance: true } });
        requirePlayingGame(game);
        const amulet = await addInventoryObject(AMULET_OF_YENDOR);
        const mitre = await addInventoryItem(await artifactObject('The Mitre of Holiness', { cursed: worn }));
        if (worn) wearHeroArmor(mitre);
        const scorpion = await createMonsterAt('Scorpius', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        scorpion.mux = game.u.ux;
        scorpion.muy = game.u.uy;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Scorpius|Mitre|illness/, limit: 15 });

        await performMonsterHeroAttack(scorpion, game, {
            random: range => range === 20 ? 0 : range - 1,
            rollOne: () => 1, rollDice: count => count,
        });

        assert.equal(game.inventory.includes(mitre), false);
        assert.ok(scorpion.minvent.includes(mitre));
        assert.equal(mitre.owornmask ?? 0, 0);
        assert.notEqual(game.uarmh, mitre);
        assert.ok(game.inventory.includes(amulet), 'Quest artifacts have priority over the Amulet');
        assert.equal(game.u.uhp, 496, 'Both claws hurt, including the successful theft claw');
        const prose = [...messages, game._pending_message].join('\n');
        assert.match(prose, /Scorpius steals .*Mitre of Holiness/);
        if (worn) assert.match(prose, /Scorpius takes off your/);
    });
}

for (const removing of [false, true]) {
    void test(`stealing the worn Mitre leaves unrelated armor ${removing ? 'removal' : 'dressing'} in progress`, async () => {
        freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: 10, sicknessResistance: true } });
        requirePlayingGame(game);
        const mitre = await addInventoryItem(await artifactObject('The Mitre of Holiness'));
        wearHeroArmor(mitre);
        const armor = await addInventoryObject(RING_MAIL);
        if (removing) wearHeroArmor(armor);
        assert.ok(armor.invlet);
        resetInputState().feed(armor.invlet);
        await rhack((removing ? 'T' : 'W').charCodeAt(0));
        const scorpion = await createMonsterAt('Scorpius', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        scorpion.mux = game.u.ux;
        scorpion.muy = game.u.uy;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Scorpius|Mitre|illness|ring mail/, limit: 15 });

        await performMonsterHeroAttack(scorpion, game, {
            random: range => range === 20 ? 0 : range - 1,
            rollOne: () => 1, rollDice: count => count,
        });

        assert.ok(scorpion.minvent.includes(mitre));
        assert.equal(game.uarm, armor, 'Only the stolen armor is removed');
        assert.match(inventoryItemDescription(armor), removing ? /\(being doffed\)$/ : /\(being donned\)$/);
        assert.doesNotMatch([...messages, game._pending_message].join('\n'), /You stop (?:putting on|taking off)/);
    });
}
