import assert from 'node:assert/strict';
import test from 'node:test';
import { ICE, LAVAPOOL, POOL, TIMEOUT, TT_LAVA } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { heroLiquidEffects, sinkHeroIntoLava } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { floatHeroDown } from '../js/terrain_movement.js';
import { freshObjectRoom } from './support/object-room.js';
import { wearHeroArmor, findArmorClass } from '../js/armor.js';
import { LEATHER_ARMOR, POT_WATER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';

void test('lava destroys armor while keeping its cached AC through the death refusal question', async () => {
    const level = freshObjectRoom({ flags: { debug: true, bones: false } });
    const armor = await addInventoryObject(LEATHER_ARMOR, { spe: 0 });
    wearHeroArmor(armor);
    assert.equal(findArmorClass(), 8);
    level.requireAt(10, 10).typ = LAVAPOOL;
    const input = resetInputState();
    let questionAC: number | undefined;
    input.beforeRead = () => {
        if (game._pending_message.startsWith('Die?')) {
            questionAC = game.u.uac;
            input.feed('n');
        } else input.feed(' ');
    };

    await heroLiquidEffects();

    assert.equal(game.inventory.includes(armor), false);
    assert.equal(game.uarm, null);
    assert.equal(questionAC, 8);
});

void test('a wizard who declines lava death recovers and teleports to safety', async () => {
    const level = freshObjectRoom({ flags: { debug: true, bones: false, disclose: '-i -a -v -g -c -o' } });
    level.requireAt(10, 10).typ = LAVAPOOL;
    const input = resetInputState();
    const burning = heroLiquidEffects();
    await input.waitUntilBlocked();
    input.feed(' ');
    await input.waitUntilBlocked();
    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    try {
        assert.match(text, /Die\? \[yn\]/);
        input.feed('n');
        const result = await burning;
        assert.ok(result?.entered);
        assert.equal(result.died, false);
        assert.equal(!!game.program_state.gameover, false);
        assert.notEqual(level.requireAt(game.u.ux, game.u.uy).typ, LAVAPOOL);
        assert.ok((game.u.uhp ?? 0) > 0);
    } finally {
        input.feed(' '.repeat(20));
        await burning;
    }
});

function refuseLiquidDeaths() {
    const input = resetInputState();
    let refusals = 0;
    input.display = {
        async readKey() {
            const text = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (text.includes('--More--')) return ' '.charCodeAt(0);
            assert.match(text, /Die\? \[yn\]/, 'Liquid recovery must ask whether to die');
            assert.ok(++refusals <= 2, 'Liquid recovery must stop after two death refusals');
            return 'n'.charCodeAt(0);
        },
    };
    return () => refusals;
}

for (const mode of ['debug', 'explore'] as const) {
    for (const cause of ['sinking', 'drowning'] as const) {
        void test(`${mode} death refusal rescues a ${cause} hero to dry ground`, async () => {
            const level = freshObjectRoom({ flags: { [mode]: true, bones: false } });
            const { ux, uy } = game.u;
            for (let x = ux - 1; x <= ux + 1; x++) {
                for (let y = uy - 1; y <= uy + 1; y++)
                    level.requireAt(x, y).typ = cause === 'sinking' ? LAVAPOOL : POOL;
            }
            if (cause === 'sinking') {
                game.u.fireResistance = true;
                game.u.utrap = 1 << 8;
                game.u.utraptype = TT_LAVA;
            }
            const refusals = refuseLiquidDeaths();

            const result = cause === 'sinking'
                ? await sinkHeroIntoLava() : await heroLiquidEffects();

            assert.equal(result?.died, false, 'Declining death must report survival');
            assert.equal(!!game.program_state.gameover, false);
            assert.equal(refusals(), 1);
            assert.ok((game.u.uhp ?? 0) > 0);
            assert.notEqual(level.requireAt(game.u.ux, game.u.uy).typ,
                cause === 'sinking' ? LAVAPOOL : POOL, 'Recovery must leave the fatal liquid');
            assert.equal(game.u.utrap ?? 0, 0);
            assert.equal(game.u.uinwater ?? 0, 0);
            if (cause === 'drowning')
                assert.match(game._pending_message ?? '', /You find yourself on solid ground\./);
        });
    }
}

void test('two drowning refusals survive even when the level has no dry landing', async () => {
    const level = freshObjectRoom({ flags: { explore: true, bones: false } });
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = POOL;
    }
    const refusals = refuseLiquidDeaths();

    const result = await heroLiquidEffects();

    assert.equal(result?.died, false);
    assert.equal(refusals(), 2);
    assert.equal(!!game.program_state.gameover, false);
    assert.ok((game.u.uhp ?? 0) > 0);
    assert.equal(game.u.uinwater, 0);
    assert.match(game._pending_message ?? '', /You find yourself on top of water\./);
});

