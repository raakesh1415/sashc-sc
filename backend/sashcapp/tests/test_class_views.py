import uuid
from unittest.mock import patch
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import Class

User = get_user_model()

# Create a mock for the teacher relationship if your model requires it.
# Assuming user.teacherID points to a Teacher profile model.
class MockTeacherProfile:
    def __init__(self, id):
        self.id = id

class ClassViewSetTestCase(APITestCase):

    def setUp(self):
        # 1. Setup authenticated user
        self.user = User.objects.create_user(username='admin_user', password='password123')
        self.client.force_authenticate(user=self.user)

        # 2. Setup mock Teacher profile ID for assignment logic
        self.mock_teacher_uuid = uuid.uuid4()

        # 3. Setup a Teacher User
        self.teacher_user = User.objects.create(
            username='teacher1',
            userID=str(uuid.uuid4()),
            name='Cikgu Ahmad',
            role='Class Teacher',
            year=2026
        )
        # Mocking property or field dynamically if it's an unmanaged relationship in tests
        self.teacher_user.teacherID = self.mock_teacher_uuid
        self.teacher_user.save()

        # 4. Create a sample Class instance
        self.class_instance = Class.objects.create(
            classID='CLASS001',
            className='5 ADHARA',
            year=2026,
            teacherID=None
        )

        # 5. Reverse URLs (Ensure these match your router configuration names)
        self.list_url = reverse('class-list')
        self.detail_url = reverse('class-detail', kwargs={'classID': self.class_instance.classID})
        self.teachers_dropdown_url = reverse('class-class-teachers')
        self.assign_teacher_url = reverse('class-assign-teacher', kwargs={'classID': self.class_instance.classID})
        self.download_url = reverse('class-download-template')
        self.upload_url = reverse('class-bulk-upload')

    def test_unauthenticated_access_denied(self):
        """Ensure unauthenticated requests are strictly rejected."""
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('..views.utils.get_active_year', return_value=2026)
    def test_create_class_auto_injects_year(self, mock_get_active_year):
        """Test class creation automatically assigns the active session year if absent."""
        data = {'classID': 'CLASS002', 'className': '5 SIRIUS'}
        response = self.client.post(self.list_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['year'], 2026)
        self.assertTrue(Class.objects.filter(classID='CLASS002').exists())

    @patch('..views.utils.get_active_year', return_value=2026)
    def test_list_classes_filtered_by_active_year(self, mock_get_active_year):
        """Verify class querysets are correctly filtered based on the active year context."""
        # Create a class matching a legacy or mismatched year
        Class.objects.create(classID='CLASS999', className='4 OLD', year=2020)

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only find the class belonging to 2026
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['data'][0]['classID'], self.class_instance.classID)

    @patch('..views.utils.get_active_year', return_value=2026)
    def test_class_teachers_dropdown_filtering(self, mock_get_active_year):
        """Ensure the dropdown endpoint extracts valid teachers relative to active year."""
        response = self.client.get(self.teachers_dropdown_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        # Confirms 'Cikgu Ahmad' is visible in the response list
        self.assertEqual(len(response.data['data']), 1)

    def test_assign_teacher_success(self):
        """Test assigning a valid teacher profile to a target class."""
        # Mocking user fetching constraint requirements within local unit test scope
        with patch('..models.User.objects.get') as mock_get_user:
            mock_get_user.return_value = self.teacher_user
            
            payload = {'teacherID': self.teacher_user.userID}
            response = self.client.patch(self.assign_teacher_url, payload, format='json')
            
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.class_instance.refresh_from_db()
            self.assertEqual(str(self.class_instance.teacherID), str(self.mock_teacher_uuid))

    def test_assign_teacher_unassign_with_null(self):
        """Test sending an explicit null payloads clears the current assigned class teacher."""
        self.class_instance.teacherID = self.mock_teacher_uuid
        self.class_instance.save()

        payload = {'teacherID': None}
        response = self.client.patch(self.assign_teacher_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.class_instance.refresh_from_db()
        self.assertIsNone(self.class_instance.teacherID)

    def test_assign_teacher_invalid_user_throws_400(self):
        """Test that assigning a non-existent or invalid user ID fails with HTTP 400."""
        payload = {'teacherID': str(uuid.uuid4())}  # Random fake UUID
        response = self.client.patch(self.assign_teacher_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    @patch('..views.utils.make_xlsx_response')
    def test_download_template(self, mock_make_xlsx_response):
        """Test template generator hits file response utilities."""
        mock_make_xlsx_response.return_value = 'mocked_stream'
        response = self.client.get(self.download_url)
        mock_make_xlsx_response.assert_called_once()
        self.assertEqual(response, 'mocked_stream')

    def test_bulk_upload_no_file_provided(self):
        """Validate bulk upload payload guard blocks empty uploads."""
        response = self.client.post(self.upload_url, data={})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Tiada fail', response.data['message'])

    @patch('..views.utils.get_active_year', return_value=2026)
    @patch('..views.utils.detect_wrong_template', return_value=None)
    @patch('..views.utils.read_upload_rows')
    def test_bulk_upload_processing_matrix(self, mock_read_rows, mock_detect_template, mock_year):
        """Test transactional row allocations during spreadsheet intake evaluations."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_excel = SimpleUploadedFile("kelas.xlsx", b"binarycontent", content_type="application/vnd.ms-excel")
        
        # Inject rows simulating structural pass/fail constraints
        mock_read_rows.return_value = [
            {'Class Name': '5 CENTAURI'},  # Valid target -> creates entry
            {'Class Name': ''},            # Empty row cell validation -> fails validation
            {'Class Name': '5 ADHARA'},    # Duplicate string name checking -> skips creation
        ]

        response = self.client.post(self.upload_url, {'file': fake_excel}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['successCount'], 1)
        self.assertEqual(response.data['errorCount'], 2)
        self.assertTrue(Class.objects.filter(className='5 CENTAURI', year=2026).exists())