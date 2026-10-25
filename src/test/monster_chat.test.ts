import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { BEAR_TRAP } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initializePet } from '../js/dog.js';
import { knownObject } from './support/game-objects.js';
import { HELMET, SPE_NOVEL } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { initRng } from '../js/rng.js';
import type { MonsterFlag } from '../js/monster_types.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [species, peaceful, message] of [
    ['leocrotta', false, 'The leocrotta imitates you.'],
    ['red naga hatchling', false, 'The red naga hatchling mumbles incomprehensibly.'],
    ['djinni', false, '"This will teach you not to disturb me!"'],
    ['prisoner', false, '"Get me out of here."'],
    ['water demon', true, 'The water demon gurgles.'],
    ['dwarf', true, 'The dwarf talks about mining.'],
    ['dwarf', false, 'The dwarf threatens you.'],
    ['nurse', true, '"Relax, this won\'t hurt a bit."'],
    ['nalfeshnee', false, 'The nalfeshnee seems to mutter a cantrip.'],
    ['Pestilence', false, '"Who do you think you are, War?"'],
] as const) {
    void test(`chat gets the native response from a ${peaceful ? 'peaceful' : 'hostile'} ${species}`, async () => {
        freshObjectRoom();
        const monster = await createMonsterAt(species, 11, 10);
        monster.mpeaceful = peaceful;
        monster.msleeping = 0;

        await runExtendedCommand('chat', 'l');

        assert.equal(game._pending_message, message);
        assert.equal(game.context.move, 1);
    });
}

void test('a trapped humanoid tells the hero where its trap is', async () => {
    const level = freshObjectRoom();
    const dwarf = await createMonsterAt('dwarf', 11, 10);
    dwarf.mpeaceful = 1;
    dwarf.mtrapped = 1;
    const trap = addTrap(level, BEAR_TRAP, 11, 10, { tseen: false });

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '"I\'m trapped!"');
    assert.equal(trap.tseen, true);
    assert.equal(game.context.move, 1);
});

void test('a hungry tame humanoid asks for food before discussing its interests', async () => {
    freshObjectRoom();
    const dwarf = await createMonsterAt('dwarf', 11, 10);
    initializePet(dwarf, { state: game });
    assert.ok(dwarf.edog);
    dwarf.edog.hungrytime = game.moves - 1;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '"I\'m hungry."');
});

void test('a shrieker wakes sleeping monsters elsewhere on the level', async () => {
    freshObjectRoom({ right: 28 });
    await createMonsterAt('shrieker', 11, 10);
    const sleeper = await createMonsterAt('goblin', 26, 10);
    sleeper.msleeping = 1;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, 'The shrieker shrieks.');
    assert.equal(sleeper.msleeping, 0);
    assert.equal(game.context.move, 1);
});

void test('a skeleton frightens the hero into two turns of immobility', async () => {
    freshObjectRoom();
    await createMonsterAt('skeleton', 11, 10);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    await runExtendedCommand('chat', 'l');
    await flush_screen();

    assert.equal(game._helplessTurns, 2);
    assert.equal(game._helplessReason, 'scared by rattling');
    assert.equal(game.context.move, 1);
});

void test('a zombie can stay quiet while chat still spends a turn', async () => {
    freshObjectRoom();
    await createMonsterAt('human zombie', 11, 10);
    initRng(2);

    await runExtendedCommand('chat', 'l');

    assert.equal(game.context.move, 1);
});

void test('a peaceful vampire responds with its potion claim', async () => {
    freshObjectRoom({ hero: { protectionFromShapeChangers: true } });
    const vampire = await createMonsterAt('vampire', 11, 10);
    vampire.mpeaceful = 1;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '"I only drink... potions."');
    assert.equal(game.context.move, 1);
});

void test('skeleton chat holds input while two world turns pass, then restores movement', async () => {
    const level = freshObjectRoom();
    level.flags.rndmongen = false;
    const skeleton = await createMonsterAt('skeleton', 11, 10);
    skeleton.mpeaceful = 1;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    input.feed('#chat\nl          .');
    const initialMoves = game.moves;

    await moveloop_core();
    assert.equal(game._helplessTurns, 2);
    await moveloop_core();
    assert.equal(game._helplessTurns, 1);
    await moveloop_core();

    assert.equal(game.moves, initialMoves + 2);
    assert.equal(game._helplessTurns, 0);
    assert.equal(game.multi, 0);
});

