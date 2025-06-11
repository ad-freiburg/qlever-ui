import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper/.";

export function setup_buttons(wrapper: MonacoEditorLanguageClientWrapper) {
  // NOTE: Format button
  document.getElementById("formatButton")!
    .addEventListener("click", () => {
      wrapper.getEditor()!.trigger("button", "editor.action.formatDocument", {});
    });

  // NOTE: Query Examples
  document.querySelectorAll(".queryExample")!
    .forEach(element => {
      element.addEventListener("click", () => {
        wrapper.getEditor()!.setValue(element.getAttribute("value")!)
        wrapper.getEditor()!.focus();
      });
    });

  // NOTE: Execute button
  document.getElementById("exebtn")!
    .addEventListener("click", () => {
      // executeQuery(wrapper.getEditor()!.getValue())
    });
}

// 1. Call processQuery (sends query to backend + displays results).
// 2. Add query hash to URL.
export function executeQuery(query: string) {

  const buttonText = document.querySelector("#exebtn span");
  buttonText!.textContent = "Cancel";
  // if (cancelActiveQuery()) {
  //   exeButton.prop("disabled", true);
  //   buttonText.text("Cancelling");
  //   return;
  // } else {
  //   buttonText.text("Cancel");
  // }
  // console.log("Start processing", "other");
  // $("#suggestionErrorBlock").parent().hide();
  //
  // // Add query hash to URL (we need Django for this, hence the POST request),
  // // unless this is a URL with ?query=...
  // const acquireShareLink = async () => {
  //   const response = await fetch("/api/share", {
  //     method: "POST",
  //     body: new URLSearchParams({
  //       "content": editor.getValue()
  //     })
  //   });
  //   if (response.ok) {
  //     const result = await response.json();
  //     log("Got pretty link from backend", "other");
  //     if (!window.location.search.includes(result.queryString)) {
  //       const path = NO_SLUG_MODE
  //         ? ""
  //         : window.location.pathname.split("/").slice(0, 2).join("/");
  //       window.history.pushState(window.history.state, "", `${path}/${result.link}`);
  //     }
  //   }
  // };
  //
  // // Run the query and fetch the share link concurrently
  // Promise.all([
  //   processQuery(parseInt($("#maxSendOnFirstRequest").html()))
  //     .finally(() => {
  //       exeButton.prop("disabled", false);
  //       buttonText.text("Execute");
  //     }),
  //   acquireShareLink()
  // ]).catch(error => log(error.message, 'requests'));
  //
  // if (editor.state.completionActive) { editor.state.completionActive.close(); }
  // exeButton.focus();
}
