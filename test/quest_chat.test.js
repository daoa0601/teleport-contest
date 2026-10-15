import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ensureQuestStatus, registerQuestLeader } from '../js/quest.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
import { artifactObject } from './support/game-objects.js';
import { floorArtifact } from './support/game-objects.js';
import { rhack } from '../js/cmd.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { STRAT_CLOSE } from '../js/const.js';
import { AD_PHYS } from '../js/monster_attack_types.js';
import { runMonsterAction } from '../js/monmove.js';
import { requirePlayingGame } from '../js/gstate.js';
import { moveloop_core } from '../js/allmain.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
import { MAGIC_PORTAL } from '../js/const.js';
async function questLeader(level = 14, record = 20) {
    freshObjectRoom({ role: 'healer', hero: { ulevel: level, ualign: { type: 0, record }, ualignbase: [0, 0] } });
    game.dungeons = [createDungeon({ dname: 'The Quest' })];
    game.u.uz = { dnum: 0, dlevel: 1 };
    game._activeSpecialLevel = { prototype: 'Hea-strt', file: 'Hea-strt.lua' };
    const leader = await createMonsterAt('Hippocrates', 11, 10);
    registerQuestLeader(leader);
    leader.msleeping = 0;
    const pages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
        input.feed(' ');
    };
    return { leader, pages };
}
void test('a returning worthy hero can receive the quest after an earlier rejection', async () => {
    await questLeader();
    const status = ensureQuestStatus();
    status.met_leader = true;
    status.not_ready = 1;
    await runExtendedCommand('chat', 'l');
    assert.equal(status.got_quest, true);
    assert.equal(game.context.move, 1);
});
void test('the leader rejects an inexperienced hero and schedules expulsion', async () => {
    const { pages } = await questLeader(13);
    await runExtendedCommand('chat', 'l');
    assert.equal(ensureQuestStatus().got_quest, false);
    assert.equal(game._questExpulsionPending?.seal, false);
    assert.match(pages.join('\n'), /inexperienced/);
    assert.equal(ensureQuestStatus().not_ready, 0);
});
void test('returning the recovered quest artifact completes the quest and identifies it', async () => {
    await questLeader();
    const artifact = await artifactObject('The Staff of Aesculapius', { known: false, dknown: false, bknown: false });
    artifact.where = 'inventory';
    game.inventory.push(artifact);
    game.u.uhave = { questart: true };
    ensureQuestStatus().met_nemesis = true;
    await runExtendedCommand('chat', 'l');
    assert.equal(game.u.uevent?.qcompleted, 1);
    assert.equal(ensureQuestStatus().got_thanks, true);
    assert.equal(artifact.known, true);
    assert.equal(artifact.bknown, true);
});
void test('conversion earns banishment and angers the quest leader', async () => {
    const { leader } = await questLeader();
    game.u.ualignbase = [1, 0];
    await runExtendedCommand('chat', 'l');
    assert.equal(ensureQuestStatus().pissed_off, true);
    assert.equal(leader.mpeaceful, 0);
    assert.equal(game._questExpulsionPending?.seal, false);
});
void test('chatting with the nemesis provokes a threat and records the meeting', async () => {
    freshObjectRoom({ role: 'healer' });
    const nemesis = await createMonsterAt('Cyclops', 11, 10);
    nemesis.msleeping = 0;
    await runExtendedCommand('chat', 'l');
    assert.equal(ensureQuestStatus().met_nemesis, true);
    assert.match(game._pending_message, /^".+"$/);
    assert.equal(game.context.move, 1);
});
void test('a quest guardian discusses the aftermath when the artifact has been recovered', async () => {
    freshObjectRoom({ role: 'healer', hero: { uhave: { questart: 1 } } });
    const guardian = await createMonsterAt('attendant', 11, 10);
    guardian.msleeping = 0;
    ensureQuestStatus().killed_nemesis = true;
    await runExtendedCommand('chat', 'l');
    assert.match(game._pending_message, /^".+"$/);
    assert.equal(game.context.move, 1);
});
void test('picking up the quest artifact while blind describes it and records the touch', async () => {
    freshObjectRoom({ role: 'healer', hero: { blind: true } });
    const artifact = await floorArtifact('The Staff of Aesculapius', 10, 10, { dknown: false });
    const input = resetInputState();
    input.display = { async readKey() { return 32; } };
    await rhack(','.charCodeAt(0));
    assert.ok(game.inventory.includes(artifact));
    assert.equal(ensureQuestStatus().touched_artifact, true);
    assert.equal(artifact.dknown, true);
});
void test('a dying Archeologist nemesis leaves the noxious cloud described by the quest text', async () => {
    freshObjectRoom({ role: 'archeologist' });
    const nemesis = await createMonsterAt('Minion of Huhetotl', 11, 10);
    const input = resetInputState();
    input.display = { async readKey() { return 32; } };
    await finishMonsterKilled(nemesis, game, { damageType: AD_PHYS });
    assert.equal(ensureQuestStatus().killed_nemesis, true);
    const cloud = game.level?.regions.find(region => region.kind === 'gas-cloud');
    assert.ok(cloud);
    assert.equal(cloud.heroFault, false);
    assert.equal(cloud.damage, 8);
});
void test('a waiting prisoner frees itself when the hero approaches and pleases the hero deity', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const prisoner = await createMonsterAt('prisoner', 11, 10);
    prisoner.mstrategy = STRAT_CLOSE;
    prisoner.msleeping = 0;
    prisoner.mpeaceful = 0;
    const alignment = game.u.ualign.record;
    const input = resetInputState();
    input.display = { async readKey() { return 32; } };
    await runMonsterAction(prisoner, game);
    assert.equal(prisoner.mpeaceful, 1);
    assert.equal(prisoner.mstrategy & STRAT_CLOSE, 0);
    assert.equal(game.u.ualign.record, alignment + 3);
});
void test('a rejected chat returns the hero to the parent portal before the next command', async () => {
    const { destination } = freshConnectedLevels({ role: 'healer', dungeonName: 'The Quest' });
    const cache = game._levelCache;
    const parent = cache?.get('0:2');
    assert.ok(cache && parent);
    cache.set('1:1', parent);
    cache.delete('0:2');
    game.dungeons.push(createDungeon({ dname: 'The Dungeons of Doom' }));
    game.quest_dnum = 0;
    game.branches = [{ end1: { dnum: 1, dlevel: 1 }, end2: { dnum: 0, dlevel: 1 },
            type: 'portal', portal: true, end1_up: false }];
    game._activeSpecialLevel = { prototype: 'Hea-strt', file: 'Hea-strt.lua' };
    game.u.ulevel = 13;
    addTrap(destination, MAGIC_PORTAL, 14, 10);
    const leader = await createMonsterAt('Hippocrates', 11, 10);
    registerQuestLeader(leader);
    leader.msleeping = 0;
    const input = resetInputState();
    input.display = { async readKey() { return 32; } };
    input.feed('#chat\nl');
    game._moveloopStarted = true;
    game.u.umovement = 12;
    await moveloop_core();
    assert.equal(game.u.uz?.dnum, 1);
    assert.equal(game.u.ux, 14);
    assert.equal(game.u.uy, 10);
    assert.equal(game._questExpulsionPending, null);
});
//# sourceMappingURL=quest_chat.test.js.map