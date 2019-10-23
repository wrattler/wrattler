import * as Langs from '../definitions/languages';
import * as Graph from '../definitions/graph';
export interface AiAssistant {
    name: string;
    description: string;
    inputs: string[];
    root: string;
}
export declare class AiaLanguagePlugin implements Langs.LanguagePlugin {
    readonly language: string;
    readonly iconClassName: string;
    readonly editor: Langs.Editor<Langs.EditorState, any>;
    private readonly assistants;
    readonly datastoreURI: string;
    constructor(assistants: AiAssistant[], datastoreUri: string);
    getDefaultCode(id: number): string;
    parse(code: string): Langs.Block;
    bind(context: Langs.BindingContext, block: Langs.Block): Promise<Langs.BindingResult>;
    evaluate(context: Langs.EvaluationContext, node: Graph.Node): Promise<Langs.EvaluationResult>;
    save(block: Langs.Block): string;
}
export declare function createAiaPlugin(url: string, datastoreURI: string): Promise<AiaLanguagePlugin>;
