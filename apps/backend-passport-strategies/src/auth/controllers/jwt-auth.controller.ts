import { Body, Controller, Post, Req, Res, UseGuards, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { GetTokenByUserService } from '../services/get-token-by-user.service';
import { CookieService } from '../services/cookie.service.js';

// Mock store
const USERS = [
  { id: 'u1', username: 'axis', password: 'axis123', name: 'Axis User', email: 'axis@example.com', roles: ['user'] },
];

@Controller('auth/jwt')
export class JwtAuthController {
  constructor(
    @Inject(GetTokenByUserService) private readonly getTokenByUser: GetTokenByUserService,
    @Inject(CookieService) private readonly publicCookieService: CookieService
  ) {}

  @Post('login')
  async login(@Req() req: Request, @Res() res: Response, @Body() _body: any) {

    const user = USERS.find(u => u.username === req.body.username && u.password === req.body.password);

    // Generar JWT
    const token = await this.getTokenByUser.execute(user, 'local-jwt');

    // Establecer cookies (opcional, para navegadores)
    this.publicCookieService.setFromUser(res, user);
    this.publicCookieService.setLoggedIn(res, token, 'local-jwt');

    // Retornar JWT en respuesta JSON
    return res.json({
      success: true,
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: 3600, // 1 hora
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      },
    });
  }

  @Post('refresh')
  @UseGuards(AuthGuard('local-jwt'))
  async refresh(@Req() req: Request, @Res() res: Response) {
    const user = req.user;
    console.log('🔄 Renovando JWT para usuario:', user.id);

    // Generar nuevo JWT
    const newToken = await this.getTokenByUser.execute(user, 'local-jwt');

    // Actualizar cookies
    this.publicCookieService.setFromUser(res, user);
    this.publicCookieService.setLoggedIn(res, newToken, 'local-jwt');

    return res.json({
      success: true,
      message: 'JWT renovado exitosamente',
      accessToken: newToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
  }
}
