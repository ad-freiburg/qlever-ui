import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper/.";
import { IdentifyOperationTypeResult, OperationType } from "../types/lsp_messages";

declare const NO_SLUG_MODE: boolean;
declare function processQuery(query: string, operationType: string, sendLimit: number, element: HTMLElement): Promise<void>;
declare function cancelActiveQuery(): boolean;

// 1. Call processQuery (sends query to backend + displays results).
// 2. Add query hash to URL.
export async function executeQuery(wrapper: MonacoEditorLanguageClientWrapper) {
        const executeButton = document.getElementById("exebtn")!;
        const buttonText = document.querySelector("#exebtn span")!;
        const query = wrapper.getEditor()!.getValue();
        const operationType = await getOperationType(wrapper);
        if (cancelActiveQuery()) {
                executeButton.toggleAttribute("disabled")
                buttonText.textContent = "Cancelling";
                return;
        } else {
                buttonText.textContent = "Cancel";
        }


        // Add query hash to URL (we need Django for this, hence the POST request),
        // unless this is a URL with ?query=...
        const acquireShareLink = async () => {
                const response = await fetch("/api/share", {
                        method: "POST",
                        body: new URLSearchParams({
                                content: query
                        })
                });
                if (response.ok) {
                        const result = await response.json();
                        if (!window.location.search.includes(result.queryString)) {
                                const path = NO_SLUG_MODE
                                        ? ""
                                        : window.location.pathname.split("/").slice(0, 2).join("/");
                                window.history.pushState(window.history.state, "", `${path}/${result.link}`);
                        }
                }
        };

        // Run the query and fetch the share link concurrently
        Promise.all([
                processQuery(query, operationType, parseInt(document.getElementById("maxSendOnFirstRequest")!.textContent!), executeButton,)
                        .finally(() => {
                                executeButton.removeAttribute("disabled");
                                buttonText.textContent = "Execute";
                        }),
                acquireShareLink()
        ]).catch(error => console.error(error.message, 'requests'));

        executeButton.focus();
}

async function getOperationType(wrapper: MonacoEditorLanguageClientWrapper): Promise<OperationType> {
        const params = {
                textDocument: { uri: wrapper.getEditor()?.getModel()?.uri.toString() }
        };
        return wrapper.getLanguageClient("sparql")!.sendRequest("qlueLs/identifyOperationType", params).then((result) => {
                const typedResult = result as IdentifyOperationTypeResult;
                return typedResult.operationType;
        });
}
