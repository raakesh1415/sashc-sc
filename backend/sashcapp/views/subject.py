from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Subject
from ..serializers import SubjectSerializer
from .utils import get_active_year, make_xlsx_response, read_upload_rows, detect_wrong_template


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'subjectID'

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        year = get_active_year(request)
        if year and not data.get('year'):
            data['year'] = year
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({'success': True, 'message': 'Subject created successfully', 'data': serializer.data}, status=status.HTTP_201_CREATED)

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
        return Response({'success': True, 'message': 'Subject updated successfully', 'data': serializer.data})

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.subjectName
        self.perform_destroy(instance)
        return Response({'success': True, 'message': f'Subject "{name}" deleted successfully'})

    @action(detail=False, methods=['get'], url_path='download-template')
    def download_template(self, request):
        return make_xlsx_response(
            filename='template_mata_pelajaran.xlsx',
            headers=['Subject Code', 'Subject Name'],
            rows=[['BM', 'BAHASA MELAYU'], ['BI', 'BAHASA INGGERIS']],
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
        required = {'Subject Name', 'Subject Code'}
        wrong = detect_wrong_template(fieldnames_set, expected_template='subject', required_cols=required)
        if wrong:
            return Response({'success': False, **wrong}, status=status.HTTP_400_BAD_REQUEST)

        success_count = 0
        error_count = 0
        errors = []

        for i, row in enumerate(rows, start=2):
            subject_name = row.get('Subject Name', '').strip().upper()
            subject_code = row.get('Subject Code', '').strip().upper()
            if not subject_code:
                errors.append(f"Baris {i}: Kod mata pelajaran diperlukan.")
                error_count += 1; continue
            if not subject_name:
                errors.append(f"Baris {i}: Nama mata pelajaran diperlukan.")
                error_count += 1; continue
            if year and Subject.objects.filter(subjectName__iexact=subject_name, year=year).exists():
                errors.append(f"Baris {i}: Mata pelajaran \"{subject_name}\" sudah wujud dalam tahun {year}.")
                error_count += 1; continue
            try:
                Subject.objects.create(subjectName=subject_name, subjectCode=subject_code, year=year)
                success_count += 1
            except Exception as e:
                errors.append(f"Baris {i}: {str(e)}")
                error_count += 1

        return Response({
            'success': True,
            'message': f'{success_count} mata pelajaran berjaya ditambah, {error_count} gagal.',
            'successCount': success_count, 'errorCount': error_count, 'errors': errors,
        })
