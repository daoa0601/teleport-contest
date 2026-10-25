// C read.c:do_genocide()/do_class_genocide() and insight.c:list_genocided().
import assert from 'node:assert/strict';
import test from 'node:test';
import { G_EXTINCT, G_GENOD } from '../js/const.js';
import { listGenocided } from '../js/end.js';
import { doClassGenocide, doGenocide } from '../js/genocide.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { ATR_BOLD, NO_COLOR } from '../js/terminal.js';
import { C_ATR_BOLD } from '../js/color_attr.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshGameplayRoom } from './support/playable-room.js';
function recordSpecies(name, mvflags) {
    requireFixtureGame(game);
    const species = MONSTER_NAME.indexOf(name);
    const vital = game.mvitals[species];
    assert.ok(vital, `The monster history must include ${name}`);
    vital.mvflags = mvflags;
}
function visibleLines() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trim());
}
for (const kind of ['species', 'class']) {
    for (const answer of ['?', "'?'"]) {
        for (const populated of [false, true]) {
            void test(`${kind} genocide ${answer} shows ${populated ? 'previous genocides' : 'the empty message'} and resumes its prompt`, async () => {
                freshGameplayRoom({ flags: { debug: true } });
                // Even wizard-mode genocide prompts must conceal extinctions.
                recordSpecies('giant ant', G_EXTINCT);
                if (populated) {
                    recordSpecies('gnome', G_GENOD);
                    recordSpecies('lichen', G_GENOD | G_EXTINCT);
                }
                const input = resetInputState();
                const prompt = kind === 'species'
                    ? 'What type of monster do you want to genocide?'
                    : 'What class of monsters do you want to genocide?';
                const action = kind === 'species' ? doGenocide(1) : doClassGenocide();
                try {
                    await input.waitUntilBlocked();
                    input.feed(`${answer}\n`);
                    await input.waitUntilBlocked();
                    const lines = visibleLines();
                    if (populated) {
                        assert.equal(lines[0], 'Genocided species:');
                        assert.equal(lines[1], '');
                        assert.ok(lines.includes('gnomes'));
                        assert.ok(lines.includes('lichens'));
                        assert.ok(lines.includes('2 species genocided.'));
                        assert.ok(lines.includes('--More--'));
                        assert.ok(!lines.some(line => /extinct|giant ants/.test(line)));
                    }
                    else {
                        assert.equal(lines[0], 'No creatures have been genocided yet.--More--');
                        assert.ok(!lines.some(line => /species:/.test(line)));
                    }
                    input.feed(' ');
                    await input.waitUntilBlocked();
                    assert.equal(visibleLines()[0], prompt, 'listing does not consume a failed attempt');
                    input.feed('none\n');
                    assert.equal(await action, false, 'the resumed prompt still accepts declining genocide');
                    assert.equal(game.u.uconduct?.genocides ?? 0, 0);
                }
                finally {
                    input.feed('\x1b\x1b\x1b\x1b');
                    await action;
                }
            });
        }
    }
}
for (const mode of ['normal', 'wizard', 'explore', 'gameover']) {
    void test(`${mode} listing ${mode === 'normal' ? 'conceals' : 'reveals'} extinctions and counts each species once`, async () => {
        freshGameplayRoom({ flags: { debug: mode === 'wizard', explore: mode === 'explore' } });
        game.program_state.gameover = mode === 'gameover';
        recordSpecies('gnome', G_GENOD | G_EXTINCT);
        recordSpecies('giant ant', G_EXTINCT);
        recordSpecies('Medusa', G_EXTINCT);
        const input = resetInputState();
        const listing = listGenocided();
        try {
            await input.waitUntilBlocked();
            const lines = visibleLines();
            assert.equal(lines[0], mode === 'normal' ? 'Genocided species:' : 'Genocided or extinct species:');
            assert.ok(lines.includes('gnomes'), 'genocide takes precedence over the extinct mark');
            assert.ok(lines.includes('1 species genocided.'));
            if (mode === 'normal') {
                assert.ok(!lines.some(line => /extinct|giant ants/.test(line)));
            }
            else {
                assert.ok(lines.includes('giant ants (extinct)'));
                assert.ok(lines.includes('1 species extinct.'));
            }
            assert.ok(!lines.some(line => /Medusa/.test(line)), 'unique creatures are never listed as extinct');
        }
        finally {
            input.feed(' ');
            await listing;
        }
    });
}
void test('an extinct-only wizard listing uses the extinct heading and total', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    recordSpecies('erinys', G_EXTINCT);
    const input = resetInputState();
    const listing = listGenocided();
    try {
        await input.waitUntilBlocked();
        const lines = visibleLines();
        assert.equal(lines[0], 'Extinct species:');
        assert.ok(lines.includes('erinyes (extinct)'));
        assert.ok(lines.includes('1 species extinct.'));
        assert.ok(!lines.some(line => /genocided/.test(line)));
    }
    finally {
        input.feed(' ');
        await listing;
    }
});
for (const order of [6, 7]) {
    void test(`genocide listing replaces count order ${order} with alphabetical order without changing the preference`, async () => {
        freshGameplayRoom({ flags: { vanqSortmode: order } });
        recordSpecies('gnome', G_GENOD);
        recordSpecies('gnome leader', G_GENOD);
        const input = resetInputState();
        const listing = listGenocided('g');
        try {
            await input.waitUntilBlocked();
            const lines = visibleLines();
            const gnomes = lines.indexOf('gnomes');
            assert.ok(gnomes >= 0, 'the list includes gnomes');
            assert.ok(lines.indexOf('gnome leaders') > gnomes, 'gnomes precede gnome leaders alphabetically');
            assert.equal(game.flags.vanqSortmode, order);
        }
        finally {
            input.feed(' ');
            await listing;
        }
    });
}
void test('genocide class ordering uses the configured heading style and low-to-high monster level', async () => {
    freshGameplayRoom({ flags: { vanqSortmode: 5 }, iflags: { menu_headings: { attr: C_ATR_BOLD, color: NO_COLOR } } });
    recordSpecies('gnome', G_GENOD);
    recordSpecies('gnome leader', G_GENOD);
    recordSpecies('giant ant', G_GENOD);
    const input = resetInputState();
    const listing = listGenocided('g');
    try {
        await input.waitUntilBlocked();
        const lines = visibleLines();
        assert.ok(lines.includes('Ant or other insect'));
        assert.ok(lines.includes('Gnome'));
        const ants = lines.indexOf('giant ants');
        const gnomes = lines.indexOf('gnomes');
        assert.ok(ants >= 0, 'the list includes giant ants');
        assert.ok(gnomes > ants, 'the ant class precedes the gnome class');
        assert.ok(lines.indexOf('gnome leaders') > gnomes, 'gnomes precede their higher-level leaders');
        const heading = requireGameDisplay().grid.find(row => row.map(cell => cell.ch).join('').trim() === 'Gnome');
        assert.equal(heading?.find(cell => cell.ch === 'G')?.attr, ATR_BOLD);
    }
    finally {
        input.feed(' ');
        await listing;
    }
});
for (const species of ['none', 'genocided', 'extinct', 'both']) {
    void test(`the ${species} dumplog listing returns its native rows without waiting for terminal input`, async () => {
        freshGameplayRoom();
        game.program_state.gameover = true;
        if (species === 'genocided' || species === 'both')
            recordSpecies('gnome', G_GENOD | G_EXTINCT);
        if (species === 'extinct' || species === 'both')
            recordSpecies('giant ant', G_EXTINCT);
        recordSpecies('Medusa', G_EXTINCT);
        const input = resetInputState();
        let askedForInput = false;
        // Dismiss an erroneous tty window so that a regression fails instead of hanging.
        input.beforeRead = () => { askedForInput = true; input.feed(27); };
        const lines = await listGenocided('d', false);
        assert.equal(askedForInput, false, 'dump windows must not ask for keyboard input');
        assert.ok(lines, 'dump output must be available to its writer');
        if (species === 'none') {
            assert.ok(lines.includes('No species were genocided or became extinct.'));
        }
        else {
            assert.equal(lines[0], species === 'both' ? 'Genocided or extinct species:'
                : species === 'genocided' ? 'Genocided species:' : 'Extinct species:');
            assert.ok(!lines.includes(''), 'dumplog omits the interactive window separator rows');
            if (species === 'genocided' || species === 'both') {
                assert.ok(lines.includes(' gnomes'));
                assert.ok(lines.includes('1 species genocided.'));
            }
            if (species === 'extinct' || species === 'both') {
                assert.ok(lines.includes(' giant ants (extinct)'));
                assert.ok(lines.includes('1 species extinct.'));
            }
        }
        assert.ok(!lines.some(line => /Medusa|--More--/.test(line)));
    });
}
//# sourceMappingURL=genocide_listing.test.js.map