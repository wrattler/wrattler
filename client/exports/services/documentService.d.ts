interface DocumentElement {
    language: string;
    source: string;
}
declare function getDocument(paragraph: string): Promise<DocumentElement[]>;
declare function getNamedDocumentContent(): Promise<string>;
declare function getResourceContent(resourceServerUrl: string, sourceURL: string): Promise<string>;
export { getDocument, getNamedDocumentContent, DocumentElement, getResourceContent };
