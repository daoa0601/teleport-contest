import type { PropertyName } from '../js/property_types.js';
import { floorObjects } from './support/level-state.js';
import { requireScreenRow } from './support/screen.js';
import type { GameObject } from '../js/object_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_WIS, MONSEEN_INFRAVIS, MONSEEN_NORMAL, NO_MINVENT, W_AMUL, W_ARMS } from '../js/const.js';
import { speakArtifact } from '../js/artifact_speech.js';
import { game, requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import { howMonsterSeen } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { useMirror } from '../js/mirror.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, MIRROR, SHIELD_OF_REFLECTION, STATUE } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { addInventoryItem } from '../js/u_init.js';
import { vision_recalc } from '../js/vision.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function reflect(mirror: GameObject, direction = '.') {
    resetInputState().feed(direction + ' '.repeat(30));
    return useMirror(mirror);
}

void test('applying a mirror reflects the hero, and cancelling its direction takes no time', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);

    await applyInventoryObject(mirror, '.');
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You look as cute as ever.');
    await applyInventoryObject(mirror, '\x1b');
    assert.equal(game.context.move, 0);
    assert.equal(game.inventory.includes(mirror), true);
});

void test('blind and invisible heroes cannot see themselves in an ordinary mirror', async () => {
    for (const property of ['blinded', 'invisible'] satisfies PropertyName[]) {
        freshObjectRoom();
        requirePlayingGame(game);
        const mirror = await addInventoryObject(MIRROR);
        grantIntrinsicProperty(property, 'outside', game);
        if (property === 'blinded') game.blind = true;

        const result = await reflect(mirror);

        assert.equal(result.spentTime, true);
        assert.match(game._pending_message, /can't see your cute face/);
    }
});

void test('a floating-eye form freezes itself, while free action prevents paralysis', async () => {
    for (const freeAction of [false, true]) {
        freshObjectRoom();
        requirePlayingGame(game);
        const mirror = await addInventoryObject(MIRROR);
        installPolymorphedHero('floating eye');
        if (freeAction) grantIntrinsicProperty('freeAction', 'outside', game);

        await reflect(mirror);

        assert.equal((game._helplessTurns || 0) > 0, !freeAction);
        assert.match(game._pending_message, freeAction ? /stiffen momentarily/ : /frozen yourself/);
        if (!freeAction) assert.equal(game._helplessDoneMessage, null);
    }
});

void test('an umber-hulk form confuses itself and a vampire has no reflection', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    installPolymorphedHero('umber hulk');
    await reflect(mirror);
    assert.ok((game.u.confusionTurns ?? 0) >= 3 && (game.u.confusionTurns ?? 0) <= 12);

    game.u.confusionTurns = 0;
    installPolymorphedHero('vampire');
    await reflect(mirror);
    assert.equal(game._pending_message, "You don't have a reflection.");
});

void test('vertical mirrors show the surrounding surface without affecting monsters', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const eye = await createMonsterAt('floating eye', 11, 10);

    await reflect(mirror, '>');
    assert.equal(game._pending_message, 'You reflect the floor.');
    await reflect(mirror, '<');
    assert.equal(game._pending_message, 'You reflect the ceiling.');
    assert.equal(eye.mfrozen || 0, 0);
});

void test('underwater mirrors show water and do not send a beam through it', async () => {
    freshObjectRoom({ hero: { uinwater: true } });
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const eye = await createMonsterAt('floating eye', 11, 10);
    await reflect(mirror, 'l');
    assert.equal(game._pending_message, 'You reflect the murky water.');
    assert.equal(eye.mfrozen || 0, 0);
});

void test('a floating eye is paralyzed by its own reflection, with paralysis capped', async () => {
    for (const alreadyFrozen of [0, 126]) {
        freshObjectRoom();
        requirePlayingGame(game);
        const mirror = await addInventoryObject(MIRROR);
        const eye = await createMonsterAt('floating eye', 12, 10);
        if (alreadyFrozen) eye.mfrozen = alreadyFrozen;

        await reflect(mirror, 'l');

        assert.equal(eye.mcanmove, 0);
        assert.ok((eye.mfrozen ?? 0) > 0 && (eye.mfrozen ?? 0) <= 127);
        if (alreadyFrozen) assert.equal(eye.mfrozen, 127);
        assert.match(game._pending_message, /frozen by its reflection/);
    }
});

