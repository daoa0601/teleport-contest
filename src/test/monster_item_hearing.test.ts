import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { prepareMonsterItemUse, presentMonsterQuaff } from '../js/monster_item_use.js';
import { BUGLE, POT_HEALING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { condition, expected } of [
    { condition: 'awake', expected: 'You hear a chugging sound.' },
    { condition: 'acoustics disabled', expected: undefined },
    { condition: 'underwater', expected: 'You barely hear a chugging sound.' },
    { condition: 'asleep', expected: 'You dream that you hear a chugging sound.' },
    { condition: 'deaf and asleep', expected: undefined },
]) {
    void test(`unseen potion drinking respects a hero who is ${condition}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const drinker = await createMonsterAt('orc', 11, 10, NO_MINVENT);
        drinker.minvis = true;
        const potion = await knownObject(POT_HEALING);
        if (condition === 'acoustics disabled') game.flags.acoustics = false;
        if (condition === 'underwater') game.underwater = true;
        if (condition.includes('asleep')) await putHeroToSleep(10, { state: game });
        if (condition.includes('deaf')) game.u.deafTurns = 10;
        const messages: string[] = [];

        const seen = await presentMonsterQuaff(drinker, potion, {
            state: game, publish: message => { messages.push(message); },
        });

        assert.equal(seen, false);
        assert.equal(messages[0], expected);
        assert.equal(messages.length, expected === undefined ? 0 : 1);
    });
}

for (const freed of [true, false]) {
    void test(`a bottle djinni speaks to a deaf hero before ${freed ? 'staying peacefully' : 'vanishing'}`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10, hero: { deafTurns: 10 } });
        requirePlayingGame(game);
        const drinker = await createMonsterAt('orc', 10, 10, NO_MINVENT);
        const potion = await addObjectToMonsterInventory(drinker, await knownObject(POT_HEALING), game);
        assert.ok(potion);
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[POT_HEALING] = 'smoky';
        const messages: string[] = [];

        await prepareMonsterItemUse(drinker, potion, {
            state: game, random: limit => limit === 2 && freed ? 1 : 0,
            publish: message => { messages.push(message); },
        });

        assert.ok(messages.includes(freed ? '"You freed me!"' : '"It is about time."'), messages.join('\n'));
        assert.equal(potion.where, 'gone');
        const djinni = level.monsters.find(monster => monster.mnum === 315);
        if (freed) {
            assert.ok(djinni);
            assert.equal(djinni.mpeaceful, 1);
        } else {
            assert.equal(djinni, undefined);
            assert.ok(messages.some(message => message.endsWith(' vanishes.')));
        }
    });
}

for (const { condition, expected } of [
    { condition: 'awake', expected: 'You hear a bugle playing reveille!' },
    { condition: 'acoustics disabled', expected: undefined },
    { condition: 'underwater', expected: 'You barely hear a bugle playing reveille!' },
    { condition: 'asleep', expected: 'You dream that you hear a bugle playing reveille!' },
    { condition: 'deaf', expected: undefined },
    { condition: 'deaf and asleep', expected: undefined },
]) {
    void test(`unseen bugle feedback respects a hero who is ${condition} and still wakes soldiers`, async () => {
        freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const bugler = await createMonsterAt('soldier', 10, 10, NO_MINVENT | MM_NOGRP);
        bugler.minvis = true;
        const sleeper = await createMonsterAt('soldier', 9, 10, NO_MINVENT | MM_NOGRP);
        sleeper.minvis = true;
        sleeper.msleeping = 1;
        const bugle = await addObjectToMonsterInventory(bugler, await knownObject(BUGLE), game);
        assert.ok(bugle);
        if (condition === 'acoustics disabled') game.flags.acoustics = false;
        if (condition === 'underwater') game.underwater = true;
        if (condition.includes('asleep')) await putHeroToSleep(10, { state: game });
        if (condition.includes('deaf')) game.u.deafTurns = 10;
        assert.equal(canSeeMonster(bugler), false);
        const messages: string[] = [];

        await useMonsterDefensiveItem(bugler, { kind: 'bugle', object: bugle }, {
            state: game, publish: message => { messages.push(message); },
        });

        assert.equal(messages[0], expected);
        assert.equal(messages.length, expected === undefined ? 0 : 1);
        assert.equal(sleeper.msleeping, 0);
        assert.equal(sleeper.mcanmove, 1);
    });
}
