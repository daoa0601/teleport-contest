import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOM, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { hasPermanentIntrinsicProperty, propertyTimeout } from '../js/properties.js';
import { monsterGoldAmount } from '../js/shop_money.js';
import { initRng } from '../js/rng.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { rhack } from '../js/cmd.js';
import { clearMessageWindow } from '../js/display.js';
import { dosave, saveGame, restoreGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { restoreBonesMonsters } from '../js/bones_monster.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createRoom } from './support/topology.js';

async function templePriest() {
    const level = freshObjectRoom({ hero: { ulevelpeak: 1 } });
    requirePlayingGame(game);
    const room = createRoom({ lx: 7, hx: 16, ly: 6, hy: 14, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE | Align2amask(0);
    const priest = await createMonsterAt('aligned cleric', 11, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.mpeaceful = 1;
    priest.msleeping = 0;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 12, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(2);
    return priest;
}

void test('a sleeping priest wakes and becomes angry when chatted with', async () => {
    const priest = await templePriest();
    priest.msleeping = 1;

    await runExtendedCommand('chat', 'l');

    assert.equal(priest.msleeping, 0);
    assert.equal(priest.mcanmove, 1);
    assert.equal(priest.mpeaceful, 0);
    assert.equal(game.u.uconduct?.gnostic, 1);
    assert.equal(game.context.move, 1);
});

void test('a priest whose shrine was destroyed refuses donations and becomes hostile', async () => {
    const priest = await templePriest();
    requirePlayingGame(game);
    game.level.requireAt(12, 10).flags = Align2amask(0);
    setHeroGoldAmount(game, 1000);

    await runExtendedCommand('chat', 'l');

    assert.equal(priest.mpeaceful, 0);
    assert.equal(heroGoldAmount(game), 1000);
    assert.match(game._lastPlineMessage ?? '', /Thou wouldst have words|Here is what I have to say|speak no longer/);
});

void test('refusing a temple donation costs alignment and leaves the purse intact', async () => {
    await templePriest();
    setHeroGoldAmount(game, 1000);

    await runExtendedCommand('chat', 'l 0\n');

    assert.equal(game.u.ualign?.record, -1);
    assert.equal(heroGoldAmount(game), 1000);
    assert.equal(game._lastPlineMessage, '"Thou shalt regret thine action!"');
});

void test('a substantial donation grants intrinsic protection and pays the priest', async () => {
    const priest = await templePriest();
    setHeroGoldAmount(game, 1000);

    await runExtendedCommand('chat', 'l 500\n');

    assert.equal(heroGoldAmount(game), 500);
    assert.equal(monsterGoldAmount(priest), 500);
    assert.ok(hasPermanentIntrinsicProperty('protection', game));
    assert.ok((game.u.ublessed ?? 0) >= 2);
});

void test('a pious donation grants temporary clairvoyance', async () => {
    await templePriest();
    setHeroGoldAmount(game, 400);

    await runExtendedCommand('chat', 'l 250\n');

    assert.ok(propertyTimeout('clairvoyant', game) >= 500);
    assert.equal(heroGoldAmount(game), 150);
});

void test('a monster in a coaligned cleric form rejects a hero who has strayed', async () => {
    freshObjectRoom({ hero: { ualign: { type: 0, record: -1 } } });
    const priest = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    const changed = await changeMonsterForm(priest, MONSTER_NAME.indexOf('aligned cleric'));
    assert.ok(changed);
    priest.mpeaceful = 1;

    await runExtendedCommand('chat', 'l');

    assert.match(game._pending_message, /doesn't want anything to do with you!$/);
    assert.equal(priest.mpeaceful, 0);
});

void test('a restored priest gives fresh temple-entry feedback despite a recent visit', async () => {
    const priest = await templePriest();
    assert.ok(priest.epri);
    priest.epri.intone_time = priest.epri.enter_time = priest.epri.peaceful_time = 10000;
    game.plname = 'TempleVisitor';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('TempleVisitor', storage), true);
    game.u.ux = 6;
    game.u.urooms = [];
    clearMessageWindow();
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    await rhack('l'.charCodeAt(0));

    assert.match(game._lastPlineMessage, /You experience an unusual sense of peace/);
});

void test('refusing to overwrite a save preserves the recent temple visit', async () => {
    await templePriest();
    requirePlayingGame(game);
    game.plname = 'TempleVisitor';
    game.storage = memoryStorage();
    assert.equal(await saveGame(), true);
    game.program_state.something_worth_saving = true;
    game.level.requireAt(6, 10).typ = ROOM;
    game.u.ux = 6;
    game.u.urooms = [];

    await rhack('l'.charCodeAt(0));
    assert.match(game._lastPlineMessage, /You experience an unusual sense of peace/);
    await rhack('h'.charCodeAt(0));
    assert.equal(game.u.ux, 6, 'The hero must leave the temple before saving');
    const input = resetInputState();

    await answerPrompts(dosave(), input, [
        { prompt: /Really save\?/, keys: 'y' },
        { prompt: /There seems to be an old save file\.\s*--More--/, keys: ' ' },
        { prompt: /Overwrite the old file\?/, keys: 'n' },
    ]);
    assert.equal(!!game.program_state.gameover, false);
    clearMessageWindow();
    input.beforeRead = () => input.feed(' ');
    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 7, 'The hero must re-enter the temple');
    assert.equal(game._pending_message, '', 'A recent visit must suppress repeated priest feedback');
});

void test('a bones priest accepts donations at its shrine on the restored dungeon level', async () => {
    const priest = await templePriest();
    requirePlayingGame(game);
    assert.ok(priest.epri);
    priest.epri.shrlevel = { dnum: 9, dlevel: 40 };
    setHeroGoldAmount(game, 1000);

    await restoreBonesMonsters(game.level, game);
    await runExtendedCommand('chat', 'l 0\n');

    assert.equal(priest.mpeaceful, 1);
    assert.equal(game._lastPlineMessage, '"Thou shalt regret thine action!"');
});
