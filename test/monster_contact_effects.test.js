import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function contactAttacker(species) {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const monster = await createMonsterAt(species, 11, 10, NO_MINVENT);
    monster.mpeaceful = 0;
    monster.m_lev = 20;
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return monster;
}
for (const species of ['werejackal', 'homunculus', 'genetic engineer']) {
    void test(`a cancelled ${species} still inflicts its ordinary contact damage`, async () => {
        const monster = await contactAttacker(species);
        requirePlayingGame(game);
        monster.mcan = 1;
        await performMonsterHeroAttack(monster, game, { rollOne: () => 1, rollDice: () => 3 });
        assert.equal(game.u.uhp, 97);
        assert.equal(game.u.ulycn, -1);
        assert.equal(game._helplessTurns ?? 0, 0);
    });
}
void test('a werejackal bite infects the hero and still deals physical damage', async () => {
    const monster = await contactAttacker('werejackal');
    requirePlayingGame(game);
    await performMonsterHeroAttack(monster, game, {
        random: limit => limit === 10 ? 9 : limit === 30 ? 1 : 0,
        rollOne: () => 1, rollDice: () => 3,
    });
    assert.equal(game.u.ulycn, monster.mnum);
    assert.equal(game.u.uhp, 97);
});
for (const resistant of [false, true]) {
    void test(`a homunculus bite ${resistant ? 'does not put a sleep-resistant hero to sleep' : 'puts the hero to sleep'} and still hurts`, async () => {
        const monster = await contactAttacker('homunculus');
        requirePlayingGame(game);
        game.u.sleepResistance = resistant;
        await performMonsterHeroAttack(monster, game, {
            random: limit => limit === 10 ? 9 : 0,
            rollOne: sides => sides === 10 ? 4 : 1, rollDice: () => 3,
        });
        assert.equal(game.u.uhp, 97);
        assert.equal(game._helplessTurns ?? 0, resistant ? 0 : 4);
        assert.equal(!!game.u.usleep, !resistant);
    });
}
void test('magic resistance prevents a genetic engineer from changing the hero', async () => {
    const monster = await contactAttacker('genetic engineer');
    requirePlayingGame(game);
    game.u.antimagic = true;
    const species = game.u.umonnum;
    await performMonsterHeroAttack(monster, game, {
        random: () => 9, rollOne: () => 1, rollDice: () => 3,
    });
    assert.equal(game.u.umonnum, species);
    assert.equal(game.u.uhp, 100, 'mon_poly returns before the ordinary damage tail');
});
//# sourceMappingURL=monster_contact_effects.test.js.map