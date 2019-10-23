import * as Langs from '../definitions/languages';
import * as Graph from '../definitions/graph';
export declare class JavascriptBlockKind implements Langs.Block {
    language: string;
    source: string;
    constructor(source: string);
}
export interface JavascriptSwitchTabEvent {
    kind: "switchtab";
    index: number;
}
export declare type JavascriptEvent = JavascriptSwitchTabEvent;
export declare type JavascriptState = {
    id: number;
    block: JavascriptBlockKind;
    tabID: number;
};
export declare const javascriptEditor: Langs.Editor<JavascriptState, JavascriptEvent>;
export declare class JavascriptLanguagePlugin implements Langs.LanguagePlugin {
    readonly language: string;
    readonly iconClassName: string;
    readonly editor: Langs.Editor<JavascriptState, JavascriptEvent>;
    readonly datastoreURI: string;
    constructor(datastoreURI: string);
    getDefaultCode(id: number): string;
    evaluate(context: Langs.EvaluationContext, node: Graph.Node): Promise<Langs.EvaluationResult>;
    parse(code: string): JavascriptBlockKind;
    bind(context: Langs.BindingContext, block: Langs.Block): Promise<Langs.BindingResult>;
    save(block: Langs.Block): string;
}
