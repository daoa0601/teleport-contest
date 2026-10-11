import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_FURNITURE, PIT, TT_PIT } from '../js/const.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { AMULET_OF_LIFE_SAVING, CLOVE_OF_GARLIC, TOOLED_HORN } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { applyInventoryObject, throwInventoryObject } from './support/commands.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { addInventoryItem } from '../js/u_init.js';
import { lightWieldedArtifact, endObjectBurn } from '../js/light.js';
import { applyArmorOnEffects, wearHeroArmor } from '../js/armor.js';
import { GOLD_DRAGON_SCALES } from '../js/object_data.js';
import { canSeeMonster, canSpotMonster, flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { pushKeys } from '../js/input.js';
import { makeMonsterFlee } from '../js/monster_flee.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { installPolymorphedHero, installSwallowedHero } from './support/hero-state.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
async function topline() {
    await flush_screen();
    const row = requireGameDisplay().grid[0];
    assert.ok(row, 'The display must contain its message row');
    return row.map(cell => cell.ch).join('').trim();
}
void test('an immobile named monster keeps its personal name in the fear message', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 11, 10);
    setMonsterGivenName(pet, 'Fido');
    pet.mcanmove = 0;
    await makeMonsterFlee(pet);
    assert.equal(await topline(), 'The immobile Fido seems to flinch.');
});
void test('fear inserts immobility into a player monster title', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const knight = await createMonsterAt('knight', 11, 10);
    setMonsterGivenName(knight, 'Alex the Gallant');
    knight.mcanmove = 0;
    await makeMonsterFlee(knight);
    assert.equal(await topline(), 'Alex the immobile Gallant seems to flinch.');
});
void test('an immobile shopkeeper is called by its shop name', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = 'Izchak';
    shopkeeper.mcanmove = 0;
    assert.equal(canSeeMonster(shopkeeper), true);
    await makeMonsterFlee(shopkeeper);
    assert.equal(await topline(), 'The immobile Izchak seems to flinch.');
});
void test('an immobile mount is described with its saddle', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    pony.mcanmove = 0;
    await makeMonsterFlee(pony);
    assert.equal(await topline(), 'The immobile saddled pony seems to flinch.');
});
void test('sensing an unseen monster does not reveal its reaction to fear', async () => {
    freshObjectRoom({ hero: { detectMonsters: true } });
    requirePlayingGame(game);
    const stalker = await createMonsterAt('stalker', 11, 10);
    assert.equal(canSpotMonster(stalker), true);
    assert.equal(canSeeMonster(stalker), false);
    await makeMonsterFlee(stalker);
    assert.equal(stalker.mflee, 1);
    assert.equal(await topline(), '');
});
void test('a disguised mimic stays silent even with additional appearance flags', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10);
    mimic.m_ap_type = M_AP_FURNITURE | 0x08;
    assert.equal(canSeeMonster(mimic), true);
    await makeMonsterFlee(mimic);
    assert.equal(mimic.mflee, 1);
    assert.equal(await topline(), '');
});
void test('a sticky hero retains its grip on a frightened monster', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('owlbear');
    const goblin = await createMonsterAt('goblin', 11, 10);
    game.u.ustuck = goblin;
    await makeMonsterFlee(goblin, { announce: false });
    assert.equal(game.u.ustuck === goblin, true);
    assert.equal(goblin.mflee, 1);
});
void test('a frightened holder releases the hero and cannot immediately grab again', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const python = await createMonsterAt('python', 11, 10);
    game.u.ustuck = python;
    python.mspec_used = 0;
    await makeMonsterFlee(python, { announce: false });
    assert.equal(game.u.ustuck, null);
    assert.ok(python.mspec_used >= 1 && python.mspec_used <= 2);
    assert.equal(await topline(), 'You get released!');
});
void test('a frightened engulfer expels the hero onto the trap below it', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    addTrap(level, PIT, game.u.ux, game.u.uy);
    installSwallowedHero(worm);
    pushKeys(' '.repeat(40));
    await makeMonsterFlee(worm, { announce: false });
    assert.equal(Boolean(game.u.uswallow), false);
    assert.equal(game.u.ustuck, null);
    assert.ok(worm.mx !== game.u.ux || worm.my !== game.u.uy);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0);
});
void test('fear preserves untimed flight and caps repeated timed flight', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10);
    await makeMonsterFlee(goblin, { turns: 1, announce: false });
    assert.equal(goblin.mfleetim, 2);
    await makeMonsterFlee(goblin, { turns: 126, announce: false });
    assert.equal(goblin.mfleetim, 127);
    await makeMonsterFlee(goblin, { turns: 0, announce: false });
    assert.equal(goblin.mfleetim, 0);
    await makeMonsterFlee(goblin, { turns: 10, announce: false });
    assert.equal(goblin.mfleetim, 0);
    assert.equal(goblin.mflee, 1);
});
void test('first-only fear still releases the hero but does not extend flight', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const python = await createMonsterAt('python', 11, 10);
    await makeMonsterFlee(python, { turns: 4, announce: false });
    game.u.ustuck = python;
    python.mtrack = [{ x: 12, y: 10 }];
    await makeMonsterFlee(python, { turns: 20, first: true, announce: false });
    assert.equal(game.u.ustuck, null);
    assert.equal(python.mfleetim, 4);
    assert.equal(python.mtrack.length, 0);
});
void test('a Vrock releases poison gas when frightened, then needs time to recover', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const vrock = await createMonsterAt('vrock', 11, 10);
    assert.equal(vrock.mspec_used ?? 0, 0);
    await makeMonsterFlee(vrock, { announce: false });
    assert.equal(game.level.regions.length, 1);
    const cloud = game.level.regions[0];
    assert.ok(cloud);
    assert.ok(cloud.cells.some(cell => cell.x === vrock.mx && cell.y === vrock.my));
    assert.equal(cloud.cells.length, 5);
    assert.equal(cloud.damage, 8);
    assert.ok((vrock.mspec_used ?? 0) >= 75 && (vrock.mspec_used ?? 0) <= 99);
    const cooldown = vrock.mspec_used;
    await makeMonsterFlee(vrock, { announce: false });
    assert.equal(game.level.regions.length, 1);
    assert.equal(vrock.mspec_used, cooldown);
    vrock.mspec_used = 0;
    await makeMonsterFlee(vrock, { first: true, announce: false });
    assert.equal(game.level.regions.length, 1);
    assert.equal(vrock.mspec_used ?? 0, 0);
    await makeMonsterFlee(vrock, { announce: false });
    assert.equal(game.level.regions.length, 2);
});
void test('fear has no effect on a dead Vrock', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const vrock = await createMonsterAt('vrock', 11, 10);
    vrock.mhp = 0;
    vrock.mtrack = [{ x: 12, y: 10 }];
    await makeMonsterFlee(vrock);
    assert.equal(Boolean(vrock.mflee), false);
    assert.equal((game.level.regions || []).length, 0);
    assert.equal(vrock.mspec_used ?? 0, 0);
    assert.equal(vrock.mtrack.length, 1);
    assert.equal(await topline(), '');
});
async function swallowedGarlicArena(lifeSaving = false) {
    const level = freshObjectRoom({ hero: { uhp: 1 } });
    requirePlayingGame(game);
    const vampire = await createMonsterAt('vampire', 11, 10);
    await changeMonsterForm(vampire, MONSTER_NAME.indexOf('fog cloud'));
    assert.equal(vampire.mnum, MONSTER_NAME.indexOf('fog cloud'));
    vampire.mhp = vampire.mhpmax = 100;
    addTrap(level, PIT, game.u.ux, game.u.uy);
    installSwallowedHero(vampire);
    await setPrimaryWeapon(await addInventoryObject(CLOVE_OF_GARLIC));
    let amulet;
    if (lifeSaving) {
        amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
        await wearHeroAccessory(amulet, 'uamul');
    }
    initRng(17n);
    pushKeys(' '.repeat(100));
    return { vampire, amulet };
}
void test('fatal expulsion from garlic stops before the melee hit damages its target', async () => {
    const { vampire } = await swallowedGarlicArena();
    requirePlayingGame(game);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.program_state.gameover, true);
    assert.equal(Boolean(game.u.uswallow), false);
    assert.ok(vampire.mx !== game.u.ux || vampire.my !== game.u.uy);
    assert.equal(vampire.mhp, 100);
    assert.equal(Boolean(vampire.mflee), false);
});
void test('life saving after garlic expulsion resumes fear and melee damage', async () => {
    const { vampire, amulet } = await swallowedGarlicArena(true);
    requirePlayingGame(game);
    await rhack('l'.charCodeAt(0));
    assert.equal(Boolean(game.program_state.gameover), false);
    assert.ok(amulet);
    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(Boolean(game.u.uswallow), false);
    assert.equal(vampire.mflee, 1);
    assert.ok(vampire.mhp < 100);
});
void test('fatal expulsion from horn music leaves later listeners asleep', async () => {
    const level = freshObjectRoom({ hero: { uhp: 1 } });
    requirePlayingGame(game);
    const observer = await createMonsterAt('goblin', 12, 10);
    observer.msleeping = 1;
    const worm = await createMonsterAt('purple worm', 11, 10);
    addTrap(level, PIT, game.u.ux, game.u.uy);
    installSwallowedHero(worm);
    const horn = await addInventoryObject(TOOLED_HORN);
    initRng(17n);
    await applyInventoryObject(horn, 'y' + ' '.repeat(100));
    assert.equal(game.program_state.gameover, true);
    assert.equal(Boolean(worm.mflee), false);
    assert.equal(observer.msleeping, 1);
});
async function gremlinAndSunsword() {
    freshObjectRoom();
    requirePlayingGame(game);
    const gremlin = await createMonsterAt('gremlin', 11, 10);
    const sword = await addInventoryItem(await artifactObject('Sunsword'));
    await setPrimaryWeapon(sword);
    pushKeys(' '.repeat(100));
    await lightWieldedArtifact(sword);
    assert.equal(Boolean(sword.lamplit), true);
    return { gremlin, sword };
}
void test('a gremlin fears the light of Sunsword but not an unlit blade', async () => {
    const { gremlin, sword } = await gremlinAndSunsword();
    requirePlayingGame(game);
    game.u.deafTurns = 20;
    await makeMonsterFlee(gremlin);
    assert.equal(await topline(), 'The gremlin flees from the painful light of Sunsword.');
    endObjectBurn(sword);
    gremlin.mflee = 0;
    await makeMonsterFlee(gremlin);
    assert.equal(await topline(), 'The gremlin turns to flee.');
});
void test('a blinded gremlin cannot react to the hero light source', async () => {
    const { gremlin } = await gremlinAndSunsword();
    requirePlayingGame(game);
    gremlin.mcansee = 0;
    gremlin.mblinded = 20;
    await makeMonsterFlee(gremlin);
    assert.match(await topline(), /The gremlin turns to flee\.$/);
});
void test('a sleeping hero gets a simple frightened message for a gremlin', async () => {
    const { gremlin } = await gremlinAndSunsword();
    requirePlayingGame(game);
    putHeroToSleep(5);
    await makeMonsterFlee(gremlin);
    assert.match(await topline(), /The gremlin is frightened\.$/);
});
void test('a gremlin can cry out about bright light when the hero can hear', async () => {
    const { gremlin } = await gremlinAndSunsword();
    requirePlayingGame(game);
    const messages = new Set();
    for (let attempt = 0; attempt < 64; attempt++) {
        gremlin.mflee = 0;
        await makeMonsterFlee(gremlin);
        messages.add(await topline());
    }
    assert.ok([...messages].some(message => message.includes('"Bright light!"')));
    assert.ok([...messages].some(message => message.includes('The gremlin flees from the painful light of Sunsword.')));
});
void test('glowing gold dragon scales are named as the source of gremlin fear', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const gremlin = await createMonsterAt('gremlin', 11, 10);
    const scales = await addInventoryObject(GOLD_DRAGON_SCALES);
    wearHeroArmor(scales);
    pushKeys(' '.repeat(100));
    await applyArmorOnEffects(scales);
    assert.equal(Boolean(scales.lamplit), true);
    game.u.deafTurns = 20;
    await makeMonsterFlee(gremlin);
    assert.equal(await topline(), 'The gremlin flees from the painful light of your set of gold dragon scales.');
});
void test('gremlin prose prefers Sunsword when armor supplies the actual light', async () => {
    const { gremlin, sword } = await gremlinAndSunsword();
    requirePlayingGame(game);
    endObjectBurn(sword);
    const scales = await addInventoryObject(GOLD_DRAGON_SCALES);
    wearHeroArmor(scales);
    await applyArmorOnEffects(scales);
    assert.equal(Boolean(scales.lamplit), true);
    game.u.deafTurns = 20;
    await makeMonsterFlee(gremlin);
    assert.equal(await topline(), 'The gremlin flees from the painful light of Sunsword.');
});
async function swallowedMagicbaneArena(fatalLanding) {
    const level = freshObjectRoom({ hero: { uhp: fatalLanding ? 1 : 40 } });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    worm.mhp = worm.mhpmax = 100;
    const impact = { x: game.u.ux, y: game.u.uy };
    if (fatalLanding)
        addTrap(level, PIT, impact.x, impact.y);
    installSwallowedHero(worm);
    const weapon = await addInventoryItem(await artifactObject('Magicbane', { spe: 0 }));
    initRng(55n);
    return { worm, weapon, impact };
}
void test('a thrown Magicbane lands at the impact square after fear expels the hero', async () => {
    const { worm, weapon, impact } = await swallowedMagicbaneArena(false);
    requirePlayingGame(game);
    await throwInventoryObject(weapon, 'l', Array.from({ length: 50 }, () => ' '));
    assert.equal(Boolean(game.u.uswallow), false);
    assert.equal(worm.mflee, 1);
    assert.ok(worm.mhp < 100);
    assert.equal(game.inventory.includes(weapon), false);
    assert.equal(worm.minvent.includes(weapon), false);
    assert.ok(floorObjectsAt(game.level, impact.x, impact.y).includes(weapon));
});
void test('fatal expulsion from thrown Magicbane stops damage and projectile transfer', async () => {
    const { worm, weapon, impact } = await swallowedMagicbaneArena(true);
    requirePlayingGame(game);
    await throwInventoryObject(weapon, 'l', Array.from({ length: 50 }, () => ' '));
    assert.equal(game.program_state.gameover, true);
    assert.equal(worm.mhp, 100);
    assert.equal(Boolean(worm.mflee), false);
    assert.equal(worm.minvent.includes(weapon), false);
    assert.equal(floorObjectsAt(game.level, impact.x, impact.y).includes(weapon), false);
});
//# sourceMappingURL=monster_flee.test.js.map