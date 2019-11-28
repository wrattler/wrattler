import { VNode, h } from "maquette"
import * as monaco from "monaco-editor"
import { Md5 } from "ts-md5"
import { Env, Eval, Expr, bindDataset, emptyEnv, parseWithImports } from "@rolyp/fluid"
import { assert } from "../common/log"
import * as Graph from "../definitions/graph"
import * as Langs from "../definitions/languages"
import * as Values from '../definitions/values'
import { createMonacoEditor } from "../editors/editor"

// Plugin for Fluid, language for explorable data visualisations.
// https://www.npmjs.com/package/@rolyp/fluid

const fluid: string = "fluid"

/**
 * Eschew the -Kind convention for now.
 */
class FluidBlock implements Langs.Block {
   language: string = fluid
   source: string // needed to compute the hash?
   e: Expr | null

   constructor (source: string) {
      this.source = source
      try {
         this.e = parseWithImports(source, [])
      } 
      catch (ex) {
         console.log(ex)
         this.e = null
      }
   }
}

class FluidState implements Langs.EditorState {
   id: number
   block: FluidBlock
}

class FluidEvent { 
}

class FluidNode implements Graph.Node {
   language: string
   block: FluidBlock
   antecedents: Graph.Node[]
   value: Values.Value | null
   hash: string
   errors: Error[]

   constructor (block: FluidBlock, antecedents: Graph.Node[]) {
      this.language = fluid
      this.block = block
      this.antecedents = antecedents
      this.value = null
      this.hash = Md5.hashStr(block.source) as string // from markdown.ts - revisit?
      this.errors = []
   }
}

// Help TypeScript with mess that is IMonarchLanguageRule.
function rules (rs: monaco.languages.IMonarchLanguageRule[]): monaco.languages.IMonarchLanguageRule[] {
   return rs
}

// Based on example at https://microsoft.github.io/monaco-editor/monarch.html.
// TODO: make consistent with actual lexical grammar.
class FluidTokensProvider implements monaco.languages.IMonarchLanguage {
   keywords = ["_", "as", "match", "fun", "in", "let", "letrec", "primitive", "typematch"]
   operators = ["-", "++", "+", "**", "*", "/", "===", "==", "<==", "<=", "<", ">==", ">=", ">"]
   symbols = /[=><!~?:&|+\-*\/\^%]+/
   // C# style strings
   // escapes = /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/
   tokenizer = {
      root: rules([
         // identifiers and keywords
         [/[a-zA-Z_][0-9a-zA-Z_]*'*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
         // [/[a-z_$][\w$]*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
         // [/[A-Z][\w\$]*/, "type.identifier"],
         // whitespace
         { include: "@whitespace" },
         // delimiters and operators
         [/[{}()\[\]]/, "@brackets"],
         [/[<>](?!@symbols)/, "@brackets"],
         [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
         // numbers
         // [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
         // [/0[xX][0-9a-fA-F]+/, "number.hex"],
         // [/\d+/, "number"],
         [/\-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[e|E][-|+]?[0-9]+)?/, "number"],
         // delimiter: after number because of .\d floats
         // [/[;,.]/, "delimiter"],
         // strings
         // [/"([^"\\]|\\.)*$/, "string.invalid"], // non-terminated string
         [/"(?:\\["\\]|[^\n"\\])*"/, "string"],
         // [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
         // characters
         // [/'[^\\']'/, "string"],
         // [/(')(@escapes)(')/, ["string", "string.escape", "string"]],
         // [/'/, "string.invalid"]
      ]),
      comment: rules([
         [/[^\/*]+/, "comment"],
         [/\/\*/, "comment", "@push"], // nested comment
         [/\*\//, "comment", "@pop"],
         [/[\/*]/, "comment"]
      ]),
      // string: rules([
      //   [/[^\\"]+/, "string"],
      //   [/@escapes/, "string.escape"],
      //   [/\\./, "string.escape.invalid"],
      //   [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }]
      // ]),
      whitespace: rules([
         [/[ \f\t\r\n]+/, "white"],
         [/\/\*/, "comment", "@comment"],
         [/\/\/.*$/, "comment"],
      ])
   }
   ignoreCase = false
   defaultToken = "invalid"
}

// "Static" side-effects like this probably best avoided.
monaco.languages.register({ id: fluid })
monaco.languages.setMonarchTokensProvider(fluid, new FluidTokensProvider())

class FluidEditor implements Langs.Editor<FluidState, FluidEvent> {
   initialize (id:number, block: Langs.Block): FluidState {
      if (block instanceof FluidBlock) {
         return { id, block } 
      } else {
         return assert(false)
      }
   }

   update (state: FluidState, event: FluidEvent): FluidState {
      return state
   }

   render (cell: Langs.BlockState, state: FluidState, context: Langs.EditorContext<FluidEvent>): VNode {
      const code: VNode = createMonacoEditor(fluid, state.block.source, cell, context),
            previewButton: VNode = h("button", { 
               class: "preview-button", 
               onclick: () => {
                  context.evaluate(cell.editor.id) 
               } 
            }, ["Evaluate!"]),
            // TODO: see other plugs for additional behaviours..
            preview: VNode = h('div', { class: "preview" }, [previewButton])
      return h("div", {}, [code, preview])
   }
}

export const fluidLanguagePlugin: Langs.LanguagePlugin = {
   language: fluid,
   iconClassName: "fa fa-chart-area",
   editor: new FluidEditor(),

   getDefaultCode (id: number): string {
      return ""
   },

   parse (code: string): FluidBlock {
      return new FluidBlock(code)
   },

   async bind (context: Langs.BindingContext, block: Langs.Block): Promise<Langs.BindingResult> {
      console.log(context.scope)
      if (block instanceof FluidBlock) {
         let antecedents: Graph.Node[]
         if (block.e === null) {
            antecedents = []
         } else {
            const ys: Set<string> = Expr.freeVars(block.e),
                  xs: string[] = Object.keys(context.scope).filter(x => (ys as any).has(x)) // ES6 dynamic, ES5 static :-o
            antecedents = xs.map(x => context.scope[x])
         }
         return {
            code: new FluidNode(block, antecedents),
            exports: [],
            resources: []
         }
      } else {
         return assert(false)
      }
   },

   async evaluate (context: Langs.EvaluationContext, node: Graph.Node): Promise<Langs.EvaluationResult> {
      if (node instanceof FluidNode) {
         console.log(node)
         const imports: [string, Values.DataFrame][] = (node.antecedents
            // invariant - only depend on exported nodes:   
            .filter(isExportNode)                          
            // exported values are known and non-null 
            .map(node => [node.variableName, node.value as Values.KnownValue])
            .filter(([x, v]: [string, Values.KnownValue]) => v.kind === "dataframe")) as [string, Values.DataFrame][]
         let ρ: Env = emptyEnv()
         for (let [x, { data }] of imports) {
            ρ = bindDataset(ρ, await data.getValue(), x) // data is any[] but assume Object[]
         }
         console.log(Eval.eval_(ρ, node.block.e!))
         return { kind: "success", value: { kind: "nothing" } }
      } else {
         return assert(false)
      }
   },

   save (block: Langs.Block): string {
      if (block instanceof FluidBlock) {
         return block.source
      } else {
         return assert(false)
      }
   }
}

// Dynamic type check.
function isExportNode (node: Graph.Node): node is Graph.ExportNode {
   return (node as Graph.ExportNode).variableName !== undefined
}
