from rest_framework import serializers
from .models import FoodListing, NeedyLocation, DeliveryTask, ScoutBookmark, UserProfile, Notification, Rating, TrustScore, ChatMessage
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'role']

    def get_role(self, obj):
        return getattr(obj, 'profile', None) and obj.profile.role or 'donor'


class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = '__all__'


class FoodListingSerializer(serializers.ModelSerializer):
    donor_details = UserSerializer(source='donor', read_only=True)
    time_remaining = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = FoodListing
        fields = '__all__'

    def get_time_remaining(self, obj):
        return obj.time_remaining_mins

    def get_is_expired(self, obj):
        return obj.is_expired


class NeedyLocationSerializer(serializers.ModelSerializer):
    time_remaining = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    reporter = UserSerializer(source='reported_by', read_only=True)

    class Meta:
        model = NeedyLocation
        fields = '__all__'

    def get_time_remaining(self, obj):
        return obj.time_remaining_mins

    def get_is_expired(self, obj):
        return obj.is_expired


class DeliveryTaskSerializer(serializers.ModelSerializer):
    food_details = FoodListingSerializer(source='food_listing', read_only=True)
    destination_details = NeedyLocationSerializer(source='destination', read_only=True)
    scout_details = UserSerializer(source='scout', read_only=True)

    class Meta:
        model = DeliveryTask
        fields = '__all__'


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'


class ScoutBookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScoutBookmark
        fields = '__all__'


class RatingSerializer(serializers.ModelSerializer):
    reviewer_details = UserSerializer(source='reviewer', read_only=True)
    reviewee_details = UserSerializer(source='reviewee', read_only=True)

    class Meta:
        model = Rating
        fields = '__all__'
        read_only_fields = ['reviewer']


class TrustScoreSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = TrustScore
        fields = '__all__'


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_details = UserSerializer(source='sender', read_only=True)

    class Meta:
        model = ChatMessage
        fields = '__all__'
        read_only_fields = ['sender']
