from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

class FoodListing(models.Model):
    donor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='donations')
    description = models.CharField(max_length=255)
    quantity = models.IntegerField(help_text="Approx in kg or servings")
    prepared_time = models.DateTimeField()
    expiry_time = models.DateTimeField()
    is_self_delivered = models.BooleanField(default=False)
    target_lat = models.FloatField(null=True, blank=True)
    target_lng = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50, default='Available') # Available, Claimed, Rescued

    def __str__(self):
        return f"{self.description} by {self.donor.username}"

class NeedyLocation(models.Model):
    URGENCY_CHOICES = [('High', 'High'), ('Medium', 'Medium'), ('Low', 'Low')]
    STATUS_CHOICES = [('Pending', 'Pending'), ('Accepted', 'Accepted'), ('In Transit', 'In Transit'), ('Delivered', 'Delivered')]
    CATEGORY_CHOICES = [('Children', 'Children'), ('Elderly', 'Elderly'), ('Mixed', 'Mixed'), ('General', 'General')]
    FOOD_TYPE_CHOICES = [('Veg', 'Veg'), ('Non-veg', 'Non-veg'), ('Any', 'Any')]

    name = models.CharField(max_length=255, default="Unnamed Location")
    description = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    address = models.CharField(max_length=500, blank=True, null=True)
    lat = models.FloatField()
    lng = models.FloatField()
    urgency = models.CharField(max_length=50, choices=URGENCY_CHOICES, default='Medium')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='General')
    food_type = models.CharField(max_length=50, choices=FOOD_TYPE_CHOICES, default='Any')
    meals_needed = models.IntegerField(default=10)
    people_count = models.IntegerField(default=0)
    photo = models.ImageField(upload_to='scout_photos/', blank=True, null=True)
    reported_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reported_locations')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    is_active = models.BooleanField(default=True)
    expiry_time = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.expiry_time:
            self.expiry_time = timezone.now() + timedelta(hours=4)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expiry_time if self.expiry_time else False

    @property
    def time_remaining_mins(self):
        if self.expiry_time:
            delta = self.expiry_time - timezone.now()
            return max(0, int(delta.total_seconds() / 60))
        return 0

    def __str__(self):
        return f"{self.name} - {self.urgency} Urgency"

class DeliveryTask(models.Model):
    food_listing = models.ForeignKey(FoodListing, on_delete=models.CASCADE)
    destination = models.ForeignKey(NeedyLocation, on_delete=models.CASCADE, null=True, blank=True)
    scout = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='deliveries')
    status = models.CharField(max_length=50, default='Pending') # Pending, On Way, Delivered
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    proof_before = models.ImageField(upload_to='delivery_proofs/', blank=True, null=True)
    proof_after = models.ImageField(upload_to='delivery_proofs/', blank=True, null=True)
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"Task for {self.food_listing.description}"

class ScoutBookmark(models.Model):
    scout = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmarks')
    name = models.CharField(max_length=255)
    lat = models.FloatField()
    lng = models.FloatField()
    address = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} by {self.scout.username}"

