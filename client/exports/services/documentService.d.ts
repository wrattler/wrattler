interface DocumentElement {
    language: string;
    source: string;
}
declare function getDocument(paragraph: string): Promise<DocumentElement[]>;
declare function getNamedDocument(): Promise<DocumentElement[]>;
export { getDocument, getNamedDocument, DocumentElement };
