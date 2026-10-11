export class PanicTermination extends Error {
    constructor(reason) {
        super(reason);
        this.name = 'PanicTermination';
    }
}
//# sourceMappingURL=panic_termination.js.map