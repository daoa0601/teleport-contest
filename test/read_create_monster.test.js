import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { glyphAt, randomDisplayMonsterIdentity, randomDisplayMonsterName } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName } from '../js/monster_data.js';
import { SCR_CREATE_MONSTER } from '../js/object_data.js';
import { withIndefiniteArticle } from '../js/object_grammar.js';
import { initRng, rn2Display } from '../js/rng.js';
import { monsterSaddle } from '../js/steed.js';
import { readInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
function creationRoom() {
    const level = freshObjectRoom({ flags: { debug: true }, gameplaySeed: 17n });
    requirePlayingGame(game);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    return { level, input, messages };
}
void test('wizard creation retries an unknown species and announces its replacement once', async () => {
    const { level, input, messages } = creationRoom();
    input.feed('not a monster\n');
    input.beforeRead = () => {
        messages.push(game._pending_message);
        input.feed(/Create what kind/.test(game._pending_message) ? 'newt\n' : ' ');
    };
    await rhack(7);
    assert.equal(level.monsters.length, 1);
    assert.equal(monsterTypeName(level.monsters[0]?.mnum ?? -1), 'newt');
    assert.ok(messages.some(message => /never heard of such monsters/.test(message)));
    assert.equal([...messages, game._pending_message].filter(message => /newt appears/.test(message)).length, 1);
    assert.equal(game.context.move, 0);
});
void test('wizard creation applies saddle, gender, invisibility, sleep, and disposition together', async () => {
    const { level, input } = creationRoom();
    input.feed('female invisible sleeping saddled peaceful pony\n');
    await rhack(7);
    const pony = level.monsters.find(monster => monsterTypeName(monster.mnum) === 'pony');
    assert.ok(pony, 'The modifiers must leave the requested pony name intact');
    assert.equal(pony.female, true);
    assert.equal(!!pony.minvis, true);
    assert.equal(!!pony.perminvis, true);
    assert.equal(pony.msleeping, 1);
    assert.equal(pony.mpeaceful, 1);
    assert.ok(monsterSaddle(pony));
    assert.equal(game.context.move, 0);
});
void test('wizard creation accepts a monster class symbol', async () => {
    const { level, input } = creationRoom();
    input.feed('b\n');
    await rhack(7);
    assert.equal(level.monsters.length, 1);
    assert.equal(MONSTER_SYMBOL[level.monsters[0]?.mnum ?? -1], 2);
});
void test('hallucinated wizard creation displays the newborn before its final appearance', async () => {
    const { level, input } = creationRoom();
    game.u.hallucinationTurns = 20;
    // Native makemon() redraws a monster created by the hero before inventory
    // initialization and at completion. A newt cannot perform armor checks.
    rn2Display(MONSTER_NAME.length);
    const finalAppearance = rn2Display(MONSTER_NAME.length);
    const identity = randomDisplayMonsterIdentity();
    const subject = identity.personal ? identity.name : withIndefiniteArticle(identity.name);
    initRng(17n);
    input.feed('newt\n');
    await rhack(7);
    const newt = level.monsters[0];
    assert.ok(newt);
    assert.equal(MONSTER_NAME[newt.mnum], 'newt');
    const glyph = glyphAt(newt.mx, newt.my);
    assert.ok(glyph?.kind === 'monster');
    assert.equal(glyph.mnum, finalAppearance);
    assert.equal(game._pending_message, `${subject.charAt(0).toUpperCase()}${subject.slice(1)} appears next to you.`);
    assert.equal(game.context.move, 0);
});
for (const useScroll of [false, true]) {
    void test(`hallucinated ${useScroll ? 'scroll' : 'wizard'} creation names each armor slot before displaying a human`, async () => {
        const { level, input, messages } = creationRoom();
        const scroll = useScroll
            ? await addInventoryObject(SCR_CREATE_MONSTER, { blessed: true, typeKnown: true })
            : null;
        game.u.hallucinationTurns = 20;
        initRng(17n);
        rn2Display(MONSTER_NAME.length); // makemon()'s initial by-hero redraw
        // worn.c:m_dowear_type() names the human for all eight armor slots,
        // including slots for which it has no item to wear.
        for (let slot = 0; slot < 8; slot++)
            randomDisplayMonsterName();
        const finalAppearance = rn2Display(MONSTER_NAME.length);
        const identity = randomDisplayMonsterIdentity();
        const subject = identity.personal ? identity.name : withIndefiniteArticle(identity.name);
        const appearance = `${subject.charAt(0).toUpperCase()}${subject.slice(1)} appears next to you.`;
        initRng(17n);
        input.beforeRead = () => {
            messages.push(game._pending_message);
            input.feed(/Create what kind/.test(game._pending_message) ? 'human\n' : ' ');
        };
        if (scroll)
            await readInventoryObject(scroll);
        else
            await rhack(7);
        assert.equal(level.monsters.length, 1);
        const human = level.monsters[0];
        assert.ok(human);
        assert.equal(MONSTER_NAME[human.mnum], 'human');
        const glyph = glyphAt(human.mx, human.my);
        assert.ok(glyph?.kind === 'monster');
        assert.equal(glyph.mnum, finalAppearance);
        assert.ok([...messages, game._pending_message].includes(appearance), `Creation must announce "${appearance}": ${messages.join(' | ')} | ${game._pending_message}`);
        assert.equal(game.context.move, useScroll ? 1 : 0);
    });
}
for (const request of ['I', 'invisible monster']) {
    void test(`wizard creation resolves "${request}" to a permanently invisible stalker`, async () => {
        const { level, input } = creationRoom();
        input.feed(`${request}\n`);
        await rhack(7);
        assert.equal(level.monsters.length, 1);
        const stalker = level.monsters[0];
        assert.ok(stalker);
        assert.equal(MONSTER_NAME[stalker.mnum], 'stalker');
        assert.equal(!!stalker.minvis, true);
        assert.equal(!!stalker.perminvis, true);
        assert.equal(game.context.move, 0);
    });
}
void test('a wizard reading create monster chooses the species through the native creation prompt', async () => {
    const { level, input } = creationRoom();
    const scroll = await addInventoryObject(SCR_CREATE_MONSTER, { blessed: true, typeKnown: true });
    input.beforeRead = () => {
        if (/Create what kind/.test(game._pending_message))
            input.feed('newt\n');
        else
            input.feed(' ');
    };
    await readInventoryObject(scroll);
    assert.equal(level.monsters.length, 1);
    assert.equal(monsterTypeName(level.monsters[0]?.mnum ?? -1), 'newt');
    assert.equal(scroll.where, 'gone');
    assert.equal(game.context.move, 1);
});
void test('a create-monster scroll keeps imposed invisibility through a chameleon birth', async () => {
    const { level, input } = creationRoom();
    const scroll = await addInventoryObject(SCR_CREATE_MONSTER, { blessed: true, typeKnown: true });
    input.beforeRead = () => {
        input.feed(/Create what kind/.test(game._pending_message) ? 'invisible chameleon\n' : ' ');
    };
    await readInventoryObject(scroll);
    assert.equal(level.monsters.length, 1);
    const chameleon = level.monsters[0];
    assert.ok(chameleon);
    assert.equal(chameleon.cham, MONSTER_NAME.indexOf('chameleon'));
    assert.notEqual(chameleon.mnum, chameleon.cham, 'The birth must exercise a change of form');
    assert.equal(!!chameleon.perminvis, true);
    assert.equal(!!chameleon.minvis, true);
    assert.equal(scroll.where, 'gone');
    assert.equal(game.context.move, 1);
});
for (const { request, species, female, surprised } of [
    { request: 'female elf lord', species: 'elf-noble', female: true, surprised: true },
    { request: 'male elf lady', species: 'elf-noble', female: false, surprised: true },
    { request: 'female incubi', species: 'amorous demon', female: true, surprised: true },
    { request: 'male succubi', species: 'amorous demon', female: false, surprised: true },
    { request: 'female cavemen', species: 'cave dweller', female: true, surprised: true },
    { request: 'male cavewomen', species: 'cave dweller', female: false, surprised: true },
    { request: 'elf lord', species: 'elf-noble', female: false, surprised: false },
    { request: 'elf lady', species: 'elf-noble', female: true, surprised: false },
    { request: 'incubi', species: 'amorous demon', female: false, surprised: false },
    { request: 'succubi', species: 'amorous demon', female: true, surprised: false },
]) {
    void test(`a create-monster scroll honors the gender hint in "${request}"`, async () => {
        const { level, input, messages } = creationRoom();
        const scroll = await addInventoryObject(SCR_CREATE_MONSTER, { blessed: true, typeKnown: true });
        input.beforeRead = () => {
            messages.push(game._pending_message);
            input.feed(/Create what kind/.test(game._pending_message) ? `${request}\n` : ' ');
        };
        await readInventoryObject(scroll);
        assert.equal(level.monsters.length, 1);
        assert.equal(MONSTER_NAME[level.monsters[0]?.mnum ?? -1], species, `Creation must retain the species requested by "${request}"`);
        assert.equal(level.monsters[0]?.female, female);
        const appearance = [...messages, game._pending_message].find(message => / appears next to you/.test(message));
        assert.ok(appearance, 'Creation must announce the monster');
        assert.match(appearance, surprised ? / suddenly appears next to you!$/ : / appears next to you\.$/);
        assert.equal(scroll.where, 'gone');
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=read_create_monster.test.js.map