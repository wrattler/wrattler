import * as Langs from '../definitions/languages';
import * as Graph from '../definitions/graph';
export declare class ExternalBlockKind implements Langs.Block {
    language: string;
    source: string;
    constructor(source: string, language: string);
}
export interface ExternalSwitchTabEvent {
    kind: "switchtab";
    index: number;
}
export declare type ExternalEvent = ExternalSwitchTabEvent;
export declare type ExternalState = {
    id: number;
    block: ExternalBlockKind;
    tabID: number;
};
export declare const ExternalEditor: Langs.Editor<ExternalState, ExternalEvent>;
export declare class ExternalLanguagePlugin implements Langs.LanguagePlugin {
    readonly language: string;
    readonly iconClassName: string;
    readonly editor: Langs.Editor<ExternalState, ExternalEvent>;
    readonly serviceURI: string;
    readonly defaultCode: string;
    readonly regex_global: RegExp;
    readonly regex_local: RegExp;
    constructor(l: string, icon: string, uri: string, code: string);
    getDefaultCode(id: number): string;
    evaluate(context: Langs.EvaluationContext, node: Graph.Node): Promise<Langs.EvaluationResult>;
    parse(code: string): ExternalBlockKind;
    bind(context: Langs.BindingContext, block: Langs.Block): Promise<Langs.BindingResult>;
    save(block: Langs.Block): string;
}
