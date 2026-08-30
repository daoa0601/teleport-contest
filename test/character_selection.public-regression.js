import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Recorded public-session drift witness; not behavioral acceptance.

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { D_ISOPEN } from '../js/const.js';

process.env.TELEPORT_DISABLE_FIXTURES = '1';

const session = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0012-monk-vault-escort.session.json', import.meta.url),
    'utf8',
)).segments[0];

const autoRejectSession = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0007-rogue-snake-swamp.session.json', import.meta.url),
    'utf8',
)).segments[0];

const forcedGenderSession = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0014-dequa-fountain-explore.session.json', import.meta.url),
    'utf8',
)).segments[0];

const isRng = call => /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(call);
const withoutSource = call => call.replace(/\s+@.*$/, '');

test('Valkyrie role disables its source-forced female gender route', async () => {
    const result = await runSegment({
        ...forcedGenderSession,
        // Character selection is one suspended coroutine, so cross into the
        // stable command loop rather than ending the queue inside its race menu.
        moves: forcedGenderSession.moves.slice(0, 15),
        storage: new Map(),
    });

    for (let step = 0; step <= 15; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(forcedGenderSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            forcedGenderSession.steps[step].cursor,
        );
        const expected = (forcedGenderSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
    }
});

test('manual Monk startup reaches its first global-fobj pet scan exactly', async () => {
    const result = await runSegment({ ...session, storage: new Map() });

    for (let step = 0; step <= 16; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }

    const expectedStartup = (session.steps[16].rng || [])
        .filter(isRng).map(withoutSource);
    assert.deepEqual(result.getRngSlices()[16], expectedStartup);
    assert.equal(expectedStartup.length, 3066);
    const expectedFirstActorScan = (session.steps[21].rng || [])
        .filter(isRng).map(withoutSource);
    assert.deepEqual(result.getRngSlices()[21], expectedFirstActorScan);
    const expectedFirstPetCombat = (session.steps[25].rng || [])
        .filter(isRng).map(withoutSource);
    assert.deepEqual(
        result.getRngSlices()[25].slice(0, 9),
        expectedFirstPetCombat.slice(0, 9),
    );
    const expectedFirstContainerTurn = (session.steps[33].rng || [])
        .filter(isRng).map(withoutSource);
    assert.deepEqual(
        result.getRngSlices()[33],
        expectedFirstContainerTurn,
    );
    const expectedFirstMartialKill = (session.steps[36].rng || [])
        .filter(isRng).map(withoutSource);
    assert.deepEqual(
        result.getRngSlices()[36],
        expectedFirstMartialKill,
    );
    const expectedFirstBarehandedNewtKill = (session.steps[40].rng || [])
        .filter(isRng).map(withoutSource);
    assert.deepEqual(
        result.getRngSlices()[40],
        expectedFirstBarehandedNewtKill,
    );
    for (const step of [94, 98]) {
        const expected = (session.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
    }
    for (const step of [43, 44, 45, 46, 47, 48]) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    for (const step of [45, 46]) {
        const expected = (session.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
    }
    assert.equal(game.urole.key, 'monk');
    assert.equal(game.urace.name, 'human');
    assert.equal(game.flags.female, false);
    assert.equal(game.initAlignment.name, 'lawful');
});

test('rejecting an automatic tuple re-enters manual role selection', async () => {
    const result = await runSegment({ ...autoRejectSession, storage: new Map() });

    for (let step = 0; step <= 14; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    for (const step of [8, 10]) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
    }

    assert.equal(game.urole.key, 'rogue');
    assert.equal(game.urace.name, 'orc');
    assert.equal(game.flags.female, false);
    assert.equal(game.initAlignment.name, 'chaotic');
});

test('request-menu Options preserves its seven-page modal transaction', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 47),
        storage: new Map(),
    });

    for (let step = 20; step <= 47; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.equal(game.flags.pickup, true);
    assert.equal(game.flags.lit_corridor, true);
    assert.equal(game.flags.lootabc, true);
    assert.equal(game.flags.menucolors, true);
    assert.equal(game.flags.price_quotes, true);
    assert.equal(game.flags.quick_farsight, true);
    assert.equal(game.flags.showexp, true);
    assert.equal(game.flags.time, true);
    assert.equal(game.flags.pickup_types, '$"?!=/');
});

