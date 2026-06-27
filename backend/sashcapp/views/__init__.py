# Re-export all views so that urls.py imports remain unchanged.

from .auth import (  # noqa: F401
    AuthUserLoginView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetValidateTokenView,
)
from .subject import SubjectViewSet  # noqa: F401
from .classes import ClassViewSet  # noqa: F401
from .users import UserViewSet  # noqa: F401
from .tov import TOVViewSet  # noqa: F401
from .exams import AR1ViewSet, AR2ViewSet, ETRViewSet  # noqa: F401
from .headcount import HeadcountViewSet  # noqa: F401
from .analysis import (  # noqa: F401
    ExamAnalysisViewSet,
    StudentAnalysisViewSet,
    StudentSelfAnalysisViewSet,
)
from .ranking import OverallRankingViewSet, SubjectRankingViewSet  # noqa: F401
from .headcountslip import HeadcountSlipViewSet, StudentHeadcountSlipViewSet  # noqa: F401
from .feedback import FeedbackViewSet  # noqa: F401
