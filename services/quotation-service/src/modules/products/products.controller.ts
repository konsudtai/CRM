import {
  Controller,
  Get,
  Post,
  Put,
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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(TenantGuard, PermissionGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermission('products', 'read')
  async findAll(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isActive') isActive?: string,
  ) {
    const user = (req as any).user;
    const activeFilter =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.productsService.findAll(user.tenantId, page, limit, activeFilter);
  }

  @Post()
  @RequirePermission('products', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateProductDto) {
    const user = (req as any).user;
    return this.productsService.create(user.tenantId, dto);
  }

  @Put(':id')
  @RequirePermission('products', 'update')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const user = (req as any).user;
    return this.productsService.update(user.tenantId, id, dto);
  }
}
