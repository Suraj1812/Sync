import { Module } from '@nestjs/common';
import { CallsService } from './calls.service';

@Module({
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
