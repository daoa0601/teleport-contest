import assert from 'node:assert/strict';
import { def_warnsyms, WARNCOUNT } from '../js/const.js';
import { GlyphOffset } from '../js/glyph_numbers.js';
import { glyphAt } from '../js/display.js';
import { vision_recalc } from '../js/vision.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB, DAGGER } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
for (const form of ['black pudding', 'brown pudding']) {
    for (const metal of [false, true]) {
        void test(`a ${form} hero ${metal ? 'divides when cut by iron' : 'does not divide when hit by wood'}`, async () => {
            freshRoomWithPolymorphedHero(form, { polymorph: { hitPoints: 60 }, hero: { uac: 10 } });
            requirePlayingGame(game);
            const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
            goblin.mux = game.u.ux;
            goblin.muy = game.u.uy;
            await equipMonsterObject(goblin, await knownObject(metal ? DAGGER : CLUB), W_WEP);
            const input = resetInputState();
            const messages = [];
            input.beforeRead = () => { messages.push(game._pending_message); };
            installPagerInput(input, { expected: /goblin|divide|pudding|weapon/, limit: 12 });
            await performMonsterHeroAttack(goblin, game, {
                random: range => range - 1, rollOne: () => 1, rollDice: count => count,
            });
            const clone = game.level.monsters.find(monster => monster !== goblin && monster.mnum === game.u.umonnum);
            assert.equal(!!clone, metal);
            if (clone) {
                assert.ok(clone.mtame);
                assert.equal(clone.mhpmax, 60, 'Weapon division preserves the original maximum HP in both bodies');
                assert.equal(game.u.mhmax, 60);
                assert.ok(Math.abs(clone.mhp - game.u.mh) <= 1);
                assert.ok(clone.mhp + game.u.mh < 60, 'The weapon hurts before the remaining HP is divided');
                assert.match([...messages, game._pending_message].join('\n'), /You divide as the goblin hits you!/);
            }
        });
    }
}
void test('a blind warned hero keeps makemon\'s warning digit on the divided clone\'s square', async () => {
    freshRoomWithPolymorphedHero('black pudding', { polymorph: { hitPoints: 60 }, hero: { uac: 10 } });
    requirePlayingGame(game);
    grantIntrinsicProperty('warning', 'outside');
    // The eyeless pudding form blinds; refresh the vision arrays as the
    // moveloop would before the monster's attack (C set_uasmon flow).
    vision_recalc(0);
    const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    goblin.mux = game.u.ux;
    goblin.muy = game.u.uy;
    await equipMonsterObject(goblin, await knownObject(DAGGER), W_WEP);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /goblin|divide/, limit: 12 });
    await performMonsterHeroAttack(goblin, game, {
        random: range => range - 1, rollOne: () => 1, rollDice: count => count,
    });
    const clone = game.level.monsters.find(monster => monster !== goblin && monster.mnum === game.u.umonnum);
    assert.ok(clone, 'the iron cut divides the pudding hero');
    assert.match([...messages, game._pending_message].join('\n'), /It hits!  You divide as it hits you!/);
    // C cloneu() tames the clone without redrawing its square, so the map
    // keeps the warning digit makemon()'s newsym() drew for the still-hostile
    // newborn (mhitu.c:cloneu, makemon.c:makemon, display.h:_mon_warning).
    const glyph = glyphAt(clone.mx, clone.my, game);
    assert.equal(glyph?.kind, 'warning', 'the clone\'s square keeps a warning digit');
    const level = (glyph?.glyph ?? -1) - GlyphOffset.warning;
    const symbol = level >= 0 && level < WARNCOUNT ? def_warnsyms[level] : undefined;
    assert.ok(symbol, `warning digit level ${level}`);
    assert.equal(symbol.ch, '2', 'the digit comes from the newborn makemon level');
});
//# sourceMappingURL=monster_hero_pudding.test.js.map