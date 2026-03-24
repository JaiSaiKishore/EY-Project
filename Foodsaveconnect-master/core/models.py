from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta


class UserProfile(models.Model):
    ROLE_CHOICES = [('donor', 'Donor'), ('volunteer', 'Volunteer')]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='donor')
    phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=500, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    # Volunteer-specific
    availability = models.CharField(max_length=50, blank=True)  # weekdays, weekends, evenings, flexible
    preferred_area = models.CharField(max_length=255, blank=True)
    # Donor-specific
    organization = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class FoodListing(models.Model):
    STATUS_CHOICES = [
        ('Available', 'Available'),
        ('Claimed', 'Claimed'),
        ('Picked Up', 'Picked Up'),
        ('Delivered', 'Delivered'),
        ('Expired', 'Expired'),
        ('Cancelled', 'Cancelled'),
    ]
    FOOD_TYPE_CHOICES = [('Veg', 'Veg'), ('Non-veg', 'Non-veg'), ('Any', 'Any')]

    donor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='donations')
    description = models.CharField(max_length=255)
    food_type = models.CharField(max_length=20, choices=FOOD_TYPE_CHOICES, default='Any')
    quantity = models.IntegerField(help_text="Approx in kg or servings")
    prepared_time = models.DateTimeField()
    expiry_time = models.DateTimeField()
    photo = models.ImageField(upload_to='food_photos/', blank=True, null=True)
    # Pickup details
    pickup_address = models.CharField(max_length=500, blank=True)
    pickup_lat = models.FloatField(null=True, blank=True)
    pickup_lng = models.FloatField(null=True, blank=True)
    pickup_from = models.DateTimeField(null=True, blank=True)
    pickup_until = models.DateTimeField(null=True, blank=True)
    pickup_instructions = models.TextField(blank=True)
    contact_person = models.CharField(max_length=255, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    # Packaging & safety
    has_packaging = models.BooleanField(default=False)
    hygiene_declared = models.BooleanField(default=False)
    max_holding_hours = models.IntegerField(default=3)
    # Self-delivery
    is_self_delivered = models.BooleanField(default=False)
    target_lat = models.FloatField(null=True, blank=True)
    target_lng = models.FloatField(null=True, blank=True)
    # Template
    is_template = models.BooleanField(default=False)
    template_name = models.CharField(max_length=255, blank=True)
    # Status & timestamps
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Available')
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_expired(self):
        return timezone.now() > self.expiry_time

    @property
    def time_remaining_mins(self):
        delta = self.expiry_time - timezone.now()
        return max(0, int(delta.total_seconds() / 60))

    def __str__(self):
        return f"{self.description} by {self.donor.username}"


class NeedyLocation(models.Model):
    URGENCY_CHOICES = [('High', 'High'), ('Medium', 'Medium'), ('Low', 'Low')]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Accepted', 'Accepted'),
        ('In Transit', 'In Transit'),
        ('Delivered', 'Delivered'),
    ]
    CATEGORY_CHOICES = [('Children', 'Children'), ('Elderly', 'Elderly'), ('Mixed', 'Mixed'), ('General', 'General')]
    FOOD_TYPE_CHOICES = [('Veg', 'Veg'), ('Non-veg', 'Non-veg'), ('Any', 'Any')]
    MEAL_TIME_CHOICES = [('Breakfast', 'Breakfast'), ('Lunch', 'Lunch'), ('Dinner', 'Dinner'), ('Any', 'Any')]

    name = models.CharField(max_length=255, default="Unnamed Location")
    description = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    address = models.CharField(max_length=500, blank=True, default='')
    lat = models.FloatField()
    lng = models.FloatField()
    urgency = models.CharField(max_length=50, choices=URGENCY_CHOICES, default='Medium')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='General')
    food_type = models.CharField(max_length=50, choices=FOOD_TYPE_CHOICES, default='Any')
    meal_time = models.CharField(max_length=50, choices=MEAL_TIME_CHOICES, default='Any')
    meals_needed = models.IntegerField(default=10)
    people_count = models.IntegerField(default=0)
    photo = models.ImageField(upload_to='scout_photos/', blank=True, null=True)
    reported_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reported_locations')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    is_active = models.BooleanField(default=True)
    expiry_time = models.DateTimeField(blank=True, null=True)
    last_verified = models.DateTimeField(null=True, blank=True)
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
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Accepted', 'Accepted'),
        ('Picked Up', 'Picked Up'),
        ('On Way', 'On Way'),
        ('Delivered', 'Delivered'),
        ('Failed', 'Failed'),
    ]

    food_listing = models.ForeignKey(FoodListing, on_delete=models.CASCADE, related_name='delivery_tasks')
    destination = models.ForeignKey(NeedyLocation, on_delete=models.CASCADE, null=True, blank=True, related_name='deliveries')
    scout = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='deliveries')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    started_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    proof_before = models.ImageField(upload_to='delivery_proofs/', blank=True, null=True)
    proof_after = models.ImageField(upload_to='delivery_proofs/', blank=True, null=True)
    people_served = models.IntegerField(default=0)
    distance_km = models.FloatField(default=0)
    notes = models.TextField(blank=True)
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"Task for {self.food_listing.description}"


class Notification(models.Model):
    TYPE_CHOICES = [
        ('donation_accepted', 'Donation Accepted'),
        ('volunteer_nearby', 'Volunteer Nearby'),
        ('no_volunteer', 'No Volunteer Found'),
        ('new_donation_nearby', 'New Donation Nearby'),
        ('delivery_complete', 'Delivery Complete'),
        ('listing_expiring', 'Listing Expiring'),
        ('new_hotspot', 'New Hotspot Nearby'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    related_listing = models.ForeignKey(FoodListing, on_delete=models.CASCADE, null=True, blank=True)
    related_task = models.ForeignKey(DeliveryTask, on_delete=models.CASCADE, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} for {self.user.username}"


class ScoutBookmark(models.Model):
    scout = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmarks')
    name = models.CharField(max_length=255)
    lat = models.FloatField()
    lng = models.FloatField()
    address = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} by {self.scout.username}"


class Rating(models.Model):
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ratings_given')
    reviewee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ratings_received')
    delivery_task = models.ForeignKey(DeliveryTask, on_delete=models.CASCADE, related_name='ratings')
    score = models.IntegerField(choices=[(i, str(i)) for i in range(1, 6)])
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('reviewer', 'delivery_task')

    def __str__(self):
        return f"{self.reviewer.username} rated {self.reviewee.username}: {self.score}/5"


class TrustScore(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='trust_score')
    average_rating = models.FloatField(default=0.0)
    total_reviews = models.IntegerField(default=0)

    def recalculate(self):
        ratings = Rating.objects.filter(reviewee=self.user)
        self.total_reviews = ratings.count()
        if self.total_reviews > 0:
            self.average_rating = round(ratings.aggregate(avg=models.Avg('score'))['avg'], 2)
        else:
            self.average_rating = 0.0
        self.save()

    def __str__(self):
        return f"{self.user.username}: {self.average_rating}/5 ({self.total_reviews} reviews)"


class ChatMessage(models.Model):
    delivery_task = models.ForeignKey(DeliveryTask, on_delete=models.CASCADE, related_name='chat_messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.sender.username}: {self.content[:50]}"
