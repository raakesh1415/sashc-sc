from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Headcount, Subject, User
from ..serializers import OverallRankingRowSerializer, SubjectRankingRowSerializer
from .utils import get_active_year, VALID_EXAMS, GRADE_KEYS, calc_gp, lulus_status


# ─────────────────────────────────────────
# Overall Ranking (View-Only)
# ─────────────────────────────────────────

class OverallRankingViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Returns overall student rankings based on GPI for a specific exam.
        Query parameter: exam (required - TOV, AR1, AR2, ETR)
        Ranking: Lowest GPI = Rank 1 (Best)
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

        year = get_active_year(request)
        students = (User.objects
            .filter(studentID__isnull=False)
            .select_related('studentID__classID')
            .prefetch_related('headcounts__subjectID')
            .order_by('name'))
        if year:
            students = students.filter(year=year)

        student_gpis = []

        for student in students:
            headcounts = list(student.headcounts.all())  # uses prefetch cache — no DB query

            if not headcounts:
                continue

            grade_counts = {g: 0 for g in GRADE_KEYS}
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

            gpi = calc_gp(grade_counts, total_subjects)

            student_gpis.append({
                'userID': str(student.userID),
                'studentName': student.name,
                'className': student.studentID.classID.className if student.studentID.classID else None,
                'gpi': gpi,
                'status': lulus_status(bm_mark, sej_mark),
            })

        student_gpis.sort(key=lambda x: (0 if x['status'] == 'LULUS' else 1, x['gpi']))

        rows = [
            {
                'userID': d['userID'],
                'studentName': d['studentName'],
                'className': d['className'],
                'gpi': f"{d['gpi']:.2f}",
                'status': d['status'],
                'ranking': rank,
            }
            for rank, d in enumerate(student_gpis, start=1)
        ]

        serializer = OverallRankingRowSerializer(rows, many=True)
        return Response({
            'success': True,
            'count': len(rows),
            'exam': exam_type,
            'data': serializer.data,
        })


# ─────────────────────────────────────────
# Subject Ranking (View-Only)
# ─────────────────────────────────────────

class SubjectRankingViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Returns student rankings for a specific subject based on marks.
        Query parameters: exam (required), subjectID (required)
        Ranking: Highest Mark = Rank 1 (Best)
        """
        exam_type  = request.query_params.get('exam')
        subject_id = request.query_params.get('subjectID')

        if not exam_type:
            return Response({
                'success': False,
                'message': 'exam parameter is required (TOV, AR1, AR2, ETR)',
                'data': [],
            }, status=status.HTTP_400_BAD_REQUEST)

        if not subject_id:
            return Response({
                'success': False,
                'message': 'subjectID parameter is required',
                'data': [],
            }, status=status.HTTP_400_BAD_REQUEST)

        if exam_type not in VALID_EXAMS:
            return Response({
                'success': False,
                'message': f'Invalid exam type. Must be one of: {", ".join(VALID_EXAMS)}',
                'data': [],
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            subject = Subject.objects.get(subjectID=subject_id)
        except Subject.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Subject not found',
                'data': [],
            }, status=status.HTTP_404_NOT_FOUND)

        mark_field  = f'{exam_type}mark'
        grade_field = f'{exam_type}grade'

        year = get_active_year(request)
        headcounts = (
            Headcount.objects
            .filter(subjectID=subject_id)
            .select_related('userID__studentID__classID')
            .order_by('userID__name')
        )
        if year:
            headcounts = headcounts.filter(userID__year=year)

        student_marks = []
        for hc in headcounts:
            user = hc.userID
            if not user.studentID:
                continue

            mark  = getattr(hc, mark_field, None)
            grade = getattr(hc, grade_field, None)
            sort_mark = mark if mark is not None else -1

            student_marks.append({
                'userID': str(user.userID),
                'studentName': user.name,
                'className': user.studentID.classID.className if user.studentID.classID else None,
                'mark': mark,
                'grade': grade,
                'sort_mark': sort_mark,
            })

        student_marks.sort(key=lambda x: x['sort_mark'], reverse=True)

        rows = [
            {
                'userID': d['userID'],
                'studentName': d['studentName'],
                'className': d['className'],
                'mark': d['mark'],
                'grade': d['grade'],
                'ranking': rank,
            }
            for rank, d in enumerate(student_marks, start=1)
        ]

        serializer = SubjectRankingRowSerializer(rows, many=True)
        return Response({
            'success': True,
            'count': len(rows),
            'exam': exam_type,
            'subject': {
                'subjectID': str(subject_id),
                'subjectName': subject.subjectName,
                'subjectCode': subject.subjectCode,
            },
            'data': serializer.data,
        })
