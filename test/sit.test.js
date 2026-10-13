import { createDungeon } from './support/topology.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { discoverArtifact } from '../js/artifacts.js';
import { ALTAR, Align2amask, BEAR_TRAP, FOUNTAIN, LANDMINE, PIT, TELEP_TRAP, THRONE, TT_BEARTRAP, TT_PIT, TT_WEB, WEB, } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { requireScreenRow } from './support/screen.js';
import { CLUB, CORPSE, CREAM_PIE, SLIME_MOLD, WHITE_DRAGON_SCALE_MAIL, } from '../js/object_data.js';
import { attrcurse, rndcurse } from '../js/throne.js';
import { applyArmorOnEffects } from '../js/armor.js';
import { grantIntrinsicProperty, hasIntrinsicProperty, } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { addFruit } from '../js/fruit.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { addInventoryObject, floorArtifact, floorObject, } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
void test('sitting on a corpse describes the seat before its discomfort', async () => {
    freshGameplayRoom();
    await floorObject(CORPSE, 10, 10, { corpsenm: 0, name: 'giant ant corpse' });
    pushKeys('sit\n');
    await rhack('#'.charCodeAt(0));
    assert.match(game._pending_message, /You sit on the corpse\.  It's not very comfortable\.\.\./);
    assert.equal(game.context.move, 1);
});
for (const [artifact, seat] of [
    ['Excalibur', 'Excalibur'],
    ['The Orb of Detection', 'the Orb of Detection'],
]) {
    void test(`sitting on ${artifact} uses its native article`, async () => {
        freshGameplayRoom();
        const object = await floorArtifact(artifact, 10, 10, { rknown: true });
        assert.ok(object.oartifact);
        discoverArtifact(object.oartifact);
        pushKeys('sit\n');
        await rhack('#'.charCodeAt(0));
        assert.equal(game._pending_message, `You sit on ${seat}.  It's not very comfortable...`);
        assert.equal(game.context.move, 1);
    });
}
void test('sitting on the Platinum card supplies its article before the discomfort pager', async () => {
    freshGameplayRoom();
    const card = await floorArtifact('The Platinum Yendorian Express Card', 10, 10, { rknown: true });
    assert.ok(card.oartifact);
    discoverArtifact(card.oartifact);
    const input = resetInputState();
    input.feed('sit\n');
    const sitting = rhack('#'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), 'You sit on the Platinum Yendorian Express Card.--More--');
    }
    finally {
        input.feed(' ');
        await sitting;
    }
    assert.equal(game._pending_message, 'It\'s not very comfortable...');
    assert.equal(game.context.move, 1);
});
for (const fruit of ['Mango', 'Ex-Cali-Bur']) {
    void test(`sitting on ${fruit} treats the fruit name as an ordinary noun`, async () => {
        freshGameplayRoom();
        await floorObject(SLIME_MOLD, 10, 10, { spe: addFruit(fruit) });
        pushKeys('sit\n');
        await rhack('#'.charCodeAt(0));
        assert.equal(game._pending_message, `You sit on the ${fruit}.  It's not very comfortable...`);
        assert.equal(game.context.move, 1);
    });
}
void test('sitting on cream pies crushes the whole floor stack', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    const pies = await floorObject(CREAM_PIE, 10, 10, {
        plural: 'cream pies',
        quan: 2,
        quantity: 2,
    });
    pushKeys('sit\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(level.objects[10]?.[10]?.includes(pies) ?? false, false);
    assert.match(game._pending_message, /Squelch!/);
});
void test('sitting on your own altar costs Wisdom and alignment', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = ALTAR;
    level.requireAt(10, 10).flags = Align2amask(game.u.ualign.type);
    game.u.amax = { a: [...game.u.acurr.a] };
    pushKeys('sit\n  ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.acurr.a[2], 9);
    assert.equal(game.u.ualign.record, 9);
});
void test('a throne can take all carried gold', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = THRONE;
    setHeroGoldAmount(game, 250);
    initRng(125n);
    pushKeys('sit\n ');
    await rhack('#'.charCodeAt(0));
    assert.equal(heroGoldAmount(game), 0);
});
void test("Vlad's throne greases carried equipment", async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = THRONE;
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [createDungeon({ dname: "Vlad's Tower" })];
    const club = await addInventoryObject(CLUB, { invlet: 'a' });
    initRng(21n);
    pushKeys('sit\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(club.greased, true);
    assert.ok(game.u.glibTurns != null, 'Expected game.u.glibTurns to be initialized');
    assert.ok(game.u.glibTurns >= 100 && game.u.glibTurns <= 200);
});
void test('a gremlin sitting in water creates a tame clone', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = FOUNTAIN;
    game.plname = 'Splitter';
    game.mvitals = [];
    installPolymorphedHero('gremlin', {
        turns: 300,
        hitPoints: 17,
    });
    initRng(3510n);
    pushKeys('sit\n');
    await rhack('#'.charCodeAt(0));
    assert.ok(level.monsters.some(monster => monster.mnum === 40 && (monster.mtame ?? 0) > 0));
});
void test('a cockatrice held by another monster cannot sit down', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    installPolymorphedHero('cockatrice');
    game.u.ustuck = await createMonsterAt('jackal', 11, 10);
    pushKeys('sit\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /has no lap/);
});
void test('sitting on a bear trap catches the hero', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    addTrap(level, BEAR_TRAP, 10, 10);
    pushKeys('sit\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.utraptype, TT_BEARTRAP);
});
void test('sitting on a teleport trap moves the hero', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    addTrap(level, TELEP_TRAP, 10, 10, {
        teledest: { x: 12, y: 10 },
    });
    pushKeys('sit\n');
    await rhack('#'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
});
void test('sitting over a pit leaves the hero trapped in it', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    addTrap(level, PIT, 10, 10);
    pushKeys('sit\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.utraptype, TT_PIT);
});
void test('sitting on a web entangles the hero', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    addTrap(level, WEB, 10, 10);
    pushKeys('sit\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.utraptype, TT_WEB);
});
void test('sitting on a land mine blasts a pit under the hero', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    const mine = addTrap(level, LANDMINE, 10, 10);
    pushKeys('sit\n  ');
    await rhack('#'.charCodeAt(0));
    assert.equal(mine.ttyp, PIT);
    assert.equal(game.u.utraptype, TT_PIT);
});
void test('a malignant aura curses an ordinary inventory item', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const club = await addInventoryObject(CLUB, { invlet: 'a' });
    await rndcurse();
    assert.equal(club.cursed, true);
    assert.equal(club.buc, 'cursed');
});
void test('an attribute curse removes intrinsic but not worn resistance', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const armor = await addInventoryObject(WHITE_DRAGON_SCALE_MAIL, {
        o_id: 42,
        worn: true,
    });
    game.uarm = armor;
    grantIntrinsicProperty('coldResistance', 'race', game);
    await applyArmorOnEffects(armor, game);
    initRng(15n);
    await attrcurse();
    assert.equal(hasIntrinsicProperty('coldResistance', null, game), false);
    assert.equal(game.u.coldResistance, true);
});
//# sourceMappingURL=sit.test.js.map