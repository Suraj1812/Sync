import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RealtimeService } from '../realtime/realtime.service';
import { ChatService } from './chat.service';
import { EditMessageBodyDto, MessageContentDto, StartConversationDto } from './dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get('conversations')
  list(@CurrentUser() user: AuthUser) {
    return this.chat.listConversations(user.id);
  }

  @Post('conversations')
  start(@CurrentUser() user: AuthUser, @Body() dto: StartConversationDto) {
    return this.chat.startConversation(user.id, dto.userId);
  }

  @Get('conversations/:id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.getMessages(user.id, id);
  }

  @Post('conversations/:id/messages')
  async sendMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MessageContentDto) {
    const message = await this.chat.sendMessage(user.id, id, dto.content);
    const participantIds = await this.chat.getParticipantIds(id);
    this.realtime.emitToUsers(participantIds, 'message:new', message);
    return message;
  }

  @Patch('messages/:id')
  async editMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EditMessageBodyDto) {
    const message = await this.chat.editMessage(user.id, id, dto.content);
    const participantIds = await this.chat.getParticipantIds(message.conversationId);
    this.realtime.emitToUsers(participantIds, 'message:updated', message);
    return message;
  }

  @Delete('messages/:id')
  async deleteMessage(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.chat.deleteMessage(user.id, id);
    const participantIds = await this.chat.getParticipantIds(result.conversationId);
    this.realtime.emitToUsers(participantIds, 'message:deleted', result);
    return result;
  }

  @Post('conversations/:id/clear')
  async clearConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.chat.clearConversation(user.id, id);
    this.realtime.emitToUser(user.id, 'conversation:cleared', result);
    return result;
  }

  @Delete('conversations/:id')
  async deleteConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.chat.deleteConversation(user.id, id);
    this.realtime.emitToUser(user.id, 'conversation:deleted', result);
    return result;
  }
}
