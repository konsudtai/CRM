import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(tenantId: string, dto: CreateProductDto): Promise<Product> {
    const product = this.productRepo.create({
      tenantId,
      name: dto.name,
      sku: dto.sku,
      description: dto.description ?? null,
      unitPrice: dto.unitPrice,
      unitOfMeasure: dto.unitOfMeasure,
      whtRate: dto.whtRate ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.productRepo.save(product);
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    isActive?: boolean,
  ): Promise<{ data: Product[]; total: number; page: number; limit: number }> {
    const where: any = { tenantId };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await this.productRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id, tenantId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id, tenantId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.sku !== undefined) product.sku = dto.sku;
    if (dto.description !== undefined) product.description = dto.description ?? null;
    if (dto.unitPrice !== undefined) product.unitPrice = dto.unitPrice;
    if (dto.unitOfMeasure !== undefined) product.unitOfMeasure = dto.unitOfMeasure;
    if (dto.whtRate !== undefined) product.whtRate = dto.whtRate ?? null;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    return this.productRepo.save(product);
  }
}
