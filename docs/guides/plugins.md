---
layout: default
title: Creating custom language plugins
---

# Creating custom language plugins

Wrattler is a polyglot notebook system that can be easily extended to support
new programming languages and data exploration and analysis tools. Wrattler
is browser-first, meaning that it does as much work as possible in the web
browser. If you use Python or R, Wrattler needs to call an external service
to run your code, but if you use JavaScript (and other browser-only components),
then Wrattler can run fully in the web browser.

In this tutorial, we look at building browser-based plugin for Wrattler. We
will implement a simple Wrattler extension that defines a new kind of notebook
cells with custom (HTML) user interface. The extension does not do anything
useful. It lets you concatenate one or more data frames defined earlier and
export the result as a new data frame. However, it illustrates many of the
aspects of Wrattler.

The following shows our new Wrattler cell, letting the user choose from
existing frames `one`, `two` and `three`, and specifying new name for the
resulting data frame.

<img src="plugins/step3.png" class="screenshot">

The technique described in this tutorial is suitable if:

- You have a programming language that runs fully in the browser, or
  if you want more control over how an external service is called to
  evaluate code.
- If you want to create your own user interface, rather than just use
  a standard code editor with tabs showing previews of evaluated
  data frames and figures.  
- If you are writing custom tool that is not a programming language
  in the usual sense, but is something more interactive that requires
  more control over how the cell works and looks.

If, instead, you want to add a support for a programming language that runs
on the server, like Python or R, and you want to reuse standard look of Wrattler
cells, then you probably want to [create an external language runtime
services](external.html)

## Step 1: Setting up the scene

In the first step, we'll create a plugin that adds a new kind of cells. When
you add a cell using this plugin (or language), it will just display
`"Hello from merger!"`, but it will not do any data processing. I call the
tool "Merger" because it lets you merge data frames.

### Building Wrattler and adding a new file

