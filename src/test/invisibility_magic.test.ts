import { objectTypeKnown } from '../js/o_init.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { P_EXPERT } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import {
    OBJECT_NAMES, POT_INVISIBILITY, POT_MONSTER_DETECTION, SPE_INVISIBILITY, WAN_MAKE_INVISIBLE,
} from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { vision_recalc } from '../js/vision.js';
import { wearHeroAccessory } from '../js/do_wear.js';
import { castSpell } from '../js/spell.js';
import { runExtendedCommand } from './support/commands.js';
import { learnSpell } from './support/spells.js';
import { dozap } from '../js/zap.js';
import {
    addInventoryObject, chargedWand, knownObject,
} from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshCasterRoom } from './support/hero-state.js';
import { setHeroSpecies } from '../js/polyself.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';

void test('drinking an invisibility potion makes the hero invisible', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const potion = await addInventoryObject(POT_INVISIBILITY, {
        initialize: false,
        invlet: 'a',
    });
    pushKeys('a');

    await rhack('q'.charCodeAt(0));

    assert.equal(game.u.invisible, true);
    assert.ok((game.u.invisibleTurns ?? 0) > 100);
    assert.equal(game.inventory.includes(potion), false);
});

// C potion.c peffect_invisibility(): the hero's square is redrawn before
// the cursed potion's second message makes the first one wait.
void test('a cursed invisibility potion hides the hero before its warning pages', async () => {
    await freshObjectRoom();
    requireFixtureGame(game);
    await addInventoryObject(POT_INVISIBILITY, { initialize: false, invlet: 'a', cursed: true });
    const heroCells: string[] = [];
    const input = resetInputState();
    input.display = {
        async readKey(): Promise<number> {
            const display = requireGameDisplay();
            const topline = display.grid[0]?.map(cell => cell.ch).join('') ?? '';
            if (topline.includes("can't see yourself"))
                heroCells.push(display.grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch ?? '');
            return ' '.charCodeAt(0);
        },
    };
    await flush_screen(1);
    assert.equal(requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '@');
    pushKeys('a');

    await rhack('q'.charCodeAt(0));

    assert.equal(heroCells.length, 1);
    assert.notEqual(heroCells[0], '@');
});

void test('the invisibility spell affects the hero without asking for a direction',
    async () => {
        await freshCasterRoom();
        requireFixtureGame(game);

        await learnSpell(SPE_INVISIBILITY, { skill: P_EXPERT });

        await castSpell(SPE_INVISIBILITY);

        assert.equal(game.u.invisible, true);
        assert.ok((game.u.invisibleTurns ?? 0) > 100);
        assert.equal(game.u.uen, 20);
        assert.equal(game.context.move, 1);
    });

void test('a make-invisible wand turns a visible monster transparent', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.seeInvisible = true;
    const monster = await createMonsterAt('jackal', 12, 10);
    const wand = await chargedWand(WAN_MAKE_INVISIBLE, { charges: 2 });
    game.inventory = [wand];
    pushKeys('al');

    await dozap();

    assert.equal(monster.minvis, 1);
    assert.equal(objectTypeKnown(wand), true);
    assert.equal(wand.spe, 1);
});

async function topline() {
    await flush_screen();
    return game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

// C zap.c:bhitm() WAN_MAKE_INVISIBLE chooses "turns transparent!" when
// display.h knowninvisible() holds: the monster is now minvis and the hero
// sees its square with See_invisible or Detect_monsters (a blessed potion of
// monster detection leaves the timed property, potion.c
// peffect_monster_detection), or has non-blind in-range telepathy whose
// intrinsic comes from the polymorphed form (HTelepat & ~INTRINSIC).
void test('monster detection says a zapped monster turns transparent', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const potion = await addInventoryObject(POT_MONSTER_DETECTION, {
        initialize: false, blessed: true,
    });
    const wand = await chargedWand(WAN_MAKE_INVISIBLE, { charges: 2, invlet: 'c', typeKnown: false });
    game.inventory = [potion, wand];
    await createMonsterAt('jackal', 12, 10);
    pushKeys(`${potion.invlet}`);

    await rhack('q'.charCodeAt(0));

    assert.ok((game.u.monsterDetectionTurns ?? 0) > 0);
    resetInputState();
    pushKeys('cl');

    await dozap();

    assert.equal(await topline(), 'The jackal turns transparent!');
    assert.equal(objectTypeKnown(wand), true);
});

