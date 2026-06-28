import uuid

from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Subject

User = get_user_model()


class SubjectCRUDTestCase(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(email='test@gmail.com', password='password123')
        self.client.force_authenticate(user=self.user)

        self.subject = Subject.objects.create(
            subjectName='MATEMATIK',
            subjectCode='MT',
            year=2026,
        )

        self.list_url = reverse('subject-list')
        self.detail_url = reverse('subject-detail', kwargs={'subjectID': self.subject.subjectID})

    # ── Authentication ────────────────────────────────────────────────────────

    def test_unauthenticated_access_denied(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_subject(self):
        data = {'subjectName': 'SEJARAH', 'subjectCode': 'SJ'}
        response = self.client.post(f'{self.list_url}?year=2026', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['year'], 2026)
        self.assertTrue(Subject.objects.filter(subjectCode='SJ', year=2026).exists())

    def test_create_duplicate_subject_name_in_same_year_fails(self):
        data = {'subjectName': 'MATEMATIK', 'subjectCode': 'MT2', 'year': 2026}
        response = self.client.post(self.list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_subjects_no_filter(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertGreaterEqual(response.data['count'], 1)

    def test_list_subjects_filtered_by_year(self):
        Subject.objects.create(subjectName='ART', subjectCode='AR', year=2020)
        response = self.client.get(f'{self.list_url}?year=2026')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(str(response.data['data'][0]['subjectID']), str(self.subject.subjectID))

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_subject(self):
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['subjectName'], 'MATEMATIK')
        self.assertEqual(response.data['data']['subjectCode'], 'MT')

    def test_retrieve_nonexistent_subject_returns_404(self):
        url = reverse('subject-detail', kwargs={'subjectID': uuid.uuid4()})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── Update ────────────────────────────────────────────────────────────────

    def test_full_update_subject(self):
        data = {'subjectName': 'MATEMATIK TAMBAHAN', 'subjectCode': 'MTM', 'year': 2026}
        response = self.client.put(self.detail_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.subject.refresh_from_db()
        self.assertEqual(self.subject.subjectName, 'MATEMATIK TAMBAHAN')
        self.assertEqual(self.subject.subjectCode, 'MTM')

    def test_partial_update_subject(self):
        data = {'subjectName': 'MATEMATIK MODEN'}
        response = self.client.patch(self.detail_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.subject.refresh_from_db()
        self.assertEqual(self.subject.subjectName, 'MATEMATIK MODEN')
        self.assertEqual(self.subject.subjectCode, 'MT')

    # ── Delete ────────────────────────────────────────────────────────────────

    def test_delete_subject(self):
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('deleted successfully', response.data['message'])
        self.assertFalse(Subject.objects.filter(subjectCode='MT').exists())
