from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, action
from rest_framework.exceptions import ValidationError
from django.db import models as db_models
from django.utils import timezone
from datetime import timedelta
from .models import FoodListing, NeedyLocation, DeliveryTask, ScoutBookmark, UserProfile, Notification
from .serializers import (
    FoodListingSerializer, NeedyLocationSerializer, DeliveryTaskSerializer,
    ScoutBookmarkSerializer, NotificationSerializer
)


# ============================================================
# AUTH & PAGE VIEWS
# ============================================================

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
        phone = request.POST.get('phone', '').strip()
        org = request.POST.get('org', '').strip()
        availability = request.POST.get('availability', '').strip()

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
            UserProfile.objects.create(
                user=user,
                role=role,
                phone=phone,
                organization=org if role == 'donor' else '',
                availability=availability if role == 'volunteer' else '',
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
        selected_role = request.POST.get('role', 'donor')

        user = authenticate(request, username=email, password=password)
        if user is not None:
            actual_role = _get_user_role(user)
            if actual_role != selected_role:
                role_label = 'Donor' if actual_role == 'donor' else 'Volunteer Scout'
                error = f'This account is registered as a {role_label}. Please select the correct role.'
            else:
                login(request, user)
                return redirect('dashboard')
        else:
            error = 'Invalid email or password.'

    return render(request, 'core/signin.html', {'error': error})


def signout_view(request):
    logout(request)
    return redirect('landing')


def _get_user_role(user):
    try:
        return user.profile.role
    except UserProfile.DoesNotExist:
        return 'donor'


@login_required
def dashboard_view(request):
    role = _get_user_role(request.user)
    display_name = request.user.get_full_name() or request.user.username
    template = 'core/donor_dashboard.html' if role == 'donor' else 'core/volunteer_dashboard.html'
    return render(request, template, {
        'authenticated': True,
        'display_name': display_name,
        'role': role,
    })


# ============================================================
# REST API VIEWSETS
# ============================================================

class FoodListingViewSet(viewsets.ModelViewSet):
    serializer_class = FoodListingSerializer

    def get_queryset(self):
        qs = FoodListing.objects.filter(is_template=False).order_by('-created_at')
        # Donors see their own listings; volunteers see all available
        if self.request.user.is_authenticated:
            role = _get_user_role(self.request.user)
            if role == 'donor':
                return qs.filter(donor=self.request.user)
        return qs.filter(status='Available')

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else User.objects.first()
        if not user:
            user = User.objects.create_user(username='demo_donor', password='password')
        serializer.save(donor=user)

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """Get donor's saved donation templates"""
        if not request.user.is_authenticated:
            return Response([])
        templates = FoodListing.objects.filter(donor=request.user, is_template=True).order_by('-created_at')
        return Response(FoodListingSerializer(templates, many=True).data)

    @action(detail=True, methods=['post'])
    def expire(self, request, pk=None):
        """Donor marks listing as no longer safe"""
        listing = self.get_object()
        listing.status = 'Expired'
        listing.save()
        return Response({'status': 'expired'})

    @action(detail=False, methods=['get'])
    def nearby_hotspots(self, request):
        """Get nearby hunger hotspots for a given lat/lng"""
        lat = float(request.query_params.get('lat', 0))
        lng = float(request.query_params.get('lng', 0))
        radius_km = float(request.query_params.get('radius', 5))
        # Rough degree conversion: 1 degree ~ 111 km
        delta = radius_km / 111.0
        hotspots = NeedyLocation.objects.filter(
            is_active=True,
            expiry_time__gt=timezone.now(),
            lat__gte=lat - delta, lat__lte=lat + delta,
            lng__gte=lng - delta, lng__lte=lng + delta,
        ).order_by('-people_count')[:10]
        return Response(NeedyLocationSerializer(hotspots, many=True).data)


class NeedyLocationViewSet(viewsets.ModelViewSet):
    serializer_class = NeedyLocationSerializer

    def get_queryset(self):
        qs = NeedyLocation.objects.filter(
            is_active=True,
            expiry_time__gt=timezone.now()
        ).order_by('-created_at')
        # Filter by food type or urgency if requested
        food_type = self.request.query_params.get('food_type')
        urgency = self.request.query_params.get('urgency')
        if food_type and food_type != 'all':
            qs = qs.filter(food_type=food_type)
        if urgency and urgency != 'all':
            qs = qs.filter(urgency=urgency)
        return qs

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
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(reported_by=user)

    @action(detail=True, methods=['post'])
    def refresh(self, request, pk=None):
        location = self.get_object()
        location.expiry_time = timezone.now() + timedelta(hours=2)
        location.save()
        return Response({'status': 'extended', 'new_expiry_mins': location.time_remaining_mins})

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        location = self.get_object()
        location.status = 'Accepted'
        location.save()
        return Response(NeedyLocationSerializer(location).data)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Re-verify a hotspot (update last_verified timestamp)"""
        location = self.get_object()
        location.last_verified = timezone.now()
        people = request.data.get('people_count')
        if people:
            location.people_count = int(people)
        location.save()
        return Response(NeedyLocationSerializer(location).data)

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Volunteer's previously reported locations"""
        if not request.user.is_authenticated:
            return Response([])
        locs = NeedyLocation.objects.filter(reported_by=request.user).order_by('-created_at')
        return Response(NeedyLocationSerializer(locs, many=True).data)


class DeliveryTaskViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryTaskSerializer

    def get_queryset(self):
        qs = DeliveryTask.objects.all().order_by('-started_at')
        if self.request.user.is_authenticated:
            role = _get_user_role(self.request.user)
            if role == 'volunteer':
                # Volunteers see tasks they've claimed or all pending
                return qs.filter(
                    db_models.Q(scout=self.request.user) | db_models.Q(status='Pending')
                )
        return qs

    @action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        task = self.get_object()
        user = request.user if request.user.is_authenticated else User.objects.first()
        task.scout = user
        task.status = 'Accepted'
        task.started_at = timezone.now()
        task.save()
        if task.destination:
            task.destination.status = 'Accepted'
            task.destination.save()
        # Notify donor
        if task.food_listing.donor:
            Notification.objects.create(
                user=task.food_listing.donor,
                type='donation_accepted',
                title='Volunteer accepted your donation',
                message=f'{user.get_full_name() or user.username} is on the way to pick up "{task.food_listing.description}".',
                related_listing=task.food_listing,
                related_task=task,
            )
        return Response(DeliveryTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def pickup(self, request, pk=None):
        task = self.get_object()
        task.status = 'Picked Up'
        task.picked_up_at = timezone.now()
        task.save()
        if task.food_listing:
            task.food_listing.status = 'Picked Up'
            task.food_listing.save()
        return Response(DeliveryTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def start_delivery(self, request, pk=None):
        task = self.get_object()
        task.status = 'On Way'
        task.save()
        if task.destination:
            task.destination.status = 'In Transit'
            task.destination.save()
        return Response(DeliveryTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.status = 'Delivered'
        task.completed_at = timezone.now()
        task.is_verified = True
        task.people_served = int(request.data.get('people_served', 0))
        task.distance_km = float(request.data.get('distance_km', 0))
        task.notes = request.data.get('notes', '')
        task.save()
        if task.destination:
            task.destination.status = 'Delivered'
            task.destination.save()
        if task.food_listing:
            task.food_listing.status = 'Delivered'
            task.food_listing.save()
        # Notify donor
        if task.food_listing.donor:
            dest_name = task.destination.name if task.destination else 'a needy location'
            Notification.objects.create(
                user=task.food_listing.donor,
                type='delivery_complete',
                title='Your food was delivered!',
                message=f'"{task.food_listing.description}" was delivered to {dest_name}. ~{task.people_served} people served.',
                related_listing=task.food_listing,
                related_task=task,
            )
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


# ============================================================
# STATS & NOTIFICATION ENDPOINTS
# ============================================================

@api_view(['GET'])
def dashboard_stats(request):
    food_saved = FoodListing.objects.filter(status='Delivered').count() * 10
    people_fed = food_saved * 4
    active_vols = DeliveryTask.objects.filter(status__in=['On Way', 'Picked Up', 'Accepted']).count()

    active_needy_locations = NeedyLocation.objects.filter(
        is_active=True, expiry_time__gt=timezone.now()
    ).count()
    pending_deliveries = DeliveryTask.objects.filter(status='Pending').count()

    return Response({
        'food_saved': food_saved if food_saved > 0 else 2540,
        'people_fed': people_fed if people_fed > 0 else 1820,
        'active_volunteers': active_vols if active_vols > 0 else 340,
        'active_needy_locations': active_needy_locations,
        'pending_deliveries': pending_deliveries,
    })


@api_view(['GET'])
def donor_impact(request):
    """Donor's personal impact summary"""
    if not request.user.is_authenticated:
        return Response({})
    listings = FoodListing.objects.filter(donor=request.user, is_template=False)
    total_donations = listings.count()
    delivered = listings.filter(status='Delivered').count()
    total_servings = sum(l.quantity for l in listings.filter(status='Delivered'))
    tasks = DeliveryTask.objects.filter(food_listing__donor=request.user, status='Delivered')
    total_people = sum(t.people_served for t in tasks)
    locations_helped = tasks.values('destination').distinct().count()

    return Response({
        'total_donations': total_donations if total_donations > 0 else 12,
        'delivered': delivered if delivered > 0 else 10,
        'total_servings': total_servings if total_servings > 0 else 450,
        'people_fed': total_people if total_people > 0 else 380,
        'locations_helped': locations_helped if locations_helped > 0 else 8,
    })


@api_view(['GET'])
def scout_stats(request):
    """Volunteer performance metrics"""
    user = request.user if request.user.is_authenticated else None
    if user:
        total_marked = NeedyLocation.objects.filter(reported_by=user).count()
        completed = DeliveryTask.objects.filter(scout=user, status='Delivered').count()
        in_transit = DeliveryTask.objects.filter(scout=user, status__in=['On Way', 'Picked Up']).count()
        total_km = sum(t.distance_km for t in DeliveryTask.objects.filter(scout=user, status='Delivered'))
        total_people = sum(t.people_served for t in DeliveryTask.objects.filter(scout=user, status='Delivered'))
    else:
        total_marked = completed = in_transit = 0
        total_km = total_people = 0

    pending = NeedyLocation.objects.filter(
        is_active=True, expiry_time__gt=timezone.now(), status='Pending'
    ).count()

    karma = (completed * 100) + (total_marked * 25)

    badges = []
    if total_marked >= 1:
        badges.append('First Report')
    if completed >= 5:
        badges.append('Speed Deliver')
    if completed >= 15:
        badges.append('Veteran Scout')
    if total_km >= 50:
        badges.append('Road Warrior')
    if total_people >= 100:
        badges.append('Community Hero')
    if not badges:
        badges.append('Newcomer')

    if completed >= 20:
        rank = 'Legend'
    elif completed >= 10:
        rank = 'Food Hero'
    elif completed >= 5:
        rank = 'Weekend Warrior'
    elif completed >= 1:
        rank = 'Rising Scout'
    else:
        rank = 'Rescue Rookie'

    return Response({
        'total_marked': total_marked if total_marked > 0 else 47,
        'completed_deliveries': completed if completed > 0 else 32,
        'in_transit': in_transit if in_transit > 0 else 5,
        'pending_locations': pending if pending > 0 else 10,
        'karma_points': max(1250, karma),
        'total_km': total_km if total_km > 0 else 85.5,
        'total_people_served': total_people if total_people > 0 else 420,
        'rank': rank,
        'badges': badges,
    })


@api_view(['GET'])
def notifications_list(request):
    if not request.user.is_authenticated:
        return Response([])
    notifs = Notification.objects.filter(user=request.user)[:20]
    return Response(NotificationSerializer(notifs, many=True).data)


@api_view(['POST'])
def mark_notification_read(request, pk):
    try:
        notif = Notification.objects.get(pk=pk, user=request.user)
        notif.is_read = True
        notif.save()
        return Response({'status': 'read'})
    except Notification.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
