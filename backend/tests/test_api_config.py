from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from backend.models import Backend, Example
import json


class BackendConfigAPITestCase(TestCase):
    """Test cases for the backend config API endpoints."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.client = Client()
        self.User = get_user_model()
        
        # Create test user
        self.user = self.User.objects.create_superuser(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create existing backend for testing updates
        self.existing_backend = Backend.objects.create(
            name='Existing Backend',
            slug='existing-backend',
            baseUrl='http://existing.com',
            isDefault=False
        )
    
    def test_get_config_no_auth_required(self):
        """Test that GET requests don't require authentication."""
        response = self.client.get('/api/config/existing-backend')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['content-type'], 'text/yaml')
        self.assertIn('config:', response.content.decode())
        self.assertIn('backend:', response.content.decode())
        self.assertIn('Existing Backend', response.content.decode())
    
    def test_get_config_nonexistent_backend(self):
        """Test GET request for non-existent backend returns error."""
        response = self.client.get('/api/config/nonexistent')
        
        self.assertEqual(response.status_code, 500)
        self.assertIn('Error:', response.content.decode())
    
    def test_post_config_requires_auth(self):
        """Test that POST requests require authentication."""
        config_yaml = """config:
  backend:
    name: Test Backend
    slug: test-backend
    baseUrl: http://test.com
  examples: []"""
        
        response = self.client.post(
            '/api/config/test-backend',
            data=config_yaml,
            content_type='text/yaml'
        )
        
        self.assertEqual(response.status_code, 403)
        self.assertIn('Authentication required', response.content.decode())
    
    def test_post_config_create_new_backend(self):
        """Test creating a new backend via POST."""
        config_yaml = """config:
  backend:
    name: New Test Backend
    slug: new-test-backend
    baseUrl: http://newtest.com
    isDefault: false
    isNoSlugMode: false
    maxDefault: 50
  examples:
    - name: Test Query 1
      sort_key: "1"
      query: "SELECT * WHERE { ?s ?p ?o } LIMIT 10"
    - name: Test Query 2
      sort_key: "2"
      query: "SELECT ?subject WHERE { ?subject rdf:type ?type } LIMIT 5"
"""
        
        # Login user
        self.client.force_login(self.user)
        
        response = self.client.post(
            '/api/config/new-test-backend',
            data=config_yaml,
            content_type='text/yaml'
        )
        
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content.decode())
        self.assertEqual(response_data['status'], 'success')
        self.assertIn('created successfully', response_data['message'])
        
        # Verify backend was created
        backend = Backend.objects.get(slug='new-test-backend')
        self.assertEqual(backend.name, 'New Test Backend')
        self.assertEqual(backend.baseUrl, 'http://newtest.com')
        self.assertEqual(backend.maxDefault, 50)
        
        # Verify examples were created
        examples = Example.objects.filter(backend=backend)
        self.assertEqual(examples.count(), 2)
        self.assertEqual(examples.first().name, 'Test Query 1')
    
    def test_post_config_update_existing_backend(self):
        """Test updating an existing backend via POST."""
        config_yaml = """config:
  backend:
    name: Updated Existing Backend
    slug: existing-backend
    baseUrl: http://updated.com
    isDefault: false
    maxDefault: 75
  examples:
    - name: Updated Query
      sort_key: "1"
      query: "SELECT * WHERE { ?updated ?query ?example }"
"""
        
        # Login user
        self.client.force_login(self.user)
        
        response = self.client.post(
            '/api/config/existing-backend',
            data=config_yaml,
            content_type='text/yaml'
        )
        
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content.decode())
        self.assertEqual(response_data['status'], 'success')
        self.assertIn('updated successfully', response_data['message'])
        
        # Verify backend was updated
        backend = Backend.objects.get(slug='existing-backend')
        self.assertEqual(backend.name, 'Updated Existing Backend')
        self.assertEqual(backend.baseUrl, 'http://updated.com')
        self.assertEqual(backend.maxDefault, 75)
        
        # Verify examples were updated
        examples = Example.objects.filter(backend=backend)
        self.assertEqual(examples.count(), 1)
        self.assertEqual(examples.first().name, 'Updated Query')
    
    def test_post_config_empty_body(self):
        """Test POST with empty body returns error."""
        self.client.force_login(self.user)
        
        response = self.client.post(
            '/api/config/empty-test',
            data='',
            content_type='text/yaml'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('Empty request body', response.content.decode())
    
    def test_post_config_invalid_yaml(self):
        """Test POST with invalid YAML returns error."""
        invalid_yaml = """config:
  backend:
    name: "Invalid YAML
    slug: invalid
"""
        
        self.client.force_login(self.user)
        
        response = self.client.post(
            '/api/config/invalid-test',
            data=invalid_yaml,
            content_type='text/yaml'
        )
        
        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content.decode())
        self.assertEqual(response_data['status'], 'error')
        self.assertIn('message', response_data)
    
    def test_post_config_slug_mismatch(self):
        """Test POST with mismatched slug in YAML returns error."""
        config_yaml = """config:
  backend:
    name: Mismatched Slug Test
    slug: different-slug
    baseUrl: http://test.com
  examples: []"""
        
        self.client.force_login(self.user)
        
        response = self.client.post(
            '/api/config/test-slug',
            data=config_yaml,
            content_type='text/yaml'
        )
        
        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content.decode())
        self.assertEqual(response_data['status'], 'error')
        self.assertIn('slugs must match', response_data['message'])
    
    def test_unsupported_http_method(self):
        """Test unsupported HTTP methods return 405."""
        response = self.client.put('/api/config/test-put')
        self.assertEqual(response.status_code, 405)
        
        response_data = json.loads(response.content.decode())
        self.assertEqual(response_data['status'], 'error')
        self.assertIn('Method PUT not allowed', response_data['message'])
        
        response = self.client.delete('/api/config/test-delete')
        self.assertEqual(response.status_code, 405)
        
        response_data = json.loads(response.content.decode())
        self.assertEqual(response_data['status'], 'error')
        self.assertIn('Method DELETE not allowed', response_data['message'])
    
    def test_config_roundtrip(self):
        """Test creating a backend via POST and retrieving it via GET."""
        config_yaml = """config:
  backend:
    name: Roundtrip Test Backend
    slug: roundtrip-test
    baseUrl: http://roundtrip.com
    isDefault: false
    isNoSlugMode: false
    filteredLanguage: en,de
    dynamicSuggestions: 2
  examples:
    - name: Example 1
      sort_key: "A"
      query: "PREFIX ex: <http://example.org/> SELECT * WHERE { ?s ex:name ?name }"
"""
        
        # Create backend via POST
        self.client.force_login(self.user)
        post_response = self.client.post(
            '/api/config/roundtrip-test',
            data=config_yaml,
            content_type='text/yaml'
        )
        self.assertEqual(post_response.status_code, 200)
        
        # Retrieve backend via GET
        self.client.logout()  # Test that GET doesn't require auth
        get_response = self.client.get('/api/config/roundtrip-test')
        self.assertEqual(get_response.status_code, 200)
        
        # Verify content
        yaml_content = get_response.content.decode()
        self.assertIn('Roundtrip Test Backend', yaml_content)
        self.assertIn('http://roundtrip.com', yaml_content)
        self.assertIn('Example 1', yaml_content)
        self.assertIn('PREFIX ex:', yaml_content)