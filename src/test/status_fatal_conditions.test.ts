import assert from 'node:assert/strict';
import test from 'node:test';
import { HUNGRY, SICK_NONVOMITABLE, SICK_VOMITABLE } from '../js/const.js';
import { bot, flush_screen, plineWithContinuation } from '../js/display.js';
import { doeat } from '../js/eat.js';
import { game } from '../js/gstate.js';
import { cureHeroSickness, startHeroSickness, vomitHero } from '../js/hero_illness.js';
import { resetInputState } from '../js/input.js';
import { makeConfused, makeStunned } from '../js/hero_mental_status.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE } from '../js/object_data.js';
import { setHeroSlimingTimeout } from '../js/slime.js';
import { fixHeroPetrification, setHeroPetrificationTimeout } from '../js/stoning.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';

function status(): string {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}

void test('curing petrification removes Stone when the cure feedback is displayed', async () => {
    await freshObjectRoom();
    await setHeroPetrificationTimeout(5);
    await bot();
    assert.match(status(), /\bStone\b/);

    await fixHeroPetrification();
    await flush_screen(1);

    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /You feel limber!/);
    assert.doesNotMatch(status(), /\bStone\b/);
});

for (const species of ['lizard', 'acid blob']) {
    void test(`eating ${species} flesh clears Stone before the cure message is displayed`, async () => {
        await freshObjectRoom({ hero: { uhunger: 200 } });
        const food = await addInventoryObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf(species), age: game.moves,
        });
        await setHeroPetrificationTimeout(30);
        await bot();
        assert.match(status(), /\bStone\b/);
        const input = resetInputState();
        installPagerInput(input, { expected: /limber|corpse|acidic/, limit: 4 });
        input.feed(food.invlet);

        await doeat();
        await flush_screen(1);

        assert.equal(game.u.stonedTurns, 0);
        assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /You feel limber!/);
        assert.doesNotMatch(status(), /\bStone\b/);
    });
}

for (const [type, label] of [
    [SICK_VOMITABLE, 'FoodPois'], [SICK_NONVOMITABLE, 'TermIll'],
] as const) {
    void test(`${label} appears on the next message flush and disappears after a cure`, async () => {
        await freshObjectRoom();
        await bot();

        await startHeroSickness({ turns: 20, type });
        await plineWithContinuation('You wait.');

        assert.match(status(), new RegExp(`\\b${label}\\b`));
        cureHeroSickness();
        await flush_screen(1);
        assert.doesNotMatch(status(), new RegExp(`\\b${label}\\b`));
    });
}

void test('vomiting away food poisoning keeps FoodPois on the paged choke message', async () => {
    await freshObjectRoom();
    await startHeroSickness({ turns: 20, type: SICK_VOMITABLE, cause: 'tainted meat' });
    await flush_screen(1);
    assert.match(status(), /\bFoodPois\b/);

    const pages: string[] = [];
    installPagerInput(resetInputState(), {
        expected: /deathly sick|vomit|cured|relief/,
        limit: 3,
        pages,
    });
    await plineWithContinuation('You stuff yourself and then vomit voluminously.');
    await vomitHero({ state: game });

    const pause = pages.find(page =>
        page.split('\n')[0]?.includes('You stuff yourself and then vomit voluminously.'));
    assert.ok(pause, 'The cure line pages the pending choke message.');
    assert.match(pause, /--More--/);
    // potion.c make_sick() prints the cure line before clearing Sick and
    // raising botl, so the --More-- it raises still shows the sick status.
    assert.match(pause, /\bFoodPois\b/);
    assert.equal(game.u.sick, false);
    await flush_screen(1);
    assert.doesNotMatch(status(), /\bFoodPois\b/);
});

void test('fatal conditions follow hunger in native severity order', async () => {
    await freshObjectRoom({ hero: { uhs: HUNGRY } });
    await startHeroSickness({ turns: 20, type: SICK_VOMITABLE | SICK_NONVOMITABLE });
    await setHeroSlimingTimeout(10);
    await setHeroPetrificationTimeout(5);

    await flush_screen(1);

    assert.match(status(), /Hungry FoodPois Slime Stone TermIll/);
    await setHeroPetrificationTimeout(0);
    await setHeroSlimingTimeout(0);
    await flush_screen(1);
    assert.doesNotMatch(status(), /Stone|Slime/);
    assert.match(status(), /FoodPois TermIll/);
});

void test('conditions of equal severity use native alphabetical order', async () => {
    await freshObjectRoom();
    await makeStunned(5, { talk: false });
    await makeConfused(5, { talk: false });

    await flush_screen(1);

    assert.match(status(), /\bConf Stun\b/);
});
