import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabOrder } from './entities/lab-order.entity';
import { LabTest } from './entities/lab-test.entity';
import { LabService } from './lab.service';
import { LabController } from './lab.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LabOrder, LabTest])],
  providers: [LabService],
  controllers: [LabController],
  exports: [LabService],
})
export class LabModule {}
