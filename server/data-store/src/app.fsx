#if INTERACTIVE
#r "../packages/Suave/lib/net40/Suave.dll"
#r "../packages/FSharp.Data/lib/net45/FSharp.Data.dll"
#load "../packages/FSharp.Azure.StorageTypeProvider/StorageTypeProvider.fsx"
#load "config.fs" "common/storage.fs"
#else
module Wrattler.DataStore
#endif
open Suave
open Suave.Filters
open Suave.Writers
open Suave.Operators
open Suave.Logging

open System
open Wrattler
open FSharp.Data

#if INTERACTIVE
let connStrBlob = Config.WrattlerDataStore
#else 
let connStrBlob = Environment.GetEnvironmentVariable("CUSTOMCONNSTR_WRATTLER_DATA")
#endif

// --------------------------------------------------------------------------------------
// Server that exposes the R functionality
// --------------------------------------------------------------------------------------

let logger = Targets.create Verbose [||]
let logf fmt = Printf.kprintf (fun s -> logger.info(Message.eventX s)) fmt

let app =
  setHeader  "Access-Control-Allow-Origin" "*"
  >=> setHeader "Access-Control-Allow-Methods" "GET,PUT"
  >=> setHeader "Access-Control-Allow-Headers" "content-type"
  >=> choose [
    OPTIONS >=> 
      Successful.OK "CORS approved"

    GET >=> path "/" >=>  
      Successful.OK "Service is running..."

    GET >=> pathScan "/%s" (fun file ctx -> async {
      logf "Reading blob: %s" file
      let! blob = Storage.tryReadBlobAsync connStrBlob "data" file
      logf "Read blob: %s (length = %d)" file (match blob with Some b -> b.Length | _ -> -1)
      match blob with 
      | Some json -> return! Successful.OK json ctx 
      | None -> return! RequestErrors.NOT_FOUND "" ctx })

    PUT >=> pathScan "/%s" (fun file ctx -> async {
      let json = System.Text.UTF32Encoding.UTF8.GetString(ctx.request.rawForm)
      logf "Uploading blob: %s (length = %d)" file json.Length
      do! Storage.writeBlobAsync connStrBlob "data" file json
      logf "Uploaded blob: %s" file 
      return! Successful.OK "Created" ctx })
  ]

// --------------------------------------------------------------------------------------
// Startup code for Azure hosting
// --------------------------------------------------------------------------------------

// When port was specified, we start the app (in Azure), 
// otherwise we do nothing (it is hosted by 'build.fsx')
match System.Environment.GetCommandLineArgs() |> Seq.tryPick (fun s ->
    if s.StartsWith("port=") then Some(int(s.Substring("port=".Length)))
    else None ) with
| Some port ->
    let serverConfig =
      { Web.defaultConfig with
          bindings = [ HttpBinding.createSimple HTTP "127.0.0.1" port ] }
    Web.startWebServer serverConfig app
| _ -> ()