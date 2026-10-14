import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { CLUB } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterName } from '../js/monster_name.js';
import { redrawMap, transientMonsterGlyph, transientObjectGlyph } from '../js/display.js';
import { heroSpecies } from '../js/hero_species.js';
import { initRng } from '../js/rng.js';
import { lookInsideSwallower } from '../js/swallowed_inventory.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
void test('inspecting a hallucinated swallowed hero changes the next perceived swallower name', async () => {
    freshPlayableRoom();
    const swallower = await createMonsterAt('purple worm', 10, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    const club = await knownObject(CLUB);
    await addObjectToMonsterInventory(swallower, club);
    game.u.uswallow = 1;
    game.u.ustuck = swallower;
    await redrawMap();
    game.u.hallucinationTurns = 20;
    // Native inspection shows the object and the hero as two menu glyphs.
    // Build those appearances with the real display APIs to predict the next name.
    initRng(142n);
    monsterName(swallower);
    transientObjectGlyph(club);
    transientMonsterGlyph({ mnum: heroSpecies(game) });
    const nextName = monsterName(swallower).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    initRng(142n);
    const input = resetInputState();
    await answerPrompts(lookInsideSwallower(swallower), input, [
        { prompt: /look around[\s\S]*--More--/, keys: ' ' },
        { prompt: /Swallowed Creatures/, keys: ' ' },
    ]);
    await answerPrompts(lookInsideSwallower(swallower), input, [
        { prompt: /look around[\s\S]*--More--/, keys: ' ' },
        { prompt: new RegExp(`Contents of ${nextName}`), keys: ' ' },
    ]);
});
//# sourceMappingURL=swallowed_inventory_glyph.test.js.map