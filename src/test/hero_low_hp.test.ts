import test from 'node:test';
import assert from 'node:assert/strict';
import { races } from '../js/roles.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { setPropertyTimeout } from '../js/properties.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { installPolymorphedHero } from './support/hero-state.js';

void test('a Wizard gets low health warnings at most once every fifty turns', async () => {
    freshGameplayRoom({ role: 'wizard', hero: { uhp: 10, uhpmax: 100 } });
    requirePlayingGame(game);
    const messages: string[] = [];
    const publish = (message: string) => { messages.push(message); };
    game.moves = 50;
    await loseHeroHp(1, 'injury', { publish });
    assert.equal(messages.length, 0);
    game.moves = 51;
    await loseHeroHp(1, 'injury', { publish });
    assert.equal(messages.pop(), 'Wizard, your life force is running out.');
    game.moves = 101;
    await loseHeroHp(1, 'injury', { publish });
    assert.equal(messages.length, 0);
    game.moves = 102;
    await loseHeroHp(6, 'injury', { publish });
    assert.equal(messages.pop(), 'Wizard is about to die.');
});

void test('permanent intrinsic powers change the warning, timed powers do not', async () => {
    freshGameplayRoom({ role: 'valkyrie', hero: { uhp: 5, uhpmax: 100 } });
    requirePlayingGame(game);
    const powers = ['teleportation', 'seeInvisible', 'poisonResistance', 'coldResistance'] as const;
    for (const power of powers) setPropertyTimeout(power, 100);
    const messages: string[] = [];
    const publish = (message: string) => { messages.push(message); };
    game.moves = 51;
    await loseHeroHp(1, 'injury', { publish });
    assert.equal(messages.pop(), 'Valkyrie, your life force is running out.');
    for (const power of powers) grantIntrinsicProperty(power, 'outside');
    game.moves = 102;
    await loseHeroHp(1, 'injury', { publish });
    assert.equal(messages.pop(), 'Valkyrie, all your powers will be lost...');
});

void test('other roles hear a warning unless deaf', async () => {
    freshGameplayRoom({ role: 'tourist', hero: { uhp: 5, uhpmax: 100 } });
    requirePlayingGame(game);
    game.moves = 51;
    const messages: string[] = [];
    const publish = (message: string) => { messages.push(message); };
    await loseHeroHp(1, 'injury', { publish });
    assert.equal(messages.pop(), 'You hear the howling of the CwnAnnwn...');
    game.u.deafTurns = 10;
    game.moves = 102;
    await loseHeroHp(1, 'injury', { publish });
    assert.equal(messages.length, 0);
});

void test('an unchanging polymorphed Wizard warns when monster health is low', async () => {
    freshGameplayRoom({ role: 'wizard' });
    requirePlayingGame(game);
    installPolymorphedHero('stone golem', { hitPoints: 10, maxHitPoints: 100, unchanging: true });
    game.moves = 51;
    const messages: string[] = [];
    await loseHeroHp(1, 'injury', { publish: message => { messages.push(message); } });
    assert.equal(messages.pop(), 'Wizard, your life force is running out.');
    assert.equal(game.u.mh, 9);
});


void test('an Elf uses the racial warning outside the Wizard and Valkyrie roles', async () => {
    const elf = races.find(race => race.name === 'elf');
    assert.ok(elf);
    freshGameplayRoom({ role: 'ranger', race: elf, hero: { uhp: 2, uhpmax: 100 } });
    requirePlayingGame(game);
    game.moves = 51;
    const messages: string[] = [];

    await loseHeroHp(1, 'injury', { publish: message => { messages.push(message); } });

    assert.equal(messages.pop(), 'Elf is about to die.');
});