test('ordinary Rogue run uses live post-allocation monster movement', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 48),
        storage: new Map(),
    });

    const expected = (autoRejectSession.steps[48].rng || [])
        .filter(isRng).map(withoutSource);
    assert.deepEqual(result.getRngSlices()[48].slice(0, 10), expected.slice(0, 10));
    assert.deepEqual(
        decodeScreen(result.getScreens()[48]),
        decodeScreen(autoRejectSession.steps[48].screen),
    );
    assert.deepEqual(result.getCursors()[48], autoRejectSession.steps[48].cursor);
    assert.deepEqual(
        [game.u.ux, game.u.uy, game.startingPet.mx, game.startingPet.my],
        [31, 18, 33, 18],
    );
});

test('Rogue autounlock resumes pick-lock before the elapsed monster turn', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 55),
        storage: new Map(),
    });

    for (let step = 50; step <= 55; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.equal(game.level.at(29, 4).doormask, D_ISOPEN);
    assert.equal(game._occupation, null);
    assert.deepEqual([game.u.ux, game.u.uy], [28, 4]);
});

test('Orc substitution supplies concrete starter weapon damage metadata', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 84),
        storage: new Map(),
    });

    for (let step = 81; step <= 84; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
    }

    assert.equal(game.inventory[0].otyp, 48); // ORCISH_SHORT_SWORD
    assert.equal(game.inventory[1].otyp, 36); // ORCISH_DAGGER
});

test('jackal corpse effects and weight drive the complete eating occupation', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 85),
        storage: new Map(),
    });

    const step = 85;
    const expected = (autoRejectSession.steps[step].rng || [])
        .filter(isRng).map(withoutSource);
    assert.equal(expected.length, 115);
    assert.deepEqual(result.getRngSlices()[step], expected);
    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(autoRejectSession.steps[step].screen),
    );
    assert.deepEqual(
        result.getCursors()[step],
        autoRejectSession.steps[step].cursor,
    );
    assert.ok(result.getScreens()[step].startsWith(
        'This jackal corpse is tough.  You finish eating the jackal corpse.',
    ));
    assert.ok(game.u.uhunger > 1000);
    assert.equal(game.level.objects[12][9]
        .some(object => object.corpsenm === 12), false);
    assert.equal(game._occupation, null);
});

test('fox physical hits resume after tty More before committing damage', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 103),
        storage: new Map(),
    });

    for (let step = 97; step <= 103; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.equal(result.getRngSlices()[98].at(-1), 'd(1,3)=2');
    assert.deepEqual(
        result.getRngSlices()[99].slice(0, 2),
        ['rn2(3)=0', 'rn2(6)=4'],
    );
    assert.ok(result.getScreens()[98].startsWith(
        'You miss the fox.  The fox bites!  The kitten misses the fox.--More--',
    ));
});

test('locked floor box autounlock retries through the shared occupation', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 110),
        storage: new Map(),
    });

    for (let step = 103; step <= 110; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.ok(result.getScreens()[106].startsWith(
        'Hmmm, the large box turns out to be locked.--More--',
    ));
    assert.equal(game._occupation, null);
    const box = game.level.objects[game.u.ux][game.u.uy]
        .find(object => object.otyp === 214);
    assert.equal(box.olocked, false);
    assert.equal(box.lknown, true);
});

test('lootabc floor-box menus transfer live contents across tty More', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 124),
        storage: new Map(),
    });

    for (let step = 111; step <= 124; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.ok(result.getScreens()[118].startsWith(
        '$ - 118 gold pieces.  i - a scroll labeled FOOBIE BLETCH.--More--',
    ));
    assert.equal(game._goldCount, 118);
    assert.deepEqual(
        game.inventory.filter(object => ['j', 'k'].includes(object.invlet))
            .map(object => [object.invlet, object.oclass]),
        [['j', 10], ['k', 13]],
    );
    const box = game.level.objects[game.u.ux][game.u.uy]
        .find(object => object.otyp === 214);
    assert.equal(box.contents.length, 0);
    assert.equal(box.cknown, true);
    assert.ok(result.getScreens()[123].startsWith(
        'As you read the scroll, it disappears.  Your leather armor smoulders!--More--',
    ));
    assert.ok(result.getScreens()[124].startsWith(
        'Your leather armor smoulders further!',
    ));
    assert.equal(game.inventory.some(object => object.invlet === 'i'), false);
    assert.equal(game.uarm.oeroded, 2);
    assert.equal(game.u.uac, 9);
});

