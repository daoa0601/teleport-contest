// Hero magic-trap outcomes. C trap.c:domagictrap().
import { adjustAttribute, attributeChangeMessage } from './attrib.js';
import { heroSpineName } from './body_parts.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { A_CHA, In_quest, isok, Upolyd } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { triggerHeroFireTrap } from './fire_trap.js';
import { game, requirePlayingGame } from './gstate.js';
import { makeDeaf } from './hero_hearing.js';
import { hasInternalInvisibility, syncHeroInvisibility } from './hero_invisibility.js';
import { heroSpecies } from './hero_species.js';
import { formatFeltMessage, formatHeardMessage, formatSeenMessage } from './hero_speech.js';
import { makemonAt } from './mklev.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { tameMonster } from './monster_taming.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { grantIntrinsicProperty, hasCarriedProperty, hasIntrinsicProperty, hasInvokedProperty, hasWornProperty, removeIntrinsicProperty, } from './properties.js';
import { onQuestStart } from './quest.js';
import { rn1, rnd } from './rng.js';
import { applyRemoveCurseSpell } from './scroll_effects.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
const M2_NEUTER = 0x00040000;
export async function triggerHeroMagicTrapEffect() {
    requirePlayingGame(game);
    const currentLevel = game.u.uz;
    const fate = rnd(20);
    if (fate < 10) {
        const count = rnd(4);
        if (!heroResistsBlindingLight(game)) {
            await plineWithContinuation('You are momentarily blinded by a flash of light!');
            await makeBlinded(rn1(5, 10), { talk: false });
            if (!heroIsBlind(game))
                await plineWithContinuation('Your vision clears.');
        }
        else if (!heroIsBlind(game)) {
            await plineWithContinuation(formatSeenMessage('a flash of light!'));
        }
        if (!heroIsDeaf(game)) {
            await hear('a deafening roar!');
            await makeDeaf((game.u.deafTurns ?? 0) + rn1(20, 30), { talk: false });
        }
        else {
            await plineWithContinuation(formatFeltMessage('rankled.'));
            await makeDeaf((game.u.deafTurns ?? 0) + rn1(5, 15), { talk: false });
        }
        for (let i = 0; i < count; i++)
            await makemonAt(null, game.u.ux, game.u.uy);
        await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, 49, game);
        return;
    }
    switch (fate) {
        case 10:
            return;
        case 11:
            await toggleIntrinsicInvisibility();
            return;
        case 12:
            await triggerHeroFireTrap();
            return;
        case 13:
            await plineWithContinuation(`A shiver runs up and down your ${heroSpineName()}!`);
            return;
        case 14:
            await hear(heroIsHallucinating(game) ? 'the moon howling at you.' : 'distant howling.');
            return;
        case 15:
            if (onQuestStart(game)) {
                const neuter = Upolyd(game.u)
                    && !!((MONSTER_FLAGS2[heroSpecies(game)] ?? 0) & M2_NEUTER);
                await plineWithContinuation(formatFeltMessage(`${game.flags.female || neuter ? 'oddly ' : ''}like the prodigal son.`));
            }
            else {
                const quest = game.dungeons.findIndex(dungeon => dungeon.dname === 'The Quest');
                const atEntrance = game.branches.some(branch => branch.end2.dnum === quest
                    && branch.end1.dnum === currentLevel.dnum && branch.end1.dlevel === currentLevel.dlevel);
                const homeland = heroIsHallucinating(game) ? 'Cleveland'
                    : In_quest(game.u.uz) || atEntrance ? 'your nearby homeland' : 'your distant homeland';
                await plineWithContinuation(`You suddenly yearn for ${homeland}.`);
            }
            return;
        case 16:
            await plineWithContinuation('Your pack shakes violently!');
            return;
        case 17:
            await plineWithContinuation(heroIsHallucinating(game) ? 'You smell hamburgers.' : 'You smell charred flesh.');
            return;
        case 18:
            await plineWithContinuation(formatFeltMessage('tired.'));
            return;
        case 19: {
            const change = adjustAttribute(A_CHA, 1);
            if (change.changed || game.flags.verbose) {
                const message = attributeChangeMessage(A_CHA, change);
                if (message)
                    await plineWithContinuation(message);
            }
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const x = game.u.ux + dx, y = game.u.uy + dy;
                    if (!isok(x, y))
                        continue;
                    const monster = monsterAtPosition(game.level, x, y);
                    if (monster)
                        await tameMonster(monster, null, { announce: true });
                }
            }
            return;
        }
        case 20: {
            const confusion = game.u.confusionTurns;
            game.u.confusionTurns = 0;
            try {
                await applyRemoveCurseSpell();
            }
            finally {
                if (confusion === undefined)
                    delete game.u.confusionTurns;
                else
                    game.u.confusionTurns = confusion;
            }
            return;
        }
        default:
            return;
    }
}
async function toggleIntrinsicInvisibility() {
    await hear('a low hum.');
    const intrinsic = hasInternalInvisibility(game);
    const other = hasIntrinsicProperty('invisible', 'form', game)
        || hasWornProperty('invisible', game) || hasCarriedProperty('invisible', null, game)
        || hasInvokedProperty('invisible', game);
    if (!intrinsic && !other) {
        if (!heroIsBlind(game))
            await plineWithContinuation(game.u.seeInvisible
                ? 'Gee!  All of a sudden, you can see right through yourself.'
                : "Gee!  All of a sudden, you can't see yourself.");
    }
    else if (!other) {
        if (!heroIsBlind(game))
            await plineWithContinuation(game.u.seeInvisible
                ? "You can't see through yourself anymore." : 'You can see yourself again!');
    }
    else {
        await plineWithContinuation(formatFeltMessage(`a little more ${intrinsic ? 'obvious' : 'hidden'} now.`));
    }
    if (intrinsic) {
        removeIntrinsicProperty('invisible', game);
        game.u.invisibleTurns = 0;
    }
    else
        grantIntrinsicProperty('invisible', 'outside', game);
    syncHeroInvisibility(game);
    newsym(game.u.ux, game.u.uy);
}
async function hear(text) {
    const message = formatHeardMessage(text);
    if (message)
        await plineWithContinuation(message);
}
//# sourceMappingURL=hero_magic_trap.js.map