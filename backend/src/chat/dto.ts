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

export class SeenMessageDto {
  @Matches(cuidPattern)
  conversationId: string;
}
