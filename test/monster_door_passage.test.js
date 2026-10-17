import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactByName, initializeArtifacts, nameArtifact } from '../js/artifacts.js';
import { DOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, G_GENOD, IRONBARS, NO_MINVENT, ROOM, W_AMUL, W_NONDIGGABLE, } from '../js/const.js';
import { canSeeMonster, canSpotMonster, flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mfndpos } from '../js/monmove.js';
import { resolveMonsterDoorPassage, shiftMonsterForDoor } from '../js/monster_door_passage.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterAtPosition, placeMonsterAt } from '../js/monster_location.js';
import { monsterCanOpenDoor, monsterCanUnlockDoor } from '../js/monster_movement_traits.js';
import { monsterCanFog, monsterCanOoze } from '../js/monster_perception.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { addObjectToContainer } from '../js/object_container.js';
import { AMULET_OF_LIFE_SAVING, CREDIT_CARD, DAGGER, LOCK_PICK, MACE, ROCK, SACK, SKELETON_KEY, } from '../js/object_data.js';
import { cansee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
function screen() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
async function passageRoom(species, terrain = DOOR, mask = D_CLOSED) {
    const level = freshPlayableRoom({ flags: { verbose: true, acoustics: true } });
    initializeArtifacts(game);
    const monster = await createMonsterAt(species, 12, 10, NO_MINVENT);
    if (species === 'vampire' && monster.mnum !== MONSTER_NAME.indexOf('vampire'))
        await changeMonsterForm(monster, MONSTER_NAME.indexOf('vampire'));
    monster.mhp = monster.mhpmax = 100;
    const location = level.requireAt(12, 10);
    location.typ = terrain;
    location.doormask = mask;
    vision_note_blocker_change(12, 10);
    vision_recalc(0);
    const input = resetInputState();
    return { level, monster, location, input };
}
function doorOptions(monster) {
    return {
        canOpen: monsterCanOpenDoor(monster), canUnlock: monsterCanUnlockDoor(monster),
        canTunnel: false, wasDoorVisible: cansee(monster.mx, monster.my),
    };
}
for (const tool of [SKELETON_KEY, LOCK_PICK, CREDIT_CARD]) {
    void test(`a monster carrying unlocking tool ${tool} opens a locked door`, async () => {
        const { monster, location } = await passageRoom('orc', DOOR, D_LOCKED);
        requirePlayingGame(game);
        const key = await knownObject(tool);
        await addObjectToMonsterInventory(monster, key);
        const result = await resolveMonsterDoorPassage(monster, game, doorOptions(monster));
        await flush_screen(1);
        assert.equal(result.status, 'continue');
        assert.equal(location.doormask, D_ISOPEN);
        assert.equal(monster.mhp, 100);
        assert.equal(key.where, 'minvent');
        assert.match(screen(), /orc unlocks and opens a door\./);
    });
}
void test('an invisible door opener is described through the visible door', async () => {
    const { monster, location } = await passageRoom('orc');
    requirePlayingGame(game);
    monster.minvis = 1;
    const result = await resolveMonsterDoorPassage(monster, game, doorOptions(monster));
    await flush_screen(1);
    assert.equal(result.status, 'continue');
    assert.equal(location.doormask, D_ISOPEN);
    assert.match(screen(), /You see a door open\./);
    assert.doesNotMatch(screen(), /orc opens/);
});
for (const deaf of [false, true]) {
    void test(`a blind ${deaf ? 'deaf' : 'hearing'} hero gets the appropriate door feedback`, async () => {
        const { monster, location } = await passageRoom('orc');
        requirePlayingGame(game);
        game.blind = true;
        game.u.blindTurns = 10;
        game.u.deafTurns = deaf ? 10 : 0;
        vision_recalc(0);
        await resolveMonsterDoorPassage(monster, game, { ...doorOptions(monster), wasDoorVisible: false });
        await flush_screen(1);
        assert.equal(location.doormask, D_ISOPEN);
        if (deaf)
            assert.doesNotMatch(screen(), /door open/);
        else
            assert.match(screen(), /You hear a door open\./);
    });
}
for (const roll of [0, 1]) {
    void test(`a giant's locked-door crash leaves ${roll ? 'a broken door' : 'an empty doorway'}`, async () => {
        const { monster, location } = await passageRoom('giant', DOOR, D_LOCKED);
        requirePlayingGame(game);
        await resolveMonsterDoorPassage(monster, game, { ...doorOptions(monster), random: () => roll });
        await flush_screen(1);
        assert.equal(location.doormask, roll ? D_BROKEN : D_NODOOR);
        assert.match(screen(), /giant smashes down a door\./);
    });
}
void test('a door crash is visible before its message finishes and shop repair waits for that message', async () => {
    const { level, monster, location, input } = await passageRoom('giant', DOOR, D_LOCKED);
    requirePlayingGame(game);
    await createStaffedShop({ keeperX: 14, doorX: 12, doorY: 10 });
    location.typ = DOOR;
    location.doormask = D_LOCKED;
    await plineWithContinuation('An earlier announcement fills most of the message line now.');
    const opening = resolveMonsterDoorPassage(monster, game, { ...doorOptions(monster), random: () => 1 });
    try {
        await input.waitUntilBlocked();
        assert.equal(location.doormask, D_BROKEN);
        assert.equal(level.damagelist?.length ?? 0, 0);
        assert.match(screen(), /earlier announcement.*--More--/);
    }
    finally {
        input.feed(' ');
        await opening;
    }
    const repair = level.damagelist?.find(damage => damage.place.x === 12 && damage.place.y === 10);
    assert.ok(repair);
    assert.equal(repair.cost, 0);
});
for (const { species, blessed, cursed, safe } of [
    { species: 'orc', blessed: true, cursed: false, safe: true },
    { species: 'orc', blessed: false, cursed: false, safe: false },
    { species: 'rogue', blessed: false, cursed: false, safe: true },
    { species: 'rogue', blessed: false, cursed: true, safe: false },
]) {
    void test(`the Master Key ${safe ? 'disarms' : 'does not disarm'} a door for ${species} with its current beatitude`, async () => {
        const { monster, location, input } = await passageRoom(species, DOOR, D_LOCKED | D_TRAPPED);
        requirePlayingGame(game);
        const artifact = artifactByName('The Master Key of Thievery');
        assert.ok(artifact);
        const key = await knownObject(SKELETON_KEY, { blessed, cursed });
        assert.equal(nameArtifact(key, artifact), true);
        await addObjectToMonsterInventory(monster, key);
        installPagerInput(input, { expected: /door|KABOOM|explosion/i, limit: 4 });
        await resolveMonsterDoorPassage(monster, game, { ...doorOptions(monster), rollOne: () => 5 });
        assert.equal(location.doormask, safe ? D_ISOPEN : D_NODOOR);
        assert.equal(monster.mhp, safe ? 100 : 95);
        assert.equal(key.where, 'minvent');
    });
}
void test('an amorphous key carrier disarms a trap while leaving the door closed', async () => {
    const { monster, location } = await passageRoom('acid blob', DOOR, D_CLOSED | D_TRAPPED);
    requirePlayingGame(game);
    const artifact = artifactByName('The Master Key of Thievery');
    assert.ok(artifact);
    const key = await knownObject(SKELETON_KEY, { blessed: true });
    assert.equal(nameArtifact(key, artifact), true);
    await addObjectToMonsterInventory(monster, key);
    await resolveMonsterDoorPassage(monster, game, doorOptions(monster));
    await flush_screen(1);
    assert.equal(location.doormask, D_CLOSED);
    assert.equal(monster.mhp, 100);
    assert.match(screen(), /acid blob oozes under the door\./);
});
void test('wall passing leaves a trapped door intact', async () => {
    const { monster, location } = await passageRoom('ghost', DOOR, D_CLOSED | D_TRAPPED);
    requirePlayingGame(game);
    await resolveMonsterDoorPassage(monster, game, doorOptions(monster));
    assert.equal(location.doormask, D_CLOSED | D_TRAPPED);
    assert.equal(monster.mhp, 100);
});
for (const lifeSaving of [false, true]) {
    void test(`a trapped door ${lifeSaving ? 'uses life saving and resumes movement' : 'ends its opener movement in death'}`, async () => {
        const { level, monster, location, input } = await passageRoom('orc', DOOR, D_CLOSED | D_TRAPPED);
        requirePlayingGame(game);
        const amulet = lifeSaving ? await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL) : null;
        monster.mhp = 1;
        installPagerInput(input, { expected: /door|KABOOM|explosion|medallion|looks much better|But wait/i, limit: 8 });
        const result = await resolveMonsterDoorPassage(monster, game, { ...doorOptions(monster), rollOne: () => 5 });
        assert.equal(result.status, lifeSaving ? 'continue' : 'died');
        assert.equal(result.heroDied, false);
        assert.equal(location.doormask, D_NODOOR);
        assert.equal(monsterAtPosition(level, monster.mx, monster.my) === monster, lifeSaving);
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.ok(monster.mhp > 0);
        }
    });
}
for (const species of ['rock mole', 'xorn', 'rust monster', 'gray ooze']) {
    void test(`${species} eats iron bars and ends its move even with verbose messages disabled`, async () => {
        const { monster, location } = await passageRoom(species, IRONBARS, 0);
        requirePlayingGame(game);
        game.flags.verbose = false;
        location.edge = 1;
        const result = await resolveMonsterDoorPassage(monster, game, doorOptions(monster));
        await flush_screen(1);
        assert.equal(result.status, 'done');
        assert.equal(location.typ, DOOR);
        assert.equal(location.doormask, D_NODOOR);
        assert.match(screen(), /eats through the iron bars\./);
    });
}
void test('the bars-eating message suspends before the bars disappear or floor cargo is touched', async () => {
    const { monster, location, input } = await passageRoom('rock mole', IRONBARS, 0);
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 12, 10);
    await plineWithContinuation('An earlier announcement fills most of the message line now.');
    const eating = resolveMonsterDoorPassage(monster, game, doorOptions(monster));
    try {
        await input.waitUntilBlocked();
        assert.equal(location.typ, IRONBARS);
        assert.equal(dagger.where, 'floor');
    }
    finally {
        input.feed(' ');
        await eating;
    }
    assert.notEqual(location.typ, IRONBARS);
    assert.equal(dagger.where, 'floor');
});
void test('undiggable bars survive passage and repeated movement prose is suppressed', async () => {
    const { monster, location, input } = await passageRoom('rock mole', IRONBARS, 0);
    requirePlayingGame(game);
    location.wall_info = W_NONDIGGABLE;
    let pagers = 0;
    input.beforeRead = () => { pagers++; };
    installPagerInput(input, { expected: /iron bars/, limit: 2 });
    assert.equal((await resolveMonsterDoorPassage(monster, game, doorOptions(monster))).status, 'continue');
    await resolveMonsterDoorPassage(monster, game, doorOptions(monster));
    await flush_screen(1);
    assert.equal(location.typ, IRONBARS);
    assert.equal(pagers, 0, 'Norep must not force a second identical passage message');
    assert.match(screen(), /rock mole passes between the iron bars\./);
});
void test('a visible vampire shifts at its previous square before entering the closed door', async () => {
    const { monster, location, input } = await passageRoom('vampire', DOOR, D_LOCKED);
    requirePlayingGame(game);
    const dagger = await knownObject(DAGGER);
    await addObjectToMonsterInventory(monster, dagger);
    placeMonsterAt(monster, 11, 10);
    const wasSeen = canSeeMonster(monster), wasSpotted = canSpotMonster(monster);
    assert.equal(wasSeen, true);
    placeMonsterAt(monster, 12, 10);
    const shifting = shiftMonsterForDoor(monster, game, {
        previousPosition: { x: 11, y: 10 }, wasSeen, wasSpotted,
    });
    try {
        await input.waitUntilBlocked();
        assert.equal(monster.mx, 11);
        assert.equal(monster.mnum, MONSTER_NAME.indexOf('fog cloud'));
        assert.equal(location.doormask, D_LOCKED);
        assert.match(screen(), /fog cloud.*--More--/);
    }
    finally {
        installPagerInput(input, { expected: /fog cloud|vampire|drops/i, limit: 5 });
        input.feed(' ');
        await shifting;
    }
    assert.equal(monster.mx, 12);
    assert.equal(dagger.where, 'minvent');
    await resolveMonsterDoorPassage(monster, game, doorOptions(monster));
    await flush_screen(1);
    assert.equal(location.doormask, D_LOCKED);
    assert.match(screen(), /fog cloud flows under the door\./);
});
void test('small carried items fit under doors but a filled sack prevents fog and ooze passage', async () => {
    const { monster } = await passageRoom('vampire');
    requirePlayingGame(game);
    const sack = await knownObject(SACK);
    await addObjectToMonsterInventory(monster, sack);
    assert.equal(monsterCanFog(monster, game), true);
    await addObjectToContainer(sack, await knownObject(ROCK));
    assert.equal(monsterCanFog(monster, game), false);
    const ooze = await createMonsterAt('acid blob', 14, 10, NO_MINVENT);
    await addObjectToMonsterInventory(ooze, await knownObject(DAGGER));
    assert.equal(monsterCanOoze(ooze), true);
    await addObjectToMonsterInventory(ooze, await knownObject(MACE));
    assert.equal(monsterCanOoze(ooze), false);
});
void test('movement admits a bulky amorphous carrier through a locked door but rejects a bulky vampire', async () => {
    for (const species of ['acid blob', 'vampire']) {
        const { level, monster, location } = await passageRoom(species);
        requirePlayingGame(game);
        location.typ = ROOM;
        location.doormask = D_NODOOR;
        const door = level.requireAt(13, 10);
        door.typ = DOOR;
        // A humanoid vampire could open an unlocked door without fog.
        door.doormask = D_LOCKED;
        await addObjectToMonsterInventory(monster, await knownObject(MACE));
        monster.mux = game.u.ux;
        monster.muy = game.u.uy;
        assert.equal(monsterCanOoze(monster), false);
        assert.equal(monsterCanFog(monster, game), false);
        const destinations = mfndpos(monster, game);
        assert.equal(destinations.some(point => point.x === 13 && point.y === 10), species === 'acid blob', `${species}: native movement admits an amorphous body independently of can_ooze's inventory rule`);
    }
});
for (const preventedBy of ['genocide', 'protection']) {
    void test(`${preventedBy} prevents a vampire door shift`, async () => {
        const { monster, location } = await passageRoom('vampire');
        requirePlayingGame(game);
        const previousSpecies = monster.mnum;
        if (preventedBy === 'genocide')
            requireMonsterVital(MONSTER_NAME.indexOf('fog cloud')).mvflags |= G_GENOD;
        else
            game.u.protectionFromShapeChangers = true;
        const result = await shiftMonsterForDoor(monster, game, {
            previousPosition: { x: 11, y: 10 }, wasSeen: true, wasSpotted: true,
        });
        assert.equal(result.died, false);
        assert.equal(monster.mnum, previousSpecies);
        assert.equal(location.doormask, D_CLOSED);
    });
}
//# sourceMappingURL=monster_door_passage.test.js.map