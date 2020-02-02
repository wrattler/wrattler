declare class Log {
    static message(level: string, category: string, msg: string, ...args: any[]): void;
    static trace(category: string, msg: string, ...args: any[]): void;
    static exception(category: string, msg: string, ...args: any[]): void;
    static error(category: string, msg: string, ...args: any[]): void;
}
export declare function assert(b: boolean, msg?: string, ...xs: any[]): any;
export { Log };
