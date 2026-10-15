import assert from 'node:assert/strict';
import test from 'node:test';
import { POOL, TELEP_TRAP, P_ESCAPE_SPELL, P_EXPERT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { pushKeys } from '../js/input.js';
import { SPE_TELEPORT_AWAY } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { forceLearnSpell } from '../js/spell.js';
import { ensureHeroSkills } from '../js/skills.js';
import { teleportHeroAtWill } from '../js/teleport.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a drowning hero uses a known teleport trap without at-will power or hunger costs', async () => {
    const level = freshObjectRoom({ hero: { ulevel: 1, uen: 0, uhunger: 900 } });
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) level.requireAt(x, y).typ = POOL;
    }
    grantIntrinsicProperty('teleportation', 'outside');
    grantIntrinsicProperty('teleportControl', 'outside');
    addTrap(level, TELEP_TRAP, 10, 10, { tseen: true, teledest: { x: 15, y: 10 } });
    const messages: string[] = [];

    const result = await heroLiquidEffects({
        publish: async message => { messages.push(message); },
        die: async () => assert.fail('the known teleport trap must rescue the hero'),
    });

    assert.equal(result?.moved, true);
    assert.equal(game.u.ux, 15);
    assert.equal(game.u.uy, 10);
    assert.equal(game.u.uen, 0);
    assert.equal(game.u.uhunger, 900);
    assert.ok(messages.includes('You jump onto the teleportation trap.'));
});

void test('teleport at will can use a learned spell without intrinsic teleportation', async () => {
    freshObjectRoom({ role: 'wizard', flags: { tips: false, verbose: false },
        hero: { ulevel: 30, uen: 50, uenmax: 50, uhunger: 900,
            acurr: { a: [18, 25, 18, 18, 18, 18] } } });
    grantIntrinsicProperty('teleportControl', 'outside');
    forceLearnSpell(SPE_TELEPORT_AWAY);
    const skill = ensureHeroSkills(game)?.[P_ESCAPE_SPELL];
    assert.ok(skill);
    skill.skill = skill.maxSkill = P_EXPERT;
    pushKeys('ll.' + ' '.repeat(10));

    const result = await teleportHeroAtWill();

    assert.equal(result.moved, true);
    assert.equal(result.spentTime, true);
    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uen, 20);
    assert.equal(game.u.uhunger, 900, 'a high-intelligence Wizard pays only the spell nutrition cost');
});

void test('the Amulet can disorient an at-will teleport after power is spent', async () => {
    freshObjectRoom({ hero: { ulevel: 12, uen: 50, uhunger: 900, uhave: { amulet: true } } });
    grantIntrinsicProperty('teleportation', 'outside');
    grantIntrinsicProperty('teleportControl', 'outside');
    const messages: string[] = [];

    const result = await teleportHeroAtWill({
        random: () => 0,
        chooseDestination: async () => ({ x: 15, y: 10 }),
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.moved, false);
    assert.equal(result.spentTime, true);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uen, 20);
    assert.equal(game.u.uhunger, 800);
    assert.ok(messages.includes('You feel disoriented for a moment.'));
});

for (const failure of ['energy', 'stunned spell']) {
    void test(`an escape teleport refused for ${failure} leaves the enclosing action time intact`, async () => {
        freshObjectRoom({ hero: { ulevel: 12, uen: failure === 'energy' ? 0 : 50 } });
        grantIntrinsicProperty('teleportation', 'outside');
        if (failure === 'stunned spell') {
            game.u.ulevel = 1;
            game.u.stunned = true;
            forceLearnSpell(SPE_TELEPORT_AWAY);
        }
        game.context.move = 1;

        const result = await teleportHeroAtWill({ publish: async () => {} });

        assert.equal(result.spentTime, false);
        assert.equal(game.context.move, 1);
    });
}
