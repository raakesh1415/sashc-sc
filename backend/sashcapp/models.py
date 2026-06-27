from datetime import timedelta
import hashlib
import uuid
from django.db import models
from django.contrib.auth.models import PermissionsMixin
from django.contrib.auth.base_user import AbstractBaseUser
from django.utils import timezone

from .managers import CustomUserManager


# ─── Subject ──────────────────────────────────────────────────────────────────

class Subject(models.Model):
    subjectID   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subjectCode = models.CharField(max_length=20, blank=True, null=True)
    subjectName = models.CharField(max_length=150)
    year        = models.IntegerField(null=True, blank=True)

    class Meta:
        # db_table = 'subject'
        constraints = [
            models.UniqueConstraint(
                fields=['subjectName', 'year'],
                condition=models.Q(year__isnull=False),
                name='unique_subject_name_per_year',
            ),
        ]
        indexes = [
            models.Index(fields=['year'], name='subject_year_idx'),
        ]

    def __str__(self):
        return self.subjectName


# ─── Class ────────────────────────────────────────────────────────────────────

class Class(models.Model):
    classID   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    className = models.CharField(max_length=100, blank=True, null=True)
    year      = models.IntegerField(null=True, blank=True)
    # Note: teacherID FK will be added after Teacher model is defined

    class Meta:
        # db_table = 'class'
        constraints = [
            models.UniqueConstraint(
                fields=['className', 'year'],
                condition=models.Q(year__isnull=False),
                name='unique_class_name_per_year',
            ),
        ]
        indexes = [
            models.Index(fields=['year'], name='class_year_idx'),
        ]

    def __str__(self):
        return self.className or str(self.classID)


# ─── EnrollSubject (container for subject enrollments) ───────────────────────

class EnrollSubject(models.Model):
    """
    Container model that groups multiple SubjectEnrollment records together.
    Each Student or Teacher has one EnrollSubject that contains all their
    subject-class enrollments.
    """
    enrollSubjectID = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # class Meta:
    #     db_table = 'enroll_subject'

    def __str__(self):
        return str(self.enrollSubjectID)


# ─── SubjectEnrollment (intermediate model: subject + class link) ────────────

class SubjectEnrollment(models.Model):
    """
    Represents a single subject enrollment with its associated class.
    
    Logic:
    - For Students: Each subject enrollment typically has one class
    - For Subject Teachers: Each subject can have multiple classes
      Example: Math subject → [Class A, Class B]
               Science subject → [Class C, Class A, Class B]
    
    Multiple SubjectEnrollment rows belong to one EnrollSubject.
    """
    subjectEnrollmentID = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollSubjectID     = models.ForeignKey(
        EnrollSubject, on_delete=models.CASCADE,
        related_name='enrollments',
        db_column='enrollSubjectID'
    )
    subjectID           = models.ForeignKey(
        Subject, on_delete=models.CASCADE,
        related_name='enrollments',
        db_column='subjectID'
    )
    classID             = models.ForeignKey(
        Class, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='subject_enrollments',
        db_column='classID'
    )

    class Meta:
        # db_table = 'subject_enrollment'
        # Prevent duplicate subject-class combinations within same enrollment
        unique_together = [['enrollSubjectID', 'subjectID', 'classID']]

    def __str__(self):
        return f"{self.subjectID.subjectName} - {self.classID.className if self.classID else 'No Class'}"


# ─── Student ──────────────────────────────────────────────────────────────────

class Student(models.Model):
    studentID       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollSubjectID = models.ForeignKey(
        EnrollSubject, on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='enrollSubjectID',
        related_name='students'
    )
    classID         = models.ForeignKey(
        Class, on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='classID',
        related_name='students'
    )

    # class Meta:
    #     db_table = 'student'

    def __str__(self):
        return str(self.studentID)


# ─── Teacher ──────────────────────────────────────────────────────────────────

class Teacher(models.Model):
    teacherID       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollSubjectID = models.ForeignKey(
        EnrollSubject, on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='enrollSubjectID',
        related_name='teachers'
    )
    is_principal    = models.BooleanField(default=False)
    # classID         = models.ForeignKey(
    #     Class, on_delete=models.SET_NULL,
    #     null=True, blank=True,
    #     db_column='classID',
    #     related_name='managed_by_teacher'
    # )

    # class Meta:
    #     db_table = 'teacher'

    def __str__(self):
        return str(self.teacherID)


# ─── Add teacherID FK to Class now that Teacher is defined ───────────────────

Class.add_to_class(
    'teacherID',
    models.ForeignKey(
        Teacher, on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='teacherID',
        related_name='assigned_classes'
    )
)


# ─── Admin ────────────────────────────────────────────────────────────────────

class Admin(models.Model):
    adminID   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacherID = models.ForeignKey(
        Teacher, on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='teacherID',
        related_name='admins'
    )

    # class Meta:
    #     db_table = 'admin'

    def __str__(self):
        return str(self.adminID)


# ─── User ─────────────────────────────────────────────────────────────────────

