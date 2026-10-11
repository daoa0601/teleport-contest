import { loadScoreRecords } from '../js/score_records.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { LANDMINE, MM_ANGRY, MM_NOGRP, NO_MINVENT, W_AMUL } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import type { Monster } from '../js/monster_types.js';
import { damageHeroFromMonster, loseHeroHp } from '../js/hero_damage.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, ROCK } from '../js/object_data.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { restoreGame, saveGame } from '../js/save.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { addTrap } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';

function answerRecoveryMessages(messages: string[]) {
    const input = resetInputState();
    let replies = 0;
    let nextCommand: string | null = null;
    input.display = { async readKey() {
        assert.ok(game.nhDisplay);
        const screen = game.nhDisplay.grid
            .map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
        messages.push(screen);
        if (++replies > 100) throw new Error(`Recovery did not finish: ${screen}`);
        if (screen.includes('--More--')) return 32;
        const topline = game.nhDisplay.grid[0]?.map(cell => cell.ch).join('').trimEnd();
        if (topline?.endsWith('Die? [yn] (n)')) return 'n'.charCodeAt(0);
        if (nextCommand !== null) {
            assert.equal(game.nhDisplay.cursorCol, game.u.ux - 1,
                `Expected the command cursor after recovery: ${screen}`);
            assert.equal(game.nhDisplay.cursorRow, game.u.uy + 1,
                `Expected the command cursor after recovery: ${screen}`);
            const key = nextCommand.charCodeAt(0);
            nextCommand = null;
            return key;
        }
        assert.fail(`Unexpected recovery input: ${screen}`);
    } };
    return {
        input,
        async command(key: string): Promise<void> {
            assert.equal(nextCommand, null);
            nextCommand = key;
            await moveloop_core();
            assert.ok(nextCommand === null || game.program_state.gameover,
                'The intended hero command was not read.');
            nextCommand = null;
        },
    };
}

