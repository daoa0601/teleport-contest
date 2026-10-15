// C wizard.c:cuss(), shared by monster turns and sounds.c:domonnoise().
import { plineWithContinuation as pline } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { monsterAlignmentType } from './monster_alignment.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { deliverCommonQuestInsult } from './quest_pager.js';
import { rn2 } from './rng.js';
import { heroIsDeaf } from './senses.js';

const M2_MINION = 0x00001000;

const WIZARD_CUSS_INSULTS = [
    'antic', 'blackguard', 'caitiff', 'chucklehead', 'coistrel', 'craven',
    'cretin', 'cur', 'dastard', 'demon fodder', 'dimwit', 'dolt', 'fool',
    'footpad', 'imbecile', 'knave', 'maledict', 'miscreant', 'niddering',
    'poltroon', 'rattlepate', 'reprobate', 'scapegrace', 'varlet', 'villein',
    'wittol', 'worm', 'wretch',
];
const WIZARD_CUSS_MALEDICTIONS = [
    'Hell shall soon claim thy remains,',
    'I chortle at thee, thou pathetic',
    'Prepare to die, thou',
    'Resistance is useless,',
    'Surrender or die, thou',
    'There shall be no mercy, thou',
    'Thou shalt repent of thy cunning,',
    'Thou art as a flea to me,',
    'Thou art doomed,',
    'Thy fate is sealed,',
    'Verily, thou shalt be one dead',
];

export async function publishMonsterCuss(
    monster: Monster, state: PlayingGameState, random = rn2,
): Promise<void> {
    if (heroIsDeaf(state)) return;
    const minion = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_MINION);
    const extension = monster.emin ?? monster.mextra?.emin;
    if (monster.iswiz) {
        await pline(selectWizardCussMessage(monster, state, random));
    } else if (minion && monsterAlignmentType(monster) === 1
        && !(monster.isminion && extension?.renegade)) {
        await deliverCommonQuestInsult('angel_cuss', state);
    } else if (!random(minion ? 100 : 5)) {
        await pline(`${monsterName(monster, { capitalized: true, state })} casts aspersions on your ancestry.`);
    } else {
        await deliverCommonQuestInsult('demon_cuss', state);
    }
    await wakeMonstersNearWithMessages(monster.mx, monster.my, 25, state);
}

function selectWizardCussMessage(monster: Monster, game: PlayingGameState, roll: typeof rn2): string {
    if (roll(5) === 0)
        return monsterName(monster, { capitalized: true, state: game }) + ' laughs fiendishly.';
    if (game.u?.uhave?.amulet
        && roll(WIZARD_CUSS_INSULTS.length) === 0) {
        return '"Relinquish the amulet, '
            + WIZARD_CUSS_INSULTS[roll(WIZARD_CUSS_INSULTS.length)] + '!"';
    }
    if ((game.u?.uhp ?? 1) < 5 && roll(2) === 0) {
        const line = roll(2)
            ? 'Even now thy life force ebbs, '
            : 'Savor thy breath, ';
        const suffix = line.startsWith('Savor')
            ? ', it be thy last!' : '!';
        return '"' + line
            + WIZARD_CUSS_INSULTS[roll(WIZARD_CUSS_INSULTS.length)]
            + suffix + '"';
    }
    if ((monster.mhp ?? 1) < 5 && roll(2) === 0)
        return roll(2) ? '"I shall return."' : '"I\'ll be back."';
    return '"' + WIZARD_CUSS_MALEDICTIONS[
        roll(WIZARD_CUSS_MALEDICTIONS.length)
    ] + ' ' + WIZARD_CUSS_INSULTS[
        roll(WIZARD_CUSS_INSULTS.length)
    ] + '!"';
}
