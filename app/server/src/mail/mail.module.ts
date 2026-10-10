import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Outgoing email. Imported by every module that issues credentials
 * (establishment, supervisor, coordinator). Nest builds a module's providers
 * once, so they all share one MailService: one transport, one startup check.
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
