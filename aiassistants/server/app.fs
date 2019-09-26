module AiAssistants.App
open System
open System.IO
open System.Diagnostics
open Giraffe
open FSharp.Data

type Config = JsonProvider<"config-sample.json">

type DataStoreAgentMessage = 
  | Get of string * AsyncReplyChannel<string>

let dataStore = MailboxProcessor.Start(fun inbox -> async {
  try 
    let cache = System.Collections.Generic.Dictionary<_, _>()
    while true do 
      use wc = new System.Net.WebClient()
      wc.Headers.Add("Accept","application/json")
      let! msg = inbox.Receive()
      match msg with
      | Get(url, repl) when cache.ContainsKey url ->
          repl.Reply(cache.[url])

      | Get(url, repl) ->
          //let url = url.Replace("wrattler_wrattler_data_store_1", "localhost")
          let! data = wc.DownloadStringTaskAsync(System.Uri(url)) |> Async.AwaitTask
          let rows = [| for row in JsonValue.Parse(data) -> row |]    
          let head = [| for p, _ in rows.[0].Properties() -> p |]
          let file = CsvFile.Parse(String.concat "," head)
          let file = rows |> Array.map (fun r -> CsvRow(file, r.Properties() |> Array.map (fun (_, v) -> v.AsString()))) |> file.Append
          let out = System.IO.Path.GetTempFileName()
          file.Save(out)
          cache.[url] <- out
          repl.Reply(out)
  with e ->
    printfn "DATASTORE FAILED: %A" e })


type Completion = { name:string; path:string }

type ProcessMessage = 
  | GetData of inputs:string * query:string * AsyncReplyChannel<JsonValue>
  | GetCompletions of inputs:string * query:string * AsyncReplyChannel<Completion[]>
  | Kill

exception StopProcess 

let serialize (file:string) =
  let csv = CsvFile.Load(file)
  let sp (v:string) =
    match System.Decimal.TryParse(v) with
    | true, d -> JsonValue.Number d
    | _ -> JsonValue.String v  
  csv.Rows
  |> Seq.map (fun row ->
    (csv.Headers.Value, row.Columns) 
    ||> Array.map2 (fun k v -> k, sp v) |> JsonValue.Record) 
  |> Array.ofSeq |> JsonValue.Array

let startProcess id (build:Config.Build[]) fn wd args = 
  let dir = Directory.GetCurrentDirectory()

  for b in build do
    printfn "Running build script for '%s': %s %s" id b.Process b.Arguments
    let psi = 
      ProcessStartInfo(FileName=b.Process, WorkingDirectory=Path.Combine(Array.append [| dir |] wd), 
        Arguments=b.Arguments, UseShellExecute=false)  
    let ps = System.Diagnostics.Process.Start(psi)
    ps.WaitForExit()
    
  printfn "Starting process for '%s': %s %s" id fn args
  let psi = 
    ProcessStartInfo(FileName=fn, WorkingDirectory=Path.Combine(Array.append [| dir |] wd), 
      Arguments=args, UseShellExecute=false, RedirectStandardOutput=true, RedirectStandardInput=true)  
  let ps = System.Diagnostics.Process.Start(psi)
  MailboxProcessor.Start(fun inbox -> async {
    try
      while true do 
        let! msg = inbox.Receive()
        match msg with 
        | Kill ->
            printfn "Stopping process '%s'" id
            ps.Kill()
            raise StopProcess
        | GetData(inputs, query, repl) ->
            printfn "Sending 'data' command to process '%s'" id
            ps.StandardInput.WriteLine(inputs)
            ps.StandardInput.WriteLine("data")
            ps.StandardInput.WriteLine(query)
            printfn "Waiting for CSV file..."
            let out = ps.StandardOutput.ReadLine()
            printfn "Received CSV file '%s'" out
            let json = serialize out
            //File.Delete(out)
            repl.Reply(json)

        | GetCompletions(inputs, query, repl) ->
            printfn "Sending 'completions' command to process '%s'" id
            ps.StandardInput.WriteLine(inputs)
            ps.StandardInput.WriteLine("completions")
            ps.StandardInput.WriteLine(query)
            let completions = 
              [| let mutable line = ""
                 while (line <- ps.StandardOutput.ReadLine(); line <> "") do
                   let path = ps.StandardOutput.ReadLine()
                   printfn "  %s: %s" line path
                   yield { name = line; path = path } |] 
            printfn "Received '%d' completions" completions.Length
            repl.Reply completions
    with 
    | StopProcess -> ()
    | e -> printfn "PROCESS FAILED: %A" e })
  
