from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'food', views.FoodListingViewSet)
router.register(r'locations', views.NeedyLocationViewSet, basename='locations')
router.register(r'tasks', views.DeliveryTaskViewSet)
router.register(r'bookmarks', views.ScoutBookmarkViewSet, basename='bookmarks')

urlpatterns = [
    path('', views.landing_view, name='landing'),
    path('signup/', views.signup_view, name='signup'),
    path('signin/', views.signin_view, name='signin'),
    path('signout/', views.signout_view, name='signout'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('api/', include(router.urls)),
    path('api/stats/', views.dashboard_stats, name='dashboard-stats'),
    path('api/scout-stats/', views.scout_stats, name='scout-stats'),
]
