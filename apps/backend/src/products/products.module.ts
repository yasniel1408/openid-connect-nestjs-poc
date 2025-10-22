import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
})
export class ProductsModule {}

