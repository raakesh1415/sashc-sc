import csv
import io
import logging
import threading

from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from django.utils.crypto import get_random_string
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Admin, Class, EnrollSubject, Headcount, Student, Subject, SubjectEnrollment, Teacher, User
from ..serializers import (
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)
from .utils import get_active_year, ALLOWED_EMAIL_DOMAINS, make_xlsx_response, read_upload_rows, detect_wrong_template

logger = logging.getLogger(__name__)


def _send_login_email(user, password):
    """Send login credentials email to a user. Does NOT reset the password."""
    from django.core.mail import EmailMultiAlternatives

    login_link = f"{settings.FRONTEND_URL}/{user.year}/login"

    email_html = f'''<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maklumat Log Masuk SASHC</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="800" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #00ffef 0%, #00e6d8 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #000000; font-size: 28px; font-weight: bold;">SASHC</h1>
                            <p style="margin: 5px 0 0 0; color: #000000; font-size: 14px; font-weight: 600;">Sekolah Menengah St. Anthony WP Labuan</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: bold;">Maklumat Log Masuk</h2>
                            <p style="margin: 0 0 15px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                                Hai <strong>{user.name}</strong>,
                            </p>
                            <p style="margin: 0 0 25px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                                Akaun anda untuk sistem SASHC telah bersedia. Berikut adalah maklumat log masuk anda:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                <tr>
                                    <td style="background-color: #f8f9fa; border-left: 4px solid #00e6d8; border-radius: 4px; padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #333333; font-size: 15px;">
                                            <strong>Emel:</strong>&nbsp;&nbsp;{user.email}
                                        </p>
                                        <p style="margin: 0; color: #333333; font-size: 15px;">
                                            <strong>Kata Laluan:</strong>&nbsp;&nbsp;{password}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 30px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                                Klik butang di bawah untuk log masuk ke sistem:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 0 0 30px 0;">
                                        <a href="{login_link}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #00ffef, #40e0d0); color: #000000; text-decoration: none; font-weight: bold; font-size: 16px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,255,239,0.4);">
                                            Log Masuk ke SASHC
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 15px 0; color: #777777; font-size: 14px; line-height: 1.6;">
                                Atau salin dan tampal pautan ini ke pelayar anda:
                            </p>
                            <p style="margin: 0 0 25px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #333333; border-radius: 4px; word-break: break-all;">
                                <a href="{login_link}" style="color: #333333; text-decoration: none; font-size: 14px;">{login_link}</a>
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
                                <tr>
                                    <td style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px;">
                                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                            ⚠️ <strong>Nota Penting:</strong> Sila tukar kata laluan anda selepas log masuk pertama anda untuk keselamatan akaun.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">Terima kasih,</p>
                            <p style="margin: 0 0 5px 0; color: #333333; font-size: 14px; font-weight: bold;">Pasukan Pentadbir SASHC</p>
                            <p style="margin: 0; color: #999999; font-size: 12px;">Sekolah Menengah St. Anthony WP Labuan</p>
                            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0; color: #999999; font-size: 11px; line-height: 1.5;">
                                Emel ini dihantar secara automatik. Sila jangan balas emel ini.<br>
                                Jika anda menghadapi sebarang masalah, sila hubungi pentadbir sistem.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>'''

    email_text = f'''Hai {user.name},

Akaun anda untuk sistem SASHC telah bersedia. Berikut adalah maklumat log masuk anda:

Emel: {user.email}
Kata Laluan: {password}

Log masuk di: {login_link}

Sila tukar kata laluan anda selepas log masuk pertama.

Terima kasih,
Pasukan Pentadbir SASHC
Sekolah Menengah St. Anthony WP Labuan'''

    try:
        msg = EmailMultiAlternatives(
            subject='Maklumat Log Masuk SASHC',
            body=email_text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        msg.attach_alternative(email_html, 'text/html')
        msg.send(fail_silently=False)
        return True
    except Exception as e:
        logger.error(f"Failed to send credentials email to {user.email}: {e}")
        return False


def _send_bulk_emails(user_password_pairs):
    """Send login emails to a list of (user, password) pairs. Runs in a background thread."""
    for user, pwd in user_password_pairs:
        _send_login_email(user, pwd)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related(
        'studentID',
        'teacherID',
        'adminID',
        'studentID__classID',
    ).order_by('name')

    permission_classes = [IsAuthenticated]
    lookup_field = 'userID'

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        elif self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserDetailSerializer

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        year = get_active_year(request)
        if year and not data.get('year'):
            data['year'] = year
        password = get_random_string(12)
        data['password'] = password
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        user = serializer.instance
        threading.Thread(target=_send_login_email, args=(user, password), daemon=True).start()
        return Response({
            'success': True,
            'message': 'Pengguna berjaya ditambah. Emel maklumat log masuk sedang dihantar.',
            'data': UserDetailSerializer(user).data,
        }, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        year = get_active_year(request)
        if year:
            qs = qs.filter(Q(year=year) | Q(year__isnull=True))
        return Response({'success': True, 'count': qs.count(), 'data': self.get_serializer(qs, many=True).data})

    def retrieve(self, request, *args, **kwargs):
        return Response({'success': True, 'data': self.get_serializer(self.get_object()).data})

    @action(detail=False, methods=['get'], url_path='profile')
    def me(self, request):
        """GET /users/profile/ — return the current logged-in user's profile."""
        serializer = UserDetailSerializer(request.user)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        """POST /users/change-password/ — change the current user's password."""
        user = request.user
        old_password     = request.data.get('old_password', '')
        new_password     = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if not user.check_password(old_password):
            return Response({'success': False, 'message': 'Kata laluan lama tidak betul.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 8:
            return Response({'success': False, 'message': 'Kata laluan baru mestilah sekurang-kurangnya 8 aksara.'},
                            status=status.HTTP_400_BAD_REQUEST)
        import re
        if not re.search(r'[A-Z]', new_password):
            return Response({'success': False, 'message': 'Kata laluan baru mestilah mengandungi sekurang-kurangnya satu huruf besar (A-Z).'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not re.search(r'[a-z]', new_password):
            return Response({'success': False, 'message': 'Kata laluan baru mestilah mengandungi sekurang-kurangnya satu huruf kecil (a-z).'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not re.search(r'\d', new_password):
            return Response({'success': False, 'message': 'Kata laluan baru mestilah mengandungi sekurang-kurangnya satu nombor (0-9).'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':\\|,.<>\/?]', new_password):
            return Response({'success': False, 'message': 'Kata laluan baru mestilah mengandungi sekurang-kurangnya satu aksara khas (cth: !@#$%).'},
                            status=status.HTTP_400_BAD_REQUEST)
        if new_password != confirm_password:
            return Response({'success': False, 'message': 'Kata laluan baru tidak sepadan.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if old_password == new_password:
            return Response({'success': False, 'message': 'Kata laluan baru mestilah berbeza daripada kata laluan lama.'},
                            status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'success': True, 'message': 'Kata laluan berjaya ditukar. Sila log masuk semula.'})

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """
        POST /users/bulk-delete/
        Body: { "userIDs": ["uuid1", "uuid2", ...] }
        Deletes all specified users in a single query + transaction.
        Django CASCADE handles all related records automatically.
        """
        user_ids = request.data.get('userIDs', [])
        if not user_ids:
            return Response(
                {'success': False, 'message': 'Sila pilih sekurang-kurangnya satu pengguna.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            qs = User.objects.filter(userID__in=user_ids)
            found_count = qs.count()
            qs.delete()

        failed_count = len(user_ids) - found_count
        msg = f'{found_count} pengguna berjaya dipadam.'
        if failed_count:
            msg += f' {failed_count} tidak dijumpai.'

        return Response({'success': True, 'message': msg, 'deleted': found_count, 'failed': failed_count})

    @action(detail=False, methods=['post'], url_path='send-credentials')
    def send_credentials(self, request):
        """
        POST /users/send-credentials/
        Body: { "userIDs": ["uuid1", "uuid2", ...] }
        Resets each user's password to the default (emailname@sashc) and
        sends an HTML email with their login credentials and a login link.
        """
        user_ids = request.data.get('userIDs', [])
        if not user_ids:
            return Response(
                {'success': False, 'message': 'Sila pilih sekurang-kurangnya satu pengguna.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sent, failed_emails = 0, []

        for uid in user_ids:
            try:
                user = User.objects.get(userID=uid)
            except User.DoesNotExist:
                failed_emails.append(str(uid))
                continue

            default_password = get_random_string(12)
            user.set_password(default_password)
            user.save(update_fields=['password'])

            if _send_login_email(user, default_password):
                sent += 1
            else:
                failed_emails.append(user.email)

        if failed_emails:
            return Response({
                'success': True,
                'message': f'{sent} emel berjaya dihantar. Gagal: {", ".join(failed_emails)}.',
            })
        return Response({
            'success': True,
            'message': f'{sent} emel berjaya dihantar kepada pengguna yang dipilih.',
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'success': True,
            'message': 'User updated successfully',
            'data': UserDetailSerializer(instance).data,
        })

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name

        # Order matters: Admin references Teacher, so Admin must go first.
        if instance.adminID:
            instance.adminID.delete()

        if instance.teacherID:
            enroll = instance.teacherID.enrollSubjectID
            instance.teacherID.delete()
            if enroll:
                enroll.delete()

        if instance.studentID:
            enroll = instance.studentID.enrollSubjectID
            instance.studentID.delete()
            if enroll:
                enroll.delete()

        instance.delete()

        return Response({'success': True, 'message': f'User "{name}" deleted successfully'})

    # ── Bulk upload ────────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='download-student-template',
            parser_classes=(MultiPartParser, FormParser))
    def download_student_template(self, request):
        """GET /users/download-student-template/ — XLSX template for student bulk upload."""
        return make_xlsx_response(
            filename='template_pelajar.xlsx',
            headers=['Name', 'Email', 'Gender', 'Class', 'Subjects'],
            rows=[
                ['AHMAD ALI',   'ahmad@moe-dl.edu.my', 'Male',   '5 SIRIUS', 'BM,BI,SEJ,MATH,MT'],
                ['SITI AMINAH', 'siti@moe-dl.edu.my',  'Female', '5 ADHARA', 'BM,BI,SEJ,MATH,EKO'],
            ],
        )

    @action(detail=False, methods=['get'], url_path='download-teacher-template',
            parser_classes=(MultiPartParser, FormParser))
    def download_teacher_template(self, request):
        """GET /users/download-teacher-template/ — XLSX template for teacher bulk upload."""
        return make_xlsx_response(
            filename='template_guru.xlsx',
            headers=['Name', 'Email', 'Gender', 'Roles', 'Subject Classes', 'Principal'],
            rows=[
                ['ADRIAN COLE',  'adrian@moe-dl.edu.my',  'Male',   'Subject Teacher',       'BI:5 SIRIUS,5 ADHARA,5 ORIAN|MATH:5 SIRIUS,5 ADHARA', ''],
                ['KIRAN MALIK',  'kiran@moe-dl.edu.my',   'Female', 'Class Teacher',          '', ''],
                ['JULIAN REYES', 'julian@moe-dl.edu.my',  'Male',   'Admin',                  '', 'True'],
                ['SELINA HART',  'selina@moe-dl.edu.my',  'Female', 'Admin,Subject Teacher',  'BM:5 SIRIUS,5 ADHARA,5 ORIAN', ''],
            ],
        )

    @action(detail=False, methods=['post'], url_path='upload-students',
            parser_classes=(MultiPartParser, FormParser))
    def upload_students(self, request):
        """POST /users/upload-students/ — bulk upload students from XLSX."""
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'success': False, 'message': 'Tiada fail dimuat naik'}, status=status.HTTP_400_BAD_REQUEST)
        if not csv_file.name.endswith('.xlsx'):
            return Response({'success': False, 'message': 'Fail mestilah dalam format Excel (.xlsx)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows = read_upload_rows(csv_file)
            fieldnames = list(rows[0].keys()) if rows else []
            fieldnames_set = set(fieldnames)
            expected = {'Name', 'Email', 'Gender', 'Class', 'Subjects'}

            wrong = detect_wrong_template(fieldnames_set, expected_template='student', required_cols=expected)
            if wrong:
                return Response({'success': False, **wrong}, status=status.HTTP_400_BAD_REQUEST)

            success_count, error_count, errors = 0, 0, []
            session_year = get_active_year(request)

            # Pre-fetch all classes and subjects in one query each to avoid N+1 queries
            class_map = {
                cls.className: cls
                for cls in Class.objects.filter(year=session_year)
            }
            subject_qs = Subject.objects.filter(year=session_year)
            subject_by_code = {s.subjectCode.lower(): s for s in subject_qs}
            subject_by_name = {s.subjectName.lower(): s for s in subject_qs}

            # Pre-fetch existing emails for duplicate check
            existing_emails = set(
                User.objects.filter(year=session_year).values_list('email', flat=True)
            )

            # Validate all rows first, collect what to create
            to_create = []
            for row_num, row in enumerate(rows, start=2):
                class_name = row.get('Class', '').strip()
                class_obj = None
                if class_name:
                    class_obj = class_map.get(class_name)
                    if class_obj is None:
                        errors.append(f"Baris {row_num}: Kelas '{class_name}' tidak dijumpai")
                        error_count += 1; continue

                subjects_list = []
                subject_error = False
                for sv in [s.strip() for s in row.get('Subjects', '').strip().split(',') if s.strip()]:
                    sv_lower = sv.lower()
                    subj = subject_by_code.get(sv_lower) or subject_by_name.get(sv_lower)
                    if subj is None:
                        errors.append(f"Baris {row_num}: Mata pelajaran '{sv}' tidak dijumpai")
                        subject_error = True
                    else:
                        subjects_list.append(subj)
                if subject_error:
                    error_count += 1; continue

                email = row.get('Email', '').strip().lower()
                if not email:
                    errors.append(f"Baris {row_num}: Emel diperlukan"); error_count += 1; continue

                try:
                    validate_email(email)
                except DjangoValidationError:
                    errors.append(f"Baris {row_num}: Format emel '{email}' tidak sah"); error_count += 1; continue

                domain = email.split('@')[-1] if '@' in email else ''
                if domain not in ALLOWED_EMAIL_DOMAINS:
                    errors.append(f"Baris {row_num}: Domain emel '{domain}' tidak dibenarkan"); error_count += 1; continue

                if email in existing_emails:
                    errors.append(f"Baris {row_num}: Emel '{email}' sudah wujud"); error_count += 1; continue

                name = row.get('Name', '').strip().upper()
                if not name:
                    errors.append(f"Baris {row_num}: Nama diperlukan"); error_count += 1; continue

                gender = row.get('Gender', '').strip().capitalize()
                if gender and gender not in ['Male', 'Female']:
                    errors.append(f"Baris {row_num}: Jantina mestilah 'Male' atau 'Female'"); error_count += 1; continue

                existing_emails.add(email)  # prevent duplicates within the same file
                to_create.append((row_num, email, name, gender, class_obj, subjects_list))

            # ── Batch creation ────────────────────────────────────────────────
            # Phase 1: bulk-create EnrollSubject objects (one per student with subjects)
            # Phase 2: bulk-create Student profiles
            # Phase 3: bulk-create Users (with password hashing)
            # Phase 4: bulk-create SubjectEnrollments and Headcounts
            # This reduces ~7 queries/student to ~6 total queries for 100 students.

            created_users = []
            with transaction.atomic():
                # Step 1 — Create EnrollSubject objects for students who have subjects
                enroll_needed = [(i, row) for i, row in enumerate(to_create) if row[5]]
                enroll_objects = EnrollSubject.objects.bulk_create(
                    [EnrollSubject() for _ in enroll_needed]
                )
                enroll_map = {enroll_needed[i][0]: enroll_objects[i] for i in range(len(enroll_needed))}

                # Step 2 — Create Student profiles (bulk)
                student_objects = Student.objects.bulk_create([
                    Student(
                        classID=to_create[i][4],
                        enrollSubjectID=enroll_map.get(i),
                    )
                    for i in range(len(to_create))
                ])

                # Step 3 — Create User objects and set passwords
                user_objects = []
                passwords = []
                for i, (row_num, email, name, gender, class_obj, subjects_list) in enumerate(to_create):
                    pwd = get_random_string(12)
                    u = User(
                        email=email, name=name, year=session_year,
                        gender=gender or None, role=['Student'],
                        studentID=student_objects[i],
                    )
                    u.set_password(pwd)
                    user_objects.append(u)
                    passwords.append(pwd)

                User.objects.bulk_create(user_objects)

                # Step 4 — Bulk-create SubjectEnrollments and Headcounts
                enrollments_to_create = []
                headcounts_to_create  = []
                for i, (row_num, email, name, gender, class_obj, subjects_list) in enumerate(to_create):
                    enroll_obj = enroll_map.get(i)
                    user       = user_objects[i]
                    for subj in subjects_list:
                        if enroll_obj:
                            enrollments_to_create.append(
                                SubjectEnrollment(enrollSubjectID=enroll_obj, subjectID=subj, classID=None)
                            )
                        headcounts_to_create.append(Headcount(userID=user, subjectID=subj))

                if enrollments_to_create:
                    SubjectEnrollment.objects.bulk_create(enrollments_to_create, ignore_conflicts=True)
                if headcounts_to_create:
                    Headcount.objects.bulk_create(headcounts_to_create, ignore_conflicts=True)

                created_users = list(zip(user_objects, passwords))
                success_count = len(user_objects)

            if created_users:
                threading.Thread(target=_send_bulk_emails, args=(created_users,), daemon=True).start()

            msg = f'{success_count} pelajar berjaya dimuat naik, {error_count} gagal.'
            if created_users:
                msg += ' Emel maklumat log masuk sedang dihantar.'

            return Response({
                'success': True,
                'message': msg,
                'successCount': success_count, 'errorCount': error_count, 'errors': errors,
            })

        except Exception as e:
            logger.error(f"Bulk student upload error: {e}")
            return Response({'success': False, 'message': f'Ralat memproses fail: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='upload-teachers',
            parser_classes=(MultiPartParser, FormParser))
    def upload_teachers(self, request):
        """POST /users/upload-teachers/ — bulk upload teachers from XLSX."""
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'success': False, 'message': 'Tiada fail dimuat naik'}, status=status.HTTP_400_BAD_REQUEST)
        if not csv_file.name.endswith('.xlsx'):
            return Response({'success': False, 'message': 'Fail mestilah dalam format Excel (.xlsx)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows = read_upload_rows(csv_file)
            fieldnames = list(rows[0].keys()) if rows else []
            fieldnames_set = set(fieldnames)
            expected = {'Name', 'Email', 'Gender', 'Roles', 'Subject Classes', 'Principal'}

            wrong = detect_wrong_template(fieldnames_set, expected_template='teacher', required_cols=expected)
            if wrong:
                return Response({'success': False, **wrong}, status=status.HTTP_400_BAD_REQUEST)

            success_count, error_count, errors = 0, 0, []
            session_year = get_active_year(request)

            # Pre-fetch all subjects and classes in one query each
            subject_qs = Subject.objects.filter(year=session_year)
            subject_by_code = {s.subjectCode.lower(): s for s in subject_qs if s.subjectCode}
            subject_by_name = {s.subjectName.lower(): s for s in subject_qs if s.subjectName}

            class_map = {cls.className: cls for cls in Class.objects.filter(year=session_year)}

            # Pre-fetch existing subject-class assignments to check conflicts
            assigned_pairs = set(
                SubjectEnrollment.objects.filter(
                    enrollSubjectID__teachers__user_profile__isnull=False,
                )
                .values_list('subjectID_id', 'classID_id')
            )

            # Pre-fetch existing emails
            existing_emails = set(
                User.objects.filter(year=session_year).values_list('email', flat=True)
            )

            # Validate all rows first
            to_create = []
            for row_num, row in enumerate(rows, start=2):
                email = row.get('Email', '').strip().lower()
                if not email:
                    errors.append(f"Baris {row_num}: Emel diperlukan"); error_count += 1; continue

                try:
                    validate_email(email)
                except DjangoValidationError:
                    errors.append(f"Baris {row_num}: Format emel '{email}' tidak sah"); error_count += 1; continue

                domain = email.split('@')[-1] if '@' in email else ''
                if domain not in ALLOWED_EMAIL_DOMAINS:
                    errors.append(f"Baris {row_num}: Domain emel '{domain}' tidak dibenarkan"); error_count += 1; continue

                if email in existing_emails:
                    errors.append(f"Baris {row_num}: Emel '{email}' sudah wujud"); error_count += 1; continue

                name = row.get('Name', '').strip().upper()
                if not name:
                    errors.append(f"Baris {row_num}: Nama diperlukan"); error_count += 1; continue

                gender = row.get('Gender', '').strip().capitalize()
                if gender and gender not in ['Male', 'Female']:
                    errors.append(f"Baris {row_num}: Jantina mestilah 'Male' atau 'Female'"); error_count += 1; continue

                roles_str = row.get('Roles', '').strip()
                if not roles_str:
                    errors.append(f"Baris {row_num}: Peranan diperlukan"); error_count += 1; continue

                roles = [r.strip() for r in roles_str.split(',')]
                invalid_roles = [r for r in roles if r not in User.VALID_ROLES]
                if invalid_roles:
                    errors.append(f"Baris {row_num}: Peranan tidak sah: {', '.join(invalid_roles)}"); error_count += 1; continue

                parsed_entries = []
                row_error_msg = None
                sc_str = row.get('Subject Classes', '').strip()

                if 'Subject Teacher' in roles and sc_str:
                    for entry in sc_str.split('|'):
                        if ':' not in entry:
                            continue
                        subj_name, classes_str = entry.split(':', 1)
                        sv = subj_name.strip()
                        subject = subject_by_code.get(sv.lower()) or subject_by_name.get(sv.lower())
                        if subject is None:
                            row_error_msg = f"Mata pelajaran '{sv}' tidak dijumpai"; break

                        class_objs = []
                        for cls_name in [c.strip() for c in classes_str.split(',') if c.strip()]:
                            cls_obj = class_map.get(cls_name)
                            if cls_obj is None:
                                row_error_msg = f"Kelas '{cls_name}' tidak dijumpai"; break
                            if (subject.pk, cls_obj.pk) in assigned_pairs:
                                row_error_msg = f"{subject.subjectName} - {cls_name} sudah diajar oleh guru lain"; break
                            class_objs.append(cls_obj)
                        if row_error_msg:
                            break
                        parsed_entries.append((subject, class_objs))

                if row_error_msg:
                    errors.append(f"Baris {row_num}: {row_error_msg}"); error_count += 1; continue

                is_principal = row.get('Principal', '').strip().lower() in ('true', '1', 'yes')
                existing_emails.add(email)
                to_create.append((row_num, email, name, gender, roles, sc_str, parsed_entries, is_principal))

            # Create all valid records in a single transaction
            created_users = []
            with transaction.atomic():
                for row_num, email, name, gender, roles, sc_str, parsed_entries, is_principal in to_create:
                    try:
                        user = User.objects.create(email=email, name=name, year=session_year,
                                                   gender=gender or None, role=roles)
                        password = get_random_string(12)
                        user.set_password(password)
                        needs_teacher = any(r in roles for r in ['Subject Teacher', 'Class Teacher', 'Admin'])
                        enroll_obj = None

                        if 'Subject Teacher' in roles and sc_str and parsed_entries:
                            enroll_obj = EnrollSubject.objects.create()
                            SubjectEnrollment.objects.bulk_create([
                                SubjectEnrollment(enrollSubjectID=enroll_obj, subjectID=subject, classID=class_obj)
                                for subject, class_objs in parsed_entries
                                for class_obj in class_objs
                            ])

                        if needs_teacher:
                            if is_principal:
                                Teacher.objects.select_for_update().filter(
                                    is_principal=True, user_profile__year=session_year
                                ).update(is_principal=False)
                            teacher = Teacher.objects.create(enrollSubjectID=enroll_obj, is_principal=is_principal)
                            user.teacherID = teacher
                            if 'Admin' in roles:
                                user.adminID = Admin.objects.create(teacherID=teacher)
                        user.save()
                        created_users.append((user, password))
                        success_count += 1
                    except Exception as e:
                        logger.error(f"Teacher upload error at row {row_num}: {e}", exc_info=True)
                        errors.append(f"Baris {row_num}: {str(e)}"); error_count += 1

            if created_users:
                threading.Thread(target=_send_bulk_emails, args=(created_users,), daemon=True).start()

            msg = f'{success_count} guru berjaya dimuat naik, {error_count} gagal.'
            if created_users:
                msg += ' Emel maklumat log masuk sedang dihantar.'

            return Response({
                'success': True,
                'message': msg,
                'successCount': success_count, 'errorCount': error_count, 'errors': errors,
            })

        except Exception as e:
            logger.error(f"Bulk teacher upload error: {e}")
            return Response({'success': False, 'message': f'Ralat memproses fail: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
