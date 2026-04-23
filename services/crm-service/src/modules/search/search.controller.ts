import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(TenantGuard, PermissionGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequirePermission('search', 'read')
  async search(
    @Req() req: Request,
    @Query('q') query: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query "q" is required');
    }
    const user = (req as any).user;
    return this.searchService.search(user.tenantId, query.trim(), page, limit);
  }
}
