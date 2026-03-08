import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { FieldsModule } from './modules/fields/fields.module';
import { RelationsModule } from './modules/relations/relations.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { RecordsModule } from './modules/records/records.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { FilesModule } from './modules/files/files.module';
import { MembersModule } from './modules/members/members.module';
import { UsersModule } from './modules/users/users.module';
import { TeamModule } from './modules/team/team.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    ProjectsModule,
    CollectionsModule,
    FieldsModule,
    RelationsModule,
    ApiKeysModule,
    RecordsModule,
    UploadsModule,
    FilesModule,
    MembersModule,
    UsersModule,
    TeamModule,
  ],
})
export class AppModule {}
