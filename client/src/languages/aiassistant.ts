import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import * as Values from '../definitions/values'; 
import {createOutputPreview} from '../editors/editor';
import { h } from 'maquette';
import { Md5 } from 'ts-md5';
import axios from 'axios';
import { AsyncLazy } from '../common/lazy';
import { Log } from "../common/log"

// declare var DATASTORE_URI: string;

interface AiaBlock extends Langs.Block {
  language: string
  assistant: AiAssistant | null
  code: Completion[]
  inputs: AiaInputs
  newFrame: string
}

type AiaExpandEvent = { kind:"expand", expanded:boolean }
type AiaCompletionsEvent = { kind:"completions" }
type AiaEvent = AiaExpandEvent | AiaCompletionsEvent 

type AiaInputs = { [input: string]: string }

type AiaState = { 
  id: number
  block: AiaBlock
  expanded: boolean
  assistants: AiAssistant[]
}

type Completion = {
  name: string
  path: string[]
}

function format(aiAssistant:AiAssistant | null, inputs:AiaInputs, newFrame:string, chain:Completion[]) {
  if (aiAssistant == null) return "";
  let ins = Object.keys(inputs).map(k => k + "=" + inputs[k]).join(",")
  var code = aiAssistant.name + ((ins != "") ? (":" + ins) : "") + "\n" + newFrame + "\n"
  for(var c of chain) {
    code += c.name + ":" + c.path.join("/") + "\n"
  }
  return code.substr(0, code.length-1)
}

/*
ai-assistant-name

ai-assistant-name:input1-name=frame1,input2-name=frame2
new-frame
member1:some/path
member2:some/path/more
member3:some/path/more/even
*/

function parse(code:string) : { assistant:string|null, chain:Completion[], inputs:AiaInputs, frame:string } {
  code = code.split("\r\n").join("\n")
  if (code == "") return { assistant: null, chain: [], inputs: {}, frame: "" }
  let lines = code.split('\n')
  let head = lines[0].split(':')  
  let frame = (lines.length > 1) ? lines[1] : ""
  let chain = lines.slice(2).map(line => { 
    let split = line.split(':')
    return { name:split[0], path:split[1].split('/') } })
  let inputs : AiaInputs = { }
  if (head.length > 1) {
    for(let inp of head[1].split(',')) {
      let kvp = inp.split('=')
      inputs[kvp[0]] = kvp[1]
    }
  }
  return { assistant: head[0], chain:chain, inputs:inputs, frame:frame };
}

async function getCompletions(root:string, inputs:AiaInputs, path:string[]) : Promise<Completion[]> {
  let url = root + "/completions/" + path.join("/")
  let header = Object.keys(inputs).map(k => k + "=" + inputs[k]).join(",")
  let response = await axios.get(url, {headers:{Inputs:header}});
  return response.data.map((r:any) =>
    ({ name: r.name, path:r.path.split("/").filter((p:string) => p != "") }));
}

async function getValue(blob:string, preview:boolean, datastoreURI:string) : Promise<any> {
  var pathname = new URL(blob).pathname;
  let headers = {'Accept': 'application/json'}
  let url = datastoreURI.concat(pathname)
  if (preview) url = url.concat("?nrow=10")
  Log.trace("external", "Fetching data frame: %s", url)
  let response = await axios.get(url, {headers: headers});
  Log.trace("external", "Got data frame (%s rows): %s", response.data.length, pathname)
  return response.data
}

async function getResult(root:string, hash:string, name:string, inputs:AiaInputs, path:string[], datastoreURI:string) : Promise<Values.DataFrame> {
  let url = root + "/data/" + hash + "/" + name + "/" + path.join("/")
  Log.trace("aiassistant","getResult DatastoreURI:%s", datastoreURI)
  Log.trace("aiassistant","getResult url:%s", url)
  let header = Object.keys(inputs).map(k => k + "=" + inputs[k]).join(",")
  Log.trace("aiassistant","getResult headers:%s", JSON.stringify(header))
  let response = await axios.get(url, {headers:{Inputs:header}});
  let frameUrl = response.data
  return { kind: "dataframe", url: frameUrl, 
      preview: await getValue(frameUrl, true, datastoreURI), 
      data: new AsyncLazy<any>(() => getValue(frameUrl,false, datastoreURI)) }
}
/*

async function mergeDataFrames(variableName:string, hash:string,
    vals:Values.KnownValue[]) : Promise<Values.DataFrame> {
  var allData : any[] = []
  for(let v of vals) {
    if (v.kind=='dataframe')
      allData = allData.concat(await v.data.getValue())
  }
  
  let lazyData = new AsyncLazy<any[]>(async () => allData)
  let preview = allData.slice(0, 100)

  let url = await putValue(variableName, hash, allData)
  return { kind: "dataframe", url: url, data: lazyData, preview: preview }
}
*/


