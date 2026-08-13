import json, logging
from channels.generic.websocket import AsyncWebsocketConsumer
logger = logging.getLogger('katalog.ws')
ROLE_GROUPS = {'advisor': 'advisors', 'technician': 'technicians', 'admin': 'admins', 'superadmin': 'admins'}

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4001); return
        self.groups_joined = [f'user_{user.id}']
        rg = ROLE_GROUPS.get(getattr(user, 'role', ''))
        if rg: self.groups_joined.append(rg)
        for g in self.groups_joined: await self.channel_layer.group_add(g, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({'type': 'connected', 'role': user.role}))
    async def disconnect(self, code):
        for g in getattr(self, 'groups_joined', []):
            await self.channel_layer.group_discard(g, self.channel_name)
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping': await self.send(text_data=json.dumps({'type': 'pong'}))
        except Exception: pass
    async def order_notification(self, event): await self.send(text_data=json.dumps(event['data']))
    async def repair_notification(self, event): await self.send(text_data=json.dumps(event['data']))
