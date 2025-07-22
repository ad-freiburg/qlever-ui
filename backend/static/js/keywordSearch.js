// ┌──────────────────────────────────────┐ \\
// │ Copyright © 2024-2025 Ioannis Nezis  │ \\
// ├──────────────────────────────────────┤ \\
// │ Licensed under the MIT license.      │ \\
// └──────────────────────────────────────┘ \\

// This variable contains the actual example spans that match the query.
let exampleSpans = {};
// This variable keeps track of the selected example.
let selectedExample = -1;

// This removes highlighting from the input string by replacing all occurrences
// of <span> elements with the class `keyword-search-highlight`
// with their inner content.
function unHighlight(input_str) {
  const regex = /\<span class\=\"keyword-search-highlight\"\>(.*?)\<\/span\>/gi;
  return input_str.replaceAll(regex, "$1");
}

// This highlights specified words or patterns within an input string
// by wrapping them with a <span> element
// with the class `keyword-search-highlight`.
//
// Algorithm:
// 1. Remove any existing highlighting.
// 2. Iterate over each `regex` in the list of `regexes`
//    to find matching sections in the input string.
// 3. Consolidate overlapping sections if any.
// 4. Replace the matching sections with HTML <span> tags for highlighting.
// 5. Return the modified string with highlighted words.
function highlightWords(input_str, regexps) {
  let return_str = unHighlight(input_str);
  // find matching sections
  let matching_sections = [];
  for (regexp of regexps) {
    const matches = input_str.matchAll(regexp);
    for (const match of matches) {
      matching_sections.push([match.index, match.index + match[0].length]);
    }
  }
  if (matching_sections.length === 0) {
    return return_str;
  }
  // consolidate overlapping sections
  matching_sections.sort((a, b) => a[0] - b[0]);
  matching_sections = matching_sections.reduce(
    (accu, elem) => {
      const [last, ...rest] = accu;
      if (elem[0] <= last[1]) {
        return [[last[0], Math.max(elem[1], last[1])], ...rest];
      }
      return [elem].concat(accu);
    },
    [matching_sections[0]],
  );
  // replace matching sections with highlighting span
  matching_sections.forEach(([from, to]) => {
    return_str = `${return_str.substring(0, from)}\
<span class="keyword-search-highlight">${return_str.substring(from, to)}\
</span>${return_str.substring(to)}`;
  });
  return return_str;
}

// This filters the list of examples given a string
// containing a space separated list of regexes.
// The filtering is achieved by hiding non-matching examples
// and highlighting matching ones.
function filterExamples(regexes_str) {
  const keywords = regexes_str
    .trim()
    .split(" ")
    .filter((keyword) => {
      if (keyword === "") {
        return false;
      }
      try {
        new RegExp(keyword);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return false;
        }
        throw error;
      }
      return true;
    })
    .map((word) => new RegExp(word, "gi"));
  let hits = 0;
  exampleSpans.each(function(idx) {
    const exampleText = $(this).text().trim();
    if (keywords.every((keyword) => exampleText.match(keyword) != null)) {
      $(this).addClass("keyword-search-match");
      $(this).parent().parent().show();
      $(this).html(highlightWords(exampleText, keywords));
      hits++;
    } else {
      $(this).parent().parent().hide();
    }
  });
  exampleSpans = $(".keyword-search-match");
  if (hits === 0) {
    $("#empty-examples-excuse").show();
  } else {
    $("#empty-examples-excuse").hide();
  }
}

// This creates a debounced version of a function.
// The "debouncing" is implemented by delaying the execution
// for a certain amount of time since the last call.
function debounce(fn, delay = 500) {
  let timerId = null;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
}

const filterExamplesDebounced = debounce(filterExamples, 200);

function cleanup() {
  // Calculate the example spans.
  exampleSpans = $("ul#exampleList .example-name");
  // Reset the selected example to nothing.
  selectedExample = -1;
  // Remove artifacts from previous usage.
  exampleSpans.each(function(idx) {
    $(this).removeClass("keyword-search-match");
    $(this).parent().parent().show();
    $(this).parent().removeClass("keyword-search-hover");
    $(this).text(unHighlight($(this).text()));
  });
}

$("#exampleKeywordSearchInput").on("keydown", function(event) {
  const hover_class = "keyword-search-hover";
  // The down key was pressed.
  if (exampleSpans.length > 0) {
    if (event.which === 40) {
      if (exampleSpans.length > 0) {
        $(exampleSpans[selectedExample]).parent().removeClass(hover_class);
        selectedExample = (selectedExample + 1) % exampleSpans.length;
        $(exampleSpans[selectedExample]).parent().addClass(hover_class);
      }
    }
    // The up key was pressed.
    else if (event.which === 38) {
      $(exampleSpans[selectedExample]).parent().removeClass(hover_class);
      selectedExample = selectedExample - 1;
      if (selectedExample == -1) {
        selectedExample = exampleSpans.length - 1;
      }
      $(exampleSpans[selectedExample]).parent().addClass(hover_class);
    }
    // The enter key was pressed.
    else if (event.which === 13 && selectedExample >= 0) {
      // The timeout of 50ms is used to prevent the keydown event
      // to reach the editor. This is a bit of a hack.
      setTimeout(() => {
        $(exampleSpans[selectedExample]).parent().parent().click();
      }, 50);
    }
  }
  // The escape key was pressed.
  if (event.which === 27) {
    $("#examplesDropdownToggle").click();
  }
});

$("#exampleKeywordSearchInput").on(
  "input",
  debounce(function(event) {
    cleanup();
    filterExamples(event.target.value);
  }, 200),
);

// This initializes the keyword search when the dropdown has loaded.
$("#exampleList")
  .parent()
  .on("shown.bs.dropdown", function() {
    // Clear value of the input field.
    $("#exampleKeywordSearchInput").val("");
    // Focus the input field.
    $("#exampleKeywordSearchInput").focus();
    // Cleanup keyword search.
    cleanup();
  });
