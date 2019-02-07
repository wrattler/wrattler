interface DocumentElement {
    language: string;
    source: string;
}
declare function getSampleDocument(): Promise<DocumentElement[]>;
declare function getThisDocument(documentContent: string): Promise<DocumentElement[]>;
export { getThisDocument, getSampleDocument, DocumentElement };
