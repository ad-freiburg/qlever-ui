// Set focus on input when examples dropdown is clicked
$('#exampleList').parent().on('shown.bs.dropdown', function () {
  $("#exampleKeywordSearch").focus();
})

/**
 * Removes highlighting from the input string by replacing all occurrences of
 * <span> elements with the class "keyword-search-highlight" with their inner content.
 *
 * @param {string} input_str - The input string possibly containing highlighted spans.
 * @returns {string} - The input string with highlighting removed.
 */
function unHighlight(input_str){
  return input_str.replaceAll(/\<span class\=\"keyword-search-highlight\"\>(.*?)\<\/span\>/gi, "$1");
}

/**
* Highlight words in a given string.
*
* @param {string} input_str - The input string to be highlighted.
* @param {string} words - The list of words to be highlighted in the input string.
* @returns {string} - The input string with the specified words highlighted using HTML <span> tags with the class "keyword-search-highlight".
*
* Algorithm:
* 1. Convert the input string to lowercase and remove any existing highlighting.
* 2. Iterate over each word in the list of words to find matching sections in the input string.
* 3. Consolidate overlapping sections if any.
* 4. Replace the matching sections with HTML <span> tags for highlighting.
* 5. Return the modified string with highlighted words.
*
* Note:
* - Overlapping sections are consolidated into a single highlighted section.
* - The highlighting is done using the HTML <span> tag with the class "keyword-search-highlight".
*/
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

/**
 * Filters a list of examples based on the input event value, hiding non-matching examples and highlighting matching ones.
 *
 * @param {Event} event - The input event triggered by user interaction.
 * @returns {void}
 */
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

/**
 * Creates a debounced version of a function that delays its execution until after a certain amount of time has passed since the last call.
 *
 * @param {Function} fn - The function to debounce.
 * @param {number} [delay=500] - The delay in milliseconds before invoking the debounced function.
 * @returns {Function} - The debounced function.
 */
function debounce(fn, delay=500) {
  let timerId = null;
  return (...args) => {
    clearTimeout(timerId); // restart timer
    timerId = setTimeout(() => fn(...args), delay);
  };
}

const filterExamplesDebounced = debounce(filterExamples, 200);
