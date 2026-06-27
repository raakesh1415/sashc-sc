from rest_framework import serializers
from django.contrib.auth import authenticate
from django.db import transaction

from .models import (
    User, Student, Teacher, Admin, Subject, Class,
    EnrollSubject, SubjectEnrollment, Headcount, Feedback
)
from .views.utils import ALLOWED_EMAIL_DOMAINS


def _get_year_from_request(request):
    """Extract the active year int from a DRF request's query params."""
    if request is None:
        return None
    try:
        return int(request.query_params.get('year'))
    except (TypeError, ValueError):
        return None


def _check_subject_class_conflicts(subject_class_enrollments, exclude_user_id=None):
    """
    Raise ValidationError if any (subject, class) pair is already assigned
    to another Subject Teacher. Pass exclude_user_id when editing so the
    current teacher's own existing assignments are not flagged.
    """
    conflicts = []
    for item in subject_class_enrollments:
        subject_id = item.get('subjectID')
        class_ids  = item.get('classIDs', [])
        if not class_ids:
            continue
        for class_id in class_ids:
            qs = SubjectEnrollment.objects.filter(
                subjectID_id=subject_id,
                classID_id=class_id,
                enrollSubjectID__teachers__user_profile__isnull=False,
            )
            if exclude_user_id:
                qs = qs.exclude(
                    enrollSubjectID__teachers__user_profile__userID=exclude_user_id
                )
            conflict = qs.select_related('subjectID', 'classID').first()
            if conflict:
                conflicts.append(
                    f"{conflict.subjectID.subjectName} - {conflict.classID.className}"
                )
    if conflicts:
        raise serializers.ValidationError(
            {"subjectClassEnrollments": [
                f"Subjek-kelas berikut sudah diajar oleh guru lain: {', '.join(conflicts)}."
            ]}
        )


