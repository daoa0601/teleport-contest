import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, ARROW_TRAP, D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, FOUNTAIN, LADDER, SINK, STAIRS, STONE, THRONE, VIBRATING_SQUARE } from '../js/const.js';
import { map_invisible, newsym } from '../js/display.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { mkstairs } from '../js/mklev.js';
import { APPLE, BAG_OF_TRICKS, BOULDER, CHEST, CREDIT_CARD, LOCK_PICK, SADDLE, SKELETON_KEY, SPE_FORCE_BOLT } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { forceLearnSpell } from '../js/spell.js';
import { makeEngravingAt } from '../js/engrave.js';
import { setSlipperyHands } from '../js/towel.js';
import { addTrap } from './support/level-state.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { choose, finish, screen, startMenuGame, type } from './support/context-menu-game.js';
for (const up of [true, false]) {
    for (const ladder of [false, true]) {
        void test(`here menu offers the ${up ? 'up' : 'down'} ${ladder ? 'ladder' : 'stairs'}`, async () => {
            const engine = await startMenuGame();
            try {
                game.u.uz = { dnum: 0, dlevel: 2 };
                await mkstairs(10, 10, up, null, true);
                requireGameLevel().requireAt(10, 10).typ = ladder ? LADDER : STAIRS;
                assert.ok(game.stairs);
                game.stairs.isladder = ladder;
                await type(engine, '#herecmdmenu\n');
                assert.match(screen(), new RegExp(`a - Go ${up ? 'up' : 'down'} the ${ladder ? 'ladder' : 'stairs'}`));
            }
            finally {
                await finish(engine);
            }
        });
    }
}
for (const [terrain, entry] of [
    [FOUNTAIN, 'Drink from the fountain'], [SINK, 'Drink from the sink'],
    [THRONE, 'Sit on the throne'], [ALTAR, 'Sacrifice something on the altar'],
]) {
    void test(`here menu offers ${entry}`, async () => {
        const engine = await startMenuGame();
        try {
            requireGameLevel().requireAt(10, 10).typ = terrain;
            await type(engine, '#herecmdmenu\n');
            assert.match(screen(), new RegExp(`a - ${entry}`));
        }
        finally {
            await finish(engine);
        }
    });
}
void test('here menu offers disarming a seen trap', async () => {
    const engine = await startMenuGame();
    try {
        addTrap(requireGameLevel(), ARROW_TRAP, 10, 10, { tseen: true });
        await type(engine, '#herecmdmenu\n');
        assert.match(screen(), /Attempt to disarm trap/);
    }
    finally {
        await finish(engine);
    }
});
void test('there menu uses a typed direction to offer closed-door actions', async () => {
    const engine = await startMenuGame();
    try {
        const door = requireGameLevel().requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        await type(engine, '#therecmdmenu\nl');
        assert.match(screen(), /a - Open the door/);
        assert.match(screen(), /b - Search the door for a trap/);
        assert.match(screen(), /c - Kick the door/);
    }
    finally {
        await finish(engine);
    }
});
void test('a selected here-menu action inspects the floor without spending a turn', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        await type(engine, '#herecmdmenu\ne');
        assert.match(screen(), /You see no objects here\./);
        assert.equal(game.moves, moves);
    }
    finally {
        await finish(engine);
    }
});
void test('fountain dipping is listed after drinking', async () => {
    const engine = await startMenuGame();
    try {
        requireGameLevel().requireAt(10, 10).typ = FOUNTAIN;
        await type(engine, '#herecmdmenu\n');
        assert.match(screen(), /b - Dip something into the fountain/);
    }
    finally {
        await finish(engine);
    }
});
for (const terrain of [FOUNTAIN, SINK]) {
    void test(`levitation hides unreachable water actions on terrain ${terrain}`, async () => {
        const engine = await startMenuGame();
        try {
            requireGameLevel().requireAt(10, 10).typ = terrain;
            grantIntrinsicProperty('levitation', 'outside');
            await type(engine, '#herecmdmenu\n');
            assert.doesNotMatch(screen(), /Drink from|Dip something/);
        }
        finally {
            await finish(engine);
        }
    });
}
for (const [seen, trap] of [[false, ARROW_TRAP], [true, VIBRATING_SQUARE]]) {
    void test(`here menu omits disarming ${seen ? 'a vibrating square' : 'an unseen trap'}`, async () => {
        const engine = await startMenuGame();
        try {
            addTrap(requireGameLevel(), trap, 10, 10, { tseen: seen });
            await type(engine, '#herecmdmenu\n');
            assert.doesNotMatch(screen(), /Attempt to disarm/);
        }
        finally {
            await finish(engine);
        }
    });
}
void test('cancelling the here menu preserves the turn and returns to map input', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        await type(engine, '#herecmdmenu\n\x1b');
        assert.doesNotMatch(screen(), /What do you want to do/);
        assert.equal(game.moves, moves);
    }
    finally {
        await finish(engine);
    }
});
void test('rest selected in the here menu spends exactly one turn', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        await type(engine, '#herecmdmenu\n');
        await choose(engine, 'Rest one turn');
        assert.doesNotMatch(screen(), /What do you want to do/);
        assert.equal(game.moves, moves + 1);
    }
    finally {
        await finish(engine);
    }
});
void test('inventory selected in the here menu opens inventory without a turn', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        await type(engine, '#herecmdmenu\n');
        await choose(engine, 'Inventory');
        assert.match(screen(), /Weapons|Armor/);
        assert.equal(game.moves, moves);
    }
    finally {
        await finish(engine);
    }
});
void test('empty inventory omits both inventory and dropping', async () => {
    const engine = await startMenuGame();
    try {
        game.inventory = [];
        await type(engine, '#herecmdmenu\n');
        assert.match(screen(), /a - Rest one turn/);
        assert.doesNotMatch(screen(), /Inventory|Drop items/);
    }
    finally {
        await finish(engine);
    }
});
void test('known spells add casting after looking here', async () => {
    const engine = await startMenuGame();
    try {
        forceLearnSpell(SPE_FORCE_BOLT);
        await type(engine, '#herecmdmenu\n');
        assert.match(screen(), /f - Cast a spell/);
        await choose(engine, 'Cast a spell');
        assert.match(screen(), /cast|spell/);
    }
    finally {
        await finish(engine);
    }
});
for (const container of [CHEST, BAG_OF_TRICKS]) {
    void test(`floor container ${container} offers pickup, loot and tip in order`, async () => {
        const engine = await startMenuGame();
        try {
            await floorObject(container, 10, 10, { initialize: false });
            await type(engine, '#herecmdmenu\n');
            assert.match(screen(), /a - Pick up/);
            assert.match(screen(), /b - Loot/);
            assert.match(screen(), /c - Tip/);
        }
        finally {
            await finish(engine);
        }
    });
}
void test('food on the floor offers eating and pickup transfers it to inventory', async () => {
    const engine = await startMenuGame();
    try {
        await floorObject(APPLE, 10, 10);
        await type(engine, '#herecmdmenu\n');
        assert.match(screen(), /b - Eat an? .*apple/);
        await choose(engine, 'Pick up');
        assert.match(screen(), /[a-z] - an? .*apple/);
    }
    finally {
        await finish(engine);
    }
});
void test('a pile uses the generic pickup label', async () => {
    const engine = await startMenuGame();
    try {
        await floorObject(APPLE, 10, 10);
        await floorObject(BOULDER, 10, 10);
        await type(engine, '#herecmdmenu\n');
        assert.match(screen(), /a - Pick up items/);
        assert.doesNotMatch(screen(), /Eat /);
    }
    finally {
        await finish(engine);
    }
});
for (const tool of [SKELETON_KEY, LOCK_PICK, CREDIT_CARD]) {
    void test(`door menu offers the lock action supported by tool ${tool}`, async () => {
        const engine = await startMenuGame();
        try {
            const door = requireGameLevel().requireAt(11, 10);
            door.typ = DOOR;
            door.doormask = D_LOCKED;
            await addInventoryObject(tool, { invlet: 'z' });
            await type(engine, '#therecmdmenu\nl');
            assert.match(screen(), tool === CREDIT_CARD ? /b - Unlock the door/ : /b - Lock or unlock the door/);
            await choose(engine, tool === CREDIT_CARD ? 'Unlock the door' : 'Lock or unlock');
            assert.doesNotMatch(screen(), /What do you want to (?:apply|use)|In what direction|Unlock it/);
            assert.match(screen(), /lock/);
        }
        finally {
            await finish(engine);
        }
    });
}
void test('an unused unlock answer becomes a northwest step after the apply turn', async () => {
    const engine = await startMenuGame();
    try {
        const door = requireGameLevel().requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        game.inventory = [];
        await addInventoryObject(CREDIT_CARD, { invlet: 'z' });
        const moves = game.moves;
        await type(engine, '#therecmdmenu\nl');
        await choose(engine, 'Unlock the door');
        assert.match(screen(), /You can't lock a door with a credit card\./);
        assert.equal(game.moves, moves + 2, 'applying the card and the queued step each spend a turn');
        assert.equal(game.u.ux, 9);
        assert.equal(game.u.uy, 9);
        assert.equal(requireGameDisplay().grid[10]?.[8]?.ch, '@');
    }
    finally {
        await finish(engine);
    }
});
void test('an unused unlock answer follows the current command binding', async () => {
    const engine = await startMenuGame('BINDINGS=y:inventory\n');
    try {
        const door = requireGameLevel().requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        game.inventory = [];
        await addInventoryObject(CREDIT_CARD, { invlet: 'z' });
        const moves = game.moves;
        await type(engine, '#therecmdmenu\nl');
        await choose(engine, 'Unlock the door');
        assert.match(screen(), /credit card\.--More--/);
        await type(engine, ' ');
        assert.match(screen(), /z - .*credit card/);
        assert.equal(game.moves, moves + 1);
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
    }
    finally {
        await finish(engine);
    }
});
void test('a weapon slipping between turns cancels an unused menu answer', async () => {
    const engine = await startMenuGame();
    try {
        const door = requireGameLevel().requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        await addInventoryObject(CREDIT_CARD, { invlet: 'z' });
        const weapon = game.uwep;
        assert.ok(weapon);
        weapon.cursed = false;
        const moves = game.moves;
        await type(engine, '#therecmdmenu\nl');
        setSlipperyHands(2);
        await choose(engine, 'Unlock the door');
        for (let page = 0; page < 3 && screen().includes('--More--'); page++)
            await type(engine, ' ');
        assert.match(screen(), /slips from your hand/);
        assert.equal(game.moves, moves + 1);
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
    }
    finally {
        await finish(engine);
    }
});
void test('opening from the there menu uses the chosen direction', async () => {
    const engine = await startMenuGame();
    try {
        const door = requireGameLevel().requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        await type(engine, '#therecmdmenu\nl');
        await choose(engine, 'Open the door');
        assert.match(screen(), /door opens/);
        assert.equal(door.doormask, D_ISOPEN);
    }
    finally {
        await finish(engine);
    }
});
void test('a simulated right click offers closing an open door', async () => {
    const engine = await startMenuGame();
    try {
        const door = requireGameLevel().requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_ISOPEN;
        await type(engine, '#therecmdmenu\n_l.');
        assert.match(screen(), /a - Close the door/);
        await choose(engine, 'Close the door');
        assert.match(screen(), /door closes/);
    }
    finally {
        await finish(engine);
    }
});
void test('a simulated left click does not offer closing an open door', async () => {
    const engine = await startMenuGame();
    try {
        const door = requireGameLevel().requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_ISOPEN;
        await type(engine, '#therecmdmenu\n_l,');
        assert.match(screen(), /Look at map symbol/);
        assert.doesNotMatch(screen(), /Close the door/);
    }
    finally {
        await finish(engine);
    }
});
void test('a nearby wall offers searching for secret doors', async () => {
    const engine = await startMenuGame();
    try {
        requireGameLevel().requireAt(11, 10).typ = STONE;
        await type(engine, '#therecmdmenu\nl');
        assert.match(screen(), /a - Search for secret doors/);
    }
    finally {
        await finish(engine);
    }
});
void test('a seen nearby trap offers examination, disarming and movement', async () => {
    const engine = await startMenuGame();
    try {
        addTrap(requireGameLevel(), ARROW_TRAP, 11, 10, { tseen: true });
        await type(engine, '#therecmdmenu\nl');
        assert.match(screen(), /a - Examine trap/);
        assert.match(screen(), /b - Attempt to disarm trap/);
        assert.match(screen(), /c - Move on the trap/);
        await choose(engine, 'Examine trap');
        assert.match(screen(), /arrow trap/);
    }
    finally {
        await finish(engine);
    }
});
void test('a visible boulder offers pushing', async () => {
    const engine = await startMenuGame();
    try {
        await floorObject(BOULDER, 11, 10);
        newsym(11, 10);
        await type(engine, '#therecmdmenu\nl');
        assert.match(screen(), /a - Push the boulder/);
    }
    finally {
        await finish(engine);
    }
});
void test('a monster standing on a remembered boulder does not hide the push action', async () => {
    const engine = await startMenuGame();
    try {
        await floorObject(BOULDER, 11, 10);
        newsym(11, 10);
        const goblin = await createMonsterAt('goblin', 11, 10);
        goblin.mpeaceful = true;
        newsym(11, 10);
        await type(engine, '#therecmdmenu\nl');
        assert.match(screen(), /a - Push the boulder/);
        assert.match(screen(), /Talk to the goblin/);
    }
    finally {
        await finish(engine);
    }
});
void test('peaceful monsters offer talking, swapping and naming', async () => {
    const engine = await startMenuGame();
    try {
        const monster = await createMonsterAt('goblin', 11, 10);
        monster.mpeaceful = true;
        await type(engine, '#therecmdmenu\nl');
        assert.match(screen(), /a - Talk to the goblin/);
        assert.match(screen(), /b - Swap places with the goblin/);
        assert.match(screen(), /c - Name the goblin/);
        await choose(engine, 'Name the goblin');
        assert.match(screen(), /What do you want to call the goblin/);
        assert.doesNotMatch(screen(), /Move cursor/);
    }
    finally {
        await finish(engine);
    }
});
void test('a saddled peaceful steed offers riding and saddle removal before talking', async () => {
    const engine = await startMenuGame();
    try {
        await createSaddledSteed();
        await type(engine, '#therecmdmenu\nl');
        assert.match(screen(), /a - Ride the pony/);
        assert.match(screen(), /b - Remove saddle from the pony/);
        assert.match(screen(), /c - Talk to the saddled pony/);
    }
    finally {
        await finish(engine);
    }
});
void test('a saddle in inventory offers saddling an eligible unsaddled monster', async () => {
    const engine = await startMenuGame();
    try {
        const pony = await createMonsterAt('pony', 11, 10);
        pony.mpeaceful = true;
        pony.saddle = null;
        pony.minvent = [];
        pony.inventory = [];
        await addInventoryObject(SADDLE, { invlet: 'z' });
        await type(engine, '#therecmdmenu\nl');
        assert.match(screen(), /a - Put saddle on the pony/);
    }
    finally {
        await finish(engine);
    }
});
void test('the here menu offers dismounting the current steed', async () => {
    const engine = await startMenuGame();
    try {
        game.u.usteed = await createSaddledSteed();
        await type(engine, '#herecmdmenu\n');
        assert.match(screen(), /a - Dismount the pony/);
    }
    finally {
        await finish(engine);
    }
});
void test('an unseen-creature marker offers attacking without revealing a monster', async () => {
    const engine = await startMenuGame();
    try {
        map_invisible(11, 10);
        await type(engine, '#therecmdmenu\n_l,');
        assert.match(screen(), /a - Attack unseen creature/);
        assert.match(screen(), /b - Look at map symbol/);
    }
    finally {
        await finish(engine);
    }
});
void test('a distant left-click target offers throwing, travel and map inspection', async () => {
    const engine = await startMenuGame();
    try {
        await type(engine, '#therecmdmenu\n_lll,');
        assert.match(screen(), /a - Throw something/);
        assert.match(screen(), /b - Travel here/);
        assert.match(screen(), /c - Look at map symbol/);
    }
    finally {
        await finish(engine);
    }
});
void test('a distant right-click target offers only map inspection', async () => {
    const engine = await startMenuGame();
    try {
        await type(engine, '#therecmdmenu\n_lll.');
        assert.match(screen(), /a - Look at map symbol/);
        assert.doesNotMatch(screen(), /Throw something|Travel here/);
        await choose(engine, 'Look at map symbol');
        assert.match(screen(), /floor of a room/);
    }
    finally {
        await finish(engine);
    }
});
void test('cancelling simulated target selection does not open a command menu', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        await type(engine, '#therecmdmenu\n_\x1b');
        assert.doesNotMatch(screen(), /What do you want to do/);
        assert.equal(game.moves, moves);
    }
    finally {
        await finish(engine);
    }
});
void test('looking here from the menu reads the engraving', async () => {
    const engine = await startMenuGame();
    try {
        makeEngravingAt(10, 10, 'Mind the gap');
        await type(engine, '#herecmdmenu\n');
        await choose(engine, 'Look at what is here');
        assert.match(screen(), /engraved|read/);
        assert.match(screen(), /Mind the gap/);
    }
    finally {
        await finish(engine);
    }
});
void test('dipping waits for the item, then supplies the fountain confirmation', async () => {
    const engine = await startMenuGame();
    try {
        requireGameLevel().requireAt(10, 10).typ = FOUNTAIN;
        const apple = await addInventoryObject(APPLE, { invlet: 'z' });
        await type(engine, '#herecmdmenu\n');
        await choose(engine, 'Dip something');
        assert.match(screen(), /What do you want to dip/);
        await type(engine, apple.invlet ?? 'z');
        assert.doesNotMatch(screen(), /into the fountain\?/);
        assert.match(screen(), /apple|fountain/);
    }
    finally {
        await finish(engine);
    }
});
void test('cancelling the item for a menu dip discards the unused confirmation', async () => {
    const engine = await startMenuGame();
    try {
        requireGameLevel().requireAt(10, 10).typ = FOUNTAIN;
        const moves = game.moves;
        await type(engine, '#herecmdmenu\n');
        await choose(engine, 'Dip something');
        await type(engine, '\x1b');
        assert.match(screen(), /Never mind\./);
        assert.equal(game.moves, moves);
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
    }
    finally {
        await finish(engine);
    }
});
void test('a distant menu throw silently cancels and keeps the selected apple', async () => {
    const engine = await startMenuGame();
    try {
        const apple = await addInventoryObject(APPLE, { invlet: 'z' });
        const moves = game.moves;
        await type(engine, '#therecmdmenu\n_lll,');
        await choose(engine, 'Throw something');
        assert.match(screen(), /What do you want to throw/);
        await type(engine, 'z');
        assert.doesNotMatch(screen(), /In what direction/);
        assert.equal(game.moves, moves);
        assert.ok(game.inventory.includes(apple), 'the cancelled throw must keep the apple in inventory');
        await type(engine, 'i');
        assert.match(screen(), /z - .*apple/);
    }
    finally {
        await finish(engine);
    }
});
void test('removing a saddle skips floor containers and supplies the monster direction', async () => {
    const engine = await startMenuGame();
    try {
        await createSaddledSteed();
        await floorObject(CHEST, 10, 10, { initialize: false });
        await type(engine, '#therecmdmenu\nl');
        await choose(engine, 'Remove saddle');
        assert.match(screen(), /You take the saddle off/);
        assert.doesNotMatch(screen(), /Loot in what direction|remove the saddle.*\?/);
    }
    finally {
        await finish(engine);
    }
});
void test('an ordinary direction with no entries queues a move', async () => {
    const engine = await startMenuGame();
    try {
        await type(engine, '#therecmdmenu\nl');
        assert.doesNotMatch(screen(), /What do you want to do/);
        assert.equal(game.u.ux, 11);
        assert.equal(requireGameDisplay().grid[11]?.[10]?.ch, '@');
    }
    finally {
        await finish(engine);
    }
});
void test('a hostile adjacent monster is attacked without asking for a menu choice', async () => {
    const engine = await startMenuGame();
    try {
        const goblin = await createMonsterAt('goblin', 11, 10);
        goblin.mpeaceful = false;
        goblin.mtame = 0;
        await type(engine, '#therecmdmenu\nl');
        assert.doesNotMatch(screen(), /What do you want to do/);
        assert.match(screen(), /goblin|hit|miss/);
    }
    finally {
        await finish(engine);
    }
});
void test('map inspection leaves its target for the next there menu, which then consumes it', async () => {
    const engine = await startMenuGame();
    try {
        const door = requireGameLevel().requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        await type(engine, '#therecmdmenu\n_l.');
        await choose(engine, 'Look at map symbol');
        await type(engine, '#therecmdmenu\n');
        assert.match(screen(), /What do you want to do/);
        assert.match(screen(), /Open the door/);
        await type(engine, '\x1b#therecmdmenu\n');
        assert.match(screen(), /In what direction/);
    }
    finally {
        await finish(engine);
    }
});
void test('therecmdmenu autocompletes from its extended-command prefix', async () => {
    const engine = await startMenuGame();
    try {
        await type(engine, '#therec\n');
        assert.match(screen(), /In what direction/);
    }
    finally {
        await finish(engine);
    }
});
//# sourceMappingURL=command_context_menu.test.js.map