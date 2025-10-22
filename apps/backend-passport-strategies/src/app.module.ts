import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { ProductsModule } from './products/products.module.js';
import { ConfigModule } from '@nestjs/config';
import { SessionSyncMiddleware } from './auth/middleware/session-sync.middleware.js';

@Module({
  imports: [ConfigModule.forRoot({
            // Optional: specify path to .env file, default is project root
            // envFilePath: '.env.development',
            // Optional: make ConfigModule globally available, avoids importing in other modules
            isGlobal: true,
            // Optional: load custom configuration files
            // load: [configuration],
          }),
          AuthModule,
          ProductsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionSyncMiddleware).forRoutes('*');
  }
}