void test('chat with a cancelled incubus complains about a severe headache', async () => {
    freshObjectRoom({ flags: { female: true } });
    const incubus = await createMonsterAt('amorous demon', 11, 10);
    incubus.female = false;
    incubus.mcan = 1;
    incubus.msleeping = 0;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, 'The incubus acts as though he has got a severe headache.');
    assert.equal(game.context.move, 1);
});

interface ChatOverrides {
    mpeaceful?: MonsterFlag;
    mtame?: number;
    female?: boolean;
    mhp?: number;
    mhpmax?: number;
    mcan?: MonsterFlag;
}

async function chatSetup(species: number | string, {
    hero, seed, monster: overrides = {}, clock,
}: {
    hero?: object; seed?: number; monster?: ChatOverrides;
    clock?: () => void;
} = {}) {
    freshObjectRoom(hero ? { hero } : undefined);
    if (clock) clock();
    if (seed !== undefined) initRng(seed);
    const monster = await createMonsterAt(species, 11, 10);
    monster.msleeping = 0;
    if (overrides.mpeaceful !== undefined) monster.mpeaceful = overrides.mpeaceful;
    if (overrides.mtame !== undefined) monster.mtame = overrides.mtame;
    if (overrides.female !== undefined) monster.female = overrides.female;
    if (overrides.mhp !== undefined) monster.mhp = overrides.mhp;
    if (overrides.mhpmax !== undefined) monster.mhpmax = overrides.mhpmax;
    if (overrides.mcan !== undefined) monster.mcan = overrides.mcan;
    await runExtendedCommand('chat', 'l');
    return monster;
}
void test('a full moon night werewolf howls at the hero', async () => {
    await chatSetup(263, {
        seed: 0, monster: { mpeaceful: 1 },
        clock: () => { game.flags.moonphase = 4; game.datetime = '20020115230000'; },
    });

    assert.equal(game._pending_message, 'The werewolf throws back her head and lets out a blood curdling howl!');
    assert.equal(game.context.move, 1);
    game.datetime = null;
    game.flags.moonphase = 0;
});

void test('a full moon night wererat lets out a shriek instead of a howl', async () => {
    await chatSetup(261, {
        seed: 0, monster: { mpeaceful: 1 },
        clock: () => { game.flags.moonphase = 4; game.datetime = '20020115230000'; },
    });

    assert.equal(game._pending_message, 'The wererat throws back her head and lets out a blood curdling shriek!');
    game.datetime = null;
    game.flags.moonphase = 0;
});

void test('a werewolf under a new moon only whispers about the moon', async () => {
    await chatSetup(263, {
        seed: 1, monster: { mpeaceful: 1 },
        clock: () => { game.flags.moonphase = 1; game.datetime = '20020115230000'; },
    });

    assert.equal(game._pending_message, 'The werewolf whispers inaudibly.  All you can make out is "moon".');
    game.datetime = null;
    game.flags.moonphase = 0;
});

void test('a tame vampire wearies during the day', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 6, 1, 12) });
    await chatSetup('vampire', {
        hero: { protectionFromShapeChangers: true },
        monster: { mtame: 5, mpeaceful: 1 },
        clock: () => { game.datetime = '20020115120000'; },
    });

    assert.equal(game._pending_message, '"I find myself growing a little weary."');
    game.datetime = null;
});

void test('a tame vampire begs at night', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 6, 1, 12) });
    await chatSetup('vampire', {
        hero: { protectionFromShapeChangers: true },
        monster: { mtame: 5, mpeaceful: 1 },
        clock: () => { game.datetime = '20020115230000'; },
    });

    assert.equal(game._pending_message, '"I beg you, help me satisfy this growing craving!"');
    game.datetime = null;
});

void test('a tame vampire cracks at midnight', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 6, 1, 12) });
    await chatSetup('vampire', {
        hero: { protectionFromShapeChangers: true },
        monster: { mtame: 5, mpeaceful: 1 },
        clock: () => { game.datetime = '20020116010000'; },
    });

    assert.equal(game._pending_message, '"I can stand this craving no longer!"');
    game.datetime = null;
});

