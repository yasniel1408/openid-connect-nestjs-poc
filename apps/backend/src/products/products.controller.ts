import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';

type Product = { id: string; name: string; price: number; currency: string };

const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Cafetera Pro', price: 129.99, currency: 'USD' },
  { id: 'p2', name: 'Auriculares Inalámbricos', price: 79.9, currency: 'USD' },
  { id: 'p3', name: 'Teclado Mecánico', price: 99.0, currency: 'USD' },
];

@Controller('products')
@UseGuards(AuthGuard)
export class ProductsController {
  @Get()
  list(): Product[] {
    return MOCK_PRODUCTS;
  }
}
