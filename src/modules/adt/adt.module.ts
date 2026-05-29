import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ward } from './entities/ward.entity';
import { Bed } from './entities/bed.entity';
import { Admission } from './entities/admission.entity';
import { AdtService } from './adt.service';
import { AdtController } from './adt.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ward, Bed, Admission])],
  providers: [AdtService],
  controllers: [AdtController],
  exports: [AdtService],
})
export class AdtModule {}
