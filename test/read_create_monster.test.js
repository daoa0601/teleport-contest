import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName } from '../js/monster_data.js';
import { SCR_CREATE_MONSTER } from '../js/object_data.js';
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
//# sourceMappingURL=read_create_monster.test.js.map