# ─────────────────────────────────────────
# Subject / Class
# ─────────────────────────────────────────

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['subjectID', 'subjectCode', 'subjectName', 'year']
        read_only_fields = ['subjectID']

    def validate_subjectCode(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Kod mata pelajaran diperlukan.")
        return value.strip().upper()

    def validate_subjectName(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Subject name cannot be empty")
        return value.strip().upper()

    def validate(self, attrs):
        subject_name = attrs.get('subjectName', '')
        year = attrs.get('year')
        instance = self.instance  # None on create, existing obj on update
        qs = Subject.objects.filter(subjectName__iexact=subject_name, year=year)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if year and qs.exists():
            raise serializers.ValidationError(
                {'subjectName': f'Mata pelajaran "{subject_name}" sudah wujud dalam tahun {year}.'}
            )
        return attrs


class ClassSerializer(serializers.ModelSerializer):
    teacherName = serializers.SerializerMethodField()

    def get_teacherName(self, obj):
        try:
            if obj.teacherID:
                return obj.teacherID.user_profile.name
        except AttributeError:
            pass
        return None

    currentTeacherUserID = serializers.SerializerMethodField()

    def get_currentTeacherUserID(self, obj):
        try:
            if obj.teacherID:
                return str(obj.teacherID.user_profile.userID)
        except AttributeError:
            pass
        return None

    class Meta:
        model = Class
        fields = ['classID', 'className', 'year', 'teacherName', 'currentTeacherUserID']
        read_only_fields = ['classID']

    def validate_className(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Class name cannot be empty")
        return value.strip().upper()

    def validate(self, attrs):
        class_name = attrs.get('className', '')
        year = attrs.get('year')
        instance = self.instance
        qs = Class.objects.filter(className__iexact=class_name, year=year)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if year and qs.exists():
            raise serializers.ValidationError(
                {'className': f'Kelas "{class_name}" sudah wujud dalam tahun {year}.'}
            )
        return attrs


# ─────────────────────────────────────────
# SubjectEnrollment (new intermediate model)
# ─────────────────────────────────────────

class SubjectEnrollmentSerializer(serializers.ModelSerializer):
    """
    Represents one subject-class pairing.
    Used for both display and nested creation.
    """
    subjectID   = SubjectSerializer(read_only=True)
    classID     = ClassSerializer(read_only=True)
    subjectName = serializers.SerializerMethodField()
    subjectCode = serializers.SerializerMethodField()
    className   = serializers.SerializerMethodField()

    def get_subjectName(self, obj):
        return obj.subjectID.subjectName if obj.subjectID else None

    def get_subjectCode(self, obj):
        return obj.subjectID.subjectCode if obj.subjectID else None

    def get_className(self, obj):
        return obj.classID.className if obj.classID else None

    class Meta:
        model = SubjectEnrollment
        fields = [
            'subjectEnrollmentID', 'subjectID', 'classID',
            'subjectName', 'subjectCode', 'className'
        ]


class EnrollSubjectSerializer(serializers.ModelSerializer):
    """
    Container for all subject enrollments.
    Now displays the intermediate SubjectEnrollment records.
    """
    enrollments = SubjectEnrollmentSerializer(many=True, read_only=True)

    class Meta:
        model = EnrollSubject
        fields = ['enrollSubjectID', 'enrollments']


# ─────────────────────────────────────────
# Nested profile serializers (read-only)
# ─────────────────────────────────────────

class StudentDetailSerializer(serializers.ModelSerializer):
    classID         = ClassSerializer(read_only=True)
    enrollSubjectID = EnrollSubjectSerializer(read_only=True)

    class Meta:
        model = Student
        fields = ['classID', 'enrollSubjectID']


class TeacherDetailSerializer(serializers.ModelSerializer):
    enrollSubjectID = EnrollSubjectSerializer(read_only=True)

    class Meta:
        model = Teacher
        fields = ['enrollSubjectID', 'is_principal']


class AdminDetailSerializer(serializers.ModelSerializer):
    teacherID = TeacherDetailSerializer(read_only=True)

    class Meta:
        model = Admin
        fields = ['teacherID']


# ─────────────────────────────────────────
# Login
# ─────────────────────────────────────────

class UserLoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(max_length=128, write_only=True, style={'input_type': 'password'})
    role     = serializers.ListField(child=serializers.CharField(), read_only=True)

    def validate(self, data):
        request = self.context.get('request')
        year    = _get_year_from_request(request)
        user    = authenticate(request=request, email=data['email'], password=data['password'], year=year)
        if user is None:
            raise serializers.ValidationError("Invalid login credentials")
        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")
        # Stash the resolved user so the view can call update_last_login without a second lookup
        self._authenticated_user = user
        return {
            'email': user.email,
            'role':  user.role or [],
        }


# ─────────────────────────────────────────
# User list (lightweight)
# ─────────────────────────────────────────

class UserListSerializer(serializers.ModelSerializer):
    className = serializers.SerializerMethodField()

    def get_className(self, obj):
        if obj.studentID and obj.studentID.classID:
            return obj.studentID.classID.className
        # if obj.teacherID and obj.teacherID.classID:
        #     return obj.teacherID.classID.className
        # For Class Teachers, check if they manage any class
        if obj.teacherID:
            try:
                # Find the class where this teacher is assigned as teacherID
                managed_class = Class.objects.filter(teacherID=obj.teacherID).first()
                if managed_class:
                    return managed_class.className
            except AttributeError:
                pass
        return None

    class Meta:
        model  = User
        fields = [
            'userID', 'email', 'name', 'role', 'gender', 'year', 'is_active',
            'className',
            'last_login', 'date_joined', 'created_date', 'modified_date',
        ]
        read_only_fields = fields


# ─────────────────────────────────────────
# User create
# ─────────────────────────────────────────

class UserCreateSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, min_length=8)
    # For students: single class
    classID   = serializers.PrimaryKeyRelatedField(
        queryset=Class.objects.all(), write_only=True, required=False, allow_null=True
    )
    
    # For students: list of subjects (no class per subject)
    subjectID = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), many=True, write_only=True, required=False
    )
    
    # For subject teachers: list of {subjectID, classIDs[]}
    # Format: [{"subjectID": "uuid", "classIDs": ["uuid1", "uuid2"]}, ...]
    subjectClassEnrollments = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )

    role = serializers.ListField(
        child=serializers.ChoiceField(choices=User.VALID_ROLES),
        min_length=1,
        error_messages={'min_length': 'At least one role is required.'}
    )

    is_principal = serializers.BooleanField(required=False, default=False)

    class Meta:
        model  = User
        fields = [
            'email', 'name', 'password', 'role', 'gender', 'year',
            'classID', 'subjectID', 'subjectClassEnrollments', 'is_principal'
        ]

    def validate_name(self, value):
        return value.strip().upper()

    def validate_email(self, value):
        email = value.lower()
        domain = email.split('@')[-1] if '@' in email else ''
        if domain not in ALLOWED_EMAIL_DOMAINS:
            raise serializers.ValidationError(
                f"Domain emel '{domain}' tidak dibenarkan."
            )
        return email

    def validate(self, data):
        email = data.get('email', '')
        year  = data.get('year')
        qs = User.objects.filter(email=email)
        if year is not None:
            qs = qs.filter(year=year)
        else:
            qs = qs.filter(year__isnull=True)
        if qs.exists():
            session_label = str(year) if year else 'tiada sesi'
            raise serializers.ValidationError(
                {'email': f"Pengguna dengan emel ini sudah wujud untuk sesi {session_label}."}
            )
        roles = data.get('role', [])
        if User.SUBJECT_TEACHER in roles:
            subject_class_enrollments = data.get('subjectClassEnrollments', [])
            if subject_class_enrollments:
                _check_subject_class_conflicts(subject_class_enrollments)
        return data

    def validate_role(self, value):
        for r in value:
            if r not in User.VALID_ROLES:
                raise serializers.ValidationError(f"'{r}' is not a valid role.")
        return list(set(value))

    @transaction.atomic
    def create(self, validated_data):
        class_obj                = validated_data.pop('classID', None)
        subjects_list            = validated_data.pop('subjectID', [])
        subject_class_enrollments = validated_data.pop('subjectClassEnrollments', [])
        password                 = validated_data.pop('password')
        is_principal             = validated_data.pop('is_principal', False)
        roles                    = validated_data.get('role', [])

        user = User.objects.create(**validated_data)
        user.set_password(password)

        needs_student = User.STUDENT in roles
        is_subject_teacher = User.SUBJECT_TEACHER in roles
        needs_teacher = any(r in roles for r in [User.SUBJECT_TEACHER, User.CLASS_TEACHER])
        needs_admin   = User.ADMIN in roles

        enroll_obj = None

        # ── Student profile ──
        if needs_student:
            if subjects_list:
                enroll_obj = EnrollSubject.objects.create()
                for subj in subjects_list:
                    SubjectEnrollment.objects.create(
                        enrollSubjectID=enroll_obj,
                        subjectID=subj,
                        classID=None
                    )

            student = Student.objects.create(
                classID=class_obj,
                enrollSubjectID=enroll_obj,
            )
            user.studentID = student

            for subject in subjects_list:
                Headcount.objects.get_or_create(userID=user, subjectID=subject)

        # ── Teacher profile ──
        if needs_teacher or needs_admin:
            if is_subject_teacher:
                if subject_class_enrollments:
                    enroll_obj = EnrollSubject.objects.create()
                    for item in subject_class_enrollments:
                        subject_id = item.get('subjectID')
                        class_ids  = item.get('classIDs', [])
                        
                        try:
                            subject = Subject.objects.get(subjectID=subject_id)
                        except Subject.DoesNotExist:
                            continue
                        
                        if not class_ids:
                            SubjectEnrollment.objects.create(
                                enrollSubjectID=enroll_obj,
                                subjectID=subject,
                                classID=None
                            )
                        else:
                            for class_id in class_ids:
                                try:
                                    class_obj_item = Class.objects.get(classID=class_id)
                                    SubjectEnrollment.objects.create(
                                        enrollSubjectID=enroll_obj,
                                        subjectID=subject,
                                        classID=class_obj_item
                                    )
                                except Class.DoesNotExist:
                                    continue
            else:
                if subjects_list:
                    enroll_obj = EnrollSubject.objects.create()
                    for subj in subjects_list:
                        SubjectEnrollment.objects.create(
                            enrollSubjectID=enroll_obj,
                            subjectID=subj,
                            classID=None
                        )

            if is_principal:
                with transaction.atomic():
                    Teacher.objects.select_for_update().filter(is_principal=True, user_profile__year=user.year).update(is_principal=False)
            teacher = Teacher.objects.create(
                enrollSubjectID=enroll_obj,
                is_principal=is_principal,
            )
            user.teacherID = teacher

            if needs_admin:
                admin = Admin.objects.create(teacherID=teacher)
                user.adminID = admin

        user.save()
        return user


