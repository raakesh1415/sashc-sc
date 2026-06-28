from unittest.mock import patch
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from ..models import Subject

User = get_user_model()

class SubjectViewSetTestCase(APITestCase):

    def setUp(self):
        # Create a user and authenticate
        self.user = User.objects.create_user(email='test@gmail.com', password='password123')
        self.client.force_authenticate(user=self.user)
        
        # Create a sample subject
        self.subject = Subject.objects.create(
            subjectID='SUB001',
            subjectName='MATEMATIK',
            subjectCode='MT',
            year=2026
        )
        
        # URLs
        self.list_url = reverse('subject-list')  # Adjust based on your router prefix
        self.detail_url = reverse('subject-detail', kwargs={'subjectID': self.subject.subjectID})
        self.download_url = reverse('subject-download-template')
        self.upload_url = reverse('subject-bulk-upload')

    def test_unauthenticated_access_denied(self):
        """Ensure unauthenticated users cannot access the endpoints."""
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('..views.utils.get_active_year', return_value=2026)  # Adjust import path if needed
    def test_create_subject_with_active_year(self, mock_get_active_year):
        """Test creating a subject injects the active year if missing."""
        data = {
            'subjectID': 'SUB002',
            'subjectName': 'SEJARAH',
            'subjectCode': 'SJ'
        }
        response = self.client.post(self.list_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['year'], 2026)
        self.assertTrue(Subject.objects.filter(subjectID='SUB002').exists())

    @patch('..views.utils.get_active_year', return_value=2026)
    def test_list_subjects_filtered_by_year(self, mock_get_active_year):
        """Test listing subjects filters them by the active year."""
        # Create another subject for a different year
        Subject.objects.create(subjectID='SUB999', subjectName='ART', subjectCode='AR', year=2020)
        
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)  # Only the 2026 one
        self.assertEqual(response.data['data'][0]['subjectID'], self.subject.subjectID)

    def test_retrieve_subject(self):
        """Test retrieving a specific subject by its lookup field."""
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['subjectName'], 'MATEMATIK')

    @patch('..views.utils.get_active_year', return_value=2026)
    def test_update_subject(self, mock_get_active_year):
        """Test full update (PUT) of a subject."""
        data = {
            'subjectName': 'MATEMATIK TAMBAHAN',
            'subjectCode': 'MTM'
        }
        response = self.client.put(self.detail_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.subject.refresh_from_db()
        self.assertEqual(self.subject.subjectName, 'MATEMATIK TAMBAHAN')

    def test_delete_subject(self):
        """Test deleting a subject."""
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('deleted successfully', response.data['message'])
        self.assertFalse(Subject.objects.filter(subjectID='SUB001').exists())
