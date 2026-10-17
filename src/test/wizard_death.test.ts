import test from 'node:test';
import assert from 'node:assert/strict';
import { MIGR_RANDOM, NO_MINVENT, W_AMUL } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { flush_screen } from '../js/display.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { migrateMonsterOffLevel } from '../js/monster_migration.js';
import { monsterDeathCount } from '../js/monster_vitals.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { resurrectWizard } from '../js/wizard.js';
import { knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a resurrected Wizard announces his threat without repeating his birth announcement', async () => {
    freshObjectRoom({ moves: 5000 });
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd());
        input.feed(' ');
    };

    const wizard = await resurrectWizard();
    await flush_screen();
    messages.push(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd());

    assert.ok(wizard);
    assert.ok(messages.some(message => message.includes('So thou thought thou couldst kill me, fool.')),
        `Expected the Wizard's threat; saw ${messages.join(' | ')}`);
    assert.equal(messages.filter(message => message.includes('suddenly appears next to you')).length, 1,
        `Expected one visible birth announcement: ${messages.join(' | ')}`);
});

void test('an environmental Wizard death starts demigod intervention and removes his population count', async () => {
    freshObjectRoom();
    const wizard = await createMonsterAt('Wizard of Yendor', 12, 10, NO_MINVENT);
    assert.equal(game.context.no_of_wizards, 1);
    wizard.mhp = 0;

    const death = await finishEnvironmentalMonsterDeath(wizard, game, { noCorpse: true });

    assert.equal(death.survived, false);
    assert.equal(requireGameLevel().monsters.includes(wizard), false);
    assert.equal(game.context.no_of_wizards, 0);
    assert.equal(!!game.u.uevent?.udemigod, true);
    const countdown = game.u.udg_cnt;
    assert.ok(countdown !== undefined && countdown >= 50 && countdown <= 299);
});

void test('hero kills of multiple Wizards decrease the count without restarting intervention', async () => {
    freshObjectRoom({ hero: { ulevel: 30, ulevelmax: 30 } });
    const first = await createMonsterAt('Wizard of Yendor', 12, 10, NO_MINVENT);
    const second = await createMonsterAt('Wizard of Yendor', 13, 10, NO_MINVENT);
    assert.equal(game.context.no_of_wizards, 2);
    first.mhp = 0;

    assert.equal(await finishHeroMonsterKill(first, first.mx, first.my, {
        showKillMessage: false, noCorpse: true,
    }), true);

    assert.equal(game.context.no_of_wizards, 1);
    assert.equal(!!game.u.uevent?.udemigod, true);
    const countdown = game.u.udg_cnt;
    assert.ok(countdown !== undefined && countdown >= 50 && countdown <= 299);
    game.u.udg_cnt = 7;
    second.mhp = 0;

    assert.equal(await finishHeroMonsterKill(second, second.mx, second.my, {
        showKillMessage: false, noCorpse: true,
    }), true);

    assert.equal(game.context.no_of_wizards, 0);
    assert.equal(game.u.udg_cnt, 7);
});

void test('a Wizard leaving alive starts intervention without recording a death', async () => {
    freshObjectRoom();
    const wizard = await createMonsterAt('Wizard of Yendor', 12, 10, NO_MINVENT);
    const deaths = monsterDeathCount(wizard.mnum);
    assert.ok(wizard.mhp > 0);

    const departure = await removeMonsterFromGame(wizard);

    assert.equal(departure.removed, true);
    assert.equal(requireGameLevel().monsters.includes(wizard), false);
    assert.equal(game.context.no_of_wizards, 0);
    assert.equal(monsterDeathCount(wizard.mnum), deaths);
    assert.equal(!!game.u.uevent?.udemigod, true);
    const countdown = game.u.udg_cnt;
    assert.ok(countdown !== undefined && countdown >= 50 && countdown <= 299);
});

void test('a demigod countdown already in progress survives an environmental Wizard death', async () => {
    freshObjectRoom({ hero: { uevent: { udemigod: true }, udg_cnt: 1 } });
    const wizard = await createMonsterAt('Wizard of Yendor', 12, 10, NO_MINVENT);
    wizard.mhp = 0;

    await finishEnvironmentalMonsterDeath(wizard, game, { noCorpse: true });

    assert.equal(game.context.no_of_wizards, 0);
    assert.equal(game.u.udg_cnt, 1);
});

void test('life saving keeps the Wizard alive without starting demigod intervention', async () => {
    freshObjectRoom({ hero: { udg_cnt: 0 } });
    const wizard = await createMonsterAt('Wizard of Yendor', 12, 10, NO_MINVENT);
    const amulet = await equipMonsterObject(wizard, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const input = resetInputState();
    wizard.mhp = 0;

    const death = await answerPrompts(finishEnvironmentalMonsterDeath(wizard, game, { noCorpse: true }), input, [
        { prompt: /But wait\.\.\.  The Wizard of Yendor's medallion begins to glow!.*--More--/s, keys: ' ' },
        { prompt: /Wizard of Yendor looks much better!.*--More--/s, keys: ' ' },
    ]);

    assert.equal(death.survived, true);
    assert.ok(wizard.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.context.no_of_wizards, 1);
    assert.equal(!!game.u.uevent?.udemigod, false);
    assert.equal(game.u.udg_cnt, 0);
});

void test('killing a newly resurrected Wizard gives twenty points of alignment credit', async () => {
    freshObjectRoom({ moves: 5000, hero: { ulevel: 30, ulevelmax: 30 } });
    requirePlayingGame(game);
    resetInputState().feed('    ');

    const wizard = await resurrectWizard();
    assert.ok(wizard, 'resurrection should create the Wizard');
    assert.equal(wizard.mpeaceful, 0);
    await finishHeroMonsterKill(wizard, wizard.mx, wizard.my, {
        showKillMessage: false, noCorpse: true,
    });

    assert.equal(game.u.ualign.record, 20);
});

void test('killing a recalled migrating Wizard gives twenty points of alignment credit', async () => {
    freshObjectRoom({ moves: 5000, hero: { ulevel: 30, ulevelmax: 30 } });
    requirePlayingGame(game);
    const wizard = await createMonsterAt('Wizard of Yendor', 12, 10, NO_MINVENT);
    await migrateMonsterOffLevel(wizard, game, {
        dst: { dnum: 0, dlevel: 9 },
    }, { mode: MIGR_RANDOM });
    game.moves += 60;
    resetInputState().feed('    ');

    const recalled = await resurrectWizard();
    assert.equal(recalled, wizard);
    assert.equal(wizard.mpeaceful, 0);
    await finishHeroMonsterKill(wizard, wizard.mx, wizard.my, {
        showKillMessage: false, noCorpse: true,
    });

    assert.equal(game.u.ualign.record, 20);
});
