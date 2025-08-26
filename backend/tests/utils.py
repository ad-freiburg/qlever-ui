"""
Utility functions for backend tests.
"""
import os
import yaml


def load_test_fixture(filename):
    """
    Load a test fixture file from the fixtures directory.
    
    Args:
        filename (str): Name of the fixture file
        
    Returns:
        str: Content of the fixture file
    """
    fixtures_dir = os.path.join(os.path.dirname(__file__), 'fixtures')
    filepath = os.path.join(fixtures_dir, filename)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def load_invalid_config_example(example_name):
    """
    Load a specific invalid config example from the invalid_config_examples.yaml file.
    
    Args:
        example_name (str): Name of the example to load
        
    Returns:
        str: The invalid config YAML string
    """
    fixtures_dir = os.path.join(os.path.dirname(__file__), 'fixtures')
    filepath = os.path.join(fixtures_dir, 'invalid_config_examples.yaml')
    
    with open(filepath, 'r', encoding='utf-8') as f:
        examples = yaml.safe_load(f)
        
    if example_name not in examples:
        raise ValueError(f"Invalid config example '{example_name}' not found")
        
    return examples[example_name]


def create_test_backend_config(name, slug, base_url="https://example.com/sparql", **kwargs):
    """
    Create a test backend configuration YAML string with custom values.
    
    Args:
        name (str): Backend name
        slug (str): Backend slug
        base_url (str): Backend base URL
        **kwargs: Additional backend configuration parameters
        
    Returns:
        str: YAML configuration string
    """
    config = {
        'config': {
            'backend': {
                'name': name,
                'slug': slug,
                'baseUrl': base_url,
                'isDefault': kwargs.get('isDefault', False),
                'isNoSlugMode': kwargs.get('isNoSlugMode', False),
            },
            'examples': kwargs.get('examples', [])
        }
    }
    
    # Add optional parameters
    optional_fields = [
        'maxDefault', 'filteredLanguage', 'dynamicSuggestions', 
        'defaultModeTimeout', 'mixedModeTimeout', 'apiToken',
        'supportedKeywords', 'supportedFunctions', 'supportedPredicateSuggestions',
        'suggestPrefixnamesForPredicates', 'fillPrefixes', 'filterEntities',
        'suggestedPrefixes', 'suggestionEntityVariable', 'suggestionNameVariable',
        'suggestionAltNameVariable', 'suggestionReversedVariable',
        'suggestSubjects', 'suggestPredicates', 'suggestObjects',
        'subjectName', 'predicateName', 'objectName',
        'alternativeSubjectName', 'alternativePredicateName', 'alternativeObjectName'
    ]
    
    for field in optional_fields:
        if field in kwargs:
            config['config']['backend'][field] = kwargs[field]
    
    return yaml.dump(config, default_flow_style=False, sort_keys=False)


def create_test_example(name, sort_key, query):
    """
    Create a test example dictionary.
    
    Args:
        name (str): Example name
        sort_key (str): Example sort key
        query (str): SPARQL query
        
    Returns:
        dict: Example dictionary
    """
    return {
        'name': name,
        'sort_key': sort_key,
        'query': query
    }