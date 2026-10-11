import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_CON } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { hitHeroWithThrownPotion } from '../js/hero_potion_hit.js';
import { resetInputState } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING, POT_ACID, POT_BLINDNESS, POT_CONFUSION,
    POT_FRUIT_JUICE, POT_PARALYSIS, POT_POLYMORPH, POT_SLEEPING,
} from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a monster-thrown inert potion damages the actual hero and consumes its free object', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const potion = await knownObject(POT_FRUIT_JUICE);
    const hp = game.u.uhp;
    const messages: string[] = [];

    const result = await hitHeroWithThrownPotion(potion, {
        random: () => 0, rollOne: sides => sides,
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.heroDied, false);
    assert.equal(game.u.uhp, hp - 2);
    assert.equal(potion.where, 'gone');
    assert.deepEqual(messages, [
        'The bottle crashes on your head and breaks into shards.',
        'The potion of fruit juice evaporates.',
    ]);
});

for (const [label, blessed, cursed, totalDamage] of [
    ['blessed', true, false, 3], ['uncursed', false, false, 5], ['cursed', false, true, 9],
] as const) {
    void test(`half physical damage reduces both the bottle and ${label} acid damage`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        grantIntrinsicProperty('halfPhysicalDamage', 'outside');
        const potion = await knownObject(POT_ACID, { blessed, cursed });
        const hp = game.u.uhp;
        const messages: string[] = [];

        await hitHeroWithThrownPotion(potion, {
            random: () => 0, rollOne: sides => sides, rollDice: (count, sides) => count * sides,
            publish: async message => { messages.push(message); },
        });

        assert.equal(game.u.uhp, hp - totalDamage);
        assert.equal(potion.where, 'gone');
        assert.ok(messages.includes(`This burns${blessed ? ' a little' : cursed ? ' a lot' : ''}!`));
        assert.equal(game.u._exercise?.[A_CON], -1);
    });
}

void test('acid resistance stops acid damage but leaves the bottle impact', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('acidResistance', 'outside');
    const potion = await knownObject(POT_ACID, { cursed: true });
    const hp = game.u.uhp;
    const messages: string[] = [];

    await hitHeroWithThrownPotion(potion, {
        rollOne: sides => sides, publish: async message => { messages.push(message); },
    });

    assert.equal(game.u.uhp, hp - 2);
    assert.equal(messages.some(message => message.startsWith('This burns')), false);
    assert.equal(potion.where, 'gone');
});

for (const [label, type] of [
    ['paralysis', POT_PARALYSIS], ['sleeping', POT_SLEEPING],
    ['blindness', POT_BLINDNESS], ['confusion', POT_CONFUSION],
] as const) {
    void test(`a direct ${label} potion impact applies its real vapor effect`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const potion = await knownObject(type);
        const hp = game.u.uhp;

        await hitHeroWithThrownPotion(potion, { rollOne: () => 1, publish: async () => {} });

        assert.equal(game.u.uhp, hp - 1);
        assert.equal(potion.where, 'gone');
        const duration = type === POT_BLINDNESS ? game.u.blindTurns
            : type === POT_CONFUSION ? game.u.confusionTurns : game._helplessTurns;
        assert.ok(duration !== undefined && duration >= 1 && duration <= 5);
    });
}

void test('an eyeless breathless form takes bottle damage but receives no confusion vapor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('energy vortex', { hitPoints: 30 });
    const potion = await knownObject(POT_CONFUSION);
    const humanHp = game.u.uhp;

    await hitHeroWithThrownPotion(potion, { rollOne: sides => sides, publish: async () => {} });

    assert.equal(game.u.mh, 28);
    assert.equal(game.u.uhp, humanHp);
    assert.equal(game.u.confusionTurns ?? 0, 0);
    assert.equal(potion.where, 'gone');
});

void test('antimagic blocks direct potion polymorph without shielding the glass impact', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('antimagic', 'outside');
    const form = game.u.umonnum;
    const hp = game.u.uhp;
    const potion = await knownObject(POT_POLYMORPH);
    const messages: string[] = [];

    await hitHeroWithThrownPotion(potion, {
        rollOne: sides => sides, publish: async message => { messages.push(message); },
    });

    assert.equal(game.u.umonnum, form);
    assert.equal(game.u.uhp, hp - 2);
    assert.ok(messages.includes('You feel a little strange.'));
    assert.equal(potion.where, 'gone');
});

void test('an unknown potion waits for its actual call-name input before it is freed', async () => {
    freshObjectRoom();
    const potion = await knownObject(POT_FRUIT_JUICE, { typeKnown: false, dknown: true });
    const input = resetInputState();
    const impact = hitHeroWithThrownPotion(potion, { rollOne: () => 1, publish: async () => {} });
    await input.waitUntilBlocked();
    assert.equal(potion.where, 'free');
    await answerPrompts(impact, input, [{ prompt: /Call an? .+ potion:/, keys: 'splash\n' }]);

    assert.equal(game._objectCallNames?.[POT_FRUIT_JUICE], 'splash');
    assert.equal(potion.where, 'gone');
});

void test('impact and evaporation use the real message pager', async () => {
    freshObjectRoom();
    const potion = await knownObject(POT_FRUIT_JUICE);
    const input = resetInputState();

    await answerPrompts(hitHeroWithThrownPotion(potion, { random: () => 0, rollOne: () => 1 }), input, [
        { prompt: /The bottle crashes on your head and breaks into shards\.[\s\S]*--More--/, keys: ' ' },
    ]);
    await flush_screen();

    const row = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.equal(row, 'The potion of fruit juice evaporates.');
    assert.equal(potion.where, 'gone');
});

for (const [hp, killer] of [[1, 'thrown potion'], [3, 'potion of acid']] as const) {
    void test(`fatal potion impact is attributed to ${killer}`, async () => {
        freshObjectRoom({ hero: { uhp: hp, uhpmax: 40 }, flags: { disclose: '-i -a -v -c -o' } });
        game.storage = memoryStorage();
        const potion = await knownObject(POT_ACID);
        const input = resetInputState();
        installPagerInput(input, {
            expected: /bottle|potion|burns|You die|REST|PEACE|points/, limit: 12,
        });

        const result = await hitHeroWithThrownPotion(potion, {
            random: () => 0, rollOne: sides => sides, rollDice: (count, sides) => count * sides,
        });

        assert.equal(result.heroDied, true);
        assert.equal(game.program_state.gameover, true);
        assert.equal(game._deathKiller, killer);
        assert.equal(potion.where, 'gone');
    });
}

void test('life saving permits a potion vapor effect after lethal bottle damage', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 40 }, flags: { disclose: '-i -a -v -c -o' } });
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const potion = await knownObject(POT_CONFUSION);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /bottle|potion|You die|But wait|medallion|much better|amulet of life saving|dizzy/, limit: 12,
    });

    const result = await hitHeroWithThrownPotion(potion, { random: () => 0, rollOne: sides => sides });

    assert.equal(result.heroDied, false);
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(amulet.where, 'gone');
    assert.ok((game.u.confusionTurns ?? 0) > 0);
    assert.equal(potion.where, 'gone');
});
