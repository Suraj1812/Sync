import { IsString, MaxLength, MinLength } from 'class-validator';

export class StartConversationDto {
  @IsString()
  userId: string;
}

export class SendMessageDto {
  @IsString()
  conversationId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class SeenMessageDto {
  @IsString()
  conversationId: string;
}
