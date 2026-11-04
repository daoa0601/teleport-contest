import { cmdq_add_dir, cmdq_add_key, cmdq_add_userinput } from '../../js/cmd.js';
import { CQ_CANNED } from '../../js/const.js';
// Test-side injection of what CQ_CANNED holds when the game itself queues
// a canned command's answers: keys, directions, and the user-input
// placeholder a later prompt pops in order.
export function queueCannedKeys(keys) {
    for (const key of keys)
        cmdq_add_key(CQ_CANNED, key.charCodeAt(0));
}
export function queueCannedDir(dx, dy, dz = 0) {
    cmdq_add_dir(CQ_CANNED, dx, dy, dz);
}
export function queueCannedUserInput() {
    cmdq_add_userinput(CQ_CANNED);
}
//# sourceMappingURL=canned-input.js.map