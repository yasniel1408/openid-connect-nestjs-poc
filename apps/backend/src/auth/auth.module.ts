import { Module } from '@nestjs/common';
import { OidcService } from './oidc.service';
import { AuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [OidcService, AuthGuard],
  exports: [AuthGuard, OidcService],
})
export class AuthModule {}