let createAiaEditor = (assistants:AiAssistant[]) : Langs.Editor<AiaState, AiaEvent> => ({
  initialize: (id:number, block:Langs.Block) => {  
    let aiaBlock = <AiaBlock>block
    return { id: id, block: <AiaBlock>block, chain: [], expanded: false, assistants: assistants, inputs: {}, frame: "" }
  },
  update: (state:AiaState, event:AiaEvent) => {
    switch(event.kind) {
      case "completions":
        return state;
      case "expand": 
        return { ...state, expanded:event.expanded }
    }
  },

  render: (cell:Langs.BlockState, state:AiaState, ctx:Langs.EditorContext<AiaEvent>) => {
    let aiaNode = <AiaCodeNode>cell.code
  

    function triggerRemove() {
      let newCode = format(aiaNode.assistant, aiaNode.inputs, aiaNode.newFrame, aiaNode.chain.slice(0, aiaNode.chain.length-1))
      ctx.rebindSubsequent(cell, newCode);
      ctx.evaluate(cell.editor.id)
    }
    function triggerComplete(completion:Completion) {
      let newCode = format(aiaNode.assistant, aiaNode.inputs, aiaNode.newFrame, aiaNode.chain.concat(completion))
      ctx.rebindSubsequent(cell, newCode);
      ctx.evaluate(cell.editor.id)
    }
    function triggerAssistant(name:string|null, inputs:AiaInputs) {
      let ins = Object.keys(inputs).map(k => k + "=" + inputs[k]).join(",")
      ctx.rebindSubsequent(cell, name==null?"":(name + (ins != "" ? (":" + ins) : "") + "\n" + aiaNode.newFrame))
      if (name != null && Object.keys(inputs).length > 0) ctx.evaluate(cell.editor.id)
    }
    function triggerFrameName(name:string) {
      let newCode = format(aiaNode.assistant, aiaNode.inputs, name, aiaNode.chain)
      ctx.rebindSubsequent(cell, newCode);
      ctx.evaluate(cell.editor.id)
    }
    
    if (aiaNode.assistant == null || Object.keys(aiaNode.inputs).length != aiaNode.assistant.inputs.length) {
      return h('div', {class:'aia'}, [ h('ul', {}, state.assistants.map(as => {
        let dropdowns = as.inputs.map(inp => 
          h('div', {}, [ 
            h('span', {}, [ inp+": " ]), 
            h('select', 
              { onchange:(e) => {
                  let inps = { ...aiaNode.inputs }
                  if ((<any>e.target).value == "") delete inps[inp]
                  else inps[inp] = (<any>e.target).value
                  triggerAssistant(aiaNode.assistant == null?null:aiaNode.assistant.name, inps) 
              } }, 
              [""].concat(aiaNode.framesInScope).map(f =>
                h('option', aiaNode.inputs[inp] == f ? { key:f, value:f, selected:true } : { key:f, value:f }, 
                  [f==""?"(no frame selected)":f]) )) ])
        )
        let link = 
          (aiaNode.assistant != null && aiaNode.assistant.name == as.name) ? h('strong', {}, [ as.name ]) :
            h('strong', {}, [ h('a', { href: "javascript:;", onclick: () => triggerAssistant(as.name, {}) }, [ as.name ]) ])
        let tools = 
          (aiaNode.assistant != null && aiaNode.assistant.name == as.name) ? 
            [ h('div', {class:'tools'}, dropdowns) ] : []
        return h('li', {}, 
          [ link, " - ", as.description, h('br', {}, []) ].concat(tools))
      })) ])
    } else {
      var i = 0;
      let chain = 
        aiaNode.chain.map(item => {
          var body : any[] = [ item.name ]
          if (++i == aiaNode.chain.length) 
            body.push(h('button', { onclick:() => triggerRemove() }, [ h('i', { class:'fa fa-times'}) ]))
          return h('span', {key:'e'+i.toString(), class:'chain'}, body)
        })

      var plusBody = [ 
        h('button', {}, [ h('i', { class:'fa fa-plus'}) ]) 
      ];
      if (state.expanded) {
        if (aiaNode.completions) {
          plusBody.push(
            h('div', {class:'completion'}, 
              aiaNode.completions.map(compl =>
                h('a', {key:compl.name, class:'item', onclick:() => triggerComplete(compl) }, [ compl.name ])
              )
            ) );
        } else {          
          var path: string[] = []
          if (aiaNode.chain.length > 0) path = aiaNode.chain[aiaNode.chain.length-1].path;
          let allValues = Object.keys(aiaNode.inputNodes).reduce((b, n) => b && null != aiaNode.inputNodes[n].value, true)
          if (allValues) {
            var inputs : AiaInputs = {}
            for(let k of Object.keys(aiaNode.inputNodes)) inputs[k] = (<Values.DataFrame>aiaNode.inputNodes[k].value).url
            getCompletions(aiaNode.assistant.root, inputs, path).then(completions => {
              aiaNode.completions = completions;
              ctx.trigger({kind:"completions"})
            })
            plusBody.push(h('div', {class:'completion'}, [ h('span', {class:'item'}, [ "loading..." ]) ]));
          } else {
            console.log("evaluating...")
            plusBody.push(h('div', {class:'completion'}, [ h('span', {class:'item'}, [ "evaluating..." ]) ]));
          }
        }        
      }

      let plus = 
        h('div', {class:'plus', onclick:(e) => {
          e.cancelBubble = true
          ctx.evaluate(cell.editor.id)
          ctx.trigger({ kind:"expand", expanded:!state.expanded }) 
        } }, plusBody)

      let ins = Object.keys(aiaNode.inputs).map(k => k + ": " + aiaNode.inputs[k]).join(", ")
      let aiaBody: any[] = [ aiaNode.assistant.name + "(" + ins + ")" ]
      if (aiaNode.chain.length == 0)
        aiaBody.push(h('button', { onclick:() => triggerAssistant(null, {}) }, [ h('i', { class:'fa fa-times'}) ]))
      let aia = h('span', {key:'e', class:'chain'}, aiaBody)

      let def = 
        [ h('span', {class:'text'}, ["output"]),
          h('input', { value:aiaNode.newFrame, placeholder:'<name>', oninput: (e) => triggerFrameName((<any>e.target).value) }, []),
          h('span', {class:'text'}, [ " = " ]) ]

      let previewButton = h('button', 
        { class:'preview-button', onclick:() => { 
            Log.trace("editor", "Evaluate button clicked in external language plugin")
            ctx.evaluate(cell.editor.id) } }, ["Evaluate!"] )    
      let spinner = h('i', {class: 'fas fa-spinner fa-spin' }, [])
      let preview = h('div', {class:'preview'}, [
        (cell.code.value == undefined) ? (cell.evaluationState == 'pending') ? spinner : previewButton :
        (createOutputPreview(cell, () => {}, 0, <Values.ExportsValue>cell.code.value))]);

      return h('div', 
        { class:'aia',
          onclick:() => ctx.trigger({kind:"expand", expanded:false}) }, 
        [ h('div', { key:'body', class:'body' }, def.concat(aia,chain,plus)),
          preview ]);
    }
  }
})

