import * as Langs from './definitions/languages';
import * as Docs from './services/documentService';
declare type LanguagePlugins = {
    [lang: string]: Langs.LanguagePlugin;
};
declare function initializeCells(elementID: string, counter: number, editors: Langs.EditorState[], languagePlugins: LanguagePlugins, resourceServerUrl: string, contentChanged: (newContent: string) => void): Promise<void>;
declare function loadNotebook(documents: Docs.DocumentElement[], languagePlugins: LanguagePlugins): {
    counter: number;
    editors: Langs.EditorState[];
};
export { LanguagePlugins, loadNotebook, initializeCells };