test('Rogue boulder move and pet swap converge on shared live indexes', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 148),
        storage: new Map(),
    });

    for (let step = 125; step <= 148; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.ok(result.getScreens()[135].startsWith(
        'You try to move the boulder, but in vain.',
    ));
    assert.ok(result.getScreens()[141].startsWith(
        'You swap places with your kitten.  You see here a large box.',
    ));
});

test('single-class container skips category menu and sorts concrete items', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 155),
        storage: new Map(),
    });

    for (let step = 149; step <= 155; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.equal(
        decodeScreen(result.getScreens()[150])[0]
            .map(cell => cell.ch).join('').trim(),
        'Take out what?',
    );
    assert.ok(result.getScreens()[152].startsWith(
        'l - an apple.  m - a food ration.  n - a tin.',
    ));
});

test('pet displacement rejoins common doorway run termination', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 160),
        storage: new Map(),
    });

    for (let step = 156; step <= 160; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.equal(game.moves, 147);
    assert.equal(game._runState, null);
});

test('looted inventory respects BUC, tin-content, and erosion knowledge', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 161),
        storage: new Map(),
    });
    const step = 161;
    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(autoRejectSession.steps[step].screen),
    );
    assert.deepEqual(
        result.getCursors()[step], autoRejectSession.steps[step].cursor,
    );
    const screen = result.getScreens()[step];
    assert.match(screen, /an uncursed very burnt \+1 leather armor/);
    assert.match(screen, /l - an apple/);
    assert.match(screen, /n - a tin/);
    assert.doesNotMatch(screen, /tin of lichen/);
});

test('diagonal run rejects a closed door without orthogonal feedback', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 164),
        storage: new Map(),
    });
    const step = 164;
    const expected = (autoRejectSession.steps[step].rng || [])
        .filter(isRng).map(withoutSource);
    assert.deepEqual(result.getRngSlices()[step], expected);
    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(autoRejectSession.steps[step].screen),
    );
    assert.deepEqual(
        result.getCursors()[step], autoRejectSession.steps[step].cursor,
    );
    assert.equal(game._pending_message, '');
    assert.equal(game._runState, null);
});

test('random goblin attitude and pet statue handling retain source RNG order', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        moves: autoRejectSession.moves.slice(0, 213),
        storage: new Map(),
    });

    for (let step = 199; step <= 213; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.equal(game._lastRandomMonsterGeneration.mnum, 70);
    assert.equal(game._lastRandomMonsterGeneration.primary.mpeaceful, 1);
    assert.match(result.getScreens()[212], /^You swap places with your kitten\./);
});

test('Rogue swamp witness closes pickup through ordinary death disclosure', async () => {
    const result = await runSegment({
        ...autoRejectSession,
        storage: new Map(),
    });

    for (let step = 242; step < autoRejectSession.steps.length; step++) {
        const expected = (autoRejectSession.steps[step].rng || [])
            .filter(isRng).map(withoutSource);
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(autoRejectSession.steps[step].screen),
        );
        assert.deepEqual(
            result.getCursors()[step],
            autoRejectSession.steps[step].cursor,
        );
    }

    assert.match(result.getScreens()[242],
        /^o - a silver wand\.  You see here a newt corpse\./);
    assert.match(result.getScreens()[251], /^You hit the newt\./);
    assert.match(result.getScreens()[252], /^You kill the newt!/);
    assert.match(result.getScreens()[258], /Wands/);
    assert.match(result.getScreens()[259], /^ k - a yellow gem/);
    assert.equal(result.getRngSlices()[272].length, 50);
    assert.deepEqual(result.getCursors()[273], [21, 17, 1]);
    assert.match(result.getScreens()[283], /^p - a cubical amulet\./);
    assert.match(result.getScreens()[285],
        /^p - a cubical amulet \(being worn\)\./);
    assert.match(result.getScreens()[289],
        /^An endless stream of snakes pours forth!/);
    assert.match(result.getScreens()[291], /^You die\.\.\.--More--/);
    assert.match(result.getScreens()[293],
        /p - a cursed amulet of restful sleep \(being worn\)/);
    assert.match(result.getScreens()[296],
        /You had both energy points \(spell power\)\./);
    assert.match(result.getScreens()[297], /You were poison resistant\./);
    assert.equal(
        result.getRngSlices().reduce((total, slice) => total + slice.length, 0),
        16373,
    );
});
