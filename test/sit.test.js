import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import {
    ALTAR, Align2amask, BEAR_TRAP, FOUNTAIN, LANDMINE, PIT, TELEP_TRAP,
    THRONE, TT_BEARTRAP, TT_PIT, TT_WEB, WEB,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    CLUB, CREAM_PIE, WHITE_DRAGON_SCALE_MAIL,
} from '../js/object_data.js';
import { attrcurse, rndcurse } from '../js/throne.js';
import { applyArmorOnEffects } from '../js/armor.js';
import {
    grantIntrinsicProperty, hasIntrinsicProperty,
} from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import {
    addInventoryObject, floorObject,
} from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('sitting on cream pies crushes the whole floor stack', async () => {
    const level = freshGameplayRoom();
    const pies = floorObject(CREAM_PIE, 10, 10, {
        plural: 'cream pies',
        quan: 2,
        quantity: 2,
    });
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(level.objects[10][10].includes(pies), false);
    assert.match(game._pending_message, /Squelch!/);
});

test('sitting on your own altar costs Wisdom and alignment', async () => {
    const level = freshGameplayRoom();
    level.at(10, 10).typ = ALTAR;
    level.at(10, 10).flags = Align2amask(game.u.ualign.type);
    game.u.amax = { a: [...game.u.acurr.a] };
    pushKeys('sit\n ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.acurr.a[2], 9);
    assert.equal(game.u.ualign.record, 9);
});

test('a throne can take all carried gold', async () => {
    const level = freshGameplayRoom();
    level.at(10, 10).typ = THRONE;
    setHeroGoldAmount(game, 250);
    initRng(125n);
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(heroGoldAmount(game), 0);
});

test("Vlad's throne greases carried equipment", async () => {
    const level = freshGameplayRoom();
    level.at(10, 10).typ = THRONE;
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [{ dname: "Vlad's Tower" }];
    const club = addInventoryObject(CLUB, { invlet: 'a' });
    initRng(21n);
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(club.greased, true);
    assert.ok(game.u.glibTurns >= 100 && game.u.glibTurns <= 200);
});

test('a gremlin sitting in water creates a tame clone', async () => {
    const level = freshGameplayRoom();
    level.at(10, 10).typ = FOUNTAIN;
    game.plname = 'Splitter';
    game.mvitals = [];
    installPolymorphedHero('gremlin', {
        turns: 300,
        hitPoints: 17,
    });
    initRng(3510n);
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.ok(level.monsters.some(monster =>
        monster.mnum === 40 && monster.mtame > 0));
});

test('a cockatrice held by another monster cannot sit down', async () => {
    freshGameplayRoom();
    installPolymorphedHero('cockatrice');
    game.u.ustuck = addMonster({
        species: 'jackal',
        x: game.u.ux,
        y: game.u.uy,
    });
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /has no lap/);
});

test('sitting on a bear trap catches the hero', async () => {
    const level = freshGameplayRoom();
    addTrap(level, BEAR_TRAP, 10, 10);
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.utraptype, TT_BEARTRAP);
});

test('sitting on a teleport trap moves the hero', async () => {
    const level = freshGameplayRoom();
    addTrap(level, TELEP_TRAP, 10, 10, {
        teledest: { x: 12, y: 10 },
    });
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
});

test('sitting over a pit leaves the hero trapped in it', async () => {
    const level = freshGameplayRoom();
    addTrap(level, PIT, 10, 10);
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.utraptype, TT_PIT);
});

test('sitting on a web entangles the hero', async () => {
    const level = freshGameplayRoom();
    addTrap(level, WEB, 10, 10);
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.utraptype, TT_WEB);
});

test('sitting on a land mine blasts a pit under the hero', async () => {
    const level = freshGameplayRoom();
    const mine = addTrap(level, LANDMINE, 10, 10);
    pushKeys('sit\n  ');

    await rhack('#'.charCodeAt(0));

    assert.equal(mine.ttyp, PIT);
    assert.equal(game.u.utraptype, TT_PIT);
});

test('a malignant aura curses an ordinary inventory item', async () => {
    freshGameplayRoom();
    const club = addInventoryObject(CLUB, { invlet: 'a' });

    await rndcurse();

    assert.equal(club.cursed, true);
    assert.equal(club.buc, 'cursed');
});

test('an attribute curse removes intrinsic but not worn resistance', async () => {
    freshGameplayRoom();
    const armor = addInventoryObject(WHITE_DRAGON_SCALE_MAIL, {
        o_id: 42,
        worn: true,
    });
    game.uarm = armor;
    grantIntrinsicProperty('coldResistance', 'race', game);
    applyArmorOnEffects(armor, game);
    initRng(15n);

    await attrcurse();

    assert.equal(hasIntrinsicProperty('coldResistance', null, game), false);
    assert.equal(game.u.coldResistance, true);
});