# ─────────────────────────────────────────
# User update
# ─────────────────────────────────────────

class UserUpdateSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, required=False, min_length=8)
    classID   = serializers.PrimaryKeyRelatedField(
        queryset=Class.objects.all(), required=False, allow_null=True
    )
    subjectID = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), many=True, required=False
    )
    subjectClassEnrollments = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )
    role      = serializers.ListField(
        child=serializers.ChoiceField(choices=User.VALID_ROLES),
        required=False,
        min_length=1
    )

    profilePicture = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_principal   = serializers.BooleanField(required=False)

    class Meta:
        model  = User
        fields = [
            'email', 'name', 'password', 'role', 'gender', 'year',
            'is_active', 'classID', 'subjectID',
            'subjectClassEnrollments', 'profilePicture', 'is_principal',
        ]
        read_only_fields = ['last_login', 'date_joined', 'created_date', 'modified_date']

    def validate_name(self, value):
        return value.strip().upper()

    def validate_email(self, value):
        email   = value.lower()
        domain  = email.split('@')[-1] if '@' in email else ''
        if domain not in ALLOWED_EMAIL_DOMAINS:
            raise serializers.ValidationError(
                f"Domain emel '{domain}' tidak dibenarkan."
            )
        user_id = self.instance.userID if self.instance else None
        year    = self.instance.year   if self.instance else None
        qs = User.objects.filter(email=email).exclude(userID=user_id)
        if year is not None:
            qs = qs.filter(year=year)
        else:
            qs = qs.filter(year__isnull=True)
        if qs.exists():
            session_label = str(year) if year else 'tiada sesi'
            raise serializers.ValidationError(
                f"Pengguna dengan emel ini sudah wujud untuk sesi {session_label}."
            )
        return email

    def validate_role(self, value):
        for r in value:
            if r not in User.VALID_ROLES:
                raise serializers.ValidationError(f"'{r}' is not a valid role.")
        return list(set(value))

    def validate(self, data):
        roles = data.get('role', getattr(self.instance, 'role', []))
        if User.SUBJECT_TEACHER in roles:
            subject_class_enrollments = data.get('subjectClassEnrollments', [])
            if subject_class_enrollments:
                exclude_id = self.instance.userID if self.instance else None
                _check_subject_class_conflicts(subject_class_enrollments, exclude_user_id=exclude_id)
        return data

    def update(self, instance, validated_data):
        password                 = validated_data.pop('password', None)
        subjects_list            = validated_data.pop('subjectID', None)
        subject_class_enrollments = validated_data.pop('subjectClassEnrollments', None)
        profile_picture          = validated_data.pop('profilePicture', None)
        is_principal             = validated_data.pop('is_principal', None)
        old_roles                = set(instance.role or [])
        new_roles                = set(validated_data.get('role', instance.role))

        _UNSET = object()
        class_obj = validated_data.pop('classID', _UNSET)
        class_was_sent = class_obj is not _UNSET

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)

        if profile_picture is not None:
            instance.profilePicture = profile_picture if profile_picture else ''

        # ── Detect role changes ────────────────────────────────────────────────
        removed_roles = old_roles - new_roles

        # ── Clean up profiles for removed roles ────────────────────────────────
        
        if User.STUDENT in removed_roles and instance.studentID:
            student_enroll = instance.studentID.enrollSubjectID
            instance.studentID.delete()
            instance.studentID = None
            if student_enroll and (not instance.teacherID or instance.teacherID.enrollSubjectID != student_enroll):
                student_enroll.delete()
            Headcount.objects.filter(userID=instance).delete()

        if User.ADMIN in removed_roles and instance.adminID:
            instance.adminID.delete()
            instance.adminID = None

        needs_teacher_now = any(r in new_roles for r in [User.SUBJECT_TEACHER, User.CLASS_TEACHER, User.ADMIN])
        if not needs_teacher_now and instance.teacherID:
            teacher_enroll = instance.teacherID.enrollSubjectID
            instance.teacherID.delete()
            instance.teacherID = None
            if teacher_enroll and (not instance.studentID or instance.studentID.enrollSubjectID != teacher_enroll):
                teacher_enroll.delete()

        # ── Update EnrollSubject ────────────────────────────────────────────────
        enroll_obj = None
        
        is_subject_teacher = User.SUBJECT_TEACHER in new_roles
        
        if is_subject_teacher and subject_class_enrollments is not None:
            existing_enroll = (
                (instance.teacherID.enrollSubjectID if instance.teacherID else None)
                or (instance.studentID.enrollSubjectID if instance.studentID else None)
            )

            if existing_enroll:
                existing_enroll.enrollments.all().delete()
                enroll_obj = existing_enroll
            else:
                enroll_obj = EnrollSubject.objects.create()
            
            for item in subject_class_enrollments:
                subject_id = item.get('subjectID')
                class_ids  = item.get('classIDs', [])
                
                try:
                    subject = Subject.objects.get(subjectID=subject_id)
                except Subject.DoesNotExist:
                    continue
                
                if not class_ids:
                    SubjectEnrollment.objects.create(
                        enrollSubjectID=enroll_obj,
                        subjectID=subject,
                        classID=None
                    )
                else:
                    for class_id in class_ids:
                        try:
                            class_obj_item = Class.objects.get(classID=class_id)
                            SubjectEnrollment.objects.create(
                                enrollSubjectID=enroll_obj,
                                subjectID=subject,
                                classID=class_obj_item
                            )
                        except Class.DoesNotExist:
                            continue
                            
        elif subjects_list is not None:
            existing_enroll = (
                (instance.studentID.enrollSubjectID if instance.studentID else None)
                or (instance.teacherID.enrollSubjectID if instance.teacherID else None)
            )

            if existing_enroll:
                existing_enroll.enrollments.all().delete()
                enroll_obj = existing_enroll
            else:
                enroll_obj = EnrollSubject.objects.create()

            for subj in subjects_list:
                SubjectEnrollment.objects.create(
                    enrollSubjectID=enroll_obj,
                    subjectID=subj,
                    classID=None
                )

        # ── Clear teacher subject enrollments if no longer Subject Teacher ──
        if not is_subject_teacher and needs_teacher_now and instance.teacherID:
            teacher_enroll = instance.teacherID.enrollSubjectID
            if teacher_enroll:
                teacher_enroll.enrollments.all().delete()
                instance.teacherID.enrollSubjectID = None
                instance.teacherID.save()
                teacher_enroll.delete()
            enroll_obj = None

        # ── Student profile ──
        if User.STUDENT in new_roles:
            if instance.studentID:
                if class_was_sent:
                    instance.studentID.classID = class_obj
                if enroll_obj is not None:
                    instance.studentID.enrollSubjectID = enroll_obj
                instance.studentID.save()
            else:
                student = Student.objects.create(
                    classID=class_obj if class_was_sent else None,
                    enrollSubjectID=enroll_obj,
                )
                instance.studentID = student

            if subjects_list is not None:
                for subject in subjects_list:
                    Headcount.objects.get_or_create(userID=instance, subjectID=subject)
                Headcount.objects.filter(userID=instance).exclude(
                    subjectID__in=subjects_list
                ).delete()

        # ── Teacher profile ──
        needs_teacher = any(r in new_roles for r in [User.SUBJECT_TEACHER, User.CLASS_TEACHER, User.ADMIN])
        if needs_teacher:
            if instance.teacherID:
                if enroll_obj is not None:
                    instance.teacherID.enrollSubjectID = enroll_obj
                if is_principal is not None:
                    if is_principal:
                        with transaction.atomic():
                            Teacher.objects.select_for_update().exclude(pk=instance.teacherID.pk).filter(is_principal=True, user_profile__year=instance.year).update(is_principal=False)
                    instance.teacherID.is_principal = is_principal
                instance.teacherID.save()
            else:
                if is_principal:
                    with transaction.atomic():
                        Teacher.objects.select_for_update().filter(is_principal=True, user_profile__year=instance.year).update(is_principal=False)
                teacher = Teacher.objects.create(
                    enrollSubjectID=enroll_obj,
                    is_principal=is_principal or False,
                )
                instance.teacherID = teacher

            if User.ADMIN in new_roles and not instance.adminID:
                admin = Admin.objects.create(teacherID=instance.teacherID)
                instance.adminID = admin

        instance.save()
        return instance


