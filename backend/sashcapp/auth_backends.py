from .models import User


class YearAwareBackend:
    """
    Authentication backend that resolves the correct User when the same email
    exists across multiple academic years.

    Lookup priority:
      1. If a year is provided → find User with (email, year=year)
      2. If no year (or no match) → fall back to User with (email, year=null)
    """

    def authenticate(self, request, email=None, password=None, year=None, username=None, **kwargs):
        # Django admin passes credentials as username= instead of email=
        if email is None:
            email = username
        if not email:
            return None

        email = email.lower()

        # If year wasn't passed as a kwarg, read it from the request's query params.
        # This handles TokenObtainPairView (SimpleJWT) which calls authenticate()
        # without the year kwarg — the frontend appends ?year=XXXX to the URL.
        if year is None and request is not None:
            try:
                year = int((getattr(request, 'query_params', None) or request.GET).get('year'))
            except (TypeError, ValueError):
                year = None

        user = None

        if year is not None:
            try:
                user = User.objects.get(email=email, year=year)
            except User.DoesNotExist:
                pass
            except User.MultipleObjectsReturned:
                return None

        # Fall back to year-less account (system / admin accounts with no year)
        if user is None:
            try:
                user = User.objects.get(email=email, year__isnull=True)
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                # Run the hasher anyway to mitigate timing attacks
                User().set_password(password)
                return None

        if user.check_password(password) and self._user_can_authenticate(user):
            return user
        return None

    def _user_can_authenticate(self, user):
        return bool(getattr(user, 'is_active', False))

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
