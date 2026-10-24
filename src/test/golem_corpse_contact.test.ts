import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { putIntoContainer, takeFromContainer } from '../js/container.js';
import { clearMessageWindow } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BULLWHIP, CORPSE, SACK } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { polymonHero } from '../js/polyself.js';
import { initRng } from '../js/rng.js';
import { feelPetrifyingCorpse, selfTouchPetrifyingWeapons } from '../js/stoning.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

const cockatrice = MONSTER_NAME.indexOf('cockatrice');
const stoneGolem = MONSTER_NAME.indexOf('stone golem');

async function golemContactRoom(form = 'flesh golem') {
    freshObjectRoom({
        role: 'archeologist',
        flags: { verbose: false },
        hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } },
    });
    await polymonHero(MONSTER_NAME.indexOf(form));
    clearMessageWindow();
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /golem|corpse|bullwhip/, limit: 12 });
    return { input, messages };
}

for (const form of ['flesh golem', 'iron golem']) {
    void test(`the ${form} picks up a cockatrice corpse after acknowledging its stone form`, async () => {
        const { input, messages } = await golemContactRoom(form);
        const corpse = await floorObject(CORPSE, 10, 10, { corpsenm: cockatrice });
        let acknowledgedStoneForm = false;
        input.beforeRead = () => {
            messages.push(game._pending_message);
            if (game._pending_message.includes('You turn into a stone golem!')) {
                assert.equal(game.u.umonnum, stoneGolem);
                assert.equal(corpse.where, 'floor', 'the conversion pauses before lifting the corpse');
                acknowledgedStoneForm = true;
            }
        };

        await rhack(','.charCodeAt(0));

        assert.doesNotMatch([...messages, game._pending_message].join('\n'), /fatal mistake|You turn to stone/);
        assert.ok(acknowledgedStoneForm, 'pickup must acknowledge the successful conversion');
        assert.equal(game.u.umonnum, stoneGolem);
        assert.ok(!game.program_state.gameover);
        assert.ok(game.inventory.includes(corpse));
        assert.equal(corpse.where, 'inventory');
    });

    void test(`the ${form} snatches a cockatrice corpse with a bullwhip without a fatal warning`, async () => {
        const { messages } = await golemContactRoom(form);
        const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
        game.uwep = game.u.uwep = whip;
        const corpse = await knownObject(CORPSE, { corpsenm: cockatrice });
        const opponent = await createMonsterAt('stone golem', 11, 10);
        await equipMonsterObject(opponent, corpse, W_WEP);
        initRng(7102n);

        await applyInventoryObject(whip, 'l');

        const prose = [...messages, game._pending_message].join('\n');
        assert.match(prose, /You snatch .*cockatrice corpse![\s\S]*You turn into a stone golem!/);
        assert.doesNotMatch(prose, /fatal mistake|You turn to stone/);
        assert.equal(game.u.umonnum, stoneGolem);
        assert.ok(!game.program_state.gameover);
        assert.equal(opponent.mw, null);
        assert.ok(!opponent.minvent.includes(corpse));
        assert.ok(game.inventory.includes(corpse));
        assert.equal(corpse.where, 'inventory');
    });
}

void test('a flesh golem stashes a cockatrice corpse after becoming stone without a fatal warning', async () => {
    const { messages } = await golemContactRoom();
    const corpse = await addInventoryObject(CORPSE, { corpsenm: cockatrice });
    const sack = await addInventoryObject(SACK);

    const result = await putIntoContainer(sack, corpse);

    assert.doesNotMatch([...messages, game._pending_message].join('\n'), /fatal mistake/);
    assert.equal(game.u.umonnum, stoneGolem);
    assert.ok(result.moved);
    assert.equal(corpse.where, 'contained');
    assert.ok(sack.contents?.includes(corpse));
});

void test('a flesh golem removes a cockatrice corpse from a container without a fatal warning', async () => {
    const { messages } = await golemContactRoom();
    const sack = await addInventoryObject(SACK);
    const corpse = await knownObject(CORPSE, { corpsenm: cockatrice });
    await addCreatedObjectToContainer(sack, corpse);

    const result = await takeFromContainer(sack, corpse);

    assert.doesNotMatch([...messages, game._pending_message].join('\n'), /fatal mistake/);
    assert.equal(game.u.umonnum, stoneGolem);
    assert.ok(result.moved);
    assert.equal(corpse.where, 'inventory');
    assert.ok(game.inventory.includes(corpse));
});

void test('feeling a corpse announces bare-handed contact before a flesh golem becomes stone', async () => {
    const { input, messages } = await golemContactRoom();
    const corpse = await floorObject(CORPSE, 10, 10, { corpsenm: cockatrice });
    input.beforeRead = () => {
        messages.push(game._pending_message);
        if (game._pending_message.startsWith('You touched '))
            assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('flesh golem'));
    };

    await feelPetrifyingCorpse(corpse, { forceTouch: true });

    const prose = [...messages, game._pending_message].join('\n');
    assert.match(prose, /You touched the cockatrice corpse with your bare claws\.[\s\S]*You turn into a stone golem!/);
    assert.doesNotMatch(prose, /fatal mistake/);
    assert.equal(game.u.umonnum, stoneGolem);
    assert.equal(corpse.where, 'floor');
});

void test('self-touch announces the wielded corpse before a flesh golem becomes stone', async () => {
    const { input, messages } = await golemContactRoom();
    const corpse = await addInventoryObject(CORPSE, { corpsenm: cockatrice, owornmask: W_WEP });
    game.uwep = game.u.uwep = corpse;
    input.beforeRead = () => {
        messages.push(game._pending_message);
        if (game._pending_message.startsWith('Falling, you touch '))
            assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('flesh golem'));
    };

    await selfTouchPetrifyingWeapons({ messageStart: 'Falling, you' });

    const prose = [...messages, game._pending_message].join('\n');
    assert.match(prose, /Falling, you touch the cockatrice corpse\.[\s\S]*You turn into a stone golem!/);
    assert.doesNotMatch(prose, /fatal mistake/);
    assert.equal(game.u.umonnum, stoneGolem);
    assert.equal(game.uwep, corpse, 'stone resistance lets the hero keep wielding the corpse');
});