void test('a cursed mirror can fog up before affecting the targeted creature', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR, { cursed: true });
    const eye = await createMonsterAt('floating eye', 12, 10);
    initRng(4n);

    await reflect(mirror, 'l');

    assert.match(game._pending_message, /fogs up and doesn't reflect/);
    assert.equal(eye.mfrozen || 0, 0);
});

void test('a blinded hero can freeze an eye without hearing it when acoustics are disabled', async () => {
    freshObjectRoom({ flags: { acoustics: false } });
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const eye = await createMonsterAt('floating eye', 12, 10);
    await makeBlinded(10, { talk: false });

    await reflect(mirror, 'l');

    assert.ok((eye.mfrozen ?? 0) > 0);
    assert.doesNotMatch(game._pending_message || '', /hear|frozen/);
});

for (const [condition, message] of [
    ['sleep', /too tired/],
    ['blindness', /can't see anything/],
] satisfies ['sleep' | 'blindness', RegExp][]) {
    void test(`a mirror respects an eye's ${condition}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const mirror = await addInventoryObject(MIRROR);
        const eye = await createMonsterAt('floating eye', 12, 10);
        if (condition === 'sleep') eye.msleeping = 1;
        else eye.mcansee = 0;

        await reflect(mirror, 'l');

        assert.equal(eye.mfrozen || 0, 0);
        assert.match(game._pending_message, message);
    });
}

void test('an invisible mirror is unnoticed by a monster which cannot see invisible', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const eye = await createMonsterAt('floating eye', 12, 10);
    grantIntrinsicProperty('invisible', 'outside', game);

    await reflect(mirror, 'l');

    assert.equal(eye.mfrozen || 0, 0);
    assert.match(game._pending_message, /fails to notice your mirror/);
});

void test('the invisible beam passes a monster which cannot see itself', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const first = await createMonsterAt('floating eye', 11, 10);
    const second = await createMonsterAt('umber hulk', 13, 10);
    first.minvis = 1;

    await reflect(mirror, 'l');

    assert.equal(first.mfrozen || 0, 0);
    assert.equal(second.mconf, 1);
});

void test('a wall stops a mirror beam before it reaches the next creature', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const eye = await createMonsterAt('floating eye', 13, 10);
    level.requireAt(12, 10).typ = 0;
    vision_recalc(0);

    await reflect(mirror, 'l');

    assert.equal(eye.mfrozen || 0, 0);
});

void test('a worm tail stops the beam without showing the worm a reflection', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const worm = await createMonsterAt('long worm', 12, 11);
    worm.wormSegments = [{ x: 12, y: 10 }];
    const eye = await createMonsterAt('floating eye', 14, 10);

    await reflect(mirror, 'l');

    assert.equal(!!worm.mflee, false);
    assert.equal(eye.mfrozen || 0, 0);
});

void test('infrared alone cannot reveal a distant reflection', async () => {
    const level = freshObjectRoom({ right: 25 });
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const hulk = await createMonsterAt('umber hulk', 17, 10);
    for (const column of level.locations) for (const square of column) square.lit = false;
    grantIntrinsicProperty('infravision', 'outside', game);
    vision_recalc(0);
    assert.equal(howMonsterSeen(hulk) & MONSEEN_NORMAL, 0);
    assert.ok(howMonsterSeen(hulk) & MONSEEN_INFRAVIS);

    await reflect(mirror, 'l');

    assert.equal(hulk.mconf || 0, 0);
    assert.match(game._pending_message, /too far away to see itself in the dark/);
});

void test('Medusa is petrified through the normal hero kill and statue owners', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const medusa = await createMonsterAt('Medusa', 12, 10, NO_MINVENT);
    const experience = game.u.uexp || 0;

    const result = await reflect(mirror, 'l');

    assert.equal(result.heroDied, false);
    assert.equal(level.monsters.includes(medusa), false);
    assert.ok(game.u.uexp > experience);
    assert.equal(game.u.uconduct.killer, 1);
    assert.ok(floorObjects(level).some(object => object.otyp === STATUE
        && object.corpsenm === MONSTER_NAME.indexOf('Medusa')));
});

void test('Medusa reflection equipment prevents her mirror death and is discovered', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const medusa = await createMonsterAt('Medusa', 12, 10, NO_MINVENT);
    const shield = await knownObject(SHIELD_OF_REFLECTION, { typeKnown: false });
    await equipMonsterObject(medusa, shield, W_ARMS);

    await reflect(mirror, 'l');

    assert.ok(medusa.mhp > 0);
    assert.ok(game._knownObjectTypes?.has(SHIELD_OF_REFLECTION));
    assert.match(game._pending_message, /gaze is reflected away by Medusa's shield/);
});

void test('Medusa life saving survives petrification and consumes the amulet', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await addInventoryObject(MIRROR);
    const medusa = await createMonsterAt('Medusa', 12, 10, NO_MINVENT);
    const amulet = await equipMonsterObject(medusa,
        await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);

    await reflect(mirror, 'l');

    assert.ok(medusa.mhp > 0);
    assert.ok(level.monsters.includes(medusa));
    assert.equal(medusa.minvent.includes(amulet), false);
    assert.equal(floorObjects(level).some(object => object.otyp === STATUE), false);
});

void test('a nymph steals a wielded mirror and obeys the level teleport restriction', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.flags.noteleport = true;
    const mirror = await addInventoryObject(MIRROR);
    game.uwep = game.u.uwep = mirror;
    mirror.wielded = true;
    const nymph = await createMonsterAt('wood nymph', 12, 10);
    nymph.msleeping = 0;

    await reflect(mirror, 'l');

    assert.equal(game.inventory.includes(mirror), false);
    assert.ok(nymph.minvent.includes(mirror));
    assert.equal(mirror.where, 'minvent');
    assert.equal(game.uwep, null);
    assert.equal(nymph.mx, 12);
    assert.match(game._pending_message, /mysterious force prevents/);
});

void test('mirror theft waits until the hero acknowledges wrapped admiration prose', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.flags.noteleport = true;
    const mirror = await addInventoryObject(MIRROR);
    const nymph = await createMonsterAt('wood nymph', 12, 10);
    nymph.msleeping = 0;
    nymph.mgivenname = 'The Lady of the Shimmering Woodland Glade';
    const input = resetInputState();
    input.feed('l');
    const action = useMirror(mirror);
    await input.waitUntilBlocked();

    assert.ok(game.inventory.includes(mirror));
    assert.equal(nymph.minvent.includes(mirror), false);
    assert.match(requireGameDisplay().grid.slice(0, 3).map(row => row.map(cell => cell.ch).join('')).join('\n'), /admires herself/);
    input.feed(' '.repeat(30));
    await action;
    assert.ok(nymph.minvent.includes(mirror));
});

void test('an ordinary animal flees its reflection while a unicorn ignores it', async () => {
    for (const species of ['jackal', 'white unicorn']) {
        freshObjectRoom();
        requirePlayingGame(game);
        const mirror = await addInventoryObject(MIRROR);
        const monster = await createMonsterAt(species, 12, 10);
        initRng(2n);

        await reflect(mirror, 'l');

        assert.equal(!!monster.mflee, species === 'jackal');
        if (species === 'jackal') assert.ok((monster.mfleetim ?? 0) >= 2 && (monster.mfleetim ?? 0) <= 8);
        else assert.match(game._pending_message, /ignores its reflection/);
    }
});

void test('a speaking mirror uses a turn after direction cancellation, even while deaf', async () => {
    freshObjectRoom({ role: 'knight', hero: { ualign: { type: 1, record: 10 }, deaf: true } });
    requirePlayingGame(game);
    const mirror = await addInventoryItem(await artifactObject('The Magic Mirror of Merlin'));

    await applyInventoryObject(mirror, '\x1b' + ' '.repeat(30));

    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /".+"/);
    assert.equal(game.inventory.includes(mirror), true);
});

void test('an artifact announces its whisper before paging to its rumor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mirror = await artifactObject('The Magic Mirror of Merlin', { overrideIdentified: true });
    const input = resetInputState();
    const speech = speakArtifact(mirror);
    await input.waitUntilBlocked();

    const top = requireScreenRow(0).map(cell => cell.ch).join('');
    assert.match(top, /The Magic Mirror of Merlin whispers:.*--More--/);
    input.feed(' '.repeat(30));
    assert.equal(await speech, true);
    assert.match(game._pending_message || game._retained_message, /^".+"$/);
});

void test('true and false artifact rumors exercise Wisdom in opposite directions', async () => {
    for (const blessed of [true, false]) {
        freshObjectRoom();
        requirePlayingGame(game);
        game.u.acurr.a[A_WIS] = 3;
        const mirror = await artifactObject('The Magic Mirror of Merlin', { blessed, cursed: !blessed });
        resetInputState().feed(' '.repeat(100));

        for (let count = 0; count < 8; count++) await speakArtifact(mirror);

        const exercise = game.u._exercise?.[A_WIS];
        assert.ok(exercise !== undefined);
        assert.ok(blessed ? exercise > 0 : exercise < 0);
    }
});
