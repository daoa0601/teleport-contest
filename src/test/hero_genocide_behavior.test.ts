import test from 'node:test';
import assert from 'node:assert/strict';
import { G_EXTINCT, G_GENOD, G_NOCORPSE, MM_NOGRP, NO_MINVENT, Upolyd } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { gameLogEvents } from '../js/gamelog.js';
import { doClassGenocide, doGenocide } from '../js/genocide.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { makeConfused, makeHallucinated } from '../js/hero_mental_status.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { DAGGER, SCR_GENOCIDE } from '../js/object_data.js';
import { returnHeroToHumanForm } from '../js/polyself.js';
import { doread } from '../js/read.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';

function genocideRoom({ debug = false } = {}) {
    const level = freshObjectRoom({ left: 2, right: 35, top: 2, bottom: 18,
        hero: { urexp: 100 },
        flags: { debug, verbose: true, bones: false, disclose: '-i -a -v -c -o', tombstone: false } });
    requirePlayingGame(game);
    game.plname = 'Genocider';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    return { state: game, level };
}

function observedGenocideInput(answers: string[], scrollLetter?: string) {
    const input = resetInputState();
    const seen: string[] = [];
    const remaining = [...answers];
    let choseScroll = false;
    const screen = () => requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    input.beforeRead = () => { seen.push(screen()); };
    installPagerInput(input, {
        expected: /Wiped out|feel .+ inside|You die\.|return to .+ form|turn into|transform|vampire|scroll|magic|read|Goodbye Genocider|points|killed by|permitted|nonexistent|No, mortal|Eliminated|Nothing happens|such creatures|voice booms/i,
        limit: 100,
    });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            const visible = screen();
            if (/--More--|Hit space to continue/.test(visible)) return pager.readKey();
            if (visible.includes('What do you want to read?')) {
                assert.equal(choseScroll, false, 'Reading must select one real scroll');
                assert.ok(scrollLetter, 'This action must not request a scroll');
                choseScroll = true;
                return scrollLetter.charCodeAt(0);
            }
            if (/What (?:type of monster|class of monsters) do you want to genocide\?/.test(visible)) {
                const answer = remaining.shift();
                assert.ok(answer, `Unexpected genocide prompt:\n${visible}`);
                input.feed(answer.slice(1) + '\n');
                return answer.charCodeAt(0);
            }
            assert.fail(`Unexpected input during genocide:\n${visible}`);
        },
    };
    return { text: () => seen.join('\n') };
}

for (const [form, feeling] of [
    ['red dragon', 'dead'], ['vampire', 'condemned'], ['iron golem', 'empty'],
] as const) {
    void test(`reading own-role genocide as a ${form} leaves the living body feeling ${feeling}`, async () => {
        const { state } = genocideRoom();
        installPolymorphedHero(form);
        const scroll = await addInventoryObject(SCR_GENOCIDE);
        const observed = observedGenocideInput(['cavewoman'], scroll.invlet);

        await doread();
        await flushPendingTopline();

        assert.equal(!!state.program_state.gameover, false);
        assert.equal(Upolyd(state.u), true);
        assert.equal(state.u.umonnum, MONSTER_NAME.indexOf(form));
        assert.equal(state.u.uhp, -1);
        assert.ok(state.u.mh > 0);
        assert.ok(requireMonsterVital(state.u.umonster).mvflags & G_GENOD);
        assert.equal(requireMonsterVital(state.urace.mnum).mvflags & G_GENOD, 0);
        assert.equal(requireMonsterVital(2).mvflags & G_GENOD, 0,
            'The role ordinal must not be used as a species index');
        assert.equal(scroll.where, 'gone');
        assert.match(observed.text(), new RegExp(`You feel ${feeling} inside\\.`));
    });
}

