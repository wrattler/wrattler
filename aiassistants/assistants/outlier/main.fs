open System
open FSharp.Data

let parse s = 
  try 
    if String.IsNullOrEmpty s then 0.0
    else Convert.ToDouble(s) 
  with _ -> nan

type Filters = 
  { Deleted : bool 
    Ignored : string list
    Tests : (string*string) list }

let getCompletions cfg (head:string[]) (data:string[][]) = 
  if cfg.Deleted then [] else

  let ignored = set cfg.Ignored
  let lookup = head |> Array.mapi (fun i h -> if ignored.Contains h then None else Some i) |> Array.choose id
  let head = lookup |> Array.map (fun i -> head.[i])
  let data = data |> Array.map (fun row -> lookup |> Array.map (fun i -> row.[i]))

  if data.Length = 0 then [] else

  let columns = 
    Array.init head.Length (fun i -> 
      data |> Array.mapi (fun j row -> parse row.[i]))

  let avg = columns |> Array.map Array.average 

  let outliers = 
    data 
    |> Array.mapi (fun j row ->
      j, row |> Array.mapi (fun i v ->
        let v = parse v
        abs ((v - avg.[i]) / avg.[i]) ) |> Array.sumBy (fun v -> if System.Double.IsNaN v then 0.0 else v ))
    |> Array.sortByDescending snd
    |> Array.truncate 10

  [ for col in 0 .. head.Length - 1 do
    for i, _ in outliers do
      if System.Double.IsNaN (parse data.[i].[col]) then
        yield head.[col], data.[i].[col] ]
  |> List.distinct

let applyFilters cfg head (data:string[][]) = 
  let filters = cfg.Tests |> Seq.map (fun (k, v) -> 
    head |> Array.findIndex ((=) k), v)
  data |> Array.filter(fun row -> 
    if cfg.Deleted then filters |> Seq.exists (fun (k, v) -> row.[k] = v)
    else filters |> Seq.forall (fun (k, v) -> row.[k] <> v))

let parseParts (parts:string[]) =
  parts |> Array.fold (fun cfg part ->
    if part = "deleted" then 
      { cfg with Deleted = true }
    elif part.Contains("=") then 
      let s = part.Split('=')
      { cfg with Tests = (s.[0], s.[1])::cfg.Tests }
    elif part.StartsWith("~") then 
      { cfg with Ignored = part.Substring(1)::cfg.Ignored }
    else failwithf "Badly formated part: %s" part) { Deleted = false; Ignored = []; Tests = [] }

let readData (file:string) = 
  let data = CsvFile.Load(file)
  data.Headers.Value, data.Rows |> Seq.map (fun r -> r.Columns) |> Seq.toArray

let writeData head data (out:string) = 
  let file = CsvFile.Parse(String.concat "," head)
  let file = data |> Array.map (fun r -> CsvRow(file, r)) |> file.Append
  file.Save(out)

[<EntryPoint>]
let main _ =
  while true do
    let input = Console.ReadLine().Split('=').[1]
    let cmd = Console.ReadLine()
    let query = Console.ReadLine().Trim('/')  

    let cfg = query.Split([|'/'|], System.StringSplitOptions.RemoveEmptyEntries) |> parseParts
    let head, data = readData input

    if cmd = "data" then
      let filtered = applyFilters cfg head data 
      let out = System.IO.Path.GetTempFileName()
      writeData head filtered out
      printfn "%s" out

    elif cmd = "completions" then
      let filtered = applyFilters cfg head data
      let ignored = set cfg.Ignored
      for k, v in getCompletions cfg head filtered do
        printfn "%s is not %s\n%s" k v (query + "/" + k + "=" + v)
      for h in head do
        if not (ignored.Contains(h)) then 
          printfn "ignore %s\n%s" h (query + "/~" + h)
      if not cfg.Deleted then
        printfn "removed rows\n%s" (query + "/deleted")       
      printfn ""
  0