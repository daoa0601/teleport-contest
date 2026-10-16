import { advanceHeroSickness, advanceHeroVomiting } from './support/condition-turn.js';
import type { FinishHeroDeathOptions } from '../js/end.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_CON, SICK_NONVOMITABLE, SICK_VOMITABLE,
} from '../js/const.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { flush_screen, flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { loadScoreRecords } from '../js/score_records.js';
import { initRng } from '../js/rng.js';
import { useUnicornHorn } from '../js/unicorn_horn.js';
import { memoryStorage } from './support/memory-storage.js';
import { startHeroSickness, startHeroVomiting, vomitHero } from '../js/hero_illness.js';
import { statusConditions } from '../js/status_conditions.js';
import { CHAIN_MAIL, LONG_SWORD, UNICORN_HORN } from '../js/object_data.js';
import {
    addInventoryObject, addInventoryWeapon,
} from './support/game-objects.js';
import {
    freshHeroConditionRoom, installPolymorphedHero,
} from './support/hero-state.js';
import { wearHeroArmor } from '../js/armor.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';

void test('fatal illness worsens and reaches the normal death path', async () => {
    freshHeroConditionRoom();
    requireFixtureGame(game);
    await startHeroSickness({
        state: game,
        turns: 7,
        cause: 'rotted goblin corpse',
        type: SICK_NONVOMITABLE,
    });
    const messages: string[] = [];
    const deaths: FinishHeroDeathOptions[] = [];

    for (let turn = 0; turn < 7; turn++) {
        await advanceHeroSickness({
            state: game,
            publish: async (message: string) => messages.push(message),
            die: async details => {
                deaths.push(details);
                return true;
            },
        });
    }

    assert.deepEqual(messages.slice(0, 3), [
        'Your illness feels worse.',
        'Your illness is severe.',
        "You are at Death's door.",
    ]);
    assert.equal(deaths.length, 1);
    assert.equal(deaths[0]?.killer, 'rotted goblin corpse');
    assert.equal(game.u.sickTurns, 0);
});

// C timeout.c:nh_timeout(): Sick reaches zero without marking the status
// line, so the fatal message shows that change only when an earlier change
// already requested a refresh. done_timeout() marks Sick again for done().
for (const pendingRefresh of [false, true]) {
    void test(`terminal illness ${pendingRefresh ? 'leaves' : 'keeps'} TermIll on screen at its fatal message${pendingRefresh ? ' after a pending refresh' : ''}`, async () => {
        freshHeroConditionRoom();
        requireFixtureGame(game);
        const input = resetInputState();
        const fatalStatus: string[] = [];
        input.display = {
            async readKey() {
                const rows = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join(''));
                if (rows[0]?.includes('You die from your illness.')) fatalStatus.push(rows[23] ?? '');
                return ' '.charCodeAt(0);
            },
        };
        await startHeroSickness({ state: game, turns: 1, cause: 'illness', type: SICK_NONVOMITABLE });
        await flushPendingTopline();
        await flush_screen(1);
        if (pendingRefresh) {
            game.u.uhp -= 1;
            game.context.botl = true;
        }
        let sickAtDeath = false;

        await advanceHeroSickness({
            state: game,
            die: async () => {
                await flushPendingTopline();
                sickAtDeath = statusConditions(game).some(text => text[0] === 'TermIll');
                return true;
            },
        });

        assert.equal(fatalStatus.length, 1);
        if (pendingRefresh) assert.doesNotMatch(fatalStatus[0] ?? '', /TermIll/);
        else assert.match(fatalStatus[0] ?? '', /TermIll/);
        assert.equal(sickAtDeath, true);
    });
}

void test('the Constitution recovery roll can cure food poisoning', async () => {
    freshHeroConditionRoom();
    requireFixtureGame(game);
    const constitution = game.u.acurr.a[A_CON];
    await startHeroSickness({
        state: game,
        turns: 1,
        cause: 'tainted meat',
        type: SICK_VOMITABLE,
    });
    const messages: string[] = [];

    const result = await advanceHeroSickness({
        state: game,
        publish: async (message: string) => messages.push(message),
        random: () => 0,
        die: async () => {
            assert.fail('recoverable food poisoning should not kill');
        },
    });

    assert.equal(result.recovered, true);
    assert.equal(game.u.acurr.a[A_CON], constitution - 1);
    assert.deepEqual(messages, ['You have recovered from your illness.']);
});

