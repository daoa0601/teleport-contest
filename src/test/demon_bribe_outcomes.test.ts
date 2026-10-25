import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { talkToDemon } from '../js/demon_talk.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import type { GameMap } from '../js/game.js';
import type { Monster } from '../js/monster_types.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_YENDOR, GOLD_PIECE, OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom, type ObjectRoomOptions } from './support/object-room.js';

// C minion.c:demon_talk()/bribe(). A peaceful demon beside the hero with
// mux/muy on the hero runs the whole payment conversation.
interface BribeScene {
    level: GameMap;
    demon: Monster;
    messages: string[];
    finish: () => string[];
}

async function briber({
    gold, hero, hell, demonSetup,
}: {
    gold?: number;
    hero?: ObjectRoomOptions['hero'];
    hell?: boolean;
    demonSetup?: (demon: Monster) => Promise<void>;
} = {}): Promise<BribeScene> {
    const level = freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, ...hero } });
    if (hell) game.dungeons = [{
        dname: 'Gehennom', num_dunlevs: 20, entry_lev: 1, dunlev_ureached: 1,
        depth_start: 1,
        flags: { hellish: true, maze_like: false, alignment: null },
        bonetag: undefined, protofile: undefined, levelFill: undefined,
        themeRooms: undefined,
    }];
    if (gold !== undefined) setHeroGoldAmount(game, gold);
    const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
    demon.mpeaceful = 1;
    demon.msleeping = 0;
    demon.mux = game.u.ux;
    demon.muy = game.u.uy;
    await demonSetup?.(demon);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => {
        messages.push(game._pending_message);
        input.feed(' ');
    };
    return {
        level, demon, messages,
        finish: () => {
            if (game._pending_message && game._pending_message !== messages.at(-1))
                messages.push(game._pending_message);
            return messages;
        },
    };
}

void test('a demon paid its demand vanishes laughing with the gold', async () => {
    const scene = await briber({ gold: 10000 });
    requirePlayingGame(game);
    initRng(5n);
    pushKeys(' 9000\n' + ' '.repeat(20));

    const paid = await talkToDemon(scene.demon, game);

    assert.equal(paid, true);
    assert.deepEqual(scene.finish().filter(message => /demand|give|vanishes|angry/.test(message ?? '')), [
        'A water demon demands 4500 zorkmids for safe passage.',
        'You give the water demon 9000 zorkmids.',
        'A water demon vanishes, laughing about cowardly mortals.',
    ]);
    assert.equal(heroGoldAmount(game), 1000);
    assert.equal(scene.level.monsters.includes(scene.demon), false);
});

void test('a near-demand offer wins a charming hero a scowling departure', async () => {
    const scene = await briber({ gold: 10000, hero: { acurr: { a: [12, 12, 12, 12, 12, 25] } } });
    requirePlayingGame(game);
    initRng(10n);
    pushKeys(' 4400\n' + ' '.repeat(20));

    const paid = await talkToDemon(scene.demon, game);

    assert.equal(paid, true);
    assert.deepEqual(scene.finish().filter(message => /demand|give|scowls|vanishes|angry/.test(message ?? '')), [
        'A water demon demands 4500 zorkmids for safe passage.',
        'You give the water demon 4400 zorkmids.',
        'A water demon scowls at you menacingly, then vanishes.',
    ]);
    assert.equal(heroGoldAmount(game), 5600);
    assert.equal(scene.level.monsters.includes(scene.demon), false);
});

void test('a hero offering more than the purse pays all the gold at once', async () => {
    const scene = await briber({ gold: 500 });
    requirePlayingGame(game);
    initRng(5n);
    pushKeys(' 9999\n' + ' '.repeat(20));

    const paid = await talkToDemon(scene.demon, game);

    assert.equal(paid, true);
    assert.deepEqual(scene.finish().filter(message => /demand|give|vanishes/.test(message ?? '')), [
        'A water demon demands 225 zorkmids for safe passage.',
        'You give the water demon all your gold.',
        'A water demon vanishes, laughing about cowardly mortals.',
    ]);
    assert.equal(heroGoldAmount(game), 0);
});

