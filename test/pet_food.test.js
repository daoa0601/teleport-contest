import test from 'node:test';
import assert from 'node:assert/strict';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { nameToMonster } from '../js/mondata.js';
import { AMULET_OF_STRANGULATION, APPLE, BANANA, BOULDER, CARROT, CLOVE_OF_GARLIC, CORPSE, DAGGER, EGG, GLOB_OF_GREEN_SLIME, HEAVY_IRON_BALL, LARGE_BOX, LEATHER_ARMOR, LUMP_OF_ROYAL_JELLY, MEATBALL, OBJECT_NAMES, RIN_SLOW_DIGESTION, ROCK, TIN, TRIPE_RATION, } from '../js/object_data.js';
import { ACCFOOD, APPORT, CADAVER, DOGFOOD, MANFOOD, POISON, TABU, UNDEF, dogFood, } from '../js/pet_food.js';
import { rn2 } from '../js/rng.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const SILVER_SABER = OBJECT_NAMES.indexOf('silver saber');
async function pet(species) {
    const monster = await createMonsterAt(species, 11, 10);
    initializePet(monster);
    return monster;
}
function quality(monster, object) {
    return dogFood(monster, object, rn2, [], game);
}
function starve(monster) {
    assert.ok(monster.edog);
    monster.edog.mhpmax_penalty = 5;
}
async function corpse(species, age = game.moves) {
    return await knownObject(CORPSE, { corpsenm: nameToMonster(species), age });
}
void test('pet diets prefer meat for dogs, apples for horses, and bananas for monkeys', async () => {
    freshObjectRoom();
    const dog = await pet('little dog');
    const horse = await createMonsterAt('pony', 12, 10);
    const monkey = await createMonsterAt('monkey', 13, 10);
    const meat = await knownObject(TRIPE_RATION);
    const apple = await knownObject(APPLE);
    const banana = await knownObject(BANANA);
    assert.equal(quality(dog, meat), DOGFOOD);
    assert.equal(quality(horse, meat), MANFOOD);
    assert.equal(quality(horse, apple), DOGFOOD);
    assert.equal(quality(dog, apple), MANFOOD);
    assert.equal(quality(monkey, banana), DOGFOOD);
    assert.equal(quality(horse, banana), ACCFOOD);
});
void test('starvation relaxes food preferences only for a tame non-minion', async () => {
    freshObjectRoom();
    const dog = await pet('little dog');
    const apple = await knownObject(APPLE);
    starve(dog);
    assert.equal(quality(dog, apple), ACCFOOD);
    dog.mtame = 0;
    assert.equal(quality(dog, apple), MANFOOD);
    dog.mtame = 10;
    dog.isminion = true;
    assert.equal(quality(dog, apple), MANFOOD);
});
void test('a blind carnivore with eyes seeks carrots, but an eyeless carnivore does not', async () => {
    freshObjectRoom();
    const dog = await pet('little dog');
    const piercer = await createMonsterAt('rock piercer', 12, 10);
    const carrot = await knownObject(CARROT);
    dog.mcansee = false;
    piercer.mcansee = false;
    assert.equal(quality(dog, carrot), DOGFOOD);
    assert.equal(quality(piercer, carrot), MANFOOD);
});
void test('corpse decay follows the fifty-turn threshold and slowing by ice', async () => {
    freshObjectRoom({ moves: 100 });
    const dog = await pet('little dog');
    const meat = await corpse('newt', 51);
    assert.equal(quality(dog, meat), CADAVER);
    meat.age = 50;
    assert.equal(quality(dog, meat), POISON);
    meat.on_ice = true;
    assert.equal(quality(dog, meat), CADAVER);
    meat.age = 0;
    assert.equal(quality(dog, meat), POISON);
    assert.equal(quality(dog, await corpse('lizard', 0)), CADAVER);
});
void test('fungi only fetch corpses while ghouls prefer old flesh and stale eggs', async () => {
    freshObjectRoom({ moves: 500 });
    const fungus = await pet('violet fungus');
    const ghoul = await createMonsterAt('ghoul', 12, 10);
    initializePet(ghoul);
    assert.equal(quality(fungus, await corpse('lichen', 0)), APPORT);
    assert.equal(quality(ghoul, await corpse('newt', 0)), DOGFOOD);
    assert.equal(quality(ghoul, await corpse('newt')), POISON);
    const egg = await knownObject(EGG, { corpsenm: nameToMonster('newt'), age: 99 });
    assert.equal(quality(ghoul, egg), CADAVER);
    egg.age = 100;
    assert.equal(quality(ghoul, egg), POISON);
    starve(ghoul);
    assert.equal(quality(ghoul, egg), ACCFOOD);
    assert.equal(quality(ghoul, await corpse('newt')), ACCFOOD);
    assert.equal(quality(ghoul, await corpse('lichen')), POISON);
    assert.equal(quality(ghoul, await knownObject(MEATBALL)), TABU);
});
void test('pets account for gained poison, acid, and stone resistance when judging food', async () => {
    freshObjectRoom();
    const dog = await pet('little dog');
    const poisonous = await corpse('killer bee');
    const acidic = await corpse('acid blob');
    const petrifying = await corpse('Medusa');
    assert.equal(quality(dog, poisonous), POISON);
    assert.equal(quality(dog, acidic), POISON);
    assert.equal(quality(dog, petrifying), POISON);
    dog.mintrinsics = 0x20 | 0x40 | 0x80;
    assert.equal(quality(dog, poisonous), CADAVER);
    assert.equal(quality(dog, acidic), MANFOOD);
    assert.equal(quality(dog, petrifying), CADAVER);
});
void test('pets avoid shapeshifter corpses unless starving or abused', async () => {
    freshObjectRoom();
    const dog = await pet('little dog');
    const chameleon = await corpse('chameleon');
    assert.equal(quality(dog, chameleon), MANFOOD);
    dog.mtame = 1;
    assert.equal(quality(dog, chameleon), CADAVER);
    dog.mtame = 10;
    starve(dog);
    assert.equal(quality(dog, chameleon), CADAVER);
});
void test('same-race humanoid flesh is taboo except for native starvation and orc exceptions', async () => {
    freshObjectRoom();
    const dwarf = await pet('dwarf');
    const elf = await createMonsterAt('elf', 12, 10);
    const orc = await createMonsterAt('orc', 13, 10);
    initializePet(elf);
    const dwarfCorpse = await corpse('dwarf');
    const elfCorpse = await corpse('elf');
    assert.equal(quality(dwarf, dwarfCorpse), TABU);
    starve(dwarf);
    assert.equal(quality(dwarf, dwarfCorpse), ACCFOOD);
    starve(elf);
    assert.equal(quality(elf, elfCorpse), TABU);
    assert.equal(quality(orc, await corpse('orc')), CADAVER);
});
void test('pyrolisk eggs and slime are unsafe food; starvation permits slime', async () => {
    freshObjectRoom();
    const dog = await pet('little dog');
    const salamander = await createMonsterAt('salamander', 12, 10);
    const egg = await knownObject(EGG, { corpsenm: nameToMonster('pyrolisk') });
    const slime = await knownObject(GLOB_OF_GREEN_SLIME);
    assert.equal(quality(dog, egg), POISON);
    assert.equal(quality(salamander, egg), APPORT);
    assert.equal(quality(dog, slime), POISON);
    assert.equal(quality(salamander, slime), APPORT);
    starve(dog);
    assert.equal(quality(dog, slime), ACCFOOD);
});
void test('a killer bee refuses royal jelly while a living queen is on its level', async () => {
    freshObjectRoom();
    const bee = await pet('killer bee');
    const jelly = await knownObject(LUMP_OF_ROYAL_JELLY);
    assert.equal(quality(bee, jelly), DOGFOOD);
    const queen = await createMonsterAt('queen bee', 12, 10);
    assert.equal(quality(bee, jelly), TABU);
    queen.mhp = 0;
    assert.equal(quality(bee, jelly), DOGFOOD);
});
void test('metal eaters distinguish iron, rustproof iron, silver, and tins', async () => {
    freshObjectRoom();
    const rustMonster = await pet('rust monster');
    const xorn = await createMonsterAt('xorn', 12, 10);
    const dagger = await knownObject(DAGGER);
    const silver = await knownObject(SILVER_SABER);
    assert.equal(quality(rustMonster, dagger), DOGFOOD);
    dagger.oerodeproof = true;
    assert.equal(quality(rustMonster, dagger), ACCFOOD);
    assert.equal(quality(rustMonster, silver), APPORT);
    assert.equal(quality(xorn, silver), ACCFOOD);
    assert.equal(quality(xorn, await knownObject(TIN)), APPORT);
});
void test('cube digestion, silver hatred, garlic, and dangerous jewelry take precedence over fetching', async () => {
    freshObjectRoom();
    const cube = await pet('gelatinous cube');
    const vampire = await createMonsterAt('vampire', 12, 10);
    const dog = await createMonsterAt('little dog', 13, 10);
    assert.equal(quality(cube, await knownObject(LEATHER_ARMOR)), ACCFOOD);
    assert.equal(quality(vampire, await knownObject(SILVER_SABER)), TABU);
    assert.equal(quality(vampire, await knownObject(CLOVE_OF_GARLIC)), TABU);
    assert.equal(quality(cube, await knownObject(AMULET_OF_STRANGULATION)), TABU);
    assert.equal(quality(cube, await knownObject(RIN_SLOW_DIGESTION)), TABU);
    assert.equal(quality(dog, await knownObject(ROCK)), APPORT);
    assert.equal(quality(dog, await knownObject(BOULDER)), UNDEF);
    assert.equal(quality(dog, await knownObject(HEAVY_IRON_BALL)), UNDEF);
});
void test('quest artifacts are protected and pets avoid weapon poison and trapped containers', async () => {
    freshObjectRoom();
    const dog = await pet('little dog');
    assert.ok(game.urole);
    const artifact = await artifactObject(game.urole.artifactName, { cursed: true });
    assert.equal(quality(dog, artifact), TABU);
    artifact.cursed = false;
    assert.equal(quality(dog, artifact), APPORT);
    const dagger = await knownObject(DAGGER, { opoisoned: true });
    assert.equal(quality(dog, dagger), POISON);
    assert.equal(quality(dog, await knownObject(LARGE_BOX, { otrapped: true })), POISON);
});
//# sourceMappingURL=pet_food.test.js.map