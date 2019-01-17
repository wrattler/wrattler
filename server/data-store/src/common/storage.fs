module Wrattler.Storage

open System
open System.IO
open System.Collections.Generic
open Microsoft.WindowsAzure.Storage
open FSharp.Data
open Microsoft.FSharp.Reflection

// ------------------------------------------------------------------------------------------------
// Helpers for writing data to storage & reading data from storage
// ------------------------------------------------------------------------------------------------

let createCloudBlobClient connStr = 
  let account = CloudStorageAccount.Parse(connStr )
  account.CreateCloudBlobClient()

let readBlob connStr source file : string = 
  let container = createCloudBlobClient(connStr).GetContainerReference(source)
  if container.ExistsAsync().Result then
    let blob = container.GetBlockBlobReference(file)
    if blob.ExistsAsync().Result then 
      blob.DownloadTextAsync().Result 
    else failwithf "Blob '%s' does not exist." file
  else failwithf "container '%s' not found" source

let tryReadBlob connStr source file : option<string> = 
  let container = createCloudBlobClient(connStr).GetContainerReference(source)
  if container.ExistsAsync().Result then
    let blob = container.GetBlockBlobReference(file)
    if blob.ExistsAsync().Result then 
      Some(blob.DownloadTextAsync().Result)
    else None
  else None

let tryReadBlobAsync connStr source file = async {
  let container = createCloudBlobClient(connStr).GetContainerReference(source)
  if container.ExistsAsync().Result then
    let blob = container.GetBlockBlobReference(file)
    if blob.ExistsAsync().Result then 
      let! text = blob.DownloadTextAsync(System.Text.Encoding.UTF8, AccessCondition(), Blob.BlobRequestOptions(), OperationContext()) |> Async.AwaitTask
      return Some text 
    else return None
  else return None }

let tryReadBlobBytesAsync connStr source file = async {
  let container = createCloudBlobClient(connStr).GetContainerReference(source)
  if container.ExistsAsync().Result then
    let blob = container.GetBlockBlobReference(file)
    if blob.ExistsAsync().Result then 
      use ms = new MemoryStream()
      do! blob.DownloadToStreamAsync(ms, AccessCondition(), Blob.BlobRequestOptions(), OperationContext()) |> Async.AwaitTask
      return Some (ms.ToArray())
    else return None
  else return None }

let writeBlob connStr source file data = 
  let container = createCloudBlobClient(connStr).GetContainerReference(source)
  if container.ExistsAsync().Result then
    let blob = container.GetBlockBlobReference(file)
    blob.UploadTextAsync(data).Wait()
  else failwithf "container '%s' not found" source

let writeBlobAsync connStr source file data = async {
  let container = createCloudBlobClient(connStr).GetContainerReference(source)
  if container.ExistsAsync().Result then
    let blob = container.GetBlockBlobReference(file)
    do! blob.UploadTextAsync(data, System.Text.Encoding.UTF8, AccessCondition(), Blob.BlobRequestOptions(), OperationContext()) |> Async.AwaitTask
  else return failwithf "container '%s' not found" source }

let writeBlobBytesAsync connStr source file data = async {
  let container = createCloudBlobClient(connStr).GetContainerReference(source)
  if container.ExistsAsync().Result then
    let blob = container.GetBlockBlobReference(file)
    do! blob.UploadFromByteArrayAsync(data, 0, data.Length, AccessCondition(), Blob.BlobRequestOptions(), OperationContext()) |> Async.AwaitTask
  else return failwithf "container '%s' not found" source }

let writeRecordsToBlob connStr source dir file (records:seq<string[]>) = 
  let container = createCloudBlobClient(connStr).GetContainerReference(source)
  let blob = container.GetDirectoryReference(dir).GetBlockBlobReference(file)
  if blob.ExistsAsync().Result then blob.DeleteAsync().Wait()
  let sb = System.Text.StringBuilder()
  for recd in records do 
    let recd = recd |> Array.map (fun s -> s.Replace('\n', ' ').Replace(';', ',')) |> String.concat ";"
    sb.Append(recd).Append('\n') |> ignore
  blob.UploadTextAsync(sb.ToString().Substring(0, sb.Length-1)).RunSynchronously()
  blob
