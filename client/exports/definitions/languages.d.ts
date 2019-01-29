/**
 * Interface for implementing language plugins.
 *
 * @module Languages
 */
/** This comment is needed so that TypeDoc parses the above one correctly */
import { VNode } from 'maquette';
import * as Graph from './graph';
import * as Values from './values';
interface BindingResult {
    code: Graph.Node;
    exports: Graph.ExportNode[];
}
interface ScopeDictionary {
    [variable: string]: Graph.Node;
}
interface EvaluationSuccess {
    kind: 'success';
    value: Values.Value;
}
interface EvaluationFailure {
    kind: 'error';
    errors: Graph.Error[];
}
declare type EvaluationResult = EvaluationSuccess | EvaluationFailure;
/**
 * A plugin that implements language specific functionality such as creating an
 * editor for the language, parsing code, creating dependency graph, evaluation, etc.
 */
interface LanguagePlugin {
    /** Identifier of the language that this plugin implements */
    language: string;
    /** Returns a language-specific editor that handles the UI in a notebook  */
    editor: Editor<EditorState, any>;
    /**
     * Parse source code and construct a language-specific Block object that keeps the result
     * of the parsing (this can just store the source, but it could build an AST too)
     */
    parse(code: string): Block;
    evaluate(node: Graph.Node): Promise<EvaluationResult>;
    /**
     * Given a parsed block and a dictionary that tracks variables that are in scope,
     * construct a dependency graph for the given block. Returns a node representing the
     * code block and a list of exported variables (to be added to the scope)
     */
    bind(scopeDictionary: {}, block: Block): Promise<BindingResult>;
}
/**
 * A block in a notebook. Blocks are created, rendered and maintained by
 * functions provided by  `LanguagePlugin`. Typically, this is editable
 * source code, but it could be a visual tool too.
 */
interface Block {
    /** Language of the plugin that created and owns this block */
    language: string;
}
/**
 * An editor for blocks of a specific language. Editors follow the Elm architecture -
 * it defines a state together with events that can be triggered by actions in the
 * user interface. The render function renders the current state as a Virtual DOM node
 * and the update function calculates a new state when given an old state and an event.
 */
interface Editor<TState extends EditorState, TEvent> {
    /**
     * Initialize the editor state for a given block with a given (unique) block ID
     */
    initialize(id: number, block: Block): TState;
    /**
     * Render the block using the current editor state. The editor context that
     * is also passed to the render function can be used to trigger events when
     * the user performs some action (this triggers re-render of the page)
     */
    render(block: BlockState, state: TState, context: EditorContext<TEvent>): VNode;
    /**
     * The update function takes an event (trggered by the event handlers returned
     * in the rendered Virutal DOM nodes) together with the current state of the
     * editor and produces a new state.
     */
    update(state: TState, event: TEvent): TState;
}
/**
 * The context is passed to the `render` function of `Editor`. It allows the
 * rendered Virtual DOM nodes to triggger events specific to the editor (which
 * then trigger state update via the `update` function).
 */
interface EditorContext<TEvent> {
    /** Trigger an editor-specific event to be handled via the `update` function  */
    trigger(event: TEvent): void;
    evaluate(block: BlockState): void;
    rebindSubsequent(block: BlockState, newSource: string): any;
}
/**
 * An interface that captures shared things that editor state needs to keep. This
 * contains a reference to the block (for which the editor was created) and the
 * unique block ID passed to the editor during initialization.
 */
interface EditorState {
    /** Unique ID of the block. This can be used to create
     * unique Virutal DOM IDs during rendering */
    id: number;
    /** The block for which this editor was created */
    block: Block;
}
/**
 * A block state keeps information about the block in the overall notebook state.
 * In addition to the editor state, it keeps information about the corresponding
 * dependency graph nodes (which are needed to render previews)
 */
declare type BlockState = {
    /** The state of the editor associated with this block
     * (also includes a reference to the block itself and its unique ID) */
    editor: EditorState;
    /** The dependency graph node created for the block as a whole */
    code: Graph.Node;
    /** The dependency graph nodes representing data frames exported from the code block */
    exports: Graph.Node[];
};
export { Block, Editor, EditorState, EditorContext, LanguagePlugin, BlockState, BindingResult, ScopeDictionary, EvaluationResult, EvaluationSuccess, EvaluationFailure };