# ─────────────────────────────────────────
# User detail (read-only, for retrieve)
# ─────────────────────────────────────────

class UserDetailSerializer(serializers.ModelSerializer):
    studentID = StudentDetailSerializer(read_only=True)
    teacherID = TeacherDetailSerializer(read_only=True)
    adminID   = AdminDetailSerializer(read_only=True)

    class Meta:
        model  = User
        fields = [
            'userID', 'email', 'name', 'role', 'gender',
            'profilePicture', 'year', 'is_active',
            'last_login', 'date_joined', 'created_date', 'modified_date',
            'studentID', 'teacherID', 'adminID',
        ]
        read_only_fields = fields


# ─────────────────────────────────────────
# TOV — Headcount read (per student, per subject)
# ─────────────────────────────────────────

class TOVSubjectSerializer(serializers.Serializer):
    headcountID = serializers.UUIDField()
    subjectID   = serializers.UUIDField()
    subjectCode = serializers.CharField(allow_null=True)
    subjectName = serializers.CharField()
    TOVmark     = serializers.FloatField(allow_null=True)
    TOVgrade    = serializers.CharField(allow_null=True, allow_blank=True)


class TOVStudentSerializer(serializers.Serializer):
    userID    = serializers.UUIDField()
    name      = serializers.CharField()
    className = serializers.CharField(allow_null=True)
    subjects  = TOVSubjectSerializer(many=True)


