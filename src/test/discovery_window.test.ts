import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { zapHeroWithObject } from '../js/hero_self_zap.js';
import { resetInputState } from '../js/input.js';
import { dodiscovered } from '../js/o_init.js';
import {
    DAGGER, FOOD_RATION, LEATHER_ARMOR, LEATHER_GLOVES, MAGIC_HARP,
    POT_BOOZE, POT_FRUIT_JUICE, POT_FULL_HEALING, POT_HEALING, POT_SICKNESS,
    POT_WATER, RIN_PROTECTION, SACK, SCR_IDENTIFY, WAN_CANCELLATION, WOODEN_HARP,
} from '../js/object_data.js';
import { learnObjectType, recordObjectEncounter, recordObjectKnowledge } from '../js/o_init.js';
import { recordObjectCall } from '../js/do_name.js';
import { recordObjectPriceQuote } from '../js/shk.js';

import { objectName } from '../js/objnam.js';
import { restoreGame, saveGame } from '../js/save.js';
import { changeTutorialState } from '../js/tutorial_state.js';
import { vision_reset } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoomLevel } from './support/playable-room.js';
import { completeHeroStartup } from './support/startup.js';
import type { HeroStartupOptions } from './support/startup.js';

async function startHero(options: HeroStartupOptions): Promise<void> {
    await completeHeroStartup(options);
    game.level = createRoomLevel();
    game.u.ux = game.u.ux0 = 10;
    game.u.uy = game.u.uy0 = 10;
    game.nhDisplay = new GameDisplay(null);
    vision_reset();
}

async function discoveryLines(): Promise<string[]> {
    const input = resetInputState();
    const lines: string[] = [];
    let pages = 0;
    input.display = {
        async readKey(): Promise<number> {
            const rows = requireGameDisplay().grid.map(row =>
                row.map(cell => cell.ch).join('').trimEnd());
            assert.match(rows.at(-1) || '', /--More--/);
            assert.ok(++pages <= 8, 'Discoveries must finish within eight pages');
            lines.push(...rows.slice(0, -1));
            return ' '.charCodeAt(0);
        },
    };
    try {
        await dodiscovered();
    } finally {
        input.display = null;
    }
    assert.ok(pages > 0, 'The discoveries command must display its window');
    return lines;
}

void test('Samurai startup explains Japanese names even without an alternate appearance', async () => {
    await startHero({ role: 'samurai', alignment: 'lawful' });

    const lines = await discoveryLines();

    assert.ok(lines.includes('* osaku [lock pick]'));
    assert.ok(lines.some(line => line.endsWith('gunyoki [food ration]')));
    assert.ok(lines.includes('* koto [wooden harp] (koto)'));
    assert.ok(lines.includes(
        `* pair of yugake [leather gloves] (${game.objectDescriptions?.[LEATHER_GLOVES]})`,
    ));
    assert.equal(lines.some(line => line.includes('magic koto')), false);
});

void test('only Samurai discoveries use Japanese names', async () => {
    await freshObjectRoom({ role: 'caveman' });
    recordObjectKnowledge(WOODEN_HARP);

    const lines = await discoveryLines();

    assert.ok(lines.includes('* wooden harp (harp)'));
    assert.equal(lines.some(line => line.includes('koto')), false);
});

void test('an unidentified Samurai harp can be called without revealing its magic identity', async () => {
    await freshObjectRoom({ role: 'samurai' });
    recordObjectEncounter(MAGIC_HARP);
    recordObjectCall(MAGIC_HARP, 'lullaby');

    const unknown = await discoveryLines();
    assert.ok(unknown.includes('  koto [harp] called lullaby'));
    assert.equal(unknown.some(line => line.includes('magic')), false);

    learnObjectType(MAGIC_HARP);

    const known = await discoveryLines();
    assert.ok(known.includes('  magic koto [magic harp] called lullaby (koto)'));
});

void test('known sake keeps its explanation before a called name and shuffled appearance', async () => {
    await freshObjectRoom({ role: 'samurai', objectInitializationSeed: 52891n });
    recordObjectKnowledge(POT_BOOZE);
    recordObjectCall(POT_BOOZE, 'nightcap');

    const lines = await discoveryLines();

    assert.ok(lines.includes(
        `* potion of sake [booze] called nightcap (${game.objectDescriptions?.[POT_BOOZE]})`,
    ));
});