interface AiaCodeNode extends Graph.Node {
  kind: 'code'
  chain: Completion[]
  assistant: AiAssistant | null
  completions: Completion[] | null
  framesInScope: string[]
  inputNodes: { [input:string]:Graph.Node }
  newFrame: string
  inputs: AiaInputs
}

interface AiaExportNode extends Graph.ExportNode {
  kind: 'export'
  aiaNode: AiaCodeNode
}

type AiaNode = AiaCodeNode | AiaExportNode

export interface AiAssistant {
  name: string
  description: string
  inputs: string[]
  root: string
}

export class AiaLanguagePlugin implements Langs.LanguagePlugin 
{
  readonly language: string = "ai assistant"
  readonly iconClassName: string = "fa fa-magic"
  readonly editor: Langs.Editor<Langs.EditorState, any>
  private readonly assistants:AiAssistant[];
  readonly datastoreURI: string;

  constructor (assistants:AiAssistant[], datastoreUri: string) {
    this.assistants = assistants
    this.editor = createAiaEditor(assistants)
    this.datastoreURI = datastoreUri
  }

  getDefaultCode(id:number) { 
    return ""
  }
  parse (code:string) : Langs.Block {
    let parsed = parse(code)
    var block: AiaBlock = { language: "ai assistant", code: [], assistant: null, inputs: {}, newFrame: "" }
    for(var a of this.assistants) 
      if (a.name == parsed.assistant) 
        block = { language: "ai assistant", code: parsed.chain, assistant: a, inputs:parsed.inputs, newFrame:parsed.frame }
    console.log("PARSED: ", code, parsed, block)
    return <Langs.Block>block
  }