# ─────────────────────────────────────────
# Shared mark validation helper
# ─────────────────────────────────────────

def _validate_mark(data, mark_field, grade_field, instance=None):
    """
    Shared validation for any exam mark/grade pair.
    - grade 'TH' (tiada hadir) forces mark to None.
    - mark must be 0–100 when provided.
    """
    mark  = data.get(mark_field,  getattr(instance, mark_field,  None) if instance else None)
    grade = data.get(grade_field, getattr(instance, grade_field, None) if instance else None)
    if grade == 'TH':
        data[mark_field] = None
    elif mark is not None and (mark < 0 or mark > 100):
        raise serializers.ValidationError({mark_field: 'Markah mestilah antara 0 dan 100.'})
    return data


# ─────────────────────────────────────────
# TOV — Headcount update (TOVmark + TOVgrade only)
# ─────────────────────────────────────────

class TOVUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Headcount
        fields = ['TOVmark', 'TOVgrade']

    def validate(self, data):
        return _validate_mark(data, 'TOVmark', 'TOVgrade', self.instance)


# ─────────────────────────────────────────
# Class Teachers dropdown
# ─────────────────────────────────────────

class ClassTeacherSerializer(serializers.Serializer):
    userID = serializers.UUIDField()
    name   = serializers.CharField()


