import * as Langs from './definitions/languages';
import * as Docs from './services/documentService';
declare function initializeCells(elementID: string, counter: number, editors: Langs.EditorState[], languagePlugins: Langs.LanguagePlugins, resourceServerUrl: string, contentChanged: (newContent: string) => void): Promise<void>;
declare function loadNotebook(documents: Docs.DocumentElement[], languagePlugins: Langs.LanguagePlugins): {
    counter: number;
    editors: Langs.EditorState[];
};
export { loadNotebook, initializeCells };
