import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { TasksService, SortableField } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(TenantGuard, PermissionGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequirePermission('tasks', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateTaskDto) {
    const user = (req as any).user;
    return this.tasksService.create(user.tenantId, dto);
  }

  @Get()
  @RequirePermission('tasks', 'read')
  async findAll(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sortBy') sortBy?: SortableField,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    const user = (req as any).user;
    return this.tasksService.findAll(user.tenantId, {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      assignedTo,
    });
  }

  @Get(':id')
  @RequirePermission('tasks', 'read')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.tasksService.findOne(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermission('tasks', 'update')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const user = (req as any).user;
    return this.tasksService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('tasks', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    await this.tasksService.remove(user.tenantId, id);
  }
}
