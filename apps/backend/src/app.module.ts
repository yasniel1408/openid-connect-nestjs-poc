import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { SessionSyncMiddleware } from './auth/session-sync.middleware';

@Module({
  imports: [AuthModule, ProductsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionSyncMiddleware).forRoutes('*');
  }
}
