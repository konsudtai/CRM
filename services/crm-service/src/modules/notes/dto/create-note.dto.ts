import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  IsNumber,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mimeType!: string;

  @IsNumber()
  @Max(10 * 1024 * 1024) // 10MB limit
  fileSize!: number;

  /** Base64-encoded file content */
  @IsString()
  @IsNotEmpty()
  fileContent!: string;
}

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