void test('a hostile vampire threatens to come after a man', async () => {
    await chatSetup('vampire', {
        hero: { protectionFromShapeChangers: true }, seed: 0, monster: { mpeaceful: 0 },
    });

    assert.equal(game._pending_message, '"I vill come after a man without regret!"');
});

void test('a hostile vampire wants to suck blood', async () => {
    await chatSetup('vampire', {
        hero: { protectionFromShapeChangers: true }, seed: 1, monster: { mpeaceful: 0 },
    });

    assert.equal(game._pending_message, '"I vant to suck your blood!"');
});

void test('a vampire lord sneers at a silver dragon hero', async () => {
    await chatSetup('vampire', {
        hero: { protectionFromShapeChangers: true }, monster: { mpeaceful: 0 },
        clock: () => {
            game.u.umonnum = 145; // silver dragon
        },
    });

    assert.equal(game._pending_message, '"Fool!  Your silver sheen does not frighten me!"');
});

for (const [message, seed] of [
    ['The giant boasts about his gem collection.', 3],
    ['The giant complains about a diet of mutton.', 1],
    ['The giant shouts "Fee Fie Foe Foo!" and guffaws.', 0],
] as const) {
    void test(`a hostile giant ${message.slice(10, 40)}`, async () => {
        await chatSetup('giant', { seed, monster: { mpeaceful: 0, female: false } });

        assert.equal(game._pending_message, message);
        assert.equal(game.context.move, 1);
    });
}

void test('a peaceful Kop just wants the facts', async () => {
    await chatSetup('Keystone Kop', { monster: { mpeaceful: 1 } });

    assert.equal(game._pending_message, '"Just the facts, Sir."');
});

for (const [message, seed] of [
    ['"Anything you say can be used against you."', 0],
    ['"Stop in the name of the Law!"', 2],
    ['"You\'re under arrest!"', 6],
] as const) {
    void test(`a hostile Kop declares ${message}`, async () => {
        await chatSetup('Keystone Kop', { seed, monster: { mpeaceful: 0 } });

        assert.equal(game._pending_message, message);
    });
}

for (const [message, seed] of [
    ['"What lousy pay we\'re getting here!"', 1],
    ['"The food\'s not fit for Orcs!"', 2],
    ['"My feet hurt, I\'ve been on them all day!"', 0],
] as const) {
    void test(`a peaceful soldier grumbles ${message}`, async () => {
        await chatSetup('soldier', { seed, monster: { mpeaceful: 1 } });

        assert.equal(game._pending_message, message);
    });
}

for (const [message, seed] of [
    ['"Surrender!"', 0],
    ['"Resistance is useless!"', 1],
    ['"You\'re dog meat!"', 2],
] as const) {
    void test(`a hostile soldier shouts ${message}`, async () => {
        await chatSetup('soldier', { seed, monster: { mpeaceful: 0 } });

        assert.equal(game._pending_message, message);
    });
}

void test('a vault guard without hero gold asks the hero to follow', async () => {
    await chatSetup('guard', { monster: { mpeaceful: 1 } });

    assert.equal(game._pending_message, '"Please follow me."');
});

void test('a tame djinni is out of wishes', async () => {
    await chatSetup('djinni', { monster: { mtame: 5, mpeaceful: 1 } });

    assert.equal(game._pending_message, '"Sorry, I\'m all out of wishes."');
});

void test('a freed djinni enjoys it', async () => {
    await chatSetup('djinni', { monster: { mpeaceful: 1 } });

    assert.equal(game._pending_message, '"I\'m free!"');
});

for (const [message, seed] of [
    ['The leprechaun giggles.', 0],
    ['The leprechaun snickers.', 1],
    ['The leprechaun laughs.', 2],
    ['The leprechaun chuckles.', 4],
] as const) {
    void test(`a leprechaun ${message}`, async () => {
        await chatSetup('leprechaun', { seed, monster: { mpeaceful: 1 } });

        assert.equal(game._pending_message, message);
    });
}

void test('a peaceful lawful minion holds out hope', async () => {
    await chatSetup('Angel', { monster: { mpeaceful: 1 } });

    assert.equal(game._pending_message, '"It\'s not too late."');
});

void test('a peaceful demon minion despairs', async () => {
    await chatSetup('marilith', { monster: { mpeaceful: 1 } });

    assert.equal(game._pending_message, '"We\'re all doomed."');
});

