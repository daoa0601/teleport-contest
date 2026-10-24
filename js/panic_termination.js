export class PanicTermination extends Error {
    constructor(reason) {
        super(reason);
        this.name = 'PanicTermination';
    }
}
// C panic() reached from a synchronous formatter's impossible(). Native
// never returns to the formatter; unwinding to the Engine stops every later
// mutation, and the Engine then produces panic()'s output.
export class FormatterPanic extends PanicTermination {
    constructor(reason) {
        super(reason);
        this.name = 'FormatterPanic';
    }
}
//# sourceMappingURL=panic_termination.js.map