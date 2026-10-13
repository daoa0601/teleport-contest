import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { A_LAWFUL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const peaceful of [false, true]) {
    void test(`killing a watchman forced ${peaceful ? 'peaceful' : 'hostile'} by #wizgenesis ${peaceful ? 'penalizes alignment and counts as murder' : 'rewards alignment without murder'}`, async () => {
        const level = freshObjectRoom({
            flags: { debug: true }, moves: 2000,
            hero: { ualign: { type: A_LAWFUL, record: 0 }, uluck: 0 },
        });
        requirePlayingGame(game);
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /watchman|murderer/, limit: 10 });
        input.feed(`wizgenesis\n${peaceful ? 'peaceful' : 'hostile'} watchman\n`);

        await rhack('#'.charCodeAt(0));
        const watchman = level.monsters.find(monster =>
            MONSTER_NAME[monster.mnum] === 'watchman');
        assert.ok(watchman, '#wizgenesis should create the requested watchman');
        assert.equal(!!watchman.mpeaceful, peaceful);
        await finishHeroMonsterKill(watchman, watchman.mx, watchman.my, {
            showKillMessage: false, noCorpse: true,
        });
        messages.push(game._pending_message);

        assert.equal(game.u.ualign.record, peaceful ? -20 : 15);
        if (peaceful) assert.match(messages.join('\n'), /You murderer!/);
        else {
            assert.doesNotMatch(messages.join('\n'), /You murderer!/);
            assert.equal(game.u.uluck, 0);
        }
    });
}