class User(AbstractBaseUser, PermissionsMixin):
    ADMIN           = 'Admin'
    SUBJECT_TEACHER = 'Subject Teacher'
    STUDENT         = 'Student'
    CLASS_TEACHER   = 'Class Teacher'

    VALID_ROLES = [ADMIN, SUBJECT_TEACHER, STUDENT, CLASS_TEACHER]

    userID         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email          = models.EmailField()
    name           = models.CharField(max_length=150)
    role           = models.JSONField(default=list, blank=True, db_column='role')
    gender         = models.CharField(max_length=20, blank=True, null=True)
    profilePicture = models.TextField(blank=True, null=True)
    year           = models.IntegerField(null=True, blank=True)

    studentID      = models.OneToOneField(
        Student, on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='studentID',
        related_name='user_profile'
    )
    adminID        = models.OneToOneField(
        Admin, on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='adminID',
        related_name='user_profile'
    )
    teacherID      = models.OneToOneField(
        Teacher, on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='teacherID',
        related_name='user_profile'
    )

    # status         = models.BooleanField(default=True)
    date_joined    = models.DateTimeField(auto_now_add=True)
    is_active      = models.BooleanField(default=True)
    is_staff       = models.BooleanField(default=False)
    is_superuser   = models.BooleanField(default=False)
    is_deleted     = models.BooleanField(default=False)
    created_date   = models.DateTimeField(default=timezone.now)
    modified_date  = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    class Meta:
        # db_table = 'user'
        constraints = [
            # Same email allowed across different years, but not within the same year
            models.UniqueConstraint(
                fields=['email', 'year'],
                condition=models.Q(year__isnull=False),
                name='unique_email_per_year',
            ),
            # For users with no year (system accounts), email must still be unique
            models.UniqueConstraint(
                fields=['email'],
                condition=models.Q(year__isnull=True),
                name='unique_email_no_year',
            ),
        ]
        indexes = [
            models.Index(fields=['year'],         name='user_year_idx'),
            models.Index(fields=['email', 'year'], name='user_email_year_idx'),
            models.Index(fields=['studentID'],    name='user_student_idx'),
            models.Index(fields=['teacherID'],    name='user_teacher_idx'),
        ]

    def __str__(self):
        return self.email

    @property
    def roles(self):
        return self.role

    @roles.setter
    def roles(self, value):
        self.role = value

    def has_role(self, r):
        return r in (self.role or [])

    def primary_role(self):
        priority = [self.ADMIN, self.CLASS_TEACHER, self.SUBJECT_TEACHER, self.STUDENT]
        for r in priority:
            if self.has_role(r):
                return r
        return None


# ─── Headcount ────────────────────────────────────────────────────────────────

class Headcount(models.Model):
    headcountID = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    userID      = models.ForeignKey(
        User, on_delete=models.CASCADE,
        db_column='userID',
        related_name='headcounts'
    )
    subjectID   = models.ForeignKey(
        Subject, on_delete=models.CASCADE,
        db_column='subjectID',
        related_name='headcounts'
    )

    TOVmark  = models.FloatField(null=True, blank=True)
    TOVgrade = models.CharField(max_length=5, null=True, blank=True)
    ETRmark  = models.FloatField(null=True, blank=True)
    ETRgrade = models.CharField(max_length=5, null=True, blank=True)
    AR1mark  = models.FloatField(null=True, blank=True)
    AR1grade = models.CharField(max_length=5, null=True, blank=True)
    AR2mark  = models.FloatField(null=True, blank=True)
    AR2grade = models.CharField(max_length=5, null=True, blank=True)
    OTI1mark  = models.FloatField(null=True, blank=True)
    OTI1grade = models.CharField(max_length=5, null=True, blank=True)
    OTI2mark  = models.FloatField(null=True, blank=True)
    OTI2grade = models.CharField(max_length=5, null=True, blank=True)

    class Meta:
        # db_table = 'headcount'
        unique_together = [['userID', 'subjectID']]
        indexes = [
            models.Index(fields=['userID', 'subjectID'], name='headcount_user_subject_idx'),
            models.Index(fields=['subjectID'],           name='headcount_subject_idx'),
        ]

    def __str__(self):
        return str(self.headcountID)


# ─── PasswordResetToken ────────────────────────────────────────────────────────

class PasswordResetToken(models.Model):
    """
    Model to store password reset tokens with expiration.
    The raw token (UUID) is sent in the email and never stored.
    Only its SHA-256 hash is persisted so a DB breach cannot be used
    to construct valid reset links.
    """
    tokenID    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token      = models.CharField(max_length=64, unique=True, db_index=True)  # SHA-256 hex digest
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used    = models.BooleanField(default=False)

    # ── Factory ──────────────────────────────────────────────────────────────

    @classmethod
    def create_for_user(cls, user):
        """
        Generate a new token for *user*.
        Returns (instance, raw_token) where raw_token is the UUID string
        to embed in the reset link — it is never stored.
        """
        raw_token  = str(uuid.uuid4())
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        instance   = cls(user=user, token=token_hash)
        instance.save()
        return instance, raw_token

    @classmethod
    def get_by_raw_token(cls, raw_token):
        """Look up a record by the raw (unhashed) token from the reset link."""
        token_hash = hashlib.sha256(str(raw_token).encode()).hexdigest()
        return cls.objects.get(token=token_hash)

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at

    def mark_as_used(self):
        self.is_used = True
        self.save()

    class Meta:
        # db_table = 'password_reset_tokens'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user_id', '-created_at']),
        ]


# ─── Feedback ──────────────────────────────────────────────────────────────────

class Feedback(models.Model):
    feedbackID = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=255)
    email      = models.EmailField()
    title       = models.CharField(max_length=255)
    description = models.TextField()
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.title}"

    def __str__(self):
        return f"Reset token for {self.user.email} - Valid: {self.is_valid()}"