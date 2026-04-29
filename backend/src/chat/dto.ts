import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const cuidPattern = /^c[a-z0-9]{8,}$/i;

export class StartConversationDto {
  @Matches(cuidPattern)
  userId: string;
}

export class SendMessageDto {
  @Matches(cuidPattern)
  conversationId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class MessageContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class SeenMessageDto {
  @Matches(cuidPattern)
  conversationId: string;
}

export class MessageActionDto {
  @Matches(cuidPattern)
  messageId: string;
}

export class EditMessageDto extends MessageActionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class EditMessageBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class ConversationActionDto {
  @Matches(cuidPattern)
  conversationId: string;
}
