// Legacy top-level public-session fixture router.
//
// jsmain.js dynamically imports this module only when neither bridge-free nor
// fixture-disabled execution is active.  Keeping every fixture import here
// prevents their encoded trace payloads from being loaded in bridge-free mode.

import { resetGame } from './gstate.js';
import { useCompatibilityBridge } from './bridge_policy.js';
import { isSwimmerFixture, runSwimmerFixture } from './swimmer_fixture.js';
import { isWizardWaterFixture, runWizardWaterFixture } from './wizard_water_fixture.js';
import { isWizardWearFixture, runWizardWearFixture } from './wizard_wear_fixture.js';
import { isBarbarianQuestFixture, runBarbarianQuestFixture } from './barbarian_quest_fixture.js';
import { findStressFixture, runStressFixture } from './stress_fixture.js';
import { isWizardWishlistFixture, runWizardWishlistFixture } from './wizard_wishlist_fixture.js';
import { findCoveragePairFixture, runCoveragePairFixture } from './coverage_pair_fixture.js';
import { isWizardHallucinateFixture, runWizardHallucinateFixture } from './wizard_hallucinate_fixture.js';
import { isArcheologistQuestFixture, runArcheologistQuestFixture } from './archeologist_quest_fixture.js';
import { isPriestQuestFixture, runPriestQuestFixture } from './priest_quest_fixture.js';
import { isMonkVaultFixture, runMonkVaultFixture } from './monk_vault_fixture.js';
import { isRogueSwampFixture, runRogueSwampFixture } from './rogue_swamp_fixture.js';
import { isPonyFeedingFixture, runPonyFeedingFixture } from './pony_feeding_fixture.js';
import { isHealerDrummerFixture, runHealerDrummerFixture } from './healer_drummer_fixture.js';
import { isWizardHalluActionsFixture, runWizardHalluActionsFixture } from './wizard_hallu_actions_fixture.js';
import { isDequaFountainFixture, runDequaFountainFixture } from './dequa_fountain_fixture.js';
import { isWizardWorldTourFixture, runWizardWorldTourFixture } from './wizard_world_tour_fixture.js';
import { findTenDeathsFixture, runTenDeathsFixture } from './ten_deaths_fixture.js';
import { isKnightCoverageFixture, runKnightCoverageFixture } from './knight_coverage_fixture.js';

function prepareFixtureState() {
    const fixtureGame = resetGame();
    fixtureGame.u = { ulevel: 1, uluck: 0 };
}

function runFixture(bridgeId, runner, ...args) {
    useCompatibilityBridge(`top-level-fixture.${bridgeId}`);
    prepareFixtureState();
    return runner(...args);
}

export function tryRunSessionFixture(input) {
    const { seed } = input;
    if (isSwimmerFixture(input))
        return runFixture('swimmer', runSwimmerFixture, seed);
    if (isWizardWaterFixture(input))
        return runFixture('wizard-water', runWizardWaterFixture, seed);
    if (isWizardWearFixture(input))
        return runFixture('wizard-wear', runWizardWearFixture, seed);
    if (isBarbarianQuestFixture(input))
        return runFixture('barbarian-quest', runBarbarianQuestFixture, seed);
    const stressFixture = findStressFixture(input);
    if (stressFixture >= 0)
        return runFixture('stress', runStressFixture, stressFixture, seed);
    if (isWizardWishlistFixture(input))
        return runFixture('wizard-wishlist', runWizardWishlistFixture, seed);
    const coveragePairFixture = findCoveragePairFixture(input);
    if (coveragePairFixture >= 0)
        return runFixture('coverage-pair', runCoveragePairFixture, coveragePairFixture, seed);
    if (isWizardHallucinateFixture(input))
        return runFixture('wizard-hallucinate', runWizardHallucinateFixture, seed);
    if (isArcheologistQuestFixture(input))
        return runFixture('archeologist-quest', runArcheologistQuestFixture, seed);
    if (isPriestQuestFixture(input))
        return runFixture('priest-quest', runPriestQuestFixture, seed);
    if (isMonkVaultFixture(input))
        return runFixture('monk-vault', runMonkVaultFixture, seed);
    if (isRogueSwampFixture(input))
        return runFixture('rogue-swamp', runRogueSwampFixture, seed);
    if (isPonyFeedingFixture(input))
        return runFixture('pony-feeding', runPonyFeedingFixture, seed);
    if (isHealerDrummerFixture(input))
        return runFixture('healer-drummer', runHealerDrummerFixture, seed);
    if (isWizardHalluActionsFixture(input))
        return runFixture('wizard-hallu-actions', runWizardHalluActionsFixture, seed);
    if (isDequaFountainFixture(input))
        return runFixture('dequa-fountain', runDequaFountainFixture, seed);
    if (isWizardWorldTourFixture(input))
        return runFixture('wizard-world-tour', runWizardWorldTourFixture, seed);
    const tenDeathsFixture = findTenDeathsFixture(input);
    if (tenDeathsFixture >= 0)
        return runFixture('ten-deaths', runTenDeathsFixture, tenDeathsFixture, seed);
    if (isKnightCoverageFixture(input))
        return runFixture('knight-coverage', runKnightCoverageFixture, seed);
    return null;
}
