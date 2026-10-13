import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CLUB, MAGIC_LAMP, OIL_LAMP } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('wielding with no suggested weapons shows the hands choice with one separator', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const wield = rhack('w'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'What do you want to wield? [- or ?*]');
    }
    finally {
        input.feed('\x1b');
        await wield;
    }
});
void test('rubbing a lamp wields it and keeps the old weapon as secondary', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const club = await addInventoryObject(CLUB, {
        invlet: 'a',
        wielded: true,
        owornmask: W_WEP,
    });
    const lamp = await addInventoryObject(OIL_LAMP, { invlet: 'b' });
    game.uwep = game.u.uwep = club;
    game.flags.pushweapon = true;
    pushKeys('rub\nb');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.uwep, lamp);
    assert.equal(game.uswapwep, club);
    assert.equal(club.alternate, true);
    assert.equal(lamp.wielded, true);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /now wield/);
    await rhack(0);
    assert.match(game._pending_message, /Nothing happens/);
    assert.equal(game.context.move, 1);
});
void test('a welded primary weapon prevents wielding a lamp to rub it', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const club = await addInventoryObject(CLUB, {
        invlet: 'a',
        cursed: true,
        bknown: false,
        wielded: true,
        owornmask: W_WEP,
    });
    await addInventoryObject(OIL_LAMP, { invlet: 'b' });
    game.uwep = game.u.uwep = club;
    pushKeys('rub\nb');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.uwep, club);
    assert.equal(club.bknown, true);
    assert.equal(game._cannedCommands?.length ?? 0, 0);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /welded to your hand/);
});
for (const peaceful of [false, true]) {
    void test(`killing a ${peaceful ? 'peaceful' : 'hostile'} djinni released from a lamp applies its final attitude to alignment`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const lamp = await addInventoryObject(MAGIC_LAMP, {
            spe: 1, age: 200, invlet: 'a', wielded: true, owornmask: W_WEP,
        });
        game.uwep = game.u.uwep = lamp;
        initRng(peaceful ? 45n : 39n);
        resetInputState().feed('rub\na    ');
        await rhack('#'.charCodeAt(0));
        const djinni = game.level.monsters.find(monster => MONSTER_NAME[monster.mnum] === 'djinni');
        assert.ok(djinni, 'rubbing the lamp should release a djinni');
        assert.equal(!!djinni.mpeaceful, peaceful);
        assert.ok(!djinni.mtame);
        await finishHeroMonsterKill(djinni, djinni.mx, djinni.my, {
            showKillMessage: false, noCorpse: true,
        });
        assert.equal(game.u.ualign.record, peaceful ? -14 : 3);
    });
}
//# sourceMappingURL=rub_wield.test.js.map