void test('nausea worsens, confuses, stuns, and ends in vomiting', async () => {
    freshHeroConditionRoom();
    requireFixtureGame(game);
    game.u.uhunger = 900;
    await startHeroSickness({
        state: game,
        turns: 30,
        cause: 'tainted meat',
        type: SICK_VOMITABLE,
    });
    startHeroVomiting({ state: game, turns: 15 });
    const messages: string[] = [];

    for (let turn = 0; turn < 15; turn++) {
        await advanceHeroVomiting({
            state: game,
            publish: async (message: string) => messages.push(message),
            rollDice: count => count,
        });
    }

    assert.deepEqual(messages, [
        'You are feeling mildly nauseated.',
        'You feel slightly confused.',
        "You can't seem to think straight.",
        'You feel incredibly sick.',
        'You are about to vomit.',
        'You vomit!',
        'You feel cured.  What a relief!',
    ]);
    assert.equal(game.u.uhunger, 880);
    assert.equal(game.u.sick, false);
    assert.equal(game.u.vomiting, false);
    assert.equal(game._helplessTurns, 2);
});

void test('a rat form cannot vomit away food poisoning', async () => {
    freshHeroConditionRoom();
    requireFixtureGame(game);
    installPolymorphedHero('sewer rat', { turns: 20 });
    await startHeroSickness({
        state: game,
        turns: 30,
        cause: 'tainted meat',
        type: SICK_VOMITABLE,
    });
    const messages: string[] = [];

    const result = await vomitHero({
        state: game,
        publish: async (message: string) => messages.push(message),
    });

    assert.deepEqual(messages, ['Your jaw gapes convulsively.']);
    assert.equal(result.spewed, false);
    assert.equal(game.u.sick, true);
    assert.equal(game._helplessTurns, 2);
});

void test('natural vomiting expiry announces the vomit without a cure message', async () => {
    freshHeroConditionRoom();
    startHeroVomiting({ turns: 1 });
    const messages: string[] = [];

    await advanceHeroVomiting({ publish: async message => { messages.push(message); } });

    assert.deepEqual(messages, ['You vomit!']);
    assert.equal(game.u.vomitingTurns, 0);
    assert.equal(game._helplessTurns, 2);
});

void test('a vomiting yellow dragon breathes acid on its weapon and armor',
    async () => {
        freshHeroConditionRoom();
        requireFixtureGame(game);
        installPolymorphedHero('yellow dragon', { turns: 20 });
        const sword = await addInventoryWeapon(LONG_SWORD);
        await setPrimaryWeapon(sword);
        const mail = await addInventoryObject(CHAIN_MAIL);
        wearHeroArmor(mail);
        const rolls = [0, 0, 1];
        const messages: string[] = [];

        await vomitHero({
            state: game,
            publish: async (message: string) => messages.push(message),
            random: range => {
                const value = rolls.shift();
                assert.ok(value != null);
                assert.ok(value >= 0 && value < range);
                return value;
            },
        });

        assert.deepEqual(messages, [
            'You breathe acid on yourself...',
            "The acid doesn't hurt.",
            'Your long sword corrodes!',
            'Your chain mail corrodes!',
        ]);
        assert.equal(game.u.mh, 40);
        assert.equal(sword.oeroded2, 1);
        assert.equal(mail.oeroded2, 1);
    });

