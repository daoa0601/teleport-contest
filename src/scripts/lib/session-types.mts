/** The v5 recorder format and its external JSON boundary. */
export type Cursor = [number, number, number];
export interface AnimationFrame { screen: string; cursor?: Cursor | null; }
export interface SessionStep {
    key: string | null;
    rng: string[];
    screen: string;
    cursor?: Cursor | null;
    animation_frames?: AnimationFrame[];
}
export interface KeysAction {
    type: 'keys';
    value: string;
    dismissMore?: boolean;
    expectExit?: boolean;
}
export interface MenuAction {
    type: 'select-menu-entry';
    target: string;
    openKeys?: string;
    dismissMore?: boolean;
    expectExit?: boolean;
}
export type SessionAction = KeysAction | MenuAction;
export interface PolicyConfig {
    kind: 'fuzz' | 'explore' | 'wide';
    seed: number;
    maxSteps: number;
    name?: string;
    setup?: SessionAction[];
}
export type DriverConfig = SessionAction[] | PolicyConfig;
export interface DriverSummary {
    kind: 'fuzz' | 'explore' | 'wide';
    seed: number;
    maxSteps: number;
    keysSent: number;
    calls: number;
    stopReason: string | null;
    dead: boolean;
    dlvl: number | null;
    turns: number | null;
    maxTurns: number | null;
    hp: number | null;
    hpMax: number | null;
    hunger: string | null;
    exploredCells: number;
    descends: number;
    attacks: number;
    doorsOpened: number;
    /** Some native policy recordings omit this telemetry; absence is not zero. */
    blockedCells?: number;
    promptKeys: Record<string, number>;
    lastClass: string | null;
    setupComplete?: boolean;
}
export interface SessionDriver {
    nextKey(lines: readonly string[], info?: { cursor?: Cursor }): string | null;
    readonly exhausted: boolean;
    readonly acceptsGameExit?: boolean;
    readonly expectsExit?: boolean;
    readonly summary?: DriverSummary;
}
export interface RecordingMetadata {
    termination: string;
    exitCode: number | null;
    suppliedKeys: number;
    driver: DriverSummary | null;
    state?: { saves: number; bones: number };
}
export interface SessionSegment {
    seed: number;
    datetime: string;
    nethackrc: string;
    moves?: string;
    steps?: SessionStep[];
    driver?: DriverConfig;
    recording?: RecordingMetadata;
}
export interface Session { version: 5; segments: SessionSegment[]; }

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function objectValue(value: unknown, label: string): Record<string, unknown> {
    if (!isObject(value)) throw new Error(`${label} must be an object`);
    return value;
}
export function stringValue(value: unknown, label: string): string {
    if (typeof value !== 'string') throw new Error(`${label} must be a string`);
    return value;
}
export function numberValue(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
    return value;
}
export function booleanValue(value: unknown, label: string): boolean {
    if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
    return value;
}
export function arrayValue(value: unknown, label: string): unknown[] {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
    return value;
}
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
export function hasErrorCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}
export function itemAt<T>(items: readonly T[], index: number): T {
    const item = items[index];
    if (item === undefined) throw new Error(`missing item at index ${index} (length ${items.length})`);
    return item;
}
function nullableNumber(value: unknown, label: string): number | null {
    return value === null ? null : numberValue(value, label);
}
function nullableString(value: unknown, label: string): string | null {
    return value === null ? null : stringValue(value, label);
}
export function decodeCursor(value: unknown): Cursor {
    const parts = arrayValue(value, 'cursor');
    if (parts.length !== 3) throw new Error('cursor must have three coordinates');
    return [numberValue(parts[0], 'cursor x'), numberValue(parts[1], 'cursor y'), numberValue(parts[2], 'cursor visibility')];
}
function decodeFrame(value: unknown): AnimationFrame {
    const frame = objectValue(value, 'animation frame');
    return { screen: stringValue(frame.screen, 'animation screen'), ...(frame.cursor === undefined ? {} : { cursor: frame.cursor === null ? null : decodeCursor(frame.cursor) }) };
}
function decodeStep(value: unknown): SessionStep {
    const step = objectValue(value, 'step');
    return { key: step.key == null ? null : stringValue(step.key, 'step key'),
        rng: arrayValue(step.rng ?? [], 'rng').map(call => stringValue(call, 'rng entry')),
        screen: stringValue(step.screen ?? '', 'step screen'),
        ...(step.cursor === undefined ? {} : { cursor: step.cursor === null ? null : decodeCursor(step.cursor) }),
        ...(step.animation_frames === undefined ? {} : { animation_frames: arrayValue(step.animation_frames, 'animation frames').map(decodeFrame) }) };
}
export function decodeActions(value: unknown): SessionAction[] {
    return arrayValue(value, 'driver actions').map(value => {
        const action = objectValue(value, 'driver action');
        const flags = {
            ...(action.dismissMore === undefined ? {} : { dismissMore: booleanValue(action.dismissMore, 'dismissMore') }),
            ...(action.expectExit === undefined ? {} : { expectExit: booleanValue(action.expectExit, 'expectExit') }),
        };
        if (action.type === 'keys') return { type: 'keys', value: stringValue(action.value, 'keys value'), ...flags };
        if (action.type === 'select-menu-entry') return { type: 'select-menu-entry', target: stringValue(action.target, 'menu target'),
            ...(action.openKeys === undefined ? {} : { openKeys: stringValue(action.openKeys, 'menu openKeys') }), ...flags };
        throw new Error(`unsupported driver action: ${String(action.type)}`);
    });
}
export function decodeDriver(value: unknown): DriverConfig {
    return Array.isArray(value) ? decodeActions(value) : decodePolicyConfig(value);
}
export function decodePolicyConfig(value: unknown): PolicyConfig {
    const driver = objectValue(value, 'driver');
    if (driver.kind !== 'fuzz' && driver.kind !== 'explore' && driver.kind !== 'wide') throw new Error('driver kind must be fuzz, explore, or wide');
    return { kind: driver.kind, seed: numberValue(driver.seed, 'driver seed'), maxSteps: numberValue(driver.maxSteps, 'driver maxSteps'),
        ...(driver.name === undefined ? {} : { name: stringValue(driver.name, 'driver name') }),
        ...(driver.setup === undefined ? {} : { setup: decodeActions(driver.setup) }) };
}
function decodeSummary(value: unknown): DriverSummary {
    const data = objectValue(value, 'driver summary');
    if (data.kind !== 'fuzz' && data.kind !== 'explore' && data.kind !== 'wide') throw new Error('invalid driver summary kind');
    const promptKeys: Record<string, number> = {};
    for (const [key, count] of Object.entries(objectValue(data.promptKeys, 'prompt counts'))) promptKeys[key] = numberValue(count, key);
    return { kind: data.kind, seed: numberValue(data.seed, 'seed'), maxSteps: numberValue(data.maxSteps, 'maxSteps'),
        keysSent: numberValue(data.keysSent, 'keysSent'), calls: numberValue(data.calls, 'calls'), stopReason: nullableString(data.stopReason, 'stopReason'),
        dead: booleanValue(data.dead, 'dead'), dlvl: nullableNumber(data.dlvl, 'dlvl'), turns: nullableNumber(data.turns, 'turns'), maxTurns: nullableNumber(data.maxTurns, 'maxTurns'),
        hp: nullableNumber(data.hp, 'hp'), hpMax: nullableNumber(data.hpMax, 'hpMax'), hunger: nullableString(data.hunger, 'hunger'),
        exploredCells: numberValue(data.exploredCells, 'exploredCells'), descends: numberValue(data.descends, 'descends'), attacks: numberValue(data.attacks, 'attacks'),
        doorsOpened: numberValue(data.doorsOpened, 'doorsOpened'), promptKeys,
        ...(data.blockedCells === undefined ? {} : { blockedCells: numberValue(data.blockedCells, 'blockedCells') }),
        lastClass: nullableString(data.lastClass, 'lastClass'), ...(data.setupComplete === undefined ? {} : { setupComplete: booleanValue(data.setupComplete, 'setupComplete') }) };
}
function decodeRecording(value: unknown): RecordingMetadata {
    const data = objectValue(value, 'recording metadata');
    const recording: RecordingMetadata = { termination: stringValue(data.termination, 'termination'), exitCode: nullableNumber(data.exitCode, 'exitCode'),
        suppliedKeys: numberValue(data.suppliedKeys, 'suppliedKeys'), driver: data.driver == null ? null : decodeSummary(data.driver) };
    if (data.state !== undefined) {
        const state = objectValue(data.state, 'recording state');
        recording.state = { saves: numberValue(state.saves, 'saves'), bones: numberValue(state.bones, 'bones') };
    }
    return recording;
}
export function decodeSession(value: unknown): Session {
    const data = objectValue(value, 'session');
    if (data.version !== 5) throw new Error('session must have version 5');
    const segments = arrayValue(data.segments, 'segments').map(value => {
        const segment = objectValue(value, 'segment');
        return { ...segment, seed: numberValue(segment.seed, 'seed'), datetime: stringValue(segment.datetime, 'datetime'), nethackrc: stringValue(segment.nethackrc, 'nethackrc'),
            ...(segment.moves === undefined ? {} : { moves: stringValue(segment.moves, 'moves') }),
            ...(segment.steps === undefined ? {} : { steps: arrayValue(segment.steps, 'steps').map(decodeStep) }),
            ...(segment.driver === undefined ? {} : { driver: decodeDriver(segment.driver) }),
            ...(segment.recording === undefined ? {} : { recording: decodeRecording(segment.recording) }) };
    });
    return { ...data, version: 5, segments };
}
