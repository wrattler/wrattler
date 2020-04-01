import * as Langs from '../definitions/languages';
import * as Graph from '../definitions/graph';
export declare class spreadsheetLanguagePlugin implements Langs.LanguagePlugin {
    readonly language: string;
    readonly iconClassName: string;
    readonly editor: Langs.Editor<Langs.EditorState, any>;
    readonly datastoreURI: string;
    constructor(language: string, iconClassName: string, datastoreUri: string);
    getDefaultCode(id: number): string;
    parse(url: string): Langs.Block;
    bind(context: Langs.BindingContext, block: Langs.Block): Promise<Langs.BindingResult>;
    evaluate(context: Langs.EvaluationContext, node: Graph.Node): Promise<Langs.EvaluationResult>;
    save(block: Langs.Block): string;
}
