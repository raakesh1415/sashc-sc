import csv
import io

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Class, User
from ..serializers import ClassSerializer, ClassTeacherSerializer
from .utils import get_active_year, make_xlsx_response, read_upload_rows, detect_wrong_template


class ClassViewSet(viewsets.ModelViewSet):
    queryset = Class.objects.select_related('teacherID__user_profile').all()
    serializer_class = ClassSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'classID'

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        year = get_active_year(request)
        if year and not data.get('year'):
            data['year'] = year
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({'success': True, 'message': 'Class created successfully', 'data': serializer.data}, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        year = get_active_year(request)
        if year:
            qs = qs.filter(year=year)
        return Response({'success': True, 'count': qs.count(), 'data': self.get_serializer(qs, many=True).data})

    def retrieve(self, request, *args, **kwargs):
        return Response({'success': True, 'data': self.get_serializer(self.get_object()).data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        data = request.data.copy()
        year = get_active_year(request)
        if year and not data.get('year'):
            data['year'] = year
        serializer = self.get_serializer(self.get_object(), data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({'success': True, 'message': 'Class updated successfully', 'data': serializer.data})

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='class-teachers')
    def class_teachers(self, request):
        """Return all Class Teacher users for the assign-teacher dropdown."""
        year = get_active_year(request)
        users = User.objects.filter(role__contains='Class Teacher')
        if year:
            users = users.filter(Q(year=year) | Q(year__isnull=True))
        users = users.order_by('name')
        serializer = ClassTeacherSerializer(users, many=True)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=True, methods=['patch'], url_path='assign-teacher')
    def assign_teacher(self, request, classID=None):
        """
        Assign a Class Teacher to this class by updating ONLY Class.teacherID.
        Body: { "teacherID": "<user UUID>" } or { "teacherID": null } to unassign.
        """
        class_instance = self.get_object()
        teacher_user_id = request.data.get('teacherID', None)

        if teacher_user_id:
            try:
                user = User.objects.get(userID=teacher_user_id, role__contains='Class Teacher')
            except User.DoesNotExist:
                return Response(
                    {'success': False, 'message': 'Pengguna tidak ditemui atau bukan Guru Kelas.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not user.teacherID:
                return Response(
                    {'success': False, 'message': 'Pengguna ini tidak mempunyai profil Guru.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # If another class already holds this teacher, clear it first
            Class.objects.filter(teacherID=user.teacherID).exclude(
                classID=class_instance.classID
            ).update(teacherID=None)

            class_instance.teacherID = user.teacherID
        else:
            class_instance.teacherID = None

        class_instance.save(update_fields=['teacherID'])

        serializer = self.get_serializer(class_instance)
        return Response({'success': True, 'message': 'Guru Kelas berjaya ditetapkan.', 'data': serializer.data})

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.className
        instance.students.update(classID=None)
        self.perform_destroy(instance)
        return Response({'success': True, 'message': f'Class "{name}" deleted successfully'})

    @action(detail=False, methods=['get'], url_path='download-template')
    def download_template(self, request):
        return make_xlsx_response(
            filename='template_kelas.xlsx',
            headers=['Class Name'],
            rows=[['5 ADHARA'], ['5 SIRIUS']],
        )

    @action(detail=False, methods=['post'], url_path='bulk-upload', parser_classes=[MultiPartParser, FormParser])
    def bulk_upload(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'success': False, 'message': 'Tiada fail diterima.'}, status=status.HTTP_400_BAD_REQUEST)

        if not file.name.endswith('.xlsx'):
            return Response({'success': False, 'message': 'Fail mestilah dalam format Excel (.xlsx).'}, status=status.HTTP_400_BAD_REQUEST)

        year = get_active_year(request)
        try:
            rows = read_upload_rows(file)
        except Exception:
            return Response({'success': False, 'message': 'Gagal membaca fail. Pastikan fail adalah Excel (.xlsx) yang sah.'}, status=status.HTTP_400_BAD_REQUEST)

        fieldnames_set = set(rows[0].keys()) if rows else set()
        required = {'Class Name'}
        wrong = detect_wrong_template(fieldnames_set, expected_template='class', required_cols=required)
        if wrong:
            return Response({'success': False, **wrong}, status=status.HTTP_400_BAD_REQUEST)

        success_count = 0
        error_count = 0
        errors = []

        for i, row in enumerate(rows, start=2):
            class_name = row.get('Class Name', '').strip().upper()
            if not class_name:
                errors.append(f"Baris {i}: Nama kelas diperlukan.")
                error_count += 1; continue
            if year and Class.objects.filter(className__iexact=class_name, year=year).exists():
                errors.append(f"Baris {i}: Kelas \"{class_name}\" sudah wujud dalam tahun {year}.")
                error_count += 1; continue
            try:
                Class.objects.create(className=class_name, year=year)
                success_count += 1
            except Exception as e:
                errors.append(f"Baris {i}: {str(e)}")
                error_count += 1

        return Response({
            'success': True,
            'message': f'{success_count} kelas berjaya ditambah, {error_count} gagal.',
            'successCount': success_count, 'errorCount': error_count, 'errors': errors,
        })