For simplicity, we assume that the work is done by directly editing the
main [Wrattler repository](http://github.com/wrattler/wrattler). For
instructions on how to build and modify that, see the [development notes
guide](development.html). Now, the next step is to add a new TypeScript
source file. The source code for the Wrattler web components is located
in the `client` folder. There, you can find existing language plugins in
`src/languages`. In this tutorial, we put the implementation of our plugin
in `src/demo/merger.ts`.

To start, we will need to import [Maquette](https://maquettejs.org/), which
is a virtual DOM library that Wrattler uses for user interface, `Md5` function
for hashing and three other components of Wrattler:

```typescript
import * as Langs from '../definitions/languages';
import * as Graph from '../definitions/graph';
import * as Values from '../definitions/values';
import { h } from 'maquette';
import { Md5 } from 'ts-md5';
```

The three Wrattler components we are importing are described in the API documentation:

 - [Languages module](../api/modules/languages.html) defines API for creating language plugins
 - [Graph module](../api/modules/graph.html) provides types for working with the dependency graph
 - [Values module](../api/modules/values.html) contains types used when evaluating notebook cells

### Creating simple cell editor

Wrattler uses the [Elm architecture](https://guide.elm-lang.org/architecture/)
for implementing its user interface. If you are creating a plugin that defines
a custom user interface, then you'll also need to use this approach in your
language plugin. Wrattler provides a couple of functions to make this easier,
so you do not have to implement the whole user interface from scratch. We
will look at those in Step 4.

In the Elm architecture, you need to define type representing _state_ and a
type representing _events_ that can happen in the application. You then
define two functions:

- `render` takes the current state and renders the user interface using
  a virtual DOM library.
- `update` takes the current state, event that occurred and calculates the
  new state.

When implementing language plugin, your state type needs to implement the
[`EditorState`](../api/interfaces/languages.editorstate.html) interface
and store unique `id` of the cell together with a `Block` object, so a
state with no extra features and empty event type look as follows:

```typescript
type MergerEvent = { }

type MergerState = {
  id: number
  block: Langs.Block
}
```

An editor then needs to implement the [`Editor`](../api/interfaces/languages.editor.html)
interface. In the following, the `update` function returns the original state; the 
`render` function returns constant HTML and we also need to add an `initalize` function
that takes the required parameters and stores them in our `MergerState`:


```typescript
const mergerEditor : Langs.Editor<MergerState, MergerEvent> = {
  initialize: (id:number, block:Langs.Block) =>
    { id: id, block: block },
  update: (state:MergerState, event:MergerEvent) =>
    state,
  render: (cell:Langs.BlockState, state:MergerState,
           context:Langs.EditorContext<MergerEvent>) =>
    h('div', {}, [ h('h3', {}, [ "Hello from merger!"] ) ])
}
```

Wrattler calls the `render` function with a few extra parameters. In additioon 
to the `MergerState` value, we also get state of the cell of type
[`BlockState`](../api/interfaces/languages.blockstate.html), which links the 
cell to the dependency graph and [`EditorContext`](../api/interfaces/languages.editorcontext.html),
which lets you trigger both local and global events. We will need thse later.

### Implementing the language plugin interface

Finally, the main interface that each language plugin needs to implement
is the [`LangaugePlugin`](../api/interfaces/languages.languageplugin.html)
interface. You can find detailed explanation of the individual attributes and
methods in the [API documentation](../api/interfaces/languages.languageplugin.html).
Briefly, the `parse` and `save` methods turn source code into a `Block` value
and vice versa; the `bind` operation constructs depenendecy graph for the cell
and `evaluate` evaluates nodes in the dependnecy graph.

In our trivial example, we don't have any source code, so `parse` returns a 
`Block` object with just the (required) `language` field and `save` returns empty
string. For `bind` and `evaluate`, we have to do a little bit of work though:

```typescript
export const mergerLanguagePlugin : Langs.LanguagePlugin = {
  language: "merger",
  iconClassName: "fa fa-object-group",
  editor: mergerEditor,
  getDefaultCode: (id:number) => "",

  parse: (code:string) => { langauge: "merger" },
  save: (block:Langs.Block) => "",

  bind: async (context: Langs.BindingContext, block: Langs.Block) :
      Promise<Langs.BindingResult> => {
    let node:Graph.Node =
      { language: "merger",
        antecedents: [], hash: <string>Md5.hashStr("todo"),
        value: null, errors: [] }
    return { code: node, exports: [], resources: [] };
  },

  evaluate: async (context:Langs.EvaluationContext, node:Graph.Node) :
      Promise<Langs.EvaluationResult> => {
    return { kind: "success", value: { kind: "nothing" } };
  }
}
```

The `bind` operation creates a new [`Node`](../api/interfaces/graph.node.html),
i.e. a graph node for the dependency graph. This needs to include a couple of
required fields: `antecedents` is an array of other nodes that this one depends
on; `value` is the value or `null` if we have not yet evalauted the code of this
node, `errors` can be used for error reporting and `hash` should be a unique
hash calculated from the source code, so that changing the source code changes
the hash.

### Registering our plugin with Wrattler

As mentioned earlier, this tutorial assumes that you are directly modifying the 
Wrattler source code. If you were creating Wrattler instance using the exposed
[`Wrattler`](../api/classes/main.wrattler.html) class, then you could add the 
plugin to the [`LanguagePlugins`](../api/modules/main.html#languageplugins)
dictionary before calling `createNotebook`. However, if we're modifying the source
directly, the easiest option is to modify the `getDefaultLanguages` function in 
the `src/wrattler.ts` file. You need to import the `merger.ts` file:

```typescript
import { mergerLanguagePlugin } from './demo/merger'
```

Then, you need to add `merger` as one of the languages returned by 
`getDefaultLanguages`:

```typescript
getDefaultLanguages() : LanguagePlugins {
  // (other configuration omitted)
  languagePlugins["merger"] = mergerLanguagePlugin;
  return languagePlugins;
}
```

If you follow the above steps, you should be able to see "merger" as one of the
options when you click the "add below" button to add a new cell. After adding a 
new "merger" cell, you should see something along the following lines.

<img src="plugins/step1.png" class="screenshot">

## Step 2: Choosing variables in scope


### Some definitions

```typescript
interface MergerBlock extends Langs.Block {
  language : string
  output: string
  inputs: string[]
}

interface MergerCodeNode extends Graph.Node {
  kind: 'code'
  framesInScope: string[]
  output: string
  inputs: string[]
}
```

### Editor

```typescript
type MergerCheckEvent = { kind:'check', frame:string, selected:boolean }
type MergerNameEvent = { kind:'name', name:string }
type MergerEvent = MergerCheckEvent | MergerNameEvent

type MergerState = {
  id: number
  block: MergerBlock
  selected: { [frame:string] : boolean }
  newName: string
}
```

more

```typescript
const mergerEditor : Langs.Editor<MergerState, MergerEvent> = {
  initialize: (id:number, block:Langs.Block) => {  
    let mergerBlock = <MergerBlock>block
    var selected = { }
    for (let s of mergerBlock.inputs) selected[s] = true;
    return { id: id, block: <MergerBlock>block,
      selected:selected, newName:mergerBlock.output }
  },

  update: (state:MergerState, event:MergerEvent) => {
    switch(event.kind) {
      case 'check':
        var newSelected = { ...state.selected }
        newSelected[event.frame] = event.selected
        return {...state, selected:newSelected}
      case 'name':
        return {...state, newName:event.name}
    }
  },

  render: (cell:Langs.BlockState, state:MergerState,
      context:Langs.EditorContext<MergerEvent>) => {
    let mergerNode = <MergerCodeNode>cell.code
    let source = state.newName + "=" +
      Object.keys(state.selected).filter(s => state.selected[s]).join(",")
    return h('div', {}, [
      h('p', {key:"p0"},
        [ "Choose data frames that you want to merge:"] ),
      h('ul', {}, mergerNode.framesInScope.map(f =>
        h('li', { key:f }, [
          h('input',
            { id: "ch" + state.id + f, type: 'checkbox',
              checked: state.selected[f] ? true : false,
              onchange: (e) => {
                let chk = (<any>e.target).checked
                let evt = { kind:'check', frame:f, selected: chk }
                context.trigger(evt)
            }}, []),
          " ",
          h('label', {for: "ch" + state.id + f}, [ f ])
        ])
      )),

      h('p', {key:"p1"},
        ["Specify the name for the new merged data frame:"]),
      h('p', {key:"p2"}, [
        h('input', {key:'i1', type: 'text', value: state.newName, oninput: (e) =>
          context.trigger({ kind:'name', name:(<any>e.target).value }) }, []),
        h('input', {key:'i2', type: 'button', value: 'Rebind', onclick: () =>
          context.rebindSubsequent(cell, source) }, []),
        ( cell.code.value ? "" :
          h('input', {key:'i3', type: 'button', value: 'Evaluate', onclick: () =>
            context.evaluate(cell) }, []) )            
      ])
    ])
  }
}
```

### Bidning

```typescript
export const mergerLanguagePlugin : Langs.LanguagePlugin = {
  language: "merger",
  iconClassName: "fa fa-object-group",
  editor: mergerEditor,
  getDefaultCode: (id:number) => "",

  parse: (code:string) : MergerBlock => {
    let [outName, inputs] = code.split('=')
    return { language: "merger", output: outName,
      inputs: inputs?inputs.split(','):[] }
  },

  save: (block:Langs.Block) => {
    let mergerBlock = <MergerBlock>block
    return mergerBlock.output + "=" + mergerBlock.inputs.join(",")
  },

  bind: async (context: Langs.BindingContext, block: Langs.Block) :
      Promise<Langs.BindingResult> => {
    let mergerBlock = <MergerBlock>block    
    let ml = mergerLanguagePlugin

    let ants = mergerBlock.inputs.map(inp => context.scope[inp])
    let node:MergerNode =
      { kind: 'code',
        language: ml.language, antecedents: ants,
        hash: <string>Md5.hashStr(JSON.stringify(ml.save(block))),
        output: mergerBlock.output, inputs: mergerBlock.inputs,
        value: null, errors: [],
        framesInScope: Object.keys(context.scope) }

    return { code: node, exports: [], resources: [] };
  },

  evaluate: async (context:Langs.EvaluationContext, node:Graph.Node) :
      Promise<Langs.EvaluationResult> => {
    return { kind: "success", value: { kind: "nothing" } };
  },
}
```

<img src="plugins/step2.png" class="screenshot">

## Step 3: Dependency graph

```typescript
interface MergerCodeNode extends Graph.Node {
  kind: 'code'
  framesInScope: string[]
  output: string
  inputs: string[]
}

interface MergerExportNode extends Graph.ExportNode {
  kind: 'export'
  mergerNode: MergerCodeNode
}

type MergerNode = MergerCodeNode | MergerExportNode
```

bidning

```typescript
bind: async (context: Langs.BindingContext, block: Langs.Block) :
    Promise<Langs.BindingResult> => {
  let mergerBlock = <MergerBlock>block    
  let ml = mergerLanguagePlugin

  let ants = mergerBlock.inputs.map(inp => context.scope[inp])
  let node:MergerNode =
    { kind: 'code',
      language: ml.language, antecedents: ants,
      hash: <string>Md5.hashStr(JSON.stringify(ml.save(block))),
      output: mergerBlock.output, inputs: mergerBlock.inputs,
      value: null, errors: [],
      framesInScope: Object.keys(context.scope) }

  var exps : MergerExportNode[] = []
  if (mergerBlock.output != "" && mergerBlock.inputs.length > 0) {
    let exp: MergerExportNode =
      { kind: 'export',
        language: ml.language, antecedents: [node],
        hash: <string>Md5.hashStr(JSON.stringify(ml.save(block))),
        variableName: mergerBlock.output,
        mergerNode: node,
        value: null, errors: [] }
    exps.push(exp);
  }

  return { code: node, exports: exps, resources: [] };
},
```

eval

```typescript
declare var DATASTORE_URI: string;
import axios from 'axios';

async function putValue(variableName:string, hash:string, value:any[]) : Promise<string> {
  let url = DATASTORE_URI.concat("/" + hash).concat("/" + variableName)
  let headers = {'Content-Type': 'application/json'}
  await axios.put(url, value, {headers: headers});
  return url
}

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
```

```typescript
evaluate: async (context:Langs.EvaluationContext, node:Graph.Node) : Promise<Langs.EvaluationResult> => {
  let mergerNode = <MergerNode>node
  switch(mergerNode.kind) {
    case 'code':
      let vals = mergerNode.antecedents.map(n => <Values.KnownValue>n.value)
      let merged = await mergeDataFrames(mergerNode.output, mergerNode.hash, vals)      
      let res : { [key:string]: Values.KnownValue }= {}
      res[mergerNode.output] = merged
      let exps : Values.ExportsValue = { kind:"exports", exports: res }
      return { kind: "success", value: exps }
    case 'export':
      let expsVal = <Values.ExportsValue>mergerNode.mergerNode.value
      return { kind: "success", value: expsVal.exports[mergerNode.mergerNode.output] }
  }
}
```

<img src="plugins/step3.png" class="screenshot">

## Step 4

```typescript
render: (cell:Langs.BlockState, state:MergerState, context:Langs.EditorContext<MergerEvent>) => {
  let mergerNode = <MergerCodeNode>cell.code
  let source = state.newName + "=" +
    Object.keys(state.selected).filter(s => state.selected[s]).join(",")
  let evalButton = h('button', { class:'preview-button', onclick:() => context.evaluate(cell) }, ["Evaluate"])
  return h('div', {}, [
    h('div', {key:'ed'}, [ Editor.createMonacoEditor("merger", source, cell, context) ]),
    h('div', {key:'prev'}, [
      (cell.code.value == null) ? evalButton :
        Editor.createOutputPreview(cell, (_) => { }, 0, <Values.ExportsValue>cell.code.value)
    ])
  ]);
}
```

<img src="plugins/step4.png" class="screenshot">
