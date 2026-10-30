import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DAGGER, LEATHER_ARMOR } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { heroCannotTake, polymonHero } from '../js/polyself.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C pickup.c:pickup(): a form that cannot take objects first looks at the
// floor (check_here()), then explains why nothing was picked up.
void test('a hero unable to take objects sees the floor item before the refusal', async () => {
    await freshObjectRoom({ flags: { pickup: true } });
    requireFixtureGame(game);
    const paged: string[] = [];
    const input = resetInputState();
    input.display = {
        async readKey(): Promise<number> {
            paged.push(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim() ?? '');
            return ' '.charCodeAt(0);
        },
    };
    await polymonHero(MONSTER_NAME.indexOf('red naga'));
    assert.ok(heroCannotTake(game));
    await floorObject(LEATHER_ARMOR, game.u.ux, game.u.uy, { dknown: true });
    game._pending_message = '';
    paged.length = 0;

    await autopickupAtHero();

    assert.equal(paged.length, 1);
    assert.match(paged[0] ?? '', /^You see here .*leather armor\.--More--$/);
    assert.equal(game._pending_message, 'You are physically incapable of picking anything up.');
});

for (const blind of [false, true]) {
    void test(`manual pickup by a ${blind ? 'blind' : 'sighted'} handless hero describes the pile with pickup off`, async () => {
        await freshObjectRoom({ flags: { pickup: false } });
        const messages: string[] = [];
        const input = resetInputState();
        input.display = { async readKey() { return ' '.charCodeAt(0); } };
        await polymonHero(MONSTER_NAME.indexOf('red naga'));
        if (blind) game.u.blindTurns = 20;
        const armor = await floorObject(LEATHER_ARMOR, game.u.ux, game.u.uy);
        for (let count = 0; count < 4; count++)
            await floorObject(DAGGER, game.u.ux, game.u.uy);
        game._pending_message = '';
        input.beforeRead = () => { messages.push(game._pending_message); };

        await rhack(','.charCodeAt(0));

        const description = [...messages, game._pending_message].join(' ');
        assert.match(description, blind
            ? /You try to feel what is lying here on the floor\./
            : /There are several objects here\./);
        assert.doesNotMatch(description, /physically incapable/);
        assert.equal(armor.where, 'floor');
        assert.equal(game.context.move, 0);
    });
}
