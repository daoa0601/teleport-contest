import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, LADDER, ROOM } from '../js/const.js';
function isWalkableTerrain(type) {
    return type === ROOM || type === CORR || type === LADDER;
}
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE } from '../js/object_data.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { placeObjectSynchronously } from '../js/floor_object.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { untimedCorpse } from './support/game-objects.js';
import { createDungeon } from './support/topology.js';
function feedPager({ acceptDeath = false } = {}) {
    const lines = [];
    const input = resetInputState();
    input.beforeRead = () => {
        for (const line of game._pending_message?.split('\n') ?? [])
            lines.push(line);
        const prompt = game._pending_message || '';
        game._pending_message = '';
        input.feed(acceptDeath && prompt.includes('Die?') ? 'y' : ' ');
    };
    return lines;
}
// do.c:goto_level() ends with pickup(1) (do.c:1996); if that kills the
// hero, done() does not return, so deferred_goto() (do.c:2096) never
// prints its deferred message after the death screens.
void test('a deferred arrival message stays silent when the arrival pickup kills the hero', async () => {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 1 } }, seed: 3n });
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 5 }),
        createDungeon({ dname: 'Gehennom', num_dunlevs: 3 }),
    ];
    game.flags.pickup = true;
    // Generate the destination and drop a cockatrice corpse on the tile
    // the hero will reappear on when returning.
    feedPager();
    await gotoLevel({ dnum: 1, dlevel: 2 });
    // The random arrival spot is not predictable, so every walkable tile
    // gets a cockatrice corpse; the hero lands on one of them bare-handed.
    const level = game.level;
    assert.ok(level);
    let placed = 0;
    for (const column of level.objects ?? []) {
        for (const cell of column ?? [])
            (cell ?? []).length = 0;
    }
    for (let x = 1; x < level.locations.length; x++) {
        const column = level.locations[x] ?? [];
        for (let y = 0; y < column.length; y++) {
            const location = column[y];
            if (!location || !isWalkableTerrain(location.typ))
                continue;
            const corpse = await untimedCorpse(MONSTER_NAME.indexOf('cockatrice'));
            placeObjectSynchronously(corpse, x, y, game);
            placed++;
        }
    }
    assert.ok(placed > 10, `the level needs corpses to land on (placed ${placed})`);
    feedPager();
    await gotoLevel({ dnum: 0, dlevel: 1 });
    const lines = feedPager({ acceptDeath: true });
    await gotoLevel({ dnum: 1, dlevel: 2 }, { postMessage: 'You feel extremely out of place.' });
    await flush_screen();
    for (const line of game._pending_message?.split('\n') ?? [])
        lines.push(line);
    game._pending_message = '';
    assert.equal(game.program_state?.gameover, true, 'picking up the cockatrice corpse bare-handed must end the game');
    const text = lines.join('\n');
    assert.ok(/You die|turning to stone|You turn to stone/.test(text), `the death screens print (got: ${text})`);
    assert.equal(text.includes('You feel extremely out of place.'), false, `no deferred message after the death screens (got: ${text})`);
});
//# sourceMappingURL=deferred_message_death.test.js.map