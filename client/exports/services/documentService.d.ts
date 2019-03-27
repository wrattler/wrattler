import * as State from '../definitions/state';
interface DocumentElement {
    language: string;
    source: string;
}
declare function getDocument(paragraph: string): Promise<DocumentElement[]>;
declare function getNamedDocument(): Promise<DocumentElement[]>;
declare function saveDocument(state: State.NotebookState): string;
export { getDocument, getNamedDocument, DocumentElement, saveDocument };