for (const mode of ['debug', 'explore'] as const) {
    void test(`${mode} drowning rescue ends levitation landing feedback without a dry destination`, async () => {
        const level = freshObjectRoom({ flags: { [mode]: true, bones: false } });
        for (let x = 7; x <= 16; x++) {
            for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = POOL;
        }
        const { ux, uy } = game.u;
        game.u.levitationTurns = 1;
        const refusals = refuseLiquidDeaths();

        await floatHeroDown(TIMEOUT, 0);

        assert.equal(refusals(), 2);
        assert.equal(!!game.program_state.gameover, false);
        assert.equal(game.u.ux, ux);
        assert.equal(game.u.uy, uy);
        assert.equal(game.u.uinwater, 0);
        assert.match(game._pending_message ?? '', /You find yourself on top of water\./);
        assert.doesNotMatch(game._pending_message ?? '', /You float gently/);
    });
}

void test('drowning recovery describes the ice at its landing square', async () => {
    const level = freshObjectRoom({ flags: { explore: true, bones: false } });
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = ICE;
    }
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) level.requireAt(x, y).typ = POOL;
    }
    refuseLiquidDeaths();

    const result = await heroLiquidEffects();

    assert.equal(result?.died, false);
    assert.equal(level.requireAt(game.u.ux, game.u.uy).typ, ICE);
    assert.match(game._pending_message ?? '', /You find yourself on solid ice\./);
});

for (const hallucinating of [false, true]) {
    void test(`drowning rescue onto lava describes the surface ${hallucinating ? 'with' : 'without'} hallucination`, async () => {
        const level = freshObjectRoom({
            gameplaySeed: 42,
            flags: { explore: true, bones: false },
            hero: {
                umonnum: MONSTER_NAME.indexOf('salamander'),
                mtimedone: 100,
                mh: 40,
                mhmax: 40,
                hallucinationTurns: hallucinating ? 100 : 0,
            },
        });
        for (let x = 7; x <= 16; x++) {
            for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = LAVAPOOL;
        }
        level.requireAt(game.u.ux, game.u.uy).typ = POOL;
        // goodpos() lets a lava-loving form crawl onto lava; a paralyzed
        // hero cannot crawl at all and drowns into the rescue.
        game._helplessTurns = 5;
        const messages: string[] = [];
        const refusals = refuseLiquidDeaths();

        const result = await heroLiquidEffects({
            publish: async message => { messages.push(message); },
        });

        assert.equal(result?.died, false);
        assert.equal(refusals(), 1);
        assert.equal(level.requireAt(game.u.ux, game.u.uy).typ, LAVAPOOL);
        const rescue = messages.find(message => message.startsWith('You find yourself'));
        assert.ok(rescue, 'The rescue must describe its landing square');
        if (hallucinating)
            assert.match(rescue, /^You find yourself in (a|an) .+\.$/);
        else
            assert.equal(rescue, 'You find yourself on the lava.');
    });
}

// C lava_effects() -> destroy_items(): a boiling potion's damage goes through
// losehp(), which says "You die..." before done() asks the wizard "Die?".
void test('a potion boiling in lava kills a fire-resistant hero with the ordinary death line', async () => {
    const level = freshObjectRoom({ flags: { debug: true, bones: false } });
    level.requireAt(10, 10).typ = LAVAPOOL;
    game.u.fireResistance = true;
    game.u.uhp = 1;
    await addInventoryObject(POT_WATER, { quan: 20, blessed: true });
    const screens: string[] = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            const text = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
            screens.push(text.trim());
            return (text.includes('Die?') ? 'n' : ' ').charCodeAt(0);
        },
    };

    await heroLiquidEffects();

    const dieQuestion = screens.findIndex(text => text.startsWith('Die?'));
    assert.ok(dieQuestion > 0, screens.join(' | '));
    assert.match(screens[dieQuestion - 1] ?? '', /You die\.\.\./);
});
