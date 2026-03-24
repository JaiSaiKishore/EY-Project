import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.task_id = self.scope['url_route']['kwargs']['task_id']
        self.room_group_name = f'chat_task_{self.task_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Send chat history on connect
        messages = await self.get_chat_history()
        await self.send(text_data=json.dumps({
            'type': 'history',
            'messages': messages
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        content = data.get('content', '').strip()
        if not content:
            return

        user = self.scope['user']
        if not user or user.is_anonymous:
            return

        message = await self.save_message(user.id, content)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))

    @database_sync_to_async
    def get_chat_history(self):
        from .models import ChatMessage
        messages = ChatMessage.objects.filter(
            delivery_task_id=self.task_id
        ).select_related('sender').order_by('timestamp')
        return [
            {
                'id': msg.id,
                'sender_id': msg.sender.id,
                'sender_name': msg.sender.get_full_name() or msg.sender.username,
                'content': msg.content,
                'timestamp': msg.timestamp.isoformat(),
            }
            for msg in messages
        ]

    @database_sync_to_async
    def save_message(self, user_id, content):
        from .models import ChatMessage, DeliveryTask
        user = User.objects.get(pk=user_id)
        task = DeliveryTask.objects.get(pk=self.task_id)
        msg = ChatMessage.objects.create(
            delivery_task=task,
            sender=user,
            content=content,
        )
        return {
            'id': msg.id,
            'sender_id': user.id,
            'sender_name': user.get_full_name() or user.username,
            'content': msg.content,
            'timestamp': msg.timestamp.isoformat(),
        }
