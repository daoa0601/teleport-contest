export function clearJustPicked(state) {
    for (const object of state?.inventory || [])
        object.pickup_prev = false;
}

export function markJustPicked(object) {
    if (object) object.pickup_prev = true;
    return object;
}
