// C cmd.c:reset_occupations(): forget resumable occupation state whose
// target may have changed since the occupation was interrupted.
import { game } from './gstate.js';
import { resetPick } from './lock.js';
import { resetBulkTakeoff } from './do_wear.js';
import { resetTrapSetting } from './apply.js';
export function resetOccupations(state = game) {
    resetBulkTakeoff(state);
    resetPick(state);
    resetTrapSetting(state);
}
//# sourceMappingURL=occupation_reset.js.map