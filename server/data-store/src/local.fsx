// --------------------------------------------------------------------------------------
// Build script that hosts & auto-reloads servers from the various script files
// --------------------------------------------------------------------------------------

#I "../packages"
#r "FAKE/tools/FakeLib.dll"
#r "FSharp.Compiler.Service/lib/net45/FSharp.Compiler.Service.dll"
#r "Suave/lib/net40/Suave.dll"

open Fake
open System
open System.IO
open Suave
open Suave.Operators
open Suave.Web
open Microsoft.FSharp.Compiler.Interactive.Shell

// --------------------------------------------------------------------------------------
// The following uses FileSystemWatcher to look for changes in 'app.fsx'. When
// the file changes, we run `#load "app.fsx"` using the F# Interactive service
// and then get the `App.app` value (top-level value defined using `let app = ...`).
// The loaded WebPart is then hosted at localhost:10042.
// --------------------------------------------------------------------------------------

let sbOut = new Text.StringBuilder()
let sbErr = new Text.StringBuilder()

let fsiSession =
  let inStream = new StringReader("")
  let outStream = new StringWriter(sbOut)
  let errStream = new StringWriter(sbErr)
  let fsiConfig = FsiEvaluationSession.GetDefaultConfiguration()
  let argv = Array.append [|"/fake/fsi.exe"; "--quiet"; "--noninteractive" |] [||]
  FsiEvaluationSession.Create(fsiConfig, argv, inStream, outStream, errStream)

let reportFsiError (e:exn) =
  traceError "Reloading app.fsx script failed."
  traceError (sprintf "Message: %s\nError: %s" e.Message (sbErr.ToString().Trim()))
  sbErr.Clear() |> ignore

let reloadScript () =
  try
    traceImportant "Reloading 'app.fsx' script..." 
    fsiSession.EvalInteraction(sprintf "#load @\"%s\"" (__SOURCE_DIRECTORY__ </> "app.fsx"))
    match fsiSession.EvalExpression("App.app") with
    | Some app -> Some(app.ReflectionValue :?> WebPart)
    | None -> failwith "Couldn't get 'app' value." 
  with e -> reportFsiError e; None

// --------------------------------------------------------------------------------------
// Suave server that redirects all request to currently loaded version
// --------------------------------------------------------------------------------------

let getLocalServerConfig port =
  { defaultConfig with
      homeFolder = Some __SOURCE_DIRECTORY__
      bindings = [ HttpBinding.createSimple HTTP  "127.0.0.1" port ] }

let mutable currentApp : WebPart = Successful.OK "Loading..."

let reloadAppServer (changedFiles: string seq) =
  reloadScript () |> Option.iter (fun app -> 
    currentApp <- app
    traceImportant "Refreshed server." )

let port =
  match System.Environment.GetCommandLineArgs() |> Seq.tryPick (fun s ->
      if s.StartsWith("local-port=") then Some(int(s.Substring("local-port=".Length)))
      else None ) with
  | Some port -> port
  | _ -> failwith "Local port not specified!"

let app = 
  Writers.setHeader "Cache-Control" "no-cache, no-store, must-revalidate"
  >=> Writers.setHeader "Pragma" "no-cache"
  >=> Writers.setHeader "Expires" "0"
  >=> fun ctx -> currentApp ctx
  
let _, server = startWebServerAsync (getLocalServerConfig port) app

// Start Suave to host it on localhost
let sources = { BaseDirectory = __SOURCE_DIRECTORY__; Includes = [ "*.fs*" ]; Excludes = [] }
reloadAppServer sources
Async.Start(server)

// Watch for changes & reload when server.fsx changes
let watcher = sources |> WatchChanges (Seq.map (fun x -> x.FullPath) >> reloadAppServer)
traceImportant "Waiting for app.fsx edits. Press any key to stop."
System.Threading.Thread.Sleep(System.Threading.Timeout.Infinite)
