import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { nameToMonster } from '../js/mondata.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
const requests = [
    ['Heroic', 'Valkyrie'], ['Master Archer', 'Monk'],
];
for (const [request, body] of requests) {
    void test(`the rank request ${request} supplies the native body title ${body}`, async () => {
        freshObjectRoom({ role: 'wizard' });
        requirePlayingGame(game);
        const species = nameToMonster(request);
        if (species >= 0)
            game.u.umonnum = species;
        await bot();
        assert.match(requireScreenRow(22).map(cell => cell.ch).join(''), new RegExp(`the ${body}\\b`));
    });
}
//# sourceMappingURL=status_rank_monster_lookup.test.js.map