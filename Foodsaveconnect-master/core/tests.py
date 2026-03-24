from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from .models import FoodListing, DeliveryTask, Rating, TrustScore, ChatMessage


class RatingTrustScoreTests(TestCase):
    def setUp(self):
        self.donor = User.objects.create_user(username='donor@test.com', password='testpass123')
        self.scout = User.objects.create_user(username='scout@test.com', password='testpass123')
        self.listing = FoodListing.objects.create(
            donor=self.donor,
            description='Test Food',
            quantity=10,
            prepared_time=timezone.now(),
            expiry_time=timezone.now() + timedelta(hours=4),
        )
        self.task = DeliveryTask.objects.create(
            food_listing=self.listing,
            scout=self.scout,
            status='Delivered',
        )

    def test_rating_creates_trust_score(self):
        Rating.objects.create(
            reviewer=self.scout, reviewee=self.donor,
            delivery_task=self.task, score=5, comments='Great!'
        )
        trust, _ = TrustScore.objects.get_or_create(user=self.donor)
        trust.recalculate()
        self.assertEqual(trust.total_reviews, 1)
        self.assertEqual(trust.average_rating, 5.0)

    def test_trust_score_averages_multiple_ratings(self):
        task2 = DeliveryTask.objects.create(
            food_listing=self.listing, scout=self.scout, status='Delivered',
        )
        scout2 = User.objects.create_user(username='scout2@test.com', password='testpass123')
        Rating.objects.create(
            reviewer=self.scout, reviewee=self.donor,
            delivery_task=self.task, score=5,
        )
        Rating.objects.create(
            reviewer=scout2, reviewee=self.donor,
            delivery_task=task2, score=3,
        )
        trust, _ = TrustScore.objects.get_or_create(user=self.donor)
        trust.recalculate()
        self.assertEqual(trust.total_reviews, 2)
        self.assertEqual(trust.average_rating, 4.0)

    def test_unique_rating_per_reviewer_per_task(self):
        Rating.objects.create(
            reviewer=self.scout, reviewee=self.donor,
            delivery_task=self.task, score=4,
        )
        with self.assertRaises(Exception):
            Rating.objects.create(
                reviewer=self.scout, reviewee=self.donor,
                delivery_task=self.task, score=5,
            )

    def test_rating_score_range(self):
        rating = Rating(
            reviewer=self.scout, reviewee=self.donor,
            delivery_task=self.task, score=3,
        )
        self.assertIn(rating.score, [1, 2, 3, 4, 5])


class ChatMessageTests(TestCase):
    def setUp(self):
        self.donor = User.objects.create_user(username='donor@test.com', password='testpass123')
        self.scout = User.objects.create_user(username='scout@test.com', password='testpass123')
        self.listing = FoodListing.objects.create(
            donor=self.donor,
            description='Test Food',
            quantity=10,
            prepared_time=timezone.now(),
            expiry_time=timezone.now() + timedelta(hours=4),
        )
        self.task = DeliveryTask.objects.create(
            food_listing=self.listing, scout=self.scout, status='Accepted',
        )

    def test_create_chat_message(self):
        msg = ChatMessage.objects.create(
            delivery_task=self.task, sender=self.scout, content='Hello!'
        )
        self.assertEqual(msg.content, 'Hello!')
        self.assertEqual(msg.sender, self.scout)

    def test_chat_messages_ordered_by_timestamp(self):
        m1 = ChatMessage.objects.create(delivery_task=self.task, sender=self.scout, content='First')
        m2 = ChatMessage.objects.create(delivery_task=self.task, sender=self.donor, content='Second')
        msgs = list(ChatMessage.objects.filter(delivery_task=self.task))
        self.assertEqual(msgs[0].id, m1.id)
        self.assertEqual(msgs[1].id, m2.id)

    def test_chat_api_requires_auth(self):
        response = self.client.get(f'/api/chat/{self.task.id}/')
        self.assertEqual(response.status_code, 401)

    def test_chat_api_returns_messages(self):
        ChatMessage.objects.create(delivery_task=self.task, sender=self.scout, content='Hi there')
        self.client.login(username='scout@test.com', password='testpass123')
        response = self.client.get(f'/api/chat/{self.task.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)


class RatingAPITests(TestCase):
    def setUp(self):
        self.donor = User.objects.create_user(username='donor@test.com', password='testpass123')
        self.scout = User.objects.create_user(username='scout@test.com', password='testpass123')
        self.listing = FoodListing.objects.create(
            donor=self.donor,
            description='Test Food',
            quantity=10,
            prepared_time=timezone.now(),
            expiry_time=timezone.now() + timedelta(hours=4),
        )
        self.task = DeliveryTask.objects.create(
            food_listing=self.listing, scout=self.scout, status='Delivered',
        )

    def test_submit_rating_via_api(self):
        self.client.login(username='scout@test.com', password='testpass123')
        response = self.client.post('/api/ratings/', {
            'reviewee': self.donor.id,
            'delivery_task': self.task.id,
            'score': 5,
            'comments': 'Excellent donor!',
        }, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        trust = TrustScore.objects.get(user=self.donor)
        self.assertEqual(trust.average_rating, 5.0)

    def test_my_trust_score_endpoint(self):
        self.client.login(username='donor@test.com', password='testpass123')
        response = self.client.get('/api/ratings/my_trust_score/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('average_rating', data)
        self.assertIn('total_reviews', data)