void test('a water nymph greets a sailor', async () => {
    await chatSetup('water nymph', { seed: 13, monster: { mpeaceful: 1 } });

    assert.equal(game._pending_message, '"Hello, sailor."');
});

void test('a water nymph comes on to the hero', async () => {
    await chatSetup('water nymph', { seed: 0, monster: { mpeaceful: 1 } });

    assert.equal(game._pending_message, 'The water nymph comes on to you.');
});

for (const [species, message] of [
    ['Woodland-elf', 'The Woodland-elf curses orcs.'],
    ['plains centaur', 'The plains centaur discusses hunting.'],
    ['apprentice', 'The apprentice talks about spellcraft.'],
    ['tourist', '"Aloha."'],
] as const) {
    void test(`a peaceful ${species} chats about its interest`, async () => {
        await chatSetup(species, { monster: { mpeaceful: 1 } });

        assert.equal(game._pending_message, message);
    });
}

void test('a wounded hobbit complains about the dungeon', async () => {
    await chatSetup('hobbit', { monster: { mpeaceful: 1, mhp: 5, mhpmax: 10 } });

    assert.equal(game._pending_message, 'The hobbit complains about unpleasant dungeon conditions.');
});

void test('a healthy hobbit asks about the One Ring', async () => {
    await chatSetup('hobbit', { monster: { mpeaceful: 1, mhp: 10, mhpmax: 10 } });

    assert.equal(game._pending_message, 'The hobbit asks you about the One Ring.');
});

void test('a hallucinating hero hears a gnome business plan', async () => {
    await chatSetup('gnome', {
        seed: 0, monster: { mpeaceful: 1, female: false },
        clock: () => { game.u.hallucinationTurns = 20; },
    });

    assert.equal(game._pending_message, '"Phase one, collect underpants."');
});

void test('a sober gnome grunts its orcish reply', async () => {
    await chatSetup('gnome', { monster: { mpeaceful: 1, female: false } });

    assert.equal(game._pending_message, 'The gnome grunts.');
});

void test('a wounded Death collector misquotes Snuff', async () => {
    freshObjectRoom();
    const novel = await knownObject(SPE_NOVEL, {});
    novel.novelidx = 38; // Snuff: no Death, so no misquote suffix
    game.inventory.push(novel);
    const death = await createMonsterAt('Death', 11, 10);
    death.msleeping = 0;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, 'AH, SO YOU HAVE A COPY OF /SNUFF/.');
    assert.equal(game.context.deathNotice, true);
});

void test('Death quotes The Wee Free Men without a misquote', async () => {
    freshObjectRoom();
    const novel = await knownObject(SPE_NOVEL, {});
    novel.novelidx = 29; // The Wee Free Men
    game.inventory.push(novel);
    const death = await createMonsterAt('Death', 11, 10);
    death.msleeping = 0;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, 'AH, SO YOU HAVE A COPY OF /THE WEE FREE MEN/.');
});

void test('a helmeted hero is asked to undress by a nurse', async () => {
    freshObjectRoom();
    game.uarmh = game.u.uarmh = await knownObject(HELMET, {});
    const nurse = await createMonsterAt('nurse', 11, 10);
    nurse.mpeaceful = 1;
    nurse.msleeping = 0;

    await runExtendedCommand('chat', 'l');

    assert.equal(game._pending_message, '"Please undress so I can examine you."');
});

void test('an endgame player monster prefers talking to its own class', async () => {
    freshObjectRoom();
    game.astral_level = { dnum: 5, dlevel: 1, flags: { town: false }, alignment: 0 };
    game.u.uz = { dnum: 5, dlevel: 1 };
    const knight = await createMonsterAt('knight', 11, 10);
    knight.mpeaceful = 0;
    knight.msleeping = 0;
    await runExtendedCommand('chat', 'l');
    const other = game._pending_message;

    freshObjectRoom();
    game.astral_level = { dnum: 5, dlevel: 1, flags: { town: false }, alignment: 0 };
    game.u.uz = { dnum: 5, dlevel: 1 };
    const wizard = await createMonsterAt('wizard', 11, 10);
    wizard.mpeaceful = 0;
    wizard.msleeping = 0;
    await runExtendedCommand('chat', 'l');

    assert.ok(/^"Talk\? -- /.test(other ?? ''), `expected player-monster talk: ${other}`);
    assert.notEqual(game._pending_message, other);
    game.astral_level = undefined;
});
