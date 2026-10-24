import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { showFinalAttributes } from '../js/insight.js';
import { resetInputState } from '../js/input.js';
import { finishOrdinaryQuit } from '../js/end.js';
import { advanceHeroPetrification, startHeroPetrification } from '../js/stoning.js';
import { advanceHeroSickness, startHeroSickness } from '../js/hero_illness.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { ensureHeroSkills } from '../js/skills.js';
import { DAGGER, GOLD_PIECE, LONG_SWORD, LUCKSTONE } from '../js/object_data.js';
import { ENL_GAMEOVERDEAD, M_AP_OBJECT, P_BASIC, POOL, P_DAGGER, P_LONG_SWORD, P_TWO_WEAPON_COMBAT, P_UNSKILLED, SICK_NONVOMITABLE, } from '../js/const.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
// Page through end-of-game attribute disclosure for a hero who has died.
async function deadHeroAttributes() {
    const input = resetInputState();
    const report = showFinalAttributes({ final: ENL_GAMEOVERDEAD });
    const lines = [];
    try {
        for (let pages = 0;; pages++) {
            const blocked = await Promise.race([
                input.waitUntilBlocked().then(() => true), report.then(() => false),
            ]);
            if (!blocked)
                break;
            assert.ok(pages < 12, 'final attributes did not finish after twelve pages');
            lines.push(...requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trim()));
            input.feed(' ');
        }
    }
    finally {
        input.feed('\x1b');
        await report;
    }
    return lines;
}
void test('a hero killed by petrification turned into stone in the final status', async () => {
    freshGameplayRoom();
    assert.ok(startHeroPetrification({ turns: 1, killer: 'cockatrice' }));
    let lines = [];
    const result = await advanceHeroPetrification({
        die: async () => {
            lines = await deadHeroAttributes();
            return true;
        },
    });
    assert.ok(result.died);
    assert.ok(lines.includes('You turned into stone.'));
    assert.ok(!lines.some(line => line.includes('turning to stone')));
    assert.ok(lines.includes('You are dead.'));
});
void test('a hero killed by illness died from terminal illness', async () => {
    freshGameplayRoom();
    await startHeroSickness({ turns: 1, type: SICK_NONVOMITABLE, cause: 'rotten corpse', talk: false });
    let lines = [];
    await advanceHeroSickness({
        publish: async () => { },
        die: async () => {
            lines = await deadHeroAttributes();
            return true;
        },
    });
    assert.ok(lines.includes('You died from terminal illness.'));
    assert.ok(!lines.some(line => line.includes('terminally sick')));
});
void test('a quitting two-weapon fighter learns each skill limit and stone luck', async () => {
    freshGameplayRoom({ role: 'valkyrie', flags: { disclose: '-i +a -v -g -c -o' } });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const skills = ensureHeroSkills(game);
    if (!skills)
        throw new Error('The test needs initialized hero skills');
    for (const [skill, level] of [[P_LONG_SWORD, P_BASIC], [P_DAGGER, P_BASIC],
        [P_TWO_WEAPON_COMBAT, P_UNSKILLED]]) {
        const entry = skills[skill];
        if (!entry)
            throw new Error(`The test needs skill ${skill}`);
        entry.skill = level;
        entry.advance = 0;
    }
    await setPrimaryWeapon(await addInventoryObject(LONG_SWORD));
    await setSecondaryWeapon(await addInventoryObject(DAGGER));
    setTwoWeaponCombat(true);
    await addInventoryObject(LUCKSTONE, { blessed: true });
    game.u.uluck = 0;
    assert.equal(game.u.moreluck, 3);
    const screens = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            assert.ok(screens.length < 16, 'quitting did not finish disclosure');
            screens.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trim()).join('\n'));
            return 32;
        },
    };
    await finishOrdinaryQuit();
    const lines = screens.join('\n').split('\n');
    assert.ok(lines.includes('You were wielding two weapons at once.'));
    assert.ok(lines.includes('Your skill in long sword was limited by being unskilled with two weapons.'));
    assert.ok(lines.includes('Your skill in dagger was also limited by being unskilled with two weapons.'));
    assert.ok(!lines.some(line => line.includes('short sword')));
    assert.ok(lines.includes('You were lucky.'));
    assert.ok(lines.includes('Good luck did not time out for you.'));
    assert.ok(lines.includes('You survived.'));
});
void test('a dead eel concealed in water was hiding in the pool', async () => {
    freshRoomWithPolymorphedHero('giant eel').requireAt(game.u.ux, game.u.uy).typ = POOL;
    game.u.uundetected = 1;
    const lines = await deadHeroAttributes();
    assert.ok(lines.includes('You were hiding in the pool of water.'));
});
void test('a dead hero disguised as gold was mimicking a gold piece', async () => {
    freshRoomWithPolymorphedHero('jackal');
    game.u.m_ap_type = M_AP_OBJECT;
    game.u.mappearance = GOLD_PIECE;
    const lines = await deadHeroAttributes();
    assert.ok(lines.includes('You were mimicking a gold piece.'));
    assert.ok(!lines.includes('You were hiding.'));
});
void test('a dead handless hero was not wielding anything, contracted', async () => {
    freshRoomWithPolymorphedHero('jackal');
    game.uwep = null;
    const lines = await deadHeroAttributes();
    assert.ok(lines.includes("You weren't wielding anything."));
});
//# sourceMappingURL=final_attributes.test.js.map