void test('a demon holding the Amulet sets a demand no purse can meet', async () => {
    const scene = await briber({
        gold: 10000,
        demonSetup: async demon => {
            await addObjectToMonsterInventory(demon, await knownObject(AMULET_OF_YENDOR));
        },
    });
    requirePlayingGame(game);
    initRng(5n);
    pushKeys(' 10000\n' + ' '.repeat(20));

    const paid = await talkToDemon(scene.demon, game);

    assert.equal(paid, false);
    const flow = scene.finish().join('\n');
    assert.match(flow, /A water demon demands 11015 zorkmids for safe passage\./);
    assert.match(flow, /You give the water demon all your gold\./);
    assert.match(flow, /A water demon gets angry\.\.\./);
    assert.equal(heroGoldAmount(game), 0, 'the angry Amulet bearer keeps the payment');
    assert.equal(scene.level.monsters.includes(scene.demon), true);
});

void test('a deaf hero cannot bargain and keeps a demanding demon angry', async () => {
    const scene = await briber({ gold: 10000, hero: { deafTurns: 20 } });
    requirePlayingGame(game);
    pushKeys(' '.repeat(20));

    const paid = await talkToDemon(scene.demon, game);

    assert.equal(paid, false);
    assert.deepEqual(scene.finish().filter(message => /demand|give|angry|offer/.test(message ?? '')), [
        'A water demon seems to be demanding something.',
        'A water demon gets angry...',
    ]);
    assert.equal(heroGoldAmount(game), 10000);
    assert.equal(!!scene.demon.mpeaceful, false);
});

void test('a demon at home in Gehennom demands a fifth more', async () => {
    const scene = await briber({ gold: 10000, hell: true });
    requirePlayingGame(game);
    initRng(5n);
    pushKeys(' \n' + ' '.repeat(20));

    await talkToDemon(scene.demon, game);

    assert.equal(scene.finish().find(message => /demands/.test(message ?? '')),
        'A water demon demands 6500 zorkmids for safe passage.');
});

void test('a demon of the hero\'s own alignment halves its demand', async () => {
    const scene = await briber({ gold: 10000, hero: { ualign: { type: -1, record: 0 } } });
    requirePlayingGame(game);
    initRng(5n);
    pushKeys(' \n' + ' '.repeat(20));

    await talkToDemon(scene.demon, game);

    assert.equal(scene.finish().find(message => /demands/.test(message ?? '')),
        'A water demon demands 2250 zorkmids for safe passage.');
});

void test('gold carried only inside a container backs no bribe', async () => {
    // C minion.c:demon_talk() prices the demand from money_cnt(gi.invent),
    // which sees only gold carried directly, never a container's contents.
    const scene = await briber({ gold: 100 });
    requirePlayingGame(game);
    const bag = await addInventoryObject(OBJECT_NAMES.indexOf('sack'));
    const bagged = await knownObject(GOLD_PIECE,
        { quantity: 5000, where: 'contained', container: bag });
    initRng(5n);
    pushKeys(' \n' + ' '.repeat(20));

    const paid = await talkToDemon(scene.demon, game);

    assert.equal(paid, false);
    assert.equal(scene.finish().find(message => /demands/.test(message ?? '')),
        'A water demon demands 45 zorkmids for safe passage.',
        'the demand is priced from the 100 loose coins, not the bagged 5000');
    assert.equal(!!scene.demon.mpeaceful, false, 'the shortfall only angers the demon');
    assert.equal(bagged.quantity, 5000);
    assert.equal(bagged.where, 'contained', 'the untouched hoard stays in its sack');
    assert.equal(heroGoldAmount(game), 100);
});
