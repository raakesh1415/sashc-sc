import csv
import io

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Headcount, Subject, User
from ..serializers import (
    AR1RowSerializer, AR1UpdateSerializer,
    AR2RowSerializer, AR2UpdateSerializer,
    ETRRowSerializer, ETRUpdateSerializer,
)
from .utils import get_active_year, apply_mark, build_upload_caches, _grade, make_xlsx_response, read_upload_rows, detect_wrong_template


class TeacherExamViewSet(viewsets.ViewSet):
    """
    Base ViewSet for per-exam mark entry by Subject Teachers (AR1, AR2, ETR).

    Subclasses must set:
        exam_field       — e.g. 'AR1'
        list_serializer  — e.g. AR1RowSerializer
        update_serializer — e.g. AR1UpdateSerializer
    """
    permission_classes = [IsAuthenticated]
    exam_field = None
    list_serializer = None
    update_serializer = None

    def list(self, request):
        current_user = request.user

        if not current_user.teacherID or 'Subject Teacher' not in current_user.role:
            return Response({
                'success': False,
                'message': f'Only Subject Teachers can access {self.exam_field} data',
                'data': [],
            }, status=status.HTTP_403_FORBIDDEN)

        teacher = current_user.teacherID
        enroll = teacher.enrollSubjectID

        if not enroll:
            return Response({'success': True, 'count': 0, 'data': []})

        subject_class_pairs = [
            (e.subjectID_id, e.classID_id)
            for e in enroll.enrollments.all()
            if e.classID_id
        ]

        if not subject_class_pairs:
            return Response({'success': True, 'count': 0, 'data': []})

        year = get_active_year(request)
        unique_subject_ids = {sid for sid, _ in subject_class_pairs}
        subject_map = {
            s.subjectID: s
            for s in Subject.objects.filter(subjectID__in=unique_subject_ids)
        }

        mark_field = f'{self.exam_field}mark'
        grade_field = f'{self.exam_field}grade'
        rows = []

        for subject_id, class_id in subject_class_pairs:
            subject = subject_map.get(subject_id)
            if subject is None:
                continue

            students = (
                User.objects
                .filter(
                    studentID__isnull=False,
                    studentID__classID_id=class_id,
                    studentID__enrollSubjectID__enrollments__subjectID_id=subject_id,
                )
                .select_related('studentID__classID')
                .prefetch_related('headcounts__subjectID')
                .distinct()
                .order_by('name')
            )
            if year:
                students = students.filter(year=year)

            for user in students:
                # Use Python lookup over prefetch cache — avoids 1 DB query per student
                headcount = next(
                    (hc for hc in user.headcounts.all() if hc.subjectID_id == subject_id),
                    None
                )
                if headcount is not None:
                    headcount_id = headcount.headcountID
                    mark  = getattr(headcount, mark_field)
                    grade = getattr(headcount, grade_field)
                else:
                    headcount_id = None
                    mark  = None
                    grade = None

                class_name = user.studentID.classID.className if user.studentID.classID else None

                rows.append({
                    'headcountID': headcount_id,
                    'userID':      user.userID,
                    'studentName': user.name,
                    'className':   class_name,
                    'subjectID':   subject_id,
                    'subjectName': subject.subjectName,
                    'subjectCode': subject.subjectCode,
                    mark_field:    mark,
                    grade_field:   grade,
                })

        serializer = self.list_serializer(rows, many=True)
        return Response({'success': True, 'count': len(rows), 'data': serializer.data})

    def partial_update(self, request, pk=None):
        try:
            instance = Headcount.objects.get(headcountID=pk)
        except Headcount.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Headcount record not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = self.update_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance.refresh_from_db()

        # ── Auto-recalculate OTI1 / OTI2 after mark change ─────────────────────
        def _val(mark, grade):
            if mark is not None: return float(mark)
            if grade == 'TH':    return 0.0
            return None

        oti_fields = []
        recalc_oti1 = self.exam_field in ('TOV', 'ETR')
        recalc_oti2 = self.exam_field in ('AR1', 'ETR')

        if recalc_oti1:
            tov = _val(instance.TOVmark, instance.TOVgrade)
            etr = _val(instance.ETRmark, instance.ETRgrade)
            if tov is not None and etr is not None:
                oti1 = round(tov + (etr - tov) * (1 / 3))
                instance.OTI1mark  = oti1
                instance.OTI1grade = _grade(oti1)
            else:
                instance.OTI1mark  = None
                instance.OTI1grade = None
            oti_fields += ['OTI1mark', 'OTI1grade']

        if recalc_oti2:
            ar1 = _val(instance.AR1mark, instance.AR1grade)
            etr = _val(instance.ETRmark, instance.ETRgrade)
            if ar1 is not None and etr is not None:
                oti2 = round(ar1 + (etr - ar1) * (1 / 2))
                instance.OTI2mark  = oti2
                instance.OTI2grade = _grade(oti2)
            else:
                instance.OTI2mark  = None
                instance.OTI2grade = None
            oti_fields += ['OTI2mark', 'OTI2grade']

        if oti_fields:
            instance.save(update_fields=oti_fields)

        return Response({
            'success': True,
            'message': f'{self.exam_field} berjaya dikemaskini.',
            'data': {
                'headcountID':             instance.headcountID,
                f'{self.exam_field}mark':  getattr(instance, f'{self.exam_field}mark'),
                f'{self.exam_field}grade': getattr(instance, f'{self.exam_field}grade'),
            },
        })

    # ── Bulk upload ────────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='download-marks-template',
            parser_classes=(MultiPartParser, FormParser))
    def download_marks_template(self, request):
        """GET /{exam}/download-marks-template/ — pre-populated flat CSV for subject teacher."""
        current_user = request.user
        if not current_user.teacherID or 'Subject Teacher' not in current_user.role:
            return Response({'success': False, 'message': 'Hanya Guru Mata Pelajaran boleh memuat turun template ini'},
                            status=status.HTTP_403_FORBIDDEN)

        mark_field   = f'{self.exam_field}mark'
        teacher      = current_user.teacherID
        enroll       = teacher.enrollSubjectID
        session_year = get_active_year(request)

        headers = ['Student Name', 'Class Name', 'Subject Name', 'Mark']
        # Student Name(0), Class Name(1), Subject Name(2) are read-only
        readonly_cols = {0, 1, 2}
        data_rows = []

        if enroll:
            subject_class_pairs = [
                (e.subjectID_id, e.classID_id)
                for e in enroll.enrollments.all()
                if e.classID_id
            ]
            unique_subject_ids_tmpl = {sid for sid, _ in subject_class_pairs}
            subject_map_tmpl = {
                s.subjectID: s
                for s in Subject.objects.filter(subjectID__in=unique_subject_ids_tmpl)
            }
            for subject_id, class_id in subject_class_pairs:
                subject = subject_map_tmpl.get(subject_id)
                if subject is None:
                    continue
                students = (
                    User.objects
                    .filter(studentID__isnull=False, studentID__classID_id=class_id,
                            studentID__enrollSubjectID__enrollments__subjectID_id=subject_id)
                    .select_related('studentID__classID')
                    .prefetch_related('headcounts')
                    .distinct().order_by('name')
                )
                if session_year:
                    students = students.filter(year=session_year)
                for user in students:
                    hc = next(
                        (h for h in user.headcounts.all() if h.subjectID_id == subject_id),
                        None
                    )
                    if hc is None:
                        continue
                    class_name    = (user.studentID.classID.className or '') if (user.studentID and user.studentID.classID) else ''
                    current_mark  = getattr(hc, mark_field, None)
                    current_grade = getattr(hc, f'{self.exam_field}grade', None)
                    mark_cell     = 'TH' if current_grade == 'TH' else ('' if current_mark is None else str(current_mark))
                    data_rows.append([user.name, class_name, subject.subjectName, mark_cell])

        return make_xlsx_response(
            filename=f'template_{self.exam_field.lower()}_markah.xlsx',
            headers=headers,
            rows=data_rows,
            readonly_cols=readonly_cols,
            number_cols={3},  # 'Mark' column
        )

    @action(detail=False, methods=['post'], url_path='upload-marks',
            parser_classes=(MultiPartParser, FormParser))
    def upload_marks(self, request):
        """POST /{exam}/upload-marks/ — bulk update marks from flat CSV."""
        current_user = request.user
        if not current_user.teacherID or 'Subject Teacher' not in current_user.role:
            return Response({'success': False, 'message': 'Hanya Guru Mata Pelajaran boleh memuat naik markah ini'},
                            status=status.HTTP_403_FORBIDDEN)

        teacher = current_user.teacherID
        enroll  = teacher.enrollSubjectID
        if not enroll:
            return Response({'success': False, 'message': 'Tiada mata pelajaran ditetapkan kepada anda'},
                            status=status.HTTP_403_FORBIDDEN)
        teacher_subject_ids = set(enroll.enrollments.values_list('subjectID_id', flat=True))

        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'success': False, 'message': 'Tiada fail dimuat naik'}, status=status.HTTP_400_BAD_REQUEST)
        if not csv_file.name.endswith('.xlsx'):
            return Response({'success': False, 'message': 'Fail mestilah dalam format Excel (.xlsx)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows       = read_upload_rows(csv_file)
            fieldnames = [f.strip() for f in (list(rows[0].keys()) if rows else [])]
            fieldnames_set = set(fieldnames)
            required   = {'Student Name', 'Class Name', 'Subject Name', 'Mark'}

            wrong = detect_wrong_template(fieldnames_set, expected_template='marks', required_cols=required)
            if wrong:
                return Response({'success': False, **wrong}, status=status.HTTP_400_BAD_REQUEST)

            mark_field   = f'{self.exam_field}mark'
            grade_field  = f'{self.exam_field}grade'
            session_year = get_active_year(request)
            success_count, error_count, errors = 0, 0, []

            caches = build_upload_caches(session_year, subject_filter_ids=teacher_subject_ids)
            subject_cache      = caches['subject_cache']
            subject_duplicates = caches['subject_duplicates']
            student_cache      = caches['student_cache']
            student_duplicates = caches['student_duplicates']
            hc_cache           = caches['hc_cache']

            hcs_to_update: list = []

            for row_num, row in enumerate(rows, start=2):
                try:
                    student_name = row.get('Student Name', '').strip()
                    class_name   = row.get('Class Name', '').strip()
                    subject_name = row.get('Subject Name', '').strip()
                    mark_str     = row.get('Mark', '').strip()

                    if not student_name:
                        errors.append(f"Baris {row_num}: Nama pelajar diperlukan"); error_count += 1; continue
                    if not subject_name:
                        errors.append(f"Baris {row_num}: Nama mata pelajaran diperlukan"); error_count += 1; continue

                    skey = (student_name.lower(), class_name.lower())
                    if skey in student_duplicates:
                        errors.append(f"Baris {row_num}: Nama '{student_name}' tidak unik dalam kelas '{class_name}'"); error_count += 1; continue
                    user = student_cache.get(skey)
                    if user is None:
                        errors.append(f"Baris {row_num}: Pelajar '{student_name}' kelas '{class_name}' tidak dijumpai"); error_count += 1; continue

                    ckey = subject_name.lower()
                    if ckey in subject_duplicates:
                        errors.append(f"Baris {row_num}: Mata pelajaran '{subject_name}' tidak unik"); error_count += 1; continue
                    subject = subject_cache.get(ckey)
                    if subject is None:
                        errors.append(f"Baris {row_num}: Mata pelajaran '{subject_name}' tidak dijumpai atau anda tidak ditetapkan untuknya"); error_count += 1; continue

                    hc = hc_cache.get((str(user.pk), str(subject.pk)))
                    if hc is None:
                        errors.append(f"Baris {row_num}: '{student_name}' tidak didaftarkan dalam '{subject_name}'"); error_count += 1; continue

                    if mark_str == '':
                        success_count += 1; continue

                    ok, err_msg = apply_mark(hc, mark_field, grade_field, mark_str)
                    if not ok:
                        errors.append(f"Baris {row_num}: {err_msg}"); error_count += 1; continue
                    hcs_to_update.append(hc)
                    success_count += 1

                except Exception as e:
                    errors.append(f"Baris {row_num}: {str(e)}"); error_count += 1

            # Single bulk write instead of one save() per mark
            if hcs_to_update:
                Headcount.objects.bulk_update(hcs_to_update, [mark_field, grade_field])

                # Recalculate OTI after bulk upload
                recalc_oti1 = self.exam_field == 'ETR'
                recalc_oti2 = self.exam_field in ('AR1', 'ETR')

                if recalc_oti1 or recalc_oti2:
                    def _val(mark, grade):
                        if mark is not None: return float(mark)
                        if grade == 'TH':    return 0.0
                        return None

                    oti_fields = []
                    for hc in hcs_to_update:
                        if recalc_oti1:
                            tov = _val(hc.TOVmark, hc.TOVgrade)
                            etr = _val(hc.ETRmark, hc.ETRgrade)
                            if tov is not None and etr is not None:
                                oti1 = round(tov + (etr - tov) * (1 / 3))
                                hc.OTI1mark  = oti1
                                hc.OTI1grade = _grade(oti1)
                            else:
                                hc.OTI1mark  = None
                                hc.OTI1grade = None
                        if recalc_oti2:
                            ar1 = _val(hc.AR1mark, hc.AR1grade)
                            etr = _val(hc.ETRmark, hc.ETRgrade)
                            if ar1 is not None and etr is not None:
                                oti2 = round(ar1 + (etr - ar1) * (1 / 2))
                                hc.OTI2mark  = oti2
                                hc.OTI2grade = _grade(oti2)
                            else:
                                hc.OTI2mark  = None
                                hc.OTI2grade = None
                    if recalc_oti1:
                        oti_fields += ['OTI1mark', 'OTI1grade']
                    if recalc_oti2:
                        oti_fields += ['OTI2mark', 'OTI2grade']
                    Headcount.objects.bulk_update(hcs_to_update, oti_fields)

            return Response({
                'success': True,
                'message': f'{success_count} rekod berjaya dikemaskini, {error_count} gagal',
                'successCount': success_count, 'errorCount': error_count, 'errors': errors,
            })

        except Exception as e:
            return Response({'success': False, 'message': f'Ralat memproses fail: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AR1ViewSet(TeacherExamViewSet):
    exam_field        = 'AR1'
    list_serializer   = AR1RowSerializer
    update_serializer = AR1UpdateSerializer


class AR2ViewSet(TeacherExamViewSet):
    exam_field        = 'AR2'
    list_serializer   = AR2RowSerializer
    update_serializer = AR2UpdateSerializer


class ETRViewSet(TeacherExamViewSet):
    exam_field        = 'ETR'
    list_serializer   = ETRRowSerializer
    update_serializer = ETRUpdateSerializer