# ─────────────────────────────────────────
# ETR — Headcount row (flat, per student-subject) & update
# ─────────────────────────────────────────

class ETRRowSerializer(serializers.Serializer):
    headcountID = serializers.UUIDField(allow_null=True)
    userID      = serializers.UUIDField()
    studentName = serializers.CharField()
    className   = serializers.CharField(allow_null=True)
    subjectID   = serializers.UUIDField()
    subjectName = serializers.CharField()
    subjectCode = serializers.CharField(allow_null=True)
    ETRmark     = serializers.FloatField(allow_null=True)
    ETRgrade    = serializers.CharField(allow_null=True, allow_blank=True)


class ETRUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Headcount
        fields = ['ETRmark', 'ETRgrade']

    def validate(self, data):
        return _validate_mark(data, 'ETRmark', 'ETRgrade', self.instance)

    def update(self, instance, validated_data):
        instance.ETRmark  = validated_data.get('ETRmark',  instance.ETRmark)
        instance.ETRgrade = validated_data.get('ETRgrade', instance.ETRgrade)
        instance.save(update_fields=['ETRmark', 'ETRgrade'])
        return instance


# ─────────────────────────────────────────
# AR1 — Headcount row & update
# ─────────────────────────────────────────

class AR1RowSerializer(serializers.Serializer):
    headcountID = serializers.UUIDField(allow_null=True)
    userID      = serializers.UUIDField()
    studentName = serializers.CharField()
    className   = serializers.CharField(allow_null=True)
    subjectID   = serializers.UUIDField()
    subjectName = serializers.CharField()
    subjectCode = serializers.CharField(allow_null=True)
    AR1mark     = serializers.FloatField(allow_null=True)
    AR1grade    = serializers.CharField(allow_null=True, allow_blank=True)


