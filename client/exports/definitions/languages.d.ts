/**
 * Wrattler is a polyglot notebook system. It constructs dependency graph
 * and manages evaluation of nodes in the graph in the web browser, although
 * languages like R and Python that cannot run in the web browser delegate much
 * of the work to a server-side execution runtime.
 *
 * When extending Wrattler, you have a range of options from creating (just) a
 * new server-side execution runtime to implementing custom user interface for
 * a cell. The types in this module let you imlement new _language plugins_ that
 * do some interesting work directly in the web browser.
 *
 * - [`LanguagePlugin`](../interfaces/languages.languageplugin.html) is the main
 *   type that you need to implement if you want to add new language to Wrattler.
 *   The type is responsible for parsing, binding (i.e. the construction of a
 *   dependnecy graph), evaluation and also user interface.
 *
 * - [`Block`](../interfaces/languages.block.html) is produced by parsing source
 *   code. Each language can define its own type and store either the code itself
 *   or some parsed abstract syntax tree.
 *
 * ### Constructing dependency graph
 * The following types are related to the `bind` operation of a `LanguagePlugin`:
 *
 * - [`BindingContext`](../interfaces/languages.bindingcontext.html) provides
 *   the language plugin with a cache for reusing past graph nodes, variables
 *   that are in scope from previous cells (the [`ScopeDictionary`](../interfaces/languages.scopedictionary.html)
 *   type) and also source files (e.g. `*.py`) that were imported in previous cells
 *   (the [`Resource`](../interfaces/languages.resource.html) type).
 *
 * - [`BindingResult`](../interfaces/languages.bindingresult.html) is the result of
 *   `bind`. It includes one graph node representing the whole code cell and an
 *   array representing exported data frames. It can also return new source files that
 *   should be automatically loaded in further cells (as values of the
 *   [`Resource`](../interfaces/languages.resource.html) type).
 *
 * ### Evaluating graph node values
 * The following types are related to the `eval` operation of a `LanguagePlugin`:
 *
 * - [`EvaluationContext`](../interfaces/languages.evaluationcontext.html) provides
 *   the evaluator with files that are imported in previous cells.
 *
 * - [`EvaluationResult`](#evaluationresult) represents the result of evaluation. This
 *   can be either [`EvaluationFailure`](../interfaces/languages.evaluationfailure.html),
 *   consisting of an array of errors, or [`EvaluationSuccess`](../interfaces/languages.evaluationsuccess.html)
 *   consisting of a [`Value`](../interfaces/values.value.html) that should be stored
 *   with the graph node.
 *
 * ### Implementing custom editors
 * The following types are needed when implementing custom editor for a new language:
 *
 * - [`Editor`](../interfaces/languages.editor.html) is the main type to implement.
 *   Editors in Wrattler follow the Elm architecture. They expose `render` function, which
 *   generates virtual HTML nodes based on the current state and `update` function, which
 *   is used to update the state when an event happens.
 *
 * - Editor for each language has its own type of events. The type used to represent
 *   state needs to implement the [`EditorState`](../interfaces/languages.editorstate.html)
 *   interface.
 *
 * - [`BlockState`](#blockstate) is passed to `render` when rendering a notebook. It
 *   stores the [`EditorState`](../interfaces/languages.editorstate.html) of the given
 *   editor and information about dependency graph nodes corresponding to the cell.
 *
 * - [`EditorContext`](../interfaces/languages.editorcontext.html) is passed as an extra
 *   parameter to `render`. It provides operations for triggering events (to be called from
 *   JavaScript event handlers), rebinding and triggering evaluation.

 * @module Languages
 */
/** This comment is needed so that TypeDoc parses the above one correctly */
import { VNode } from 'maquette';
import * as Graph from './graph';
import * as Values from './values';
/**
 * The result of the binding operation, which creates dependency
 * graph nodes corresponding to a notebook cell. This type stores
 * nodes attached to the whole cell, exported variables and also any
 * newly loaded source files (resources).
 */
interface BindingResult {
    /** A graph node corresponding to the entire cell. Evaluating this
     * node should produce [`ExportsValue`](../interfaces/values.exportsvalue.html). */
    code: Graph.Node;
    /** Graph nodes corresponding to variables and outputs exported by the code. Evaluating
     * these should produce one of [`KnownValue`](../modules/values.html#knownvalue) types. */
    exports: Graph.ExportNode[];
    /** If the language supports loading files (resources), then the resources loaded
     * in the code of a cell can be returned here. */
    resources: Array<Resource>;
}
/**
 * Wrattler cells can use special "magic" commands to load source files
 * from outside of a notebook. This type represents such files (resources).
 * Resources are stored in data store, so we just keep the `url`.
 */
