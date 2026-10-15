import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { flushPendingTopline } from '../js/display.js';
import { monsterGoldAmount } from '../js/shop_money.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { saveGame, restoreGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';

async function oracleWithGold(gold: number) {
    freshObjectRoom({ hero: { uexp: 0 } });
    const oracle = await createMonsterAt('Oracle', 11, 10);
    oracle.mpeaceful = 1;
    oracle.msleeping = 0;
    setHeroGoldAmount(game, gold);
    const pages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
    };
    input.display = { async readKey() { return 32; } };
    return { oracle, pages };
}

void test('a minor Oracle consultation transfers fifty gold and grants experience once', async () => {
    const { oracle } = await oracleWithGold(150);

    await runExtendedCommand('chat', 'ly');

    assert.equal(heroGoldAmount(game), 100);
    assert.equal(monsterGoldAmount(oracle), 50);
    assert.equal(game.u.uexp, 5);
    assert.equal(game.context.move, 1);
    await flushPendingTopline();
    await runExtendedCommand('chat', 'ly');
    assert.equal(heroGoldAmount(game), 50);
    assert.equal(game.u.uexp, 5);
});

void test('an underpaid major consultation takes the purse and gives the special oracle without experience', async () => {
    const { oracle, pages } = await oracleWithGold(100);

    await runExtendedCommand('chat', 'lny');

    assert.equal(heroGoldAmount(game), 0);
    assert.equal(monsterGoldAmount(oracle), 100);
    assert.equal(game.u.uexp, 0);
    assert.match(pages.join('\n'), /scornfully takes all your gold/);
    assert.match(pages.join('\n'), /Theorem 7.18/);
    assert.equal(game.context.move, 1);
});

void test('refusing consultation takes no turn and no gold', async () => {
    await oracleWithGold(100);

    await runExtendedCommand('chat', 'lq');

    assert.equal(heroGoldAmount(game), 100);
    assert.equal(game.context.move, 0);
});

void test('a paid major consultation grants its reward once, including after save and restore', async () => {
    await oracleWithGold(3000);
    game.plname = 'Consultation';

    await runExtendedCommand('chat', 'lny');

    assert.equal(heroGoldAmount(game), 2100);
    assert.equal(game.u.uexp, 90);
    assert.equal(game.u.urexp, 378);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    const input = resetInputState();
    input.display = { async readKey() { return 32; } };
    await runExtendedCommand('chat', 'lny');
    assert.equal(heroGoldAmount(game), 1200);
    assert.equal(game.u.uexp, 90);
    await runExtendedCommand('chat', 'ly');
    assert.equal(game.u.uexp, 92);
});

void test('major consultations exhaust their advice without repeating it and then stop offering it', async () => {
    const { pages } = await oracleWithGold(20000);
    const advice: string[] = [];
    for (let consultation = 0; consultation < 20; consultation++) {
        pages.length = 0;
        await runExtendedCommand('chat', 'lny');
        const page = pages.find(text => text.includes('meditates for a moment'));
        assert.ok(page, `Major consultation ${consultation + 1} did not display advice`);
        advice.push(page);
    }
    assert.equal(new Set(advice).size, 20);
    const money = heroGoldAmount(game);

    await runExtendedCommand('chat', 'ln');

    assert.equal(heroGoldAmount(game), money);
    assert.equal(game.context.move, 0);
});
