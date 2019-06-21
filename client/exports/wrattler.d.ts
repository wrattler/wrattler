import * as Langs from './definitions/languages';
import { ExternalLanguagePlugin } from './languages/external';
/**
 * Represents a created Wrattler notebook. The interface provides access to the
 * notebook contents. You can obtain the current contents and get notified when
 * it changes.
 */
interface WrattlerNotebook {
    /** Returns the current contents of a notebook as one Markdown string. */
    getDocumentContent(): string;
    /** Registers a handler which will be triggered whenever the contents of a notebook changes. */
    addDocumentContentChanged(handler: (newContent: string) => void): void;
}
/**
 * A dictionary that associates a language plugin with a language name.
 */
declare type LanguagePlugins = {
    [lang: string]: Langs.LanguagePlugin;
};
/**
 * Main entry point that can be used for creating new Wrattler notebook instances.
 * You can use `getDefaultLanguages` to get default language plugins implemented
 * in core Wrattler and `createNotebook` to create a new notebook instance.
 */
declare class Wrattler {
    /** Creates a new `LanguagePlugin` instance which delegates binding and evaluation
     * to a specified langauge service. You can pass the returned `LanguagePlugin` to
     * the `createNotebook` function to get a notebook supporting this langauge.  */
    createExternalLanguagePlugin(language: any, serviceUrl: string, faClass?: string, defaultCode?: string): ExternalLanguagePlugin;
    /** Returns default language plugins for Markdown, JavaScript, R, Python and Racket   */
    getDefaultLanguages(): LanguagePlugins;
    /**
     * Creates a Wrattler notebook that loads notebooks automatically by requesting the `index.md`
     * URL from the domain where it is hosted (or `another.md` when the current URl contains `?another` in the query string).
     */
    createNamedNotebook(elementID: string, languagePlugins: LanguagePlugins): Promise<WrattlerNotebook>;
    /**
     * Given initial Markdown source code and a dictionary with langauge plugins,
     * create a new instance of Wrattler and render it in a given HTML document element.
     *
     * @param elementID HTML document element to be used for rendering the notebook.
     * @param content Initial source code for the notebook in Markdown.
     * @param languagePlugins Language plugins to be used, typically the result of `getDefaultLanguages`
     */
    createNotebook(elementID: string, content: string, languagePlugins: LanguagePlugins): Promise<WrattlerNotebook>;
}
export { Wrattler, LanguagePlugins, WrattlerNotebook };