interface Resource {
    /** The name of the language that created the resource */
    language: string;
    /** The file name of the original file that we loaded */
    fileName: string;
    /** Global resources should be automatically imported in other cells.
     * Local resources are not automatically imported. */
    scope: "global" | "local";
    /** The URL where the resource is stored in a data store. */
    url: string;
}
/**
 * A scope dictionary keeps track of variables that are in scope, that is,
 * variables that were defined earlier in a notebook. The type is a mapping
 * from variable names to the graph nodes that represent them (and evaluate
 * to data frames).
 */
interface ScopeDictionary {
    [variable: string]: Graph.Node;
}
/**
 * When evaluating a graph node, the `eval` operation gets an instance of
 * `EvaluationContext` as an argument. It stores a list of available resources.
*/
interface EvaluationContext {
    /** A list of files that were loaded as global or local resources by any
     * language plugin for any cell appearing before the current one. */
    resources: Resource[];
    /** URL for a service that can be used for loading resources using `%global` or `%local`. If you
     * say `%global test.py`, Wrattler will fetch the file from `<resourceServerUrl>/resources/test.py`. */
    resourceServerUrl: string;
}
/** Represents the result of the `eval` operation of a `LanguagePlugin`. */
declare type EvaluationResult = EvaluationSuccess | EvaluationFailure;
/**
 * When a language plugin succesfully evaluates a graph node, it returns a
 * value of this type with `value` set to the resulting value.
 */
interface EvaluationSuccess {
    /** A tag that can be used for pattern matching on `EvaluationResult` values */
    kind: 'success';
    /** The value to be attached to a graph node. This can be any
     * value, including custom language-specific ones. */
    value: Values.Value;
}
/**
 * When evaluation of a graph node fails, the language plugin should return
 * a value of this type with an array of errors.
 */
interface EvaluationFailure {
    /** A tag that can be used for pattern matching on `EvaluationResult` values */
    kind: 'error';
    /** An array of errors. The error stores the message to be displayed to the user. */
    errors: Graph.Error[];
}
/**
 * A context that is passed to the `bind` operation of a `LanguagePlugin`. This
 * stores variables in scope, graph node cache and loaded resources.
 */
interface BindingContext {
    /** A cache can be used for retrieving previously created graph nodes, so that
     * Wrattler can reuse previously evaluated values. */
    cache: Graph.NodeCache;
    /** Provides language plugin with access to variables defined in earlier cells
     * that are now in scope. */
    scope: ScopeDictionary;
    /** URL for a service that can be used for loading resources using `%global` or `%local`. If you
     * say `%global test.py`, Wrattler will fetch the file from `<resourceServerUrl>/resources/test.py`. */
    resourceServerUrl: string;
    /** A list of resources loaded by earlier cells. */
    resources: Resource[];
}
/**
 * A plugin that implements language specific functionality such as creating an
 * editor for the language, parsing code, creating dependency graph, evaluation, etc.
 */
interface LanguagePlugin {
    /** Identifier of the language that this plugin implements */
    language: string;
    /** CSS class for a Font Awesome icon to be used for this language.
     * For example, the value `"fab fa-js-square"` is used for JavaScript. */
    iconClassName: string;
    /** Given a numerical ID of a newly created block, return default source code
     * that should appear in a newly created cells. This can be empty string or
     * something to guide the user. */
    getDefaultCode(id: number): string;
    /** Returns a language-specific editor that handles the UI in a notebook  */
    editor: Editor<EditorState, any>;
    /** Parse source code and construct a language-specific Block object that keeps the result
     * of the parsing (this can just store the source, but it could build an AST too) */
    parse(code: string): Block;
    /** Evaluate the code associated with a graph node. When doing this, the
     * language plugin can assume that all `antecedent` nodes have already been evaluated. */
    evaluate(context: EvaluationContext, node: Graph.Node): Promise<EvaluationResult>;
    /**
     * Given a parsed block and a dictionary that tracks variables that are in scope,
     * construct a dependency graph for the given block. Returns a node representing the
     * code block and a list of exported variables (to be added to the scope)
     */
    bind(context: BindingContext, block: Block): Promise<BindingResult>;
    /** Given a code cell, return string of source to be used for saving document in Markdown file. */
    save(block: Block): string;
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
    /** Trigger the evaluation of a given code block. */
    evaluate(blockId: number): void;
    /** Set the source of a given code block to the `newSource` and trigger rebinding
     * of all subsequent code blocks in a notebook. */
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
interface BlockState {
    /** The state of the editor associated with this block
     * (also includes a reference to the block itself and its unique ID) */
    editor: EditorState;
    evaluationState: "unevaluated" | "pending" | "done";
    /** The dependency graph node created for the block as a whole */
    code: Graph.Node;
    /** The dependency graph nodes representing data frames exported from the code block */
    exports: Graph.Node[];
}
export { Block, Editor, EditorState, EditorContext, LanguagePlugin, BlockState, BindingContext, BindingResult, Resource, ScopeDictionary, EvaluationContext, EvaluationResult, EvaluationSuccess, EvaluationFailure };
