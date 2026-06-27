from django.urls import path, include
from .views import AuthUserLoginView, HeadcountSlipViewSet, ExamAnalysisViewSet, OverallRankingViewSet, PasswordResetConfirmView, PasswordResetRequestView, PasswordResetValidateTokenView, StudentAnalysisViewSet, StudentHeadcountSlipViewSet, StudentSelfAnalysisViewSet, SubjectRankingViewSet, SubjectViewSet, ClassViewSet, UserViewSet, TOVViewSet, ETRViewSet, AR1ViewSet, AR2ViewSet, HeadcountViewSet, FeedbackViewSet
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'subjects', SubjectViewSet, basename='subject')
router.register(r'classes', ClassViewSet, basename='class')
router.register(r'users', UserViewSet, basename='user')
router.register(r'tov', TOVViewSet, basename='tov')
router.register(r'etr', ETRViewSet, basename='etr')
router.register(r'ar1', AR1ViewSet, basename='ar1')
router.register(r'ar2', AR2ViewSet, basename='ar2')
router.register(r'headcount', HeadcountViewSet, basename='headcount')
router.register(r'analysis-exam', ExamAnalysisViewSet, basename='analysis-exam')
router.register(r'analysis-student', StudentAnalysisViewSet, basename='analysis-student')
router.register(r'analysis-self', StudentSelfAnalysisViewSet, basename='analysis-self')
router.register(r'ranking-overall', OverallRankingViewSet, basename='ranking-overall')
router.register(r'ranking-subject', SubjectRankingViewSet, basename='ranking-subject')
router.register(r'headcount-slip', HeadcountSlipViewSet, basename='headcount-slip')
router.register(r'student-headcount-slip', StudentHeadcountSlipViewSet, basename='student-headcount-slip')
router.register(r'feedback', FeedbackViewSet, basename='feedback')

urlpatterns = [
    path('login/', AuthUserLoginView.as_view(), name='login'),

    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/validate-token/', PasswordResetValidateTokenView.as_view(), name='password-reset-validate'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),

    path('', include(router.urls)),
]