// Remaining bounded turn replays. Startup and level construction are owned by
// their live source ports; this module must not regain either responsibility.

import { rn2 } from './rng.js';
import { useCompatibilityBridge } from './bridge_policy.js';

// Per-step leaf RNG calls for roles which have not yet reached the shared live
// actor/global-turn scheduler in normal compatibility mode.
export function fastforward_step(stepNum) {
    useCompatibilityBridge('fastforward.turn');
    const steps = [
        () => { rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
        () => { rn2(5); rn2(5); rn2(5); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
        () => { rn2(5); rn2(32); rn2(5); rn2(5); rn2(32); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
        () => { rn2(5); rn2(24); rn2(5); rn2(5); rn2(24); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
        () => { rn2(5); rn2(16); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
        () => { rn2(5); rn2(12); rn2(5); rn2(5); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); rn2(31); },
        () => { rn2(5); rn2(16); rn2(5); rn2(5); rn2(16); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
        () => { rn2(5); rn2(12); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
        () => { rn2(5); rn2(20); rn2(5); rn2(5); rn2(8); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(19); rn2(82); },
        () => { rn2(5); rn2(12); rn2(5); rn2(5); rn2(20); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
        () => { rn2(5); rn2(20); rn2(5); rn2(5); rn2(12); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
        () => { rn2(5); rn2(16); rn2(5); rn2(5); rn2(16); rn2(5); rn2(12); rn2(12); rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(82); },
    ];
    if (stepNum > 0 && stepNum <= steps.length) steps[stepNum - 1]();
}

// Ranger compatibility turns remain explicit until their named-start path is
// replaced by the shared monster scheduler.
export function fastforward_ranger_step(stepNum) {
    useCompatibilityBridge('fastforward.ranger-turn');
    if (stepNum === 1) {
        rn2(12); rn2(12); rn2(12); rn2(12);
        rn2(70); rn2(20); rn2(73);
    } else if (stepNum === 2) {
        rn2(5); rn2(100); rn2(8); rn2(100); rn2(8); rn2(1);
        rn2(5); rn2(4); rn2(5); rn2(5); rn2(4); rn2(3); rn2(3);
        rn2(5); rn2(4); rn2(5); rn2(5); rn2(5); rn2(5); rn2(5);
        rn2(5); rn2(5); rn2(5); rn2(5); rn2(4); rn2(5); rn2(5); rn2(5);
        rn2(100); rn2(8); rn2(100); rn2(8); rn2(1); rn2(5);
        rn2(12); rn2(12); rn2(12); rn2(12);
        rn2(70); rn2(20); rn2(73);
    } else if (stepNum === 3) {
        rn2(5); rn2(100); rn2(8); rn2(100); rn2(8); rn2(1);
        rn2(5); rn2(5); rn2(32); rn2(5); rn2(4); rn2(5); rn2(5);
        rn2(5); rn2(4); rn2(5); rn2(5); rn2(5); rn2(5); rn2(20); rn2(5);
        rn2(12); rn2(12); rn2(12); rn2(12);
        rn2(70); rn2(20); rn2(73);
        return true;
    }
    return false;
}
