module AiAssistants.App
open System
open System.IO
open System.Diagnostics
open Giraffe
open FSharp.Data

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

let startProcess fn wd args = 
  let dir = Directory.GetCurrentDirectory()
  let psi = 
    ProcessStartInfo(FileName=fn, WorkingDirectory=Path.Combine(Array.append [| dir |] wd), 
      Arguments=args, UseShellExecute=false, RedirectStandardOutput=true, RedirectStandardInput=true)  
  let ps = System.Diagnostics.Process.Start(psi)
  MailboxProcessor.Start(fun inbox -> async {
    try
      while true do 
        let! msg = inbox.Receive()
        match msg with 
        | GetData(inputs, query, repl) ->
            ps.StandardInput.WriteLine(inputs)
            ps.StandardInput.WriteLine("data")
            ps.StandardInput.WriteLine(query)
            let out = ps.StandardOutput.ReadLine()
            let json = serialize out
            //File.Delete(out)
            repl.Reply(json)

        | GetCompletions(inputs, query, repl) ->
            ps.StandardInput.WriteLine(inputs)
            ps.StandardInput.WriteLine("completions")
            ps.StandardInput.WriteLine(query)
            [| let mutable line = ""
               while (line <- ps.StandardOutput.ReadLine(); line <> "") do
                 let path = ps.StandardOutput.ReadLine()
                 printfn "  %s: %s" line path
                 yield { name = line; path = path } |] |> repl.Reply
    with e ->
      printfn "PROCESS FAILED: %A" e })
  

type Config = JsonProvider<"../config.json">
let config = Config.Load(Path.Combine(Directory.GetCurrentDirectory(), "..", "config.json"))

type AiAssistant = {
  name: string
  description: string
  inputs: string[]
  root: string }

let aias = config |> Array.map (fun a -> 
  { name = a.Name; description = a.Description; inputs = a.Inputs; root = a.Id })

let processes = 
  [ for a in config -> a.Id, startProcess a.Process [| ".."; a.Id |] a.Arguments ]
  |> Map.ofSeq

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
    route "/" >=> json aias
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