  async bind(context: Langs.BindingContext, block: Langs.Block) : Promise<Langs.BindingResult> {
    let aiaBlock = <AiaBlock>block    

    let ants : Graph.Node[] = []
    let ins : {[input:string]:Graph.Node} = {}
    for(let k of Object.keys(aiaBlock.inputs)) {
      let nd = context.scope[aiaBlock.inputs[k]]
      ants.push(nd)
      ins[k] = nd;
    }

    let antsHash = Md5.hashStr(ants.map(a => a.hash).join("-"))
    let node:AiaCodeNode = 
      { kind: 'code',
        language: this.language, antecedents: ants,
        hash: <string>Md5.hashStr(antsHash + this.save(block)),
        chain: aiaBlock.code,
        assistant: aiaBlock.assistant,
        completions: null,
        inputs: aiaBlock.inputs,
        inputNodes: ins,
        framesInScope: Object.keys(context.scope),
        newFrame: aiaBlock.newFrame,
        value: null, errors: [] }
    
    var exps : AiaExportNode[] = []
    if (aiaBlock.newFrame != "") {
      let exp: AiaExportNode = 
        { kind: 'export',
          language: this.language, antecedents: [node],
          hash: <string>Md5.hashStr(antsHash + aiaBlock.newFrame + this.save(block)),
          aiaNode: node, variableName: aiaBlock.newFrame,
          value: null, errors: [] }
      exps.push(exp);
    }

    return { code: node, exports: exps, resources: [] };
  }

  async evaluate(context:Langs.EvaluationContext, node:Graph.Node) : Promise<Langs.EvaluationResult> {
    let aiaNode = <AiaNode>node
    switch(aiaNode.kind) {
      case 'code':
        let res : { [key:string]: Values.KnownValue } = {}
        let newFrame = aiaNode.newFrame == "" ? "<name>" : aiaNode.newFrame; 
        if (aiaNode.assistant != null) {
          let path = aiaNode.chain.length > 0 ? aiaNode.chain[aiaNode.chain.length-1].path : []
          var inputs : AiaInputs = {}
          for(let k of Object.keys(aiaNode.inputNodes)) inputs[k] = (<Values.DataFrame>aiaNode.inputNodes[k].value).url
          Log.trace("aiassistant","evaluate DatastoreURI:%s", this.datastoreURI)
          let merged = await getResult(aiaNode.assistant.root, aiaNode.hash, newFrame, inputs, path, this.datastoreURI)
          res[newFrame] = merged
        }
        let exps : Values.ExportsValue = { kind:"exports", exports: res }
        return { kind: "success", value: exps }
      case 'export':
        let expsVal = <Values.ExportsValue>aiaNode.aiaNode.value
        return { kind: "success", value: expsVal.exports[aiaNode.aiaNode.newFrame] }
    }
  }

  save(block:Langs.Block) {
    let aiaBlock = <AiaBlock>block
    return format(aiaBlock.assistant, aiaBlock.inputs, aiaBlock.newFrame, aiaBlock.code)
  }
}

export async function createAiaPlugin(url:string, datastoreURI:string) : Promise<AiaLanguagePlugin> {
  let response = await axios.get(url);
  let aia : AiAssistant[] = response.data; 
  for(var i = 0; i< aia.length; i++) aia[i].root = url + "/" + aia[i].root;
  Log.trace("aiassistant","createAiaPlugin DatastoreURI:%s", datastoreURI)
  return new AiaLanguagePlugin(aia, datastoreURI);
}