class AR1UpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Headcount
        fields = ['AR1mark', 'AR1grade']

    def validate(self, data):
        return _validate_mark(data, 'AR1mark', 'AR1grade', self.instance)

    def update(self, instance, validated_data):
        instance.AR1mark  = validated_data.get('AR1mark',  instance.AR1mark)
        instance.AR1grade = validated_data.get('AR1grade', instance.AR1grade)
        instance.save(update_fields=['AR1mark', 'AR1grade'])
        return instance


# ─────────────────────────────────────────
# AR2 — Headcount row & update
# ─────────────────────────────────────────

class AR2RowSerializer(serializers.Serializer):
    headcountID = serializers.UUIDField(allow_null=True)
    userID      = serializers.UUIDField()
    studentName = serializers.CharField()
    className   = serializers.CharField(allow_null=True)
    subjectID   = serializers.UUIDField()
    subjectName = serializers.CharField()
    subjectCode = serializers.CharField(allow_null=True)
    AR2mark     = serializers.FloatField(allow_null=True)
    AR2grade    = serializers.CharField(allow_null=True, allow_blank=True)


class AR2UpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Headcount
        fields = ['AR2mark', 'AR2grade']

    def validate(self, data):
        return _validate_mark(data, 'AR2mark', 'AR2grade', self.instance)

    def update(self, instance, validated_data):
        instance.AR2mark  = validated_data.get('AR2mark',  instance.AR2mark)
        instance.AR2grade = validated_data.get('AR2grade', instance.AR2grade)
        instance.save(update_fields=['AR2mark', 'AR2grade'])
        return instance


# ─────────────────────────────────────────
# Headcount — full row (all 6 exams, view-only)
# ─────────────────────────────────────────

class HeadcountRowSerializer(serializers.Serializer):
    headcountID = serializers.UUIDField()
    userID      = serializers.UUIDField()
    studentName = serializers.CharField()
    className   = serializers.CharField(allow_null=True)
    subjectID   = serializers.UUIDField()
    subjectName = serializers.CharField()
    subjectCode = serializers.CharField(allow_null=True)
    TOVmark     = serializers.FloatField(allow_null=True)
    TOVgrade    = serializers.CharField(allow_null=True, allow_blank=True)
    AR1mark     = serializers.FloatField(allow_null=True)
    AR1grade    = serializers.CharField(allow_null=True, allow_blank=True)
    OTI1mark    = serializers.FloatField(allow_null=True)
    OTI1grade   = serializers.CharField(allow_null=True, allow_blank=True)
    AR2mark     = serializers.FloatField(allow_null=True)
    AR2grade    = serializers.CharField(allow_null=True, allow_blank=True)
    OTI2mark    = serializers.FloatField(allow_null=True)
    OTI2grade   = serializers.CharField(allow_null=True, allow_blank=True)
    ETRmark     = serializers.FloatField(allow_null=True)
    ETRgrade    = serializers.CharField(allow_null=True, allow_blank=True)


# ─────────────────────────────────────────
# Exam Analysis
# ─────────────────────────────────────────

class ExamAnalysisRowSerializer(serializers.Serializer):
    subjectID   = serializers.UUIDField()
    subjectName = serializers.CharField()
    subjectCode = serializers.CharField(allow_null=True)
    ambil       = serializers.IntegerField()
    tidakHadir  = serializers.IntegerField()
    gradeAPlus  = serializers.IntegerField()
    gradeA      = serializers.IntegerField()
    gradeAMinus = serializers.IntegerField()
    gradeBPlus  = serializers.IntegerField()
    gradeB      = serializers.IntegerField()
    gradeCPlus  = serializers.IntegerField()
    gradeC      = serializers.IntegerField()
    gradeD      = serializers.IntegerField()
    gradeE      = serializers.IntegerField()
    gradeG      = serializers.IntegerField()
    gagalPersen = serializers.CharField()
    lulusBil    = serializers.IntegerField()
    lulusPersen = serializers.CharField()
    gpmp        = serializers.CharField()


