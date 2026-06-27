import logging

from django.conf import settings
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from ..models import PasswordResetToken, User
from ..serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetTokenSerializer,
    UserLoginSerializer,
)
from .utils import get_active_year

logger = logging.getLogger(__name__)


class AuthUserLoginView(APIView):
    permission_classes = (AllowAny,)
    serializer_class = UserLoginSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = getattr(serializer, '_authenticated_user', None)
        if user:
            update_last_login(None, user)

        return Response({
            'success': True,
            'statusCode': status.HTTP_200_OK,
            'message': 'User logged in successfully',
            'email': serializer.validated_data['email'],
            'role': serializer.validated_data['role'],
        }, status=status.HTTP_200_OK)


class PasswordResetThrottle(AnonRateThrottle):
    """5 password-reset requests per IP per hour."""
    scope = 'password_reset'


class PasswordResetRequestView(APIView):
    """
    Handle password reset request - send email with reset link
    POST /api/sashc/password-reset/request/
    Body: { "email": "user@moe-dl.edu.my" }
    """
    permission_classes     = []
    authentication_classes = []
    throttle_classes       = [PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        # Always return 200 to prevent user enumeration (never reveal whether
        # the email exists in the system).
        _GENERIC_OK = Response(
            {'message': 'Jika emel anda wujud dalam sistem, pautan tetapan semula telah dihantar.'},
            status=status.HTTP_200_OK,
        )

        # Prefer year from request body, fall back to query param
        year = serializer.validated_data.get('year') or get_active_year(request)
        user = None
        if year is not None:
            user = User.objects.filter(email=email, year=year, is_active=True).first()

        if user is None:
            logger.warning(f"Password reset requested for non-existent email/year combination: {email}, year={year}")
            return _GENERIC_OK

        try:
            # Invalidate any old unused tokens for this user
            PasswordResetToken.objects.filter(user=user, is_used=False).delete()

            # Create new token — raw value goes into the link, hash stored in DB
            _, raw_token = PasswordResetToken.create_for_user(user)
            reset_link = f"{settings.FRONTEND_URL}/{user.year}/confirm-reset-password?token={raw_token}"

            email_subject = 'Tetapan Semula Kata Laluan - SASHC'

            email_html = f'''<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tetapan Semula Kata Laluan</title>
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
                            <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: bold;">Tetapan Semula Kata Laluan</h2>
                            <p style="margin: 0 0 15px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                                Hai <strong>{user.name}</strong>,
                            </p>
                            <p style="margin: 0 0 25px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                                Anda telah meminta untuk menetapkan semula kata laluan anda untuk sistem SASHC.
                            </p>
                            <p style="margin: 0 0 30px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                                Klik butang di bawah untuk menetapkan kata laluan baru:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 0 0 30px 0;">
                                        <a href="{reset_link}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #00ffef, #40e0d0); color: #000000; text-decoration: none; font-weight: bold; font-size: 16px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,255,239,0.4);">
                                            Tetapkan Kata Laluan Baru
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 15px 0; color: #777777; font-size: 14px; line-height: 1.6;">
                                Atau salin dan tampal pautan ini ke pelayar anda:
                            </p>
                            <p style="margin: 0 0 25px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #333333; border-radius: 4px; word-break: break-all;">
                                <a href="{reset_link}" style="color: #333333; text-decoration: none; font-size: 14px;">{reset_link}</a>
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
                                <tr>
                                    <td style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px;">
                                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                            ⚠️ <strong>Nota Penting:</strong> Pautan ini akan tamat tempoh dalam <strong>1 jam</strong>.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 15px 0; color: #555555; font-size: 14px; line-height: 1.6;">
                                Jika anda tidak meminta tetapan semula kata laluan ini, sila abaikan emel ini. Akaun anda kekal selamat dan tiada perubahan akan dibuat.
                            </p>
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

Anda telah meminta untuk menetapkan semula kata laluan anda untuk sistem SASHC.

Klik pautan di bawah untuk menetapkan kata laluan baru:
{reset_link}

Pautan ini akan tamat tempoh dalam 1 jam.

Jika anda tidak meminta tetapan semula kata laluan ini, sila abaikan emel ini. Akaun anda kekal selamat.

Terima kasih,
Pasukan Pentadbir SASHC
Sekolah Menengah St. Anthony WP Labuan'''

            from django.core.mail import EmailMultiAlternatives
            msg = EmailMultiAlternatives(
                subject=email_subject,
                body=email_text,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[email],
            )
            msg.attach_alternative(email_html, "text/html")
            msg.send(fail_silently=False)

            logger.info(f"Password reset email sent to {email}")

            return Response(
                {'message': 'Password reset link has been sent to your email.'},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Error sending password reset email to {email}: {str(e)}")
            return Response(
                {'message': 'Failed to send password reset email. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PasswordResetValidateTokenView(APIView):
    """
    Validate if a password reset token is valid
    POST /api/sashc/password-reset/validate-token/
    Body: { "token": "uuid-token-string" }
    """
    permission_classes     = []
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token_value = serializer.validated_data['token']

        try:
            reset_token = PasswordResetToken.get_by_raw_token(token_value)

            if not reset_token.is_valid():
                message = 'This reset link has already been used.' if reset_token.is_used else 'This reset link has expired.'
                return Response({'message': message, 'valid': False}, status=status.HTTP_400_BAD_REQUEST)

            return Response(
                {'valid': True, 'message': 'Token is valid', 'user_email': reset_token.user.email},
                status=status.HTTP_200_OK,
            )

        except PasswordResetToken.DoesNotExist:
            return Response(
                {'message': 'Invalid reset link.', 'valid': False},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.error(f"Error validating token: {str(e)}")
            return Response(
                {'message': 'Error validating token.', 'valid': False},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PasswordResetConfirmView(APIView):
    """
    Confirm password reset - update user's password
    POST /api/sashc/password-reset/confirm/
    Body: { "token": "uuid-token-string", "new_password": "newpassword123" }
    """
    permission_classes     = []
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token_value  = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            reset_token = PasswordResetToken.get_by_raw_token(token_value)

            if not reset_token.is_valid():
                message = (
                    'This reset link has already been used.'
                    if reset_token.is_used
                    else 'This reset link has expired.'
                )
                return Response({'message': message}, status=status.HTTP_400_BAD_REQUEST)

            user = reset_token.user

            try:
                validate_password(new_password, user)
            except ValidationError as e:
                return Response(
                    {'message': ' '.join(e.messages)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user.set_password(new_password)
            user.save()

            reset_token.mark_as_used()

            logger.info(f"Password successfully reset for user: {user.email}")

            return Response(
                {'message': 'Password has been reset successfully. You can now login with your new password.'},
                status=status.HTTP_200_OK,
            )

        except PasswordResetToken.DoesNotExist:
            return Response(
                {'message': 'Invalid reset link.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.error(f"Error resetting password: {str(e)}")
            return Response(
                {'message': 'Failed to reset password. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
