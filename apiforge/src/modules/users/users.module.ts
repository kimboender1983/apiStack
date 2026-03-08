import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [UsersController],
})
export class UsersModule {}
