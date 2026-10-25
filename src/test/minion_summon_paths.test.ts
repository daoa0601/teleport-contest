import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_EMIN, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishSpecialRoamer } from '../js/mklev.js';
import { msummon, summonMinion } from '../js/minion.js';
import { MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL } from '../js/monster_data.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const M2_DEMON = 0x00000100;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const PM_ANGEL = MONSTER_NAME.indexOf('Angel');

function absorbMessages() {
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message);
        input.feed(' ');
    };
    return {
        messages,
        finish: () => {
            if (game._pending_message && game._pending_message !== messages.at(-1))
                messages.push(game._pending_message);
            return messages;
        },
    };
}

function genocideDemons({ lordsOnly = false } = {}): void {
    for (let mnum = 0; mnum < MONSTER_NAME.length; mnum++) {
        const flags = MONSTER_FLAGS2[mnum] ?? 0;
        if (!(flags & M2_DEMON)) continue;
        if (lordsOnly && !(flags & (M2_LORD | M2_PRINCE))) continue;
        requireMonsterVital(mnum, game).mvflags |= 0x1;
    }
}

void test('a neutral angel summons renegade neutral angels in one flash of light', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const summoner = await createMonsterAt(PM_ANGEL, 11, 10, MM_EMIN | NO_MINVENT);
    finishSpecialRoamer(summoner, 0, true);
    summoner.msleeping = 0;
    const log = absorbMessages();
    initRng(7n);

    const result = await msummon(summoner);

    assert.equal(result.count, 2, 'the summons must create a pair');
    assert.equal(result.created.length, 2);
    for (const angel of result.created) {
        assert.equal(angel.mnum, PM_ANGEL);
        assert.equal(angel.isminion, 1);
        assert.equal(angel.emin?.min_align, 0, 'a summoned angel shares its summoner\'s alignment');
        assert.equal(angel.emin?.renegade, 1, 'a hostile angel of a neutral hero is a renegade');
    }
    const arrivals = log.finish().filter(message => /appears/.test(message ?? ''));
    assert.deepEqual(arrivals, [
        'A renegade Angel of Ishtar appears in a flash of light!',
    ], 'a double summons reports only the final arrival');
});

void test('Demonbane leaves a demon summoner puzzled and alone', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await setPrimaryWeapon(await artifactObject('Demonbane'));
    const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
    demon.msleeping = 0;
    const log = absorbMessages();
    initRng(1n);

    const result = await msummon(demon);

    assert.deepEqual(log.finish(), ['The water demon looks puzzled for a moment.']);
    assert.equal(result.count, 0);
    assert.equal(result.created.length, 0);
});

void test('a demon lord whose peers are gone falls back to ordinary demons', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const lord = await createMonsterAt('Yeenoghu', 11, 10, NO_MINVENT);
    lord.msleeping = 0;
    genocideDemons({ lordsOnly: true });
    absorbMessages();
    initRng(3n);

    const result = await msummon(lord);

    assert.equal(result.created.length, 1);
    const [summoned] = result.created;
    assert.ok(summoned, 'the fallback summon must exist');
    const flags = MONSTER_FLAGS2[summoned.mnum] ?? 0;
    assert.ok(flags & M2_DEMON, 'the fallback summon is still a demon');
    assert.ok(!(flags & (M2_LORD | M2_PRINCE)), 'no extinct lord or prince answers');
});

void test('a demon lord summons nothing once every demon is genocided', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const lord = await createMonsterAt('Yeenoghu', 11, 10, NO_MINVENT);
    lord.msleeping = 0;
    genocideDemons();
    absorbMessages();
    initRng(3n);

    const result = await msummon(lord);

    assert.equal(result.count, 0);
    assert.equal(result.created.length, 0);
});

for (const { alignment, deity, description } of [
    { alignment: 1, deity: 'Anu', description: 'lawful' },
    { alignment: 0, deity: 'Ishtar', description: 'neutral' },
    { alignment: -1, deity: 'Anshar', description: 'chaotic' },
    { alignment: -128, deity: 'Moloch', description: 'unaligned' },
] satisfies { alignment: number; deity: string; description: string }[]) {
    void test(`an angry ${description} god sends a hostile servant that denounces the hero`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const log = absorbMessages();
        initRng(7n);

        const minion = await summonMinion(alignment, true);

        assert.ok(minion);
        assert.equal(minion.isminion, 1);
        assert.equal(minion.emin?.min_align, alignment);
        assert.equal(minion.emin?.renegade, 0);
        assert.equal(!!minion.mpeaceful, false, 'the divine servant arrives hostile');
        if (alignment === 1) {
            assert.equal(MONSTER_SYMBOL[minion.mnum], 27, 'the lawful god sends an angelic servant');
        } else if (alignment === 0) {
            assert.ok(['air elemental', 'fire elemental', 'earth elemental', 'water elemental']
                .includes(MONSTER_NAME[minion.mnum] ?? ''), 'the neutral god sends an elemental');
        } else {
            assert.ok((MONSTER_FLAGS2[minion.mnum] ?? 0) & M2_DEMON,
                'chaotic and unaligned gods send demons');
        }
        const flow = log.finish().join('\n');
        assert.match(flow, new RegExp(`The voice of ${deity} booms:`));
        assert.match(flow, /"Thou shalt pay for thine indiscretion!"/);
        assert.match(flow, /appears before you\./);
    });
}
