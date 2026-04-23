import { IsArray, IsUUID } from 'class-validator';

export class AssignTagsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds!: string[];
}