// Without See_invisible, Detect_monsters, or in-range form telepathy, C keeps
// the wand's effect ambiguous with teleportation: "vanishes!", and the wand
// stays unknown (learn_it only accompanies "turns transparent!").
void test('an unsensing hero sees a zapped monster vanish', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const monster = await createMonsterAt('jackal', 12, 10);
    const wand = await chargedWand(WAN_MAKE_INVISIBLE, { charges: 2, typeKnown: false });
    game.inventory = [wand];
    pushKeys('al');

    await dozap();

    assert.equal(monster.minvis, 1);
    assert.equal(await topline(), 'The jackal vanishes!');
    assert.equal(objectTypeKnown(wand), false);
});

// knowninvisible() tests HTelepat & ~INTRINSIC: worn extrinsic telepathy
// (ETelepat: helm of telepathy, amulet of ESP) does not qualify, so a hero
// wearing an amulet of ESP still sees the monster vanish rather than turn
// transparent.
void test('a worn amulet of ESP still says the zapped monster vanishes', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const amulet = await addInventoryObject(OBJECT_NAMES.indexOf('amulet of ESP'), {
        initialize: false, invlet: 'b',
    });
    pushKeys(' ');
    await wearHeroAccessory(amulet, 'uamul');
    const wand = await chargedWand(WAN_MAKE_INVISIBLE, { charges: 2, invlet: 'c' });
    game.inventory = [amulet, wand];
    await createMonsterAt('jackal', 12, 10);
    pushKeys('cl');

    await dozap();

    assert.equal(await topline(), 'The jackal vanishes!');
});

// HTelepat & ~INTRINSIC includes the polymorphed form's telepathy
// (polyself.c PROPSET(TELEPAT, telepathic(mdat))). Mind flayers also
// perceive (M1_SEE_INVIS), so a lit square would take the See_invisible
// branch first; a dark target square keeps cansee() false and forces the
// telepathy branch. The form's M3_INFRAVISION still names the jackal.
void test('a polymorphed mind-flayer hero senses a dark monster turn transparent', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    setHeroSpecies(MONSTER_NAME.indexOf('mind flayer'), game);
    const level = game.level;
    if (!level) throw new Error('The gameplay room needs a level');
    for (let x = 8; x <= 18; x++)
        for (let y = 8; y <= 12; y++) level.requireAt(x, y).lit = false;
    await createMonsterAt('jackal', 12, 10);
    await vision_recalc(0);
    const wand = await chargedWand(WAN_MAKE_INVISIBLE, { charges: 2, typeKnown: false });
    game.inventory = [wand];
    pushKeys('al');

    await dozap();

    assert.equal(await topline(), 'The jackal turns transparent!');
    assert.equal(objectTypeKnown(wand), true);
});

// A #wizintrinsic telepathy timeout also lives in the intrinsic mask's
// TIMEOUT bits, which HTelepat & ~INTRINSIC keeps (timeout.c lists TELEPAT
// among the wizard-mode-only timed properties).
void test('a wizard-mode telepathy timeout says the zapped monster turns transparent', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    const input = resetInputState();
    const action = runExtendedCommand('wizintrinsic', '');
    let settled = false;
    void action.finally(() => { settled = true; });
    let selected = false;
    for (let step = 0; step < 40 && !settled; step++) {
        await Promise.race([input.waitUntilBlocked(), action]);
        if (settled) break;
        const text = requireGameDisplay().grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        const entry = selected ? null : text.match(/^\s*([a-zA-Z]) - telepathic/m);
        if (entry) {
            selected = true;
            input.feed(entry[1] ?? '');
        } else {
            input.feed(text.includes('--More--') ? ' ' : selected ? '\n' : ' ');
        }
    }
    await action;
    assert.ok((game.u.telepathyTurns ?? 0) > 0, 'the wizard menu grants timed telepathy');
    resetInputState();
    await createMonsterAt('jackal', 12, 10);
    const wand = await chargedWand(WAN_MAKE_INVISIBLE, { charges: 2, typeKnown: false });
    game.inventory = [wand];
    pushKeys('al');

    await dozap();

    assert.equal(await topline(), 'The jackal turns transparent!');
    assert.equal(objectTypeKnown(wand), true);
});
