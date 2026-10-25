import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { CORR, D_CLOSED, D_NODOOR, DOOR, ROOM, STONE, TREE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AXE, PICK_AXE, WAN_DIGGING } from '../js/object_data.js';
import { roles } from '../js/roles.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

// C dig.c zap_dig(): a closed door in the beam's way is razed outright.
void test('a digging wand razes a closed door in its path', async () => {
    const level = freshObjectRoom();
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /beam|door|razed/, limit: 10 });
    input.feed(`${wand.invlet}l`);
    initRng(3n);

    await rhack('z'.charCodeAt(0));

    assert.equal(door.typ, DOOR);
    assert.equal(door.doormask, D_NODOOR);
});

void test('an axe fells a tree and a pick cuts rock on the final swing', async () => {
    const cases = [
        { tool: AXE, terrain: TREE, message: 'You cut down the tree.' },
        { tool: PICK_AXE, terrain: STONE, message: 'You succeed in cutting away some rock.' },
    ] as const;
    for (const expectation of cases) {
        const level = freshObjectRoom();
        const location = level.requireAt(11, 10);
        location.typ = expectation.terrain;
        const tool = await addInventoryObject(expectation.tool, { spe: 0 });
        game.uwep = game.u.uwep = tool;
        const input = resetInputState();
        installPagerInput(input, { expected: /chop|dig|cut|tree|rock/, limit: 20 });
        input.feed(`${tool.invlet}l`);
        initRng(2n);

        await rhack('a'.charCodeAt(0));
        for (let swing = 0; game._occupation && swing < 20; swing++)
            await continueCountedCommand();

        assert.match(String(game._pending_message), new RegExp(`${expectation.message}$`),
            `${expectation.tool === AXE ? 'axe' : 'pick'} must announce its finished dig`);
        assert.equal(location.typ, expectation.tool === AXE ? ROOM : CORR);
        assert.equal(game._occupation, null);
    }
});

// C dig.c dig(): elves and rangers lose alignment for felling a tree.
void test('a ranger is penalized for cutting down a tree', async () => {
    const level = freshObjectRoom();
    const ranger = roles.find(candidate => candidate.key === 'ranger');
    assert.ok(ranger);
    game.urole = ranger;
    level.requireAt(11, 10).typ = TREE;
    const axe = await addInventoryObject(AXE, { spe: 0 });
    game.uwep = game.u.uwep = axe;
    const input = resetInputState();
    installPagerInput(input, { expected: /chop|tree/, limit: 20 });
    input.feed(`${axe.invlet}l`);
    initRng(2n);
    const recordBefore = game.u.ualign?.record ?? 0;

    await rhack('a'.charCodeAt(0));
    for (let swing = 0; game._occupation && swing < 20; swing++)
        await continueCountedCommand();

    assert.equal(game.u.ualign?.record, recordBefore - 1);
});
