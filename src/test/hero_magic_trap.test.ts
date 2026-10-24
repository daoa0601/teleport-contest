import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_CHA, MAGIC_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_REFLECTION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

for (const hero of [
    { form: 'yellow mold', female: false, oddly: true },
    { form: 'vampire', female: false, oddly: false },
    { form: 'vampire', female: true, oddly: true },
]) {
    void test(`a ${hero.female ? 'female' : 'male'} hero in ${hero.form} form feels ${hero.oddly ? 'oddly ' : ''}like the prodigal son`, async () => {
        const trap = magicTrapRoom();
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'The Quest' })];
        game._activeSpecialLevel = {
            prototype: 'Val-strt', file: 'Val-strt.lua',
        };
        game.specialLevels = new Map([['x-strt', createSpecialLevel({ dnum: game.u.uz?.dnum ?? 0, dlevel: game.u.uz?.dlevel ?? 1 })]]);
        game.flags.female = hero.female;
        installPolymorphedHero(hero.form);
        initRng(1n);

        await triggerHeroTrap(trap, { forceTrap: true });

        assert.equal(game._last_message,
            `You feel ${hero.oddly ? 'oddly ' : ''}like the prodigal son.`);
    });
}

function magicTrapRoom() {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return addTrap(game.level, MAGIC_TRAP, game.u.ux, game.u.uy);
}

void test('a magic-trap flash blinds and deafens the hero, summons monsters, and wakes nearby sleepers', async () => {
    const trap = magicTrapRoom();
    requirePlayingGame(game);
    const sleeper = await createMonsterAt('goblin', 12, 10);
    sleeper.msleeping = 1;
    const count = game.level.monsters.length;
    initRng(16n);

    await triggerHeroTrap(trap, { forceTrap: true });

    assert.ok((game.u.blindTurns ?? 0) >= 10 && (game.u.blindTurns ?? 0) <= 14);
    assert.ok((game.u.deafTurns ?? 0) >= 30 && (game.u.deafTurns ?? 0) <= 49);
    assert.ok(game.level.monsters.length > count && game.level.monsters.length <= count + 4);
    assert.equal(sleeper.msleeping, 0);
});

void test('a hero in Archon form sees a nearby sleeper wake after resisting a magic-trap flash', async () => {
    const trap = magicTrapRoom();
    const sleeper = await createMonsterAt('goblin', 12, 10);
    sleeper.msleeping = 1;
    installPolymorphedHero('Archon');
    initRng(16n);

    await triggerHeroTrap(trap, { forceTrap: true });

    assert.equal(game.u.blindTurns, 0);
    assert.ok((game.u.deafTurns ?? 0) >= 30 && (game.u.deafTurns ?? 0) <= 49);
    assert.equal(sleeper.msleeping, 0);
    assert.match(game._last_message, /The goblin wakes up\.$/);
});

void test('a deaf hero resists the flash and gains a shorter deafness extension', async () => {
    const trap = magicTrapRoom();
    game.u.blindResistance = true;
    game.u.deafTurns = 5;
    initRng(16n);

    await triggerHeroTrap(trap, { forceTrap: true });

    assert.equal(game.u.blindTurns, 0);
    assert.ok((game.u.deafTurns ?? 0) >= 20 && (game.u.deafTurns ?? 0) <= 24);
});

void test('a benevolent magic trap increases charisma and tames adjacent monsters', async () => {
    const trap = magicTrapRoom();
    const goblin = await createMonsterAt('goblin', 11, 10);
    const charisma = game.u.acurr?.a[A_CHA];
    assert.ok(charisma !== undefined);
    initRng(60n);

    await triggerHeroTrap(trap, { forceTrap: true });

    assert.equal(game.u.acurr?.a[A_CHA], charisma + 1);
    assert.ok(goblin.mtame);
});

for (const outcome of [
    {
        description: 'stays quiet at maximum charisma with verbose mode off',
        charisma: 18, verbose: false, resultingCharisma: 18, message: '',
    },
    {
        description: 'reports maximum charisma with verbose mode on',
        charisma: 18, verbose: true, resultingCharisma: 18,
        message: "You're already as charismatic as you can get.",
    },
    {
        description: 'reports a charisma gain with verbose mode off',
        charisma: 12, verbose: false, resultingCharisma: 13, message: 'You feel charismatic!',
    },
]) {
    void test(`a benevolent magic trap ${outcome.description}`, async () => {
        const trap = magicTrapRoom();
        requirePlayingGame(game);
        game.u.acurr.a[A_CHA] = outcome.charisma;
        game.u.amax.a[A_CHA] = outcome.charisma;
        game.flags.verbose = outcome.verbose;
        initRng(60n);

        await triggerHeroTrap(trap, { forceTrap: true });

        assert.equal(game.u.acurr.a[A_CHA], outcome.resultingCharisma);
        assert.equal(game._last_message, outcome.message);
    });
}

void test('magic-trap cleansing uncurses worn gear and preserves the confusion timeout', async () => {
    const trap = magicTrapRoom();
    const amulet = await addInventoryObject(AMULET_OF_REFLECTION, { cursed: true });
    await wearHeroAccessory(amulet, 'uamul');
    game.u.confusionTurns = 12;
    initRng(10n);

    await triggerHeroTrap(trap, { forceTrap: true });

    assert.equal(amulet.cursed, false);
    assert.equal(game.u.confusionTurns, 12);
});

// C trap.c domagictrap() announces new invisibility with potion.c
// self_invis_message(), whose opening follows hallucination.
void test('a hallucinating hero hears a low hum and sees a far-out invisibility message', async () => {
    let heardHum = false;
    for (let seed = 1n; seed <= 200n && !heardHum; seed++) {
        const trap = magicTrapRoom();
        requirePlayingGame(game);
        game.u.hallucinationTurns = 100;
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => {
            messages.push(game._last_message ?? '');
            input.feed(' ');
        };
        initRng(seed);

        await triggerHeroTrap(trap, { forceTrap: true });

        messages.push(game._last_message ?? '');
        if (!messages.some(message => message.includes('a low hum'))) continue;
        heardHum = true;
        assert.equal(game.u.invisible, true);
        assert.ok(messages.some(message => message.includes("Far out, man!  You can't see yourself.")),
            messages.join(' | '));
    }
    assert.equal(heardHum, true, 'some seed must reach the invisibility outcome');
});
