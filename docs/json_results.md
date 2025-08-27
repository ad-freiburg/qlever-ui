
### JSON View and Download
QLever UI now includes a JSON view feature that allows users to inspect and download the raw JSON response from SPARQL queries.

**Key Features:**
- **View JSON Response**: Click the "View JSON" button in the query results to see the formatted JSON response in a modal popup
- **Download JSON**: Download the complete query response as a JSON file with proper formatting
- **Formatted Display**: JSON is displayed with proper indentation and syntax highlighting for easy reading

**This feature is particularly useful for:**
- Understanding the complete structure of query responses
- Debugging SPARQL queries


**How to use:**
1. Execute any SPARQL query
2. In the results area, click the "View JSON" button (appears next to CSV/TSV download buttons) 
<div style="text-align: center;">
    <img src="docs/screenshot_result_options.png" alt="JSON View Feature" width="80%">
    <p><em>QLever UI showing "View JSON" button.</em></p>
</div>
3. A modal will open showing the formatted JSON response
<div style="text-align: center;">
    <img src="docs/screenshot_show_json.png" alt="JSON View Feature" width="80%">
    <p><em>JSON view modal showing formatted query response with download functionality</em></p>
</div>
4. Click "Download JSON" to save the response as a file

