import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { AssignTagsDto } from './dto/assign-tags.dto';

@Controller()
@UseGuards(TenantGuard, PermissionGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post('tags')
  @RequirePermission('tags', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createTag(@Req() req: Request, @Body() dto: CreateTagDto) {
    const user = (req as any).user;
    return this.tagsService.createTag(user.tenantId, dto);
  }

  @Get('tags')
  @RequirePermission('tags', 'read')
  async findAll(@Req() req: Request) {
    const user = (req as any).user;
    return this.tagsService.findAll(user.tenantId);
  }

  @Put('accounts/:id/tags')
  @RequirePermission('accounts', 'update')
  async assignTags(
    @Req() req: Request,
    @Param('id') accountId: string,
    @Body() dto: AssignTagsDto,
  ) {
    const user = (req as any).user;
    return this.tagsService.assignTags(user.tenantId, accountId, dto.tagIds);
  }

  @Get('accounts/:id/tags')
  @RequirePermission('accounts', 'read')
  async getAccountTags(
    @Req() req: Request,
    @Param('id') accountId: string,
  ) {
    const user = (req as any).user;
    return this.tagsService.getAccountTags(user.tenantId, accountId);
  }
}
