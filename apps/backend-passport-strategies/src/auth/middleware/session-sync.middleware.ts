import { Injectable, Inject } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PublicCookieService } from '../services/public-cookie.service.js';

@Injectable()
export class SessionSyncMiddleware {
  constructor(@Inject(PublicCookieService) private readonly publicCookieService: PublicCookieService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const user: any = (req as any).user || (req as any).session?.user;
    this.publicCookieService.setFromUser(res, user);
    next();
  }
}
