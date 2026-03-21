from django.contrib import admin
from .models import FoodListing, NeedyLocation, DeliveryTask

admin.site.register(FoodListing)
admin.site.register(NeedyLocation)
admin.site.register(DeliveryTask)
