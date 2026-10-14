import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/score_records.js';
import { memoryStorage } from './support/memory-storage.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const { lifeSaved, longName, description } of [
    { lifeSaved: false, longName: false, description: "shares a short hit message's pager" },
    { lifeSaved: true, longName: false, description: "shares a short hit message's pager before life saving" },
    { lifeSaved: true, longName: true, description: 'acknowledges a long hit before life saving zeros HP' },
]) {
    void test(`contact petrification ${description}`, async () => {
        freshObjectRoom({
            flags: { verbose: true, bones: false, tombstone: false, disclose: '-i -a -v -c -o' },
            hero: { uhitinc: 100, uhp: 40, uhpmax: 40 },
        });
        game.storage = memoryStorage();
        game.iflags.toptenwin = false;
        const bird = await createMonsterAt('cockatrice', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        bird.mhp = bird.mhpmax = 2000;
        bird.mpeaceful = false;
        bird.msleeping = 0;
        if (longName)
            setMonsterGivenName(bird, 'Bird With A Very Long And Elaborate Given Name');
        const amulet = lifeSaved ? await addInventoryObject(AMULET_OF_LIFE_SAVING) : null;
        if (amulet)
            await wearHeroAccessory(amulet, 'uamul');
        const messages = [];
        const healthAtPager = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /cockatrice|Given Name|stone|But wait|medallion|feel much better|Goodbye|points|survived|turns/, limit: 12 });
        const pager = input.display;
        assert.ok(pager);
        input.display = {
            async readKey() {
                messages.push(game._pending_message);
                healthAtPager.push(game.u.uhp);
                return pager.readKey();
            },
        };
        initRng(41n);
        await rhack('l'.charCodeAt(0));
        if (longName) {
            assert.match(messages[0] ?? '', /You hit .*Given Name\./);
            assert.doesNotMatch(messages[0] ?? '', /turn to stone/, 'A hit too long to share its line must be acknowledged before the petrification announcement');
            assert.equal(healthAtPager[0], 40, 'Life saving commits zero HP after the petrification announcement, not while the hit is paged');
        }
        else {
            assert.match(messages[0] ?? '', /You hit the cockatrice\.  You turn to stone\.\.\./, 'The first acknowledgement must include both the short hit and the petrification announcement');
        }
        assert.equal(!!game.program_state.gameover, !lifeSaved);
        assert.equal(game.u.umortality, 1);
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.ok((game.u.uhp ?? 0) > 0, 'Life saving restores the petrified hero');
            assert.equal(game.context.move, 1);
        }
    });
}
void test('barehand contact petrification identifies the real invisible named creature', async () => {
    freshObjectRoom({
        flags: { verbose: true, bones: false, tombstone: false, disclose: '-i -a -v -c -o' },
        hero: { uhitinc: 100, uhp: 40, uhpmax: 40, urexp: 100, seeInvisible: true },
    });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const bird = await createMonsterAt('cockatrice', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    setMonsterGivenName(bird, 'Birdie');
    bird.mhp = bird.mhpmax = 2000;
    bird.mpeaceful = false;
    bird.msleeping = 0;
    bird.minvis = 1;
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /Birdie|cockatrice|stone|Goodbye|points|survived|turns/, limit: 12 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    pushKey('l');
    initRng(41n);
    await rhack('F'.charCodeAt(0));
    messages.push(game._pending_message);
    assert.equal(game.program_state.gameover, true);
    assert.match(messages.join('\n'), /You turn to stone/);
    assert.doesNotMatch(messages.join('\n'), /You die/);
    assert.equal(loadScoreRecords()[0]?.death, 'petrified by an invisible cockatrice called Birdie');
});
for (const command of ['movement', 'fight']) {
    void test(`${command} contact identifies a life-saving amulet after acknowledging the named bird's petrification`, async () => {
        freshObjectRoom({
            flags: { verbose: true },
            hero: { uhitinc: 100, uhp: 40, uhpmax: 40 },
        });
        const bird = await createMonsterAt('cockatrice', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        setMonsterGivenName(bird, 'Bird With An Impressive Name');
        bird.mhp = bird.mhpmax = 2000;
        bird.mpeaceful = false;
        bird.msleeping = 0;
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, { known: false, typeKnown: false });
        await wearHeroAccessory(amulet, 'uamul');
        assert.equal(!!game._knownObjectTypes?.has(AMULET_OF_LIFE_SAVING), false);
        const pages = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /Impressive Name|stone|But wait|medallion|feel much better/, limit: 8 });
        const pager = input.display;
        assert.ok(pager);
        input.display = {
            async readKey() {
                pages.push({
                    message: game._pending_message,
                    amuletKnown: !!game._knownObjectTypes?.has(AMULET_OF_LIFE_SAVING),
                    hp: game.u.uhp,
                });
                return pager.readKey();
            },
        };
        if (command === 'fight')
            pushKey('l');
        initRng(41n);
        await rhack((command === 'fight' ? 'F' : 'l').charCodeAt(0));
        const petrificationPage = pages[0];
        assert.ok(petrificationPage);
        assert.match(petrificationPage.message, /You hit .*Impressive Name\.  You turn to stone\.\.\./);
        assert.doesNotMatch(petrificationPage.message, /But wait/, 'But wait must await this page before it appears');
        assert.equal(petrificationPage.hp, 0, 'done() zeros HP before But wait pages the death announcement');
        assert.equal(petrificationPage.amuletKnown, false, 'The hero has not discovered life saving while But wait awaits the death acknowledgement');
        const glowPage = pages.find(page => page.message.includes('Your medallion begins to glow!'));
        assert.ok(glowPage, 'The medallion glow must be shown after acknowledging petrification');
        assert.equal(glowPage.amuletKnown, true, 'The medallion glow reveals the amulet type');
        assert.equal(amulet.where, 'gone');
        assert.ok((game.u.uhp ?? 0) > 0);
        assert.equal(game.u.umortality, 1);
    });
}
//# sourceMappingURL=hero_melee_petrification_death.test.js.map