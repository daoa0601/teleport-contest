import { requireScreenRow } from './support/screen.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { loadScoreRecords } from '../js/score_records.js';
import { createRoom } from './support/topology.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { initRng } from '../js/rng.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { installPagerInput } from './support/pager-input.js';
const SPELL_PROSE = /^$|survived that attempt on your life|mumbled curse|priest|cleric|lich|wounds|geyser|die|medallion|frozen|touch of death|pillar of fire|lightning|curses|misses|normal|head suddenly|return|Goodbye|points|But wait|feel much better/i;
async function runSpellTurn(input, messages, refuseDeath = false) {
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    installPagerInput(input, { expected: SPELL_PROSE, limit: 40 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            const top = requireScreenRow(0).map(cell => cell.ch).join('');
            if (top.includes('Die?')) {
                assert.equal(refuseDeath, true, 'Only debug refusal answers the death question');
                return 'n'.charCodeAt(0);
            }
            if (/--More--|Hit space to continue/.test(top))
                return pager.readKey();
            assert.doesNotMatch(top, /\?/, 'Unexpected input question during the spell turn');
            assert.match(game._pending_message || '', SPELL_PROSE);
            return 27;
        },
    };
    input.feed('m.');
    await moveloop_core();
    await moveloop_core();
}
async function attackingPriest(seed = 9n, species = 'aligned cleric') {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const room = createRoom({ lx: 8, hx: 18, ly: 8, hy: 12, rtype: TEMPLE });
    game.level.rooms = [room];
    game.level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++)
            game.level.requireAt(x, y).roomno = ROOMOFFSET;
    }
    const location = game.level.requireAt(8, 10);
    location.typ = ALTAR;
    location.flags = AM_SHRINE | Align2amask(0);
    const priest = await createMonsterAt(species, 11, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.mpeaceful = 0;
    priest.mstun = 1;
    priest.msleeping = 0;
    priest.movement = 12;
    priest.mhp = 100;
    priest.mhpmax = 100;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 8, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    game.u.uhp = 1;
    game.u.uhpmax = 500;
    game.u.uac = -1000;
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -c -o';
    updateHeroRoomMembership(game);
    vision_recalc(0);
    initRng(seed);
    return { input, priest };
}
void test('fatal priest wounds end the turn before the second attack round', async () => {
    const { input } = await attackingPriest();
    requirePlayingGame(game);
    const messages = [];
    await runSpellTurn(input, messages);
    const text = messages.join('\n');
    assert.match(text, /wounds appear on your body/);
    assert.equal(game.program_state.gameover, true, text);
    assert.equal(game.u.umortality, 1);
    assert.equal((text.match(/(?:just )?misses!/g) || []).length, 2, text);
});
for (const recovery of ['life saving', 'debug refusal']) {
    void test(`priest wounds resume the second attack round after ${recovery}`, async () => {
        const { input } = await attackingPriest();
        requirePlayingGame(game);
        let amulet;
        if (recovery === 'life saving') {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        else
            game.flags.debug = true;
        initRng(9n);
        const messages = [];
        await runSpellTurn(input, messages, recovery === 'debug refusal');
        const text = messages.join('\n');
        assert.match(text, /wounds appear on your body/);
        assert.ok(!game.program_state.gameover, text);
        assert.equal(game.u.umortality, 1);
        assert.ok(game.u.uhp > 0);
        const recoveryMessage = amulet ? 'medallion crumbles to dust' : "OK, so you don't die";
        assert.match(text.slice(text.indexOf(recoveryMessage)), /priest of Odin (?:just )?misses!/);
        assert.equal(game.moves, 2);
        if (amulet)
            assert.equal(amulet.where, 'gone');
    });
}
for (const hpMax of [10, 500]) {
    void test(`fatal death touch ${hpMax === 10 ? 'drains the whole life force' : 'exhausts current HP'} with its own cause`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        const lich = await createMonsterAt('arch-lich', 11, 10, NO_MINVENT);
        lich.mpeaceful = false;
        lich.movement = 12;
        lich.mhp = 100;
        lich.mhpmax = 100;
        lich.mgivenname = 'Kelvin';
        game.u.uhp = 1;
        game.u.uhpmax = hpMax;
        game.u.uac = -1000;
        game.u.coldResistance = true;
        game.u.urexp = 100;
        game.storage = memoryStorage();
        game.flags.disclose = '-i -a -v -c -o';
        initRng(15n);
        const messages = [];
        await runSpellTurn(input, messages);
        const text = messages.join('\n');
        assert.match(text, /using the touch of death/);
        assert.equal(game.program_state.gameover, true, text);
        const records = loadScoreRecords(game);
        assert.ok(records[0], 'Death records the completed game');
        assert.equal(records[0].death, 'killed by the touch of death inflicted by an arch-lich');
        if (hpMax === 10)
            assert.doesNotMatch(text, /You die/);
        else
            assert.match(text, /You die/);
    });
}
void test('a fatal first geyser stops the high priest before any later slot', async () => {
    const { input, priest } = await attackingPriest(105n, 'high cleric');
    requirePlayingGame(game);
    const messages = [];
    await runSpellTurn(input, messages);
    const text = messages.join('\n');
    assert.match(text, /A sudden geyser slams into you/);
    assert.equal(game.program_state.gameover, true, text);
    assert.ok(priest.mstun, 'stunning admitted the special movement attack');
    assert.doesNotMatch(text.slice(text.indexOf('A sudden geyser')), /misses|curses/);
});
void test('a geyser destroys only the monster body, then the priest finishes its attack slots', async () => {
    const { input } = await attackingPriest(156n, 'high cleric');
    requirePlayingGame(game);
    game.u.uhp = 500;
    installPolymorphedHero('grid bug', { hitPoints: 1 });
    game.u.uac = -1000;
    initRng(156n);
    const messages = [];
    await runSpellTurn(input, messages);
    const text = messages.join('\n');
    assert.match(text, /A sudden geyser slams into you/);
    assert.ok(!game.program_state.gameover, text);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, 500);
    assert.match(text.slice(text.indexOf('A sudden geyser')), /curses/);
});
for (const [seed, effect] of [[16n, 'pillar of fire'], [29n, 'bolt of lightning']]) {
    void test(`a monster spell's ${effect} damages the current body instead of human HP`, async () => {
        const { input } = await attackingPriest(seed, 'high cleric');
        requirePlayingGame(game);
        game.u.uhp = 500;
        installPolymorphedHero('kobold', { hitPoints: 500 });
        game.u.uac = -1000;
        initRng(seed);
        const messages = [];
        await runSpellTurn(input, messages);
        assert.ok(messages.join('\n').includes(effect), messages.join('\n'));
        assert.ok(!game.program_state.gameover);
        assert.equal(game.u.uhp, 500);
        assert.ok(game.u.mh <= 492, "the active body takes at least the spell's minimum 8d6 damage");
    });
}
void test('fatal paralysis damage cannot start another priest attack', async () => {
    const { input } = await attackingPriest(13n);
    requirePlayingGame(game);
    const messages = [];
    await runSpellTurn(input, messages);
    const text = messages.join('\n');
    assert.match(text, /You are frozen in place/);
    assert.equal(game.program_state.gameover, true, text);
    assert.equal(game.u.umortality, 1);
    assert.doesNotMatch(text.slice(text.indexOf('You are frozen in place')), /misses|curses/);
});
void test('a fatal psi bolt enters the ordinary monster death flow', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const lich = await createMonsterAt('arch-lich', 11, 10, NO_MINVENT);
    lich.mpeaceful = false;
    lich.movement = 12;
    lich.mhp = 100;
    lich.mhpmax = 100;
    game.u.uhp = 1;
    game.u.uhpmax = 500;
    game.u.uac = -1000;
    game.u.coldResistance = true;
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -c -o';
    initRng(12n);
    const messages = [];
    await runSpellTurn(input, messages);
    const text = messages.join('\n');
    assert.match(text, /Your head suddenly aches very painfully/);
    assert.equal(game.program_state.gameover, true, text);
    assert.equal(game.u.umortality, 1);
    assert.match(text, /You die/);
});
//# sourceMappingURL=monster_spell_death.test.js.map