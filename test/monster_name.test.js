import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESSIBLE, M_AP_MONSTER, SHOPBASE } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { generateMinetown, mklev } from '../js/mklev.js';
import { monsterName, monsterPossessive } from '../js/monster_name.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { saveGame, restoreGame } from '../js/save.js';
import { shopkeeperName } from '../js/monster_name.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { makedog } from '../js/u_init.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { freshSpecialLevel } from './support/special-level.js';
import { memoryStorage } from './support/memory-storage.js';
for (const [role, name] of [
    ['caveman', 'Slasher'], ['ranger', 'Sirius'], ['samurai', 'Hachi'], ['barbarian', 'Idefix'],
]) {
    void test(`a ${role}'s starting dog is addressed as ${name}`, async () => {
        freshObjectRoom({ role });
        game.preferred_pet = 'd';
        const pet = await makedog();
        assert.ok(pet);
        assert.equal(monsterName(pet, { article: 'your', suppressIt: true }), name);
    });
}
void test('a barbarian choosing a kitten does not give it the default dog name', async () => {
    freshObjectRoom({ role: 'barbarian' });
    game.preferred_pet = 'c';
    const pet = await makedog();
    assert.ok(pet);
    assert.equal(monsterName(pet, { article: 'your', suppressIt: true }), 'your kitten');
});
void test('an unseen monster becomes an identified invisible species when sensed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const stalker = await createMonsterAt('stalker', 11, 10);
    assert.equal(monsterName(stalker), 'it');
    game.u.detectMonsters = true;
    assert.equal(monsterName(stalker), 'the invisible stalker');
});
void test('a named ghost keeps its possessive name without an extra article', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ghost = await createMonsterAt('ghost', 11, 10);
    setMonsterGivenName(ghost, 'James');
    assert.equal(monsterName(ghost), "James' ghost");
});
void test('a player monster uses its rank and puts invisibility inside its given title', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const knight = await createMonsterAt('knight', 11, 10);
    knight.m_lev = 1;
    assert.equal(monsterName(knight), 'the gallant');
    setMonsterGivenName(knight, 'Alex the Gallant');
    knight.minvis = true;
    game.u.detectMonsters = true;
    assert.equal(monsterName(knight), 'Alex the invisible Gallant');
});
void test('a saddle is named on an unnamed mount but not on a named one', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    assert.equal(monsterName(pony), 'the saddled pony');
    setMonsterGivenName(pony, 'Penny');
    assert.equal(monsterName(pony), 'Penny');
});
void test('a pet quickmimic is named for its borrowed monster appearance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 11, 10);
    initializePet(pet, { state: game });
    pet.meating = 5;
    pet.m_ap_type = M_AP_MONSTER;
    pet.mappearance = MONSTER_NAME.indexOf('kitten');
    assert.equal(monsterName(pet), 'the kitten');
});
void test('a shopkeeper keeps its identity when invisible or polymorphed', async () => {
    freshObjectRoom({ hero: { detectMonsters: true } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = 'Izchak';
    shopkeeper.minvis = true;
    assert.equal(monsterName(shopkeeper), 'Izchak the invisible shopkeeper');
    shopkeeper.minvis = false;
    await changeMonsterForm(shopkeeper, MONSTER_NAME.indexOf('blue dragon'));
    assert.equal(monsterName(shopkeeper), 'Izchak the blue dragon');
});
void test('hallucination can describe a monster with any possessive pronoun', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    const beast = await createMonsterAt('displacer beast', 11, 10);
    const pronouns = new Set();
    for (let attempt = 0; attempt < 64; attempt++)
        pronouns.add(monsterPossessive(beast));
    assert.ok(pronouns.has('their'));
    assert.ok(pronouns.size > 1);
});
void test('the final game display identifies monsters without hallucinated names', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    const leader = await createMonsterAt('Lord Carnarvon', 11, 10);
    game.program_state.gameover = true;
    assert.equal(monsterName(leader), 'Lord Carnarvon');
});
async function createAstralPriest() {
    freshSpecialLevel({ prototype: 'astral', seed: 1501, depth: 1 });
    requirePlayingGame(game);
    game.astral_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    game._specialLevelPrototype = 'astral';
    game._activeSpecialLevel = null;
    await mklev();
    game.in_mklev = false;
    game.u.detectMonsters = true;
    const priest = game.level.monsters.find(monster => monster.ispriest && monster.epri?.shralign === 1);
    assert.ok(priest, 'the native Astral level must have its lawful priest');
    return priest;
}
function standOnEmptyFloor(priest, nearby) {
    requirePlayingGame(game);
    for (let x = 1; x < 80; x++) {
        for (let y = 0; y < 21; y++) {
            const distance = (x - priest.mx) ** 2 + (y - priest.my) ** 2;
            if ((distance <= 2) !== nearby || !ACCESSIBLE(game.level.requireAt(x, y).typ)
                || game.level.monsters.some(monster => monster.mx === x && monster.my === y))
                continue;
            game.u.ux = x;
            game.u.uy = y;
            return;
        }
    }
    assert.fail('the level fixture needs an unoccupied floor square');
}
void test('an Astral high priest hides its deity at a distance, not when adjacent or the game ends', async () => {
    const priest = await createAstralPriest();
    requirePlayingGame(game);
    priest.minvis = true;
    standOnEmptyFloor(priest, false);
    assert.match(monsterName(priest), /^the invisible high priest(?:ess)?$/);
    assert.match(monsterName(priest, { article: 'a' }), /^the invisible high priest(?:ess)?$/);
    standOnEmptyFloor(priest, true);
    assert.match(monsterName(priest), /^the invisible high priest(?:ess)? of Quetzalcoatl$/);
    standOnEmptyFloor(priest, false);
    game.u.hallucinationTurns = 20;
    game.program_state.gameover = true;
    assert.match(monsterName(priest), /^the invisible high priest(?:ess)? of Quetzalcoatl$/);
});
void test('a hallucinated Astral priest is a grand poohbah with a deity even at a distance', async () => {
    const priest = await createAstralPriest();
    requirePlayingGame(game);
    standOnEmptyFloor(priest, false);
    game.u.hallucinationTurns = 20;
    const name = monsterName(priest);
    assert.match(name, /^(?:the )?grand poohbah of .+$/);
});
void test('an exact Astral priest name includes its deity even at a distance', async () => {
    const priest = await createAstralPriest();
    standOnEmptyFloor(priest, false);
    assert.match(monsterName(priest, { exact: true }), / of Quetzalcoatl$/);
});
void test('Lua-assigned player-monster names remain visible after saving and restoring', async () => {
    freshSpecialLevel({ prototype: 'Wiz-goal', seed: 2501, depth: 11 });
    requirePlayingGame(game);
    game._specialLevelPrototype = 'Wiz-goal';
    game._activeSpecialLevel = null;
    await mklev();
    game.in_mklev = false;
    game.u.detectMonsters = true;
    const actor = (species) => {
        requirePlayingGame(game);
        const monster = game.level.monsters.find(monster => monster.mnum === MONSTER_NAME.indexOf(species));
        assert.ok(monster, `The generated level must contain its named ${species}`);
        return monster;
    };
    assert.ok(actor('rogue'));
    assert.ok(actor('wizard'));
    standOnEmptyFloor(actor('rogue'), false);
    assert.equal(monsterName(actor('rogue')), 'Pug');
    assert.equal(monsterName(actor('wizard')), 'Newt');
    game.plname = 'NamedActors';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('NamedActors', storage), true);
    assert.equal(monsterName(actor('rogue')), 'Pug');
    assert.equal(monsterName(actor('wizard')), 'Newt');
});
void test('changing a given name keeps direct-level whitespace and can remove the name', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 11, 10);
    initializePet(dog, { state: game });
    assert.ok(dog.edog);
    const hunger = dog.edog.hungrytime;
    setMonsterGivenName(dog, '  A  name  ');
    assert.equal(monsterName(dog), '  A  name  ');
    setMonsterGivenName(dog, 'x'.repeat(80));
    assert.equal(monsterName(dog), 'x'.repeat(62));
    setMonsterGivenName(dog, null);
    assert.equal(monsterName(dog), 'the little dog');
    assert.equal(dog.edog.hungrytime, hunger);
});
void test('a normally generated ghost has a personal identity', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Visitor';
    const ghost = await createMonsterAt('ghost', 11, 10);
    assert.match(monsterName(ghost), /.+['’](?:s)? ghost$/);
});
void test('an adjective does not disclose an unseen monster', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const stalker = await createMonsterAt('stalker', 11, 10);
    assert.equal(monsterName(stalker, { adjective: 'immobile', capitalized: true }), 'It');
});
void test('a named mount hides its saddle and a proper name gains an adjective article', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    setMonsterGivenName(pony, 'Penny');
    assert.equal(monsterName(pony, { adjective: 'immobile', capitalized: true }), 'The immobile Penny');
    const medusa = await createMonsterAt('Medusa', 12, 10);
    assert.equal(monsterName(medusa, { adjective: 'immobile', capitalized: true }), 'The immobile Medusa');
});
void test('a shopkeeper adjective suppresses its invisibility and changed species description', async () => {
    freshObjectRoom({ hero: { detectMonsters: true } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = 'Izchak';
    await changeMonsterForm(shopkeeper, MONSTER_NAME.indexOf('blue dragon'));
    shopkeeper.minvis = true;
    assert.equal(monsterName(shopkeeper, { adjective: 'immobile', capitalized: true }), 'The immobile Izchak');
});
void test('a priest title ignores an adjective unless it is mimicking another monster', async () => {
    const priest = await createAstralPriest();
    requirePlayingGame(game);
    standOnEmptyFloor(priest, true);
    const ordinary = monsterName(priest, { capitalized: true });
    assert.equal(monsterName(priest, { adjective: 'immobile', capitalized: true }), ordinary);
    priest.m_ap_type = M_AP_MONSTER;
    priest.mappearance = MONSTER_NAME.indexOf('kitten');
    assert.equal(monsterName(priest, { adjective: 'immobile', capitalized: true }), 'The immobile kitten');
});
void test('explicit shopkeeper names change under hallucination but retain stored identity', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = '+KeeperControl';
    assert.equal(shopkeeperName(shopkeeper), 'KeeperControl');
    game.u.hallucinationTurns = 20;
    const displayed = new Set();
    for (let attempt = 0; attempt < 32; attempt++)
        displayed.add(shopkeeperName(shopkeeper));
    assert.ok(displayed.size > 1);
    assert.equal(displayed.has('KeeperControl'), false);
    assert.ok([...displayed].every(name => /^[A-Za-z]/.test(name)));
    assert.equal(shopkeeper.eshk.shknam, '+KeeperControl');
    game.program_state.gameover = true;
    assert.equal(shopkeeperName(shopkeeper), 'KeeperControl');
});
void test('a forced-gender possessive identifies an unseen humanoid but not an animal', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.minvis = true;
    shopkeeper.female = true;
    const dog = await createMonsterAt('little dog', 12, 10);
    dog.minvis = true;
    dog.female = true;
    assert.equal(monsterPossessive(shopkeeper), 'its');
    assert.equal(monsterPossessive(shopkeeper, { noIt: true }), 'her');
    assert.equal(monsterPossessive(dog, { noIt: true }), 'its');
});
void test('capitalizing a shopkeeper name does not change its stored spelling', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = '-lowercase';
    assert.equal(shopkeeperName(shopkeeper, { capitalized: true }), 'Lowercase');
    assert.equal(shopkeeper.eshk.shknam, '-lowercase');
});
void test('Minetown residents have identities and its lighting shop belongs to Izchak', async () => {
    const active = freshSpecialLevel({ prototype: 'minetn', variant: 4, seed: 1701, depth: 3 });
    requirePlayingGame(game);
    game.dungeons.push({
        dname: 'Gnomish Mines', depth_start: 3, num_dunlevs: 8, entry_lev: 1, dunlev_ureached: 1,
        flags: { maze_like: false, hellish: false, alignment: null },
        bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
    });
    game.mines_dnum = 1;
    game.u.uz.dnum = 1;
    game.ubirthday = 900000000;
    await generateMinetown(active);
    const keepers = game.level.monsters.filter(monster => monster.isshk);
    assert.ok(keepers.length > 1);
    assert.ok(keepers.every(keeper => typeof keeper.eshk?.shknam === 'string'
        && keeper.eshk.shknam.length > 0));
    const lighting = keepers.find(keeper => keeper.eshk?.shoptype === SHOPBASE + 11);
    assert.ok(lighting);
    assert.equal(shopkeeperName(lighting), 'Izchak');
    assert.equal(lighting.female, false);
});
void test('indefinite monster names choose the article from the full description', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const blob = await createMonsterAt('acid blob', 11, 10);
    const guard = await createMonsterAt('guard', 12, 10);
    assert.equal(monsterName(blob, { article: 'a' }), 'an acid blob');
    assert.equal(monsterName(guard, { article: 'a', adjective: 'angry' }), 'an angry guard');
});
void test('indefinite descriptions retain personal names and unique monster titles', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 11, 10);
    setMonsterGivenName(dog, 'Polaris');
    const medusa = await createMonsterAt('Medusa', 12, 10);
    assert.equal(monsterName(dog, { article: 'a' }), 'Polaris');
    assert.equal(monsterName(dog, { article: 'a', adjective: 'angry' }), 'an angry Polaris');
    assert.equal(monsterName(medusa, { article: 'a', adjective: 'angry' }), 'the angry Medusa');
});
void test('explicit unseen names retain pet ownership without changing visibility', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const stalker = await createMonsterAt('stalker', 11, 10);
    const description = { article: 'your', suppressIt: true, capitalized: true };
    assert.equal(monsterName(stalker), 'it');
    assert.equal(monsterName(stalker, description), 'The invisible stalker');
    initializePet(stalker, { state: game });
    assert.equal(monsterName(stalker, description), 'Your invisible stalker');
    assert.equal(monsterName(stalker), 'it');
});
void test('an explicit adjective projection can retain a named monster saddle', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    setMonsterGivenName(pony, 'Penny');
    assert.equal(monsterName(pony, {
        article: 'a', adjective: 'angry', suppressSaddle: false,
    }), 'an angry saddled Penny');
});
void test('naming an unseen creature explicitly still honors hallucination', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    const stalker = await createMonsterAt('stalker', 11, 10);
    const names = new Set();
    for (let i = 0; i < 20; i++)
        names.add(monsterName(stalker, { article: 'your', suppressIt: true }));
    assert.equal(names.has('it'), false);
    assert.ok(names.size > 1);
    assert.equal(monsterName(stalker), 'it');
});
void test('indefinite minion titles adjust articles for invisibility and renegades', async () => {
    freshObjectRoom({ hero: { detectMonsters: true } });
    requirePlayingGame(game);
    const angel = await createMonsterAt('Angel', 11, 10);
    angel.isminion = 1;
    angel.emin = { min_align: 1, renegade: false };
    assert.match(monsterName(angel, { article: 'a' }), /^an Angel of /);
    angel.emin.renegade = true;
    assert.match(monsterName(angel, { article: 'a' }), /^a renegade Angel of /);
    angel.minvis = true;
    assert.match(monsterName(angel, { article: 'a' }), /^an invisible renegade Angel of /);
});
//# sourceMappingURL=monster_name.test.js.map