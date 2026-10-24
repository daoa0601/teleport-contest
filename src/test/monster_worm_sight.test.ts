import { monsterAtPosition } from '../js/monster_location.js';
import { assertWormBody } from './support/worms.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { canSpotMonster, feel_location, glyphAt, newsym } from '../js/display.js';
import { createElementalMonsterExplosion } from '../js/explosion.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { AD_FIRE } from '../js/monster_attack_types.js';
import { monsterName } from '../js/monster_name.js';
import { runMonsterAction } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { makeBlinded } from '../js/sight_change.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { createSteamCloud } from '../js/regions.js';
import { addInventoryObject } from './support/game-objects.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function wormWithOnlyTailVisible() {
    freshObjectRoom({ left: 8, right: 22, top: 10, bottom: 10,
        heroX: 8, heroY: 10 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 14, 10,
        MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    pushKeys(' '.repeat(100));
    initRng(1n);
    await runMonsterAction(worm, game);
    assert.equal(worm.wormSegments?.length, 1);
    assertWormBody(worm);
    const location = game.level.requireAt(worm.mx, worm.my);
    location.lit = false;
    location.waslit = false;
    vision_recalc(0);
    assert.equal(cansee(worm.mx, worm.my), false);
    const tail = worm.wormSegments?.[0];
    assert.ok(tail);
    assert.ok(cansee(tail.x, tail.y));
    return { worm, tail };
}

void test('a visible worm tail identifies the actor without revealing the dark head', async () => {
    const { worm, tail } = await wormWithOnlyTailVisible();
    requirePlayingGame(game);

    assert.equal(canSpotMonster(worm), true);
    assert.equal(monsterName(worm), 'the long worm');
    newsym(worm.mx, worm.my);
    newsym(tail.x, tail.y);
    assert.notEqual(glyphAt(worm.mx, worm.my)?.kind, 'monster');
    assert.equal(game.level.requireAt(tail.x, tail.y).disp_ch, '~');
});

void test('a blast killing a visible worm tail names the worm even with its head in darkness', async () => {
    const { worm, tail } = await wormWithOnlyTailVisible();
    requirePlayingGame(game);
    const messages: string[] = [];
    worm.mhp = 1;
    // A sphere explodes during monster movement; C explode() credits the
    // hero with the kill whenever context.mon_moving is clear.
    game.context.mon_moving = true;
    try {
        await createElementalMonsterExplosion(tail.x + 1, tail.y, AD_FIRE, 20, "flaming sphere's explosion", {
            publish: (message: string) => messages.push(message),
        });
    } finally {
        game.context.mon_moving = false;
    }

    assert.notEqual(monsterAtPosition(game.level, worm.mx, worm.my), worm);
    assert.ok(messages.some(message => message.includes('The long worm is caught')));
    assert.ok(messages.includes('The long worm is killed!'));
});


void test('a visible tail uses the tail symbol and records that the worm was seen', async () => {
    const { worm, tail } = await wormWithOnlyTailVisible();
    requirePlayingGame(game);

    newsym(tail.x, tail.y);

    assert.equal(game.level.requireAt(tail.x, tail.y).disp_ch, '~');
    assert.equal(worm.meverseen, 1);
});

void test('monster detection shows an invisible worm head but not its visible-square tail', async () => {
    const { worm, tail } = await wormWithOnlyTailVisible();
    requirePlayingGame(game);
    worm.minvis = 1;
    grantIntrinsicProperty('detectMonsters', 'potion');

    newsym(worm.mx, worm.my);
    newsym(tail.x, tail.y);

    assert.equal(glyphAt(worm.mx, worm.my)?.kind, 'monster');
    assert.notEqual(glyphAt(tail.x, tail.y)?.kind, 'monster');
});

void test('blind touch draws a detected worm tail above the remembered floor', async () => {
    const { worm, tail } = await wormWithOnlyTailVisible();
    requirePlayingGame(game);
    grantIntrinsicProperty('detectMonsters', 'potion');
    await makeBlinded(10, { talk: false });
    newsym(tail.x, tail.y);
    assert.notEqual(glyphAt(tail.x, tail.y)?.kind, 'monster');

    feel_location(tail.x, tail.y);

    assert.equal(game.level.requireAt(tail.x, tail.y).disp_ch, '~');
    assert.equal(glyphAt(tail.x, tail.y)?.kind, 'monster');
    assert.equal(game.level.requireAt(tail.x, tail.y).remembered_glyph?.kind, 'terrain');
    assert.equal(worm.meverseen, 1);
});

void test('blind telepathy draws the out-of-sight worm tail under the Native dark-square rule', async () => {
    const { worm, tail } = await wormWithOnlyTailVisible();
    requirePlayingGame(game);
    grantIntrinsicProperty('telepathy', 'outside');
    await makeBlinded(10, { talk: false });

    newsym(worm.mx, worm.my);
    newsym(tail.x, tail.y);

    assert.equal(game.level.requireAt(worm.mx, worm.my).disp_ch, 'w');
    assert.equal(game.level.requireAt(tail.x, tail.y).disp_ch, '~');
});

void test('ordinary warning marks only the hidden worm head', async () => {
    const { worm, tail } = await wormWithOnlyTailVisible();
    requirePlayingGame(game);
    worm.minvis = 1;
    grantIntrinsicProperty('warning', 'outside');

    newsym(worm.mx, worm.my);
    newsym(tail.x, tail.y);

    assert.equal(glyphAt(worm.mx, worm.my)?.kind, 'warning');
    assert.notEqual(glyphAt(tail.x, tail.y)?.kind, 'warning');
});


void test('sighted telepathy identifies the worm but does not expose an invisible tail on a visible square', async () => {
    const { worm, tail } = await wormWithOnlyTailVisible();
    requirePlayingGame(game);
    worm.minvis = 1;
    await wearHeroAccessory(await addInventoryObject(OBJECT_NAMES.indexOf('amulet of ESP')), 'uamul');

    newsym(worm.mx, worm.my);
    newsym(tail.x, tail.y);

    assert.equal(canSpotMonster(worm), true);
    assert.equal(glyphAt(worm.mx, worm.my)?.kind, 'monster');
    assert.notEqual(glyphAt(tail.x, tail.y)?.kind, 'monster');
});

void test('detecting a distant worm does not draw its tail over a steam cloud', async () => {
    const { worm, tail } = await wormWithOnlyTailVisible();
    requirePlayingGame(game);
    grantIntrinsicProperty('detectMonsters', 'potion');
    await createSteamCloud(game, tail.x, tail.y, 1);
    vision_recalc(0);
    assert.ok(cansee(tail.x, tail.y));

    newsym(worm.mx, worm.my);
    newsym(tail.x, tail.y);

    assert.equal(glyphAt(worm.mx, worm.my)?.kind, 'monster');
    const glyph = glyphAt(tail.x, tail.y);
    assert.ok(glyph?.kind === 'terrain');
    assert.equal(glyph.terrainName, 'cloud');
});