for (const previousTurns of [0, 36] as const) {
    void test(`${previousTurns ? 'worsening illness' : 'new illness'} waits for the old message before changing symptoms`, async () => {
        freshHeroConditionRoom();
        requireFixtureGame(game);
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        if (previousTurns) await startHeroSickness({
            turns: previousTurns, cause: 'tainted meat', type: SICK_VOMITABLE,
        });
        await flushPendingTopline();
        await plineWithContinuation(
            'You carefully examine the unicorn horn for any cracks along its entire length.',
        );
        let acknowledged = false;
        input.beforeRead = () => {
            assert.equal(game.u.sickTurns ?? 0, previousTurns);
            assert.notEqual(game.u.sickCause, 'unicorn horn');
            acknowledged = true;
            input.feed(' ');
        };

        await startHeroSickness({
            turns: 6, cause: 'unicorn horn', type: SICK_NONVOMITABLE,
            talk: !!previousTurns,
        });

        assert.equal(acknowledged, true);
        assert.equal(game.u.sickTurns, 6);
        assert.equal(game.u.sickCause, 'unicorn horn');
        assert.equal(game.u.sickType, previousTurns
            ? SICK_NONVOMITABLE | SICK_VOMITABLE : SICK_NONVOMITABLE);
        assert.match(game._pending_message, previousTurns
            ? /You feel much worse\./ : /You feel deathly sick\./);
    });
}

void test('wizard illness feedback stays between earlier and later selected properties', async () => {
    freshHeroConditionRoom();
    requireFixtureGame(game);
    game.flags.debug = true;
    const messages: string[] = [];
    const input = resetInputState();
    let replies = 0;
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
        if (++replies > 100) throw new Error('Unexpected repeated wizard input');
        const display = requireGameDisplay();
        const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (screen.includes('--More--')) input.feed(' ');
    };

    await runExtendedCommand('wizintrinsic', 'aer\n');

    assert.equal(game.u.sickTurns, 30);
    assert.equal(game.u.invulnerableTurns, 30);
    assert.equal(game.u.veryFastTurns, 30);
    assert.match(messages.join('\n'),
        /Timeout for invulnerable set to 30\.[\s\S]*You feel deathly sick\.[\s\S]*Timeout for very fast set to 30\./);
});

for (const source of ['named horn', 'wizard command'] as const) {
    void test(`fatal sickness keeps the ${source}'s death description`, async () => {
        freshHeroConditionRoom();
        requireFixtureGame(game);
        game.storage = memoryStorage();
        game.u.urexp = 100;
        game.flags.disclose = '-i -a -v -c -o';
        game.flags.tombstone = true;
        game.flags.debug = source === 'wizard command';
        const screens: string[] = [];
        const input = resetInputState();
        let replies = 0;
        input.beforeRead = () => {
            const rows = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join(''));
            screens.push(rows.join('\n'));
            if (++replies > 100) throw new Error('Unexpected repeated illness input');
            const screen = rows.join('\n');
            if (screen.includes('--More--')) input.feed(' ');
            else if (rows[0]?.includes('Die?')) input.feed('y');
            else if (rows[0]?.includes('Save bones?')) input.feed('n');
        };
        if (source === 'named horn') {
            const horn = await addInventoryObject(UNICORN_HORN, { cursed: true, oname: 'Keen' });
            initRng(3n);
            const result = await useUnicornHorn({ object: horn });
            assert.equal(result.caused, 'sickness');
            assert.equal(game.u.sickCause, 'unicorn horn named Keen');
        } else {
            initRng(3n);
            await runExtendedCommand('wizintrinsic', 'e\n');
        }
        const turns = game.u.sickTurns;
        assert.ok(turns !== undefined);
        for (let turn = 0; turn < turns; turn++) await advanceHeroSickness();

        assert.equal(game.program_state.gameover, true);
        if (source === 'named horn') {
            const [score] = loadScoreRecords();
            assert.ok(score);
            assert.match(score.death, /poisoned by a unicorn horn named Keen/);
        } else {
            const inscription = screens.flatMap(screen => screen.split('\n'))
                .filter(line => line.includes('poisoned by') || line.includes('#wizintrinsic'))
                .map(line => line.replaceAll('|', '').trim()).join(' ');
            assert.match(inscription, /poisoned by #wizintrinsic/);
            assert.doesNotMatch(inscription, /(?:a|an) #wizintrinsic/);
        }
    });
}
