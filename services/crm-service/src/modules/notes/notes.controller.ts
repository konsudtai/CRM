import {
  Controller,
  Post,
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
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Controller('accounts')
@UseGuards(TenantGuard, PermissionGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post(':id/notes')
  @RequirePermission('accounts', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createNote(
    @Req() req: Request,
    @Param('id') accountId: string,
    @Body() dto: CreateNoteDto,
  ) {
    const user = (req as any).user;
    return this.notesService.createNote(
      user.tenantId,
      accountId,
      user.sub,
      dto,
    );
  }
}
