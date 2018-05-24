// Demos showing how to import files from different languages
// (we will need this later, but for now, this is just a demo)
import { fsHello } from "./demos/fsdemo";
import { jsHello } from "./demos/jsdemo";
import { tsHello } from "./demos/tsdemo";
import * as monaco from 'monaco-editor';
import $ from 'jquery';
import {h} from 'maquette';
import {createProjector} from 'maquette';


fsHello();
jsHello();
tsHello();

var el = $('#paper')[0];



// monaco.editor.create(el, {
//   value: "function hello() {\n\talert('Hello Tomas!');\n}",
//   language: 'javascript'
// });

// Import interfaces related to language plugins and editors
// (these are TypeScript interfaces defined in `languages.ts`)
import * as Langs from './languages';

// We define a new class for `MarkdownBlockKind` because we
// later need to cast `BlockKind` to `MarkdownBlockKind` so that
// we can access Markdown-specific properties from editor,
// type checker, etc. (using <MarkdownBlockKind>block)

class MarkdownBlockKind implements Langs.BlockKind {
  language : string;
  source : string;
  constructor(source:string) {
    this.language = "markdown";
    this.source = source;
  }
}

// For the editor and language plugin, we do not need a dedicated
// class, because we just need to create some implementation of 
// an interface - and TypeScript lets us do this using a simple 
// JavaScript record expression - to this is much simpler than a class.

const markdownEditor : Langs.Editor = {
  create: (id:string, block:Langs.BlockKind) => {
    let markdownBlock = <MarkdownBlockKind>block;
    // console.log("#"+id);
    // console.log($("#"+id));
    // var ce = monaco.editor.create($("#"+id)[0], {
    //   value: markdownBlock.source,
    //   language: 'markdown'
    // });
    return h('div', [
      h('input', {
        type: 'text', placeholder: 'What is your name?',
        value: yourName, oninput: handleNameInput
      }),
      h('p.output', ['Hello ' + (yourName || 'you') + '!'])
    ]);
    // console.log(ce['id']);  
    // console.log(ce)  
  }
}

const markdownLanguagePlugin : Langs.LanguagePlugin = {
  language: "markdown",
  editor: markdownEditor,
  parse: (code:string) => {
    return new MarkdownBlockKind(code);
  }
}

// Wrattler will have a number of language plugins for different
// languages (including R, Python, TheGamma and Markdown). Probably
// something like this, except that we might need a dictionary or
// a lookup table (so that we can find language plugin for a given
// language quickly):

// fill in language plugins dictionary here eg.
var languagePlugins : { [language: string]: Langs.LanguagePlugin; } = { };
languagePlugins["markdown"] = markdownLanguagePlugin;
console.log(languagePlugins['markdown']);

// A sample document is just an array of records with cells. Each 
// cell has a language and source code (here, just Markdown):
let documents = 
  [ {"language": "markdown", 
     "source": "# Testing\nThis is *some* `markdown`!"}, 
    {"language": "markdown", 
     "source": "## More testing\nThis is _some more_ `markdown`!"},
    {"language": "markdowns", 
     "source": "## And more testing\nThis is _not_ `markdown`!"}, ]

// Now, to render the document initially, we need to:
//
// 1. Iterate over the cells defined in `document`. For each cell, we
//    get the appropriate `LanguagePlugin` and call its `parse` function
//    to parse the source code. This gives us a list of `BlockKind` values
//    (with `language` set to the right language)

var yourName = '';

function handleNameInput(evt) {
  yourName = evt.target.value;
  console.log(yourName);
}

function renderMaquette() {
  return h('div', [
    h('input', { 
      type: 'text', placeholder: 'What is your name?', 
      value: yourName, oninput: handleNameInput 
    }),
    h('p.output', [
      'Hello ' + (yourName || 'you') + '!'
    ])
  ]);
 };

 createProjector().append(document.body, renderMaquette);

// let index = 0;
// for (let cell of documents) {
//   var language = cell['language'];
//   if (languagePlugins[language] == null)
//     console.log("No language plugins for "+language);
//   else 
//   {
//     // console.log("Language plugin for " + language + " is " + languagePlugins[language].language);
//     let editorId = "editor_"+index;
//     $('#paper').append("<div id=\""+editorId+"\" style=\"height:100px;\"></div>")
//     let languagePlugin = languagePlugins[language];
//     let block = languagePlugin.parse(cell['source'])
//     languagePlugin.editor.create(editorId, block);
//     index++;
//   }
// }

// let index = 0;
// for (let cell of documents) {
//   var language = cell['language'];
//   if (languagePlugins[language] == null)
//     console.log("No language plugins for "+language);
//   else 
//   {
//     // console.log("Language plugin for " + language + " is " + languagePlugins[language].language);
//     let editorId = "editor_"+index;
//     $('#paper').append("<div id=\""+editorId+"\" style=\"height:100px;\"></div>")
//     let languagePlugin = languagePlugins[language];
//     let block = languagePlugin.parse(cell['source'])
//     languagePlugin.editor.create(editorId, block);
//     index++;
//   }
// }

// 2. We collect an array of `BlockKind` objects - these represent the
//    parsed cells that we can then render (and later, type check, etc.)
//
// 3. To render everything, we iterate over our collection of `BlockKind`
//    objects. For each, we look at its language, get the appropriate 
//    `LanguagePlugin` - this gives us an `editor` that we can then use to
//    render the block.
//
// Ideally, we should be able to use the infrastructure we have here to 
// parse the Markdown in the above `document` (using some good JavaScript 
// Markdown parser - I used one in the prototype but it was not very good),
// render the produced HTML and allow people to edit that using Monaco.
//
// The `create` function of the `Editor` interface now takes an ID
// (the idea is that in the main loop, we will create DIV element for
// each block and pass its ID to the editor so that it can do whatever
// it wants with it - either using VirtualDom, or directly).
//
// Right now, `create` takes the ID and the `BlockKind`. `BlockKind` is
// just an interface, so for Markdown, this will be some concrete Markdown
// implementation that will also store the parsed Markdown in some way.
// When `create` is called, it can assume that it gets Markdown-specific
// `BlockKind` and it can access the parsed document (after some type cast).
//
// Eventually, we will need to make `create` a bit more complex, so that
// the editor can notify the main code about changes in the source code, 
// but we can ignore that for now.

