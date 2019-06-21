declare class AsyncLazy<T> {
    func: () => Promise<T>;
    evaluated: boolean;
    value: T;
    constructor(f: () => Promise<T>);
    getValue(): Promise<T>;
}
export { AsyncLazy };
