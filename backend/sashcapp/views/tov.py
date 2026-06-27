import csv
import io

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Headcount, Subject, User
from ..serializers import TOVStudentSerializer, TOVUpdateSerializer
from .utils import get_active_year, apply_mark, build_upload_caches, _grade, make_xlsx_response, read_upload_rows, detect_wrong_template


class TOVViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Returns one row per student containing their enrolled subjects
        with TOVmark and TOVgrade from the Headcount table.
        """
        year = get_active_year(request)
        students = (
            User.objects
            .filter(studentID__isnull=False)
            .select_related('studentID__classID', 'studentID__enrollSubjectID')
            .prefetch_related(
                'headcounts__subjectID',
                'studentID__enrollSubjectID__enrollments__subjectID',
            )
            .order_by('name')
        )
        if year:
            students = students.filter(year=year)

        rows = []
        for user in students:
            hc_map = {
                str(hc.subjectID_id): hc
                for hc in user.headcounts.all()
            }

            enroll = user.studentID.enrollSubjectID if user.studentID else None
            enrolled_subject_ids = set()

            if enroll:
                for enrollment in enroll.enrollments.all():
                    enrolled_subject_ids.add(enrollment.subjectID)

            subjects_data = []
            for subj in sorted(enrolled_subject_ids, key=lambda s: (s.subjectCode or '')):
                hc = hc_map.get(str(subj.subjectID))
                subjects_data.append({
                    'headcountID': hc.headcountID if hc else None,
                    'subjectID':   subj.subjectID,
                    'subjectCode': subj.subjectCode,
                    'subjectName': subj.subjectName,
                    'TOVmark':     hc.TOVmark  if hc else None,
                    'TOVgrade':    hc.TOVgrade if hc else None,
                })

            class_name = None
            if user.studentID and user.studentID.classID:
                class_name = user.studentID.classID.className

            rows.append({
                'userID':    user.userID,
                'name':      user.name,
                'className': class_name,
                'subjects':  subjects_data,
            })

        serializer = TOVStudentSerializer(rows, many=True)
        return Response({'success': True, 'count': len(rows), 'data': serializer.data})

    def partial_update(self, request, pk=None):
        """PATCH /tov/{headcountID}/ — update TOVmark and TOVgrade only."""
        try:
            instance = Headcount.objects.get(headcountID=pk)
        except Headcount.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Headcount record not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TOVUpdateSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance.refresh_from_db()

        # ── Auto-recalculate OTI1 after TOV change ──────────────────────────────
        def _val(mark, grade):
            if mark is not None: return float(mark)
            if grade == 'TH':    return 0.0
            return None

        tov = _val(instance.TOVmark, instance.TOVgrade)
        etr = _val(instance.ETRmark, instance.ETRgrade)
        if tov is not None and etr is not None:
            oti1 = round(tov + (etr - tov) * (1 / 3))
            instance.OTI1mark  = oti1
            instance.OTI1grade = _grade(oti1)
        else:
            instance.OTI1mark  = None
            instance.OTI1grade = None
        instance.save(update_fields=['OTI1mark', 'OTI1grade'])

        return Response({'success': True, 'message': 'TOV berjaya dikemaskini.', 'data': serializer.data})

    @action(detail=True, methods=['patch'], url_path='clear')
    def clear_tov(self, request, pk=None):
        """PATCH /tov/{userID}/clear/ — nullify all TOV marks & grades for a student."""
        updated = Headcount.objects.filter(userID=pk).update(
            TOVmark=None, TOVgrade=None, OTI1mark=None, OTI1grade=None
        )
        return Response({
            'success': True,
            'message': f'TOV berjaya dipadamkan ({updated} rekod dikemaskini).',
        })

    # ── Bulk upload ────────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='download-marks-template',
            parser_classes=(MultiPartParser, FormParser))
    def download_marks_template(self, request):
        """GET /tov/download-marks-template/ — pre-populated CSV with real student data."""
        if 'Admin' not in request.user.role:
            return Response({'success': False, 'message': 'Hanya Admin boleh memuat turun template TOV'},
                            status=status.HTTP_403_FORBIDDEN)

        session_year = get_active_year(request)
        subject_qs = Subject.objects.all().order_by('subjectName')
        if session_year:
            subject_qs = subject_qs.filter(year=session_year)

        subject_list    = [(s.subjectCode or str(s.subjectID), s.subjectID) for s in subject_qs]
        all_codes       = sorted([code for code, _ in subject_list])
        subj_id_to_code = {str(sid): code for code, sid in subject_list}

        headers = ['Student Name', 'Class Name'] + all_codes
        # Student Name(0) and Class Name(1) are read-only
        readonly_cols = {0, 1}
        data_rows = []

        students = (
            User.objects.filter(studentID__isnull=False)
            .select_related('studentID__classID')
            .prefetch_related('headcounts__subjectID')
            .order_by('studentID__classID__className', 'name')
        )
        if session_year:
            students = students.filter(year=session_year)

        for user in students:
            class_name = (user.studentID.classID.className
                          if user.studentID and user.studentID.classID else '')
            mark_map = {}
            for hc in user.headcounts.all():
                code = subj_id_to_code.get(str(hc.subjectID_id))
                if code:
                    mark_map[code] = 'TH' if hc.TOVgrade == 'TH' else ('' if hc.TOVmark is None else str(hc.TOVmark))
            data_rows.append([user.name, class_name] + [mark_map.get(c, '') for c in all_codes])

        return make_xlsx_response(
            filename='template_tov_markah.xlsx',
            headers=headers,
            rows=data_rows,
            readonly_cols=readonly_cols,
            number_cols=set(range(2, len(headers))),  # all subject code columns
        )

    @action(detail=False, methods=['post'], url_path='upload-marks',
            parser_classes=(MultiPartParser, FormParser))
    def upload_marks(self, request):
        """POST /tov/upload-marks/ — bulk update TOV marks from pivot CSV."""
        if 'Admin' not in request.user.role:
            return Response({'success': False, 'message': 'Hanya Admin boleh memuat naik markah TOV'},
                            status=status.HTTP_403_FORBIDDEN)

        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'success': False, 'message': 'Tiada fail dimuat naik'}, status=status.HTTP_400_BAD_REQUEST)
        if not csv_file.name.endswith('.xlsx'):
            return Response({'success': False, 'message': 'Fail mestilah dalam format Excel (.xlsx)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows       = read_upload_rows(csv_file)
            fieldnames = [f.strip() for f in (list(rows[0].keys()) if rows else [])]
            fieldnames_set = set(fieldnames)
            required   = {'Student Name', 'Class Name'}

            wrong = detect_wrong_template(fieldnames_set, expected_template='tov', required_cols=required)
            if wrong:
                return Response({'success': False, **wrong}, status=status.HTTP_400_BAD_REQUEST)

            subject_cols  = [f for f in fieldnames if f not in required]
            session_year  = get_active_year(request)
            success_count, error_count, errors = 0, 0, []

            caches = build_upload_caches(session_year, subject_key='code')
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
                    if not student_name:
                        errors.append(f"Baris {row_num}: Nama pelajar diperlukan"); error_count += 1; continue

                    skey = (student_name.lower(), class_name.lower())
                    if skey in student_duplicates:
                        errors.append(f"Baris {row_num}: Nama '{student_name}' tidak unik dalam kelas '{class_name}'"); error_count += 1; continue
                    user = student_cache.get(skey)
                    if user is None:
                        errors.append(f"Baris {row_num}: Pelajar '{student_name}' kelas '{class_name}' tidak dijumpai"); error_count += 1; continue

                    for subj_code in subject_cols:
                        mark_str = (row.get(subj_code) or '').strip()
                        if mark_str == '':
                            continue

                        ckey = subj_code.lower()
                        if ckey in subject_duplicates:
                            errors.append(f"Baris {row_num}: Mata pelajaran '{subj_code}' tidak unik"); error_count += 1; continue
                        subject = subject_cache.get(ckey)
                        if subject is None:
                            errors.append(f"Baris {row_num}: Mata pelajaran '{subj_code}' tidak dijumpai"); error_count += 1; continue

                        hc = hc_cache.get((str(user.pk), str(subject.pk)))
                        if hc is None:
                            errors.append(f"Baris {row_num}: '{student_name}' tidak didaftarkan dalam '{subj_code}'"); error_count += 1; continue

                        ok, err_msg = apply_mark(hc, 'TOVmark', 'TOVgrade', mark_str)
                        if not ok:
                            errors.append(f"Baris {row_num}, {subj_code}: {err_msg}"); error_count += 1; continue
                        hcs_to_update.append(hc)
                        success_count += 1

                except Exception as e:
                    errors.append(f"Baris {row_num}: {str(e)}"); error_count += 1

            # Single bulk write instead of one save() per mark
            if hcs_to_update:
                Headcount.objects.bulk_update(hcs_to_update, ['TOVmark', 'TOVgrade'])

                # Recalculate OTI1 for all updated records (TOV changed)
                def _val(mark, grade):
                    if mark is not None: return float(mark)
                    if grade == 'TH':    return 0.0
                    return None

                for hc in hcs_to_update:
                    tov = _val(hc.TOVmark, hc.TOVgrade)
                    etr = _val(hc.ETRmark, hc.ETRgrade)
                    if tov is not None and etr is not None:
                        oti1 = round(tov + (etr - tov) * (1 / 3))
                        hc.OTI1mark  = oti1
                        hc.OTI1grade = _grade(oti1)
                    else:
                        hc.OTI1mark  = None
                        hc.OTI1grade = None
                Headcount.objects.bulk_update(hcs_to_update, ['OTI1mark', 'OTI1grade'])

            return Response({
                'success': True,
                'message': f'{success_count} rekod berjaya dikemaskini, {error_count} gagal',
                'successCount': success_count, 'errorCount': error_count, 'errors': errors,
            })

        except Exception as e:
            return Response({'success': False, 'message': f'Ralat memproses fail: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
