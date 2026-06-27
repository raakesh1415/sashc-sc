import threading
import time

import numpy as np
from sklearn.ensemble import RandomForestRegressor

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Headcount, Subject, User
from ..serializers import HeadcountRowSerializer
from .utils import _grade, get_active_year

# Module-level cache for trained OTI models.
# Key: (subject_name_lower, current_year)  →  (model_oti1, model_oti2, n_oti1, n_oti2, cached_at)
# TTL of 24 hours so corrected past-year marks are reflected without a server restart.
_OTI_MODEL_CACHE: dict = {}
_OTI_CACHE_LOCK = threading.Lock()
_OTI_CACHE_TTL = 86400  # 24 hours in seconds


class HeadcountViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Returns all students enrolled in a specific subject with all their exam marks.
        Query parameter: subjectID
        Admins can access any subject; Subject Teachers can only access their own subjects.
        """
        subject_id = request.query_params.get('subjectID')

        if not subject_id:
            return Response({
                'success': False,
                'message': 'subjectID parameter is required',
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

        current_user = request.user
        is_admin = 'Admin' in (current_user.role or [])
        is_subject_teacher = 'Subject Teacher' in (current_user.role or [])

        if not is_admin:
            if not is_subject_teacher:
                return Response(
                    {'success': False, 'message': 'Anda tidak mempunyai kebenaran untuk mengakses data ini.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            teacher = current_user.teacherID
            if not teacher or not teacher.enrollSubjectID:
                return Response(
                    {'success': False, 'message': 'Anda tidak ditetapkan kepada mana-mana mata pelajaran.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            taught_subject_ids = set(
                str(e.subjectID_id)
                for e in teacher.enrollSubjectID.enrollments.all()
            )
            if str(subject_id) not in taught_subject_ids:
                return Response(
                    {'success': False, 'message': 'Anda tidak dibenarkan mengakses mata pelajaran ini.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        year = get_active_year(request)
        headcounts = (
            Headcount.objects
            .filter(subjectID=subject_id)
            .select_related('userID__studentID__classID', 'subjectID')
            .order_by('userID__name')
        )
        if year:
            headcounts = headcounts.filter(userID__year=year)

        rows = []
        for headcount in headcounts:
            user = headcount.userID
            if not user.studentID:
                continue
            rows.append({
                'headcountID': str(headcount.headcountID),
                'userID': str(user.userID),
                'studentName': user.name,
                'className': user.studentID.classID.className if user.studentID.classID else None,
                'subjectID': str(subject_id),
                'subjectName': subject.subjectName,
                'subjectCode': subject.subjectCode,
                'TOVmark': headcount.TOVmark,
                'TOVgrade': headcount.TOVgrade,
                'AR1mark': headcount.AR1mark,
                'AR1grade': headcount.AR1grade,
                'OTI1mark': headcount.OTI1mark,
                'OTI1grade': headcount.OTI1grade,
                'AR2mark': headcount.AR2mark,
                'AR2grade': headcount.AR2grade,
                'OTI2mark': headcount.OTI2mark,
                'OTI2grade': headcount.OTI2grade,
                'ETRmark': headcount.ETRmark,
                'ETRgrade': headcount.ETRgrade,
            })

        serializer = HeadcountRowSerializer(rows, many=True)
        return Response({
            'success': True,
            'count': len(rows),
            'subject': {
                'subjectID': str(subject_id),
                'subjectName': subject.subjectName,
                'subjectCode': subject.subjectCode,
            },
            'data': serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='my-subjects')
    def my_subjects(self, request):
        """
        GET /headcount/my-subjects/
        Returns subjects assigned to the current user as Subject Teacher.
        """
        current_user = request.user
        if 'Subject Teacher' not in (current_user.role or []):
            return Response({'success': True, 'data': []})

        teacher = current_user.teacherID
        if not teacher or not teacher.enrollSubjectID:
            return Response({'success': True, 'data': []})

        seen = set()
        data = []
        for enrollment in teacher.enrollSubjectID.enrollments.select_related('subjectID').all():
            subj = enrollment.subjectID
            if subj.subjectID not in seen:
                seen.add(subj.subjectID)
                data.append({
                    'subjectID':   str(subj.subjectID),
                    'subjectName': subj.subjectName,
                    'subjectCode': subj.subjectCode,
                })

        return Response({'success': True, 'data': data})

    @staticmethod
    def _train_oti_models(subject_name, current_year):
        """
        Train RandomForest models for OTI1 and OTI2 using past-year Headcount data.
        Results are cached in _OTI_MODEL_CACHE for the lifetime of the server process.
        """
        cache_key = (subject_name.lower(), current_year)
        with _OTI_CACHE_LOCK:
            if cache_key in _OTI_MODEL_CACHE:
                *cached_result, cached_at = _OTI_MODEL_CACHE[cache_key]
                if time.time() - cached_at < _OTI_CACHE_TTL:
                    return tuple(cached_result)

        past_subjects = Subject.objects.filter(
            subjectName__iexact=subject_name,
            year__lt=current_year,
            year__isnull=False,
        )

        records = Headcount.objects.filter(subjectID__in=past_subjects).values(
            'TOVmark', 'TOVgrade',
            'ETRmark', 'ETRgrade',
            'AR1mark', 'AR1grade',
            'OTI1mark', 'OTI2mark',
        )

        def _num(mark, grade):
            if mark is not None:
                return float(mark)
            if grade == 'TH':
                return 0.0
            return None

        oti1_rows, oti2_rows = [], []
        for r in records:
            tov = _num(r['TOVmark'], r['TOVgrade'])
            etr = _num(r['ETRmark'], r['ETRgrade'])
            ar1 = _num(r['AR1mark'], r['AR1grade'])
            o1  = r['OTI1mark']
            o2  = r['OTI2mark']

            if tov is not None and etr is not None and o1 is not None:
                oti1_rows.append([tov, etr, float(o1)])
            if ar1 is not None and etr is not None and o2 is not None:
                oti2_rows.append([ar1, etr, float(o2)])

        model_oti1 = model_oti2 = None

        if len(oti1_rows) >= 5:
            arr = np.array(oti1_rows)
            model_oti1 = RandomForestRegressor(n_estimators=100, random_state=42)
            model_oti1.fit(arr[:, :2], arr[:, 2])

        if len(oti2_rows) >= 5:
            arr = np.array(oti2_rows)
            model_oti2 = RandomForestRegressor(n_estimators=100, random_state=42)
            model_oti2.fit(arr[:, :2], arr[:, 2])

        result = (model_oti1, model_oti2, len(oti1_rows), len(oti2_rows))
        with _OTI_CACHE_LOCK:
            _OTI_MODEL_CACHE[cache_key] = (*result, time.time())
        return result

    @action(detail=False, methods=['post'], url_path='calculate-oti')
    def calculate_oti(self, request):
        """
        POST /headcount/calculate-oti/
        Body: { "subjectID": "<uuid>", "method": "formula" }
        Subject Teacher only — must be assigned to the subject.
        """
        current_user = request.user

        if 'Subject Teacher' not in (current_user.role or []):
            return Response(
                {'success': False, 'message': 'Hanya Guru Mata Pelajaran boleh mengira OTI'},
                status=status.HTTP_403_FORBIDDEN,
            )

        subject_id = request.data.get('subjectID')
        method     = request.data.get('method', 'formula')

        if not subject_id:
            return Response(
                {'success': False, 'message': "Parameter 'subjectID' diperlukan"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if method not in ('formula', 'ai'):
            return Response(
                {'success': False, 'message': "Kaedah pengiraan tidak disokong"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            subject = Subject.objects.get(subjectID=subject_id)
        except Subject.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Mata pelajaran tidak dijumpai'},
                status=status.HTTP_404_NOT_FOUND,
            )

        teacher = current_user.teacherID
        if not teacher or not teacher.enrollSubjectID:
            return Response(
                {'success': False, 'message': 'Tiada mata pelajaran ditetapkan kepada anda'},
                status=status.HTTP_403_FORBIDDEN,
            )

        teacher_subject_ids = set(
            teacher.enrollSubjectID.enrollments.values_list('subjectID_id', flat=True)
        )
        if subject.subjectID not in teacher_subject_ids:
            return Response(
                {'success': False, 'message': 'Anda tidak ditetapkan untuk mata pelajaran ini'},
                status=status.HTTP_403_FORBIDDEN,
            )

        headcounts = Headcount.objects.filter(subjectID=subject_id)
        oti1_updated = 0
        oti2_updated = 0

        def _mark_val(mark, grade):
            if mark is not None:
                return float(mark)
            if grade == 'TH':
                return 0.0
            return None

        # ── Formula method ────────────────────────────────────────────────────
        if method == 'formula':
            for hc in headcounts:
                changed = False

                tov_val = _mark_val(hc.TOVmark, hc.TOVgrade)
                etr_val = _mark_val(hc.ETRmark, hc.ETRgrade)
                ar1_val = _mark_val(hc.AR1mark, hc.AR1grade)

                if tov_val is not None and etr_val is not None:
                    oti1 = round(tov_val + (etr_val - tov_val) * (1 / 3))
                    hc.OTI1mark  = oti1
                    hc.OTI1grade = _grade(oti1)
                    oti1_updated += 1
                    changed = True

                if ar1_val is not None and etr_val is not None:
                    oti2 = round(ar1_val + (etr_val - ar1_val) * (1 / 2))
                    hc.OTI2mark  = oti2
                    hc.OTI2grade = _grade(oti2)
                    oti2_updated += 1
                    changed = True

                if changed:
                    hc.save(update_fields=['OTI1mark', 'OTI1grade', 'OTI2mark', 'OTI2grade'])

            return Response({
                'success': True,
                'message': f'OTI berjaya dikira (formula). OTI1: {oti1_updated} rekod, OTI2: {oti2_updated} rekod dikemaskini.',
                'oti1Updated': oti1_updated,
                'oti2Updated': oti2_updated,
            })

        # ── AI method ─────────────────────────────────────────────────────────
        current_year = subject.year
        if not current_year:
            return Response(
                {'success': False, 'message': 'Mata pelajaran ini tiada tahun sesi. Kaedah AI tidak dapat digunakan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        model_oti1, model_oti2, n1, n2 = self._train_oti_models(subject.subjectName, current_year)

        if model_oti1 is None and model_oti2 is None:
            return Response(
                {
                    'success': False,
                    'message': (
                        f'Data latihan tidak mencukupi untuk mata pelajaran "{subject.subjectName}". '
                        f'Dijumpai {n1} rekod OTI1 dan {n2} rekod OTI2 dari tahun-tahun lepas '
                        f'(minimum 5 diperlukan). Sila guna kaedah formula.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        for hc in headcounts:
            changed = False

            tov_val = _mark_val(hc.TOVmark, hc.TOVgrade)
            etr_val = _mark_val(hc.ETRmark, hc.ETRgrade)
            ar1_val = _mark_val(hc.AR1mark, hc.AR1grade)

            if model_oti1 is not None and tov_val is not None and etr_val is not None:
                pred = model_oti1.predict(np.array([[tov_val, etr_val]]))[0]
                oti1 = max(0, min(100, round(pred)))
                hc.OTI1mark  = oti1
                hc.OTI1grade = _grade(oti1)
                oti1_updated += 1
                changed = True

            if model_oti2 is not None and ar1_val is not None and etr_val is not None:
                pred = model_oti2.predict(np.array([[ar1_val, etr_val]]))[0]
                oti2 = max(0, min(100, round(pred)))
                hc.OTI2mark  = oti2
                hc.OTI2grade = _grade(oti2)
                oti2_updated += 1
                changed = True

            if changed:
                hc.save(update_fields=['OTI1mark', 'OTI1grade', 'OTI2mark', 'OTI2grade'])

        return Response({
            'success': True,
            'message': (
                f'OTI berjaya dikira (AI). '
                f'OTI1: {oti1_updated} rekod, OTI2: {oti2_updated} rekod dikemaskini.'
            ),
            'oti1Updated': oti1_updated,
            'oti2Updated': oti2_updated,
            'trainingSamples': {'oti1': n1, 'oti2': n2},
        })
