module Wrattler.Html
open Fable.Core

type VNode = interface end

[<Import("*", from="maquette")>]
type Maquette = 
  static member h(n:string, a:obj[], b:obj[]) : VNode = failwith "JS"

type H() =
  static member (?) (_, n:string) = fun (props:list<_>) (children:list<_>) ->
    Maquette.h(n, unbox (JsInterop.createObj props), unbox (Array.ofSeq children))

let (=!>) (s:string) (f:_ -> _) = s, box f 
let h = H()
