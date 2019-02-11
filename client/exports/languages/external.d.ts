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
export declare class externalLanguagePlugin implements Langs.LanguagePlugin {
    readonly language: string;
    readonly editor: Langs.Editor<ExternalState, ExternalEvent>;
    readonly serviceURI: string;
    constructor(l: string, uri: string);
    evaluate(node: Graph.Node): Promise<Langs.EvaluationResult>;
    parse(code: string): ExternalBlockKind;
    bind(scopeDictionary: Langs.ScopeDictionary, block: Langs.Block): Promise<Langs.BindingResult>;
}
