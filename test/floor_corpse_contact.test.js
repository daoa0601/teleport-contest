import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { LAVAPOOL } from '../js/const.js';
import { gameLogEvents } from '../js/gamelog.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { heroCanReachFloor } from '../js/floor_reach.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, LEATHER_GLOVES } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { heroCannotTake, polymonHero } from '../js/polyself.js';
import { heroResistsStoning } from '../js/stoning.js';
import { applyHeroContactPassive } from '../js/monster_passive.js';
import { createMonsterAt } from './support/monsters.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const finds = () => gameLogEvents().filter(event => event.text.startsWith('found '));
async function dangerousPile({ artifact = true, quantity = 1 } = {}) {
    let magicbane;
    if (artifact) {
        const identity = artifactByName('Magicbane');
        assert.ok(identity !== null && identity !== undefined);
        magicbane = await floorObject(identity.baseType, game.u.ux, game.u.uy, {
            dknown: true, known: false, bknown: false,
        });
        nameArtifact(magicbane, identity);
    }
    const corpse = await floorObject(CORPSE, game.u.ux, game.u.uy, {
        initialize: false, corpsenm: MONSTER_NAME.indexOf('cockatrice'),
        quan: quantity, dknown: false, bknown: false,
    });
    return { corpse, magicbane };
}
for (const pile of ['single', 'multiple', 'count only']) {
    void test(`blind inspection of a ${pile} corpse pile can petrify the hero`, async () => {
        freshObjectRoom({ flags: { pickup: false, pile_limit: 1 } });
        requireFixtureGame(game);
        await dangerousPile({ artifact: pile !== 'single' });
        const engraving = makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth');
        setHeroBlindnessTurns(20);
        pushKeys(' '.repeat(100));
        if (pile === 'count only')
            await autopickupAtHero();
        else
            await rhack(':'.charCodeAt(0));
        assert.ok(game.program_state.gameover);
        assert.equal(game._deathKiller, 'touching a cockatrice corpse bare-handed');
        assert.equal(finds().length, 0, 'inspection must stop before the following artifact');
        assert.ok(engraving !== null && engraving !== undefined);
        assert.equal(engraving.eread, pile !== 'multiple', 'a multi-object window reads the engraving only after surviving contact');
    });
}
for (const protectedBy of ['sight', 'gloves', 'stone golem form']) {
    void test(`${protectedBy} allows inspection beyond a cockatrice corpse`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        await dangerousPile();
        pushKeys(' '.repeat(100));
        if (protectedBy === 'gloves')
            await wearHeroArmor(await addInventoryObject(LEATHER_GLOVES));
        if (protectedBy === 'stone golem form')
            await polymonHero(MONSTER_NAME.indexOf('stone golem'));
        if (protectedBy !== 'sight')
            setHeroBlindnessTurns(20);
        await rhack(':'.charCodeAt(0));
        assert.ok(!game.program_state.gameover);
        assert.equal(finds().length, 1);
        assert.equal(finds()[0]?.text, 'found Magicbane on the floor');
    });
}
void test('life saving survives tactile contact but does not resume the interrupted pile list', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const { magicbane } = await dangerousPile();
    const engraving = makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth');
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    setHeroBlindnessTurns(20);
    pushKeys(' '.repeat(100));
    await rhack(':'.charCodeAt(0));
    assert.ok(!game.program_state.gameover);
    assert.ok(game.u.uhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.ok(magicbane !== null && magicbane !== undefined);
    assert.equal(magicbane.where, 'floor');
    assert.equal(finds().length, 0);
    assert.ok(engraving !== null && engraving !== undefined);
    assert.ok(engraving.eread, 'life saving returns to the post-contact engraving read');
});
void test('a flesh golem turns into a stone golem after feeling the corpse', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await dangerousPile();
    pushKeys(' '.repeat(100));
    await polymonHero(MONSTER_NAME.indexOf('flesh golem'));
    setHeroBlindnessTurns(20);
    await rhack(':'.charCodeAt(0));
    assert.ok(!game.program_state.gameover);
    assert.equal(MONSTER_NAME[game.u.umonnum], 'stone golem');
    assert.equal(finds().length, 0);
});
void test('count-only corpse contact neither inspects beatitude nor reports a singular killer for a stack', async () => {
    freshObjectRoom({ role: 'priest', flags: { pickup: false, pile_limit: 1 } });
    requireFixtureGame(game);
    const { corpse } = await dangerousPile({ artifact: false, quantity: 2 });
    setHeroBlindnessTurns(20);
    pushKeys(' '.repeat(100));
    await autopickupAtHero();
    assert.ok(game.program_state.gameover);
    assert.equal(game._deathKiller, 'touching cockatrice corpses bare-handed');
    assert.ok(!corpse.bknown);
});
void test('fatal tactile contact stops the no-pickup-form feedback tail', async () => {
    freshObjectRoom({ flags: { pickup: false } });
    requireFixtureGame(game);
    await dangerousPile({ artifact: false });
    pushKeys(' '.repeat(100));
    await polymonHero(MONSTER_NAME.indexOf('brown mold'));
    setHeroBlindnessTurns(20);
    assert.ok(heroCannotTake(game));
    assert.ok(!heroResistsStoning());
    await autopickupAtHero();
    assert.ok(game.program_state.gameover);
    assert.doesNotMatch(game._pending_message, /physically incapable/);
});
for (const levitating of [false, true]) {
    void test(`controlled teleport ${levitating ? 'cannot reach' : 'feels'} a corpse below the hero`, async () => {
        freshObjectRoom({ flags: { debug: true, pickup: false } });
        requireFixtureGame(game);
        const corpse = await floorObject(CORPSE, 12, 10, {
            initialize: false, corpsenm: MONSTER_NAME.indexOf('cockatrice'),
        });
        setHeroBlindnessTurns(20);
        if (levitating)
            grantIntrinsicProperty('levitation', 'outside');
        assert.equal(heroCanReachFloor(game), !levitating);
        game._travelTipShown = true;
        const hunger = game.u.uhunger;
        pushKeys('ll.' + ' y'.repeat(30));
        await rhack(20);
        assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
        assert.equal(!!game.program_state.gameover, !levitating);
        assert.equal(corpse.where, 'floor');
        assert.equal(game.u.uhunger, hunger - (levitating ? 100 : 0), 'nutrition is charged only after surviving destination effects');
    });
}
void test('a fatal stone-golem conversion reports the lava death, not survival', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    pushKeys(' '.repeat(100));
    await polymonHero(MONSTER_NAME.indexOf('iron golem'));
    assert.ok(game.u.fireResistance);
    assert.ok(!heroResistsStoning());
    game.level.requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    const cockatrice = await createMonsterAt('cockatrice', 11, 10);
    const result = await applyHeroContactPassive(cockatrice, { hit: true });
    assert.ok(game.program_state.gameover);
    assert.ok(result.heroDied);
    assert.ok(game._deathKiller);
    assert.match(game._deathKiller, /lava/);
});
//# sourceMappingURL=floor_corpse_contact.test.js.map