void test('Healers preknow full healing while carried healing potions count as encountered', async () => {
    await startHero({ role: 'healer', alignment: 'neutral', seed: 52891n });

    const lines = await discoveryLines();

    assert.ok(lines.includes(`* potion of full healing (${game.objectDescriptions?.[POT_FULL_HEALING]})`));
    assert.ok(lines.includes(`  potion of healing (${game.objectDescriptions?.[POT_HEALING]})`));
    assert.ok(lines.findIndex(line => line.includes('potion of full healing'))
        < lines.findIndex(line => line.includes('potion of healing')),
        'Role preknowledge precedes later starting-inventory encounters');
});

void test('Rogues list their starting sack as encountered', async () => {
    await startHero({ role: 'rogue' });
    const sack = game.inventory.find(object => object.otyp === SACK);
    assert.ok(sack, 'A Rogue starts with a sack');

    const lines = await discoveryLines();

    assert.ok(lines.includes('  sack (bag)'));
});

void test('inventory after self-cancellation discovers fruit juice before water while displaying water first', async () => {
    await freshObjectRoom();
    const types = [DAGGER, LEATHER_ARMOR, RIN_PROTECTION, POT_HEALING,
        POT_SICKNESS, FOOD_RATION, SCR_IDENTIFY, WAN_CANCELLATION];
    for (const [index, type] of types.entries())
        await addInventoryObject(type, { invlet: String.fromCharCode(97 + index) });
    const wand = game.inventory.find(object => object.otyp === WAN_CANCELLATION);
    assert.ok(wand, 'The hero carries a wand of cancellation');
    await zapHeroWithObject(wand);
    assert.equal(game.inventory.find(object => object.invlet === 'd')?.otyp, POT_WATER);
    assert.equal(game.inventory.find(object => object.invlet === 'e')?.otyp, POT_FRUIT_JUICE);

    const input = resetInputState();
    let inventory = '';
    input.display = {
        async readKey(): Promise<number> {
            inventory += requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            return 32;
        },
    };
    try {
        await rhack('i'.charCodeAt(0));
    } finally {
        input.display = null;
    }
    assert.match(inventory, /d - an uncursed clear potion/);
    const juiceAppearance = game.objectDescriptions?.[POT_FRUIT_JUICE];
    assert.ok(inventory.indexOf('d - an uncursed clear potion')
        < inventory.indexOf(`e - an uncursed ${juiceAppearance} potion`));

    const discoveries = await discoveryLines();
    const juice = discoveries.indexOf(`  potion (${juiceAppearance})`);
    const water = discoveries.indexOf('  potion (clear)');
    assert.ok(juice >= 0, 'The inventory menu encounters the cancelled fruit juice');
    assert.ok(water > juice, 'Water follows fruit juice in discovery order');
});

void test('a shop quote remembers the price without reserving a discovery position', async () => {
    await freshObjectRoom();
    recordObjectPriceQuote(POT_WATER, 8);
    recordObjectEncounter(POT_HEALING);
    recordObjectEncounter(POT_WATER);

    const lines = await discoveryLines();

    const healing = lines.indexOf(`  potion (${game.objectDescriptions?.[POT_HEALING]})`);
    const water = lines.indexOf('  potion (clear) {buy 8}');
    assert.ok(healing >= 0, 'The first encountered potion appears in discoveries');
    assert.ok(water > healing, 'The quoted potion takes its position when encountered');
});

void test('saving discoveries retains preknowledge, encounter markers, and discovery order', async () => {
    await freshObjectRoom();
    game.plname = 'Discovery reader';
    recordObjectKnowledge(POT_WATER);
    recordObjectKnowledge(POT_HEALING);
    recordObjectEncounter(POT_HEALING);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    await freshObjectRoom();
    assert.equal(await restoreGame('Discovery reader', storage), true);

    const lines = await discoveryLines();

    const water = lines.indexOf('* potion of water (clear)');
    const healing = lines.indexOf(`  potion of healing (${game.objectDescriptions?.[POT_HEALING]})`);
    assert.ok(water >= 0, 'Unencountered water must retain its preknowledge marker');
    assert.ok(healing > water, 'Encountered healing must retain its later discovery position');
});

void test('leaving the tutorial restores the discovery list while retaining learned type names', async () => {
    await freshObjectRoom();
    recordObjectKnowledge(POT_WATER);
    await changeTutorialState();
    learnObjectType(POT_HEALING);
    await changeTutorialState(game, true);

    const lines = await discoveryLines();

    assert.ok(lines.includes('* potion of water (clear)'));
    assert.equal(lines.some(line => line.includes('potion of healing')), false);
    const healing = await knownObject(POT_HEALING, { typeKnown: false, dknown: true });
    assert.equal(objectName(healing), 'potion of healing');
});
