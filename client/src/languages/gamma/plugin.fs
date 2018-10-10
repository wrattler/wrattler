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

type GammaEditorState = 
  { id : float 
    block : Block }

type GammaEditorEvent = unit

let editor = 
  { new Editor<GammaEditorState, GammaEditorEvent> with 
    member x.initialize(id: float, block: Block) = { id = id; block = block }
    member x.render(block: BlockState, state, context) : VNode = h?h1 [] ["Hello"]
    member x.update(state, evt) = state }

let sampleValue () = 
  { new Value }

let bind (scope:ScopeDictionary) (block:Block) = async {
  Browser.console.log("SCOPE:", box scope.["one"])
  let code = 
    { new Node with
      member x.language = "thegamma"
      member x.antecedents = [||]
      member x.value = Some (sampleValue()) }
  return { code = code; exports = [||] } }

let gammaLangaugePlugin = 
  { new LanguagePlugin with
    member x.language = "thegamma"
    member x.editor = unbox editor
    member x.parse(code: string) = parse code :> _
    member x.evaluate(node: Node) : Promise<Value> = failwith "yo evaluate"
    member x.bind(scope: ScopeDictionary, block: Block) = 
      Async.StartAsPromise (bind scope block) }

[<ExportDefault>]
let exports = gammaLangaugePlugin
