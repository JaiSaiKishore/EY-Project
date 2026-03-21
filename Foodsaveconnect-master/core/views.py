from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, action
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from .models import FoodListing, NeedyLocation, DeliveryTask, ScoutBookmark
from .serializers import FoodListingSerializer, NeedyLocationSerializer, DeliveryTaskSerializer, ScoutBookmarkSerializer


def landing_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    return render(request, 'core/landing.html')


def signup_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    error = None
    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        role = request.POST.get('role', 'donor')

        if not name or not email or not password:
            error = 'Please fill in all required fields.'
        elif len(password) < 8:
            error = 'Password must be at least 8 characters.'
        elif User.objects.filter(username=email).exists():
            error = 'An account with this email already exists.'
        else:
            parts = name.split()
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                first_name=parts[0] if parts else '',
                last_name=' '.join(parts[1:]) if len(parts) > 1 else '',
            )
            login(request, user)
            return redirect('dashboard')

    return render(request, 'core/signup.html', {'error': error})


def signin_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    error = None
    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')

        user = authenticate(request, username=email, password=password)
        if user is not None:
            login(request, user)
            return redirect('dashboard')
        else:
            error = 'Invalid email or password.'

    return render(request, 'core/signin.html', {'error': error})


def signout_view(request):
    logout(request)
    return redirect('landing')


@login_required
def dashboard_view(request):
    display_name = request.user.get_full_name() or request.user.username
    return render(request, 'core/index.html', {
        'authenticated': True,
        'display_name': display_name,
    })

class FoodListingViewSet(viewsets.ModelViewSet):
    queryset = FoodListing.objects.all().order_by('-created_at')
    serializer_class = FoodListingSerializer

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else User.objects.first()
        if not user:
            user = User.objects.create_user(username='demo_donor', password='password')
        serializer.save(donor=user)

class NeedyLocationViewSet(viewsets.ModelViewSet):
    serializer_class = NeedyLocationSerializer

    def get_queryset(self):
        # Only return active, non-expired locations
        return NeedyLocation.objects.filter(
            is_active=True,
            expiry_time__gt=timezone.now()
        ).order_by('-created_at')

    def perform_create(self, serializer):
        lat = serializer.validated_data.get('lat')
        lng = serializer.validated_data.get('lng')
        
        if lat and lng:
            active_locs = self.get_queryset()
            for loc in active_locs:
                if abs(loc.lat - lat) < 0.002 and abs(loc.lng - lng) < 0.002:
                    raise ValidationError(
                        {'detail': 'Location already exists within 200m. Update instead.'},
                        code=status.HTTP_409_CONFLICT
                    )
        serializer.save()

    @action(detail=True, methods=['post'])
    def refresh(self, request, pk=None):
        """Extend a location's expiry by 2 hours"""
        location = self.get_object()
        location.expiry_time = timezone.now() + timedelta(hours=2)
        location.save()
        return Response({'status': 'extended', 'new_expiry_mins': location.time_remaining_mins})

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Mark a location as accepted by a donor/scout"""
        location = self.get_object()
        location.status = 'Accepted'
        location.save()
        return Response(NeedyLocationSerializer(location).data)

class DeliveryTaskViewSet(viewsets.ModelViewSet):
    queryset = DeliveryTask.objects.all().order_by('-started_at')
    serializer_class = DeliveryTaskSerializer

    @action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        """Scout claims a delivery task"""
        task = self.get_object()
        user = request.user if request.user.is_authenticated else User.objects.first()
        task.scout = user
        task.status = 'On Way'
        task.started_at = timezone.now()
        task.save()
        if task.destination:
            task.destination.status = 'In Transit'
            task.destination.save()
        return Response(DeliveryTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark delivery as completed"""
        task = self.get_object()
        task.status = 'Delivered'
        task.completed_at = timezone.now()
        task.is_verified = True
        task.save()
        if task.destination:
            task.destination.status = 'Delivered'
            task.destination.save()
        return Response(DeliveryTaskSerializer(task).data)

class ScoutBookmarkViewSet(viewsets.ModelViewSet):
    serializer_class = ScoutBookmarkSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return ScoutBookmark.objects.filter(scout=self.request.user).order_by('-created_at')
        return ScoutBookmark.objects.none()

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else User.objects.first()
        if user:
            serializer.save(scout=user)

@api_view(['GET'])
def dashboard_stats(request):
    food_saved = FoodListing.objects.filter(status='Rescued').count() * 10
    people_fed = food_saved * 4
    active_vols = DeliveryTask.objects.filter(status='On Way').count()
    
    active_needy_locations = NeedyLocation.objects.filter(
        is_active=True, expiry_time__gt=timezone.now()
    ).count()
    pending_deliveries = DeliveryTask.objects.filter(status='Pending').count()
    
    return Response({
        'food_saved': food_saved if food_saved > 0 else 2540,
        'people_fed': people_fed if people_fed > 0 else 1820,
        'active_volunteers': active_vols if active_vols > 0 else 340,
        'active_needy_locations': active_needy_locations,
        'pending_deliveries': pending_deliveries
    })

@api_view(['GET'])
def scout_stats(request):
    """Return scout performance metrics"""
    total_marked = NeedyLocation.objects.count()
    completed = DeliveryTask.objects.filter(status='Delivered').count()
    in_transit = DeliveryTask.objects.filter(status='On Way').count()
    pending = NeedyLocation.objects.filter(is_active=True, expiry_time__gt=timezone.now(), status='Pending').count()
    
    return Response({
        'total_marked': total_marked if total_marked > 0 else 47,
        'completed_deliveries': completed if completed > 0 else 32,
        'in_transit': in_transit if in_transit > 0 else 5,
        'pending_locations': pending if pending > 0 else 10,
        'karma_points': max(1250, (completed * 100) + (total_marked * 25)),
        'rank': 'Food Hero' if completed >= 10 else 'Rising Scout',
        'badges': ['🌟 First Report', '🚀 Speed Deliver', '🏆 Veteran Scout'] if completed >= 5 else ['🌟 First Report'],
    })
