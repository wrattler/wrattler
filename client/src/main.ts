import { fsHello } from "./demos/fsdemo";
import { jsHello } from "./demos/jsdemo";
import { tsHello } from "./demos/tsdemo";

fsHello();
jsHello();
tsHello();

// Rename things to make them sensible named
// Interface for 'editor'
// Implementation for 'editor' that does Markdown editing
// Main code that creates two markdown blocks/cells

// We have some source code with langauge and some text,
// 1. We get language plugin based on the language, call it to parse the text. 
//    It gives us back BlockKind with `Language` set to the right language
// 2. We collect all `BlockKind` objects into a list of blocks
// 3. To render everything, we iterate over all `BlockKind`s we collected,
//    we get their language, we use that to find `LanguagePlugin` and we
//    ask language plugin to create an editor for us.
