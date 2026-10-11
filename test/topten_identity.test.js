import { floorObjectsAt } from './support/level-state.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORPSTAT_FEMALE, CORPSTAT_MALE, G_GENOD, MGIVENNAME, MM_NOMSG, NO_MINVENT, PANICLOG, } from '../js/const.js';
import { finishOrdinaryQuit } from '../js/end.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { createToptenObject, makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, STATUE } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords, SCORE_RECORD_STORAGE_KEY } from '../js/score_records.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { randomToptenEntry, toptenMonsterForm } from '../js/topten.js';
import { vision_recalc } from '../js/vision.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
const species = (name) => MONSTER_NAME.indexOf(name);
async function completeScoredGame(storage, { name, role = 'valkyrie', female = true, points = 100 }) {
    freshConnectedLevels({ role });
    requirePlayingGame(game);
    game.storage = storage;
    game.plname = name;
    game.flags.female = female;
    game.flags.disclose = '-i -a -v -c -o';
    game.u.ulevel = 8;
    game.u.urexp = points;
    pushKeys('\x1b');
    await finishOrdinaryQuit();
}
async function scoredWorld(identity = { name: 'Ada' }) {
    const storage = memoryStorage();
    await completeScoredGame(storage, identity);
    freshObjectRoom();
    requirePlayingGame(game);
    game.storage = storage;
    return storage;
}
void test('selection reads completed games in their saved high-score rank order', async () => {
    const storage = memoryStorage();
    await completeScoredGame(storage, { name: 'Ada' });
    await completeScoredGame(storage, { name: 'Borin', role: 'wizard', female: false, points: 200 });
    freshObjectRoom();
    requirePlayingGame(game);
    game.storage = storage;
    const first = randomToptenEntry({ rollOne: () => 1 });
    const second = randomToptenEntry({ rollOne: () => 2 });
    const beyondList = randomToptenEntry({ rollOne: () => 10 });
    assert.ok(first != null, 'Expected first to be initialized');
    assert.equal(first.name, 'Borin');
    assert.ok(second != null, 'Expected second to be initialized');
    assert.equal(second.name, 'Ada');
    assert.ok(beyondList != null, 'Expected beyondList to be initialized');
    assert.equal(beyondList.name, 'Borin');
    assert.equal(loadScoreRecords().length, 2);
});
void test('an empty readable high-score list has no identity to select', () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.storage = memoryStorage();
    assert.equal(randomToptenEntry(), null);
});
for (const sighted of [true, false]) {
    void test(`a ${sighted ? 'visible' : 'detected but unseen'} doppelganger takes the recorded role and gender`, async () => {
        await scoredWorld();
        requirePlayingGame(game);
        game.u.protectionFromShapeChangers = true;
        const monster = await makemonAt(species('doppelganger'), 11, 10, MM_NOMSG | NO_MINVENT);
        game.u.protectionFromShapeChangers = false;
        if (!sighted) {
            setHeroBlindnessTurns(10);
            game.u.detectMonsters = true;
            vision_recalc(0);
        }
        assert.ok(monster);
        const form = await toptenMonsterForm(monster, { random: () => 1, rollOne: () => 1 });
        assert.equal(form, species('valkyrie'));
        assert.ok(monster != null, 'Expected monster to be initialized');
        assert.equal(monster.female, true);
        if (sighted)
            assert.equal(MGIVENNAME(monster), 'Ada');
        else
            assert.equal(Boolean(MGIVENNAME(monster)), false);
    });
}
void test('the native random-role alternative does not borrow a score name or gender', async () => {
    await scoredWorld();
    requirePlayingGame(game);
    game.u.protectionFromShapeChangers = true;
    const monster = await makemonAt(species('doppelganger'), 11, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(monster != null, 'Expected monster to be initialized');
    const female = monster.female;
    assert.ok(monster);
    const form = await toptenMonsterForm(monster, { random: () => 0 });
    assert.equal(form, species('archeologist'));
    assert.equal(Boolean(MGIVENNAME(monster)), false);
    assert.equal(monster.female, female);
});
void test('a male score identity replaces the doppelganger gender', async () => {
    await scoredWorld({ name: 'Borin', role: 'wizard', female: false });
    requirePlayingGame(game);
    game.u.protectionFromShapeChangers = true;
    const monster = await makemonAt(species('doppelganger'), 11, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(monster != null, 'Expected monster to be initialized');
    monster.female = true;
    assert.ok(monster);
    const form = await toptenMonsterForm(monster, { random: () => 1, rollOne: () => 1 });
    assert.equal(form, species('wizard'));
    assert.equal(monster.female, false);
    assert.equal(MGIVENNAME(monster), 'Borin');
});
void test('a real doppelganger birth retains the selected player identity after changing form', async () => {
    await scoredWorld();
    requirePlayingGame(game);
    initRng(5n);
    const monster = await makemonAt(species('doppelganger'), 11, 10, MM_NOMSG | NO_MINVENT);
    assert.ok(monster != null, 'Expected monster to be initialized');
    assert.equal(monster.mnum, species('valkyrie'));
    assert.equal(monster.cham, species('doppelganger'));
    assert.equal(MGIVENNAME(monster), 'Ada');
    assert.equal(monster.female, true);
    assert.ok(game.level.monsters.includes(monster));
});
for (const kind of ['doppelganger', 'corpse']) {
    void test(`an imported unknown role reports its error before completing a ${kind} identity`, async () => {
        const storage = await scoredWorld();
        requirePlayingGame(game);
        const records = loadScoreRecords();
        assert.ok(records[0]);
        records[0].role = 'Odd';
        storage.setItem(SCORE_RECORD_STORAGE_KEY, JSON.stringify(records));
        initRng(5n);
        const input = resetInputState();
        let completed = false;
        const creation = (kind === 'doppelganger'
            ? makemonAt(species('doppelganger'), 11, 10, MM_NOMSG | NO_MINVENT)
            : createToptenObject(CORPSE, 11, 10))
            .then(actor => { completed = true; return actor; });
        await input.waitUntilBlocked();
        const visibleText = requireGameDisplay().grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(visibleText, /What weird role is this\? \(Odd\)/);
        assert.equal(completed, false, 'creation waits for the diagnostic acknowledgment');
        input.beforeRead = () => input.feed(' ');
        input.feed(' ');
        const actor = await creation;
        if (kind === 'doppelganger') {
            assert.ok(actor && 'mnum' in actor);
            assert.ok(actor != null, 'Expected actor to be initialized');
            assert.equal(actor.mnum, species('human mummy'));
            assert.equal(MGIVENNAME(actor), 'Ada');
        }
        else {
            assert.ok(actor && 'otyp' in actor);
            assert.ok(actor != null, 'Expected actor to be initialized');
            assert.equal(actor.corpsenm, species('human mummy'));
            assert.equal(actor.oextra?.oname, 'Ada');
        }
        assert.match(storage.getItem(PANICLOG) ?? '', /What weird role is this\? \(Odd\)/);
        assert.equal(game.program_state.in_impossible, false);
    });
}
void test('a genocided score form is rejected while visible selection retains its name', async () => {
    const storage = await scoredWorld();
    requirePlayingGame(game);
    let named;
    for (let seed = 1; seed <= 32 && !named; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        game.storage = storage;
        assert.ok(game.mvitals != null, 'Expected game.mvitals to be initialized');
        game.mvitals[species('valkyrie')] = { born: 0, died: 0, mvflags: G_GENOD };
        initRng(BigInt(seed));
        const monster = await makemonAt(species('doppelganger'), 11, 10, MM_NOMSG | NO_MINVENT);
        assert.ok(monster != null, 'Expected monster to be initialized');
        assert.notEqual(monster.mnum, species('valkyrie'));
        if (MGIVENNAME(monster) === 'Ada')
            named = monster;
    }
    assert.ok(named, 'the rejected visible high-score form still supplies its player name');
});
for (const [kind, type] of [['corpse', CORPSE], ['statue', STATUE]]) {
    void test(`a generated player ${kind} uses a completed game's role, gender, and name`, async () => {
        await scoredWorld();
        requirePlayingGame(game);
        const object = await createToptenObject(type, 11, 10);
        assert.equal(object.corpsenm, species('valkyrie'));
        assert.equal(object.spe, CORPSTAT_FEMALE);
        assert.ok(object.oextra != null, 'Expected object.oextra to be initialized');
        assert.equal(object.oextra.oname, 'Ada');
        assert.ok(game.level.objects[11] != null);
        assert.ok(game.level.objects[11]?.[10] !== undefined && game.level.objects[11]?.[10] !== null);
        assert.ok(floorObjectsAt(game.level, 11, 10).includes(object));
        if (type === STATUE)
            assert.equal(object.contents?.length || 0, 0);
        else
            assert.ok(objectTimers(object).some(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE));
    });
    void test(`an empty record gives a generated ${kind} an unnamed player-role fallback`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.storage = memoryStorage();
        const object = await createToptenObject(type, 11, 10);
        assert.ok(object.corpsenm != null, 'Expected object.corpsenm to be initialized');
        assert.ok(object.corpsenm >= species('archeologist'));
        assert.ok(object.corpsenm <= species('wizard'));
        assert.equal(object.oextra?.oname, undefined);
    });
    void test(`a generated ${kind} records a male high-score identity`, async () => {
        await scoredWorld({ name: 'Borin', role: 'wizard', female: false });
        requirePlayingGame(game);
        const object = await createToptenObject(type, 11, 10);
        assert.equal(object.corpsenm, species('wizard'));
        assert.equal(object.spe, CORPSTAT_MALE);
        assert.ok(object.oextra != null, 'Expected object.oextra to be initialized');
        assert.equal(object.oextra.oname, 'Borin');
    });
}
//# sourceMappingURL=topten_identity.test.js.map