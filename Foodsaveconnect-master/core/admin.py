from django.contrib import admin
from .models import FoodListing, NeedyLocation, DeliveryTask, ScoutBookmark, UserProfile, Notification

admin.site.register(UserProfile)
admin.site.register(FoodListing)
admin.site.register(NeedyLocation)
admin.site.register(DeliveryTask)
admin.site.register(ScoutBookmark)
admin.site.register(Notification)
