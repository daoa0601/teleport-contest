import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { plineWithContinuation } from '../js/pline.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

async function interventionTurn(seed: number, earlierMessage?: string) {
    game._moveloopStarted = true;
    game.u.umovement = 12;
    initRng(BigInt(seed));
    const input = resetInputState();
    const messages: string[] = [];
    const pages: string[] = [];
    input.beforeRead = () => {
        messages.push(game._pending_message);
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (text.includes('--More--')) pages.push(game._pending_message);
    };
    installPagerInput(input, { expected: /^/, limit: 80 });
    input.feed('m.');
    await moveloop_core();
    if (earlierMessage) await plineWithContinuation(earlierMessage);
    await finishAtCommandInput(input, moveloop_core, /^/);
    return { text: messages.join('\n'), pages };
}

void test('a blind hero can be cursed by Wizard harassment without seeing a glow', async () => {
    let curses = 0;
    for (let seed = 1; seed <= 32; seed++) {
        await freshObjectRoom({ hero: { blindTurns: 100, uevent: { udemigod: true }, udg_cnt: 1 } });
        requirePlayingGame(game);
        game.level.flags.rndmongen = false;
        const dagger = await addInventoryObject(DAGGER, { cursed: false, blessed: false });

        const { text: messages } = await interventionTurn(seed);

        assert.doesNotMatch(messages, /glow surrounding you/);
        if (dagger.cursed) curses++;
    }
    assert.ok(curses > 0, 'Harassment still curses a blind hero’s inventory');
});

void test('Astral harassment never resurrects the Wizard', async () => {
    for (let seed = 1; seed <= 32; seed++) {
        await freshObjectRoom({ hero: { uz: { dnum: 1, dlevel: 1 }, uevent: { udemigod: true }, udg_cnt: 1 } });
        requirePlayingGame(game);
        game.astral_level = { dnum: 1, dlevel: 1, flags: { town: false }, alignment: 0 };
        game.level.flags.rndmongen = false;

        const { text: messages } = await interventionTurn(seed);

        assert.equal(game.level.monsters.some(monster => monster.iswiz), false,
            `Astral harassment must use only outcomes 1 through 4: ${messages}`);
    }
});

void test('harassment acknowledges older prose before showing its nervousness or glow message', async () => {
    let glows = 0;
    let nervous = 0;
    for (let seed = 1; seed <= 16; seed++) {
        await freshObjectRoom({ hero: { uevent: { udemigod: true }, udg_cnt: 1 } });
        const { text, pages } = await interventionTurn(seed,
            'You inspect the quiet stone archway at the entrance to the passage.');
        const glow = text.includes('glow surrounding you.');
        const nerves = text.includes('vaguely nervous.');
        if (!glow && !nerves) continue;
        glows += Number(glow);
        nervous += Number(nerves);
        assert.match(pages[0] ?? '', /quiet stone archway/);
        assert.doesNotMatch(pages[0] ?? '', /glow surrounding you|vaguely nervous/,
            'The first pager belongs only to the older announcement');
    }
    assert.ok(glows > 0, 'The turn samples must include visible curses');
    assert.ok(nervous > 0, 'The turn samples must include nervousness');
});

void test('a curse waits at its glow announcement before changing inventory or restarting the countdown', async () => {
    let observedCurse = false;
    for (let seed = 1; seed <= 16 && !observedCurse; seed++) {
        await freshObjectRoom({ hero: { uevent: { udemigod: true }, udg_cnt: 1 } });
        requirePlayingGame(game);
        game.level.flags.rndmongen = false;
        const dagger = await addInventoryObject(DAGGER, { cursed: false, blessed: false });
        game._moveloopStarted = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const input = resetInputState();
        input.feed('m.');
        await moveloop_core();
        await plineWithContinuation('You inspect the quiet stone archway at the entrance to the passage.');

        const turn = moveloop_core();
        let reachedCommand = false;
        for (let page = 0; page < 80; page++) {
            const boundary = await Promise.race([
                turn.then(() => 'finished'),
                input.waitUntilBlocked().then(() => 'input'),
            ]);
            assert.equal(boundary, 'input', 'The turn must wait for its pager or the next command');
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (game._pending_message && screen.includes('--More--')) {
                if (game._pending_message.includes('glow surrounding you.')) {
                    assert.equal(dagger.cursed, false, 'The curse must wait for the glow acknowledgement');
                    assert.equal(game.u.udg_cnt, 0, 'The countdown must restart after the intervention finishes');
                    observedCurse = true;
                }
                input.feed(' ');
            } else {
                input.feed(27);
                reachedCommand = true;
                break;
            }
        }
        assert.ok(reachedCommand, 'Maintenance must return to command input within 80 pages');
        await turn;
        if (observedCurse) {
            assert.equal(dagger.cursed, true, 'Acknowledging the glow lets the curse finish');
            assert.ok(game.u.udg_cnt !== undefined && game.u.udg_cnt >= 50 && game.u.udg_cnt <= 249);
        }
    }
    assert.ok(observedCurse, 'The turn samples must include a visible curse');
});

void test('demigod harassment summons awake hostile nasties with delayed special attacks', async () => {
    let summoned = false;
    for (let seed = 1; seed <= 16 && !summoned; seed++) {
        await freshObjectRoom({ hero: { uevent: { udemigod: true }, udg_cnt: 1 } });
        requirePlayingGame(game);
        game.level.flags.rndmongen = false;

        const { text } = await interventionTurn(seed);

        if (!game.level.monsters.length || game.level.monsters.some(monster => monster.iswiz)) continue;
        const nasties = game.level.monsters.filter(monster => (monster.mspec_used ?? 0) > 0);
        assert.ok(nasties.length > 0, 'At least one summoned nasty must delay its spell or breath');
        for (const monster of nasties) {
            assert.equal(monster.mpeaceful, 0);
            assert.equal(monster.mtame, 0);
            assert.equal(monster.msleeping, 0);
            assert.ok(monster.mspec_used !== undefined && monster.mspec_used >= 1 && monster.mspec_used <= 4);
        }
        assert.match(text, /appear/);
        assert.equal(game.u.uhp, 40, 'The new monsters must not attack before the next hero action');
        assert.ok(game.u.udg_cnt !== undefined && game.u.udg_cnt >= 50 && game.u.udg_cnt <= 249);
        summoned = true;
    }
    assert.ok(summoned, 'The turn samples must include summoning nasties');
});

void test('demigod harassment resurrects a hostile Wizard and finishes his threat before command input', async () => {
    let resurrected = false;
    for (let seed = 1; seed <= 16 && !resurrected; seed++) {
        await freshObjectRoom({ hero: { uevent: { udemigod: true }, udg_cnt: 1 } });
        requirePlayingGame(game);
        game.level.flags.rndmongen = false;

        const { text } = await interventionTurn(seed);

        const wizard = game.level.monsters.find(monster => monster.iswiz);
        if (!wizard) continue;
        assert.equal(wizard.mrevived, 1);
        assert.equal(wizard.mpeaceful, 0);
        assert.equal(wizard.mtame, 0);
        assert.equal(game.context.no_of_wizards, 1);
        assert.match(text, /A voice booms out/);
        assert.match(text, /So thou thought thou couldst kill me, fool/);
        assert.equal(game.u.uhp, 40, 'The resurrected Wizard must not attack before the next hero action');
        assert.ok(game.u.udg_cnt !== undefined && game.u.udg_cnt >= 50 && game.u.udg_cnt <= 249);
        resurrected = true;
    }
    assert.ok(resurrected, 'The turn samples must include resurrection');
});
