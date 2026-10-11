import test from 'node:test';
import assert from 'node:assert/strict';

import { GameDisplay } from '../js/game_display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { dodiscovered } from '../js/o_init.js';
import {
    LEATHER_GLOVES, MAGIC_HARP, POT_BOOZE, POT_FULL_HEALING, POT_HEALING,
    POT_WATER, SACK, WOODEN_HARP,
} from '../js/object_data.js';
import {
    learnObjectType, recordObjectCall, recordObjectEncounter, recordObjectKnowledge,
} from '../js/object_knowledge.js';
import { objectName } from '../js/objnam.js';
import { restoreGame, saveGame } from '../js/save.js';
import { changeTutorialState } from '../js/tutorial_state.js';
import { vision_reset } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
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
    freshObjectRoom({ role: 'caveman' });
    recordObjectKnowledge(WOODEN_HARP);

    const lines = await discoveryLines();

    assert.ok(lines.includes('* wooden harp (harp)'));
    assert.equal(lines.some(line => line.includes('koto')), false);
});

void test('an unidentified Samurai harp can be called without revealing its magic identity', async () => {
    freshObjectRoom({ role: 'samurai' });
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
    freshObjectRoom({ role: 'samurai', objectInitializationSeed: 52891n });
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
});

void test('Rogues list their starting sack as encountered', async () => {
    await startHero({ role: 'rogue' });
    const sack = game.inventory.find(object => object.otyp === SACK);
    assert.ok(sack, 'A Rogue starts with a sack');

    const lines = await discoveryLines();

    assert.ok(lines.includes('  sack (bag)'));
});

void test('saving discoveries retains preknowledge, encounter markers, and discovery order', async () => {
    freshObjectRoom();
    game.plname = 'Discovery reader';
    recordObjectKnowledge(POT_WATER);
    recordObjectKnowledge(POT_HEALING);
    recordObjectEncounter(POT_HEALING);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    freshObjectRoom();
    assert.equal(restoreGame('Discovery reader', storage), true);

    const lines = await discoveryLines();

    const water = lines.indexOf('* potion of water (clear)');
    const healing = lines.indexOf(`  potion of healing (${game.objectDescriptions?.[POT_HEALING]})`);
    assert.ok(water >= 0, 'Unencountered water must retain its preknowledge marker');
    assert.ok(healing > water, 'Encountered healing must retain its later discovery position');
});

void test('leaving the tutorial restores the discovery list while retaining learned type names', async () => {
    freshObjectRoom();
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
