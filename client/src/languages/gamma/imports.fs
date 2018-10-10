module rec Wrattler.Imports

open System
open Fable.Core
open Fable.Import.JS
open Wrattler.Html

/// Types representing the dependency graph.
/// A node in the dependency graph that Wrattler maintains while the user edits a
/// notebook. The graph is used to avoid re-computing previously computed parts
/// of the notebook and for maintaining unique hashes that are used as keys when 
/// storing results in the data store.
type [<AllowNullLiteral>] Node =
    /// Language of the plugin that created and owns this node 
    abstract language: string 
    /// Returns all nodes that this node depends on in any way 
    abstract antecedents: Node[] 
    /// The evaluated value associated with this node 
    abstract value: Value option with get, set

/// A node that represents a data frame exported from a code block. This is 
/// a common interface that can be implemented by any language plugin that 
/// has code blocks which can export nodes. A preview of the value is displayed 
/// in the notebook user interface.
type [<AllowNullLiteral>] ExportNode =
    inherit Node
    /// Name of the exported variable to be used when rendering a preview 
    abstract variableName: string with get, set

type [<AllowNullLiteral>] Value =
    interface end

type [<AllowNullLiteral>] ExportsValue =
    inherit Value
    [<Emit "$0[$1]{{=$2}}">] abstract Item: key: string -> Value with get, set

type [<AllowNullLiteral>] DataFrame =
    inherit Value
    abstract url: string with get, set
    abstract data: obj option with get, set

type BindingResult =
  { code: Node
    exports: ExportNode[] }

/// A plugin that implements language specific functionality such as creating an
/// editor for the language, parsing code, creating dependency graph, evaluation, etc.
type [<AllowNullLiteral>] LanguagePlugin =
    /// Identifier of the language that this plugin implements 
    abstract language: string 
    /// Returns a language-specific editor that handles the UI in a notebook  
    abstract editor: Editor<EditorState, obj option> 
    /// Parse source code and construct a language-specific Block object that keeps the result
    /// of the parsing (this can just store the source, but it could build an AST too)
    abstract parse: code: string -> Block
    abstract evaluate: node: Node -> Promise<Value>
    /// Given a parsed block and a dictionary that tracks variables that are in scope, 
    /// construct a dependency graph for the given block. Returns a node representing the
    /// code block and a list of exported variables (to be added to the scope)
    abstract bind: scopeDictionary: ScopeDictionary * block: Block -> Promise<BindingResult>

type [<AllowNullLiteral>] ScopeDictionary =
    [<Emit "$0[$1]">] abstract Item: key: string -> Node

/// A block in a notebook. Blocks are created, rendered and maintained by 
/// functions provided by  `LanguagePlugin`. Typically, this is editable
/// source code, but it could be a visual tool too.
type [<AllowNullLiteral>] Block =
    /// Language of the plugin that created and owns this block 
    abstract language: string 

/// An editor for blocks of a specific language. Editors follow the Elm architecture - 
/// it defines a state together with events that can be triggered by actions in the 
/// user interface. The render function renders the current state as a Virtual DOM node
/// and the update function calculates a new state when given an old state and an event.
type [<AllowNullLiteral>] Editor<'TState, 'TEvent> =
    /// Initialize the editor state for a given block with a given (unique) block ID
    abstract initialize: id: float * block: Block -> 'TState
    /// Render the block using the current editor state. The editor context that
    /// is also passed to the render function can be used to trigger events when
    /// the user performs some action (this triggers re-render of the page)
    abstract render: block: BlockState * state: 'TState * context: EditorContext<'TEvent> -> VNode
    /// The update function takes an event (trggered by the event handlers returned
    /// in the rendered Virutal DOM nodes) together with the current state of the 
    /// editor and produces a new state.
    abstract update: state: 'TState * ``event``: 'TEvent -> 'TState

/// The context is passed to the `render` function of `Editor`. It allows the 
/// rendered Virtual DOM nodes to triggger events specific to the editor (which
/// then trigger state update via the `update` function).
type [<AllowNullLiteral>] EditorContext<'TEvent> =
    /// Trigger an editor-specific event to be handled via the `update` function  
    abstract trigger: ``event``: 'TEvent -> unit
    abstract evaluate: block: BlockState -> unit
    abstract rebindSubsequent: block: BlockState * newSource: string -> unit

/// An interface that captures shared things that editor state needs to keep. This
/// contains a reference to the block (for which the editor was created) and the
/// unique block ID passed to the editor during initialization.
type [<AllowNullLiteral>] EditorState =
    /// Unique ID of the block. This can be used to create 
    /// unique Virutal DOM IDs during rendering 
    abstract id: float with get, set
    /// The block for which this editor was created 
    abstract block: Block with get, set

type [<AllowNullLiteral>] BlockState =
    /// The state of the editor associated with this block 
    /// (also includes a reference to the block itself and its unique ID) 
    abstract editor: EditorState with get, set
    /// The dependency graph node created for the block as a whole 
    abstract code: Node with get, set
    /// The dependency graph nodes representing data frames exported from the code block 
    abstract exports: ResizeArray<Node> with get, set
