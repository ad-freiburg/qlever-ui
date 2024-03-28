// Set focus on input when examples dropdown is clicked.
$('#exampleList').parent().on('shown.bs.dropdown', function () {
  $("#exampleKeywordSearch").focus();
})


// This removes highlighting from the input string by replacing all occurrences of
// <span> elements with the class `keyword-search-highlight` with their inner content.
function unHighlight(input_str){
  return input_str.replaceAll(/\<span class\=\"keyword-search-highlight\"\>(.*?)\<\/span\>/gi, "$1");
}

// This Highlights specified words or patterns within an input string by wrapping them with a <span> element
// with the class `keyword-search-highlight`.
//
// Algorithm:
// 1. Remove any existing highlighting.
// 2. Iterate over each `regex` in the list of `regexes` to find matching sections in the input string.
// 3. Consolidate overlapping sections if any.
// 4. Replace the matching sections with HTML <span> tags for highlighting.
// 5. Return the modified string with highlighted words.
function highlightWords(input_str, regexps) {
  let return_str = unHighlight(input_str);
  // find matching sections
  let matching_sections = [];
  for (regexp of regexps){
    const matches = input_str.matchAll(regexp);
    for (const match of matches) {
      matching_sections.push([match.index, match.index + match[0].length]);
    }
  }
  if (matching_sections.length === 0){
    return return_str;
  }
  // consolidate overlapping sections
  matching_sections.sort((a,b) => a[0] - b[0]);
  matching_sections = matching_sections.reduce((accu,elem) => {
    const [last, ...rest] = accu;
    if (elem[0] <= last[1]){
      return [[last[0], Math.max(elem[1], last[1])], ...rest]
    }
    return [elem].concat(accu);
  }, [matching_sections[0]]);
  // replace matching sections with highlighting span
  matching_sections.forEach(([from, to]) => {
    return_str = `${return_str.substring(0, from)}<span class="keyword-search-highlight">${return_str.substring(from,to)}</span>${return_str.substring(to)}`;
  });
  return return_str;
}

// This filters the list of examples when the `input` event of the `exampleKeywordSearch` element fires,
// hiding non-matching examples and highlighting matching ones.
function filterExamples(event) {
  const keywords = event.target.value
    .trim()
    .split(' ')
    .filter((keyword) => {
      if(keyword == ''){
        return false;
      }
      try{
        new RegExp(keyword);
      }catch (SyntaxError){
        return false;
      }
      return true;
    })
    .map((word) => new RegExp(word, 'gi'));
  let hits = 0;
  const exampleItems = $("ul#exampleList .example-name").each(function(idx) {
    const exampleText = $(this).text().trim();
    if (keywords.every((keyword) => exampleText.match(keyword) != null)){
      $(this).parent().parent().show();
      $(this).html(highlightWords(exampleText, keywords));
      hits++;
    }else {
      $(this).parent().parent().hide();
    }
  });
  if (hits === 0){
    $("#empty-examples-excuse").show();
  }
  else {
    $("#empty-examples-excuse").hide();
  }
}


// This creates a debounced version of a function.
// The "debouncing" is implemented by delaying the execution for a certain amount of time since the last call.
function debounce(fn, delay=500) {
  let timerId = null;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
}

const filterExamplesDebounced = debounce(filterExamples, 200);
