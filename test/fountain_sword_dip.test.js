import test from 'node:test';
import assert from 'node:assert/strict';
import { roles } from '../js/roles.js';
import { FOUNTAIN, ROOM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LONG_SWORD } from '../js/object_data.js';
import { artifactByName } from '../js/artifacts.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const alignments = [1, 0];
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
        }
        else {
            assert.equal(!!sword.oartifact, false);
            assert.equal(sword.cursed, true);
            assert.equal(sword.oerodeproof, false);
        }
    });
}
//# sourceMappingURL=fountain_sword_dip.test.js.map