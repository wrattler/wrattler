module Wrattler.Main

open Fable.Core
open Fable.Import
open Wrattler.Imports
open Wrattler.Html
type Promise<'T> = Fable.Import.JS.Promise<'T>

type GammaBlock = 
  inherit Block  
  abstract code : string

let parse code = 
  { new GammaBlock with
    member x.language = "thegamma"
    member x.code = code }

type GammaNode(ants:Node[]) =
  let mutable v = None
  interface Node with
    member x.language = "thegamma"
    member x.antecedents = ants
    member x.value with get() = v and set(nv) = v <- nv
 
type GammaEditorState = 
  { id : float 
    block : Block }

type GammaEditorEvent = unit

let editor = 
  { new Editor<GammaEditorState, GammaEditorEvent> with 
    member x.initialize(id: float, block: Block) = { id = id; block = block }
    member x.render(block: BlockState, state, context) : VNode = 
      h?div [] [
        yield h?h1 [] ["Hello"]
        yield h?button ["onclick" =!> fun () -> context.evaluate(block) ] ["Evaluate"]
        match block.code.value with 
        | None -> yield h?p [] ["No value"]
        | Some v -> yield h?p [] ["Value: "; string v]
      ]
    member x.update(state, evt) = state }

let sampleValue () = 
  { new Value }

let evaluate (node:GammaNode) = async {
  return sampleValue() }

let bind (scope:ScopeDictionary) (block:Block) = async {
  let df1 = scope.["one"]
  let df2 = scope.["two"]
  let code = GammaNode([|df1; df2|])
  return { code = code; exports = [||] } }

let gammaLangaugePlugin = 
  { new LanguagePlugin with
    member x.language = "thegamma"
    member x.editor = unbox editor
    member x.parse(code: string) = parse code :> _
    member x.evaluate(node: Node) : Promise<Value> = 
      Async.StartAsPromise (evaluate (node :?> GammaNode))
    member x.bind(scope: ScopeDictionary, block: Block) = 
      Async.StartAsPromise (bind scope block) }

[<ExportDefault>]
let exports = gammaLangaugePlugin
