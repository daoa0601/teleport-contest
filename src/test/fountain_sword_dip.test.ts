import test from 'node:test';
import assert from 'node:assert/strict';
import { roles } from '../js/roles.js';
import { CORR, FOUNTAIN, ROOM, SCORR } from '../js/const.js';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { LONG_SWORD } from '../js/object_data.js';
import { artifactByName } from '../js/artifacts.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';

const alignments: (0 | 1)[] = [1, 0];
for (const alignment of alignments) {
    void test(`the Lady of the Lake judges a level-five knight with alignment ${alignment}`, async () => {
        freshObjectRoom({ hero: { ulevel: 5, ualign: { type: alignment, record: 0 } } });
        requirePlayingGame(game);
        const knight = roles.find(role => role.key === 'knight');
        assert.ok(knight);
        game.urole = knight;
        const location = game.level.requireAt(game.u.ux, game.u.uy);
        location.typ = FOUNTAIN;
        game.level.flags.nfountains = 1;
        const sword = await addInventoryObject(LONG_SWORD, { oeroded: 2, oeroded2: 1 });
        resetInputState();
        initRng(10n);

        await runExtendedCommand('dip', sword.invlet + 'y' + ' '.repeat(30));

        assert.equal(location.typ, ROOM);
        assert.equal(game.level.flags.nfountains, 0);
        if (alignment === 1) {
            assert.equal(sword.oartifact, artifactByName('Excalibur')?.id);
            assert.equal(sword.blessed, true);
            assert.equal(sword.oerodeproof, true);
            assert.equal(sword.oeroded, 0);
            assert.equal(sword.oeroded2, 0);
        } else {
            assert.equal(!!sword.oartifact, false);
            assert.equal(sword.cursed, true);
            assert.equal(sword.oerodeproof, false);
        }
    });
}

void test('Excalibur made in the wielded hand searches while waiting and stops when unwielded', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 5, ualign: { type: 1, record: 0 } } });
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;
    game.level.flags.nfountains = 1;
    const sword = await addInventoryObject(LONG_SWORD, { spe: 5 });
    await setPrimaryWeapon(sword);
    resetInputState();
    initRng(10n);

    await runExtendedCommand('dip', sword.invlet + 'y' + ' '.repeat(30));

    assert.equal(sword.oartifact, artifactByName('Excalibur')?.id);
    assert.equal(game.u.searching, true);
    const passage = game.level.requireAt(game.u.ux + 1, game.u.uy);
    passage.typ = SCORR;
    game.level.flags.rndmongen = false;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    resetInputState();
    pushKeys('m.'.repeat(32));
    for (let turn = 0; turn < 32 && passage.typ === SCORR; turn++)
        await moveloop_core();
    assert.equal(passage.typ, CORR, 'Waiting with Excalibur reveals the adjacent hidden passage');

    resetInputState();
    pushKeys('-' + ' '.repeat(20));
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uwep, null);
    assert.equal(game.u.searching, false);
});
