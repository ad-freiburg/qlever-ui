// Set focus on input when examples dropdown is clicked
$('#exampleList').parent().on('shown.bs.dropdown', function () {
  $("#exampleKeywordSearch").focus();
})

// this function removes the highlight
function unHighlight(input_str){
  return input_str.replaceAll(/\<span class\=\"keyword-search-highlight\"\>(.*?)\<\/span\>/gi, "$1");
}

// this function highlights the matching sections
function highlightWords(input_str, words) {
  let return_str = unHighlight(input_str.toLowerCase());
  // find matching sections
  let matching_sections = [];
  for (word of words){
    let startIndex = 0;
    while ((index = return_str.indexOf(word, startIndex)) > -1){
      matching_sections.push([index, index + word.length]);
      startIndex = index + word.length;
    }
  }
  if (matching_sections.length === 0){
    return input_str;
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
  return_str = unHighlight(input_str);
  matching_sections.forEach(([from, to]) => {
    return_str = `${return_str.substring(0, from)}<span class="keyword-search-highlight">${return_str.substring(from,to)}</span>${return_str.substring(to)}`;
  });
  return return_str;
}

// this function gets triggered by the "oninput" event of the examples text input field id=example-keyword-search
// it takes the input of this field and searches for the given keyword in the example queries
// a example-query is a match if each keyword maches a substring of the example-name
function filterExamples(event) {
  const keywords = event.target.value
    .toLowerCase()
    .trim()
    .split(' ')
    .filter((keyword) => keyword !== '');
  let hits = 0;
  const exampleItems = $("ul#exampleList .example-name").each(function(idx) {
    const exampleText = $(this).text().trim();
    if (keywords.every((keyword) => exampleText.toLowerCase().includes(keyword))){
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

// this is taken from here: https://www.geeksforgeeks.org/implement-search-box-with-debounce-in-javascript/
// its a decorator that makes sure a function is only called once within the given delay
function debounce(fn, delay=500) {
  let timerId = null;
  return (...args) => {
    clearTimeout(timerId); // restart timer
    timerId = setTimeout(() => fn(...args), delay);
  };
}

const filterExamplesDebounced = debounce(filterExamples, 200);
