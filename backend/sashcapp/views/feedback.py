from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ..models import Feedback
from ..serializers import FeedbackSerializer
from .utils import ALLOWED_EMAIL_DOMAINS


class FeedbackViewSet(viewsets.ViewSet):

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]

    def create(self, request):
        """POST /feedback/ — public, submit a feedback/issue report."""
        email = request.data.get('email', '')
        domain = email.split('@')[-1] if '@' in email else ''
        if domain not in ALLOWED_EMAIL_DOMAINS:
            return Response(
                {'success': False, 'message': f"Domain e-mel '{domain}' tidak dibenarkan."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = FeedbackSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'success': True, 'message': 'Maklum balas berjaya dihantar. Terima kasih!'})
        return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def list(self, request):
        """GET /feedback/ — admin only, list all feedback."""
        if 'Admin' not in request.user.role:
            return Response({'success': False, 'message': 'Akses ditolak'}, status=status.HTTP_403_FORBIDDEN)
        feedbacks = Feedback.objects.all()
        serializer = FeedbackSerializer(feedbacks, many=True)
        return Response({'success': True, 'data': serializer.data})

    def partial_update(self, request, pk=None):
        """PATCH /feedback/{id}/ — admin only, mark as read/unread."""
        if 'Admin' not in request.user.role:
            return Response({'success': False, 'message': 'Akses ditolak'}, status=status.HTTP_403_FORBIDDEN)
        try:
            feedback = Feedback.objects.get(pk=pk)
        except Feedback.DoesNotExist:
            return Response({'success': False, 'message': 'Tidak dijumpai'}, status=status.HTTP_404_NOT_FOUND)
        feedback.is_read = request.data.get('is_read', feedback.is_read)
        feedback.save()
        return Response({'success': True, 'data': FeedbackSerializer(feedback).data})

    def destroy(self, request, pk=None):
        """DELETE /feedback/{id}/ — admin only, delete feedback."""
        if 'Admin' not in request.user.role:
            return Response({'success': False, 'message': 'Akses ditolak'}, status=status.HTTP_403_FORBIDDEN)
        try:
            feedback = Feedback.objects.get(pk=pk)
        except Feedback.DoesNotExist:
            return Response({'success': False, 'message': 'Tidak dijumpai'}, status=status.HTTP_404_NOT_FOUND)
        feedback.delete()
        return Response({'success': True, 'message': 'Maklum balas dipadam'})

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """POST /feedback/bulk-delete/ — admin only, delete multiple feedbacks."""
        if 'Admin' not in request.user.role:
            return Response({'success': False, 'message': 'Akses ditolak'}, status=status.HTTP_403_FORBIDDEN)
        ids = request.data.get('feedbackIDs', [])
        if not ids:
            return Response({'success': False, 'message': 'Sila pilih sekurang-kurangnya satu maklum balas.'}, status=status.HTTP_400_BAD_REQUEST)
        deleted_count, _ = Feedback.objects.filter(pk__in=ids).delete()
        return Response({'success': True, 'message': f'{deleted_count} maklum balas berjaya dipadam.', 'deleted': deleted_count})

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        """GET /feedback/unread-count/ — admin only, returns unread count for badge."""
        if 'Admin' not in request.user.role:
            return Response({'count': 0})
        count = Feedback.objects.filter(is_read=False).count()
        return Response({'count': count})