# ─────────────────────────────────────────
# Student Analysis
# ─────────────────────────────────────────

class StudentAnalysisRowSerializer(serializers.Serializer):
    userID        = serializers.UUIDField()
    studentName   = serializers.CharField()
    className     = serializers.CharField(allow_null=True)
    totalSubjects = serializers.IntegerField()
    gradeAPlus    = serializers.IntegerField()
    gradeA        = serializers.IntegerField()
    gradeAMinus   = serializers.IntegerField()
    gradeBPlus    = serializers.IntegerField()
    gradeB        = serializers.IntegerField()
    gradeCPlus    = serializers.IntegerField()
    gradeC        = serializers.IntegerField()
    gradeD        = serializers.IntegerField()
    gradeE        = serializers.IntegerField()
    gradeG        = serializers.IntegerField()
    gradeTH       = serializers.IntegerField()
    gradeSummary  = serializers.CharField()
    status        = serializers.CharField()
    gpi           = serializers.CharField()


# ─────────────────────────────────────────
# Student Self Analysis
# ─────────────────────────────────────────

class SelfAnalysisSubjectRowSerializer(serializers.Serializer):
    subjectID   = serializers.UUIDField(allow_null=True)
    subjectName = serializers.CharField()
    subjectCode = serializers.CharField(allow_null=True)
    mark        = serializers.FloatField(allow_null=True)
    grade       = serializers.CharField(allow_null=True, allow_blank=True)


# ─────────────────────────────────────────
# Rankings
# ─────────────────────────────────────────

class OverallRankingRowSerializer(serializers.Serializer):
    userID      = serializers.UUIDField()
    studentName = serializers.CharField()
    className   = serializers.CharField(allow_null=True)
    gpi         = serializers.CharField()
    status      = serializers.CharField()
    ranking     = serializers.IntegerField()


class SubjectRankingRowSerializer(serializers.Serializer):
    userID      = serializers.UUIDField()
    studentName = serializers.CharField()
    className   = serializers.CharField(allow_null=True)
    mark        = serializers.FloatField(allow_null=True)
    grade       = serializers.CharField(allow_null=True, allow_blank=True)
    ranking     = serializers.IntegerField()


# ─────────────────────────────────────────
# Headcount Slip
# ─────────────────────────────────────────

class HeadcountSlipStudentSerializer(serializers.Serializer):
    """Lightweight row for the student selection list."""
    userID      = serializers.UUIDField()
    studentName = serializers.CharField()
    className   = serializers.CharField(allow_null=True)


class HeadcountSlipSubjectSerializer(serializers.Serializer):
    """Per-subject row inside the detailed headcount slip."""
    subjectName = serializers.CharField()
    marks       = serializers.ListField(child=serializers.FloatField(allow_null=True))
    grades      = serializers.ListField(child=serializers.CharField(allow_null=True, allow_blank=True))


class HeadcountSlipDetailSerializer(serializers.Serializer):
    """Full headcount slip for a single student."""
    userID           = serializers.UUIDField()
    studentName      = serializers.CharField()
    className        = serializers.CharField(allow_null=True)
    classTeacherName = serializers.CharField(allow_null=True)
    principalName    = serializers.CharField(allow_null=True)
    exams            = serializers.ListField(child=serializers.CharField())
    subjects         = HeadcountSlipSubjectSerializer(many=True)
    gradeSummaries   = serializers.ListField(child=serializers.CharField())
    gpis             = serializers.ListField(child=serializers.CharField())


# ─────────────────────────────────────────
# Password Reset
# ─────────────────────────────────────────

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    year  = serializers.IntegerField(required=False, allow_null=True)


class PasswordResetTokenSerializer(serializers.Serializer):
    token = serializers.CharField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token        = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)


# ─────────────────────────────────────────
# Feedback
# ─────────────────────────────────────────

class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Feedback
        fields = ['feedbackID', 'name', 'email', 'title', 'description', 'is_read', 'created_at']
        read_only_fields = ['feedbackID', 'is_read', 'created_at']