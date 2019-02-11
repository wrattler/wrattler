interface DocumentElement {
    language: string;
    source: string;
}
declare function getSampleDocument(): Promise<DocumentElement[]>;
export { getSampleDocument, DocumentElement };
