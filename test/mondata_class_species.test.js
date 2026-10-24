import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { G_GENOD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireMonsterVital } from './support/monsters.js';
const requests = [
    ['~', 'long worm'], ['grey dragons', 'gray dragon'],
];
for (const [request, form] of requests) {
    void test(`class request ${request} cannot replace a genocided ${form} with another species`, async () => {
        freshObjectRoom({ flags: { debug: true } });
        requirePlayingGame(game);
        requireMonsterVital(MONSTER_NAME.indexOf(form)).mvflags |= G_GENOD;
        pushKeys(`polyself\n${request}\n${' '.repeat(20)}`);
        await rhack('#'.charCodeAt(0));
        assert.equal(game.u.umonnum, game.u.umonster);
    });
}
//# sourceMappingURL=mondata_class_species.test.js.map