import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DUST, P_POLEARMS, P_SKILLED, STATUE_TRAP, THRONE,
} from '../js/const.js';
import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { BOULDER, OBJECT_NAMES, STATUE } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const HALBERD = OBJECT_NAMES.indexOf('halberd');
const KATANA = OBJECT_NAMES.indexOf('katana');
const ARROW = OBJECT_NAMES.indexOf('arrow');

function freshPolearmRoom() {
    // verbose:false keeps the getpos prompt short so follow-up attack
    // lines never overflow into an interactive --More-- dismissal.
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game._travelTipShown = true;
    resetInputState();
}

async function installPolearm({ wielded = true, skill = 1 } = {}) {
    const pole = await addInventoryObject(HALBERD, {
        invlet: 'a', spe: 0, enchantment: 0,
    });
    if (wielded) game.uwep = game.u.uwep = pole;
    installHeroWeaponSkills({ [P_POLEARMS]: skill });
    return pole;
}

function sturdyMonsterAt(species: string | number, x: number, y: number) {
    return createMonsterAt(species, x, y).then(monster => {
        monster.mhp = monster.mhpmax = 500;
        // The engine repaints a placed monster through newsym(); the map
        // cell's semantic glyph follows that paint.
        newsym(x, y);
        return monster;
    });
}

function paintAt(x: number, y: number) {
    newsym(x, y);
}

void test('applying an unwielded polearm wields it before aiming', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm({ wielded: false });

    await applyInventoryObject(pole);

    assert.equal(game.uwep, pole);
    assert.equal(game.context.move, 1);
});

void test('an applied polearm strikes the sole monster in range', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm();
    const monster = await sturdyMonsterAt('jackal', 12, 10);

    initRng(2n);
    await applyInventoryObject(pole, '.');

    assert.ok(monster.mhp < 500);
    assert.equal(game.context.move, 1);
});

void test('a polearm blow at an adjacent square is too close', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm();
    await sturdyMonsterAt('jackal', 11, 10);

    await applyInventoryObject(pole, 'l.');

    assert.match(game._pending_message, /Too close!$/);
    assert.equal(game.context.move, 0);
});

void test('a basic polearm cannot reach a knight-move square', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm({ skill: 1 });

    await applyInventoryObject(pole, 'llj.');

    assert.match(game._pending_message, /Too far!$/);
    assert.equal(game.context.move, 0);
});

void test('a skilled polearm reaches a knight-move square and misses', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm({ skill: P_SKILLED });

    await applyInventoryObject(pole, 'llj.');

    assert.match(game._pending_message,
        /You miss; there is no one there to hit\.$/);
    assert.equal(game.context.move, 1);
});

void test('a polearm thumps a statue without waking anything hostile', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm();
    await floorObject(STATUE, 12, 10);
    paintAt(12, 10);

    await applyInventoryObject(pole, 'll.');

    assert.match(game._pending_message,
        /Thump!  Your blow bounces harmlessly off the statue\.$/);
    assert.equal(game.context.move, 1);
});

void test('striking a trapped statue animates it instead of thumping', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm();
    const statue = await floorObject(STATUE, 12, 10);
    paintAt(12, 10);
    addTrap(requireGameLevel(), STATUE_TRAP, 12, 10, { madeby_u: false });

    initRng(3n);
    await applyInventoryObject(pole, 'll.');

    assert.equal(
        floorObjectsAt(requireGameLevel(), 12, 10).includes(statue), false);
    assert.doesNotMatch(game._pending_message, /Thump!/);
    assert.equal(game.context.move, 1);
});

void test('a polearm thumps a boulder', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm();
    await floorObject(BOULDER, 12, 10);
    paintAt(12, 10);

    await applyInventoryObject(pole, 'll.');

    assert.match(game._pending_message,
        /Thump!  Your blow bounces harmlessly off the boulder\.$/);
    assert.equal(game.context.move, 1);
});

void test('a polearm uselessly attacks furniture', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm();
    requireGameLevel().requireAt(12, 10).typ = THRONE;
    paintAt(12, 10);

    await applyInventoryObject(pole, 'll.');

    assert.match(game._pending_message,
        /You uselessly attack the opulent throne\.$/);
    assert.equal(game.context.move, 1);
});

void test('a blind hero cannot aim at an unseen empty square', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm();
    game.blind = true;
    game.u.blindTurns = 10;
    vision_recalc(0);

    await applyInventoryObject(pole, 'll.');

    assert.match(game._pending_message,
        /You won't hit anything if you can't see that spot\.$/);
    assert.equal(game.context.move, 0);
});

void test('an applied polearm scuffs the engraving under the hero', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    const pole = await installPolearm();
    await sturdyMonsterAt('jackal', 12, 10);
    makeEngravingAt(game.u.ux, game.u.uy, '?', null, 0, DUST);

    initRng(14n);
    await applyInventoryObject(pole, '.');

    assert.equal(engravingAt(game.u.ux, game.u.uy), null);
    assert.equal(game.context.move, 1);
});

void test('Snickersnee strikes once per world turn without spending it', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    // A lawful wielder can handle Snickersnee without an alignment blast.
    game.u.ualign.type = 1;
    const artifact = artifactByName('Snickersnee');
    assert.ok(artifact);
    const katana = await addInventoryObject(KATANA, {
        invlet: 'a',
        oartifact: artifact.id,
    });
    game.uwep = game.u.uwep = katana;
    const monster = await sturdyMonsterAt('jackal', 12, 10);

    initRng(21n);
    await applyInventoryObject(katana, '.');

    assert.ok(monster.mhp < 500);
    assert.equal(game.context.snickersneeTurn, 40);
    assert.equal(game.context.move, 0);
    const hpAfterFirstStrike = monster.mhp;

    initRng(23n);
    await applyInventoryObject(katana, '.');

    assert.match(game._pending_message,
        /The blade doesn't reach there!$/);
    assert.equal(monster.mhp, hpAfterFirstStrike);
    assert.equal(game.context.move, 0);
});

void test('firing with a wielded polearm and no quiver auto-strikes', async () => {
    freshPolearmRoom();
    requirePlayingGame(game);
    await installPolearm();
    const monster = await sturdyMonsterAt('jackal', 12, 10);

    initRng(2n);
    await rhack('f'.charCodeAt(0));

    assert.ok(monster.mhp < 500);
    assert.equal(game.context.move, 1);
});

void test('firing a polearm with no candidate does not know what to hit',
    async () => {
        freshPolearmRoom();
        requirePlayingGame(game);
        await installPolearm();

        initRng(1n);
        await rhack('f'.charCodeAt(0));

        assert.match(game._pending_message, /Don't know what to hit\.$/);
        assert.equal(game.context.move, 0);
    });

void test('quivered ammunition defers to the wielded polearm when it can strike',
    async () => {
        freshPolearmRoom();
        requirePlayingGame(game);
        await installPolearm();
        const arrow = await addInventoryObject(ARROW, { invlet: 'b' });
        game.uquiver = arrow;
        const monster = await sturdyMonsterAt('jackal', 12, 10);

        initRng(2n);
        await rhack('f'.charCodeAt(0));

        assert.ok(monster.mhp < 500);
        assert.equal(game.inventory.includes(arrow), true);
        assert.equal(game.context.move, 1);
    });
