import {VNode} from 'maquette';

/// Each block knows the language that created it
interface BlockKind {
  language : string
}

/// This is passed to the `render` function of `Editor` and it
/// allows the editor to change its own state when some 
/// user action happens. The editor just needs to call `trigger`.
interface EditorContext<TEvent> {
  trigger(event:TEvent)
}

/// Every editor needs to remember its own unique ID 
/// and the block that it is editing.
interface EditorState {
  id: number
  block: BlockKind;
}

interface Editor<TState extends EditorState, TEvent> {
  initialize(id:number, block:BlockKind) : TState

  /// The two functions known from the 'Elm' architecture. 
  /// Update takes a state with an event and produces a new state.
  update(state:TState, event:TEvent) : TState

  /// Render takes a state and renders VNodes based on the state. The `context`
  /// parameter allows it to trigger updates when a UI event happens.
  render(state:TState, context:EditorContext<TEvent>) : VNode
}

interface LanguagePlugin {
  parse(code:string) : BlockKind
  editor : Editor<EditorState, any>
  language : string
}

export { 
  BlockKind,
  Editor,
  EditorState,
  EditorContext,
  LanguagePlugin
}