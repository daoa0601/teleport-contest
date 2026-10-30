import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { bot } from '../js/display.js';
import { doGenocide } from '../js/genocide.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { APPLE, DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
void test('a doomed polymorphed hero leaves covered status rows blank after inspecting a floor pile', async () => {
    await freshObjectRoom({ flags: { menu_overlay: false } });
    installPolymorphedHero('red dragon');
    await floorObject(DAGGER, game.u.ux, game.u.uy);
    await floorObject(APPLE, game.u.ux, game.u.uy);
    await bot();
    const input = resetInputState();
    input.feed('human\r');
    installPagerInput(input, { expected: /Wiped out|dead inside|Things that are here|dagger|apple/, limit: 8 });
    await doGenocide(1);
    assert.equal(game.u.uhp, -1);
    await rhack(':'.charCodeAt(0));
    assert.equal(requireScreenRow(22).map(cell => cell.ch).join('').trim(), '');
    assert.equal(requireScreenRow(23).map(cell => cell.ch).join('').trim(), '');
});
//# sourceMappingURL=genocide_status.test.js.map