async function captureHero(messages: string[], trapType: number | null = null, { species = 'ice vortex', hp }: { species?: string; hp?: number } = {}) {
    freshTurnRoom({ role: 'barbarian', heroLevel: 1 });
    requirePlayingGame(game);
    if (hp !== undefined) game.u.uhp = game.u.uhpmax = hp;
    if (trapType !== null) addTrap(game.level, trapType, 10, 10);
    const monster = await createMonsterAt(species, 11, 10,
        MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monster.movement = 12;
    const recovery = answerRecoveryMessages(messages);
    initRng(2n);
    recovery.input.feed('m.');
    await moveloop_core();
    if (!game.u.uswallow) await recovery.command('\x1b');
    await flushPendingTopline();
    assert.equal(game.u.ustuck, monster, messages.join(' | '));
    assert.equal(game.u.uswallow, 1);
    return monster;
}

for (const cause of ['monster', 'other damage']) {
    for (const recovery of ['amulet', 'refused death']) {
        void test(`${recovery} expels the hero after fatal ${cause}`, async () => {
            const messages: string[] = [];
            const vortex = await captureHero(messages);
            requirePlayingGame(game);
            let amulet;
            if (recovery === 'amulet') {
                amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
                await wearHeroAccessory(amulet, 'uamul');
            } else game.flags.debug = true;
            game.u.uhp = 1;
            messages.length = 0;

            const died = cause === 'monster'
                ? await damageHeroFromMonster(vortex, 6)
                : await loseHeroHp(6, 'acid');
            await flushPendingTopline();

            assert.equal(died, false);
            assert.ok(game.u.uhp > 0);
            assert.equal(game.u.uswallow, 0);
            assert.equal(game.u.ustuck, null);
            assert.equal(game.u.uswldtim, 0);
            assert.equal(Math.max(Math.abs(vortex.mx - game.u.ux),
                Math.abs(vortex.my - game.u.uy)), 1);
            assert.ok((vortex.mspec_used ?? 0) > 0);
            assert.match(messages.join('\n'), /You get expelled from the ice vortex/);
            if (amulet) assert.equal(amulet.where, 'gone');
            else assert.match(messages.join('\n'),
                /OK, so you don't die[\s\S]*You get expelled/);
        });
    }
}

for (const cause of ['monster', 'other damage']) {
    void test(`fatal expulsion landing stops recovery from ${cause}`, async () => {
        const messages: string[] = [];
        const vortex = await captureHero(messages, LANDMINE);
        requirePlayingGame(game);
        assert.ok(requireGameLevel(game).traps.some(trap => trap.ttyp === LANDMINE
            && trap.tx === game.u.ux && trap.ty === game.u.uy),
        JSON.stringify({ x: game.u.ux, y: game.u.uy, traps: requireGameLevel(game).traps }));
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
        await wearHeroAccessory(amulet, 'uamul');
        game.u.uhp = 1;
        game.u.uhpmax = 10;
        game.u.urexp = 100;
        game.storage = memoryStorage();
        game.flags.disclose = '-i -a -v -c -o';
        initRng(3n);

        const died = cause === 'monster'
            ? await damageHeroFromMonster(vortex, 6)
            : await loseHeroHp(6, 'acid');

        assert.equal(died, true, messages.join(' | '));
        assert.equal(game.program_state.gameover, true);
        assert.equal(game.u.uswallow, 0);
        assert.equal(game.u.umortality, 2);
        assert.equal(amulet.where, 'gone');
        const scores = loadScoreRecords(game);
        assert.ok(scores[0]);
        assert.match(scores[0].death, /land mine/);
    });
}

for (const recovery of ['amulet', 'refused death']) {
    void test(`${recovery} frees a hero caught by a mimic without moving it`, async () => {
        freshTurnRoom({ role: 'barbarian' });
        requirePlayingGame(game);
        const messages: string[] = [];
        answerRecoveryMessages(messages);
        const mimic = await createMonsterAt('large mimic', 11, 10,
            MM_ANGRY | MM_NOGRP | NO_MINVENT);
        await rhack('l'.charCodeAt(0));
        assert.equal(game.u.ustuck, mimic);
        assert.ok(!game.u.uswallow);
        if (recovery === 'amulet') {
            const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        } else game.flags.debug = true;
        const { mx, my } = mimic;
        game.u.uhp = 1;

        assert.equal(await damageHeroFromMonster(mimic, 6), false);
        await flushPendingTopline();

        assert.equal(game.u.ustuck, null);
        assert.equal(mimic.mx, mx);
        assert.equal(mimic.my, my);
        assert.ok((mimic.mspec_used ?? 0) > 0);
        assert.match(messages.join('\n'), /The large mimic releases you\./);
    });
}

for (const { seed, lifeSavedInside, holderHp } of [
    { seed: 6n, lifeSavedInside: true, holderHp: 8 },
    { seed: 2n, lifeSavedInside: false, holderHp: 100 },
]) {
    void test(`a landing explosion affects the map after ${lifeSavedInside ? 'life saving expels the hero' : 'timed expulsion'}`, async () => {
        const messages: string[] = [];
        const vortex = await captureHero(messages, LANDMINE);
        requirePlayingGame(game);
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
        await wearHeroAccessory(amulet, 'uamul');
        game.u.uhp = 1;
        game.u.uhpmax = 200;
        vortex.mhp = holderHp;
        vortex.mhpmax = 100;
        const spore = await createMonsterAt('gas spore', 9, 10,
            MM_ANGRY | MM_NOGRP | NO_MINVENT);
        spore.msleeping = 1;
        spore.mhp = 1;
        await floorObject(ROCK, 10, 10, { quan: 25 });
        const recovery = answerRecoveryMessages(messages);
        initRng(seed);

        for (let turn = 0; turn < 3 && amulet.where !== 'gone'; turn++) {
            await recovery.command('.');
        }
        await flushPendingTopline();

        const text = messages.join('\n');
        assert.equal(amulet.where, 'gone', text);
        assert.equal(spore.dead, true, text);
        assert.ok(game.u.uhp > 0);
        assert.equal(game.u.uswallow, 0);
        const blastDistance = Math.max(Math.abs(vortex.mx - spore.mx),
            Math.abs(vortex.my - spore.my));
        const geometry = `Spore at ${spore.mx},${spore.my}; released vortex at ${vortex.mx},${vortex.my}, HP ${vortex.mhp}`;
        assert.equal(game.u.uconduct?.killer, 1);
        assert.equal(!!vortex.dead, false, geometry);
        assert.match(text, /Boom!/);
        assert.doesNotMatch(text, /indigestion|rips open!/);
        if (lifeSavedInside) {
            assert.match(text, /medallion[\s\S]*get expelled[\s\S]*Boom!/);
            assert.ok(blastDistance > 1, geometry);
            assert.equal(vortex.mhp, holderHp, geometry);
        } else {
            assert.match(text, /get expelled[\s\S]*medallion/);
            assert.ok(vortex.mhp > 0 && vortex.mhp < holderHp, geometry);
        }

        // Later deaths use the map again, both before and after save/restore.
        for (const restored of [false, true]) {
            if (restored) {
                const storage = memoryStorage();
                game.plname = 'EngulfRecovery';
                assert.equal(await saveGame(storage), true);
                assert.equal(restoreGame('EngulfRecovery', storage), true);
            }
            messages.length = 0;
            answerRecoveryMessages(messages);
            const laterSpore = await createMonsterAt('gas spore', 15, 10,
                MM_ANGRY | MM_NOGRP | NO_MINVENT);
            const holder: Monster | undefined = requireGameLevel(game).monsters.find(monster => monster.m_id === vortex.m_id);
            assert.ok(holder, 'The released vortex remains on the level.');
            const holderHp: number | undefined = holder?.mhp;
            await finishEnvironmentalMonsterDeath(laterSpore, game);
            await flushPendingTopline();
            assert.equal(laterSpore.dead, true);
            assert.equal(holder?.mhp, holderHp);
            assert.equal(game.u.uconduct?.killer, 1);
            assert.match(messages.join('\n'), /Boom!/);
            assert.doesNotMatch(messages.join('\n'), /indigestion/);
        }
    });
}

void test('a released swallower outside the landing blast keeps its own amulet', async () => {
    const messages: string[] = [];
    const trapper = await captureHero(messages, LANDMINE, { species: 'trapper', hp: 500 });
    const heroAmulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(heroAmulet, 'uamul');
    const monsterAmulet = await knownObject(AMULET_OF_LIFE_SAVING);
    await equipMonsterObject(trapper, monsterAmulet, W_AMUL);
    game.u.uhp = 1;
    game.u.uhpmax = 200;
    game.u.uswldtim = 6;
    trapper.mhp = 8;
    trapper.mhpmax = 100;
    const spore = await createMonsterAt('gas spore', 9, 10,
        MM_ANGRY | MM_NOGRP | NO_MINVENT);
    spore.msleeping = 1;
    spore.mhp = 1;
    await floorObject(ROCK, 10, 10, { quan: 25 });
    const recovery = answerRecoveryMessages(messages);
    initRng(11n);

    for (let turn = 0; turn < 3 && heroAmulet.where !== 'gone'; turn++) {
        await recovery.command('.');
    }
    await flushPendingTopline();

    const text = messages.join('\n');
    assert.equal(heroAmulet.where, 'gone', text);
    assert.equal(monsterAmulet.where, 'minvent', text);
    assert.equal(spore.dead, true);
    assert.ok(!trapper.dead && trapper.mhp > 0);
    assert.ok(requireGameLevel(game).monsters.includes(trapper));
    assert.equal(game.u.uswallow, 0);
    assert.ok(game.u.uhp > 0);
    assert.equal(game.u.uconduct?.killer, 1);
    const blastDistance = Math.max(Math.abs(trapper.mx - spore.mx),
        Math.abs(trapper.my - spore.my));
    const geometry = `Spore at ${spore.mx},${spore.my}; released trapper at ${trapper.mx},${trapper.my}, HP ${trapper.mhp}`;
    assert.ok(blastDistance > 1, geometry);
    assert.equal(trapper.mhp, 8, geometry);
    assert.ok(trapper.minvent?.includes(monsterAmulet));
    assert.match(text, /unfolds and you are released![\s\S]*Boom!/);
    assert.doesNotMatch(text, /trapper's medallion|indigestion|rips open/);
});
