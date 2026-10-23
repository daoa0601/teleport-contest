// C cmd.c:reset_occupations(): forget resumable occupation state whose
// target may have changed since the occupation was interrupted.
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { resetPick } from './lock_context.js';
import { resetBulkTakeoff } from './takeoff_state.js';
import { resetTrapSetting } from './trap_setting.js';

export function resetOccupations(state: GameState = game): void {
    resetBulkTakeoff(state);
    resetPick(state);
    resetTrapSetting(state);
}
