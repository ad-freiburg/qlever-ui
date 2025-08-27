# Query Analysis

QLever UI provides interactive analysis of SPARQL query execution to help understand query performance and structure.

## Query Execution Tree

After executing a query, click the "Analysis" button to view:
- **Query execution tree** showing the hierarchical structure of query operations
- **Performance timing** for each operation node
- **Cache status** indicators (cached, pinned, ancestor cached)
- **Result sizes** and cost estimates for each step

## Navigation

For large or complex query trees, the visualization provides interactive navigation:
- **Navigate large trees** by dragging to move around the visualization
- **Zoom in/out** using mouse wheel for detailed inspection  
- **Reset view** by double-clicking to return to default position
- **Hover details** on nodes to see additional performance metrics

## Performance Indicators

The query tree uses visual cues to help identify performance characteristics:
- **Color-coded nodes** indicate execution time (normal, high, very high)
- **Cache status** helps identify optimization opportunities
- **Total computation time** and query planning metrics displayed at the top
- **Node details** show sizes, cost estimates, and status information

## Real-time Updates

During query execution, the tree updates in real-time via WebSocket connection, showing progress through different execution phases. This helps understand which parts of complex queries are taking the most time.

## Query History

When logging is enabled, you can navigate between different query executions using the pagination controls at the bottom of the analysis modal.

## Tips for Analysis

- **Large trees**: Use the navigation controls to explore different sections of complex query trees
- **Performance bottlenecks**: Look for red (very high time) or orange (high time) nodes
- **Cache optimization**: Nodes marked as "cached" indicate good performance optimization
- **Query planning**: Check the meta information for time spent on query planning vs execution