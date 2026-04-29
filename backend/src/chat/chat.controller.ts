import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { EditMessageBodyDto, MessageContentDto, StartConversationDto } from './dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

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
  sendMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MessageContentDto) {
    return this.chat.sendMessage(user.id, id, dto.content);
  }

  @Patch('messages/:id')
  editMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EditMessageBodyDto) {
    return this.chat.editMessage(user.id, id, dto.content);
  }

  @Delete('messages/:id')
  deleteMessage(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.deleteMessage(user.id, id);
  }

  @Post('conversations/:id/clear')
  clearConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.clearConversation(user.id, id);
  }

  @Delete('conversations/:id')
  deleteConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.deleteConversation(user.id, id);
  }
}
