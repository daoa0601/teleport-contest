import test from 'node:test';
import assert from 'node:assert/strict';

import { LANDMINE, MM_ANGRY, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { BOULDER, CORPSE, WORM_TOOTH } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { launchRollingBoulder } from '../js/rolling_boulder.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { assertWormBody } from './support/worms.js';

for (const sleeping of [false, true]) {
    void test(`a ${sleeping ? 'sleeping' : 'awake'} hero observes a newly seen boulder launch`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const boulder = await floorObject(BOULDER, 12, 10, { dknown: false, oname: 'Moon' });
        if (sleeping) putHeroToSleep(10);
        const messages: string[] = [];

        await launchRollingBoulder({ x: 12, y: 10 }, { x: 14, y: 10 }, {
            state: game, unseen: true,
            publish: async message => { messages.push(message); },
        });

        assert.equal(boulder.dknown, true, 'seeing the launch reveals the boulder appearance');
        assert.equal(messages[0], `${sleeping ? 'You dream that you see' : 'You see'} a boulder named Moon start to roll.`);
    });
}

for (const hit of [false, true]) {
    void test(`a named rolling boulder retains its name when it ${hit ? 'hits' : 'misses'}`, async () => {
        freshObjectRoom({ flags: { verbose: true } });
        requirePlayingGame(game);
        const wolf = await createMonsterAt('wolf', 13, 10, NO_MINVENT);
        wolf.mhp = wolf.mhpmax = 100;
        await floorObject(BOULDER, 12, 10, { oname: 'Moon' });
        const messages: string[] = [];

        await launchRollingBoulder({ x: 12, y: 10 }, { x: 14, y: 10 }, {
            state: game, publish: async message => { messages.push(message); },
            rollOne: sides => hit || sides !== 20 ? 1 : 20,
        });

        assert.equal(messages[0], `The boulder named Moon ${hit ? 'hits' : 'misses'} the wolf.`);
    });
}

void test('hallucination changes the pronoun for a monster that a boulder passes through', async () => {
    const pronouns = new Set<string>();
    for (let seed = 1n; seed <= 24n; seed++) {
        freshObjectRoom({ flags: { verbose: false }, hero: { hallucinationTurns: 100 } });
        requirePlayingGame(game);
        const xorn = await createMonsterAt('xorn', 13, 10, NO_MINVENT);
        const hp = xorn.mhp;
        await floorObject(BOULDER, 12, 10);
        const messages: string[] = [];
        initRng(seed);

        await launchRollingBoulder({ x: 12, y: 10 }, { x: 14, y: 10 }, {
            state: game, publish: async message => { messages.push(message); },
            rollOne: () => 1, rollDice: () => 2,
        });

        assert.equal(xorn.mhp, hp, `rocks pass harmlessly through a xorn, seed ${seed}`);
        const message = messages[0];
        assert.ok(message, `the visible hit needs feedback, seed ${seed}`);
        const match = /^The boulder hits it but passes harmlessly through (him|her|it|them)\.$/.exec(message);
        assert.ok(match, `unexpected hit feedback, seed ${seed}: ${message}`);
        const pronoun = match[1];
        assert.ok(pronoun);
        pronouns.add(pronoun);
    }
    assert.equal(pronouns.size, 4, 'hallucination can select every native object pronoun');
});

for (const monsterTurn of [false, true]) {
    for (const visible of [false, true]) {
        void test(`landmine debris ${visible ? 'announces a visible death' : 'silently kills an unseen monster'} during ${monsterTurn ? 'a monster' : 'the hero'} turn`, async () => {
            const level = freshObjectRoom({ context: { mon_moving: monsterTurn } });
            requirePlayingGame(game);
            const wolf = await createMonsterAt('wolf', 14, 10, NO_MINVENT);
            wolf.mhp = 1;
            if (!visible) {
                for (let x = 14; x <= 16; x++) for (let y = 6; y <= 14; y++) level.requireAt(x, y).lit = false;
                vision_recalc(0);
            }
            addTrap(level, LANDMINE, 13, 10);
            await floorObject(BOULDER, 12, 10);
            const messages: string[] = [];

            await launchRollingBoulder({ x: 12, y: 10 }, { x: 15, y: 10 }, {
                state: game, publish: async message => { messages.push(message); },
                random: limit => limit === 8 ? 4 : limit === 60 ? 0 : limit - 1,
                rollOne: sides => sides === 20 ? 1 : sides,
            });

            assert.equal(level.monsters.includes(wolf), false, 'flying rocks kill the wolf');
            assert.equal(messages.includes('The wolf is killed!'), visible);
            assert.equal(game.u.uconduct?.killer ?? 0, monsterTurn ? 0 : 1,
                'debris uses the current turn for kill credit, even from an unknown boulder trap');
        });
    }
}

void test('killing a worm through its tail leaves random treasure at its head', async () => {
    let treasureDrops = 0;
    for (let seed = 1n; seed <= 32n; seed++) {
        const level = freshObjectRoom({ right: 22 });
        requirePlayingGame(game);
        const worm = await createMonsterAt('long worm', 16, 10, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
        initializeMonsterWormBody(worm, { segmentCount: 1 });
        assertWormBody(worm);
        const tail = worm.wormSegments[0];
        assert.ok(tail, 'the test needs a tail to hit');
        const head = { x: worm.mx, y: worm.my };
        const start = { x: tail.x + tail.x - head.x, y: tail.y + tail.y - head.y };
        worm.mhp = 1;
        await floorObject(BOULDER, start.x, start.y);
        initRng(seed);

        await launchRollingBoulder(start, tail, {
            state: game, known: true, publish: async () => {},
            rollOne: () => 1, rollDice: () => 2,
        });

        assert.equal(level.monsters.includes(worm), false, `the tail hit kills the worm, seed ${seed}`);
        assert.equal(game.u.uconduct?.killer, 1);
        const isTreasure = (object: { otyp: number }) => ![BOULDER, CORPSE, WORM_TOOTH].includes(object.otyp);
        assert.equal(floorObjectsAt(level, tail.x, tail.y).some(isTreasure), false,
            `random treasure belongs at the head, seed ${seed}`);
        treasureDrops += floorObjectsAt(level, head.x, head.y).filter(isTreasure).length;
    }
    assert.ok(treasureDrops > 0, 'the kills must include a random treasure drop');
});
