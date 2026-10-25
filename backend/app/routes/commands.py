from fastapi import APIRouter
from app.controllers.commands import command

commands = APIRouter(prefix="/api", tags=["Commands"])
COMMAND_PATHS = (
    '/login', '/logout', '/register', '/quote', '/orders', '/payments', '/proof-of-delivery',
    '/returns', '/tracking', '/users', '/registrations/approve', '/registrations/reject',
    '/products', '/batches', '/inventory', '/batches/quarantine', '/pricing', '/business',
    '/notifications/read',
)


for command_path in COMMAND_PATHS:
    commands.add_api_route(command_path, command, methods=['POST'], name='command_' + command_path.strip('/').replace('/', '_'))
commands.add_api_route('/orders/{order_id}', command, methods=['POST'], name='command_order_detail')


