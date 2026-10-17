import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { MM_FEMALE, NO_MINVENT, W_AMUL } from '../js/const.js';
import { canSpotMonster, clearMessageWindow, monsterKillLineVisible, plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_DCAY, AD_DGST, AD_FIRE, AD_MAGM, AD_PHYS, AD_RUST } from '../js/monster_attack_types.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { nameToMonster } from '../js/mondata.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, CLUB, CORPSE, IRON_CHAIN, QUARTERSTAFF, RIN_CONFLICT, SCR_BLANK_PAPER, } from '../js/object_data.js';
import { objectMaterial } from '../js/object_material.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';
function screenText() {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
function acknowledgeDeathMessages() {
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        const screen = screenText();
        assert.match(screen, /--More--/, 'death only requests message acknowledgement');
        messages.push(screen);
        input.feed(' ');
    };
    return messages;
}
for (const [species, invisible, message] of [
    ['hill giant', false, 'The hill giant is killed by the magic missile!'],
    ['iron golem', false, 'The iron golem is destroyed by the magic missile!'],
    ['iron golem', true, 'It is destroyed by the magic missile!'],
]) {
    void test(`a killed ${invisible ? 'unspotted' : 'visible'} ${species} receives its native death description`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 12, 10, NO_MINVENT);
        monster.minvis = invisible;
        assert.equal(monsterKillLineVisible(monster), true);
        assert.equal(canSpotMonster(monster), !invisible);
        const messages = acknowledgeDeathMessages();
        const death = await finishMonsterKilled(monster, game, {
            damageType: AD_MAGM, cause: 'magic missile',
        });
        assert.equal(death.survived, false);
        assert.notEqual(monsterAtPosition(level, monster.mx, monster.my), monster);
        assert.ok([...messages, game._pending_message].join('\n').includes(message));
    });
}
for (const lifeSaving of [false, true]) {
    void test(`an unseen pet ${lifeSaving ? 'survives with its amulet without a sad feeling' : 'causes a sad feeling only when truly lost'}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const dog = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
        initializePet(dog);
        const amulet = lifeSaving
            ? await equipMonsterObject(dog, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL)
            : null;
        setHeroBlindnessTurns(10);
        vision_recalc(0);
        assert.equal(monsterKillLineVisible(dog), false);
        const messages = acknowledgeDeathMessages();
        initRng(1n);
        const death = await finishMonsterKilled(dog, game, { damageType: AD_PHYS });
        assert.equal(death.survived, lifeSaving);
        assert.equal(monsterAtPosition(level, dog.mx, dog.my) === dog, lifeSaving);
        const text = [...messages, game._pending_message].join('\n');
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.ok(dog.mhp > 0);
            assert.equal(requireMonsterVital(dog.mnum).died, 0);
            assert.doesNotMatch(text, /sad feeling/);
        }
        else {
            assert.equal(dog.mhp, 0);
            assert.equal(requireMonsterVital(dog.mnum).died, 1);
            assert.match(text, /You have a sad feeling for a moment, then it passes\./);
        }
    });
}
void test('digestion suppresses a corpse without destroying the victim inventory', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('hill giant', 12, 10, NO_MINVENT);
    const club = await knownObject(CLUB);
    assert.equal(await addObjectToMonsterInventory(giant, club), club);
    const death = await finishMonsterKilled(giant, game, { damageType: AD_DGST, cause: null });
    assert.equal(death.survived, false);
    assert.equal(death.corpse, null);
    assert.equal(club.where, 'floor');
    assert.equal(club.ocarry, null);
    assert.ok(floorObjectsAt(level, 12, 10).includes(club));
    assert.equal(floorObjectsAt(level, 12, 10).some(object => object.otyp === CORPSE), false);
    assert.equal(game._pending_message, '', 'a null cause suppresses the visible kill line');
});
for (const burns of [false, true]) {
    void test(`a pet paper golem ${burns ? 'burns completely without leaving scrolls' : 'leaves blank scrolls after an ordinary death'}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const paper = await createMonsterAt('paper golem', 12, 10, NO_MINVENT);
        initializePet(paper);
        setMonsterGivenName(paper, 'Folio');
        const messages = acknowledgeDeathMessages();
        initRng(8n);
        const death = await finishMonsterKilled(paper, game, { damageType: burns ? AD_FIRE : AD_PHYS });
        assert.equal(death.survived, false);
        const scrolls = floorObjectsAt(level, 12, 10)
            .filter(object => object.otyp === SCR_BLANK_PAPER)
            .reduce((total, object) => total + object.quan, 0);
        const text = [...messages, game._pending_message].join('\n');
        if (burns) {
            assert.equal(scrolls, 0);
            assert.equal(death.corpse, null);
            assert.match(text, /May Folio roast in peace\./);
        }
        else {
            assert.ok(scrolls >= 1 && scrolls <= 4, `a paper golem should leave 1 to 4 scrolls, got ${scrolls}`);
            assert.doesNotMatch(text, /roast in peace/);
        }
    });
}
for (const [species, damageType, name, epitaph] of [
    ['iron golem', AD_RUST, 'Rusty', 'rust'],
    ['wood golem', AD_DCAY, 'Willow', 'rot'],
]) {
    void test(`a pet ${species} falls to pieces and receives its ${epitaph} epitaph`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const golem = await createMonsterAt(species, 12, 10, NO_MINVENT);
        initializePet(golem);
        setMonsterGivenName(golem, name);
        const messages = acknowledgeDeathMessages();
        initRng(8n);
        const death = await finishMonsterKilled(golem, game, { damageType });
        assert.equal(death.survived, false);
        assert.notEqual(monsterAtPosition(level, golem.mx, golem.my), golem);
        const remains = floorObjectsAt(level, 12, 10);
        assert.ok(remains.length > 0, `${species} must leave material remains`);
        if (damageType === AD_RUST) {
            assert.ok(remains.every(object => object.otyp === IRON_CHAIN));
            const chains = remains.reduce((total, object) => total + object.quan, 0);
            assert.ok(chains >= 2 && chains <= 12, `an iron golem should leave 2 to 12 chains, got ${chains}`);
        }
        else {
            assert.ok(remains.every(object => objectMaterial(object) === objectMaterial(QUARTERSTAFF)), 'the rotted wood golem must leave wooden equipment');
        }
        assert.ok([...messages, game._pending_message].join('\n').includes(`May the ${species} ${epitaph} in peace.`));
    });
}
void test('disintegration lets a shifted vampire pet recover without remains or grief', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const vampire = await createMonsterAt('vampire leader', 12, 10, NO_MINVENT | MM_FEMALE);
    initializePet(vampire);
    const messages = acknowledgeDeathMessages();
    await changeMonsterForm(vampire, nameToMonster('wolf'));
    assert.equal(vampire.mnum, nameToMonster('wolf'));
    assert.equal(vampire.cham, nameToMonster('vampire leader'));
    initRng(8n);
    const death = await finishMonsterKilled(vampire, game, {
        damageType: 'disintegration', cause: null,
    });
    assert.equal(death.survived, true);
    assert.equal(death.corpse, null);
    assert.equal(level.monsters.includes(vampire), true);
    assert.equal(vampire.mnum, nameToMonster('vampire leader'));
    assert.equal(vampire.female, true);
    assert.ok(vampire.mhp > 0);
    assert.equal(floorObjectsAt(level, 12, 10).length, 0);
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /reconstitutes and rises as a vampire lady!/);
    assert.doesNotMatch(text, /sad feeling/);
});
void test('kill narration waits at the pager before detaching the victim and dropping inventory', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('hill giant', 12, 10, NO_MINVENT);
    const club = await knownObject(CLUB);
    assert.equal(await addObjectToMonsterInventory(giant, club), club);
    await plineWithContinuation('You hear a loud rumbling sound somewhere deep in the dungeon.');
    const input = resetInputState();
    const dying = finishMonsterKilled(giant, game, { damageType: AD_PHYS });
    const blocked = await Promise.race([
        input.waitUntilBlocked().then(() => true),
        dying.then(() => false),
    ]);
    try {
        assert.equal(blocked, true, 'the kill line must acknowledge the previous message');
        assert.match(screenText(), /rumbling sound.*--More--/);
        assert.equal(level.monsters.includes(giant), true);
        assert.equal(club.where, 'minvent');
        assert.equal(requireMonsterVital(giant.mnum).died, 0);
        assert.equal(floorObjectsAt(level, 12, 10).length, 0);
    }
    finally {
        input.beforeRead = () => {
            assert.match(screenText(), /--More--/);
            input.feed(' ');
        };
        input.feed(' ');
        await dying;
    }
    assert.notEqual(monsterAtPosition(level, giant.mx, giant.my), giant);
    assert.equal(club.where, 'floor');
    assert.equal(requireMonsterVital(giant.mnum).died, 1);
    assert.ok(floorObjectsAt(level, 12, 10).some(object => object.otyp === CORPSE));
});
for (const swallowed of [false, true]) {
    void test(`a dead ${swallowed ? 'engulfer' : 'holder'} releases the hero and clears its trap`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt(swallowed ? 'purple worm' : 'python', 12, 10, NO_MINVENT);
        game.u.ustuck = monster;
        game.u.uswallow = game.uswallow = swallowed ? 1 : 0;
        monster.mtrapped = 1;
        acknowledgeDeathMessages();
        await finishMonsterKilled(monster, game, { damageType: AD_PHYS });
        assert.equal(game.u.ustuck, null);
        assert.equal(!!game.u.uswallow, false);
        assert.equal(!!game.uswallow, false);
        assert.equal(!!monster.mtrapped, false);
        assert.notEqual(monsterAtPosition(game.level, monster.mx, monster.my), monster);
        if (swallowed) {
            assert.equal(game.u.ux, monster.mx);
            assert.equal(game.u.uy, monster.my);
        }
    });
}
void test('a fatal death explosion ends the Conflict attack before awarding growth', async () => {
    freshObjectRoom({ hero: { uhp: 1, ulevel: 30 }, flags: { verbose: false, disclose: '-i -a -v -c -o' } });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    clearMessageWindow();
    const captain = await createMonsterAt('captain', 12, 10, NO_MINVENT);
    const spore = await createMonsterAt('gas spore', 11, 10, NO_MINVENT);
    spore.mhp = 1;
    spore.mpeaceful = false;
    const maximumHealth = captain.mhpmax;
    const input = resetInputState();
    installPagerInput(input, {
        expected: /captain|spore|explosion|fatal|Goodbye|points|experience|REST|PEACE/i,
        limit: 30,
    });
    initRng(1n);
    const action = await runMonsterAction(captain, game);
    assert.equal(game.program_state.gameover, true);
    assert.equal(action.conflictFight?.heroDied, true);
    assert.equal(captain.mhpmax, maximumHealth, 'the finished game cannot award growth for the kill');
});
//# sourceMappingURL=monster_killed.test.js.map