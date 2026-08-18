from django.urls import path
from .views import TrackSearchView, TrackPageViewView, TrackCartEventView, TrackAbandonmentView, AnalyticsDashboardView, SearchTrafficView, CartAbandonmentListView, NewCustomersView, DailySummaryView
urlpatterns = [
    path('track/search/',      TrackSearchView.as_view(),       name='track-search'),
    path('track/pageview/',    TrackPageViewView.as_view(),     name='track-pageview'),
    path('track/cart/',        TrackCartEventView.as_view(),    name='track-cart'),
    path('track/abandonment/', TrackAbandonmentView.as_view(),  name='track-abandonment'),
    path('dashboard/',         AnalyticsDashboardView.as_view(),name='analytics-dashboard'),
    path('search-traffic/',    SearchTrafficView.as_view(),     name='search-traffic'),
    path('abandonments/',      CartAbandonmentListView.as_view(),name='abandonments'),
    path('new-customers/',     NewCustomersView.as_view(),      name='new-customers'),
    path('daily-summary/',     DailySummaryView.as_view(),      name='daily-summary'),
]
