from collections import defaultdict

from django.db.models import Q

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Headcount, Subject, User
from ..serializers import (
    ExamAnalysisRowSerializer,
    SelfAnalysisSubjectRowSerializer,
    StudentAnalysisRowSerializer,
)
from .utils import get_active_year, VALID_EXAMS, GRADE_KEYS, GP_WEIGHTS, calc_gp, empty_grade_counts, lulus_status


# ─────────────────────────────────────────
# Exam Analysis (View-Only)
# ─────────────────────────────────────────

class ExamAnalysisViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Returns exam analysis statistics for a specific exam (TOV, AR1, AR2, ETR).
        Query parameter: exam (required)
        """
        exam_type = request.query_params.get('exam')

        if not exam_type:
            return Response({
                'success': False,
                'message': 'exam parameter is required (TOV, AR1, AR2, ETR)',
                'data': [],
            }, status=status.HTTP_400_BAD_REQUEST)

        if exam_type not in VALID_EXAMS:
            return Response({
                'success': False,
                'message': f'Invalid exam type. Must be one of: {", ".join(VALID_EXAMS)}',
                'data': [],
            }, status=status.HTTP_400_BAD_REQUEST)

        mark_field = f'{exam_type}mark'
        grade_field = f'{exam_type}grade'

        year = get_active_year(request)
        subjects = Subject.objects.all()
        if year:
            subjects = subjects.filter(year=year)

        # Fetch ALL headcounts for all subjects in ONE query instead of N queries
        headcounts_qs = Headcount.objects.filter(subjectID__in=subjects)
        if year:
            headcounts_qs = headcounts_qs.filter(userID__year=year)

        hc_grades_by_subject = defaultdict(list)
        for hc in headcounts_qs.values('subjectID_id', grade_field):
            hc_grades_by_subject[str(hc['subjectID_id'])].append(hc[grade_field])

        rows = []

        for subject in subjects:
            grades = hc_grades_by_subject.get(str(subject.subjectID), [])
            total_enrolled = len(grades)
            if total_enrolled == 0:
                continue

            grade_counts = empty_grade_counts(include_th=True)

            for grade in grades:
                if grade and grade in grade_counts:
                    grade_counts[grade] += 1

            tidak_hadir = grade_counts['TH']
            ambil = total_enrolled - tidak_hadir
            grade_g = grade_counts['G']

            lulus_bil = sum(grade_counts[g] for g in ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E'])

            gagal_persen = (grade_g / ambil * 100) if ambil > 0 else 0
            lulus_persen = (lulus_bil / ambil * 100) if ambil > 0 else 0

            gpmp = calc_gp(grade_counts, ambil)

            rows.append({
                'subjectID': str(subject.subjectID),
                'subjectName': subject.subjectName,
                'subjectCode': subject.subjectCode,
                'ambil': ambil,
                'tidakHadir': tidak_hadir,
                'gradeAPlus': grade_counts['A+'],
                'gradeA': grade_counts['A'],
                'gradeAMinus': grade_counts['A-'],
                'gradeBPlus': grade_counts['B+'],
                'gradeB': grade_counts['B'],
                'gradeCPlus': grade_counts['C+'],
                'gradeC': grade_counts['C'],
                'gradeD': grade_counts['D'],
                'gradeE': grade_counts['E'],
                'gradeG': grade_g,
                'gagalPersen': f'{gagal_persen:.2f}',
                'lulusBil': lulus_bil,
                'lulusPersen': f'{lulus_persen:.2f}',
                'gpmp': f'{gpmp:.2f}',
            })

        # ── Student-level pass/fail (BM >= 40 AND SEJ >= 40) ──────────────────
        bm_subjects = Subject.objects.filter(
            Q(subjectCode__iexact='BM') | Q(subjectName__iexact='Bahasa Melayu')
        )
        sej_subjects = Subject.objects.filter(
            Q(subjectCode__iexact='SEJ') | Q(subjectName__iexact='Sejarah')
        )
        if year:
            bm_subjects  = bm_subjects.filter(year=year)
            sej_subjects = sej_subjects.filter(year=year)

        student_qs = User.objects.filter(studentID__isnull=False)
        if year:
            student_qs = student_qs.filter(year=year)
        total_students = student_qs.count()

        bm_hc_qs  = Headcount.objects.filter(subjectID__in=bm_subjects)
        sej_hc_qs = Headcount.objects.filter(subjectID__in=sej_subjects)
        if year:
            bm_hc_qs  = bm_hc_qs.filter(userID__year=year)
            sej_hc_qs = sej_hc_qs.filter(userID__year=year)

        bm_pass_ids  = set(bm_hc_qs.filter(**{f'{mark_field}__gte': 40}).exclude(**{f'{grade_field}': 'TH'}).values_list('userID_id', flat=True))
        sej_pass_ids = set(sej_hc_qs.filter(**{f'{mark_field}__gte': 40}).exclude(**{f'{grade_field}': 'TH'}).values_list('userID_id', flat=True))
        lulus_ids  = bm_pass_ids & sej_pass_ids
        lulus_bil  = len(lulus_ids)
        gagal_bil  = total_students - lulus_bil
        lulus_persen = (lulus_bil / total_students * 100) if total_students > 0 else 0
        gagal_persen = (gagal_bil / total_students * 100) if total_students > 0 else 0

        student_summary = {
            'totalStudents': total_students,
            'lulusBil':    lulus_bil,
            'lulusPersen': f'{lulus_persen:.2f}',
            'gagalBil':    gagal_bil,
            'gagalPersen': f'{gagal_persen:.2f}',
        }

        serializer = ExamAnalysisRowSerializer(rows, many=True)
        return Response({
            'success': True,
            'count': len(rows),
            'exam': exam_type,
            'data': serializer.data,
            'studentSummary': student_summary,
        })


# ─────────────────────────────────────────
# Student Analysis (View-Only)
# ─────────────────────────────────────────

class StudentAnalysisViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Returns student-wise analysis for a specific exam (TOV, AR1, AR2, ETR).
        Query parameter: exam (required)
        """
        exam_type = request.query_params.get('exam')

        if not exam_type:
            return Response({
                'success': False,
                'message': 'exam parameter is required (TOV, AR1, AR2, ETR)',
                'data': [],
            }, status=status.HTTP_400_BAD_REQUEST)

        if exam_type not in VALID_EXAMS:
            return Response({
                'success': False,
                'message': f'Invalid exam type. Must be one of: {", ".join(VALID_EXAMS)}',
                'data': [],
            }, status=status.HTTP_400_BAD_REQUEST)

        mark_field  = f'{exam_type}mark'
        grade_field = f'{exam_type}grade'

        user = request.user
        user_role = user.role or []

        is_admin = 'Admin' in user_role
        is_class_teacher = 'Class Teacher' in user_role

        year = get_active_year(request)

        if is_admin:
            students = (User.objects
                .filter(studentID__isnull=False)
                .select_related('studentID__classID')
                .prefetch_related('headcounts__subjectID')
                .order_by('name'))
            if year:
                students = students.filter(year=year)
        elif is_class_teacher:
            try:
                if not user.teacherID:
                    return Response({
                        'success': False,
                        'message': 'Anda tidak mempunyai profil guru',
                        'data': [],
                    }, status=status.HTTP_403_FORBIDDEN)

                from ..models import Class
                managed_class = Class.objects.filter(teacherID=user.teacherID).first()

                if not managed_class:
                    return Response({
                        'success': False,
                        'message': 'Anda tidak mempunyai kelas yang ditetapkan',
                        'data': [],
                    }, status=status.HTTP_403_FORBIDDEN)

                students = (User.objects.filter(
                    studentID__isnull=False,
                    studentID__classID=managed_class,
                )
                .select_related('studentID__classID')
                .prefetch_related('headcounts__subjectID')
                .order_by('name'))
                if year:
                    students = students.filter(year=year)

            except Exception as e:
                return Response({
                    'success': False,
                    'message': f'Error: {str(e)}',
                    'data': [],
                }, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({
                'success': False,
                'message': f'Akses ditolak. Role: {user_role}. Hanya Admin dan Class Teacher boleh akses.',
                'data': [],
            }, status=status.HTTP_403_FORBIDDEN)

        rows = []
        for student in students:
            headcounts = list(student.headcounts.all())  # uses prefetch cache — no DB query

            if not headcounts:
                continue

            # Match HeadcountSlip: only count subjects with actual letter grades (exclude TH/None)
            grade_counts = empty_grade_counts(include_th=False)
            total_subjects = 0
            bm_mark = None
            sej_mark = None

            for hc in headcounts:
                grade = getattr(hc, grade_field, None)
                if grade and grade in grade_counts:
                    grade_counts[grade] += 1
                    total_subjects += 1

                try:
                    subject_code = hc.subjectID.subjectCode if hc.subjectID else None
                    mark = getattr(hc, mark_field, None)
                    if subject_code == 'BM':
                        bm_mark = mark
                    elif subject_code == 'SEJ':
                        sej_mark = mark
                except AttributeError:
                    pass

            if total_subjects == 0:
                continue

            grade_summary_parts = []
            for grade in GRADE_KEYS:
                count = grade_counts[grade]
                if count > 0:
                    grade_summary_parts.append(f"{count}{grade}")

            grade_summary = ", ".join(grade_summary_parts) if grade_summary_parts else "—"
            gpi = calc_gp(grade_counts, total_subjects)

            rows.append({
                'userID': str(student.userID),
                'studentName': student.name,
                'className': student.studentID.classID.className if student.studentID.classID else None,
                'totalSubjects': total_subjects,
                'gradeAPlus': grade_counts['A+'],
                'gradeA': grade_counts['A'],
                'gradeAMinus': grade_counts['A-'],
                'gradeBPlus': grade_counts['B+'],
                'gradeB': grade_counts['B'],
                'gradeCPlus': grade_counts['C+'],
                'gradeC': grade_counts['C'],
                'gradeD': grade_counts['D'],
                'gradeE': grade_counts['E'],
                'gradeG': grade_counts['G'],
                'gradeTH': 0,
                'gradeSummary': grade_summary,
                'status': lulus_status(bm_mark, sej_mark),
                'gpi': f'{gpi:.2f}',
            })

        serializer = StudentAnalysisRowSerializer(rows, many=True)
        return Response({
            'success': True,
            'count': len(rows),
            'exam': exam_type,
            'data': serializer.data,
        })


# ─────────────────────────────────────────
# Student Self Analysis (View-Only)
# ─────────────────────────────────────────

class StudentSelfAnalysisViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Returns the logged-in student's own analysis for a specific exam.
        Query parameter: exam (required - TOV, AR1, AR2, ETR)
        Access: Student role only.
        """
        exam_type = request.query_params.get('exam')

        if not exam_type:
            return Response({
                'success': False,
                'message': 'exam parameter is required (TOV, AR1, AR2, ETR)',
                'data': [],
            }, status=status.HTTP_400_BAD_REQUEST)

        if exam_type not in VALID_EXAMS:
            return Response({
                'success': False,
                'message': f'Invalid exam type. Must be one of: {", ".join(VALID_EXAMS)}',
                'data': [],
            }, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user_role = user.role or []

        if 'Student' not in user_role:
            return Response({
                'success': False,
                'message': 'Akses ditolak. Hanya pelajar boleh akses.',
                'data': [],
            }, status=status.HTTP_403_FORBIDDEN)

        if not user.studentID:
            return Response({
                'success': False,
                'message': 'Profil pelajar tidak dijumpai',
                'data': [],
            }, status=status.HTTP_403_FORBIDDEN)

        mark_field  = f'{exam_type}mark'
        grade_field = f'{exam_type}grade'

        headcounts = (
            Headcount.objects
            .filter(userID=user)
            .select_related('subjectID')
            .order_by('subjectID__subjectName')
        )

        if not headcounts.exists():
            return Response({
                'success': True,
                'count': 0,
                'exam': exam_type,
                'data': [],
                'gpi': None,
                'status': None,
            })

        rows = []
        grade_counts = empty_grade_counts()
        bm_mark = None
        sej_mark = None
        total_subjects = 0

        for hc in headcounts:
            mark  = getattr(hc, mark_field, None)
            grade = getattr(hc, grade_field, None)

            if grade and grade in grade_counts:
                grade_counts[grade] += 1
                total_subjects += 1

            try:
                subject_code = hc.subjectID.subjectCode if hc.subjectID else None
                if subject_code == 'BM':
                    bm_mark = mark
                elif subject_code == 'SEJ':
                    sej_mark = mark
            except AttributeError:
                pass

            rows.append({
                'subjectID': str(hc.subjectID.subjectID),
                'subjectName': hc.subjectID.subjectName,
                'subjectCode': hc.subjectID.subjectCode,
                'mark': mark,
                'grade': grade,
            })

        gpi_value = calc_gp(grade_counts, total_subjects)

        gpi_row = {
            'subjectID': None,
            'subjectName': 'GPI',
            'subjectCode': None,
            'mark': None,
            'grade': f'{gpi_value:.2f}',
        }

        data_serializer = SelfAnalysisSubjectRowSerializer(rows, many=True)
        gpi_serializer  = SelfAnalysisSubjectRowSerializer(gpi_row)
        return Response({
            'success': True,
            'count': len(rows),
            'exam': exam_type,
            'data': data_serializer.data,
            'gpi': gpi_serializer.data,
            'status': lulus_status(bm_mark, sej_mark),
        })
