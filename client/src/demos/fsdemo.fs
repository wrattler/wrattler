module FsDemo

open Fable.Core
open Fable.Core.JsInterop
open Fable.Import

let fsHello () =
  Browser.console.log("Hello from Fable!")

[<ExportDefault>]
let exports = fsHello
