# Backend Tests

This directory contains Django tests for the backend app, specifically for testing the backend configuration API.

## Structure

- `test_api_config.py` - Main test file for the backend configuration API endpoints
- `utils.py` - Utility functions for loading test fixtures and creating test data
- `fixtures/` - Directory containing test fixture files with sample configurations

## Test Files

### `test_api_config.py`
Contains comprehensive tests for the `/api/config/<backend-slug>` endpoint:

- GET requests (no authentication required)
- POST requests (authentication required)
- Error handling (invalid YAML, missing fields, etc.)
- Backend creation and updating
- Examples management

### `utils.py`
Utility functions for tests:

- `load_test_fixture(filename)` - Load fixture files
- `load_invalid_config_example(example_name)` - Load specific invalid config examples
- `create_test_backend_config()` - Generate test configurations programmatically
- `create_test_example()` - Create test example queries

## Fixtures

### `fixtures/sample_backend_config.yaml`
Complete backend configuration with all available options, including:
- Complex SPARQL queries for suggestions
- Multiple example queries
- Full configuration options

### `fixtures/minimal_backend_config.yaml`
Minimal valid backend configuration for basic testing.

### `fixtures/wikidata_example_config.yaml`
Realistic Wikidata-based configuration with:
- Wikidata-specific prefixes
- Real-world SPARQL queries
- Service-based label resolution

### `fixtures/invalid_config_examples.yaml`
Collection of invalid configurations for testing error handling:
- Missing required fields
- Invalid YAML syntax
- Type mismatches
- Structural errors

## Running Tests

### Run all backend tests:
```bash
python manage.py test backend.tests
```

### Run specific test class:
```bash
python manage.py test backend.tests.test_api_config.BackendConfigAPITestCase
```

### Run specific test method:
```bash
python manage.py test backend.tests.test_api_config.BackendConfigAPITestCase.test_post_config_create_new_backend
```

### Run with verbose output:
```bash
python manage.py test backend.tests -v 2
```

## Test Coverage

The tests cover:

1. **Authentication and Authorization**
   - GET requests work without authentication
   - POST requests require authentication
   - Proper 403 responses for unauthenticated POST requests

2. **Backend Creation**
   - Creating new backends via POST
   - Auto-creation of minimal backend if it doesn't exist
   - Proper validation of required fields

3. **Backend Updates**
   - Updating existing backends via POST
   - Overwriting existing examples
   - Preserving backend ID during updates

4. **Error Handling**
   - Invalid YAML syntax
   - Missing required fields
   - Slug mismatches between URL and YAML
   - Empty request bodies
   - Unsupported HTTP methods (PUT, DELETE)

5. **Data Integrity**
   - Proper creation of Backend and Example objects
   - Correct field mappings from YAML to database
   - Round-trip testing (POST then GET)

6. **Response Formats**
   - JSON responses for POST requests
   - YAML responses for GET requests
   - Proper HTTP status codes
   - Informative error messages

## Adding New Tests

When adding new tests:

1. Follow the existing naming convention (`test_<functionality>`)
2. Include comprehensive docstrings
3. Use the utility functions for creating test data
4. Add new fixture files for complex test scenarios
5. Test both success and error cases
6. Verify database state changes where applicable

## Test Data Cleanup

Django's TestCase automatically handles database cleanup between tests, so no manual cleanup is required. Test databases are created and destroyed for each test run.