let waitForChange () = Async.FromContinuations(fun (cont, _, _) ->
  let fsw = new FileSystemWatcher()
  let mutable cts = new System.Threading.CancellationTokenSource()
  let mutable finished = false
  let l1 = obj()
  let l2 = obj()

  let update a = 
    let work = async {      
      do! Async.Sleep(2000)
      let run = lock l2 (fun () ->
        if not finished then
          finished <- true
          fsw.EnableRaisingEvents <- false
          fsw.Dispose() 
          true
        else false )
      if run then cont ()
    }
    lock l1 (fun () ->
      cts.Cancel()       
      cts <- new Threading.CancellationTokenSource()
      Async.Start(work, cancellationToken = cts.Token)
    )
        
  fsw.Path <- Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "assistants"))
  fsw.NotifyFilter <- NotifyFilters.LastAccess ||| NotifyFilters.LastWrite ||| NotifyFilters.FileName ||| NotifyFilters.DirectoryName
  fsw.Filter <- "config.json"
  fsw.Changed.Add(fun e -> printfn "%A: %s" e.ChangeType e.FullPath; update ())
  fsw.Created.Add(fun e -> printfn "%A: %s" e.ChangeType e.FullPath; update ())
  fsw.Deleted.Add(fun e -> printfn "%A: %s" e.ChangeType e.FullPath; update ())
  fsw.Renamed.Add(fun e -> printfn "%A: %s" e.ChangeType e.FullPath; update ())
  fsw.EnableRaisingEvents <- true)

type AiAssistant = {
  name: string
  description: string
  inputs: string[]
  root: string }

let loadConfig (config:string) = 
  let config = Config.Parse(config)
  let aias = config |> Array.map (fun a -> 
    { name = a.Name; description = a.Description; inputs = a.Inputs; root = a.Id })
  let processes = 
    [ for a in config -> a.Id, startProcess a.Id a.Build a.Process [| ".."; "assistants"; a.Id |] a.Arguments ]
    |> Map.ofSeq
  aias, processes

let readConfig () = 
  File.ReadAllText(Path.Combine(Directory.GetCurrentDirectory(), "..", "assistants", "config.json"))
let mutable config = readConfig ()
let mutable aias, processes = loadConfig config

Async.Start <| async {  
  while true do 
    printfn "Waiting for file changes..."
    do! waitForChange ()
    let newConfig = readConfig ()
    if config <> newConfig then
      config <- newConfig
      printfn "Config file has changed. Reloading config and starting processes"
      let kill = processes
      let a, p = loadConfig config
      aias <- a
      processes <- p
      printfn "Killing all old processes"
      kill |> Map.iter (fun _ p -> p.Post(Kill)) }

let dsurl =
  let dsurl = Environment.GetEnvironmentVariable("DATASTORE_URI")
  if String.IsNullOrEmpty dsurl then "http://localhost:7102" else dsurl

let aiareq handler : HttpHandler = fun f c -> Async.StartAsTask <| async {
  let inputs = c.Request.Headers.["Inputs"] |> Seq.tryHead |> Option.defaultValue ""
  let local = ResizeArray<_>()
  for kvp in inputs.Split([|','|], System.StringSplitOptions.RemoveEmptyEntries) do
    match kvp.Split('=') with 
    | [|k;v|] -> 
        let! file = dataStore.PostAndAsyncReply(fun repl -> Get(v, repl))
        local.Add(k + "=" + file)
    | _ -> failwith "Invalid Inputs"
  let inputs = String.concat "," local

  let url = (if c.Request.Path.HasValue then c.Request.Path.Value else "/").[1 ..]
  let parts = url.Split([|'/'|], StringSplitOptions.RemoveEmptyEntries) |> List.ofArray
  match parts with
  | name::query -> 
      let! res = handler inputs (processes.[name]) query 
      return! Async.AwaitTask(res f c) 
  | _ -> 
      return! Async.AwaitTask(RequestErrors.BAD_REQUEST "Missing assistant name" f c) }

let (|Concat|) q = String.concat "/" q

let app : HttpHandler = 
  choose [
    route "/" >=> fun a r -> json aias a r
    aiareq (fun inputs aia query -> async {
      match query with 
      | "data"::hash::var::Concat(query) ->
          let! result = aia.PostAndAsyncReply(fun repl -> GetData(inputs, query, repl))
          let frameUrl = sprintf "%s/%s/%s" dsurl hash var
          let! _ = 
            Http.AsyncRequest
              ( frameUrl, httpMethod="PUT", headers=[HttpRequestHeaders.ContentType("application/json")], 
                body=TextRequest(result.ToString()) )
          return json frameUrl
      | "completions"::Concat(query) ->
          let! result = aia.PostAndAsyncReply(fun repl -> GetCompletions(inputs, query, repl))
          return json result 
      | _ ->
          return RequestErrors.BAD_REQUEST "Invalid data or completions request" }) ]
