from rest_framework import serializers
from .models import FoodListing, NeedyLocation, DeliveryTask, ScoutBookmark
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name']

class FoodListingSerializer(serializers.ModelSerializer):
    donor_details = UserSerializer(source='donor', read_only=True)
    
    class Meta:
        model = FoodListing
        fields = '__all__'

class NeedyLocationSerializer(serializers.ModelSerializer):
    time_remaining = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

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

class ScoutBookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScoutBookmark
        fields = '__all__'
