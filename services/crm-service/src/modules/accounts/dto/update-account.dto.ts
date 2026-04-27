import { CreateAccountDto } from './create-account.dto';

export class UpdateAccountDto extends CreateAccountDto {
  shippingAddress?: string;
  shippingSubDistrict?: string;
  shippingDistrict?: string;
  shippingProvince?: string;
  shippingPostalCode?: string;
  accountOwner?: string;
  accountStatus?: string;
}
