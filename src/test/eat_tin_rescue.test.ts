import { advanceHeroVomiting, advanceHeroSliming, advanceHeroPetrification } from './support/condition-turn.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCountedCommand } from '../js/cmd.js';
import { doeat } from '../js/eat.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { startHeroVomiting } from '../js/hero_illness.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DAGGER, TIN } from '../js/object_data.js';
import { startHeroSliming } from '../js/slime.js';
import { startHeroPetrification } from '../js/stoning.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

type Threat = 'petrification' | 'sliming' | 'vomiting';

async function openTin(species: string, known = true) {
    freshObjectRoom({ gameplaySeed: 71n, hero: { uhunger: 200 } });
    requirePlayingGame(game);
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger);
    const tin = await addInventoryObject(TIN, {
        initialize: false, corpsenm: MONSTER_NAME.indexOf(species),
        spe: -2, known, blessed: false,
    });
    // An unblessed tin with a dagger takes three turns to open.
    const input = resetInputState();
    installPagerInput(input, {
        expected: /tin|limbs|oozy|stone|lizard|acid|petrif|brain|food|nausea|poison|sick|limber|chameleon/i,
        limit: 15,
    });
    input.feed(tin.invlet);
    await doeat();
    assert.equal(game._occupation?.key, 'open-tin');
    return { tin, input };
}

async function advanceThreat(threat: Threat) {
    if (threat === 'petrification') {
        startHeroPetrification({ turns: 4 });
        await advanceHeroPetrification();
    } else if (threat === 'sliming') {
        startHeroSliming({ turns: 7 });
        await advanceHeroSliming();
    } else {
        startHeroVomiting({ turns: 7 });
        await advanceHeroVomiting();
    }
}

for (const [threat, species, known, helpful] of [
    ['petrification', 'lizard', true, true],
    ['petrification', 'acid blob', true, true],
    ['petrification', 'newt', true, false],
    ['petrification', 'newt', false, true],
    ['sliming', 'chameleon', true, true],
    ['sliming', 'genetic engineer', true, true],
    ['sliming', 'lizard', true, false],
    ['sliming', 'lizard', false, true],
    ['vomiting', 'lizard', true, false],
    ['vomiting', 'lizard', false, true],
] as const) {
    void test(`${threat} ${helpful ? 'allows' : 'interrupts'} opening ${known ? 'known' : 'unknown'} ${species} tins`, async () => {
        const { tin } = await openTin(species, known);

        await advanceThreat(threat);

        assert.equal(game._occupation?.key ?? null, helpful ? 'open-tin' : null);
        assert.equal(tin.where, 'inventory');
        assert.equal(tin.known, known);
    });
}

void test('the remaining opening turn lets lizard meat cure petrification', async () => {
    const { tin, input } = await openTin('lizard');
    requirePlayingGame(game);
    await continueCountedCommand(game);
    await continueCountedCommand(game);
    await advanceThreat('petrification');
    await flushPendingTopline();
    // The opening/smell message pages before the separate eating question.
    input.feed(' y');

    await continueCountedCommand(game);

    assert.equal(tin.where, 'gone');
    assert.equal(game.u.stonedTurns, 0);
    assert.equal(game.program_state.gameover ?? false, false);
});
