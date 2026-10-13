import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CON, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { AD_SSEX, AT_BITE } from '../js/monster_attack_types.js';
import type { HeroContactAttack } from '../js/monster_action_types.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import { initRng } from '../js/rng.js';
import { nearCapacity } from '../js/weight.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

for (const improving of [false, true]) {
    void test(`seduction ${improving ? 'gains' : 'loses'} constitution before exercising it at the load-change pager`, async () => {
        const level = freshObjectRoom({ flags: { female: true },
            hero: { acurr: { a: [12, 12, 12, 12, 3, 12] } } });
        requirePlayingGame(game);
        level.flags.noteleport = true;
        game._moveloopStarted = true;
        // 436 weight lies between the Con 3 and Con 4 carrying limits.
        setHeroGoldAmount(game, 43600);
        game.u.acurr.a[A_CON] = improving ? 3 : 4;
        const originalConstitution = game.u.acurr.a[A_CON];
        game._encumbranceLevel = improving ? 1 : 0;
        const incubus = await createMonsterAt('amorous demon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        incubus.female = false;
        incubus.mtame = 10;
        const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_BITE,
            damageType: AD_SSEX, hit: true, damage: 0 };
        const input = resetInputState();
        const messages: string[] = [];
        initRng(6n);
        await plineWithContinuation('You pause while catching your breath after the encounter.');
        const operation = resolveMonsterContactEffect(incubus, attack, { state: game,
            publish: async message => { messages.push(message); },
            random: range => range === 35 ? (improving ? 0 : 34) : 1,
            rollOne: () => 4 });
        const observed = operation.then(() => 'completed' as const);

        const boundary = await Promise.race([
            observed, input.waitUntilBlocked().then(() => 'input' as const),
        ]);
        assert.equal(boundary, 'input', 'The load-change message must wait for acknowledgement');
        assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /--More--/);
        const exerciseAtPager = game.u._exercise?.[A_CON];
        input.feed(' ');
        await observed;

        assert.equal(exerciseAtPager, 0, 'Constitution exercise begins after the load-change pager');
        assert.equal(game.u.acurr.a[A_CON], originalConstitution + (improving ? 1 : -1));
        assert.equal(nearCapacity(game), improving ? 0 : 1);
        assert.equal(game.u._exercise?.[A_CON], improving ? 1 : -1);
        assert.equal(messages.includes(improving ? 'You feel good enough to do it again.' : 'You are down in the dumps.'), true);
    });
}

