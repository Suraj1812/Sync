import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CallsModule } from '../calls/calls.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { SyncGateway } from './sync.gateway';

@Module({
  imports: [AuthModule, UsersModule, ChatModule, CallsModule],
  providers: [SyncGateway],
})
export class GatewayModule {}
