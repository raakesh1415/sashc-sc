from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Class, Headcount, Teacher, User
from ..serializers import HeadcountSlipDetailSerializer, HeadcountSlipStudentSerializer
from .utils import get_active_year, GRADE_KEYS, calc_gp

_ALL_EXAMS = ['TOV', 'AR1', 'OTI1', 'AR2', 'OTI2', 'ETR']


def _build_exam_summaries(headcounts, exams):
    """
    For each exam type, build a grade summary string and compute GPI.
    Returns (grade_summaries, gpis) — parallel lists aligned with `exams`.
    """
    grade_summaries = []
    gpis = []

    for exam in exams:
        grade_field  = f'{exam}grade'
        grade_counts = {g: 0 for g in GRADE_KEYS}
        total_subjects = 0

        for hc in headcounts:
            grade = getattr(hc, grade_field, None)
            if grade and grade in grade_counts:
                grade_counts[grade] += 1
                total_subjects += 1

        summary_parts = [
            f"{grade_counts[g]}{g}"
            for g in GRADE_KEYS
            if grade_counts[g] > 0
        ]
        grade_summaries.append(", ".join(summary_parts) if summary_parts else "—")
        gpis.append(f"{calc_gp(grade_counts, total_subjects):.2f}")

    return grade_summaries, gpis


def _build_subjects_list(headcounts, exams):
    subjects = []
    for hc in headcounts:
        marks  = [getattr(hc, f'{e}mark', None) for e in exams]
        grades = [getattr(hc, f'{e}grade', None) for e in exams]
        subjects.append({
            'subjectName': hc.subjectID.subjectName,
            'marks': marks,
            'grades': grades,
        })
    return subjects


def _get_class_teacher_name(student):
    try:
        return student.studentID.classID.teacherID.user_profile.name
    except AttributeError:
        return None


def _get_principal_name(year=None):
    try:
        qs = Teacher.objects.filter(is_principal=True).select_related('user_profile')
        if year:
            qs = qs.filter(user_profile__year=year)
        principal_teacher = qs.first()
        return principal_teacher.user_profile.name if principal_teacher else None
    except AttributeError:
        return None


# ─────────────────────────────────────────
# Headcount Slip (Admin / Class Teacher View)
# ─────────────────────────────────────────

class HeadcountSlipViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Returns list of students for headcount slip selection.
        Admin: all students. Class Teacher: only their class.
        """
        user = request.user

        if not (user.has_role(User.ADMIN) or user.has_role(User.CLASS_TEACHER)):
            return Response({
                'success': False,
                'message': 'Anda tidak mempunyai akses ke halaman ini',
                'data': [],
            }, status=status.HTTP_403_FORBIDDEN)

        year = get_active_year(request)
        students_qs = (
            User.objects
            .filter(studentID__isnull=False)
            .select_related('studentID__classID')
        )
        if year:
            students_qs = students_qs.filter(year=year)

        if user.has_role(User.ADMIN):
            students = students_qs.order_by('name')
        else:
            if not user.teacherID:
                return Response({
                    'success': False,
                    'message': 'Anda tidak mempunyai profil guru',
                    'data': [],
                }, status=status.HTTP_403_FORBIDDEN)

            try:
                assigned_class = Class.objects.get(teacherID=user.teacherID)
                students = students_qs.filter(studentID__classID=assigned_class).order_by('name')
            except Class.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Anda tidak diberikan mana-mana kelas',
                    'data': [],
                }, status=status.HTTP_403_FORBIDDEN)

        rows = [
            {
                'userID': str(s.userID),
                'studentName': s.name,
                'className': s.studentID.classID.className if s.studentID and s.studentID.classID else None,
            }
            for s in students
        ]

        serializer = HeadcountSlipStudentSerializer(rows, many=True)
        return Response({'success': True, 'count': len(rows), 'data': serializer.data})

    def retrieve(self, request, pk=None):
        """
        Returns detailed headcount slip data for a specific student.
        URL: /headcount-slip/{userID}/
        """
        user = request.user

        if not (user.has_role(User.ADMIN) or user.has_role(User.CLASS_TEACHER)):
            return Response(
                {'success': False, 'message': 'Anda tidak mempunyai akses'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            student = User.objects.select_related(
                'studentID__classID__teacherID__user_profile'
            ).get(userID=pk, studentID__isnull=False)
        except User.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Pelajar tidak dijumpai'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.has_role(User.CLASS_TEACHER) and not user.has_role(User.ADMIN):
            if not user.teacherID:
                return Response(
                    {'success': False, 'message': 'Anda tidak mempunyai profil guru'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            try:
                assigned_class = Class.objects.get(teacherID=user.teacherID)
                if not student.studentID or student.studentID.classID != assigned_class:
                    return Response(
                        {'success': False, 'message': 'Anda tidak mempunyai akses untuk melihat pelajar ini'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            except Class.DoesNotExist:
                return Response(
                    {'success': False, 'message': 'Anda tidak diberikan mana-mana kelas'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        headcounts = (
            Headcount.objects
            .filter(userID=student)
            .select_related('subjectID')
            .order_by('subjectID__subjectName')
        )

        grade_summaries, gpis = _build_exam_summaries(headcounts, _ALL_EXAMS)
        subjects = _build_subjects_list(headcounts, _ALL_EXAMS)

        slip_data = {
            'userID': str(student.userID),
            'studentName': student.name,
            'className': student.studentID.classID.className if student.studentID and student.studentID.classID else None,
            'classTeacherName': _get_class_teacher_name(student),
            'principalName': _get_principal_name(student.year),
            'exams': _ALL_EXAMS,
            'subjects': subjects,
            'gradeSummaries': grade_summaries,
            'gpis': gpis,
        }

        serializer = HeadcountSlipDetailSerializer(slip_data)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk(self, request):
        """
        POST /headcount-slip/bulk/
        Body: { "ids": ["uuid1", "uuid2", ...] }
        Returns all slip data in one request.
        """
        user = request.user
        if not (user.has_role(User.ADMIN) or user.has_role(User.CLASS_TEACHER)):
            return Response(
                {'success': False, 'message': 'Anda tidak mempunyai akses'},
                status=status.HTTP_403_FORBIDDEN,
            )

        ids = request.data.get('ids', [])
        if not ids:
            return Response({'success': True, 'data': []})

        year = get_active_year(request)

        students = (
            User.objects
            .filter(userID__in=ids, studentID__isnull=False)
            .select_related('studentID__classID__teacherID__user_profile')
        )
        if year:
            students = students.filter(year=year)

        # Class Teacher access check
        assigned_class = None
        if user.has_role(User.CLASS_TEACHER) and not user.has_role(User.ADMIN):
            if not user.teacherID:
                return Response(
                    {'success': False, 'message': 'Anda tidak mempunyai profil guru'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            try:
                assigned_class = Class.objects.get(teacherID=user.teacherID)
            except Class.DoesNotExist:
                return Response(
                    {'success': False, 'message': 'Anda tidak diberikan mana-mana kelas'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            students = students.filter(studentID__classID=assigned_class)

        # Pre-fetch all headcounts for all students in one query
        student_list = list(students)
        student_ids = [s.pk for s in student_list]
        all_headcounts = (
            Headcount.objects
            .filter(userID__in=student_ids)
            .select_related('subjectID')
            .order_by('subjectID__subjectName')
        )
        # Group headcounts by student pk
        from collections import defaultdict
        hc_by_student = defaultdict(list)
        for hc in all_headcounts:
            hc_by_student[hc.userID_id].append(hc)

        principal_name = _get_principal_name(year)

        results = []
        for student in student_list:
            headcounts = hc_by_student[student.pk]
            grade_summaries, gpis = _build_exam_summaries(headcounts, _ALL_EXAMS)
            subjects = _build_subjects_list(headcounts, _ALL_EXAMS)
            slip_data = {
                'userID': str(student.userID),
                'studentName': student.name,
                'className': student.studentID.classID.className if student.studentID and student.studentID.classID else None,
                'classTeacherName': _get_class_teacher_name(student),
                'principalName': principal_name,
                'exams': _ALL_EXAMS,
                'subjects': subjects,
                'gradeSummaries': grade_summaries,
                'gpis': gpis,
            }
            serializer = HeadcountSlipDetailSerializer(slip_data)
            results.append(serializer.data)

        return Response({'success': True, 'data': results})


# ─────────────────────────────────────────
# Student Headcount Slip (Student View)
# ─────────────────────────────────────────

class StudentHeadcountSlipViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Returns headcount slip data for the logged-in student only.
        Access: Student role only.
        """
        user = User.objects.select_related(
            'studentID__classID__teacherID__user_profile'
        ).get(pk=request.user.pk)

        if not user.studentID:
            return Response({
                'success': False,
                'message': 'Anda bukan pelajar',
                'data': None,
            }, status=status.HTTP_403_FORBIDDEN)

        headcounts = (
            Headcount.objects
            .filter(userID=user)
            .select_related('subjectID')
            .order_by('subjectID__subjectName')
        )

        grade_summaries, gpis = _build_exam_summaries(headcounts, _ALL_EXAMS)
        subjects = _build_subjects_list(headcounts, _ALL_EXAMS)

        slip_data = {
            'userID': str(user.userID),
            'studentName': user.name,
            'className': user.studentID.classID.className if user.studentID and user.studentID.classID else None,
            'classTeacherName': _get_class_teacher_name(user),
            'principalName': _get_principal_name(user.year),
            'exams': _ALL_EXAMS,
            'subjects': subjects,
            'gradeSummaries': grade_summaries,
            'gpis': gpis,
        }

        serializer = HeadcountSlipDetailSerializer(slip_data)
        return Response({'success': True, 'data': serializer.data})