void test('a confused genocide scroll kills the human reader with the confusion cause', async () => {
    const { state } = genocideRoom();
    const scroll = await addInventoryObject(SCR_GENOCIDE);
    await makeConfused(10, { state, talk: false });
    const observed = observedGenocideInput([], scroll.invlet);

    await doread();

    assert.equal(state.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by genocidal confusion');
    assert.ok(requireMonsterVital(state.u.umonster).mvflags & G_GENOD);
    assert.doesNotMatch(observed.text(), /What type of monster do you want to genocide\?/);
    assert.doesNotMatch(observed.text(), /You die\.\.\./);
});

void test('genociding the current changeable form restores the healthy original body', async () => {
    const { state, level } = genocideRoom();
    installPolymorphedHero('red dragon');
    const dragon = await createMonsterAt('red dragon', 13, 10, NO_MINVENT | MM_NOGRP);
    const scroll = await addInventoryObject(SCR_GENOCIDE);
    const observed = observedGenocideInput(['red dragon'], scroll.invlet);

    await doread();
    await flushPendingTopline();

    assert.equal(Upolyd(state.u), false);
    assert.ok(state.u.uhp > 0);
    assert.equal(!!state.program_state.gameover, false);
    assert.equal(level.monsters.includes(dragon), false);
    assert.match(observed.text(), /You return to human form!/);
});

void test('genociding an unchanging current form causes immediate genocide death', async () => {
    const { state } = genocideRoom();
    installPolymorphedHero('red dragon', { unchanging: true });
    const scroll = await addInventoryObject(SCR_GENOCIDE);
    const observed = observedGenocideInput(['red dragon'], scroll.invlet);

    await doread();

    assert.equal(state.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a scroll of genocide');
    assert.equal(requireMonsterVital(state.urace.mnum).mvflags & G_GENOD, 0);
    assert.doesNotMatch(observed.text(), /feel .+ inside|return to human form|killed while stuck/);
});

void test('an unchanging other form survives genocide of the original race', async () => {
    const { state } = genocideRoom();
    installPolymorphedHero('red dragon', { unchanging: true });
    const scroll = await addInventoryObject(SCR_GENOCIDE);
    const observed = observedGenocideInput(['human'], scroll.invlet);

    await doread();
    await flushPendingTopline();

    assert.equal(!!state.program_state.gameover, false);
    assert.equal(state.u.uhp, -1);
    assert.equal(Upolyd(state.u), true);
    assert.ok(requireMonsterVital(state.urace.mnum).mvflags & G_GENOD);
    assert.match(observed.text(), /You feel dead inside\./);
});

void test('immediate own-race genocide stops before removing other members of the species', async () => {
    const { state, level } = genocideRoom();
    const human = await createMonsterAt('human', 13, 10, NO_MINVENT | MM_NOGRP);
    const scroll = await addInventoryObject(SCR_GENOCIDE);
    observedGenocideInput(['human'], scroll.invlet);

    await doread();

    assert.equal(state.program_state.gameover, true);
    assert.ok(level.monsters.includes(human));
    assert.ok(human.mhp > 0);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a scroll of genocide');
});

void test('a doomed original race in a surviving monster body still removes that species from the level', async () => {
    const { state, level } = genocideRoom();
    installPolymorphedHero('red dragon');
    const human = await createMonsterAt('human', 13, 10, NO_MINVENT | MM_NOGRP);
    const scroll = await addInventoryObject(SCR_GENOCIDE);
    observedGenocideInput(['human'], scroll.invlet);

    await doread();
    await flushPendingTopline();

    assert.equal(!!state.program_state.gameover, false);
    assert.equal(level.monsters.includes(human), false);
    assert.equal(state.u.uhp, -1);
});

void test('class self-genocide finishes its species before immediate hero death', async () => {
    const { state } = genocideRoom();
    const scroll = await addInventoryObject(SCR_GENOCIDE, { blessed: true });
    const observed = observedGenocideInput(['@'], scroll.invlet);

    await doread();

    assert.equal(state.program_state.gameover, true);
    assert.ok(requireMonsterVital(state.u.umonster).mvflags & G_GENOD,
        'The later role species must be processed after the race first dooms the hero');
    assert.ok(requireMonsterVital(MONSTER_NAME.indexOf('nurse')).mvflags & G_GENOD);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a scroll of genocide');
    assert.match(observed.text(), /You die\./);
    assert.doesNotMatch(observed.text(), /You die\.\.\./);
});

void test('class genocide of an unchanging dragon continues through later dragons before dying', async () => {
    const { state } = genocideRoom();
    installPolymorphedHero('red dragon', { unchanging: true });
    const scroll = await addInventoryObject(SCR_GENOCIDE, { blessed: true });
    observedGenocideInput(['D'], scroll.invlet);

    await doread();

    assert.equal(state.program_state.gameover, true);
    assert.ok(requireMonsterVital(MONSTER_NAME.indexOf('yellow dragon')).mvflags & G_GENOD);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a scroll of genocide');
});

void test('class genocide stops when returning from a nurse body kills the already-genocided human', async () => {
    const { state } = genocideRoom();
    installPolymorphedHero('nurse');
    const scroll = await addInventoryObject(SCR_GENOCIDE, { blessed: true });
    const observed = observedGenocideInput(['@'], scroll.invlet);

    await doread();

    assert.equal(state.program_state.gameover, true);
    assert.ok(requireMonsterVital(MONSTER_NAME.indexOf('nurse')).mvflags & G_GENOD);
    assert.equal(requireMonsterVital(state.u.umonster).mvflags & G_GENOD, 0,
        'Actual death interrupts the class before its later role species');
    assert.equal(loadScoreRecords()[0]?.death, 'killed by self-genocide');
    assert.match(observed.text(), /You return to human form!/);
    assert.doesNotMatch(observed.text(), /not healthy enough/);
});

void test('class genocide leaves no invented delayed scroll cause on later rehumanization', async () => {
    const { state } = genocideRoom();
    installPolymorphedHero('red dragon');
    const scroll = await addInventoryObject(SCR_GENOCIDE, { blessed: true });
    observedGenocideInput(['@'], scroll.invlet);
    await doread();
    await flushPendingTopline();
    assert.equal(!!state.program_state.gameover, false);
    assert.equal(state.u.uhp, -1);

    await returnHeroToHumanForm(state);

    assert.equal(state.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by self-genocide');
});

void test('genociding a shifted vampire bat restores the vampire before wiping out bats', async () => {
    const { state } = genocideRoom();
    installPolymorphedHero('vampire bat');
    state.u.mcham = MONSTER_NAME.indexOf('vampire');
    const observed = observedGenocideInput(['vampire bat']);

    await doGenocide(1);
    await flushPendingTopline();

    assert.equal(!!state.program_state.gameover, false);
    assert.equal(state.u.umonnum, MONSTER_NAME.indexOf('vampire'));
    assert.ok(requireMonsterVital(MONSTER_NAME.indexOf('vampire bat')).mvflags & G_GENOD);
    assert.equal(requireMonsterVital(MONSTER_NAME.indexOf('vampire')).mvflags & G_GENOD, 0);
    assert.doesNotMatch(observed.text(), /You return to human form!/);
});

void test('an inadmissible class allows another choice instead of ending the scroll', async () => {
    const { state } = genocideRoom();
    const scroll = await addInventoryObject(SCR_GENOCIDE, { blessed: true });
    observedGenocideInput(['I', 'a'], scroll.invlet);

    await doread();
    await flushPendingTopline();

    assert.equal(!!state.program_state.gameover, false);
    assert.ok(requireMonsterVital(MONSTER_NAME.indexOf('giant ant')).mvflags & G_GENOD);
    assert.equal(scroll.where, 'gone');
});

void test('wizard class elimination removes actors and cargo without genociding their species', async () => {
    const { state, level } = genocideRoom({ debug: true });
    const orc = await createMonsterAt('orc', 13, 10, NO_MINVENT | MM_NOGRP);
    const dagger = await knownObject(DAGGER);
    await addObjectToMonsterInventory(orc, dagger);
    observedGenocideInput(['*']);

    await doClassGenocide();
    await flushPendingTopline();

    assert.equal(level.monsters.includes(orc), false);
    assert.equal(dagger.where, 'gone');
    assert.equal(requireMonsterVital(orc.mnum).mvflags & G_GENOD, 0);
    assert.equal(state.u.uconduct.genocides ?? 0, 0);
});

void test('a hallucinating cavewoman sees her gendered role name while another species is genocided', async () => {
    const { state } = genocideRoom();
    state.flags.female = true;
    await makeHallucinated(20, { state, talk: false });
    const scroll = await addInventoryObject(SCR_GENOCIDE);
    const observed = observedGenocideInput(['giant ant'], scroll.invlet);

    await doread();
    await flushPendingTopline();

    assert.match(observed.text(), /Wiped out all cavewomen\./);
    assert.ok(requireMonsterVital(MONSTER_NAME.indexOf('giant ant')).mvflags & G_NOCORPSE);
    assert.equal(requireMonsterVital(state.u.umonster).mvflags & G_GENOD, 0);
});

void test('a cursed genocide scroll cannot send in an already extinct species', async () => {
    const { state, level } = genocideRoom();
    const ant = MONSTER_NAME.indexOf('giant ant');
    requireMonsterVital(ant).mvflags |= G_EXTINCT;
    const scroll = await addInventoryObject(SCR_GENOCIDE, { cursed: true });
    const observed = observedGenocideInput(['giant ant'], scroll.invlet);

    await doread();
    await flushPendingTopline();

    assert.equal(level.monsters.some(monster => monster.mnum === ant), false);
    assert.equal(requireMonsterVital(ant).mvflags & G_GENOD, 0);
    assert.equal(state.u.uconduct.genocides ?? 0, 0);
    assert.match(observed.text(), /Nothing happens\./);
});

void test('first and later species genocides log real names even while hallucinating', async () => {
    const { state } = genocideRoom();
    state.flags.female = true;
    await makeHallucinated(20, { state, talk: false });
    observedGenocideInput(['giant ant', 'orc']);

    await doGenocide(1);
    await doGenocide(1);
    await flushPendingTopline();

    const events = gameLogEvents(state).filter(event => /genocide/.test(event.text));
    assert.equal(events.length, 2);
    assert.equal(events[0]?.text, 'performed her first genocide (giant ants)');
    assert.equal(events[1]?.text, 'genocided orcs');
});

void test('each class genocide logs one event despite removing several species', async () => {
    const { state } = genocideRoom();
    observedGenocideInput(['a', 'd']);

    await doClassGenocide();
    await doClassGenocide();
    await flushPendingTopline();

    const events = gameLogEvents(state).filter(event => /genocide/.test(event.text));
    assert.equal(events.length, 2);
    assert.equal(events[0]?.text, 'performed his first genocide (class a)');
    assert.equal(events[1]?.text, 'genocided class d');
    assert.ok(requireMonsterVital(MONSTER_NAME.indexOf('giant ant')).mvflags & G_GENOD);
    assert.ok(requireMonsterVital(MONSTER_NAME.indexOf('soldier ant')).mvflags & G_GENOD);
    assert.ok(requireMonsterVital(MONSTER_NAME.indexOf('jackal')).mvflags & G_GENOD);
});

void test('the first-genocide possessive follows the hero sex flag in a neuter body', async () => {
    const { state } = genocideRoom();
    installPolymorphedHero('iron golem');
    state.flags.female = true;
    observedGenocideInput(['a']);

    await doClassGenocide();
    await flushPendingTopline();

    const events = gameLogEvents(state).filter(event => /genocide/.test(event.text));
    assert.equal(events.length, 1);
    assert.equal(events[0]?.text, 'performed her first genocide (class a)');
});
