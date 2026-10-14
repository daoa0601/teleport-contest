import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { IRON_SHOES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function meleeRoom(form: string, defender: string) {
    freshObjectRoom({
        flags: { verbose: true, bones: false, disclose: '-i -a -v -c -o' },
        hero: { uhitinc: 100, uhp: 200, uhpmax: 200 },
    });
    installPolymorphedHero(form, { hitPoints: 200 });
    const monster = await createMonsterAt(defender, 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    monster.mhp = monster.mhpmax = 2000;
    monster.mpeaceful = false;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    monster.minvis = 0;
    monster.mundetected = 0;
    return monster;
}

async function attackEast(expected: RegExp, force = false): Promise<string> {
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, { expected, limit: 20 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    if (force) pushKey('l');
    await rhack((force ? 'F' : 'l').charCodeAt(0));
    assert.equal(game.context.move, 1, 'An attack against the adjacent target must spend a turn');
    messages.push(game._pending_message);
    return messages.join('\n');
}

void test('hallucination lets an attacker see a floating eye look numb or stupefied', async () => {
    await meleeRoom('newt', 'floating eye');
    game.u.hallucinationTurns = 100;
    game.u.freeAction = true;
    initRng(41n);
    const reactions: string[] = [];

    for (let attempt = 0; attempt < 24; attempt++) {
        const messages = await attackEast(/bite|looks|stiffen/);
        for (const match of messages.matchAll(/looks ([^.\n]+)\./g)) {
            assert.ok(match[1]);
            reactions.push(match[1]);
        }
    }

    assert.ok(reactions.length > 0, 'The hallucinating attacker should sometimes escape the gaze');
    for (const reaction of reactions)
        assert.match(reaction, /^(?:rather )?(?:numb|stupefied)$/,
            'The eye reaction has one optional adjective');
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('a blind floating eye cannot freeze the hero who strikes it', async () => {
    const eye = await meleeRoom('newt', 'floating eye');
    eye.mcansee = 0;
    eye.mblinded = 10;
    initRng(41n);
    let messages = '';

    for (let attempt = 0; attempt < 6; attempt++)
        messages += await attackEast(/floating eye|cannot defend/);

    assert.match(messages, /The blind floating eye cannot defend itself\./);
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('a natural melee kick does not offer boots to an acid blob\'s object passive', async () => {
    await meleeRoom('sasquatch', 'acid blob');
    const boots = await addInventoryObject(IRON_SHOES);
    wearHeroArmor(boots);
    // Intrinsic acid resistance protects the body, not these boots.
    game.u.acidResistance = true;
    initRng(41n);
    let messages = '';

    for (let attempt = 0; attempt < 6; attempt++)
        messages += await attackEast(/acid blob|splashed|corrode/);

    assert.match(messages, /You kick the acid blob/);
    assert.equal(boots.oeroded2 ?? 0, 0,
        'hmonas passes no contact object for a natural kick');
});
