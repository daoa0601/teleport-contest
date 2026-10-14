import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { G_EXTINCT, W_ARMH } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { HELM_OF_OPPOSITE_ALIGNMENT } from '../js/object_data.js';
import { uncurseObjectState } from '../js/object_state.js';
import type { GameObject } from '../js/object_types.js';
import { objectTypeKnown } from '../js/shk.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';

void test('an opposite-alignment helm changes alignment, confuses and curses, then restores base alignment on removal', async () => {
    freshObjectRoom({ hero: { ualign: { type: 1, record: 20, abuse: 0 }, ualignbase: [1, 1], ublessed: 3 } });
    const helmet = await addInventoryObject(HELM_OF_OPPOSITE_ALIGNMENT, { known: false, typeKnown: false });

    const messages = await dress('W', helmet);

    assert.equal(game.u.ualign?.type, -1);
    assert.equal(game.u.ualign?.record, 0);
    assert.equal(game.u.ualign?.abuse, 7);
    assert.equal(game.u.ublessed, 0);
    assert.ok((game.u.confusionTurns ?? 0) >= 3 && (game.u.confusionTurns ?? 0) <= 4);
    assert.equal(helmet.cursed, true);
    assert.equal(objectTypeKnown(helmet), true);
    assert.match(messages, /Your mind oscillates briefly\./);
    uncurseObjectState(helmet);

    const removal = await dress('T', helmet);

    assert.equal(game.u.ualign?.type, 1);
    assert.match(removal, /Your mind is back in sync with your body\./);
});

void test('a fatal Excalibur blast stops helmet wear before cursing or discovering its type', async () => {
    freshObjectRoom({
        role: 'knight',
        hero: { uhp: 1, uhpmax: 1, ualign: { type: 1, record: 20, abuse: 0 }, ualignbase: [1, 1] },
        flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    game.storage = memoryStorage();
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact);
    const sword = await addInventoryObject(artifact.baseType, { oartifact: artifact.id, oname: artifact.name });
    await setPrimaryWeapon(sword);
    const helmet = await addInventoryObject(HELM_OF_OPPOSITE_ALIGNMENT, { known: false, typeKnown: false });

    const messages = await dress('W', helmet);

    assert.equal(game.program_state.gameover, true);
    assert.match(messages, /You are blasted by Excalibur's power!/);
    assert.equal(helmet.cursed, false);
    assert.equal(objectTypeKnown(helmet), false);
    assert.doesNotMatch(messages, /glows black for a moment/);
});

void test('a fatal alignment blast during helmet removal leaves the helmet worn', async () => {
    freshObjectRoom({
        hero: { ualign: { type: 1, record: 20, abuse: 0 }, ualignbase: [1, 1] },
        flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    game.storage = memoryStorage();
    const helmet = await addInventoryObject(HELM_OF_OPPOSITE_ALIGNMENT, { known: false });
    await dress('W', helmet);
    uncurseObjectState(helmet);
    const artifact = artifactByName('Stormbringer');
    assert.ok(artifact);
    const sword = await addInventoryObject(artifact.baseType, { oartifact: artifact.id, oname: artifact.name });
    await setPrimaryWeapon(sword);
    game.u.uhp = game.u.uhpmax = 1;

    const messages = await dress('T', helmet);

    assert.equal(game.program_state.gameover, true);
    assert.match(messages, /You are blasted by Stormbringer's power!/);
    assert.equal(game.u.ualign?.type, 1);
    assert.equal(game.uarmh, helmet, 'Death interrupts Helmet_off before it clears the slot');
    assert.equal(helmet.worn, true);
    assert.ok((helmet.owornmask ?? 0) & W_ARMH);
});

for (const id of [2, 3]) {
    void test(`a neutral hero's opposite alignment follows helm identity parity ${id % 2}`, async () => {
        freshObjectRoom({ hero: { ualign: { type: 0, record: 0, abuse: 0 }, ualignbase: [0, 0] } });
        const helmet = await addInventoryObject(HELM_OF_OPPOSITE_ALIGNMENT, { o_id: id, known: false });

        await dress('W', helmet);

        assert.equal(game.u.ualign?.type, id % 2 ? -1 : 1);
        assert.deepEqual(game.u.ualignbase, [0, 0]);
    });
}

void test('an opposite-alignment helm summons a hostile fury when alignment abuse exceeds its chance bound', async () => {
    freshObjectRoom({ hero: { ualign: { type: 1, record: 0, abuse: 100 }, ualignbase: [1, 1] } });
    const helmet = await addInventoryObject(HELM_OF_OPPOSITE_ALIGNMENT, { known: false });

    await dress('W', helmet);

    const species = MONSTER_NAME.indexOf('erinys');
    const furies = game.level?.monsters.filter(monster => monster.mnum === species) ?? [];
    assert.equal(furies.length, 1);
    assert.equal(!!furies[0]?.mpeaceful, false);
    assert.equal(game.mvitals?.[species]?.born, 1);
});

void test('an opposite-alignment helm on the Astral Plane summons the remaining furies through extinction', async () => {
    freshObjectRoom({ hero: { uz: { dnum: 0, dlevel: 1 }, ualign: { type: 1, record: 0, abuse: 0 }, ualignbase: [1, 1] } });
    game.astral_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    const helmet = await addInventoryObject(HELM_OF_OPPOSITE_ALIGNMENT, { known: false });

    await dress('W', helmet);

    const species = MONSTER_NAME.indexOf('erinys');
    assert.equal(game.level?.monsters.filter(monster => monster.mnum === species).length, 3);
    assert.equal(game.mvitals?.[species]?.born, 3);
    assert.ok((game.mvitals?.[species]?.mvflags ?? 0) & G_EXTINCT);
});

async function dress(command: 'W' | 'T', object: GameObject): Promise<string> {
    assert.ok(object.invlet);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${object.invlet}                       \x1b`);
    await rhack(command.charCodeAt(0));
    for (let turn = 0; turn < 20 && !game.program_state.gameover; turn++) {
        await moveloop_core();
        if (command === 'W' ? object.known : !object.worn) break;
    }
    return [...messages, game._pending_message].join(' ');
}
