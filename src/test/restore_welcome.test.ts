import assert from 'node:assert/strict';
import test from 'node:test';
import { restoregamePreamble, welcome } from '../js/allmain.js';
import { G_GENOD } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { gameLogEvents } from '../js/gamelog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setPropertyTimeout } from '../js/properties.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';

function restoringWizard() {
    freshObjectRoom({ role: 'wizard', hero: { ualignbase: [0, 0] }, flags: { female: false, initgend: 0 } });
    game.plname = game.displayName = 'Ada';
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, {
        expected: /Restoring save file|welcome back|studio audience|inside|hot here|cold here|smoke|remember this level/,
        limit: 8,
    });
    return messages;
}

async function restoredMessages(messages: string[]) {
    await restoregamePreamble();
    await flushPendingTopline();
    return messages.join('\n');
}

void test('a converted restored hero is greeted with the permanent current alignment', async () => {
    const messages = restoringWizard();
    game.u.ualignbase = [1, 0];
    game.u.ualign = { type: 1, record: 0 };

    const text = await restoredMessages(messages);

    assert.match(text, /Hello Ada, the lawful human Wizard, welcome back to NetHack!/);
});

void test('a restored hero wearing an opposite alignment is described as adrift', async () => {
    const messages = restoringWizard();
    game.u.ualign = { type: -1, record: 0 };

    const text = await restoredMessages(messages);

    assert.match(text, /the adrift chaotic human Wizard, welcome back/);
});

void test('a polymorphed restored hero is greeted using the innate body gender', async () => {
    const messages = restoringWizard();
    installPolymorphedHero('wolf');
    game.u.mfemale = true;

    const text = await restoredMessages(messages);

    assert.match(text, /the female human Wizard, welcome back/);
});

void test('a hallucinating restored hero hears the studio announcement before the greeting', async () => {
    const messages = restoringWizard();
    setPropertyTimeout('hallucination', 100);

    const text = await restoredMessages(messages);

    const announcement = text.indexOf('NetHack is filmed in front of an undead studio audience.');
    assert.ok(announcement >= 0 && text.indexOf('Hello Ada') > announcement, text);
});

void test('a doomed restored monster body is reminded of self-genocide instead of welcomed', async () => {
    const messages = restoringWizard();
    requireFixtureGame(game);
    installPolymorphedHero('wolf');
    const vital = game.mvitals[game.urace.mnum];
    assert.ok(vital);
    vital.mvflags |= G_GENOD;

    const text = await restoredMessages(messages);

    assert.match(text, /You're back, but you still feel dead inside\./);
    assert.doesNotMatch(text, /welcome back/);
});

void test('restoring reminds the hero of heat, smoke, and the level annotation after the greeting', async () => {
    const messages = restoringWizard();
    requireFixtureGame(game);
    game.dungeons = [createDungeon({ dname: 'Gehennom', num_dunlevs: 20, flags: { hellish: true } })];
    game.level.flags.temperature = 1;
    game._levelAnnotations = new Map([['0:8', 'the warm library']]);

    const text = await restoredMessages(messages);

    const greeting = text.indexOf('welcome back');
    const heat = text.indexOf('It is hot here.');
    const smoke = text.indexOf('You smell smoke...');
    const annotation = text.indexOf('You remember this level as the warm library.');
    assert.ok(greeting >= 0 && heat > greeting && smoke > heat && annotation > smoke, text);
});

void test('welcome runs its Lua hook first and records the same identity in the chronicle', async t => {
    restoringWizard();
    game.plname = 'ada';
    const core = await startLuaCore(t);
    core.execute(`
        function nhcore.start_new_game()
            nh.pline("The dungeon greets you.")
        end
    `);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /The dungeon greets you|welcome to NetHack/, limit: 2 });

    await welcome(true);
    await flushPendingTopline();

    const text = messages.join('\n');
    const hook = text.indexOf('The dungeon greets you.');
    assert.ok(hook >= 0 && hook < text.indexOf('Hello ada'), text);
    assert.match(text, /Hello ada, welcome to NetHack!  You are a neutral male human Wizard\./);
    assert.equal(gameLogEvents().at(-1)?.text, 'ada the neutral male human Wizard entered the dungeon');
});
